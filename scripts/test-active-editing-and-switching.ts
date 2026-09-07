import "dotenv/config";
import { db } from "../db";
import { dispatchRequests, dispatchActivities, bedCategories, hospitals } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { POST as createDispatchHandler } from "../app/api/dispatch/route";
import { PATCH as modifyDispatchHandler } from "../app/api/dispatch/modify/route";
import { switchReceivingHospitalTx, cancelActiveDispatchTx } from "../lib/dispatcher-server";

async function runTestMatrix() {
  console.log("================================================================================");
  console.log("⚡ TEST MATRIX: ACTIVE REQUEST EDITING & HOSPITAL SWITCHING");
  console.log("================================================================================");

  const sessionId = `test_matrix_${Date.now()}`;
  console.log("Dispatcher Session ID:", sessionId);

  // 1. Fetch hospitals for test
  const activeHospitals = await db.select().from(hospitals).where(eq(hospitals.status, "ACTIVE")).limit(5);
  if (activeHospitals.length < 2) {
    throw new Error("Need at least 2 active hospitals to test flow");
  }
  const hospA = activeHospitals[0];
  const hospB = activeHospitals[1];
  console.log(`Hospital A: ${hospA.name} (${hospA.id})`);
  console.log(`Hospital B: ${hospB.name} (${hospB.id})`);

  // Ensure hospA has ICU and GENERAL beds
  let [aIcu] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospA.id), eq(bedCategories.categoryCode, "ICU")));
  if (!aIcu || aIcu.availableBeds < 15) {
    if (aIcu) {
      await db.update(bedCategories).set({ availableBeds: 20, totalBeds: 30, occupiedBeds: 10 }).where(eq(bedCategories.id, aIcu.id));
    } else {
      await db.insert(bedCategories).values({
        id: `bed_a_icu_${Date.now()}`,
        hospitalId: hospA.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit",
        totalBeds: 30,
        availableBeds: 20,
        occupiedBeds: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date(),
      });
    }
  }

  let [aGen] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospA.id), eq(bedCategories.categoryCode, "GENERAL")));
  if (!aGen || aGen.availableBeds < 20) {
    if (aGen) {
      await db.update(bedCategories).set({ availableBeds: 25, totalBeds: 40, occupiedBeds: 15 }).where(eq(bedCategories.id, aGen.id));
    } else {
      await db.insert(bedCategories).values({
        id: `bed_a_gen_${Date.now()}`,
        hospitalId: hospA.id,
        categoryCode: "GENERAL",
        name: "General Medical Ward",
        totalBeds: 40,
        availableBeds: 25,
        occupiedBeds: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date(),
      });
    }
  }

  // Ensure hospB has GENERAL beds
  let [bGen] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospB.id), eq(bedCategories.categoryCode, "GENERAL")));
  if (!bGen || bGen.availableBeds < 20) {
    if (bGen) {
      await db.update(bedCategories).set({ availableBeds: 25, totalBeds: 50, occupiedBeds: 25 }).where(eq(bedCategories.id, bGen.id));
    } else {
      await db.insert(bedCategories).values({
        id: `bed_b_gen_${Date.now()}`,
        hospitalId: hospB.id,
        categoryCode: "GENERAL",
        name: "General Medical Ward",
        totalBeds: 50,
        availableBeds: 25,
        occupiedBeds: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date(),
      });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: PENDING Request - Editable category, beds, eta, condition
  // --------------------------------------------------------------------------
  console.log("\n>>> TEST 1: PENDING Request Field Modification");
  const createReq = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${sessionId}`,
    },
    body: JSON.stringify({
      hospitalId: hospA.id,
      ambulanceUnit: "Unit-101",
      ambulanceLat: 13.0827,
      ambulanceLng: 80.2707,
      bedCategoryCode: "ICU",
      requestedBeds: 2,
      etaMinutes: 15,
      patientCondition: "Severe Sepsis",
      dispatcherSessionId: sessionId,
    }),
  });

  const createRes = await createDispatchHandler(createReq);
  const createData = await createRes.json();
  const dispatchId = createData.dispatch.id;
  console.log(`✓ Created PENDING dispatch ${dispatchId}: 2 ICU beds, ETA 15, condition 'Severe Sepsis'`);

  // Modify PENDING dispatch: change to 5 ICU beds, ETA 25, condition updated
  console.log("Modifying PENDING dispatch: requested beds 2 -> 5, ETA 15 -> 25...");
  const modReq1 = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${sessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 5,
      bedCategoryCode: "ICU",
      etaMinutes: 25,
      patientCondition: "Severe Sepsis with Hypotension",
    }),
  });

  const modRes1 = await modifyDispatchHandler(modReq1);
  const modData1 = await modRes1.json();
  if (!modRes1.ok) throw new Error(`Modify PENDING failed: ${JSON.stringify(modData1)}`);

  console.log(`✓ Modified PENDING dispatch: requested=${modData1.dispatch.requestedBeds}, eta=${modData1.dispatch.etaMinutes}, condition='${modData1.dispatch.patientCondition}'`);
  if (modData1.dispatch.requestedBeds !== 5 || modData1.dispatch.etaMinutes !== 25) {
    throw new Error("PENDING modification values did not update correctly");
  }

  // --------------------------------------------------------------------------
  // TEST 2: ACCEPTED Request - Bed count increase (2 approved -> 7 requested)
  // --------------------------------------------------------------------------
  console.log("\n>>> TEST 2: ACCEPTED Request - Bed count increase (approved = 2, requested -> 7)");
  // Mark request as ACCEPTED with approvedBeds = 2
  await db
    .update(dispatchRequests)
    .set({
      status: "ACCEPTED",
      approvedBeds: 2,
      requestedBeds: 2,
      reviewRequired: false,
      updatedAt: new Date(),
    })
    .where(eq(dispatchRequests.id, dispatchId));

  // Dispatcher modifies requested beds from 2 to 7
  const modReq2 = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${sessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 7,
      bedCategoryCode: "ICU",
      etaMinutes: 25,
    }),
  });

  const modRes2 = await modifyDispatchHandler(modReq2);
  const modData2 = await modRes2.json();
  if (!modRes2.ok) throw new Error(`Modify ACCEPTED increase failed: ${JSON.stringify(modData2)}`);

  console.log(`✓ Result of increasing beds on ACCEPTED request:`);
  console.log(`  Requested Beds: ${modData2.dispatch.requestedBeds} (expected: 7)`);
  console.log(`  Approved Beds:  ${modData2.dispatch.approvedBeds} (expected: 2)`);
  console.log(`  Pending Review: ${modData2.dispatch.requestedBeds - modData2.dispatch.approvedBeds} (expected: 5)`);
  console.log(`  Review Required: ${modData2.dispatch.reviewRequired} (expected: true)`);

  if (modData2.dispatch.requestedBeds !== 7 || modData2.dispatch.approvedBeds !== 2 || !modData2.dispatch.reviewRequired) {
    throw new Error("Bed count increase on ACCEPTED request invariant violated!");
  }

  // --------------------------------------------------------------------------
  // TEST 3: ACCEPTED Request - Bed count reduction below approved (approved = 5 -> requested = 3)
  // --------------------------------------------------------------------------
  console.log("\n>>> TEST 3: ACCEPTED Request - Bed count reduction below approved count");
  // Set approved = 5
  await db
    .update(dispatchRequests)
    .set({
      approvedBeds: 5,
      requestedBeds: 7,
      reviewRequired: false,
      updatedAt: new Date(),
    })
    .where(eq(dispatchRequests.id, dispatchId));

  // Dispatcher reduces requested beds to 3
  const modReq3 = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${sessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 3,
      bedCategoryCode: "ICU",
      etaMinutes: 25,
    }),
  });

  const modRes3 = await modifyDispatchHandler(modReq3);
  const modData3 = await modRes3.json();
  if (!modRes3.ok) throw new Error(`Modify reduction failed: ${JSON.stringify(modData3)}`);

  console.log(`✓ Result of reducing beds on ACCEPTED request:`);
  console.log(`  Requested Beds: ${modData3.dispatch.requestedBeds} (expected: 3)`);
  console.log(`  Approved Beds:  ${modData3.dispatch.approvedBeds} (expected: 3, automatically reduced!)`);
  console.log(`  Pending Review: ${modData3.dispatch.requestedBeds - modData3.dispatch.approvedBeds} (expected: 0)`);
  console.log(`  Review Required: ${modData3.dispatch.reviewRequired} (expected: false)`);

  if (modData3.dispatch.requestedBeds !== 3 || modData3.dispatch.approvedBeds !== 3 || modData3.dispatch.reviewRequired !== false) {
    throw new Error("Bed count reduction invariant violated (Approved must automatically reduce to <= Requested)!");
  }

  // --------------------------------------------------------------------------
  // TEST 4: ACCEPTED Request - Category change (3 ICU approved -> 10 GENERAL)
  // --------------------------------------------------------------------------
  console.log("\n>>> TEST 4: ACCEPTED Request - Bed Category Change (ICU -> GENERAL)");
  const modReq4 = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${sessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 10,
      bedCategoryCode: "GENERAL",
      etaMinutes: 30,
    }),
  });

  const modRes4 = await modifyDispatchHandler(modReq4);
  const modData4 = await modRes4.json();
  if (!modRes4.ok) throw new Error(`Modify category change failed: ${JSON.stringify(modData4)}`);

  console.log(`✓ Result of category change on ACCEPTED request:`);
  console.log(`  Category:       ${modData4.dispatch.bedCategoryCode} (expected: GENERAL)`);
  console.log(`  Requested Beds: ${modData4.dispatch.requestedBeds} (expected: 10)`);
  console.log(`  Approved Beds:  ${modData4.dispatch.approvedBeds} (expected: 0 - ICU approval MUST NOT carry into General)`);
  console.log(`  Review Required: ${modData4.dispatch.reviewRequired} (expected: true)`);

  if (
    modData4.dispatch.bedCategoryCode !== "GENERAL" ||
    modData4.dispatch.requestedBeds !== 10 ||
    modData4.dispatch.approvedBeds !== 0 ||
    !modData4.dispatch.reviewRequired
  ) {
    throw new Error("Category change invariant violated!");
  }

  // --------------------------------------------------------------------------
  // TEST 5: Top-Banner Hospital Switch to Hospital B with new category and beds
  // --------------------------------------------------------------------------
  console.log("\n>>> TEST 5: Hospital Switch (Switch to Hospital B: GENERAL, 10 beds)");
  const switchRes = await switchReceivingHospitalTx({
    sessionId,
    targetHospitalId: hospB.id,
    bedCategoryCode: "GENERAL",
    requestedBeds: 10,
    etaMinutes: 20,
    patientCondition: "Patient Condition Stabilized - Switching Hospital",
  });

  console.log(`✓ Switch successfully executed:`);
  console.log(`  Old Cancelled Request ID: ${switchRes.cancelledDispatchId}`);
  console.log(`  New Active Request ID:    ${switchRes.newDispatch.id}`);

  const [oldInDb] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, switchRes.cancelledDispatchId));
  const [newInDb] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, switchRes.newDispatch.id));

  console.log(`✓ Database verification:`);
  console.log(`  Old Request Status: ${oldInDb.status} (expected: CANCELLED)`);
  console.log(`  New Request Status: ${newInDb.status} (expected: PENDING)`);
  console.log(`  New Hospital ID:    ${newInDb.hospitalId} (expected: ${hospB.id})`);
  console.log(`  New Category:       ${newInDb.bedCategoryCode} (expected: GENERAL)`);
  console.log(`  New Beds:           ${newInDb.requestedBeds} requested, ${newInDb.approvedBeds} approved`);

  if (oldInDb.status !== "CANCELLED" || newInDb.status !== "PENDING" || newInDb.hospitalId !== hospB.id || newInDb.requestedBeds !== 10 || newInDb.approvedBeds !== 0) {
    throw new Error("Hospital switch database verification failed!");
  }

  // --------------------------------------------------------------------------
  // TEST 6: Audit Log Integrity Verification
  // --------------------------------------------------------------------------
  console.log("\n>>> TEST 6: Verify Audit Logs");
  const activities = await db
    .select()
    .from(dispatchActivities)
    .where(eq(dispatchActivities.dispatchId, dispatchId))
    .orderBy(desc(dispatchActivities.timestamp));

  const actions = activities.map((a) => a.action);
  console.log(`✓ Recorded activity actions on request ${dispatchId}:`, actions);
  if (!actions.includes("CATEGORY_CHANGED") || !actions.includes("BEDS_REDUCED") || !actions.includes("BEDS_INCREASED") || !actions.includes("HOSPITAL_SWITCHED")) {
    throw new Error("Audit log missing required action events!");
  }

  // Cleanup
  console.log("\n>>> Cleanup test session");
  await cancelActiveDispatchTx(sessionId);
  console.log(`✓ Session cleaned up.`);

  console.log("\n================================================================================");
  console.log("🎉 ALL TEST MATRIX SCENARIOS SUCCESSFULLY VERIFIED!");
  console.log("================================================================================");
}

runTestMatrix().catch((err) => {
  console.error("\n❌ TEST MATRIX FAILED:", err);
  process.exit(1);
});
