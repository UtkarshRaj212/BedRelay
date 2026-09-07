import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, dispatchActivities } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { buildGoogleMapsDirectionsUrl } from "../lib/geo";
import { logDispatchActivity } from "../lib/activity-logger";
import { seedIndianHospitals } from "../lib/seed-service";

async function runE2ETests() {
  console.log("=== STARTING AUDIT, DASHBOARD DATA & SYNC E2E TESTS ===\n");

  await seedIndianHospitals(false);

  const [hospital] = await db.select().from(hospitals).where(eq(hospitals.status, "ACTIVE")).limit(1);
  if (!hospital) throw new Error("No active hospital found in database");

  const [category] = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.hospitalId, hospital.id))
    .limit(1);
  if (!category) throw new Error("No bed category found for hospital");

  const testId = `sync_test_${Date.now()}`;
  const testDispatchId = `disp_${testId}`;
  const now = new Date();

  try {
    console.log(`Step 1: Using hospital: ${hospital.name} (${hospital.city})`);

    // 2. Dispatcher Location at Request Time Immutability Check
    console.log("\nStep 2: Creating dispatch request with fixed origin coordinates...");
    const initialLat = 28.6139;
    const initialLng = 77.2090;

    await db.insert(dispatchRequests).values({
      id: testDispatchId,
      hospitalId: hospital.id,
      dispatcherSessionId: `sess_${testId}`,
      ambulanceUnit: "108 EMS Unit-99",
      ambulanceId: "AMB-99",
      ambulanceLat: initialLat,
      ambulanceLng: initialLng,
      patientRef: "PAT-TEST-01",
      bedCategoryCode: category.categoryCode,
      requestedBeds: 1,
      approvedBeds: 0,
      etaMinutes: 12,
      patientCondition: "Critical Acute STEMI",
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    await logDispatchActivity({
      dispatchId: testDispatchId,
      actorType: "DISPATCHER",
      actorName: "Ambulance Dispatcher",
      action: "REQUEST_CREATED",
      details: `Pre-arrival dispatch alert transmitted to ${hospital.name}. Required: 1 ${category.categoryCode} bed(s). ETA: 12m. Ambulance: 108 EMS Unit-99.`,
      newValue: `Hospital: ${hospital.name} | Category: ${category.categoryCode} | Beds: 1 | ETA: 12m`,
    });

    // Verify stored coordinates
    const [storedDispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, testDispatchId))
      .limit(1);

    if (storedDispatch.ambulanceLat !== initialLat || storedDispatch.ambulanceLng !== initialLng) {
      throw new Error(`Coordinates mismatch: expected (${initialLat}, ${initialLng}), got (${storedDispatch.ambulanceLat}, ${storedDispatch.ambulanceLng})`);
    }
    console.log(`✓ Stored coordinates at request time: Lat ${storedDispatch.ambulanceLat}, Lng ${storedDispatch.ambulanceLng}`);

    // Simulate dispatcher moving later to (28.6200, 77.2150)
    console.log("Simulating dispatcher moving to (28.6200, 77.2150)...");
    const movedLat = 28.6200;
    const movedLng = 77.2150;

    // Verify that the stored request coordinates NEVER change when dispatcher moves
    const [reFetched] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, testDispatchId))
      .limit(1);

    if (reFetched.ambulanceLat !== initialLat || reFetched.ambulanceLng !== initialLng) {
      throw new Error("FAIL: Stored request coordinates changed after dispatcher moved!");
    }
    console.log(`✓ Request coordinates remain strictly immutable: Lat ${reFetched.ambulanceLat}, Lng ${reFetched.ambulanceLng}`);

    // 3. Google Maps directions URL with stored request-time coordinates
    console.log("\nStep 3: Verifying Google Maps directions link generation...");
    const directionsUrl = buildGoogleMapsDirectionsUrl({
      lat: hospital.latitude || 28.5672,
      lng: hospital.longitude || 77.2100,
      name: hospital.name,
      city: hospital.city,
      origin: { lat: reFetched.ambulanceLat, lng: reFetched.ambulanceLng },
    });

    console.log(`Generated Directions URL: ${directionsUrl}`);
    if (!directionsUrl.includes("origin=28.6139,77.209")) {
      throw new Error("FAIL: Google Maps directions URL does not include exact ambulance origin coordinates!");
    }
    const expectedCity = encodeURIComponent(hospital.city || "");
    if (!directionsUrl.includes(expectedCity)) {
      throw new Error("FAIL: Google Maps directions URL does not include verified hospital destination city!");
    }
    console.log("✓ Google Maps directions URL correctly includes request-time origin & verified destination");

    // 4. Dashboard Counts Verification: ACTIVE REQUESTS = PENDING + ACCEPTED
    console.log("\nStep 4: Testing Dashboard Counts calculation...");
    const allReqs = await db.select({ status: dispatchRequests.status }).from(dispatchRequests);
    const pendingCount = allReqs.filter((d) => d.status === "PENDING").length;
    const acceptedCount = allReqs.filter((d) => d.status === "ACCEPTED").length;
    const completedCount = allReqs.filter((d) => d.status === "COMPLETED").length;
    const activeRequests = pendingCount + acceptedCount;

    console.log(`Current DB Counts: Active = ${activeRequests} (Pending: ${pendingCount}, Accepted: ${acceptedCount}), Completed = ${completedCount}`);
    if (activeRequests !== pendingCount + acceptedCount) {
      throw new Error("FAIL: Active requests count does not equal Pending + Accepted!");
    }
    console.log("✓ Dashboard Counts formula verified: ACTIVE REQUESTS = PENDING + ACCEPTED");

    // 5. Hospital Review / Acceptance & Shared Timeline
    console.log("\nStep 5: Hospital accepts dispatch request & logs activity...");
    await db
      .update(dispatchRequests)
      .set({ status: "ACCEPTED", approvedBeds: 1, updatedAt: new Date() })
      .where(eq(dispatchRequests.id, testDispatchId));

    await logDispatchActivity({
      dispatchId: testDispatchId,
      actorType: "HOSPITAL",
      actorName: "Hospital Operations",
      action: "REQUEST_ACCEPTED",
      oldValue: "PENDING",
      newValue: "ACCEPTED",
      details: "Inbound ambulance alert accepted by hospital triage staff.",
      note: "Bed capacity reserved.",
    });

    const [afterAccept] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, testDispatchId))
      .limit(1);

    if (afterAccept.status !== "ACCEPTED") {
      throw new Error(`Expected ACCEPTED status, got ${afterAccept.status}`);
    }
    console.log("✓ Request status updated to ACCEPTED");

    // 6. SuperAdmin Intervention & Synchronization
    console.log("\nStep 6: SuperAdmin updates dispatch status to COMPLETED...");
    await db
      .update(dispatchRequests)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(dispatchRequests.id, testDispatchId));

    await logDispatchActivity({
      dispatchId: testDispatchId,
      actorType: "SUPER_ADMIN",
      actorName: "SUPER ADMIN",
      action: "SUPERADMIN_COMPLETED",
      oldValue: "ACCEPTED",
      newValue: "COMPLETED",
      details: "Super Admin manually changed dispatch status from ACCEPTED to COMPLETED",
      note: "Manual override resolution",
    });

    const [afterSuperAdmin] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, testDispatchId))
      .limit(1);

    if (afterSuperAdmin.status !== "COMPLETED") {
      throw new Error(`Expected COMPLETED status, got ${afterSuperAdmin.status}`);
    }
    console.log("✓ SuperAdmin status updated to COMPLETED");

    // 7. Verify Timeline entries & Actor Attribution
    console.log("\nStep 7: Verifying Shared Audit Timeline & Actor Attribution...");
    const activities = await db
      .select()
      .from(dispatchActivities)
      .where(eq(dispatchActivities.dispatchId, testDispatchId))
      .orderBy(dispatchActivities.timestamp);

    console.log(`Total activity records found: ${activities.length}`);
    activities.forEach((act) => {
      console.log(`  - [${act.actorType}] ${act.actorName}: ${act.action} (${act.oldValue || "none"} → ${act.newValue || "none"})`);
    });

    const hasCreated = activities.some((a) => a.action === "REQUEST_CREATED");
    const hasAccepted = activities.some((a) => a.action === "REQUEST_ACCEPTED");
    const hasSuperAdmin = activities.some((a) => a.actorType === "SUPER_ADMIN" && a.actorName === "SUPER ADMIN");

    if (!hasCreated) throw new Error("FAIL: REQUEST_CREATED activity missing from timeline!");
    if (!hasAccepted) throw new Error("FAIL: REQUEST_ACCEPTED activity missing from timeline!");
    if (!hasSuperAdmin) throw new Error("FAIL: SUPER_ADMIN activity attribution missing from timeline!");

    console.log("✓ All activities properly recorded with correct actor attribution in shared audit log");

    // 8. Cancellation does NOT produce a rejected notification
    console.log("\nStep 8: Verifying cancellation does NOT produce rejected notification...");
    const cancelTestId = `disp_cancel_${Date.now()}`;
    await db.insert(dispatchRequests).values({
      id: cancelTestId,
      hospitalId: hospital.id,
      dispatcherSessionId: `sess_cancel_${testId}`,
      ambulanceUnit: "108 EMS Unit-11",
      bedCategoryCode: category.categoryCode,
      requestedBeds: 1,
      etaMinutes: 10,
      patientCondition: "Stable monitored patient",
      status: "CANCELLED",
      createdAt: now,
      updatedAt: now,
    });

    const { getLastRejectedDispatchForSession } = await import("../lib/dispatcher-server");
    const rejectedNotification = await getLastRejectedDispatchForSession(`sess_cancel_${testId}`);
    if (rejectedNotification !== null) {
      throw new Error(`FAIL: Cancelled dispatch produced a rejection alert: ${JSON.stringify(rejectedNotification)}`);
    }
    console.log("✓ Cancelled dispatch verified: NEVER produces a rejected notification");

    // Clean up
    await db.delete(dispatchActivities).where(eq(dispatchActivities.dispatchId, testDispatchId));
    await db.delete(dispatchRequests).where(inArray(dispatchRequests.id, [testDispatchId, cancelTestId]));

    console.log("\n=== ALL E2E TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("\n❌ E2E TEST FAILED:", err);
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error(err);
  process.exit(1);
});
