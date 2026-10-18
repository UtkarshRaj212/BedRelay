CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" text,
	"details" text,
	"ip_address" text,
	"created_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_activities" (
	"id" text PRIMARY KEY,
	"dispatch_id" text NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp(6) with time zone
);
--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "dispatcher_session_id" text;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "ambulance_id" text;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "patient_reference" text;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "approved_beds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "review_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" varchar(50) DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "dispatch_activities_dispatchId_idx" ON "dispatch_activities" ("dispatch_id");--> statement-breakpoint
CREATE INDEX "dispatch_activities_timestamp_idx" ON "dispatch_activities" ("timestamp");--> statement-breakpoint
CREATE INDEX "dispatch_requests_dispatcherSessionId_idx" ON "dispatch_requests" ("dispatcher_session_id");--> statement-breakpoint
CREATE INDEX "two_factor_userId_idx" ON "two_factor" ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" ("secret");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "dispatch_activities" ADD CONSTRAINT "dispatch_activities_dispatch_id_dispatch_requests_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatch_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bed_categories" ADD CONSTRAINT "bed_categories_availability_check" CHECK (available_beds >= 0 AND available_beds <= total_beds AND total_beds >= 0 AND occupied_beds >= 0);--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD CONSTRAINT "dispatch_requests_valid_request" CHECK (requested_beds >= 1 AND eta_minutes >= 1 AND approved_beds >= 0 AND approved_beds <= requested_beds);