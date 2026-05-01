CREATE TYPE "public"."admin_role" AS ENUM('super', 'support', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."org_lifecycle_status" AS ENUM('trial', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('chapter', 'society', 'national', 'clinic');--> statement-breakpoint
CREATE TABLE "association" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"name" varchar(255) NOT NULL,
	"country" varchar(2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"locale" varchar(10) DEFAULT 'en',
	"license_format_regex" varchar(500),
	"credit_cycle_period" integer,
	"required_credits_per_cycle" integer,
	"carryover_enabled" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"module_name" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_override" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impersonation_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"admin_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"target_org_id" uuid,
	"session_token" varchar(255) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"association_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"org_type" "org_type" NOT NULL,
	"region" varchar(100),
	"contact_email" varchar(255),
	"status" "org_lifecycle_status" DEFAULT 'trial' NOT NULL,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"feature_flags" jsonb
);
--> statement-breakpoint
CREATE TABLE "platform_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(200) NOT NULL,
	"role" "admin_role" NOT NULL,
	CONSTRAINT "platform_admin_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "platform_admin_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_association_name" ON "association" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_association_country" ON "association" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_ff_target" ON "feature_flag" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ff_unique" ON "feature_flag" USING btree ("target_type","target_id","module_name");--> statement-breakpoint
CREATE INDEX "idx_impersonation_admin" ON "impersonation_session" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_impersonation_target" ON "impersonation_session" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_org_association" ON "organization" USING btree ("association_id");--> statement-breakpoint
CREATE INDEX "idx_org_status" ON "organization" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_name_association" ON "organization" USING btree ("name","association_id");