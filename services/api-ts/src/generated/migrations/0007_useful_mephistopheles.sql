CREATE TYPE "public"."check_in_method" AS ENUM('qr', 'manual');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('confirmed', 'waitlisted', 'cancelled', 'refunded', 'noShow');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('enrolled', 'completed', 'cancelled', 'noShow');--> statement-breakpoint
CREATE TYPE "public"."training_status" AS ENUM('draft', 'published', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "check_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"method" "check_in_method" NOT NULL,
	"checked_in_at" timestamp DEFAULT now() NOT NULL,
	"checked_in_by" uuid
);
--> statement-breakpoint
CREATE TABLE "event_registration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'confirmed' NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"refunded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"location" varchar(500),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"capacity" integer,
	"registration_fee" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'PHP',
	"credit_bearing" boolean DEFAULT false,
	"credit_amount" integer DEFAULT 0,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"promoted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "course_enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"progress" real DEFAULT 0,
	"completed_at" timestamp,
	"status" "enrollment_status" DEFAULT 'enrolled' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"credit_amount" integer DEFAULT 0,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"score" real,
	"max_score" real,
	"passed" boolean,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"answers" jsonb
);
--> statement-breakpoint
CREATE TABLE "training_enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"training_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'enrolled' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "training" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"instructor_name" varchar(200),
	"instructor_id" uuid,
	"location" varchar(500),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"capacity" integer,
	"registration_fee" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'PHP',
	"credit_bearing" boolean DEFAULT false,
	"credit_amount" integer DEFAULT 0,
	"status" "training_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_checkin_event" ON "check_in" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_checkin_person" ON "check_in" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_event_reg_event" ON "event_registration" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_reg_person" ON "event_registration" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_event_tenant" ON "event" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_event_org" ON "event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_event_status" ON "event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_event_start" ON "event" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_waitlist_event" ON "waitlist_entry" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_course_enroll_course" ON "course_enrollment" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_course_enroll_person" ON "course_enrollment" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_course_tenant" ON "course" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_course_org" ON "course" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_course" ON "quiz_attempt" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_person" ON "quiz_attempt" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_training_enroll_training" ON "training_enrollment" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "idx_training_enroll_person" ON "training_enrollment" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_training_tenant" ON "training" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_training_org" ON "training" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_training_status" ON "training" USING btree ("status");