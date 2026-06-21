/**
 * Characterization suite (B1 follow-up item4 — waitlist-org-notnull).
 *
 * NO BUG: waitlist_entry.organization_id is already NOT NULL in the live DB
 * (information_schema is_nullable='NO') and the Drizzle schema agrees
 * (events.schema.ts → waitlistEntries.organizationId .notNull()). No drift,
 * no migration. This suite LOCKS the invariant: a future nullable regression
 * (dropping .notNull() + migration) flips the suite red.
 *
 * Real-PG via createScratch (LIKE … INCLUDING ALL copies the NOT NULL constraint).
 * Raw inserts through scopedPool so we control exactly which columns are present:
 *   - omitting organization_id → Postgres 23502 (not_null_violation)
 *   - inserting WITH a valid org_id → succeeds + read-back returns it.
 * Mirrors the error-capture idiom in events.repo.integration.test.ts.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const ORG_A = '00000000-0000-4000-8000-0000000000a1';

beforeAll(async () => {
  H = await createScratch(['waitlist_entry']);
});
afterAll(async () => { await H?.teardown(); });

describe('waitlist_entry.organization_id — NOT NULL invariant (characterization)', () => {
  test('omitting organization_id raises Postgres 23502 (not_null_violation)', async () => {
    if (!H.dbReachable) return;
    // Fill every other NOT-NULL-no-default column (event_id, person_id, position);
    // id/created_at/updated_at/version all carry defaults. organization_id is the
    // ONLY column omitted — so a 23502 here can only be its NOT NULL constraint.
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".waitlist_entry (event_id, person_id, position)
         VALUES ($1, $2, $3)`,
        [crypto.randomUUID(), crypto.randomUUID(), 1],
      );
    } catch (e) {
      code = (e as { code?: string; cause?: { code?: string } }).code
        ?? (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(code).toBe('23502');
  });

  test('insert WITH a valid organization_id succeeds and read-back returns it', async () => {
    if (!H.dbReachable) return;
    const personId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".waitlist_entry (organization_id, event_id, person_id, position)
       VALUES ($1, $2, $3, $4)`,
      [ORG_A, eventId, personId, 1],
    );

    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".waitlist_entry WHERE person_id = $1`,
      [personId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].organization_id).toBe(ORG_A);
  });
});
