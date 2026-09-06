import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Applying request modification, review, and activity log migration to Neon Postgres...");

  await db.execute(sql`
    ALTER TABLE "dispatch_requests" 
    ADD COLUMN IF NOT EXISTS "approved_beds" integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "review_required" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "review_reason" text,
    ADD COLUMN IF NOT EXISTS "rejection_reason" text;
  `);
  console.log("✓ Added 'approved_beds', 'review_required', 'review_reason', 'rejection_reason' columns to dispatch_requests");

  // Sync existing ACCEPTED requests so approved_beds equals requested_beds
  await db.execute(sql`
    UPDATE "dispatch_requests"
    SET "approved_beds" = "requested_beds"
    WHERE "status" = 'ACCEPTED' AND "approved_beds" = 0;
  `);
  console.log("✓ Backfilled approved_beds for existing ACCEPTED requests");

  // Create dispatch_activities table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dispatch_activities" (
      "id" text PRIMARY KEY,
      "dispatch_id" text NOT NULL REFERENCES "dispatch_requests"("id") ON DELETE CASCADE,
      "timestamp" timestamp(6) with time zone NOT NULL,
      "actor_type" varchar(50) NOT NULL,
      "actor_name" text,
      "action" varchar(100) NOT NULL,
      "details" text,
      "old_value" text,
      "new_value" text,
      "note" text,
      "created_at" timestamp(6) with time zone NOT NULL
    );
  `);
  console.log("✓ Created 'dispatch_activities' table");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "dispatch_activities_dispatchId_idx" ON "dispatch_activities" ("dispatch_id");
    CREATE INDEX IF NOT EXISTS "dispatch_activities_timestamp_idx" ON "dispatch_activities" ("timestamp");
  `);
  console.log("✓ Created indices on dispatch_activities");

  console.log("🎉 Request modification & activity migration completed successfully.");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
