DO $$ BEGIN
  ALTER TABLE "officer_term" ADD CONSTRAINT "officer_term_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "membership_application" ADD CONSTRAINT "membership_application_reviewed_by_person_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dues_category_override" ADD CONSTRAINT "dues_category_override_category_id_membership_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."membership_category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;