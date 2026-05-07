-- Migration 0015: Standardize enum values to camelCase (D-10)
-- Pre-launch rename: no data loss risk.
-- Guards: each rename wrapped to skip if enum or old value doesn't exist.

-- Helper: rename enum value only if old value exists and new doesn't
-- election_status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='election_status' AND e.enumlabel='nominations_open')
  THEN ALTER TYPE "public"."election_status" RENAME VALUE 'nominations_open' TO 'nominationsOpen';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='election_status' AND e.enumlabel='voting_open')
  THEN ALTER TYPE "public"."election_status" RENAME VALUE 'voting_open' TO 'votingOpen';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='election_status' AND e.enumlabel='awaiting_confirmation')
  THEN ALTER TYPE "public"."election_status" RENAME VALUE 'awaiting_confirmation' TO 'awaitingConfirmation';
  END IF;
END $$;

-- voting_mode
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='voting_mode' AND e.enumlabel='in_person')
  THEN ALTER TYPE "public"."voting_mode" RENAME VALUE 'in_person' TO 'inPerson';
  END IF;
END $$;

-- dues_payment_method
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='dues_payment_method' AND e.enumlabel='bank_transfer')
  THEN ALTER TYPE "public"."dues_payment_method" RENAME VALUE 'bank_transfer' TO 'bankTransfer';
  END IF;
END $$;

-- dues_payment_status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='dues_payment_status' AND e.enumlabel='partially_refunded')
  THEN ALTER TYPE "public"."dues_payment_status" RENAME VALUE 'partially_refunded' TO 'partiallyRefunded';
  END IF;
END $$;

-- announcement_status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='announcement_status' AND e.enumlabel='scheduled_failed')
  THEN ALTER TYPE "public"."announcement_status" RENAME VALUE 'scheduled_failed' TO 'scheduledFailed';
  END IF;
END $$;

-- event_type (may not exist yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='event_type' AND e.enumlabel='general_assembly')
  THEN ALTER TYPE "public"."event_type" RENAME VALUE 'general_assembly' TO 'generalAssembly';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='event_type' AND e.enumlabel='induction_ceremony')
  THEN ALTER TYPE "public"."event_type" RENAME VALUE 'induction_ceremony' TO 'inductionCeremony';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='event_type' AND e.enumlabel='medical_mission')
  THEN ALTER TYPE "public"."event_type" RENAME VALUE 'medical_mission' TO 'medicalMission';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='event_type' AND e.enumlabel='board_meeting')
  THEN ALTER TYPE "public"."event_type" RENAME VALUE 'board_meeting' TO 'boardMeeting';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='event_type' AND e.enumlabel='committee_meeting')
  THEN ALTER TYPE "public"."event_type" RENAME VALUE 'committee_meeting' TO 'committeeMeeting';
  END IF;
END $$;
