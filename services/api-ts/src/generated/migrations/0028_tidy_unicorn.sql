ALTER TABLE "election_nominee" ALTER COLUMN "position_id" SET DATA TYPE uuid USING "position_id"::uuid;--> statement-breakpoint
ALTER TABLE "election_vote" ALTER COLUMN "position_id" SET DATA TYPE uuid USING "position_id"::uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "election_nominee" ADD CONSTRAINT "election_nominee_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_position_id_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."position"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "officer_term" ADD CONSTRAINT "officer_term_date_order" CHECK ("officer_term"."end_date" IS NULL OR "officer_term"."end_date" > "officer_term"."start_date");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "booking_event" ADD CONSTRAINT "booking_events_effective_date_order" CHECK ("booking_event"."effective_to" IS NULL OR "booking_event"."effective_to" > "booking_event"."effective_from");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_slot" ADD CONSTRAINT "time_slots_time_order_check" CHECK ("time_slot"."end_time" > "time_slot"."start_time");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "election" ADD CONSTRAINT "election_nominations_date_order" CHECK ("election"."nominations_close_at" IS NULL OR "election"."nominations_open_at" IS NULL OR "election"."nominations_close_at" > "election"."nominations_open_at");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "election" ADD CONSTRAINT "election_voting_date_order" CHECK ("election"."voting_close_at" IS NULL OR "election"."voting_open_at" IS NULL OR "election"."voting_close_at" > "election"."voting_open_at");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "election" ADD CONSTRAINT "election_nominations_before_voting" CHECK ("election"."voting_open_at" IS NULL OR "election"."nominations_close_at" IS NULL OR "election"."voting_open_at" >= "election"."nominations_close_at");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;