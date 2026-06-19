-- ISSUE-030: reconcile the event_type enum. The API validator + frontend Select
-- use 7 canonical values (assembly, seminar, social, networking, fundraiser,
-- governance, custom) but the DB enum only had 8 legacy values
-- (generalAssembly, inductionCeremony, fellowship, medicalMission, boardMeeting,
-- committeeMeeting, fundraiser, other). Overlap was only 'fundraiser', so
-- createEvent silently dropped eventType (defaulted 'other') and updateEvent 500'd
-- (22P02 invalid input value for enum). Add the 6 missing canonical values
-- additively (legacy rows keep their values). IF NOT EXISTS keeps it idempotent.
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'assembly';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'seminar';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'social';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'networking';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'governance';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'custom';
