ALTER TABLE "membership" ALTER COLUMN "dues_expiry_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "suspended_at" timestamp;