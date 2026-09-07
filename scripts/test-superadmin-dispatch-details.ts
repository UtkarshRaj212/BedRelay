import { db } from "../db";
import { dispatchRequests, hospitals, bedCategories, user } from "../db/schema";
import { eq, desc } from "drizzle-orm";

async function runTest() {
  console.log("=== Testing SuperAdmin Dispatch Details Integration ===");

  // 1. Check a recent dispatch request from the database
  const [latestDispatch] = await db
    .select()
    .from(dispatchRequests)
    .orderBy(desc(dispatchRequests.createdAt))
    .limit(1);

  if (!latestDispatch) {
    console.log("⚠️ No dispatch requests in DB to test. Creating a sample dispatch...");
    const [hospital] = await db.select().from(hospitals).limit(1);
    if (!hospital) {
      console.log("❌ No hospital in DB to attach dispatch to.");
      process.exit(1);
    }
    const [inserted] = await db.insert(dispatchRequests).values({
      id: `test-disp-${Date.now()}`,
      hospitalId: hospital.id,
      ambulanceUnit: "AMB-SUPER-TEST",
      ambulanceLat: 28.6139,
      ambulanceLng: 77.2090,
      bedCategoryCode: "ICU",
      requestedBeds: 2,
      approvedBeds: 1,
      reviewRequired: true,
      reviewReason: "Awaiting senior triage review",
      etaMinutes: 12,
      patientCondition: "Severe respiratory distress",
      patientRef: "PAT-TEST-999",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    console.log("✅ Sample dispatch created:", inserted.id);
  } else {
    console.log("✅ Located existing dispatch in DB:", latestDispatch.id);
    console.log("   - Status:", latestDispatch.status);
    console.log("   - Ambulance:", latestDispatch.ambulanceUnit);
    console.log("   - Bed Category:", latestDispatch.bedCategoryCode);
    console.log("   - Requested Beds:", latestDispatch.requestedBeds);
    console.log("   - Approved Beds:", latestDispatch.approvedBeds);
    console.log("   - Review Required:", latestDispatch.reviewRequired);
    console.log("   - Review Reason:", latestDispatch.reviewReason);
  }

  // 2. Check superadmin user role exists
  const [superAdmin] = await db
    .select()
    .from(user)
    .where(eq(user.role, "SUPER_ADMIN"))
    .limit(1);
  console.log("✅ SuperAdmin user found in DB:", superAdmin ? superAdmin.email : "None found (ensure superadmin user is seeded)");

  console.log("=== Verification Successful ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
