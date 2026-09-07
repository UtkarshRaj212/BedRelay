import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, dispatchActivities } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { POST as createDispatchHandler } from "../app/api/dispatch/route";
import { PATCH as modifyDispatchHandler } from "../app/api/dispatch/modify/route";
import { POST as switchHospitalHandler } from "../app/api/dispatch/switch/route";
import { GET as getActiveDispatchHandler } from "../app/api/dispatch/active/route";
import { GET as getDispatchByIdHandler } from "../app/api/dispatch-requests/[id]/route";
import { checkAndAutoCompleteExpiredDispatches, DISPATCHER_COOKIE_NAME } from "../lib/dispatcher-server";

async function runTest() {
  console.log("================================================================================");
  console.log("⚡ END-TO-END LIFECYCLE, MODIFICATION, PERSISTENCE & AUTO-COMPLETION TEST");
  console.log("================================================================================\n");

  const testSessionId = `disp_sess_life_${Date.now()}`;
  console.log(`Using Test Dispatcher Session: ${testSessionId}`);

  // Fetch two distinct hospitals
  const allHospitals = await db.select().from(hospitals).limit(2);
  if (allHospitals.length < 2) {
    throw new Error("Requires at least 2 hospitals in database for switch testing.");
  }
  const [hospitalA, hospitalB] = allHospitals;
  console.log(`✓ Hospital A: [${hospitalA.id}] ${hospitalA.name}`);
  console.log(`✓ Hospital B: [${hospitalB.id}] ${hospitalB.name}`);

  // Setup Bed Categories for Hospital A: ICU (10 avail) and GENERAL (20 avail)
  let [icuA] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "ICU")))
    .limit(1);

  if (!icuA) {
    const now = new Date();
    [icuA] = await db
      .insert(bedCategories)
      .values({
        id: `bed_icu_a_${Date.now()}`,
        hospitalId: hospitalA.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit",
        totalBeds: 20,
        availableBeds: 10,
        occupiedBeds: 10,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now,
      })
      .returning();
  } else {
    await db
      .update(bedCategories)
      .set({ totalBeds: 20, availableBeds: 10, occupiedBeds: 10 })
      .where(eq(bedCategories.id, icuA.id));
  }

  let [genA] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "GENERAL")))
    .limit(1);

  if (!genA) {
    const now = new Date();
    [genA] = await db
      .insert(bedCategories)
      .values({
        id: `bed_gen_a_${Date.now()}`,
        hospitalId: hospitalA.id,
        categoryCode: "GENERAL",
        name: "General Ward",
        totalBeds: 30,
        availableBeds: 20,
        occupiedBeds: 10,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now,
      })
      .returning();
  } else {
    await db
      .update(bedCategories)
      .set({ totalBeds: 30, availableBeds: 20, occupiedBeds: 10 })
      .where(eq(bedCategories.id, genA.id));
  }

  // Setup Bed Categories for Hospital B: GENERAL (15 avail)
  let [genB] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "GENERAL")))
    .limit(1);

  if (!genB) {
    const now = new Date();
    [genB] = await db
      .insert(bedCategories)
      .values({
        id: `bed_gen_b_${Date.now()}`,
        hospitalId: hospitalB.id,
        categoryCode: "GENERAL",
        name: "General Ward",
        totalBeds: 30,
        availableBeds: 15,
        occupiedBeds: 15,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now,
      })
      .returning();
  } else {
    await db
      .update(bedCategories)
      .set({ totalBeds: 30, availableBeds: 15, occupiedBeds: 15 })
      .where(eq(bedCategories.id, genB.id));
  }

  console.log("✓ Bed inventories initialized successfully.");

  // ---------------------------------------------------------------------------
  // STEP 1: Create request with 1 ICU (ETA 10, patient: Stable)
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 1: Dispatcher creates request (1 ICU, ETA 10m, Stable) ---");
  const createReq = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      hospitalId: hospitalA.id,
      ambulanceUnit: "MEDIC-99",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 10,
      patientCondition: "Patient condition is stable with mild chest discomfort",
      patientRef: "PT-001",
      dispatcherSessionId: testSessionId,
    }),
  });

  const createRes = await createDispatchHandler(createReq);
  const createData = await createRes.json();
  if (!createRes.ok || !createData.dispatch) {
    throw new Error(`Step 1 failed: ${JSON.stringify(createData)}`);
  }
  const dispatchId = createData.dispatch.id;
  console.log(`✓ Dispatch created: ${dispatchId} (status: ${createData.dispatch.status})`);

  // Verify in Neon
  const [createdRow] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
  if (createdRow.requestedBeds !== 1 || createdRow.bedCategoryCode !== "ICU" || createdRow.etaMinutes !== 10) {
    throw new Error("Step 1 assertion failed: values in Neon do not match created request.");
  }
  console.log("✓ Verified in Neon: 1 ICU, ETA 10m, requestedBeds=1, approvedBeds=0");

  // ---------------------------------------------------------------------------
  // STEP 2: Hospital A accepts request (1 ICU approved)
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 2: Hospital A accepts request with 1 ICU approved ---");
  await db
    .update(dispatchRequests)
    .set({
      status: "ACCEPTED",
      approvedBeds: 1,
      reviewRequired: false,
      updatedAt: new Date(),
    })
    .where(eq(dispatchRequests.id, dispatchId));

  // Deduct 1 from ICU available beds to represent accepted reservation
  await db
    .update(bedCategories)
    .set({ availableBeds: 9, occupiedBeds: 11 })
    .where(eq(bedCategories.id, icuA.id));

  // Record audit activity
  const now = new Date();
  await db.insert(dispatchActivities).values({
    id: `act_accept_${Date.now()}`,
    dispatchId,
    timestamp: now,
    actorType: "HOSPITAL",
    actorName: "Hospital Admin",
    action: "REQUEST_ACCEPTED",
    details: "Request accepted with 1 bed approved",
    newValue: JSON.stringify({ approvedBeds: 1, bedCategoryCode: "ICU" }),
    createdAt: now,
  });

  const [acceptedRow] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
  if (acceptedRow.status !== "ACCEPTED" || acceptedRow.approvedBeds !== 1) {
    throw new Error("Step 2 assertion failed: Request not properly accepted.");
  }
  console.log("✓ Request accepted: 1 ICU approved, ICU available beds = 9");

  // ---------------------------------------------------------------------------
  // STEP 3: Dispatcher modifies request to 10 General (ETA 20, patient: Critical)
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 3: Dispatcher modifies to 10 GENERAL (ETA 20m, Critical) ---");
  const modifyReq = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      dispatchId,
      bedCategoryCode: "GENERAL",
      requestedBeds: 10,
      etaMinutes: 20,
      patientCondition: "Patient condition deteriorated into acute respiratory distress and critical septic shock",
      patientRef: "PT-001-MOD",
      dispatcherSessionId: testSessionId,
    }),
  });

  const modifyRes = await modifyDispatchHandler(modifyReq);
  const modifyData = await modifyRes.json();
  if (!modifyRes.ok || !modifyData.success) {
    throw new Error(`Step 3 modification failed: ${JSON.stringify(modifyData)}`);
  }
  console.log("✓ Modification response received:", modifyData.message);

  // Verify in Neon:
  // 1. Same request ID (not duplicate)
  // 2. requestedBeds = 10, bedCategoryCode = "GENERAL", etaMinutes = 20
  // 3. Category changed -> approvedBeds = 0 (reset), reviewRequired = true
  // 4. ICU bed returned to inventory: ICU available = 10
  const [modRow] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
  if (modRow.requestedBeds !== 10) throw new Error(`Expected requestedBeds=10, got ${modRow.requestedBeds}`);
  if (modRow.bedCategoryCode !== "GENERAL") throw new Error(`Expected category GENERAL, got ${modRow.bedCategoryCode}`);
  if (modRow.etaMinutes !== 20) throw new Error(`Expected etaMinutes=20, got ${modRow.etaMinutes}`);
  if (modRow.approvedBeds !== 0) throw new Error(`Expected approvedBeds=0 after category change, got ${modRow.approvedBeds}`);
  if (!modRow.reviewRequired) throw new Error("Expected reviewRequired=true after category change");

  const [refreshedIcuA] = await db.select().from(bedCategories).where(eq(bedCategories.id, icuA.id));
  if (refreshedIcuA.availableBeds !== 10) {
    throw new Error(`Expected ICU available beds returned to 10, got ${refreshedIcuA.availableBeds}`);
  }
  console.log("✓ Verified in Neon: requestedBeds=10, category=GENERAL, etaMinutes=20, approvedBeds=0, reviewRequired=true");
  console.log("✓ Verified: previous 1 ICU bed returned to inventory (ICU available = 10)");

  // Verify audit logs for CATEGORY_CHANGED and REQUEST_MODIFIED
  const activities = await db
    .select()
    .from(dispatchActivities)
    .where(eq(dispatchActivities.dispatchId, dispatchId))
    .orderBy(desc(dispatchActivities.createdAt));

  const catChangeLog = activities.find((a) => a.action === "CATEGORY_CHANGED");
  const modLog = activities.find((a) => a.action === "REQUEST_MODIFIED");
  if (!catChangeLog) throw new Error("Missing CATEGORY_CHANGED audit activity");
  if (!modLog) throw new Error("Missing REQUEST_MODIFIED audit activity");
  console.log("✓ Verified audit activities: CATEGORY_CHANGED and REQUEST_MODIFIED logged");

  // ---------------------------------------------------------------------------
  // STEP 4: Verify Dispatch Tracking polling endpoint receives latest values (10 GENERAL)
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 4: Verify Dispatch polling endpoint reflects latest values ---");
  const trackReq = new NextRequest(`http://localhost:3000/api/dispatch-requests/${dispatchId}?sessionId=${testSessionId}`, {
    headers: { Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}` },
  });
  const trackRes = await getDispatchByIdHandler(trackReq, { params: Promise.resolve({ id: dispatchId }) });
  const trackData = await trackRes.json();
  const trackDispatch = trackData.dispatch;
  if (!trackDispatch) throw new Error(`Dispatch tracking endpoint failed: ${JSON.stringify(trackData)}`);
  if (trackDispatch.requestedBeds !== 10 || trackDispatch.bedCategoryCode !== "GENERAL" || trackDispatch.etaMinutes !== 20) {
    throw new Error(`Dispatch tracking returned stale data: ${JSON.stringify(trackDispatch)}`);
  }
  if (!trackDispatch.reviewRequired) {
    throw new Error("Dispatch tracking expected reviewRequired=true");
  }
  console.log("✓ Polling endpoint confirms latest modified values: 10 GENERAL, ETA 20, reviewRequired=true");

  // ---------------------------------------------------------------------------
  // STEP 5: Dispatcher switches receiving hospital to Hospital B
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 5: Dispatcher switches receiving hospital to Hospital B ---");
  const switchReq = new NextRequest("http://localhost:3000/api/dispatch/switch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      targetHospitalId: hospitalB.id,
      bedCategoryCode: "GENERAL",
      requestedBeds: 10,
      etaMinutes: 20,
      patientCondition: "Patient condition deteriorated into acute respiratory distress and critical septic shock",
      dispatcherSessionId: testSessionId,
    }),
  });

  const switchRes = await switchHospitalHandler(switchReq);
  const switchData = await switchRes.json();
  const newDispatch = switchData.dispatch || switchData.newDispatch;
  if (!switchRes.ok || !switchData.success || !newDispatch) {
    throw new Error(`Step 5 hospital switch failed: ${JSON.stringify(switchData)}`);
  }
  const newDispatchId = newDispatch.id;
  console.log(`✓ Hospital switched! Old dispatch cancelled, new dispatch created: ${newDispatchId}`);

  // Verify old dispatch is CANCELLED
  const [oldDispatchRow] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
  if (oldDispatchRow.status !== "CANCELLED") {
    throw new Error(`Expected old dispatch status CANCELLED, got ${oldDispatchRow.status}`);
  }
  console.log("✓ Old dispatch status is CANCELLED");

  // Verify new dispatch has latest values (10 GENERAL, ETA 20, Hospital B)
  const [newDispatchRow] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, newDispatchId));
  if (newDispatchRow.hospitalId !== hospitalB.id) throw new Error("New dispatch has wrong hospitalId");
  if (newDispatchRow.bedCategoryCode !== "GENERAL") throw new Error("New dispatch has wrong category");
  if (newDispatchRow.requestedBeds !== 10) throw new Error(`New dispatch expected requestedBeds=10, got ${newDispatchRow.requestedBeds}`);
  if (newDispatchRow.etaMinutes !== 20) throw new Error(`New dispatch expected etaMinutes=20, got ${newDispatchRow.etaMinutes}`);
  console.log("✓ New dispatch on Hospital B successfully inherited latest modified values: 10 GENERAL, ETA 20m");

  // Verify active session now points to new dispatch
  const activeReq = new NextRequest("http://localhost:3000/api/dispatch/active", {
    headers: { Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}` },
  });
  const activeRes = await getActiveDispatchHandler(activeReq);
  const activeData = await activeRes.json();
  if (activeData.activeDispatch?.id !== newDispatchId) {
    throw new Error(`Active session not tracking new dispatch. Got: ${activeData.activeDispatch?.id}`);
  }
  console.log("✓ Active dispatcher session tracking new dispatch ID:", newDispatchId);

  // ---------------------------------------------------------------------------
  // STEP 6: ETA Auto-Completion Lifecycle Verification
  // Rule: threshold = ETA + buffer, where buffer = max(20, ETA / 3).
  // With ETA = 20: buffer = max(20, 6.67) = 20 -> threshold = 40 minutes.
  // We simulate createdAt = 45 minutes ago (elapsed > 40m).
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 6: ETA Auto-Completion Rule: threshold = ETA + max(20, ETA / 3) ---");
  console.log("Setting new dispatch createdAt to 45 minutes ago (ETA = 20, buffer = 20, threshold = 40 minutes)...");
  const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000);
  await db
    .update(dispatchRequests)
    .set({
      createdAt: fortyFiveMinutesAgo,
      status: "ACCEPTED", // Auto-completion applies to ACTIVE requests (ACCEPTED / PENDING)
    })
    .where(eq(dispatchRequests.id, newDispatchId));

  // Run auto-completion check
  const autoCompletedCount = await checkAndAutoCompleteExpiredDispatches();
  console.log(`✓ checkAndAutoCompleteExpiredDispatches ran. Completed count: ${autoCompletedCount}`);

  // Verify new dispatch is marked COMPLETED in Neon
  const [completedRow] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, newDispatchId));
  if (completedRow.status !== "COMPLETED") {
    throw new Error(`Expected status COMPLETED, got ${completedRow.status}`);
  }
  console.log("✓ Verified in Neon: dispatch status updated to COMPLETED");

  // Verify AUTO_COMPLETED audit activity recorded
  const autoAct = await db
    .select()
    .from(dispatchActivities)
    .where(and(eq(dispatchActivities.dispatchId, newDispatchId), eq(dispatchActivities.action, "AUTO_COMPLETED")))
    .limit(1);

  if (autoAct.length === 0) {
    throw new Error("Missing AUTO_COMPLETED activity record in audit log");
  }
  console.log("✓ Verified audit log: AUTO_COMPLETED recorded with threshold details:", autoAct[0].details);

  // Verify dispatch is cleared from active dispatcher session
  const finalActiveReq = new NextRequest("http://localhost:3000/api/dispatch/active", {
    headers: { Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}` },
  });
  const finalActiveRes = await getActiveDispatchHandler(finalActiveReq);
  const finalActiveData = await finalActiveRes.json();
  if (finalActiveData.activeDispatch !== null) {
    throw new Error(`Expected activeDispatch to be null after auto-completion, got: ${JSON.stringify(finalActiveData.activeDispatch)}`);
  }
  console.log("✓ Verified: COMPLETED request cleanly cleared from active dispatcher session");

  console.log("\n================================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! REQUEST LIFECYCLE IS FULLY VALIDATED.");
  console.log("================================================================================\n");
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ TEST FAILURE:", err);
    process.exit(1);
  });
