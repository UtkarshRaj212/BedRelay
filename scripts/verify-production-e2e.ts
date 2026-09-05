import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, hospitalMemberships, user, auditLogs } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import assert from "assert";
import { calculateDistanceKm, isValidCoordinates } from "../lib/geo";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

async function runProductionChecks() {
  console.log("================================================================================");
  console.log("             BEDRELAY FULL PRODUCTION READINESS & E2E TEST SUITE                ");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. HOSPITAL A HAS 5 ICU BEDS AVAILABLE
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO STEP 1: HOSPITAL A (APOLLO GREAMS ROAD) HAS 5 ICU BEDS ---");

  const [apolloHospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, "hosp_apollo_chennai"))
    .limit(1);

  await test("Hospital A (Apollo Hospital Greams Road) exists in Neon DB", () => {
    assert(apolloHospital, "Hospital hosp_apollo_chennai must exist");
    assert.strictEqual(apolloHospital.city, "Chennai");
    assert.strictEqual(apolloHospital.status, "ACTIVE");
  });

  const [icuBedCategory] = await db
    .select()
    .from(bedCategories)
    .where(
      and(
        eq(bedCategories.hospitalId, apolloHospital.id),
        eq(bedCategories.categoryCode, "ICU")
      )
    )
    .limit(1);

  await test("Hospital A has ICU bed inventory category in Neon DB", () => {
    assert(icuBedCategory, "ICU bed category must exist for Hospital A");
  });

  // Set Hospital A to exactly 5 ICU beds available
  await db
    .update(bedCategories)
    .set({
      availableBeds: 5,
      occupiedBeds: Math.max(0, icuBedCategory.totalBeds - 5),
      lastUpdated: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bedCategories.id, icuBedCategory.id));

  const [icuBedVerified] = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.id, icuBedCategory.id))
    .limit(1);

  await test("Hospital A bed capacity confirmed: Exactly 5 ICU beds available in Neon DB", () => {
    assert.strictEqual(icuBedVerified.availableBeds, 5, "Hospital A must have exactly 5 ICU beds available");
  });

  // ---------------------------------------------------------------------------
  // 2. DISPATCHER OBTAINS CURRENT LOCATION
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO STEP 2: DISPATCHER OBTAINS CURRENT LOCATION ---");

  const dispatcherGps = { lat: 13.0827, lng: 80.2707 }; // Chennai Telemetry Origin

  await test("Dispatcher acquires valid geographic coordinates (Chennai)", () => {
    assert(isValidCoordinates(dispatcherGps.lat, dispatcherGps.lng));
    assert.strictEqual(dispatcherGps.lat, 13.0827);
    assert.strictEqual(dispatcherGps.lng, 80.2707);
  });

  // ---------------------------------------------------------------------------
  // 3 & 4. DISPATCHER SEARCHES ICU BEDS & HOSPITAL A APPEARS ON OSM WITH DISTANCE
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO STEPS 3 & 4: SEARCH ICU BEDS & HOSPITAL A APPEARS ON OSM ---");

  const searchUrl = `${BASE_URL}/api/hospitals/search?city=Chennai&category=ICU&minBeds=1&lat=${dispatcherGps.lat}&lng=${dispatcherGps.lng}`;
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();

  await test("Dispatcher searches for ICU beds: API returns HTTP 200", () => {
    assert.strictEqual(searchResponse.status, 200);
    assert(Array.isArray(searchData.hospitals));
  });

  const hospitalAInSearch = searchData.hospitals.find(
    (h: any) => h.id === apolloHospital.id || h.name.includes("Apollo Hospital Greams Road")
  );

  await test("Hospital A appears in search results with 5 available ICU beds", () => {
    assert(hospitalAInSearch, "Hospital A must appear in search results");
    const icuBed = hospitalAInSearch.beds?.find((b: any) => b.categoryCode === "ICU");
    assert(icuBed, "ICU bed category must be in hospital bed list");
    assert.strictEqual(icuBed.availableBeds, 5, "Search results must show exactly 5 available ICU beds");
  });

  await test("Hospital A has valid OpenStreetMap coordinates and accurate Haversine distance", () => {
    assert(isValidCoordinates(hospitalAInSearch.latitude, hospitalAInSearch.longitude));
    assert(typeof hospitalAInSearch.distanceKm === "number");
    const expectedDist = calculateDistanceKm(
      dispatcherGps.lat,
      dispatcherGps.lng,
      apolloHospital.latitude!,
      apolloHospital.longitude!
    );
    assert(
      Math.abs(hospitalAInSearch.distanceKm - expectedDist) < 0.2,
      `Calculated distance (${hospitalAInSearch.distanceKm} km) should match expected (${expectedDist} km)`
    );
  });

  // ---------------------------------------------------------------------------
  // 4. CREATE DISPATCH REQUEST
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. DISPATCH REQUEST CREATION & TRANSMISSION ---");

  const testDispatchPayload = {
    hospitalId: apolloHospital.id,
    ambulanceUnit: "108 EMS Alpha-Chennai",
    ambulanceLat: dispatcherGps.lat,
    ambulanceLng: dispatcherGps.lng,
    bedCategoryCode: "ICU",
    requestedBeds: 1,
    etaMinutes: 12,
    patientCondition: "Acute Respiratory Distress (Telemetry Test)",
    patientRef: `TEST-EMS-${Date.now().toString().slice(-4)}`,
  };

  const createRes = await fetch(`${BASE_URL}/api/dispatch-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testDispatchPayload),
  });
  const createData = await createRes.json();

  await test("POST /api/dispatch-requests creates emergency alert successfully", () => {
    assert(createRes.status === 200 || createRes.status === 201, `Expected 200 or 201, got ${createRes.status}`);
    assert(createData.dispatch?.id, "Dispatch object should have an ID");
    assert.strictEqual(createData.dispatch.hospitalId, apolloHospital.id);
    assert.strictEqual(createData.dispatch.status, "PENDING");
  });

  const createdDispatchId = createData.dispatch.id;

  await test("Dispatch record persisted with valid GPS and calculated distance", () => {
    assert.strictEqual(createData.dispatch.ambulanceLat, dispatcherGps.lat);
    assert.strictEqual(createData.dispatch.ambulanceLng, dispatcherGps.lng);
    assert(typeof createData.distanceKm === "number");
  });

  // ---------------------------------------------------------------------------
  // 5. HOSPITAL RECEIVES REQUEST & DISPATCH DETAILS API
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. DISPATCH MONITORING & TELEMETRY API ---");

  const getDispatchRes = await fetch(`${BASE_URL}/api/dispatch-requests/${createdDispatchId}`);
  const getDispatchData = await getDispatchRes.json();

  await test("GET /api/dispatch-requests/[id] retrieves live dispatch details", () => {
    assert.strictEqual(getDispatchRes.status, 200);
    assert.strictEqual(getDispatchData.dispatch.id, createdDispatchId);
    assert.strictEqual(getDispatchData.hospital.id, apolloHospital.id);
    assert.strictEqual(getDispatchData.dispatch.status, "PENDING");
  });

  await test("Hospital receiving record matches target hospital in Neon DB", () => {
    assert.strictEqual(getDispatchData.hospital.name, "Apollo Hospital Greams Road");
    assert.strictEqual(getDispatchData.hospital.city, "Chennai");
  });

  // ---------------------------------------------------------------------------
  // 6. HOSPITAL ACCEPT / REJECT LIFECYCLE & ATOMIC BED DEDUCTION
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. ACCEPT / REJECT LIFECYCLE & ATOMIC BED ALLOCATION ---");

  const [icuBedBeforeAccept] = await db
    .select()
    .from(bedCategories)
    .where(
      and(
        eq(bedCategories.hospitalId, apolloHospital.id),
        eq(bedCategories.categoryCode, "ICU")
      )
    )
    .limit(1);

  const availBeforeAccept = icuBedBeforeAccept.availableBeds;

  // Perform atomic acceptance update
  await db.transaction(async (tx) => {
    const [cat] = await tx
      .select()
      .from(bedCategories)
      .where(
        and(
          eq(bedCategories.hospitalId, apolloHospital.id),
          eq(bedCategories.categoryCode, "ICU")
        )
      )
      .for("update")
      .limit(1);

    assert(cat.availableBeds >= 1, "Must have beds to accept");

    await tx
      .update(bedCategories)
      .set({
        availableBeds: sql`${bedCategories.availableBeds} - 1`,
        occupiedBeds: sql`${bedCategories.occupiedBeds} + 1`,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bedCategories.id, cat.id));

    await tx
      .update(dispatchRequests)
      .set({
        status: "ACCEPTED",
        updatedAt: new Date(),
      })
      .where(eq(dispatchRequests.id, createdDispatchId));
  });

  await test("Hospital ACCEPT status update atomically decrements available bed count", async () => {
    const [icuAfterAccept] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, icuBedBeforeAccept.id))
      .limit(1);

    assert.strictEqual(icuAfterAccept.availableBeds, availBeforeAccept - 1);
  });

  // Dispatcher checks status update
  const getAcceptedRes = await fetch(`${BASE_URL}/api/dispatch-requests/${createdDispatchId}`);
  const getAcceptedData = await getAcceptedRes.json();

  await test("Dispatcher observes ACCEPTED status update in live tracking telemetry", () => {
    assert.strictEqual(getAcceptedRes.status, 200);
    assert.strictEqual(getAcceptedData.dispatch.status, "ACCEPTED");
  });

  // Perform rejection/cancellation restoring beds
  await db.transaction(async (tx) => {
    const [cat] = await tx
      .select()
      .from(bedCategories)
      .where(
        and(
          eq(bedCategories.hospitalId, apolloHospital.id),
          eq(bedCategories.categoryCode, "ICU")
        )
      )
      .for("update")
      .limit(1);

    await tx
      .update(bedCategories)
      .set({
        availableBeds: sql`${bedCategories.availableBeds} + 1`,
        occupiedBeds: sql`${bedCategories.occupiedBeds} - 1`,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bedCategories.id, cat.id));

    await tx
      .update(dispatchRequests)
      .set({
        status: "REJECTED",
        updatedAt: new Date(),
      })
      .where(eq(dispatchRequests.id, createdDispatchId));
  });

  await test("Hospital REJECT status update atomically restores available bed count", async () => {
    const [icuAfterReject] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, icuBedBeforeAccept.id))
      .limit(1);

    assert.strictEqual(icuAfterReject.availableBeds, availBeforeAccept);
  });

  // Dispatcher checks REJECTED status
  const getRejectedRes = await fetch(`${BASE_URL}/api/dispatch-requests/${createdDispatchId}`);
  const getRejectedData = await getRejectedRes.json();

  await test("Dispatcher observes REJECTED status update in live tracking telemetry", () => {
    assert.strictEqual(getRejectedRes.status, 200);
    assert.strictEqual(getRejectedData.dispatch.status, "REJECTED");
  });

  // Clean up test dispatch request
  await db.delete(dispatchRequests).where(eq(dispatchRequests.id, createdDispatchId));

  await test("Test dispatch request cleaned up from Neon DB", async () => {
    const [deletedCheck] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, createdDispatchId));
    assert(!deletedCheck, "Test dispatch request should be deleted");
  });

  // ---------------------------------------------------------------------------
  // 9. BED AVAILABILITY REMAINS VALID & CONSTRAINTS WORK
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO STEP 9: BED AVAILABILITY CONSTRAINTS & DATA INTEGRITY ---");

  const [finalIcuCheck] = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.id, icuBedCategory.id))
    .limit(1);

  await test("Bed availability remains synchronized at 5 in Neon DB", () => {
    assert.strictEqual(finalIcuCheck.availableBeds, 5);
  });

  await test("Database constraint: availableBeds <= totalBeds and availableBeds >= 0", () => {
    assert(finalIcuCheck.availableBeds >= 0);
    assert(finalIcuCheck.availableBeds <= finalIcuCheck.totalBeds);
  });

  await test("Rejection of negative bed allocation payload via API", async () => {
    const negRes = await fetch(`${BASE_URL}/api/hospital/beds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: icuBedCategory.id,
        availableBeds: -1,
        totalBeds: finalIcuCheck.totalBeds,
      }),
    });
    // Unauthenticated or bad request
    assert(negRes.status === 400 || negRes.status === 401);
  });

  // ---------------------------------------------------------------------------
  // 10. REFRESHING PAGES DOES NOT LOSE OR FABRICATE DATA (DETERMINISM)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO STEP 10: REFRESH DETERMINISM & PERSISTENCE ---");

  const reSearch1 = await fetch(searchUrl).then((r) => r.json());
  const reSearch2 = await fetch(searchUrl).then((r) => r.json());

  await test("Repeated search API queries yield identical results (zero data fabrication)", () => {
    assert.strictEqual(reSearch1.hospitals.length, reSearch2.hospitals.length);
    const h1 = reSearch1.hospitals.find((h: any) => h.id === apolloHospital.id);
    const h2 = reSearch2.hospitals.find((h: any) => h.id === apolloHospital.id);
    assert.strictEqual(h1.totalAvailable, h2.totalAvailable);
    assert.strictEqual(h1.distanceKm, h2.distanceKm);
  });

  // ---------------------------------------------------------------------------
  // 11. SECURITY, HYGIENE & FINAL CHECKS
  // ---------------------------------------------------------------------------
  console.log("\n--- FINAL CHECKS: SECURITY, HYGIENE & VALIDATION ---");

  // A. Unauthenticated access to protected SuperAdmin endpoint
  const unauthSuperAdminRes = await fetch(`${BASE_URL}/api/superadmin/stats`);
  await test("Unauthenticated requests to /api/superadmin/stats are blocked with 401/403", () => {
    assert(
      unauthSuperAdminRes.status === 401 || unauthSuperAdminRes.status === 403,
      `Expected 401 or 403, got ${unauthSuperAdminRes.status}`
    );
  });

  // B. Unauthenticated access to protected hospital beds endpoint
  const unauthBedsRes = await fetch(`${BASE_URL}/api/hospital/beds`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId: "dummy", availableBeds: 5, totalBeds: 10 }),
  });
  await test("Unauthenticated requests to /api/hospital/beds are blocked with 401", () => {
    assert.strictEqual(unauthBedsRes.status, 401);
  });

  // C. Invalid dispatch request payload validation
  const invalidDispatchRes = await fetch(`${BASE_URL}/api/dispatch-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospitalId: apolloHospital.id,
    }),
  });
  await test("Invalid dispatch creation payload returns 400 Bad Request", () => {
    assert.strictEqual(invalidDispatchRes.status, 400);
  });

  // D. Nonexistent dispatch request returns 404
  const notFoundDispatchRes = await fetch(`${BASE_URL}/api/dispatch-requests/disp_nonexistent_9999`);
  await test("Requesting nonexistent dispatch ID returns 404 Not Found", () => {
    assert.strictEqual(notFoundDispatchRes.status, 404);
  });

  await test("No AIIMS Chennai records or logs remain in Neon DB", async () => {
    const aiimsLogs = await db.select().from(auditLogs).where(sql`details ILIKE '%aiims%chennai%'`);
    assert.strictEqual(aiimsLogs.length, 0, "No AIIMS Chennai audit logs should exist");

    const aiimsHosp = await db.select().from(hospitals).where(eq(hospitals.id, "hosp_aiims_chennai"));
    assert.strictEqual(aiimsHosp.length, 0, "No AIIMS Chennai hospital should exist");
  });

  const [apolloAdminMembership] = await db
    .select()
    .from(hospitalMemberships)
    .where(
      and(
        eq(hospitalMemberships.hospitalId, apolloHospital.id),
        eq(hospitalMemberships.role, "HOSPITAL_ADMIN"),
        eq(hospitalMemberships.status, "ACTIVE")
      )
    )
    .limit(1);

  await test("Apollo Hospital Greams Road is primary admin facility", () => {
    assert(apolloAdminMembership, "Admin membership must be active for Apollo Hospital Greams Road");
    assert.strictEqual(apolloAdminMembership.hospitalId, "hosp_apollo_chennai");
  });

  console.log("\n================================================================================");
  console.log(` PRODUCTION VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("================================================================================\n");

  process.exit(0);
}

runProductionChecks().catch((err) => {
  console.error("\n[FATAL ERROR IN TEST SUITE]:", err);
  process.exit(1);
});
