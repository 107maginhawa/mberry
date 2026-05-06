-- Migration 0015: Standardize enum values to camelCase (D-10)
-- Pre-launch rename: no data loss risk.

-- election_status: multi-word values -> camelCase
ALTER TYPE "public"."election_status" RENAME VALUE 'nominations_open' TO 'nominationsOpen';
ALTER TYPE "public"."election_status" RENAME VALUE 'voting_open' TO 'votingOpen';
ALTER TYPE "public"."election_status" RENAME VALUE 'awaiting_confirmation' TO 'awaitingConfirmation';

-- voting_mode: in_person -> inPerson
ALTER TYPE "public"."voting_mode" RENAME VALUE 'in_person' TO 'inPerson';

-- dues_payment_method: bank_transfer -> bankTransfer
ALTER TYPE "public"."dues_payment_method" RENAME VALUE 'bank_transfer' TO 'bankTransfer';

-- dues_payment_status: partially_refunded -> partiallyRefunded
ALTER TYPE "public"."dues_payment_status" RENAME VALUE 'partially_refunded' TO 'partiallyRefunded';

-- announcement_status: scheduled_failed -> scheduledFailed
ALTER TYPE "public"."announcement_status" RENAME VALUE 'scheduled_failed' TO 'scheduledFailed';

-- event_type: multi-word values -> camelCase
ALTER TYPE "public"."event_type" RENAME VALUE 'general_assembly' TO 'generalAssembly';
ALTER TYPE "public"."event_type" RENAME VALUE 'induction_ceremony' TO 'inductionCeremony';
ALTER TYPE "public"."event_type" RENAME VALUE 'medical_mission' TO 'medicalMission';
ALTER TYPE "public"."event_type" RENAME VALUE 'board_meeting' TO 'boardMeeting';
ALTER TYPE "public"."event_type" RENAME VALUE 'committee_meeting' TO 'committeeMeeting';
