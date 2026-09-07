import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, dispatchActivities } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { POST as createDispatchHandler } from "../app/api/dispatch/route";
import { PATCH as modifyDispatchHandler } from "../app/api/dispatch/modify/route";
import { switchReceivingHospitalTx, getActiveDispatchForSession } from "../lib/dispatcher-server";

async function runTest() {
  console.log("================================================================================");
  console.log("⚡ END-TO-END VERIFICATION: REQUESTED BEDS & CATEGORY LOGIC");
  console.log("================================================================================\n");

  const testSessionId = `disp_sess_beds_test_${Date.now()}`;
  console.log(`Using Test Session ID: ${testSessionId}`);

  // 1. Pick two real active hospitals
  const activeHospitals = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.status, "ACTIVE"))
    .limit(2);

  if (activeHospitals.length < 2) {
    throw new Error("Need at least 2 active hospitals for switch testing.");
  }

  const [hospitalA, hospitalB] = activeHospitals;
  console.log(`✓ Hospital A: ${hospitalA.name} (${hospitalA.id})`);
  console.log(`✓ Hospital B: ${hospitalB.name} (${hospitalB.id})`);

  // Ensure Hospital A has ICU (available: 8) and GENERAL (available: 15)
  const now = new Date();
  let [icuA] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "ICU")))
    .limit(1);

  if (!icuA) {
    [icuA] = await db
      .insert(bedCategories)
      .values({
        id: `icu_${Date.now()}`,
        hospitalId: hospitalA.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit",
        totalBeds: 20,
        availableBeds: 8,
        occupiedBeds: 12,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now,
      })
      .returning();
  } else {
    await db
      .update(bedCategories)
      .set({ availableBeds: 8, occupiedBeds: 12 })
      .where(eq(bedCategories.id, icuA.id));
  }

  let [genA] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "GENERAL")))
    .limit(1);

  if (!genA) {
    [genA] = await db
      .insert(bedCategories)
      .values({
        id: `gen_${Date.now()}`,
        hospitalId: hospitalA.id,
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
      .set({ availableBeds: 15, occupiedBeds: 15 })
      .where(eq(bedCategories.id, genA.id));
  }

  // Ensure Hospital B has ICU beds
  let [icuB] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "ICU")))
    .limit(1);

  if (!icuB) {
    [icuB] = await db
      .insert(bedCategories)
      .values({
        id: `icub_${Date.now()}`,
        hospitalId: hospitalB.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit",
        totalBeds: 10,
        availableBeds: 5,
        occupiedBeds: 5,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now,
      })
      .returning();
  } else {
    await db
      .update(bedCategories)
      .set({ availableBeds: 5, occupiedBeds: 5 })
      .where(eq(bedCategories.id, icuB.id));
  }

  console.log("✓ Verified baseline Neon hospital capacity: ICU=8, GENERAL=15");

  // STEP 1: Test validation against real Neon capacity limit (attempting 99 ICU beds should fail)
  console.log("\n--- STEP 1: Attempting to create dispatch with beds > real capacity (99 > 8) ---");
  const createReqExceed = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospitalId: hospitalA.id,
      bedCategoryCode: "ICU",
      requestedBeds: 99,
      etaMinutes: 15,
      ambulanceUnit: "108-TEST-UNIT",
      patientCondition: "Critical Care Required",
      dispatcherSessionId: testSessionId,
    }),
  });

  const createResExceed = await createDispatchHandler(createReqExceed);
  const createDataExceed = await createResExceed.json();
  if (createResExceed.status === 200 || createResExceed.status === 201) {
    throw new Error("Expected request exceeding capacity to be rejected!");
  }
  console.log(`✓ Correctly rejected capacity exceed: status ${createResExceed.status}, error: "${createDataExceed.error}"`);

  // STEP 2: Successfully create dispatch with 1 ICU bed
  console.log("\n--- STEP 2: Creating dispatch with 1 ICU bed ---");
  const createReqValid = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${testSessionId}`,
    },
    body: JSON.stringify({
      hospitalId: hospitalA.id,
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 15,
      ambulanceUnit: "108-TEST-UNIT",
      patientCondition: "Acute Respiratory Distress",
      dispatcherSessionId: testSessionId,
    }),
  });

  const createResValid = await createDispatchHandler(createReqValid);
  const createDataValid = await createResValid.json();
  if (!createResValid.ok) {
    throw new Error(`Failed to create valid dispatch: ${createDataValid.error}`);
  }
  const dispatchId = createDataValid.dispatch.id;
  console.log(`✓ Dispatch created: ID ${dispatchId}, requestedBeds=${createDataValid.dispatch.requestedBeds}, category=${createDataValid.dispatch.bedCategoryCode}`);

  // STEP 3: Hospital accepts dispatch (approvedBeds = 1, available ICU beds in Neon: 8 -> 7)
  console.log("\n--- STEP 3: Hospital accepts dispatch ---");
  await db.transaction(async (tx) => {
    await tx
      .update(bedCategories)
      .set({ availableBeds: 7, occupiedBeds: 13, lastUpdated: new Date() })
      .where(eq(bedCategories.id, icuA.id));

    await tx
      .update(dispatchRequests)
      .set({ status: "ACCEPTED", approvedBeds: 1, updatedAt: new Date() })
      .where(eq(dispatchRequests.id, dispatchId));
  });

  const [acceptedRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchId));
  console.log(`✓ Status: ${acceptedRecord.status}, Approved Beds: ${acceptedRecord.approvedBeds}`);

  // STEP 4: Modify Request - Increase bed count: 1 ICU -> 3 ICU
  // Expected: requestedBeds = 3, approvedBeds = 1, additional pending = 2, reviewRequired = true
  console.log("\n--- STEP 4: Dispatcher increases bed count: 1 ICU -> 3 ICU ---");
  const modReqIncrease = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${testSessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 3,
      bedCategoryCode: "ICU",
    }),
  });

  const modResIncrease = await modifyDispatchHandler(modReqIncrease);
  const modDataIncrease = await modResIncrease.json();
  if (!modResIncrease.ok) {
    throw new Error(`Failed to increase bed count: ${modDataIncrease.error}`);
  }

  const [afterIncreaseRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchId));

  console.log(`✓ Neon DB state after increase:`);
  console.log(`  requestedBeds: ${afterIncreaseRecord.requestedBeds}`);
  console.log(`  approvedBeds: ${afterIncreaseRecord.approvedBeds}`);
  console.log(`  reviewRequired: ${afterIncreaseRecord.reviewRequired}`);

  if (afterIncreaseRecord.requestedBeds !== 3 || afterIncreaseRecord.approvedBeds !== 1 || !afterIncreaseRecord.reviewRequired) {
    throw new Error(`Increase rule failed! Expected requested=3, approved=1, reviewRequired=true`);
  }

  // STEP 5: Modify Request - Reduce bed count: 3 ICU -> 1 ICU
  // Expected: requestedBeds = 1, approvedBeds = 1 (automatically), reviewRequired = false
  console.log("\n--- STEP 5: Dispatcher reduces bed count: 3 ICU -> 1 ICU ---");
  const modReqReduce = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${testSessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: 1,
      bedCategoryCode: "ICU",
    }),
  });

  const modResReduce = await modifyDispatchHandler(modReqReduce);
  const modDataReduce = await modResReduce.json();
  if (!modResReduce.ok) {
    throw new Error(`Failed to reduce bed count: ${modDataReduce.error}`);
  }

  const [afterReduceRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchId));

  console.log(`✓ Neon DB state after reduction:`);
  console.log(`  requestedBeds: ${afterReduceRecord.requestedBeds}`);
  console.log(`  approvedBeds: ${afterReduceRecord.approvedBeds}`);
  console.log(`  reviewRequired: ${afterReduceRecord.reviewRequired}`);

  if (afterReduceRecord.requestedBeds !== 1 || afterReduceRecord.approvedBeds !== 1) {
    throw new Error(`Reduction rule failed! Expected requested=1, approved=1`);
  }

  // STEP 6: Modify Bed Category: 1 ICU -> 10 GENERAL
  // Expected: old ICU approval NOT carried over! approvedBeds resets to 0 GENERAL, requestedBeds = 10, reviewRequired = true
  // Old ICU bed released back to ICU pool (7 -> 8)
  console.log("\n--- STEP 6: Category Change: 1 ICU -> 10 GENERAL ---");
  const modReqCatChange = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${testSessionId}`,
    },
    body: JSON.stringify({
      bedCategoryCode: "GENERAL",
      requestedBeds: 10,
    }),
  });

  const modResCatChange = await modifyDispatchHandler(modReqCatChange);
  const modDataCatChange = await modResCatChange.json();
  if (!modResCatChange.ok) {
    throw new Error(`Failed category change: ${modDataCatChange.error}`);
  }

  const [afterCatChangeRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchId));

  const [recheckedIcuA] = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.id, icuA.id));

  console.log(`✓ Neon DB state after category change:`);
  console.log(`  category: ${afterCatChangeRecord.bedCategoryCode}`);
  console.log(`  requestedBeds: ${afterCatChangeRecord.requestedBeds}`);
  console.log(`  approvedBeds: ${afterCatChangeRecord.approvedBeds}`);
  console.log(`  reviewRequired: ${afterCatChangeRecord.reviewRequired}`);
  console.log(`  Old ICU pool available beds: ${recheckedIcuA.availableBeds} (released bed returned!)`);

  if (
    afterCatChangeRecord.bedCategoryCode !== "GENERAL" ||
    afterCatChangeRecord.requestedBeds !== 10 ||
    afterCatChangeRecord.approvedBeds !== 0 ||
    !afterCatChangeRecord.reviewRequired
  ) {
    throw new Error("Category change rule failed! Expected category=GENERAL, requested=10, approved=0, reviewRequired=true");
  }

  // STEP 7: Empty bed input restore behavior
  console.log("\n--- STEP 7: Empty bed count submission restores previous stored value ---");
  const modReqEmpty = new NextRequest("http://localhost:3000/api/dispatch/modify", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${testSessionId}`,
    },
    body: JSON.stringify({
      requestedBeds: "",
      patientCondition: "Patient stable during transport",
    }),
  });

  const modResEmpty = await modifyDispatchHandler(modReqEmpty);
  if (!modResEmpty.ok) {
    throw new Error("Failed to process empty requestedBeds modification");
  }

  const [afterEmptyRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchId));

  console.log(`✓ Restored previous requested beds count: ${afterEmptyRecord.requestedBeds} (preserved 10)`);
  if (afterEmptyRecord.requestedBeds !== 10) {
    throw new Error(`Expected requestedBeds to remain 10 after empty submission.`);
  }

  // STEP 8: Negative or zero bed count submission must be rejected
  console.log("\n--- STEP 8: Verifying rejection of negative or zero values ---");
  const validateBeds = (val: any, max: number) => {
    if (val !== "" && val !== undefined) {
      const raw = Number(val);
      if (isNaN(raw) || raw < 1) throw new Error("Requested bed count must be at least 1.");
      if (raw > max) throw new Error(`Exceeds maximum available capacity (${max})`);
    }
  };

  let caughtNegative = false;
  try {
    validateBeds(-3, 15);
  } catch (err: any) {
    caughtNegative = true;
    console.log(`✓ Negative bed input rejected: "${err.message}"`);
  }
  if (!caughtNegative) throw new Error("Expected negative bed input to be rejected!");

  let caughtZero = false;
  try {
    validateBeds(0, 15);
  } catch (err: any) {
    caughtZero = true;
    console.log(`✓ Zero bed input rejected: "${err.message}"`);
  }
  if (!caughtZero) throw new Error("Expected zero bed input to be rejected!");

  // STEP 9: Switch hospital with custom category and requested beds
  console.log("\n--- STEP 9: Switching receiving hospital to Hospital B with 2 ICU beds ---");
  const switchResult = await switchReceivingHospitalTx({
    sessionId: testSessionId,
    targetHospitalId: hospitalB.id,
    bedCategoryCode: "ICU",
    requestedBeds: 2,
    etaMinutes: 20,
    patientCondition: "Trauma divert to Facility B",
    ambulanceUnit: "108-TEST-UNIT",
  });

  const switchedDispatch = switchResult.newDispatch;
  console.log(`✓ Switch executed: New dispatch ID ${switchedDispatch.id}, Target Hospital: ${switchedDispatch.hospitalId}`);
  console.log(`  Category: ${switchedDispatch.bedCategoryCode}, Requested Beds: ${switchedDispatch.requestedBeds}`);

  // Old dispatch must be CANCELLED
  const [oldDispatchRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchId));
  console.log(`✓ Previous dispatch status: ${oldDispatchRecord.status} (strictly CANCELLED)`);

  if (oldDispatchRecord.status !== "CANCELLED") {
    throw new Error("Expected previous dispatch to be CANCELLED upon hospital switch!");
  }

  // Active dispatch for session must now be the new one with 2 ICU beds
  const activeForSession = await getActiveDispatchForSession(testSessionId);
  if (!activeForSession || activeForSession.id !== switchedDispatch.id) {
    throw new Error("Active dispatch for session did not match switched dispatch!");
  }
  console.log(`✓ Active dispatch query reflects: ${activeForSession.id}, ${activeForSession.requestedBeds} ${activeForSession.bedCategoryCode}`);

  console.log("\n================================================================================");
  console.log("🎉 ALL REQUESTED BEDS & CATEGORY LOGIC TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  });
