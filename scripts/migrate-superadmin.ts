import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function runSuperAdminMigration() {
  console.log("Applying SUPER_ADMIN schema updates (user.role, hospitals.status, audit_logs)...");

  // 1. Add role column to user table
  await db.execute(sql`
    ALTER TABLE "user" 
    ADD COLUMN IF NOT EXISTS "role" varchar(50) DEFAULT 'USER' NOT NULL;
  `);
  console.log("✓ Added 'role' column to user table");

  // 2. Add status column to hospitals table
  await db.execute(sql`
    ALTER TABLE "hospitals" 
    ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL;
  `);
  console.log("✓ Added 'status' column to hospitals table");

  // 3. Create audit_logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" text PRIMARY KEY,
      "user_id" text,
      "action" varchar(100) NOT NULL,
      "resource_type" varchar(100) NOT NULL,
      "resource_id" text,
      "details" text,
      "ip_address" text,
      "created_at" timestamp(6) with time zone NOT NULL
    );
  `);
  console.log("✓ Created audit_logs table");

  // 4. Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs" ("user_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs" ("created_at");
  `);
  console.log("✓ Created audit_logs indexes");

  // 5. Foreign key constraint
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_user_id_fkey'
      ) THEN
        ALTER TABLE "audit_logs" 
        ADD CONSTRAINT "audit_logs_user_id_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  console.log("✓ Configured foreign key constraint on audit_logs");

  console.log("SuperAdmin migration applied successfully!");
  process.exit(0);
}

runSuperAdminMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
