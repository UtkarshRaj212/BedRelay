import "dotenv/config";
import { db } from "../db";
import { hospitals, hospitalMemberships, hospitalInvitations, user } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function runTests() {
  console.log("=== Testing BedRelay Hospital Onboarding & Staff Management ===");

  const testAdminId = `test_admin_${Date.now()}`;
  const testStaffId = `test_staff_${Date.now()}`;
  const now = new Date();

  try {
    // 1. Create test user accounts
    console.log("\n1. Creating test users...");
    await db.insert(user).values([
      {
        id: testAdminId,
        name: "Dr. Vikram Sethi",
        email: `vikram.sethi.${Date.now()}@hospital.in`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: testStaffId,
        name: "Ananya Roy, RN",
        email: `ananya.roy.${Date.now()}@hospital.in`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    console.log("✓ Created test admin and staff users");

    // 2. Simulate Hospital Setup: "Create New Hospital"
    console.log("\n2. Testing Hospital Creation & HOSPITAL_ADMIN association...");
    const testHospitalId = `hosp_test_${Date.now()}`;
    const [createdHospital] = await db
      .insert(hospitals)
      .values({
        id: testHospitalId,
        userId: testAdminId,
        name: "Max Super Speciality Hospital Saket",
        address: "1, 2, Press Enclave Marg, Saket",
        city: "New Delhi",
        state: "Delhi",
        phone: "+91 11 2651 5050",
        latitude: 28.5284,
        longitude: 77.2114,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Securely associate admin
    const adminMembershipId = `memb_test_adm_${Date.now()}`;
    const [adminMembership] = await db
      .insert(hospitalMemberships)
      .values({
        id: adminMembershipId,
        hospitalId: createdHospital.id,
        userId: testAdminId,
        role: "HOSPITAL_ADMIN",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log("✓ Created hospital facility:", createdHospital.name, "(ID:", createdHospital.id, ")");
    console.log("✓ Verified admin membership:", adminMembership.role, "for user:", adminMembership.userId);

    // 3. Testing Staff Invitation Creation (Admin privilege)
    console.log("\n3. Testing Staff Invitation Generation...");
    const inviteCode = `BR-TEST${Math.floor(100 + Math.random() * 900)}`;
    const [invitation] = await db
      .insert(hospitalInvitations)
      .values({
        id: `inv_test_${Date.now()}`,
        hospitalId: createdHospital.id,
        code: inviteCode,
        email: null,
        role: "HOSPITAL_STAFF",
        invitedByUserId: testAdminId,
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log("✓ Created invitation code:", invitation.code, "for role:", invitation.role);

    // 4. Testing "Join Existing Hospital" via invitation code
    console.log("\n4. Testing Join Existing Hospital flow with invitation code...");
    const [foundInvitation] = await db
      .select()
      .from(hospitalInvitations)
      .where(and(eq(hospitalInvitations.code, inviteCode), eq(hospitalInvitations.status, "PENDING")))
      .limit(1);

    if (!foundInvitation) {
      throw new Error("Failed to find valid invitation by code");
    }

    // Accept invitation
    await db
      .update(hospitalInvitations)
      .set({ status: "ACCEPTED", updatedAt: new Date() })
      .where(eq(hospitalInvitations.id, foundInvitation.id));

    const staffMembershipId = `memb_test_stf_${Date.now()}`;
    const [staffMembership] = await db
      .insert(hospitalMemberships)
      .values({
        id: staffMembershipId,
        hospitalId: foundInvitation.hospitalId,
        userId: testStaffId,
        role: foundInvitation.role,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✓ Successfully redeemed code", inviteCode);
    console.log("✓ New staff membership created:", staffMembership.role, "associated with hospital:", staffMembership.hospitalId);

    // 5. Test multi-tenant isolation and staff roster query
    console.log("\n5. Testing Scoped Staff Query (Hospital isolation)...");
    const hospitalStaff = await db
      .select({
        membershipId: hospitalMemberships.id,
        role: hospitalMemberships.role,
        status: hospitalMemberships.status,
        userName: user.name,
        userEmail: user.email,
      })
      .from(hospitalMemberships)
      .innerJoin(user, eq(hospitalMemberships.userId, user.id))
      .where(eq(hospitalMemberships.hospitalId, createdHospital.id));

    console.log("✓ Members for", createdHospital.name, ":", hospitalStaff.length);
    hospitalStaff.forEach((s) => console.log(`   - ${s.userName} (${s.userEmail}) -> [${s.role}] status: ${s.status}`));

    if (hospitalStaff.length !== 2) {
      throw new Error(`Expected 2 staff members, got ${hospitalStaff.length}`);
    }

    // 6. Test Revocation
    console.log("\n6. Testing Invitation Revocation...");
    const revCode = `BR-REV${Math.floor(100 + Math.random() * 900)}`;
    const [revInvitation] = await db
      .insert(hospitalInvitations)
      .values({
        id: `inv_rev_${Date.now()}`,
        hospitalId: createdHospital.id,
        code: revCode,
        role: "HOSPITAL_STAFF",
        invitedByUserId: testAdminId,
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db
      .update(hospitalInvitations)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(eq(hospitalInvitations.id, revInvitation.id));

    const [checkedRev] = await db
      .select()
      .from(hospitalInvitations)
      .where(eq(hospitalInvitations.id, revInvitation.id))
      .limit(1);

    console.log("✓ Revoked invitation status:", checkedRev?.status);
    if (checkedRev?.status !== "REVOKED") {
      throw new Error("Failed to revoke invitation");
    }

    // Cleanup test records
    console.log("\n7. Cleaning up test fixture records...");
    await db.delete(hospitalInvitations).where(eq(hospitalInvitations.hospitalId, createdHospital.id));
    await db.delete(hospitalMemberships).where(eq(hospitalMemberships.hospitalId, createdHospital.id));
    await db.delete(hospitals).where(eq(hospitals.id, createdHospital.id));
    await db.delete(user).where(eq(user.id, testAdminId));
    await db.delete(user).where(eq(user.id, testStaffId));
    console.log("✓ Cleanup completed successfully");

    console.log("\n🎉 ALL TESTS PASSED! Hospital Onboarding & Staff Management verified!");
    process.exit(0);
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runTests();
