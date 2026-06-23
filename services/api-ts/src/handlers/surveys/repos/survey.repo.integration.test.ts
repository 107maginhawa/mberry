/**
 * SurveyRepository — real-PG depth (R4-3).
 *
 * The Wave-2 B2 content pass left survey.repo.ts's lifecycle methods UNSCOPED
 * (publish / close / closeExpiredSurvey / deleteDraft / update / analytics /
 * findManyWithPagination), pinning the surveys coverage floor at 30%. This drives
 * those methods against a `createContentScratch` schema, proving each status
 * transition + its guard against persisted rows, so the floor can rise to 50%.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedSurvey,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { SurveyRepository } from './survey.repo';

let H: ScratchDb;

beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

function repo(): SurveyRepository {
  return new SurveyRepository(H.db as never);
}
async function statusOf(id: string): Promise<string | undefined> {
  const { rows } = await H.scopedPool.query<{ status: string }>(
    `SELECT status FROM "${H.schema}".survey WHERE id=$1`, [id]);
  return rows[0]?.status;
}

describe('SurveyRepository lifecycle (real PG)', () => {
  const ACTOR = crypto.randomUUID();

  test('publish: a draft survey flips to active (updatedBy stamped)', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'draft' });
    const published = await repo().publish(s.id, ACTOR);
    expect(published?.status).toBe('active');
    expect(published?.updatedBy).toBe(ACTOR);
    expect(await statusOf(s.id)).toBe('active');
  });

  test('publish: a non-draft survey is a no-op (guard returns undefined)', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    expect(await repo().publish(s.id, ACTOR)).toBeUndefined();
    expect(await statusOf(s.id)).toBe('active');
  });

  test('close: an active survey flips to closed', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const closed = await repo().close(s.id, ACTOR);
    expect(closed?.status).toBe('closed');
    expect(await statusOf(s.id)).toBe('closed');
  });

  test('close: a non-active survey is a no-op (cannot close a draft)', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'draft' });
    expect(await repo().close(s.id, ACTOR)).toBeUndefined();
    expect(await statusOf(s.id)).toBe('draft');
  });

  test('closeExpiredSurvey: active→closed without stamping updatedBy', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const closed = await repo().closeExpiredSurvey(s.id);
    expect(closed?.status).toBe('closed');
    // System close leaves updatedBy null (no person actor).
    expect(closed?.updatedBy).toBeNull();
  });

  test('deleteDraft: removes a draft, but refuses an active survey', async () => {
    if (!H.dbReachable) return;
    const draft = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'draft' });
    expect(await repo().deleteDraft(draft.id)).toBe(true);
    expect(await statusOf(draft.id)).toBeUndefined();

    const active = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    expect(await repo().deleteDraft(active.id)).toBe(false);
    expect(await statusOf(active.id)).toBe('active');
  });

  test('updateAnalyticsSnapshot: persists the snapshot jsonb', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    await repo().updateAnalyticsSnapshot(s.id, { responseCount: 7 } as never);
    const { rows } = await H.scopedPool.query<{ analytics_snapshot: { responseCount: number } }>(
      `SELECT analytics_snapshot FROM "${H.schema}".survey WHERE id=$1`, [s.id]);
    expect(rows[0]?.analytics_snapshot?.responseCount).toBe(7);
  });

  test('findManyWithPagination: org-scoped page of surveys with total count', async () => {
    if (!H.dbReachable) return;
    // A dedicated org so the count is exactly what this test seeds.
    const org = '00000000-0000-4000-8000-0000000b8601';
    for (let i = 0; i < 3; i++) await seedSurvey(H, { organizationId: org, status: 'active' });
    const page = await repo().findManyWithPagination(
      { organizationId: org } as never,
      { pagination: { offset: 0, limit: 2 } },
    );
    expect(page.totalCount).toBe(3);
    expect(page.data.length).toBe(2);
    expect(page.data.every((s: { organizationId: string }) => s.organizationId === org)).toBe(true);
  });
});
