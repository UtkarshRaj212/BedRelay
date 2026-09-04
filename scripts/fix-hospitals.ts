import { db } from "../db";
import { hospitals } from "../db/schema";
import { eq, like, or } from "drizzle-orm";

async function fixNonIndianHospitals() {
  console.log("Fixing non-Indian hospital records...");

  // Find hospitals with US-style data (from old auth-server defaults)
  const allHospitals = await db.select().from(hospitals);

  for (const hosp of allHospitals) {
    const hasUSPhone = hosp.phone?.startsWith("+1");
    const hasUSAddress = hosp.address?.includes("Operational Blvd");
    const hasMetroRegion = hosp.city === "Metro Region";

    if (hasUSPhone || hasUSAddress || hasMetroRegion) {
      console.log(`Fixing hospital: ${hosp.id} (${hosp.name})`);

      await db
        .update(hospitals)
        .set({
          address: "Sector 14, Dwarka",
          city: "New Delhi",
          state: "Delhi",
          phone: "+91 11 2671 0000",
          latitude: 28.5921,
          longitude: 77.0460,
          updatedAt: new Date(),
        })
        .where(eq(hospitals.id, hosp.id));

      console.log(`  → Updated to New Delhi, Delhi`);
    }
  }

  console.log("Done. All hospitals now have Indian data.");
  process.exit(0);
}

fixNonIndianHospitals().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
