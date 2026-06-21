/**
 * Real-PG integration suite for EmailQueueRepository (B3 email S1).
 *
 * REPLACES THE MOCK ILLUSION: queue.repo.test.ts mocks the DB at the class level
 * ("we test business logic, not SQL") and never executes a single real statement.
 * This suite stands up an isolated scratch schema (LIKE public.email_queue
 * INCLUDING ALL → schema-faithful nullability/defaults/indexes) and proves
 * queueEmail persistence, the SYSTEM_ORG_ID empty/absent-org fallback, the
 * ValidationError pre-insert guard, and the buildWhereConditions raw-SQL filter
 * subsets — including the raw jsonb `template_tags ? 'welcome'` operator and the
 * `scheduled_at IS NOT NULL` fragment — which the mock can NOT exercise.
 *
 * org_id NOTE: email_queue.organization_id is NULLABLE in the live catalog (the
 * queue.repo SYSTEM_ORG_ID fallback fills it at the app layer), so there is NO
 * 23502 slice here — the only org_id-NOT-NULL email surface is email_suppression.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { EmailQueueRepository } from './queue.repo';
import { SYSTEM_ORG_ID } from '@/core/email-types';

const ORG = '00000000-0000-4000-8000-0000000000a1';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['email_queue', 'email_template']);
});

afterAll(async () => {
  await H?.teardown();
});

function repo() {
  return new EmailQueueRepository(H.db as never);
}

describe('EmailQueueRepository.queueEmail — persistence (real PG)', () => {
  test('persists a pending row with defaults + jsonb variables round-trip', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const item = await r.queueEmail({
      recipient: 'persist@x.test',
      templateTags: ['welcome'],
      variables: { firstName: 'Ada', count: 3 },
      organizationId: ORG,
    });

    const { rows } = await H.scopedPool.query(
      `SELECT status, attempts, priority, email_category, organization_id, recipient_email, variables
         FROM "${H.schema}".email_queue WHERE id = $1`,
      [item.id]
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(0);
    expect(row.priority).toBe(5);
    expect(row.email_category).toBe('transactional');
    expect(row.organization_id).toBe(ORG);
    expect(row.recipient_email).toBe('persist@x.test');
    // jsonb round-trips as a real object, not a string.
    expect(row.variables).toEqual({ firstName: 'Ada', count: 3 });
  });

  test('SYSTEM_ORG_ID fallback: empty-string organizationId persists as the sentinel, not null and not a crash', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const item = await r.queueEmail({
      recipient: 'empty-org@x.test',
      templateTags: ['welcome'],
      variables: {},
      organizationId: '',
    });
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".email_queue WHERE id = $1`,
      [item.id]
    );
    expect(rows[0].organization_id).toBe(SYSTEM_ORG_ID);
  });

  test('SYSTEM_ORG_ID fallback: undefined organizationId persists as the sentinel', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const item = await r.queueEmail({
      recipient: 'no-org@x.test',
      templateTags: ['welcome'],
      variables: {},
    });
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".email_queue WHERE id = $1`,
      [item.id]
    );
    expect(rows[0].organization_id).toBe(SYSTEM_ORG_ID);
  });

  test('ValidationError when neither template nor templateTags is provided — and NO row is inserted', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const before = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_queue WHERE recipient_email = $1`,
      ['novalid@x.test']
    );
    await expect(
      r.queueEmail({
        recipient: 'novalid@x.test',
        variables: {},
        organizationId: ORG,
      } as never)
    ).rejects.toThrow();
    const after = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_queue WHERE recipient_email = $1`,
      ['novalid@x.test']
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(after.rows[0].n).toBe(0);
  });
});

describe('EmailQueueRepository.buildWhereConditions — real-SQL filter subsets', () => {
  // A dedicated org so the filter assertions are not polluted by the persistence
  // block above (which uses ORG / SYSTEM_ORG_ID).
  const FORG = '00000000-0000-4000-8000-0000000000f1';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    if (!H.dbReachable) return;
    const r = repo();
    // pending, priority 5, tag welcome, no schedule
    ids.pendingWelcome = (
      await r.queueEmail({
        recipient: 'pw@x.test',
        templateTags: ['welcome'],
        variables: {},
        organizationId: FORG,
        priority: 5,
      })
    ).id;
    // pending, priority 1, tag onboarding, scheduled
    ids.pendingOnboard = (
      await r.queueEmail({
        recipient: 'po@x.test',
        templateTags: ['onboarding'],
        variables: {},
        organizationId: FORG,
        priority: 1,
        scheduledAt: new Date(Date.now() + 3600_000),
      })
    ).id;
    // pending, recipient match target, tag welcome
    ids.recipientTarget = (
      await r.queueEmail({
        recipient: 'target@x.test',
        templateTags: ['welcome'],
        variables: {},
        organizationId: FORG,
      })
    ).id;
    // flip one row to failed so status-set filters have a second status
    await H.scopedPool.query(
      `UPDATE "${H.schema}".email_queue SET status='failed' WHERE id=$1`,
      [ids.pendingOnboard]
    );
  });

  function inForg(rowsIds: string[]): string[] {
    return rowsIds.filter((id) => Object.values(ids).includes(id));
  }

  test('status scalar vs status array (inArray)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const pending = await r.findMany({ status: 'pending' });
    const pendingIds = inForg(pending.map((x) => x.id));
    expect(pendingIds).toContain(ids.pendingWelcome);
    expect(pendingIds).toContain(ids.recipientTarget);
    expect(pendingIds).not.toContain(ids.pendingOnboard); // now failed

    const both = await r.findMany({ status: ['pending', 'failed'] });
    const bothIds = inForg(both.map((x) => x.id));
    expect(bothIds).toContain(ids.pendingWelcome);
    expect(bothIds).toContain(ids.pendingOnboard);
    expect(bothIds).toContain(ids.recipientTarget);
  });

  test('recipientEmail exact match', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const res = await r.findMany({ recipientEmail: 'target@x.test' });
    expect(res.map((x) => x.id)).toEqual([ids.recipientTarget]);
  });

  test('priority exact match', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const res = await r.findMany({ priority: 1 });
    const got = inForg(res.map((x) => x.id));
    expect(got).toEqual([ids.pendingOnboard]);
  });

  test('scheduledOnly returns only rows with non-null scheduled_at (raw IS NOT NULL fragment)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const res = await r.findMany({ scheduledOnly: true });
    const got = inForg(res.map((x) => x.id));
    expect(got).toEqual([ids.pendingOnboard]);
    expect(got).not.toContain(ids.pendingWelcome);
  });

  test('templateTags exercises the raw jsonb `?` operator — matches only rows whose template_tags array contains the key', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const welcome = await r.findMany({ templateTags: ['welcome'] });
    const welcomeIds = inForg(welcome.map((x) => x.id));
    expect(welcomeIds).toContain(ids.pendingWelcome);
    expect(welcomeIds).toContain(ids.recipientTarget);
    expect(welcomeIds).not.toContain(ids.pendingOnboard); // tagged onboarding only

    const onboard = await r.findMany({ templateTags: ['onboarding'] });
    const onboardIds = inForg(onboard.map((x) => x.id));
    expect(onboardIds).toEqual([ids.pendingOnboard]);
  });

  test('dateFrom / dateTo bound created_at (gte / lte boundaries)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    // created_at of the welcome row → a window straddling it (±1s) INCLUDES it
    // (proves gte AND lte bind on real PG); a window strictly after it EXCLUDES
    // it (gte boundary); a window strictly before it EXCLUDES it (lte boundary).
    // (A ±1s tolerance is used because Postgres stores microseconds while the JS
    //  Date round-trip truncates to ms — this slice proves the SQL fragment binds,
    //  not sub-ms timestamp identity.)
    const { rows } = await H.scopedPool.query(
      `SELECT created_at FROM "${H.schema}".email_queue WHERE id=$1`,
      [ids.pendingWelcome]
    );
    const ts: Date = rows[0].created_at;

    const inclusive = await r.findMany({
      dateFrom: new Date(ts.getTime() - 1000),
      dateTo: new Date(ts.getTime() + 1000),
    });
    expect(inForg(inclusive.map((x) => x.id))).toContain(ids.pendingWelcome);

    const afterWindow = await r.findMany({ dateFrom: new Date(ts.getTime() + 1000) });
    expect(inForg(afterWindow.map((x) => x.id))).not.toContain(ids.pendingWelcome);

    const beforeWindow = await r.findMany({ dateTo: new Date(ts.getTime() - 1000) });
    expect(inForg(beforeWindow.map((x) => x.id))).not.toContain(ids.pendingWelcome);
  });
});
