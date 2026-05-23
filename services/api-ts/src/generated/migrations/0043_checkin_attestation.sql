-- Wave 2a S8: Add attestation JSONB to check_in table
-- Stores compliance metadata: officer ID, method, device info, timestamp
-- Check-in IS credit issuance — attestation records are compliance events

ALTER TABLE "check_in" ADD COLUMN IF NOT EXISTS "attestation" jsonb;
