/**
 * Batch F (AHA Documents & Credentials, Q8 = Option A) — certificate schema +
 * migration 0069 regression guard.
 *
 * A live-Postgres insert test that proves (a) two distinct real trainingIds for
 * the same person both insert, (b) a duplicate (real trainingId, personId)
 * rejects, and (c) multiple NULL-trainingId rows for the same person coexist
 * requires a real DB harness — none exists in this repo's unit suite (handlers
 * are tested against mock DBs). So we lock the behavior at two lower levels that
 * DO run here:
 *   1. schema shape — trainingId is nullable, certificateType exists;
 *   2. migration DDL — 0069 NULLs bogus rows, drops the old full UNIQUE, and
 *      recreates uniqueness as a PARTIAL unique index WHERE training_id IS NOT NULL.
 * Together these prove the partial-uniqueness semantics are wired; the live
 * insert assertions are documented as [BLOCKED BY ENVIRONMENT] in the fix report.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { certificates } from './certificates.schema';

const MIGRATION = readFileSync(
  join(import.meta.dir, '../../../../generated/migrations/0069_certificate_training_nullable_partial_unique.sql'),
  'utf8',
);

describe('certificate schema — Q8 Option A (nullable trainingId + partial unique)', () => {
  test('trainingId column is nullable', () => {
    expect(certificates.trainingId.notNull).toBe(false);
  });

  test('personId column stays NOT NULL (only trainingId relaxed)', () => {
    expect(certificates.personId.notNull).toBe(true);
  });

  test('certificateType column is persisted on the table', () => {
    expect(certificates.certificateType).toBeDefined();
    expect(certificates.certificateType.name).toBe('certificate_type');
  });
});

describe('migration 0069 — certificate trainingId nullable + partial unique', () => {
  test('makes training_id nullable', () => {
    expect(MIGRATION).toMatch(/ALTER COLUMN "training_id" DROP NOT NULL/);
  });

  test('NULLs out bogus self-reference rows (training_id == organization_id)', () => {
    expect(MIGRATION).toMatch(
      /UPDATE "certificate" SET "training_id" = NULL WHERE "training_id" = "organization_id"/,
    );
  });

  test('drops the old full UNIQUE constraint', () => {
    expect(MIGRATION).toMatch(
      /DROP CONSTRAINT IF EXISTS "certificate_training_person_unique"/,
    );
  });

  test('recreates uniqueness as a PARTIAL unique index WHERE training_id IS NOT NULL', () => {
    expect(MIGRATION).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "certificate_training_person_unique"/);
    expect(MIGRATION).toMatch(/WHERE "training_id" IS NOT NULL/);
  });

  test('adds the certificate_type column', () => {
    expect(MIGRATION).toMatch(/ADD COLUMN IF NOT EXISTS "certificate_type" varchar\(20\)/);
  });
});
