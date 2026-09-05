import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Applying dispatcher_session_id migration to Neon Postgres...");

  await db.execute(sql`
    ALTER TABLE "dispatch_requests" 
    ADD COLUMN IF NOT EXISTS "dispatcher_session_id" text;
  `);
  console.log("✓ Added 'dispatcher_session_id' column to dispatch_requests");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "dispatch_requests_dispatcherSessionId_idx" 
    ON "dispatch_requests" ("dispatcher_session_id");
  `);
  console.log("✓ Created index on dispatch_requests(dispatcher_session_id)");

  console.log("🎉 Migration completed successfully.");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
