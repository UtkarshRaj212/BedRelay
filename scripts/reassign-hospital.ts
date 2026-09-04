import { db } from "../db";
import { hospitals, bedCategories, dispatchRequests } from "../db/schema";
import { eq } from "drizzle-orm";

async function reassignUserToAIIMS() {
  // Find the user's hospital
  const allHospitals = await db.select().from(hospitals);
  const userHospital = allHospitals.find((h) => h.userId !== "user_seed_admin_101");

  if (!userHospital) {
    console.error("No user-created hospital found.");
    process.exit(1);
  }

  console.log(`Current user hospital: ${userHospital.name} (${userHospital.id})`);

  // Update user's hospital to be AIIMS New Delhi
  await db
    .update(hospitals)
    .set({
      name: "AIIMS New Delhi",
      address: "Sri Aurobindo Marg, Ansari Nagar",
      city: "New Delhi",
      state: "Delhi",
      phone: "+91 11 2658 8500",
      latitude: 28.5672,
      longitude: 77.21,
      updatedAt: new Date(),
    })
    .where(eq(hospitals.id, userHospital.id));

  console.log("✓ Updated user hospital → AIIMS New Delhi");

  // Delete the seed AIIMS Delhi (hosp_aiims_delhi) to avoid duplicate
  const seedAiims = allHospitals.find((h) => h.id === "hosp_aiims_delhi");
  if (seedAiims) {
    // Move any dispatches from seed AIIMS to user's hospital
    const seedDispatches = await db
      .select()
      .from(dispatchRequests)
      .where(eq(dispatchRequests.hospitalId, "hosp_aiims_delhi"));

    for (const disp of seedDispatches) {
      await db
        .update(dispatchRequests)
        .set({ hospitalId: userHospital.id })
        .where(eq(dispatchRequests.id, disp.id));
    }
    console.log(`  Moved ${seedDispatches.length} dispatches from seed AIIMS → user hospital`);

    // Delete seed AIIMS beds and hospital
    await db.delete(bedCategories).where(eq(bedCategories.hospitalId, "hosp_aiims_delhi"));
    await db.delete(hospitals).where(eq(hospitals.id, "hosp_aiims_delhi"));
    console.log("  Removed duplicate seed AIIMS Delhi entry");
  }

  // Update user hospital bed data to match realistic AIIMS capacity
  await db.delete(bedCategories).where(eq(bedCategories.hospitalId, userHospital.id));

  const now = new Date();
  const aiimsBedsData = [
    {
      id: "cat_user_icu",
      hospitalId: userHospital.id,
      categoryCode: "ICU",
      name: "Intensive Care Unit (ICU)",
      totalBeds: 40,
      availableBeds: 12,
      occupiedBeds: 28,
      lastUpdated: new Date(now.getTime() - 10 * 60000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "cat_user_gen",
      hospitalId: userHospital.id,
      categoryCode: "GENERAL",
      name: "General Ward",
      totalBeds: 250,
      availableBeds: 55,
      occupiedBeds: 195,
      lastUpdated: new Date(now.getTime() - 6 * 60000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "cat_user_vent",
      hospitalId: userHospital.id,
      categoryCode: "VENTILATOR",
      name: "Ventilator & Critical Care",
      totalBeds: 30,
      availableBeds: 6,
      occupiedBeds: 24,
      lastUpdated: new Date(now.getTime() - 3 * 60000),
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const bed of aiimsBedsData) {
    await db.insert(bedCategories).values(bed);
  }
  console.log("✓ Updated bed categories to AIIMS-scale capacity");

  console.log("\nDone! Your account is now staff at AIIMS New Delhi.");
  process.exit(0);
}

reassignUserToAIIMS().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
