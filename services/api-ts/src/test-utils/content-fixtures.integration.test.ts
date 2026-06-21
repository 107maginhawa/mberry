/**
 * Self-test for the shared B2 "content" real-PG fixture (content-fixtures.ts):
 * proves seedPerson / seedMembership / seedReview round-trip against real
 * Postgres and that the reachability guard is honored. Skips cleanly when DB
 * unreachable. (Wave-2 cluster B2, reviews Slice 1.)
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  seedOrg,
  seedPerson,
  seedMembership,
  seedReview,
  CONTENT_ORG,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

describe('content-fixtures — shared B2 real-PG seed helpers', () => {
  test('createContentScratch returns a reachability-guarded handle', () => {
    expect(typeof H.dbReachable).toBe('boolean');
  });

  test('seedOrg returns the stable CONTENT_ORG uuid', () => {
    expect(seedOrg()).toBe(CONTENT_ORG);
    // a passed id is echoed back (for cross-org seeding)
    const other = '00000000-0000-4000-8000-0000000000b2';
    expect(seedOrg(other)).toBe(other);
  });

  test('seedPerson persists and round-trips first_name', async () => {
    if (!H.dbReachable) return;
    const p = await seedPerson(H, { firstName: 'Ada' });
    const { rows } = await H.scopedPool.query(
      `SELECT first_name FROM "${H.schema}".person WHERE id = $1`,
      [p.id],
    );
    expect(rows[0].first_name).toBe('Ada');
  });

  test('seedMembership persists active status + person_id (overriding the pendingPayment default)', async () => {
    if (!H.dbReachable) return;
    const p = await seedPerson(H);
    const m = await seedMembership(H, { personId: p.id });
    const { rows } = await H.scopedPool.query(
      `SELECT status, person_id, organization_id FROM "${H.schema}".membership WHERE id = $1`,
      [m.id],
    );
    expect(rows[0].status).toBe('active');
    expect(rows[0].person_id).toBe(p.id);
    expect(rows[0].organization_id).toBe(CONTENT_ORG);
  });

  test('seedReview persists and round-trips nps_score', async () => {
    if (!H.dbReachable) return;
    const r = await seedReview(H, { npsScore: 8 });
    const { rows } = await H.scopedPool.query(
      `SELECT nps_score FROM "${H.schema}".review WHERE id = $1`,
      [r.id],
    );
    expect(rows[0].nps_score).toBe(8);
  });
});
