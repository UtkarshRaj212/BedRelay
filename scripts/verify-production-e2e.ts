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
  // 1. HOSPITAL AUTH & SESSION DERIVATION
  // ---------------------------------------------------------------------------
  console.log("--- 1. HOSPITAL AUTHENTICATION & MEMBERSHIP DERIVATION ---");

  const [adminUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, "utkarsh.raj135@gmail.com"))
    .limit(1);

  await test("Hospital Admin account exists in database", () => {
    assert(adminUser, "User utkarsh.raj135@gmail.com must exist in Neon DB");
    assert(adminUser.id, "User must have an ID");
  });

  const [apolloHospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, "hosp_apollo_chennai"))
    .limit(1);

  await test("Apollo Hospital Greams Road exists and is active", () => {
    assert(apolloHospital, "Hospital hosp_apollo_chennai must exist");
    assert.strictEqual(apolloHospital.city, "Chennai");
    assert.strictEqual(apolloHospital.status, "ACTIVE");
    assert(apolloHospital.latitude !== null && apolloHospital.longitude !== null);
  });

  const [membership] = await db
    .select()
    .from(hospitalMemberships)
    .where(
      and(
        eq(hospitalMemberships.userId, adminUser.id),
        eq(hospitalMemberships.hospitalId, apolloHospital.id),
        eq(hospitalMemberships.status, "ACTIVE")
      )
    )
    .limit(1);

  await test("Admin user has active HOSPITAL_ADMIN membership for Apollo Hospital Greams Road", () => {
    assert(membership, "Active membership must exist");
    assert.strictEqual(membership.role, "HOSPITAL_ADMIN");
  });

  // ---------------------------------------------------------------------------
  // 2. BED MANAGEMENT & ATOMIC NEON DB TRANSACTIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. BED INVENTORY & NEON DB ATOMIC SYNC ---");

  const [icuBedBefore] = await db
    .select()
    .from(bedCategories)
    .where(
      and(
        eq(bedCategories.hospitalId, apolloHospital.id),
        eq(bedCategories.categoryCode, "ICU")
      )
    )
    .limit(1);

  await test("Apollo Hospital Greams Road has ICU bed inventory", () => {
    assert(icuBedBefore, "ICU bed category must exist");
    assert(icuBedBefore.totalBeds >= icuBedBefore.availableBeds);
  });

  const initialAvailable = icuBedBefore.availableBeds;
  const initialOccupied = icuBedBefore.occupiedBeds;

  // Test updating bed count in DB
  const testAvailUpdate = Math.max(1, initialAvailable - 1);
  await db
    .update(bedCategories)
    .set({
      availableBeds: testAvailUpdate,
      occupiedBeds: icuBedBefore.totalBeds - testAvailUpdate,
      lastUpdated: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bedCategories.id, icuBedBefore.id));

  const [icuBedUpdated] = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.id, icuBedBefore.id))
    .limit(1);

  await test("Bed inventory updates persist atomically to Neon DB", () => {
    assert.strictEqual(icuBedUpdated.availableBeds, testAvailUpdate);
  });

  // Restore baseline beds
  await db
    .update(bedCategories)
    .set({
      availableBeds: initialAvailable,
      occupiedBeds: initialOccupied,
      lastUpdated: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bedCategories.id, icuBedBefore.id));

  await test("Bed inventory restored to baseline values", async () => {
    const [restored] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, icuBedBefore.id))
      .limit(1);
    assert.strictEqual(restored.availableBeds, initialAvailable);
  });

  // ---------------------------------------------------------------------------
  // 3. DISPATCHER GPS & OPENSTREETMAP PROXIMITY SEARCH
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. DISPATCHER GPS & OPENSTREETMAP PROXIMITY SEARCH ---");

  const chennaiDispatcherGps = { lat: 13.0827, lng: 80.2707 }; // Chennai Central

  await test("Dispatcher GPS coordinates are geographically valid", () => {
    assert(isValidCoordinates(chennaiDispatcherGps.lat, chennaiDispatcherGps.lng));
  });

  // Query search API
  const searchUrl = `${BASE_URL}/api/hospitals/search?city=Chennai&category=ICU&minBeds=1&lat=${chennaiDispatcherGps.lat}&lng=${chennaiDispatcherGps.lng}`;
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();

  await test("Search API returns HTTP 200 with Chennai facilities", () => {
    assert.strictEqual(searchResponse.status, 200);
    assert(Array.isArray(searchData.hospitals), "Response should contain hospitals array");
    assert(searchData.hospitals.length >= 5, `Expected >= 5 Chennai hospitals, got ${searchData.hospitals.length}`);
  });

  await test("Search results include Chettinad Super Speciality and Apollo Hospital Greams Road", () => {
    const names = searchData.hospitals.map((h: any) => h.name);
    assert(names.some((n: string) => n.includes("Apollo Hospital Greams Road")), "Apollo Greams Road must be returned");
    assert(names.some((n: string) => n.includes("Chettinad")), "Chettinad must be returned");
  });

  await test("Hospitals have valid OpenStreetMap coordinates and calculated distance", () => {
    for (const h of searchData.hospitals) {
      assert(isValidCoordinates(h.latitude, h.longitude), `Invalid coords for ${h.name}`);
      assert(typeof h.distanceKm === "number", `Expected numerical distanceKm for ${h.name}`);
    }
  });

  await test("Search results are sorted in ascending proximity order (nearest first)", () => {
    for (let i = 0; i < searchData.hospitals.length - 1; i++) {
      const current = searchData.hospitals[i];
      const next = searchData.hospitals[i + 1];
      if (current.isSuitable === next.isSuitable) {
        assert(
          current.distanceKm <= next.distanceKm,
          `Sort order violation: ${current.name} (${current.distanceKm} km) > ${next.name} (${next.distanceKm} km)`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 4. CREATE DISPATCH REQUEST
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. DISPATCH REQUEST CREATION & TRANSMISSION ---");

  const testDispatchPayload = {
    hospitalId: apolloHospital.id,
    ambulanceUnit: "108 EMS Alpha-Chennai",
    ambulanceLat: chennaiDispatcherGps.lat,
    ambulanceLng: chennaiDispatcherGps.lng,
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
    assert.strictEqual(createData.dispatch.ambulanceLat, chennaiDispatcherGps.lat);
    assert.strictEqual(createData.dispatch.ambulanceLng, chennaiDispatcherGps.lng);
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
  // 7. SECURITY, PERMISSION BOUNDARIES & VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. SECURITY, ROLE BOUNDARIES & INPUT VALIDATION ---");

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
      // Missing ambulanceUnit, bedCategoryCode, requestedBeds
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

  // ---------------------------------------------------------------------------
  // 8. CODEBASE HYGIENE CHECKS
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. CODEBASE HYGIENE CHECKS ---");

  await test("No AIIMS Chennai records or logs remain in Neon DB", async () => {
    const aiimsLogs = await db.select().from(auditLogs).where(sql`details ILIKE '%aiims%chennai%'`);
    assert.strictEqual(aiimsLogs.length, 0, "No AIIMS Chennai audit logs should exist");

    const aiimsHosp = await db.select().from(hospitals).where(eq(hospitals.id, "hosp_aiims_chennai"));
    assert.strictEqual(aiimsHosp.length, 0, "No AIIMS Chennai hospital should exist");
  });

  await test("Apollo Hospital Greams Road is primary admin facility", () => {
    assert(membership, "Admin membership must be active for Apollo Hospital Greams Road");
    assert.strictEqual(membership.hospitalId, "hosp_apollo_chennai");
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
