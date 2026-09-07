import "dotenv/config";
import { db } from "../db";
import { dispatchRequests, dispatchActivities, bedCategories, hospitals } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { POST as createDispatchHandler } from "../app/api/dispatch/route";
import {
  switchReceivingHospitalTx,
  cancelActiveDispatchTx,
} from "../lib/dispatcher-server";

async function runTest() {
  console.log("================================================================================");
  console.log("⚡ END-TO-END VERIFICATION: SWITCH HOSPITAL & REQUEST FLOWS");
  console.log("================================================================================");

  const sessionId = `test_switch_session_${Date.now()}`;
  console.log("Dispatcher Session ID:", sessionId);

  // 1. Fetch two active hospitals for testing
  const allHospitals = await db.select().from(hospitals).where(eq(hospitals.status, "ACTIVE")).limit(5);
  if (allHospitals.length < 2) {
    throw new Error("Need at least 2 active hospitals to test switch flow");
  }

  const hospitalA = allHospitals[0];
  const hospitalB = allHospitals[1];
  console.log(`✓ Hospital A (Initial): ${hospitalA.name} (${hospitalA.id})`);
  console.log(`✓ Hospital B (Target):  ${hospitalB.name} (${hospitalB.id})`);

  // Ensure Hospital A has ICU beds
  let [aIcu] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "ICU")));

  if (!aIcu || aIcu.availableBeds < 2) {
    if (aIcu) {
      await db.update(bedCategories).set({ availableBeds: 5 }).where(eq(bedCategories.id, aIcu.id));
    } else {
      await db.insert(bedCategories).values({
        id: `bed_a_icu_${Date.now()}`,
        hospitalId: hospitalA.id,
        categoryCode: "ICU",
        name: "Intensive Care Unit",
        totalBeds: 10,
        availableBeds: 5,
        occupiedBeds: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date(),
      });
    }
  }

  // Ensure Hospital B has GENERAL category with at least 15 beds
  const [bGen] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "GENERAL")));

  if (!bGen || bGen.availableBeds < 15) {
    console.log(`Adjusting Hospital B GENERAL capacity to ensure test requirement (current: ${bGen?.availableBeds ?? 0})`);
    if (bGen) {
      await db
        .update(bedCategories)
        .set({ availableBeds: 25, totalBeds: Math.max(bGen.totalBeds, 30) })
        .where(eq(bedCategories.id, bGen.id));
    } else {
      await db.insert(bedCategories).values({
        id: `bed_test_${Date.now()}`,
        hospitalId: hospitalB.id,
        categoryCode: "GENERAL",
        name: "General Ward",
        totalBeds: 50,
        availableBeds: 30,
        occupiedBeds: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date(),
      });
    }
  }

  // 2. Step 1: Create initial dispatch to Hospital A: ICU, 1 bed
  console.log("\n--- Step 1: Create Initial Dispatch (Hospital A, ICU, 1 bed) ---");
  const initAmbulanceLat = 13.0827;
  const initAmbulanceLng = 80.2707;

  const createReq = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `bedrelay_dispatcher_session_id=${sessionId}`,
    },
    body: JSON.stringify({
      hospitalId: hospitalA.id,
      ambulanceUnit: "108 EMS-Alpha",
      ambulanceLat: initAmbulanceLat,
      ambulanceLng: initAmbulanceLng,
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 15,
      patientCondition: "Acute Chest Pain with ST Elevation",
      dispatcherSessionId: sessionId,
    }),
  });

  const createRes = await createDispatchHandler(createReq);
  const createData = await createRes.json();
  if (!createRes.ok || !createData.dispatch) {
    throw new Error(`Failed to create initial dispatch: ${JSON.stringify(createData)}`);
  }

  const initialDispatchId = createData.dispatch.id;
  console.log(`✓ Created initial request: ${initialDispatchId}`);
  console.log(`  Status: ${createData.dispatch.status} | Category: ${createData.dispatch.bedCategoryCode} | Beds: ${createData.dispatch.requestedBeds}`);
  console.log(`  Ambulance Coordinates at Request Time: Lat ${createData.dispatch.ambulanceLat}, Lng ${createData.dispatch.ambulanceLng}`);

  if (Number(createData.dispatch.ambulanceLat) !== initAmbulanceLat || Number(createData.dispatch.ambulanceLng) !== initAmbulanceLng) {
    throw new Error("Ambulance coordinates at request time were not correctly recorded");
  }

  // 3. Step 2: Perform Hospital Switch to Hospital B: GENERAL, 10 beds
  console.log("\n--- Step 2: Switch Receiving Hospital (Hospital B, GENERAL, 10 beds) ---");
  const switchResult = await switchReceivingHospitalTx({
    sessionId,
    targetHospitalId: hospitalB.id,
    bedCategoryCode: "GENERAL",
    requestedBeds: 10,
    etaMinutes: 20,
    patientCondition: "Patient Condition Stabilized - Transferred to General Ward",
    ambulanceUnit: "108 EMS-Alpha",
    ambulanceLat: initAmbulanceLat,
    ambulanceLng: initAmbulanceLng,
  });

  const newDispatchId = switchResult.newDispatch.id;
  console.log(`✓ Switch transaction executed successfully.`);
  console.log(`  Cancelled Dispatch ID: ${switchResult.cancelledDispatchId}`);
  console.log(`  New Dispatch ID:       ${newDispatchId}`);

  // 4. Step 3: Verify Neon database state for the old request
  console.log("\n--- Step 3: Verify Old Dispatch in Neon ---");
  const [oldRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, initialDispatchId));

  if (!oldRecord) throw new Error("Old dispatch record not found in database");
  console.log(`✓ Old Dispatch Status: ${oldRecord.status}`);
  if (oldRecord.status !== "CANCELLED") {
    throw new Error(`Expected old dispatch status to be CANCELLED, got ${oldRecord.status}`);
  }

  // 5. Step 4: Verify Neon database state for the new request
  console.log("\n--- Step 4: Verify New Dispatch in Neon ---");
  const [newRecord] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, newDispatchId));

  if (!newRecord) throw new Error("New dispatch record not found in database");
  console.log(`✓ New Dispatch Status:        ${newRecord.status}`);
  console.log(`✓ New Dispatch Category:      ${newRecord.bedCategoryCode}`);
  console.log(`✓ New Dispatch Beds:          Requested: ${newRecord.requestedBeds}, Approved: ${newRecord.approvedBeds}`);
  console.log(`✓ New Dispatch Hospital ID:   ${newRecord.hospitalId}`);
  console.log(`✓ Request-time Coordinates:   Lat ${newRecord.ambulanceLat}, Lng ${newRecord.ambulanceLng}`);

  if (newRecord.status !== "PENDING") {
    throw new Error(`Expected new dispatch status to be PENDING, got ${newRecord.status}`);
  }
  if (newRecord.bedCategoryCode !== "GENERAL") {
    throw new Error(`Expected new dispatch bedCategoryCode to be GENERAL, got ${newRecord.bedCategoryCode}`);
  }
  if (newRecord.requestedBeds !== 10) {
    throw new Error(`Expected new dispatch requestedBeds to be 10, got ${newRecord.requestedBeds}`);
  }
  if (newRecord.approvedBeds !== 0) {
    throw new Error(`Expected new dispatch approvedBeds to be 0 (clean approval state), got ${newRecord.approvedBeds}`);
  }
  if (newRecord.hospitalId !== hospitalB.id) {
    throw new Error(`Expected new dispatch hospitalId to be ${hospitalB.id}, got ${newRecord.hospitalId}`);
  }

  // 6. Step 5: Verify Audit Log entries for both dispatches
  console.log("\n--- Step 5: Verify Audit Log in Neon ---");
  const oldActivities = await db
    .select()
    .from(dispatchActivities)
    .where(eq(dispatchActivities.dispatchId, initialDispatchId))
    .orderBy(desc(dispatchActivities.timestamp));

  const switchActivity = oldActivities.find((a) => a.action === "HOSPITAL_SWITCHED");
  if (!switchActivity) {
    throw new Error("Missing HOSPITAL_SWITCHED audit log entry on old dispatch");
  }
  console.log(`✓ Found HOSPITAL_SWITCHED entry on old dispatch (${initialDispatchId}):`);
  console.log(`  Details: ${switchActivity.details}`);
  console.log(`  Old Value: ${switchActivity.oldValue} -> New Value: ${switchActivity.newValue}`);

  const newActivities = await db
    .select()
    .from(dispatchActivities)
    .where(eq(dispatchActivities.dispatchId, newDispatchId))
    .orderBy(desc(dispatchActivities.timestamp));

  const createdActivity = newActivities.find((a) => a.action === "REQUEST_CREATED");
  if (!createdActivity) {
    throw new Error("Missing REQUEST_CREATED audit log entry on new dispatch");
  }
  console.log(`✓ Found REQUEST_CREATED entry on new dispatch (${newDispatchId}):`);
  console.log(`  Details: ${createdActivity.details}`);
  console.log(`  New Value: ${createdActivity.newValue}`);

  // 7. Cleanup test session
  console.log("\n--- Step 6: Cleanup Test Data ---");
  await cancelActiveDispatchTx(sessionId);
  console.log(`✓ Test dispatch ${newDispatchId} successfully cancelled.`);

  console.log("\n================================================================================");
  console.log("🎉 ALL END-TO-END SWITCH HOSPITAL & AUDIT CHECKS PASSED!");
  console.log("================================================================================");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
