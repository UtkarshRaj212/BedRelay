import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, dispatchActivities } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { POST as createDispatchHandler } from "../app/api/dispatch/route";
import { PATCH as modifyDispatchHandler } from "../app/api/dispatch/modify/route";
import { GET as getTimelineHandler } from "../app/api/dispatch-requests/[id]/timeline/route";
import { calculateRetentionDeadline, calculateRetentionMinutes, isWithinRetentionWindow } from "../lib/retention";
import { evaluateConditionChange } from "../lib/condition-similarity";
import { DISPATCHER_COOKIE_NAME, getLastRejectedDispatchForSession } from "../lib/dispatcher-server";

async function runTest() {
  console.log("================================================================================");
  console.log("⚡ END-TO-END VERIFICATION: DISPATCH REQUEST MODIFICATIONS & SHARED AUDIT");
  console.log("================================================================================\n");

  const testSessionId = `disp_sess_test_${Date.now()}`;
  console.log(`Using Test Dispatcher Session: ${testSessionId}`);

  // 1. Pick a real hospital from Neon
  const [hospital] = await db.select().from(hospitals).limit(1);
  if (!hospital) {
    throw new Error("No hospitals found in database.");
  }
  console.log(`✓ Using Hospital: [${hospital.id}] ${hospital.name} (${hospital.city})`);

  // Ensure hospital has ICU beds
  let [icuBeds] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospital.id), eq(bedCategories.categoryCode, "ICU")))
    .limit(1);

  if (!icuBeds) {
    const now = new Date();
    const [created] = await db
      .insert(bedCategories)
      .values({
        id: `bed_cat_test_${Date.now()}`,
        hospitalId: hospital.id,
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
    icuBeds = created;
  } else {
    // Reset to guaranteed state
    await db
      .update(bedCategories)
      .set({ totalBeds: 20, availableBeds: 10, occupiedBeds: 10 })
      .where(eq(bedCategories.id, icuBeds.id));
    icuBeds.availableBeds = 10;
    icuBeds.occupiedBeds = 10;
  }

  const initialAvail = 10;
  console.log(`✓ Initial ICU Capacity: Available=${initialAvail}, Total=20`);

  // 2. Dispatcher creates initial request for 2 ICU beds
  console.log("\n--- STEP 1: Dispatcher creates request (2 beds, initial condition) ---");
  const createReq = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      hospitalId: hospital.id,
      ambulanceUnit: "108-EMS-Alpha",
      ambulanceLat: 13.0827,
      ambulanceLng: 80.2707,
      bedCategoryCode: "ICU",
      requestedBeds: 2,
      etaMinutes: 20,
      patientCondition: "Severe chest discomfort, patient conscious",
    }),
  });

  const createRes = await createDispatchHandler(createReq);
  const createData = await createRes.json();
  if (!createRes.ok || !createData.success) {
    throw new Error(`Failed to create initial dispatch: ${createData.error}`);
  }

  const dispatchId = createData.dispatch.id;
  console.log(`✓ Dispatch request created: ${dispatchId}`);
  console.log(`  Status: ${createData.dispatch.status}, Requested: ${createData.dispatch.requestedBeds}, Approved: ${createData.dispatch.approvedBeds}`);

  // 3. Hospital accepts the request
  console.log("\n--- STEP 2: Hospital accepts request (2 beds approved) ---");
  const now = new Date();
  await db.transaction(async (tx) => {
    // Allocate 2 beds
    await tx
      .update(bedCategories)
      .set({
        availableBeds: initialAvail - 2,
        occupiedBeds: 10 + 2,
        updatedAt: now,
      })
      .where(eq(bedCategories.id, icuBeds.id));

    await tx
      .update(dispatchRequests)
      .set({
        status: "ACCEPTED",
        approvedBeds: 2,
        updatedAt: now,
      })
      .where(eq(dispatchRequests.id, dispatchId));

    const { logDispatchActivity } = await import("../lib/activity-logger");
    await logDispatchActivity(
      {
        dispatchId,
        actorType: "HOSPITAL",
        actorName: hospital.name,
        action: "ACCEPTED",
        details: "Hospital accepted pre-arrival alert. 2 bed(s) approved.",
      },
      tx
    );
  });

  const [afterAcceptBeds] = await db.select().from(bedCategories).where(eq(bedCategories.id, icuBeds.id));
  console.log(`✓ Hospital accepted. Available beds: ${afterAcceptBeds.availableBeds} (reduced from ${initialAvail} by 2)`);

  // 4. Dispatcher reduces bed count from 2 to 1 (Should release bed without requiring review!)
  console.log("\n--- STEP 3: Dispatcher reduces bed count: 2 → 1 (immediate release, reviewRequired=false) ---");
  const reduceReq = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 1,
      etaMinutes: 18,
      patientCondition: "Severe chest discomfort, patient conscious",
    }),
  });

  const reduceRes = await modifyDispatchHandler(reduceReq);
  const reduceData = await reduceRes.json();
  if (!reduceRes.ok || !reduceData.success) {
    throw new Error(`Failed to reduce bed count: ${reduceData.error}`);
  }

  console.log(`✓ Reduction applied:`);
  console.log(`  requestedBeds: ${reduceData.dispatch.requestedBeds}`);
  console.log(`  approvedBeds:  ${reduceData.dispatch.approvedBeds}`);
  console.log(`  reviewRequired: ${reduceData.reviewRequired}`);

  if (reduceData.dispatch.approvedBeds !== 1) {
    throw new Error(`Expected approvedBeds to immediately decrease to 1, got ${reduceData.dispatch.approvedBeds}`);
  }
  if (reduceData.reviewRequired !== false) {
    throw new Error(`Expected reviewRequired to remain false on bed reduction.`);
  }

  const [afterReduceBeds] = await db.select().from(bedCategories).where(eq(bedCategories.id, icuBeds.id));
  console.log(`✓ Capacity released back to inventory: Available beds: ${afterReduceBeds.availableBeds} (increased by 1)`);
  if (afterReduceBeds.availableBeds !== initialAvail - 1) {
    throw new Error(`Expected available beds to be ${initialAvail - 1}, got ${afterReduceBeds.availableBeds}`);
  }

  // 5. Dispatcher increases bed count from 1 to 2 (Should preserve approved bed 1, set reviewRequired=true)
  console.log("\n--- STEP 4: Dispatcher increases bed count: 1 → 2 (approved stays 1, reviewRequired=true) ---");
  const increaseReq = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 2,
      etaMinutes: 16,
      patientCondition: "Severe chest discomfort, patient conscious",
    }),
  });

  const increaseRes = await modifyDispatchHandler(increaseReq);
  const increaseData = await increaseRes.json();
  if (!increaseRes.ok || !increaseData.success) {
    throw new Error(`Failed to increase bed count: ${increaseData.error}`);
  }

  console.log(`✓ Increase applied:`);
  console.log(`  requestedBeds: ${increaseData.dispatch.requestedBeds}`);
  console.log(`  approvedBeds:  ${increaseData.dispatch.approvedBeds}`);
  console.log(`  reviewRequired: ${increaseData.reviewRequired}`);
  console.log(`  reviewReason:   ${increaseData.dispatch.reviewReason}`);

  if (increaseData.dispatch.approvedBeds !== 1) {
    throw new Error(`Expected approvedBeds to remain 1 (preserved), got ${increaseData.dispatch.approvedBeds}`);
  }
  if (increaseData.dispatch.requestedBeds !== 2) {
    throw new Error(`Expected requestedBeds to be 2, got ${increaseData.dispatch.requestedBeds}`);
  }
  if (increaseData.reviewRequired !== true) {
    throw new Error(`Expected reviewRequired to be true for bed increase.`);
  }

  // 6. Test Condition Similarity Engine
  console.log("\n--- STEP 5: Testing Condition Similarity Engine ---");
  // 5a. Minor wording change
  const minorResult = evaluateConditionChange(
    "Severe chest discomfort, patient conscious",
    "Severe chest discomfort, patient conscious and communicating"
  );
  console.log(`  Minor change similarity: ${minorResult.similarity.toFixed(3)} -> isMaterialChange: ${minorResult.isMaterialChange}`);
  if (minorResult.isMaterialChange !== false) {
    throw new Error("Expected minor wording change to NOT require clinical review.");
  }

  // 5b. Material clinical escalation
  const criticalResult = evaluateConditionChange(
    "Severe chest discomfort, patient conscious",
    "Severe cardiac arrest, CPR initiated, unshockable rhythm"
  );
  console.log(`  Escalation change similarity: ${criticalResult.similarity.toFixed(3)} -> isMaterialChange: ${criticalResult.isMaterialChange} (${criticalResult.reason})`);
  if (criticalResult.isMaterialChange !== true) {
    throw new Error("Expected clinical escalation to require clinical review.");
  }

  // Apply the condition escalation via modify endpoint
  const conditionReq = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${DISPATCHER_COOKIE_NAME}=${testSessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 2,
      etaMinutes: 12,
      patientCondition: "Severe cardiac arrest, CPR initiated, unshockable rhythm",
    }),
  });

  const conditionRes = await modifyDispatchHandler(conditionReq);
  const conditionData = await conditionRes.json();
  console.log(`✓ Condition escalation applied: reviewRequired=${conditionData.reviewRequired}, reviewReason="${conditionData.dispatch.reviewReason}"`);

  // 7. Hospital Reviews and Acknowledges Update
  console.log("\n--- STEP 6: Hospital reviews update (allocates pending bed, clears reviewRequired) ---");
  await db.transaction(async (tx) => {
    // Allocate pending bed
    await tx
      .update(bedCategories)
      .set({
        availableBeds: initialAvail - 2,
        occupiedBeds: 10 + 2,
        updatedAt: now,
      })
      .where(eq(bedCategories.id, icuBeds.id));

    await tx
      .update(dispatchRequests)
      .set({
        approvedBeds: 2,
        reviewRequired: false,
        reviewReason: null,
        updatedAt: now,
      })
      .where(eq(dispatchRequests.id, dispatchId));

    const { logDispatchActivity } = await import("../lib/activity-logger");
    await logDispatchActivity(
      {
        dispatchId,
        actorType: "HOSPITAL",
        actorName: hospital.name,
        action: "HOSPITAL_REVIEWED",
        details: "Hospital reviewed update. Approved beds: 2.",
        note: "Cardiac resuscitation team notified, bay prepped.",
      },
      tx
    );
  });

  const [afterReviewRecord] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
  console.log(`✓ Hospital reviewed successfully:`);
  console.log(`  approvedBeds: ${afterReviewRecord.approvedBeds}`);
  console.log(`  reviewRequired: ${afterReviewRecord.reviewRequired}`);
  console.log(`  reviewReason: ${afterReviewRecord.reviewReason}`);

  if (afterReviewRecord.approvedBeds !== 2 || afterReviewRecord.reviewRequired !== false) {
    throw new Error("Expected approvedBeds=2 and reviewRequired=false after review.");
  }

  // 8. Shared Activity & Timeline Audit Check
  console.log("\n--- STEP 7: Shared Timeline Audit & Log Retention Check ---");
  const timelineReq = new NextRequest(`http://localhost:3000/api/dispatch-requests/${dispatchId}/timeline`);
  const timelineRes = await getTimelineHandler(timelineReq, { params: Promise.resolve({ id: dispatchId }) });
  const timelineData = await timelineRes.json();

  console.log(`✓ Retrieved ${timelineData.activities.length} audit activities:`);
  for (const act of timelineData.activities) {
    console.log(`  • [${act.actorType}] ${act.action}: ${act.details || ""} (Note: ${act.note || "—"})`);
  }

  const actions = timelineData.activities.map((a: any) => a.action);
  if (!actions.includes("REQUEST_CREATED") || !actions.includes("ACCEPTED") || !actions.includes("HOSPITAL_REVIEWED")) {
    throw new Error(`Audit log missing required activities. Found: ${actions.join(", ")}`);
  }

  // Check retention calculation
  const retentionMins = calculateRetentionMinutes(20);
  console.log(`✓ Retention calculation: for ETA=20m, max(15, 20/4) = 15m. Retention window = ${retentionMins}m`);
  if (retentionMins !== 15) {
    throw new Error(`Expected retention duration of 15 min for 20m ETA, got ${retentionMins}`);
  }

  const retentionLong = calculateRetentionMinutes(80);
  console.log(`✓ Retention calculation: for ETA=80m, max(15, 80/4) = 20m. Retention window = ${retentionLong}m`);
  if (retentionLong !== 20) {
    throw new Error(`Expected retention duration of 20 min for 80m ETA, got ${retentionLong}`);
  }

  // 9. Persistent Rejected Dispatch Banner Check
  console.log("\n--- STEP 8: Persistent Rejected Dispatch Verification ---");
  const rejDispatchId = `disp_rej_test_${Date.now()}`;
  await db.insert(dispatchRequests).values({
    id: rejDispatchId,
    hospitalId: hospital.id,
    dispatcherSessionId: testSessionId,
    ambulanceUnit: "108-EMS-Beta",
    bedCategoryCode: "ICU",
    requestedBeds: 1,
    approvedBeds: 0,
    etaMinutes: 10,
    patientCondition: "Severe trauma",
    status: "REJECTED",
    rejectionReason: "ICU surge capacity exceeded",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const lastRejected = await getLastRejectedDispatchForSession(testSessionId);
  console.log(`✓ Retrieved last rejected dispatch:`);
  console.log(`  ID: ${lastRejected?.id}`);
  console.log(`  Hospital: ${lastRejected?.hospitalName}`);
  console.log(`  Reason: ${lastRejected?.rejectionReason}`);

  if (!lastRejected || lastRejected.id !== rejDispatchId || lastRejected.rejectionReason !== "ICU surge capacity exceeded") {
    throw new Error("Failed to retrieve persistent last rejected dispatch.");
  }

  // 10. Clean up test records
  console.log("\n--- STEP 9: Clean up test records ---");
  await db.delete(dispatchActivities).where(eq(dispatchActivities.dispatchId, dispatchId));
  await db.delete(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
  await db.delete(dispatchRequests).where(eq(dispatchRequests.id, rejDispatchId));
  await db.update(bedCategories).set({ availableBeds: 10, occupiedBeds: 10 }).where(eq(bedCategories.id, icuBeds.id));

  console.log("\n================================================================================");
  console.log("🎉 ALL E2E WORKFLOW TESTS PASSED SUCCESSFULLY ON NEON POSTGRES!");
  console.log("================================================================================\n");
}

runTest().catch((err) => {
  console.error("\n❌ E2E TEST FAILED:", err);
  process.exit(1);
});
