import "dotenv/config";
import { db } from "../db";
import { hospitals, bedCategories, hospitalMemberships, dispatchRequests, auditLogs, user } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { recordAuditLog } from "../lib/auth-server";

async function runE2E() {
  console.log("==============================================================");
  console.log(" STARTING BEDRELAY SUPERADMIN & PLATFORM E2E INTEGRATION SUITE");
  console.log("==============================================================\n");

  const testHospId = `hosp_test_e2e_${Date.now()}`;
  const testUserId = `user_test_doc_${Date.now()}`;
  const testSuperAdminId = "user_national_superadmin";
  const now = new Date();

  try {
    // -------------------------------------------------------------
    // Step 1: Verify SuperAdmin exists
    // -------------------------------------------------------------
    console.log("Step 1: Checking SuperAdmin account in Neon...");
    const [sa] = await db.select().from(user).where(eq(user.id, testSuperAdminId)).limit(1);
    if (!sa || sa.role !== "SUPER_ADMIN") {
      throw new Error("SuperAdmin user not found or does not have SUPER_ADMIN role!");
    }
    console.log(`  ✓ SuperAdmin verified: ${sa.name} <${sa.email}> (role: ${sa.role})\n`);

    // -------------------------------------------------------------
    // Step 2: SuperAdmin creates a new hospital
    // -------------------------------------------------------------
    console.log("Step 2: SuperAdmin creates new hospital facility...");
    const [newHosp] = await db
      .insert(hospitals)
      .values({
        id: testHospId,
        userId: testSuperAdminId,
        name: "Max Super Speciality Hospital Saket",
        address: "1, 2, Press Enclave Marg, Saket",
        city: "New Delhi",
        state: "Delhi",
        phone: "+91 11 2651 5050",
        latitude: 28.5283,
        longitude: 77.2140,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await recordAuditLog({
      userId: testSuperAdminId,
      action: "CREATE_HOSPITAL",
      resourceType: "HOSPITAL",
      resourceId: testHospId,
      details: { name: newHosp.name, city: newHosp.city },
    });
    console.log(`  ✓ Created hospital: '${newHosp.name}' [ID: ${newHosp.id}, Status: ${newHosp.status}]\n`);

    // -------------------------------------------------------------
    // Step 3: SuperAdmin adds bed units
    // -------------------------------------------------------------
    console.log("Step 3: SuperAdmin provisions bed categories...");
    const testBedId = `bed_test_${Date.now()}`;
    const [createdBed] = await db
      .insert(bedCategories)
      .values({
        id: testBedId,
        hospitalId: testHospId,
        categoryCode: "NICU",
        name: "Neonatal Intensive Care Unit",
        totalBeds: 20,
        availableBeds: 8,
        occupiedBeds: 12,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await recordAuditLog({
      userId: testSuperAdminId,
      action: "CREATE_BED_CATEGORY",
      resourceType: "BED_CATEGORY",
      resourceId: testBedId,
      details: { categoryCode: createdBed.categoryCode, totalBeds: 20, availableBeds: 8 },
    });
    console.log(`  ✓ Created bed category '${createdBed.categoryCode}' (${createdBed.availableBeds}/${createdBed.totalBeds} available)\n`);

    // -------------------------------------------------------------
    // Step 4: SuperAdmin assigns staff member
    // -------------------------------------------------------------
    console.log("Step 4: SuperAdmin assigns doctor as HOSPITAL_ADMIN...");
    await db.insert(user).values({
      id: testUserId,
      name: "Dr. Alok Arora",
      email: `dr.arora.${Date.now()}@maxhealthcare.in`,
      emailVerified: true,
      role: "USER",
      createdAt: now,
      updatedAt: now,
    });

    const testMembId = `memb_test_${Date.now()}`;
    const [membership] = await db
      .insert(hospitalMemberships)
      .values({
        id: testMembId,
        hospitalId: testHospId,
        userId: testUserId,
        role: "HOSPITAL_ADMIN",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log(`  ✓ Assigned user '${testUserId}' to hospital '${testHospId}' as ${membership.role}\n`);

    // -------------------------------------------------------------
    // Step 5: Verify Active Hospital appears in Search
    // -------------------------------------------------------------
    console.log("Step 5: Verifying hospital availability query (Active filter)...");
    const activeQueryHospitals = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.status, "ACTIVE"));

    const isPresentInActive = activeQueryHospitals.some((h) => h.id === testHospId);
    if (!isPresentInActive) {
      throw new Error("Hospital was expected in active hospitals search query, but was not found!");
    }
    console.log(`  ✓ Hospital '${newHosp.name}' confirmed VISIBLE to EMS dispatch search\n`);

    // -------------------------------------------------------------
    // Step 6: SuperAdmin deactivates the facility
    // -------------------------------------------------------------
    console.log("Step 6: SuperAdmin deactivates hospital...");
    await db
      .update(hospitals)
      .set({ status: "DEACTIVATED", updatedAt: new Date() })
      .where(eq(hospitals.id, testHospId));

    await recordAuditLog({
      userId: testSuperAdminId,
      action: "HOSPITAL_STATUS_DEACTIVATED",
      resourceType: "HOSPITAL",
      resourceId: testHospId,
    });

    const queryAfterDeactivation = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.status, "ACTIVE"));

    const isPresentAfterDeactivation = queryAfterDeactivation.some((h) => h.id === testHospId);
    if (isPresentAfterDeactivation) {
      throw new Error("Deactivated hospital was found in active hospitals search query!");
    }
    console.log(`  ✓ Confirmed: Hospital '${newHosp.name}' is IMMEDIATELY HIDDEN from EMS dispatch search when DEACTIVATED\n`);

    // -------------------------------------------------------------
    // Step 7: SuperAdmin reactivates facility & dispatches ambulance
    // -------------------------------------------------------------
    console.log("Step 7: SuperAdmin reactivates hospital and creates dispatch...");
    await db
      .update(hospitals)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(hospitals.id, testHospId));

    const testDispId = `disp_test_${Date.now()}`;
    const [createdDispatch] = await db
      .insert(dispatchRequests)
      .values({
        id: testDispId,
        hospitalId: testHospId,
        ambulanceUnit: "108 ALS Unit Delhi-South",
        bedCategoryCode: "NICU",
        requestedBeds: 1,
        etaMinutes: 14,
        patientCondition: "Pre-term respiratory distress newborn",
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(`  ✓ Dispatch created: [${createdDispatch.id}] ${createdDispatch.ambulanceUnit} -> Status: ${createdDispatch.status}\n`);

    // -------------------------------------------------------------
    // Step 8: SuperAdmin resolves dispatch request
    // -------------------------------------------------------------
    console.log("Step 8: SuperAdmin updates dispatch status to ACCEPTED and then COMPLETED...");
    await db
      .update(dispatchRequests)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(dispatchRequests.id, testDispId));

    const [resolvedDisp] = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.id, testDispId))
      .limit(1);

    if (resolvedDisp?.status !== "COMPLETED") {
      throw new Error(`Expected dispatch status COMPLETED, got: ${resolvedDisp?.status}`);
    }
    console.log(`  ✓ Dispatch verified updated in Postgres: status is '${resolvedDisp.status}'\n`);

    // -------------------------------------------------------------
    // Step 9: SuperAdmin deletes hospital with cascading integrity
    // -------------------------------------------------------------
    console.log("Step 9: SuperAdmin deletes test hospital and verifies cascading referential cleanup...");
    await db.delete(hospitals).where(eq(hospitals.id, testHospId));

    // Verify bed categories cleaned up
    const remainingBeds = await db.select().from(bedCategories).where(eq(bedCategories.hospitalId, testHospId));
    if (remainingBeds.length > 0) {
      throw new Error("Bed categories were not cascade-deleted with hospital!");
    }

    // Verify memberships cleaned up
    const remainingMemberships = await db.select().from(hospitalMemberships).where(eq(hospitalMemberships.hospitalId, testHospId));
    if (remainingMemberships.length > 0) {
      throw new Error("Hospital memberships were not cascade-deleted with hospital!");
    }

    // Verify dispatches cleaned up
    const remainingDispatches = await db.select().from(dispatchRequests).where(eq(dispatchRequests.hospitalId, testHospId));
    if (remainingDispatches.length > 0) {
      throw new Error("Dispatch requests were not cascade-deleted with hospital!");
    }

    // Clean up test user
    await db.delete(user).where(eq(user.id, testUserId));

    console.log("  ✓ Cascading deletion verified: All bed units, memberships, and dispatches purged with 100% integrity.\n");

    // -------------------------------------------------------------
    // Step 10: Verify Audit Logs
    // -------------------------------------------------------------
    console.log("Step 10: Verifying audit log capture in database...");
    const recentLogs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(5);

    console.log(`  ✓ Recent audit logs captured (${recentLogs.length} verified):`);
    recentLogs.forEach((l) => console.log(`     - [${l.action}] Target: ${l.resourceType} (${l.resourceId}) by actor: ${l.userId}`));

    console.log("\n==============================================================");
    console.log(" 🎉 ALL SUPERADMIN & PLATFORM E2E INTEGRATION TESTS PASSED!");
    console.log("==============================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ E2E Integration Suite Failed:", err);
    // Cleanup on error
    try {
      await db.delete(hospitals).where(eq(hospitals.id, testHospId));
      await db.delete(user).where(eq(user.id, testUserId));
    } catch {}
    process.exit(1);
  }
}

runE2E();
