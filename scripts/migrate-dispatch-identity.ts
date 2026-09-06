import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Applying ambulance_id and patient_reference migration to Neon Postgres...");

  await db.execute(sql`
    ALTER TABLE "dispatch_requests" 
    ADD COLUMN IF NOT EXISTS "ambulance_id" text,
    ADD COLUMN IF NOT EXISTS "patient_reference" text;
  `);
  console.log("✓ Added 'ambulance_id' and 'patient_reference' columns to dispatch_requests");

  await db.execute(sql`
    UPDATE "dispatch_requests"
    SET "ambulance_id" = "ambulance_unit"
    WHERE "ambulance_id" IS NULL;
  `);

  await db.execute(sql`
    UPDATE "dispatch_requests"
    SET "patient_reference" = "patient_ref"
    WHERE "patient_reference" IS NULL;
  `);
  console.log("✓ Backfilled existing records with ambulance_id and patient_reference");

  console.log("🎉 Migration completed successfully.");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
