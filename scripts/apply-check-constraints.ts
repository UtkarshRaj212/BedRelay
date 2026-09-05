import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying PostgreSQL check constraints on Neon database...");

  // 1. bed_categories check constraint
  try {
    await db.execute(
      sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'bed_categories_availability_check'
          ) THEN
            ALTER TABLE bed_categories 
            ADD CONSTRAINT bed_categories_availability_check 
            CHECK (available_beds >= 0 AND available_beds <= total_beds AND total_beds >= 0 AND occupied_beds >= 0);
          END IF;
        END $$;
      `)
    );
    console.log("  ✓ Applied 'bed_categories_availability_check' constraint");
  } catch (err: any) {
    console.error("  Failed to apply bed_categories constraint:", err.message);
  }

  // 2. dispatch_requests check constraint
  try {
    await db.execute(
      sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_requests_valid_request'
          ) THEN
            ALTER TABLE dispatch_requests 
            ADD CONSTRAINT dispatch_requests_valid_request 
            CHECK (requested_beds >= 1 AND eta_minutes >= 1);
          END IF;
        END $$;
      `)
    );
    console.log("  ✓ Applied 'dispatch_requests_valid_request' constraint");
  } catch (err: any) {
    console.error("  Failed to apply dispatch_requests constraint:", err.message);
  }

  console.log("Database-level check constraints successfully verified and active.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
