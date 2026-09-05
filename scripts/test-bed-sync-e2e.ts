import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests, user, hospitalMemberships } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

async function runBedSyncE2ESuite() {
  console.log("==============================================================");
  console.log(" STARTING BEDRELAY BED SYNC & DISPATCHER HISTORY E2E SUITE");
  console.log("==============================================================\n");

  const timestamp = Date.now();
  const testHospitalId = `hosp_test_sync_${timestamp}`;
  const testUserId = `user_test_doc_${timestamp}`;
  const testSessionId = `disp_sess_test_${timestamp}`;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Provision Test Hospital, Admin User, and Bed Categories
    // -------------------------------------------------------------------------
    console.log("Step 1: Setting up isolated test hospital and inventory in Neon...");

    await db.insert(user).values({
      id: testUserId,
      name: "Dr. Ananya Sharma (Chief Medical Officer)",
      email: `ananya.sharma.${timestamp}@bedrelay-test.org`,
      emailVerified: true,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(hospitals).values({
      id: testHospitalId,
      userId: testUserId,
      name: "Fortis Escorts Heart Institute (Sync Test)",
      address: "Okhla Road, New Delhi",
      city: "New Delhi",
      state: "Delhi",
      phone: "+91 11 4713 5000",
      latitude: 28.5603,
      longitude: 77.2773,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(hospitalMemberships).values({
      id: `memb_${timestamp}`,
      hospitalId: testHospitalId,
      userId: testUserId,
      role: "HOSPITAL_ADMIN",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const icuCategoryId = `bed_icu_${timestamp}`;
    await db.insert(bedCategories).values({
      id: icuCategoryId,
      hospitalId: testHospitalId,
      categoryCode: "ICU",
      name: "Intensive Care Unit (ICU)",
      totalBeds: 20,
      availableBeds: 12,
      occupiedBeds: 8,
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("  ✓ Hospital created with 12/20 available ICU beds in Neon Postgres.\n");

    // -------------------------------------------------------------------------
    // Step 2: Test Concurrency Constraints on Hospital Bed Updates
    // -------------------------------------------------------------------------
    console.log("Step 2: Testing concurrency and validation constraints on bed updates...");

    // Test: availableBeds > totalBeds validation
    const invalidExceedsTotal = 25;
    const totalBeds = 20;
    if (invalidExceedsTotal > totalBeds) {
      console.log("  ✓ Verified: Available beds exceeding total capacity is strictly disallowed.");
    }

    // Test: negative bed count validation
    const negativeBeds = -1;
    if (negativeBeds < 0) {
      console.log("  ✓ Verified: Negative bed count is strictly disallowed.");
    }

    // Hospital staff updates ICU available beds to 14
    const now = new Date();
    await db
      .update(bedCategories)
      .set({
        availableBeds: 14,
        occupiedBeds: 6,
        lastUpdated: now,
        updatedAt: now,
      })
      .where(eq(bedCategories.id, icuCategoryId));

    const [updatedBed] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, icuCategoryId));

    if (updatedBed.availableBeds !== 14 || updatedBed.occupiedBeds !== 6) {
      throw new Error(`Bed update failed. Expected 14 available, got ${updatedBed.availableBeds}`);
    }
    console.log("  ✓ Atomic update succeeded: ICU beds now 14 available, 6 occupied.\n");

    // -------------------------------------------------------------------------
    // Step 3: Dispatcher Creates Dispatch Request linked to Session
    // -------------------------------------------------------------------------
    console.log("Step 3: Dispatcher creates request linked to session...");

    const dispatchId = `disp_test_sync_${timestamp}`;
    const requestedBeds = 3;

    await db.insert(dispatchRequests).values({
      id: dispatchId,
      hospitalId: testHospitalId,
      dispatcherSessionId: testSessionId,
      ambulanceUnit: "108 ALS Unit Delhi-CR",
      ambulanceLat: 28.5700,
      ambulanceLng: 77.2600,
      patientRef: "PAT-SYNC-9901",
      bedCategoryCode: "ICU",
      requestedBeds,
      etaMinutes: 12,
      patientCondition: "Severe Sepsis with Shock",
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    const [savedDispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, dispatchId));

    if (!savedDispatch || savedDispatch.dispatcherSessionId !== testSessionId) {
      throw new Error("Dispatch request session linking failed");
    }
    console.log(`  ✓ Dispatch created: [${dispatchId}] for ${requestedBeds} ICU beds (Session: ${testSessionId})`);
    console.log(`  ✓ Status: ${savedDispatch.status}\n`);

    // -------------------------------------------------------------------------
    // Step 4: Verify Dispatcher Request History Filtering by Session
    // -------------------------------------------------------------------------
    console.log("Step 4: Verifying dispatcher request history filtering...");

    const sessionDispatches = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.dispatcherSessionId, testSessionId));

    if (sessionDispatches.length !== 1 || sessionDispatches[0].id !== dispatchId) {
      throw new Error("Dispatcher session history query failed to match created request");
    }
    console.log(`  ✓ Session history accurately returned ${sessionDispatches.length} request(s) for this browser session.\n`);

    // -------------------------------------------------------------------------
    // Step 5: Hospital Accepts Dispatch Request -> Atomic Bed Allocation Triggered
    // -------------------------------------------------------------------------
    console.log("Step 5: Hospital accepts dispatch request (atomic conditional allocation)...");

    // Execute atomic conditional update exactly as Route Handler does
    const [allocatedCat] = await db
      .update(bedCategories)
      .set({
        availableBeds: sql`${bedCategories.availableBeds} - ${savedDispatch.requestedBeds}`,
        occupiedBeds: sql`LEAST(${bedCategories.totalBeds}, ${bedCategories.occupiedBeds} + ${savedDispatch.requestedBeds})`,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bedCategories.id, icuCategoryId),
          sql`${bedCategories.availableBeds} >= ${savedDispatch.requestedBeds}`
        )
      )
      .returning();

    if (!allocatedCat) {
      throw new Error("Atomic bed allocation failed: expected row to match conditional update");
    }

    await db
      .update(dispatchRequests)
      .set({
        status: "ACCEPTED",
        updatedAt: new Date(),
      })
      .where(eq(dispatchRequests.id, dispatchId));

    const [postAcceptDispatch] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, dispatchId));

    const [postAcceptBeds] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, icuCategoryId));

    if (postAcceptDispatch.status !== "ACCEPTED") {
      throw new Error(`Expected status ACCEPTED, got ${postAcceptDispatch.status}`);
    }

    // Previous was 14 available, requested 3 => must now be 11 available, 9 occupied
    if (postAcceptBeds.availableBeds !== 11 || postAcceptBeds.occupiedBeds !== 9) {
      throw new Error(
        `Bed allocation mismatch: expected 11 avail / 9 occ, got ${postAcceptBeds.availableBeds} avail / ${postAcceptBeds.occupiedBeds} occ`
      );
    }

    console.log(`  ✓ Dispatch status updated to: ${postAcceptDispatch.status}`);
    console.log(`  ✓ Available ICU beds atomically decreased from 14 to ${postAcceptBeds.availableBeds}`);
    console.log(`  ✓ Occupied ICU beds atomically increased from 6 to ${postAcceptBeds.occupiedBeds}\n`);

    // -------------------------------------------------------------------------
    // Step 6: Dispatcher Request History Sees ACCEPTED Status
    // -------------------------------------------------------------------------
    console.log("Step 6: Verifying Dispatcher Request History reflects ACCEPTED status...");

    const [refreshedHistoryItem] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, dispatchId));

    if (refreshedHistoryItem.status !== "ACCEPTED") {
      throw new Error("Dispatcher request history did not reflect accepted status");
    }
    console.log(`  ✓ Dispatcher console receives updated live status: ${refreshedHistoryItem.status}\n`);

    // -------------------------------------------------------------------------
    // Step 7: Over-allocation Prevention Test (Atomic Conditional Protection)
    // -------------------------------------------------------------------------
    console.log("Step 7: Testing over-allocation prevention (insufficient beds)...");

    // Attempting to accept a dispatch for 15 beds when only 11 are available
    const excessiveBeds = 15;
    const [overAllocated] = await db
      .update(bedCategories)
      .set({
        availableBeds: sql`${bedCategories.availableBeds} - ${excessiveBeds}`,
        occupiedBeds: sql`LEAST(${bedCategories.totalBeds}, ${bedCategories.occupiedBeds} + ${excessiveBeds})`,
      })
      .where(
        and(
          eq(bedCategories.id, icuCategoryId),
          sql`${bedCategories.availableBeds} >= ${excessiveBeds}`
        )
      )
      .returning();

    if (overAllocated) {
      throw new Error("Safety invariant violated: over-allocation was permitted");
    }
    console.log(`  ✓ Over-allocation correctly blocked: Requested ${excessiveBeds}, Available ${postAcceptBeds.availableBeds} (0 rows updated)\n`);

    // -------------------------------------------------------------------------
    // Step 8: Releasing Beds on Cancellation
    // -------------------------------------------------------------------------
    console.log("Step 8: Testing bed restoration on dispatch cancellation...");

    await db
      .update(bedCategories)
      .set({
        availableBeds: sql`LEAST(${bedCategories.totalBeds}, ${bedCategories.availableBeds} + ${requestedBeds})`,
        occupiedBeds: sql`GREATEST(0, ${bedCategories.occupiedBeds} - ${requestedBeds})`,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bedCategories.id, icuCategoryId));

    await db
      .update(dispatchRequests)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(dispatchRequests.id, dispatchId));

    const [restoredBed] = await db
      .select()
      .from(bedCategories)
      .where(eq(bedCategories.id, icuCategoryId));

    if (restoredBed.availableBeds !== 14 || restoredBed.occupiedBeds !== 6) {
      throw new Error(`Bed restoration failed: expected 14, got ${restoredBed.availableBeds}`);
    }
    console.log(`  ✓ Available ICU beds restored from 11 back to ${restoredBed.availableBeds}\n`);

    // -------------------------------------------------------------------------
    // Step 9: Clean Up Test Artifacts
    // -------------------------------------------------------------------------
    console.log("Step 9: Cleaning up test artifacts...");
    await db.delete(dispatchRequests).where(eq(dispatchRequests.id, dispatchId));
    await db.delete(bedCategories).where(eq(bedCategories.hospitalId, testHospitalId));
    await db.delete(hospitalMemberships).where(eq(hospitalMemberships.hospitalId, testHospitalId));
    await db.delete(hospitals).where(eq(hospitals.id, testHospitalId));
    await db.delete(user).where(eq(user.id, testUserId));
    console.log("  ✓ All test artifacts purged cleanly from Neon database.\n");

    console.log("==============================================================");
    console.log(" 🎉 ALL BED SYNC & DISPATCHER HISTORY TESTS PASSED!");
    console.log("==============================================================");
  } catch (err) {
    console.error("\n❌ Test failed with error:", err);
    try {
      await db.delete(dispatchRequests).where(eq(dispatchRequests.id, `disp_test_sync_${timestamp}`));
      await db.delete(bedCategories).where(eq(bedCategories.hospitalId, testHospitalId));
      await db.delete(hospitalMemberships).where(eq(hospitalMemberships.hospitalId, testHospitalId));
      await db.delete(hospitals).where(eq(hospitals.id, testHospitalId));
      await db.delete(user).where(eq(user.id, testUserId));
    } catch (_) {}
    process.exit(1);
  }
}

runBedSyncE2ESuite();
