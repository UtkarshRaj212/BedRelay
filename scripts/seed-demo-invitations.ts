import "dotenv/config";
import { db } from "../db";
import { hospitalInvitations, hospitals } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== SEEDING / REFRESHING DEMO INVITATIONS ===");
  const now = new Date();
  const farFuture = new Date("2035-01-01T00:00:00.000Z");

  // Verify target hospitals exist
  const allHospitals = await db.select().from(hospitals);
  const apollo = allHospitals.find((h) => h.id.includes("apollo"));
  const aiims = allHospitals.find((h) => h.id.includes("aiims") || h.id === "hosp_1788463370935");
  const kem = allHospitals.find((h) => h.id.includes("kem"));
  const gleneagles = allHospitals.find((h) => h.id.includes("gleneagles"));

  if (!apollo || !aiims || !kem) {
    console.error("Missing required hospitals:", { apollo: !!apollo, aiims: !!aiims, kem: !!kem });
    process.exit(1);
  }

  console.log("Using hospitals:", {
    apollo: `${apollo.name} (${apollo.id})`,
    aiims: `${aiims.name} (${aiims.id})`,
    kem: `${kem.name} (${kem.id})`,
    gleneagles: gleneagles ? `${gleneagles.name} (${gleneagles.id})` : "none",
  });

  const demoCodes = [
    {
      id: "inv_demo_apollo07",
      hospitalId: apollo.id,
      code: "BR-APOLLO07",
      role: "HOSPITAL_STAFF",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "inv_demo_apollo7",
      hospitalId: apollo.id,
      code: "BR-APOLLO7",
      role: "HOSPITAL_STAFF",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "inv_demo_apollo09",
      hospitalId: apollo.id,
      code: "BR-APOLLO09",
      role: "HOSPITAL_ADMIN",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "inv_demo_apollo9",
      hospitalId: apollo.id,
      code: "BR-APOLLO9",
      role: "HOSPITAL_ADMIN",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "inv_demo_aiims42",
      hospitalId: aiims.id,
      code: "BR-AIIMS42",
      role: "HOSPITAL_STAFF",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "inv_demo_aiims99",
      hospitalId: aiims.id,
      code: "BR-AIIMS99",
      role: "HOSPITAL_ADMIN",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "inv_demo_kem888",
      hospitalId: kem.id,
      code: "BR-KEM888",
      role: "HOSPITAL_STAFF",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
  ];

  if (gleneagles) {
    demoCodes.push({
      id: "inv_demo_glen2",
      hospitalId: gleneagles.id,
      code: "BR-GLEN2",
      role: "HOSPITAL_STAFF",
      email: null,
      status: "PENDING",
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const item of demoCodes) {
    // Check if code exists by code or id
    const [existing] = await db
      .select()
      .from(hospitalInvitations)
      .where(eq(hospitalInvitations.code, item.code))
      .limit(1);

    if (existing) {
      await db
        .update(hospitalInvitations)
        .set({
          status: "PENDING",
          expiresAt: farFuture,
          hospitalId: item.hospitalId,
          role: item.role,
          updatedAt: now,
        })
        .where(eq(hospitalInvitations.id, existing.id));
      console.log(`✓ Updated existing invitation ${item.code} (${item.role}) -> Status: PENDING, Expires: 2035`);
    } else {
      await db.insert(hospitalInvitations).values(item);
      console.log(`✓ Inserted new invitation ${item.code} (${item.role}) -> Status: PENDING, Expires: 2035`);
    }
  }

  // Also refresh any other invitations in DB that were expired
  const allInvs = await db.select().from(hospitalInvitations);
  console.log(`\nTotal invitations in DB: ${allInvs.length}`);
  allInvs.forEach((inv) => {
    console.log(` - [${inv.code}] Hospital: ${inv.hospitalId} | Role: ${inv.role} | Status: ${inv.status} | Expires: ${inv.expiresAt}`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding invitations failed:", err);
  process.exit(1);
});
