-- Phase 3 Data Model Unification — D-10: Standardize enum values to camelCase.
-- Pre-launch assumption (A4): safe to rename enum values atomically.
-- Run AFTER 0014_data_model_unification.sql.

-- dues_payment_method: bank_transfer → bankTransfer
ALTER TYPE dues_payment_method RENAME VALUE 'bank_transfer' TO 'bankTransfer';

-- dues_payment_status: partially_refunded → partiallyRefunded
ALTER TYPE dues_payment_status RENAME VALUE 'partially_refunded' TO 'partiallyRefunded';

-- announcement_status: scheduled_failed → scheduledFailed
ALTER TYPE announcement_status RENAME VALUE 'scheduled_failed' TO 'scheduledFailed';

-- election_status: multi-word values → camelCase
ALTER TYPE election_status RENAME VALUE 'nominations_open' TO 'nominationsOpen';
ALTER TYPE election_status RENAME VALUE 'voting_open' TO 'votingOpen';
ALTER TYPE election_status RENAME VALUE 'awaiting_confirmation' TO 'awaitingConfirmation';

-- voting_mode: in_person → inPerson
ALTER TYPE voting_mode RENAME VALUE 'in_person' TO 'inPerson';

-- event_type: multi-word values → camelCase
ALTER TYPE event_type RENAME VALUE 'general_assembly' TO 'generalAssembly';
ALTER TYPE event_type RENAME VALUE 'induction_ceremony' TO 'inductionCeremony';
ALTER TYPE event_type RENAME VALUE 'medical_mission' TO 'medicalMission';
ALTER TYPE event_type RENAME VALUE 'board_meeting' TO 'boardMeeting';
ALTER TYPE event_type RENAME VALUE 'committee_meeting' TO 'committeeMeeting';
