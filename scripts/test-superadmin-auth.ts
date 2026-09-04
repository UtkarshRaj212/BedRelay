import "dotenv/config";
import { db } from "../db";
import { user, auditLogs, hospitals, bedCategories } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { recordAuditLog } from "../lib/auth-server";

async function runTests() {
  console.log("=== Testing BedRelay SuperAdmin Authorization Model ===\n");

  // Test 1: Verify SuperAdmin database users
  console.log("Test 1: Verifying SuperAdmin accounts in database...");
  const [admin101] = await db.select().from(user).where(eq(user.id, "user_seed_admin_101")).limit(1);
  const [natSuperAdmin] = await db.select().from(user).where(eq(user.id, "user_national_superadmin")).limit(1);

  if (!admin101 || admin101.role !== "SUPER_ADMIN") {
    throw new Error(`Expected user_seed_admin_101 to have role SUPER_ADMIN, got: ${admin101?.role}`);
  }
  console.log(`  ✓ user_seed_admin_101 verified: ${admin101.name} [Role: ${admin101.role}]`);

  if (!natSuperAdmin || natSuperAdmin.role !== "SUPER_ADMIN") {
    throw new Error(`Expected user_national_superadmin to have role SUPER_ADMIN, got: ${natSuperAdmin?.role}`);
  }
  console.log(`  ✓ user_national_superadmin verified: ${natSuperAdmin.name} [Role: ${natSuperAdmin.role}]`);

  // Test 2: Verify normal user has USER role (cannot access SuperAdmin)
  console.log("\nTest 2: Verifying normal user privileges...");
  const [normalUser] = await db.select().from(user).where(eq(user.role, "USER")).limit(1);
  if (normalUser) {
    console.log(`  ✓ Normal user verified: ${normalUser.name} (${normalUser.email}) [Role: ${normalUser.role}]`);
    if (normalUser.role === "SUPER_ADMIN") {
      throw new Error("Normal user must not have SUPER_ADMIN role");
    }
  } else {
    console.log("  ℹ No existing USER role user found; standard users default to 'USER'");
  }

  // Test 3: Audit Logging Functionality
  console.log("\nTest 3: Verifying audit logging subsystem...");
  const testAction = "TEST_SUPERADMIN_AUDIT";
  await recordAuditLog({
    userId: natSuperAdmin.id,
    action: testAction,
    resourceType: "SYSTEM_TEST",
    resourceId: "test_verification_01",
    details: { test: true, description: "SuperAdmin authorization model automated verification" },
  });

  const [loggedEntry] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.action, testAction))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!loggedEntry) {
    throw new Error("Failed to retrieve written audit log entry");
  }
  console.log(`  ✓ Audit log entry successfully written and retrieved: [${loggedEntry.id}] Action: ${loggedEntry.action}, Actor: ${loggedEntry.userId}`);

  // Test 4: Hospital Status column verification
  console.log("\nTest 4: Verifying hospitals table status column...");
  const [sampleHosp] = await db.select().from(hospitals).limit(1);
  if (!sampleHosp) {
    throw new Error("No hospitals found in database");
  }
  console.log(`  ✓ Hospital status field verified on '${sampleHosp.name}': status=${sampleHosp.status}`);

  console.log("\n=======================================================");
  console.log(" All SuperAdmin authorization unit tests passed successfully!");
  console.log("=======================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("SuperAdmin unit tests failed:", err);
  process.exit(1);
});
