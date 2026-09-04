import { db } from "../db";
import { bedCategories, hospitals } from "../db/schema";
import { eq } from "drizzle-orm";

async function fixUserHospitalBeds() {
  const allHospitals = await db.select().from(hospitals);
  const userHospital = allHospitals.find(
    (h) => h.userId !== "user_seed_admin_101"
  );

  if (!userHospital) {
    console.error("No user-created hospital found.");
    process.exit(1);
  }

  console.log(`Found: ${userHospital.name} (${userHospital.id})`);
  console.log(`Location: ${userHospital.city}, ${userHospital.state}\n`);

  // Check existing beds
  const existingBeds = await db
    .select()
    .from(bedCategories)
    .where(eq(bedCategories.hospitalId, userHospital.id));

  console.log(`Existing bed categories: ${existingBeds.length}`);
  for (const b of existingBeds) {
    console.log(`  ${b.categoryCode}: ${b.availableBeds}/${b.totalBeds} available (occupied: ${b.occupiedBeds})`);
  }

  // Delete old bed categories and insert fresh realistic ones
  if (existingBeds.length > 0) {
    await db.delete(bedCategories).where(eq(bedCategories.hospitalId, userHospital.id));
    console.log(`\nRemoved ${existingBeds.length} old bed categories.`);
  }

  const now = new Date();

  const beds = [
    {
      id: `cat_user_icu`,
      hospitalId: userHospital.id,
      categoryCode: "ICU",
      name: "Intensive Care Unit (ICU)",
      totalBeds: 28,
      availableBeds: 6,
      occupiedBeds: 22,
      lastUpdated: new Date(now.getTime() - 12 * 60000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat_user_gen`,
      hospitalId: userHospital.id,
      categoryCode: "GENERAL",
      name: "General Ward",
      totalBeds: 150,
      availableBeds: 38,
      occupiedBeds: 112,
      lastUpdated: new Date(now.getTime() - 8 * 60000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat_user_vent`,
      hospitalId: userHospital.id,
      categoryCode: "VENTILATOR",
      name: "Ventilator & Critical Care",
      totalBeds: 18,
      availableBeds: 4,
      occupiedBeds: 14,
      lastUpdated: new Date(now.getTime() - 5 * 60000),
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const bed of beds) {
    await db.insert(bedCategories).values(bed);
  }

  console.log(`\n✓ Added ${beds.length} bed categories for ${userHospital.name}:`);
  for (const b of beds) {
    const occ = Math.round((b.occupiedBeds / b.totalBeds) * 100);
    console.log(`  ${b.categoryCode.padEnd(12)} ${b.availableBeds}/${b.totalBeds} available  (${occ}% occupancy)`);
  }

  process.exit(0);
}

fixUserHospitalBeds().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
