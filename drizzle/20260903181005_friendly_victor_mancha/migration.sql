CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp(6) with time zone,
	"refresh_token_expires_at" timestamp(6) with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bed_categories" (
	"id" text PRIMARY KEY,
	"hospital_id" text NOT NULL,
	"category_code" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"total_beds" integer DEFAULT 0 NOT NULL,
	"available_beds" integer DEFAULT 0 NOT NULL,
	"occupied_beds" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_requests" (
	"id" text PRIMARY KEY,
	"hospital_id" text NOT NULL,
	"ambulance_unit" text NOT NULL,
	"ambulance_lat" double precision,
	"ambulance_lng" double precision,
	"patient_ref" text,
	"bed_category_code" varchar(50) NOT NULL,
	"requested_beds" integer DEFAULT 1 NOT NULL,
	"eta_minutes" integer NOT NULL,
	"patient_condition" text NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"phone" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "bed_categories_hospitalId_idx" ON "bed_categories" ("hospital_id");--> statement-breakpoint
CREATE INDEX "dispatch_requests_hospitalId_idx" ON "dispatch_requests" ("hospital_id");--> statement-breakpoint
CREATE INDEX "hospitals_userId_idx" ON "hospitals" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bed_categories" ADD CONSTRAINT "bed_categories_hospital_id_hospitals_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD CONSTRAINT "dispatch_requests_hospital_id_hospitals_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;