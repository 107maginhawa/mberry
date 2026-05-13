CREATE TABLE "dues_reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"schedule_id" uuid,
	"dues_config_id" uuid NOT NULL,
	"period_key" varchar(20) NOT NULL,
	"days_offset" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"notification_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dues_reminder_log_idempotency" UNIQUE("person_id","schedule_id","period_key","days_offset")
);
--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_customer_person_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_merchant_person_id_fk";
--> statement-breakpoint
ALTER TABLE "merchant_account" DROP CONSTRAINT "merchant_account_person_person_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_event" DROP CONSTRAINT "booking_event_owner_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "booking" DROP CONSTRAINT "booking_client_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "booking" DROP CONSTRAINT "booking_host_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "schedule_exception" DROP CONSTRAINT "schedule_exception_owner_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "time_slot" DROP CONSTRAINT "time_slot_owner_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "certificate" DROP CONSTRAINT "certificate_person_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "dues_payment" DROP CONSTRAINT "dues_payment_person_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "review" DROP CONSTRAINT "review_reviewer_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "review" DROP CONSTRAINT "review_reviewed_entity_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "election_nominee" ALTER COLUMN "position_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "election_vote" ALTER COLUMN "position_id" SET DATA TYPE uuid;--> statement-breakpoint
CREATE INDEX "dues_reminder_log_org_idx" ON "dues_reminder_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dues_reminder_log_person_idx" ON "dues_reminder_log" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_person_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_merchant_person_id_fk" FOREIGN KEY ("merchant") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_account" ADD CONSTRAINT "merchant_account_person_person_id_fk" FOREIGN KEY ("person") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_owner_id_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_client_id_person_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_host_id_person_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exception" ADD CONSTRAINT "schedule_exception_owner_id_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slot" ADD CONSTRAINT "time_slot_owner_id_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_payment" ADD CONSTRAINT "dues_payment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_nominee" ADD CONSTRAINT "election_nominee_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_id_person_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewed_entity_id_person_id_fk" FOREIGN KEY ("reviewed_entity_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_events_effective_date_order" CHECK ("booking_event"."effective_to" IS NULL OR "booking_event"."effective_to" > "booking_event"."effective_from");--> statement-breakpoint
ALTER TABLE "time_slot" ADD CONSTRAINT "time_slots_time_order_check" CHECK ("time_slot"."end_time" > "time_slot"."start_time");--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_nominations_date_order" CHECK ("election"."nominations_close_at" IS NULL OR "election"."nominations_open_at" IS NULL OR "election"."nominations_close_at" > "election"."nominations_open_at");--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_voting_date_order" CHECK ("election"."voting_close_at" IS NULL OR "election"."voting_open_at" IS NULL OR "election"."voting_close_at" > "election"."voting_open_at");--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_nominations_before_voting" CHECK ("election"."voting_open_at" IS NULL OR "election"."nominations_close_at" IS NULL OR "election"."voting_open_at" >= "election"."nominations_close_at");