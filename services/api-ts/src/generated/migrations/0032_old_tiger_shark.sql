CREATE TABLE "membership_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"from_status" "membership_status",
	"to_status" "membership_status" NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dues_payment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"from_status" "dues_payment_status",
	"to_status" "dues_payment_status" NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_membership_id_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."membership"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_changed_by_person_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ADD CONSTRAINT "dues_payment_status_history_payment_id_dues_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."dues_payment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ADD CONSTRAINT "dues_payment_status_history_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ADD CONSTRAINT "dues_payment_status_history_changed_by_person_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_status_history_org_idx" ON "membership_status_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "membership_status_history_membership_idx" ON "membership_status_history" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "membership_status_history_person_idx" ON "membership_status_history" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "membership_status_history_changed_at_idx" ON "membership_status_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "dues_payment_status_history_org_idx" ON "dues_payment_status_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dues_payment_status_history_payment_idx" ON "dues_payment_status_history" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "dues_payment_status_history_person_idx" ON "dues_payment_status_history" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "dues_payment_status_history_changed_at_idx" ON "dues_payment_status_history" USING btree ("changed_at");