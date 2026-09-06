import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, user } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  resolveServerDispatcherSession,
  getActiveDispatchForSession,
  switchReceivingHospitalTx,
  cancelActiveDispatchTx,
} from "../lib/dispatcher-server";
import { NextRequest } from "next/server";
import { POST as createDispatchHandler } from "../app/api/dispatch/route";
import { GET as getActiveDispatchHandler } from "../app/api/dispatch/active/route";
import { POST as switchDispatchHandler } from "../app/api/dispatch/switch/route";
import { POST as cancelDispatchHandler } from "../app/api/dispatch/cancel/route";
import { POST as createLegacyDispatchHandler } from "../app/api/dispatch-requests/route";

async function runTest() {
  console.log("==========================================================");
  console.log("⚡ TESTING PERSISTENT ACTIVE DISPATCH WORKFLOW E2E");
  console.log("==========================================================\n");

  // 1. Locate two real test hospitals from Neon Postgres
  const allHospitals = await db.select().from(hospitals).limit(5);
  if (allHospitals.length < 2) {
    throw new Error("At least 2 hospitals needed for switch test in database.");
  }

  const hospitalA = allHospitals[0];
  const hospitalB = allHospitals[1];

  console.log(`✓ Hospital A (Initial Target): [${hospitalA.id}] ${hospitalA.name} (${hospitalA.city})`);
  console.log(`✓ Hospital B (Switch Target):  [${hospitalB.id}] ${hospitalB.name} (${hospitalB.city})`);

  // Ensure both hospitals have available ICU beds
  let [hospABeds] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "ICU")))
    .limit(1);

  if (!hospABeds || hospABeds.availableBeds < 2) {
    await db
      .update(bedCategories)
      .set({ availableBeds: 5, totalBeds: 10, occupiedBeds: 5 })
      .where(and(eq(bedCategories.hospitalId, hospitalA.id), eq(bedCategories.categoryCode, "ICU")));
  }

  let [hospBBeds] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "ICU")))
    .limit(1);

  if (!hospBBeds || hospBBeds.availableBeds < 2) {
    await db
      .update(bedCategories)
      .set({ availableBeds: 5, totalBeds: 10, occupiedBeds: 5 })
      .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "ICU")));
  }

  const testSessionCookie = `test_sess_${Date.now()}_abc123`;
  console.log(`\n1. Initialized Dispatcher Session Cookie: ${testSessionCookie}`);

  // Clean up any stale test dispatches for this session
  await db
    .delete(dispatchRequests)
    .where(eq(dispatchRequests.dispatcherSessionId, testSessionCookie));

  // 2. Dispatcher sends initial request to Hospital A
  console.log("\n2. Sending initial dispatch request to Hospital A via POST /api/dispatch...");
  const createReq = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
    body: JSON.stringify({
      hospitalId: hospitalA.id,
      ambulanceUnit: "108 EMS Alpha-Chennai",
      ambulanceId: "108 EMS Alpha-Chennai",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 12,
      patientCondition: "Severe Acute Respiratory Distress",
      patientRef: "PAT-TEST-01",
    }),
  });

  const createRes = await createDispatchHandler(createReq);
  const createData = await createRes.json();
  if (createRes.status !== 201 || !createData.success) {
    throw new Error(`Failed to create initial dispatch: ${JSON.stringify(createData)}`);
  }

  const dispatchAId = createData.dispatch.id;
  console.log(`  ✓ Created Request [${dispatchAId}] to ${hospitalA.name} (Status: ${createData.dispatch.status})`);

  // 3. Verify GET /api/dispatch/active returns Hospital A
  console.log("\n3. Verifying GET /api/dispatch/active...");
  const activeReq1 = new NextRequest("http://localhost:3000/api/dispatch/active", {
    method: "GET",
    headers: {
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
  });

  const activeRes1 = await getActiveDispatchHandler(activeReq1);
  const activeData1 = await activeRes1.json();
  if (!activeData1.activeDispatch || activeData1.activeDispatch.id !== dispatchAId) {
    throw new Error(`Expected active dispatch ${dispatchAId}, got: ${JSON.stringify(activeData1)}`);
  }
  console.log(`  ✓ Active dispatch verified: [${activeData1.activeDispatch.id}] ${activeData1.activeDispatch.hospitalName} - Status: ${activeData1.activeDispatch.status}`);

  // 4. Test enforcement: Attempt to send a second active request to Hospital B without switching
  console.log("\n4. Testing One-Active-Request constraint (attempting duplicate create via POST /api/dispatch)...");
  const dupReq = new NextRequest("http://localhost:3000/api/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
    body: JSON.stringify({
      hospitalId: hospitalB.id,
      ambulanceUnit: "108 EMS Alpha-Chennai",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 10,
      patientCondition: "Condition 2",
    }),
  });

  const dupRes = await createDispatchHandler(dupReq);
  const dupData = await dupRes.json();
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 Conflict when active dispatch exists, got status ${dupRes.status}: ${JSON.stringify(dupData)}`);
  }
  console.log(`  ✓ Blocked duplicate creation with 409 Conflict: "${dupData.error}"`);

  // 4b. Also test legacy endpoint POST /api/dispatch-requests to verify no bypass
  console.log("\n4b. Verifying legacy endpoint POST /api/dispatch-requests cannot bypass rule...");
  const legacyReq = new NextRequest("http://localhost:3000/api/dispatch-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
    body: JSON.stringify({
      hospitalId: hospitalB.id,
      ambulanceUnit: "108 EMS Alpha-Chennai",
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 10,
      patientCondition: "Condition 2",
    }),
  });

  const legacyRes = await createLegacyDispatchHandler(legacyReq);
  if (legacyRes.status !== 409) {
    throw new Error(`Expected 409 Conflict on legacy endpoint, got: ${legacyRes.status}`);
  }
  console.log("  ✓ Legacy endpoint /api/dispatch-requests strictly enforced 409 Conflict.");

  // 5. Switch Receiving Hospital to Hospital B via POST /api/dispatch/switch
  console.log("\n5. Executing atomic switch to Hospital B via POST /api/dispatch/switch...");
  const switchReq = new NextRequest("http://localhost:3000/api/dispatch/switch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
    body: JSON.stringify({
      targetHospitalId: hospitalB.id,
      bedCategoryCode: "ICU",
      requestedBeds: 1,
      etaMinutes: 14,
      patientCondition: "Emergency Transfer to ICU",
    }),
  });

  const switchRes = await switchDispatchHandler(switchReq);
  const switchData = await switchRes.json();
  if (!switchRes.ok || !switchData.success) {
    throw new Error(`Failed to switch hospital: ${JSON.stringify(switchData)}`);
  }

  const dispatchBId = switchData.dispatch.id;
  console.log(`  ✓ Switch successful! Cancelled prior: [${switchData.cancelledDispatchId}], Created new: [${dispatchBId}]`);

  // 6. Verify database records: Hospital A is CANCELLED, Hospital B is PENDING
  console.log("\n6. Verifying database records...");
  const [dbDispatchA] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchAId));

  const [dbDispatchB] = await db
    .select()
    .from(dispatchRequests)
    .where(eq(dispatchRequests.id, dispatchBId));

  if (dbDispatchA.status !== "CANCELLED") {
    throw new Error(`Expected dispatch A to be CANCELLED, got ${dbDispatchA.status}`);
  }
  if (dbDispatchB.status !== "PENDING") {
    throw new Error(`Expected dispatch B to be PENDING, got ${dbDispatchB.status}`);
  }
  console.log(`  ✓ Hospital A request [${dispatchAId}]: Status = ${dbDispatchA.status}`);
  console.log(`  ✓ Hospital B request [${dispatchBId}]: Status = ${dbDispatchB.status}`);

  // 7. Verify GET /api/dispatch/active now returns ONLY Hospital B
  console.log("\n7. Verifying GET /api/dispatch/active returns ONLY Hospital B...");
  const activeReq2 = new NextRequest("http://localhost:3000/api/dispatch/active", {
    method: "GET",
    headers: {
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
  });

  const activeRes2 = await getActiveDispatchHandler(activeReq2);
  const activeData2 = await activeRes2.json();
  if (activeData2.activeDispatch?.id !== dispatchBId) {
    throw new Error(`Expected active dispatch ${dispatchBId}, got: ${activeData2.activeDispatch?.id}`);
  }
  console.log(`  ✓ Active dispatch is now: [${activeData2.activeDispatch.id}] ${activeData2.activeDispatch.hospitalName}`);

  // 8. Hospital B accepts the inbound request
  console.log("\n8. Simulating Hospital B staff accepting the dispatch request...");
  // Update to ACCEPTED and reserve bed atomically
  const now = new Date();
  const [bedBBefore] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "ICU")));

  await db
    .update(dispatchRequests)
    .set({ status: "ACCEPTED", updatedAt: now })
    .where(eq(dispatchRequests.id, dispatchBId));

  await db
    .update(bedCategories)
    .set({
      availableBeds: bedBBefore.availableBeds - 1,
      occupiedBeds: bedBBefore.occupiedBeds + 1,
      lastUpdated: now,
    })
    .where(eq(bedCategories.id, bedBBefore.id));

  console.log(`  ✓ Hospital B accepted request. ICU available beds reserved: ${bedBBefore.availableBeds} -> ${bedBBefore.availableBeds - 1}`);

  // 9. Verify dispatcher active telemetry reflects ACCEPTED
  console.log("\n9. Verifying dispatcher active telemetry reflects ACCEPTED...");
  const activeReq3 = new NextRequest("http://localhost:3000/api/dispatch/active", {
    method: "GET",
    headers: {
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
  });

  const activeRes3 = await getActiveDispatchHandler(activeReq3);
  const activeData3 = await activeRes3.json();
  if (activeData3.activeDispatch?.status !== "ACCEPTED") {
    throw new Error(`Expected status ACCEPTED, got ${activeData3.activeDispatch?.status}`);
  }
  console.log(`  ✓ Active banner telemetry received status: ${activeData3.activeDispatch.status}`);

  // 10. Dispatcher cancels the ACCEPTED request via POST /api/dispatch/cancel
  console.log("\n10. Dispatcher cancels ACCEPTED request via POST /api/dispatch/cancel...");
  const cancelReq = new NextRequest("http://localhost:3000/api/dispatch/cancel", {
    method: "POST",
    headers: {
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
  });

  const cancelRes = await cancelDispatchHandler(cancelReq);
  const cancelData = await cancelRes.json();
  if (!cancelRes.ok || !cancelData.success) {
    throw new Error(`Failed to cancel accepted dispatch: ${JSON.stringify(cancelData)}`);
  }

  // 11. Verify bed capacity is released back to Hospital B
  const [bedBAfter] = await db
    .select()
    .from(bedCategories)
    .where(and(eq(bedCategories.hospitalId, hospitalB.id), eq(bedCategories.categoryCode, "ICU")));

  if (bedBAfter.availableBeds !== bedBBefore.availableBeds) {
    throw new Error(`Expected bed count to restore to ${bedBBefore.availableBeds}, got ${bedBAfter.availableBeds}`);
  }
  console.log(`  ✓ Reserved bed restored: Available ICU beds back to ${bedBAfter.availableBeds}`);

  // 12. Verify GET /api/dispatch/active is now null (terminal status)
  console.log("\n12. Verifying GET /api/dispatch/active is now null...");
  const activeReq4 = new NextRequest("http://localhost:3000/api/dispatch/active", {
    method: "GET",
    headers: {
      Cookie: `bedrelay_dispatcher_session_id=${testSessionCookie}`,
    },
  });

  const activeRes4 = await getActiveDispatchHandler(activeReq4);
  const activeData4 = await activeRes4.json();
  if (activeData4.activeDispatch !== null) {
    throw new Error(`Expected null active dispatch, got ${JSON.stringify(activeData4.activeDispatch)}`);
  }
  console.log("  ✓ Active dispatch is null. Banner automatically clears.");

  // Clean up test data
  await db
    .delete(dispatchRequests)
    .where(eq(dispatchRequests.dispatcherSessionId, testSessionCookie));

  console.log("\n==========================================================");
  console.log("🎉 ALL ACTIVE DISPATCH WORKFLOW TESTS PASSED PERFECTLY!");
  console.log("==========================================================");
}

runTest().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
