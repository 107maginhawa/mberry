ALTER TYPE "public"."membership_status" ADD VALUE 'resigned';--> statement-breakpoint
ALTER TYPE "public"."membership_status" ADD VALUE 'deceased';--> statement-breakpoint
ALTER TYPE "public"."membership_status" ADD VALUE 'expelled';--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "date_of_death" date;