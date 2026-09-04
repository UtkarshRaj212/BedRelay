CREATE TABLE "hospital_invitations" (
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
--> statement-breakpoint
CREATE TABLE "hospital_memberships" (
	"id" text PRIMARY KEY,
	"hospital_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(50) DEFAULT 'HOSPITAL_STAFF' NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hospital_invitations_hospitalId_idx" ON "hospital_invitations" ("hospital_id");--> statement-breakpoint
CREATE INDEX "hospital_invitations_code_idx" ON "hospital_invitations" ("code");--> statement-breakpoint
CREATE INDEX "hospital_invitations_email_idx" ON "hospital_invitations" ("email");--> statement-breakpoint
CREATE INDEX "hospital_memberships_hospitalId_idx" ON "hospital_memberships" ("hospital_id");--> statement-breakpoint
CREATE INDEX "hospital_memberships_userId_idx" ON "hospital_memberships" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hospital_memberships_hospital_user_uidx" ON "hospital_memberships" ("hospital_id","user_id");--> statement-breakpoint
ALTER TABLE "hospital_invitations" ADD CONSTRAINT "hospital_invitations_hospital_id_hospitals_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "hospital_invitations" ADD CONSTRAINT "hospital_invitations_invited_by_user_id_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "hospital_memberships" ADD CONSTRAINT "hospital_memberships_hospital_id_hospitals_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "hospital_memberships" ADD CONSTRAINT "hospital_memberships_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;