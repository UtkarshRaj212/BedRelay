import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Applying hospital onboarding & staff management migration...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "hospital_memberships" (
      "id" text PRIMARY KEY,
      "hospital_id" text NOT NULL,
      "user_id" text NOT NULL,
      "role" varchar(50) DEFAULT 'HOSPITAL_STAFF' NOT NULL,
      "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
      "created_at" timestamp(6) with time zone NOT NULL,
      "updated_at" timestamp(6) with time zone NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "hospital_invitations" (
      "id" text PRIMARY KEY,
      "hospital_id" text NOT NULL,
      "code" varchar(50) NOT NULL UNIQUE,
      "email" varchar(255),
      "role" varchar(50) DEFAULT 'HOSPITAL_STAFF' NOT NULL,
      "invited_by_user_id" text,
      "status" varchar(50) DEFAULT 'PENDING' NOT NULL,
      "expires_at" timestamp(6) with time zone NOT NULL,
      "created_at" timestamp(6) with time zone NOT NULL,
      "updated_at" timestamp(6) with time zone NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hospital_memberships_hospitalId_idx" ON "hospital_memberships" ("hospital_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hospital_memberships_userId_idx" ON "hospital_memberships" ("user_id");
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "hospital_memberships_hospital_user_uidx" ON "hospital_memberships" ("hospital_id", "user_id");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hospital_invitations_hospitalId_idx" ON "hospital_invitations" ("hospital_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hospital_invitations_code_idx" ON "hospital_invitations" ("code");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hospital_invitations_email_idx" ON "hospital_invitations" ("email");
  `);

  // Foreign keys
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hospital_memberships_hospital_id_hospitals_id_fkey'
      ) THEN
        ALTER TABLE "hospital_memberships" 
        ADD CONSTRAINT "hospital_memberships_hospital_id_hospitals_id_fkey" 
        FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hospital_memberships_user_id_user_id_fkey'
      ) THEN
        ALTER TABLE "hospital_memberships" 
        ADD CONSTRAINT "hospital_memberships_user_id_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hospital_invitations_hospital_id_hospitals_id_fkey'
      ) THEN
        ALTER TABLE "hospital_invitations" 
        ADD CONSTRAINT "hospital_invitations_hospital_id_hospitals_id_fkey" 
        FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hospital_invitations_invited_by_user_id_user_id_fkey'
      ) THEN
        ALTER TABLE "hospital_invitations" 
        ADD CONSTRAINT "hospital_invitations_invited_by_user_id_user_id_fkey" 
        FOREIGN KEY ("invited_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  console.log("Migration executed successfully!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
