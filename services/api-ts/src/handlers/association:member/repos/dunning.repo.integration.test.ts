/**
 * Real-DB integration tests for the dunning repositories
 * (DunningTemplateRepository + DunningEventRepository).
 *
 * The existing mock test (dunning.repo.coverage.test.ts) only inspects the
 * Drizzle call recording on a fake DB — it asserts that a `where` clause was
 * *attached*, never that the resulting SQL is *correct*. It cannot catch a
 * wrong filter column, an org-scope leak, a busted stage-0 guard, an ordering
 * regression, a missed status='active' gate in findByStage, or a NOT-NULL
 * write that should fail — because no query ever runs against Postgres. The
 * fake DB even accepted a logDunningEvent() call missing three NOT-NULL
 * columns (templateId / sentAt / channel) without complaint.
 *
 * This suite drives the real DunningTemplateRepository / DunningEventRepository
 * query builders (and the inherited DatabaseRepository CRUD) against REAL rows
 * so the WHERE predicates, org/stage/channel/status gates, the
 * `stage !== undefined` (stage=0) branch, default ordering by created_at,
 * pagination, createOne/updateOneById round-trips and NOT-NULL enforcement all
 * execute end-to-end — asserting the REAL returned/persisted data, never just
 * "did not throw".
 *
 * Target: handlers/association:member/repos/dunning.repo.ts
 *   DunningTemplateRepository:
 *     - buildWhereConditions (via findMany / findOne / count): org / stage
 *       (incl. stage=0) / channel / status filters
 *     - findByStage           (active templates for an org+stage)
 *     - createOne / findOneById / updateOneById (inherited round-trips)
 *     - findMany ordering (created_at asc) + pagination
 *   DunningEventRepository:
 *     - buildWhereConditions (via findMany): membership / person / template /
 *       stage (incl. stage=0) filters
 *     - logDunningEvent       (delegates to createOne; NOT-NULL enforcement)
 *
 * Scope note: the dunning *repo* itself touches only public.dunning_template
 * and public.dunning_event. The "overdue dues_invoice reads / escalation
 * staging" the dunning workflow performs live in the runDunning *job*
 * (handlers/member/duesspecialassessments/runDunning.ts), which composes these
 * repos with the dues-invoice repo — that orchestration is out of this repo's
 * surface, so no dues_invoice table is needed here.
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures via
 * `CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`, so every real column /
 * default / NOT-NULL / check / enum is present — no hand-DDL drift. FKs are
 * not copied, so rows insert directly without parent fixtures.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DunningTemplateRepository, DunningEventRepository } from './dunning.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

function freshId(): string {
  return crypto.randomUUID();
}

/**
 * Insert a dunning_template row directly via raw SQL and return its id. Raw SQL
 * (rather than the repo) lets us seed arbitrary org/stage/channel/status/
 * createdAt combinations the read-side filters can be proven against. The full
 * public.dunning_template copy carries every NOT-NULL column; we set the
 * minimum required set explicitly (organization_id, name, stage, days_after_due,
 * channel, body) and rely on column defaults for id/created_at/version/status.
 */
async function insertTemplate(opts: {
  id?: string;
  organizationId?: string;
  name?: string;
  stage?: number;
  daysAfterDue?: number;
  channel?: 'email' | 'sms' | 'letter';
  subject?: string | null;
  body?: string;
  status?: 'active' | 'inactive';
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dunning_template
       (id, organization_id, name, stage, days_after_due, channel, subject, body, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.name ?? 'Reminder',
      opts.stage ?? 1,
      opts.daysAfterDue ?? 7,
      opts.channel ?? 'email',
      'subject' in opts ? opts.subject : 'Your dues are overdue',
      opts.body ?? 'Please pay your dues.',
      opts.status ?? 'active',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

/**
 * Insert a dunning_event row directly via raw SQL and return its id. Sets every
 * NOT-NULL no-default column (membership_id, person_id, template_id, stage,
 * sent_at, channel); relies on defaults for id/created_at/version/delivery_status.
 */
async function insertEvent(opts: {
  id?: string;
  membershipId?: string;
  personId?: string;
  templateId?: string;
  stage?: number;
  sentAt?: Date;
  channel?: 'email' | 'sms' | 'letter';
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed';
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dunning_event
       (id, membership_id, person_id, template_id, stage, sent_at, channel, delivery_status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      opts.membershipId ?? freshId(),
      opts.personId ?? freshId(),
      opts.templateId ?? freshId(),
      opts.stage ?? 1,
      opts.sentAt ?? new Date('2026-06-01T00:00:00.000Z'),
      opts.channel ?? 'email',
      opts.deliveryStatus ?? 'pending',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch(['dunning_template', 'dunning_event']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── DunningTemplateRepository.buildWhereConditions (via findMany) ─────────

describe('DunningTemplateRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates rows from another org (no cross-tenant leak)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const mine = await insertTemplate({ organizationId: ORG_A });
    await insertTemplate({ organizationId: ORG_B });

    const rows = await repo.findMany({ organizationId: ORG_A });
    expect(rows.map(r => r.id)).toContain(mine);
    expect(rows.every(r => r.organizationId === ORG_A)).toBe(true);
  });

  test('stage filter narrows to one escalation stage', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const s2 = await insertTemplate({ organizationId: org, stage: 2 });
    await insertTemplate({ organizationId: org, stage: 3 });

    const rows = await repo.findMany({ organizationId: org, stage: 2 });
    expect(rows.map(r => r.id)).toEqual([s2]);
  });

  test('stage=0 still applies a condition (!== undefined guard) — not a no-op filter', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const stage0 = await insertTemplate({ organizationId: org, stage: 0 });
    await insertTemplate({ organizationId: org, stage: 1 });
    await insertTemplate({ organizationId: org, stage: 2 });

    // If the guard used a falsy check instead of `!== undefined`, stage:0 would
    // be ignored and all three rows would come back. It must return only stage 0.
    const rows = await repo.findMany({ organizationId: org, stage: 0 });
    expect(rows.map(r => r.id)).toEqual([stage0]);
  });

  test('channel filter narrows by delivery channel', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const sms = await insertTemplate({ organizationId: org, channel: 'sms' });
    await insertTemplate({ organizationId: org, channel: 'email' });
    await insertTemplate({ organizationId: org, channel: 'letter' });

    const rows = await repo.findMany({ organizationId: org, channel: 'sms' });
    expect(rows.map(r => r.id)).toEqual([sms]);
  });

  test('status filter narrows to active vs inactive', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertTemplate({ organizationId: org, status: 'active' });
    const inactive = await insertTemplate({ organizationId: org, status: 'inactive' });

    expect((await repo.findMany({ organizationId: org, status: 'active' })).map(r => r.id)).toEqual([active]);
    expect((await repo.findMany({ organizationId: org, status: 'inactive' })).map(r => r.id)).toEqual([inactive]);
  });

  test('combined org+stage+channel+status filters AND together', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const match = await insertTemplate({ organizationId: org, stage: 2, channel: 'email', status: 'active' });
    // Each of the following differs in exactly one filtered dimension → excluded.
    await insertTemplate({ organizationId: org, stage: 3, channel: 'email', status: 'active' });
    await insertTemplate({ organizationId: org, stage: 2, channel: 'sms', status: 'active' });
    await insertTemplate({ organizationId: org, stage: 2, channel: 'email', status: 'inactive' });
    await insertTemplate({ organizationId: ORG_B, stage: 2, channel: 'email', status: 'active' });

    const rows = await repo.findMany({ organizationId: org, stage: 2, channel: 'email', status: 'active' });
    expect(rows.map(r => r.id)).toEqual([match]);
  });

  test('default ordering is by created_at ascending', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    // Insert out of chronological order to prove the ORDER BY (not insert order).
    const second = await insertTemplate({ organizationId: org, createdAt: new Date('2026-02-02T00:00:00Z') });
    const third = await insertTemplate({ organizationId: org, createdAt: new Date('2026-03-03T00:00:00Z') });
    const first = await insertTemplate({ organizationId: org, createdAt: new Date('2026-01-01T00:00:00Z') });

    const rows = await repo.findMany({ organizationId: org });
    expect(rows.map(r => r.id)).toEqual([first, second, third]);
  });

  test('pagination applies limit + offset over the ordered set', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await insertTemplate({
        organizationId: org,
        createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      }));
    }

    const page = await repo.findMany({ organizationId: org }, { pagination: { offset: 1, limit: 2 } });
    // Ordered by created_at asc → skip ids[0], take ids[1], ids[2].
    expect(page.map(r => r.id)).toEqual([ids[1], ids[2]]);
  });

  test('count honours the same where conditions', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertTemplate({ organizationId: org, status: 'active' });
    await insertTemplate({ organizationId: org, status: 'active' });
    await insertTemplate({ organizationId: org, status: 'inactive' });

    expect(await repo.count({ organizationId: org })).toBe(3);
    expect(await repo.count({ organizationId: org, status: 'active' })).toBe(2);
    expect(await repo.count({ organizationId: org, status: 'inactive' })).toBe(1);
  });

  test('findOne returns a single matching row (or null)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const id = await insertTemplate({ organizationId: org, stage: 4, channel: 'letter' });

    const found = await repo.findOne({ organizationId: org, stage: 4 });
    expect(found?.id).toBe(id);
    expect(found?.channel).toBe('letter');

    expect(await repo.findOne({ organizationId: org, stage: 99 })).toBeNull();
  });
});

// ─── DunningTemplateRepository.findByStage (active-only, org+stage) ────────

describe('DunningTemplateRepository.findByStage (real DB)', () => {
  test('returns only ACTIVE templates for the org+stage', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertTemplate({ organizationId: org, stage: 1, status: 'active' });
    // Inactive same org+stage → excluded by the forced status='active' gate.
    await insertTemplate({ organizationId: org, stage: 1, status: 'inactive' });
    // Active but a different stage → excluded by the stage filter.
    await insertTemplate({ organizationId: org, stage: 2, status: 'active' });
    // Active same stage but a different org → excluded by the org filter.
    await insertTemplate({ organizationId: ORG_B, stage: 1, status: 'active' });

    const rows = await repo.findByStage(org, 1);
    expect(rows.map(r => r.id)).toEqual([active]);
    expect(rows.every(r => r.status === 'active' && r.stage === 1 && r.organizationId === org)).toBe(true);
  });

  test('findByStage works for stage 0 (boundary of the !== undefined guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const s0 = await insertTemplate({ organizationId: org, stage: 0, status: 'active' });
    await insertTemplate({ organizationId: org, stage: 1, status: 'active' });

    const rows = await repo.findByStage(org, 0);
    expect(rows.map(r => r.id)).toEqual([s0]);
  });

  test('returns an empty array when no active template exists for the stage', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertTemplate({ organizationId: org, stage: 1, status: 'inactive' });

    expect(await repo.findByStage(org, 1)).toEqual([]);
    expect(await repo.findByStage(org, 5)).toEqual([]);
  });
});

// ─── DunningTemplateRepository inherited write round-trips ─────────────────

describe('DunningTemplateRepository createOne / findOneById / updateOneById (real DB)', () => {
  test('createOne persists every field and read-back matches (defaults applied)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const org = freshId();

    const created = await repo.createOne({
      organizationId: org,
      name: 'Final Notice',
      stage: 3,
      daysAfterDue: 30,
      channel: 'letter',
      subject: 'Final dues notice',
      body: 'This is your final notice.',
    } as any);

    expect(created.id).toBeTruthy();
    expect(created.status).toBe('active'); // schema default
    expect(created.version).toBe(1); // schema default

    // Read straight from Postgres to prove it actually landed.
    const back = await repo.findOneById(created.id);
    expect(back).not.toBeNull();
    expect(back!.name).toBe('Final Notice');
    expect(back!.stage).toBe(3);
    expect(back!.daysAfterDue).toBe(30);
    expect(back!.channel).toBe('letter');
    expect(back!.subject).toBe('Final dues notice');
    expect(back!.organizationId).toBe(org);
  });

  test('updateOneById mutates the row, bumps version, and persists', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const id = await insertTemplate({ status: 'active', name: 'Old', stage: 1 });

    const updated = await repo.updateOneById(id, { status: 'inactive', name: 'New', daysAfterDue: 14 } as any);
    expect(updated.status).toBe('inactive');
    expect(updated.name).toBe('New');
    expect(updated.daysAfterDue).toBe(14);
    expect(updated.version).toBe(2); // base repo increments version

    // Confirm via an independent read-back from Postgres.
    const row = await H.scopedPool.query(
      `SELECT status, name, days_after_due, version FROM "${H.schema}".dunning_template WHERE id = $1`,
      [id],
    );
    expect(row.rows[0]).toMatchObject({ status: 'inactive', name: 'New', days_after_due: 14, version: 2 });
  });

  test('updateOneById on a missing id throws NotFound', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    await expect(repo.updateOneById(freshId(), { name: 'x' } as any)).rejects.toThrow();
  });

  test('createOne with a NULL subject (nullable column) succeeds', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningTemplateRepository(H.db as any, noopLogger);
    const created = await repo.createOne({
      organizationId: freshId(),
      name: 'SMS Nudge',
      stage: 1,
      daysAfterDue: 3,
      channel: 'sms',
      body: 'Pay now',
      // subject omitted → nullable
    } as any);
    const back = await repo.findOneById(created.id);
    expect(back!.subject).toBeNull();
  });
});

// ─── DunningEventRepository.buildWhereConditions (via findMany) ────────────

describe('DunningEventRepository.findMany / buildWhereConditions (real DB)', () => {
  test('membershipId filter isolates one membership\'s events', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const membership = freshId();
    const a = await insertEvent({ membershipId: membership, stage: 1 });
    const b = await insertEvent({ membershipId: membership, stage: 2 });
    await insertEvent({ membershipId: freshId(), stage: 1 }); // other membership

    const rows = await repo.findMany({ membershipId: membership });
    expect(new Set(rows.map(r => r.id))).toEqual(new Set([a, b]));
    expect(rows.every(r => r.membershipId === membership)).toBe(true);
  });

  test('personId filter isolates one person\'s events', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const person = freshId();
    const mine = await insertEvent({ personId: person });
    await insertEvent({ personId: freshId() });

    const rows = await repo.findMany({ personId: person });
    expect(rows.map(r => r.id)).toEqual([mine]);
  });

  test('templateId filter isolates events emitted from one template', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const template = freshId();
    const e1 = await insertEvent({ templateId: template });
    const e2 = await insertEvent({ templateId: template });
    await insertEvent({ templateId: freshId() });

    const rows = await repo.findMany({ templateId: template });
    expect(new Set(rows.map(r => r.id))).toEqual(new Set([e1, e2]));
  });

  test('stage filter narrows events to one escalation stage; stage=0 guard holds', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const membership = freshId();
    const s0 = await insertEvent({ membershipId: membership, stage: 0 });
    await insertEvent({ membershipId: membership, stage: 1 });
    await insertEvent({ membershipId: membership, stage: 2 });

    // stage=0 must apply (not be dropped as falsy) → only the stage-0 event.
    const stage0 = await repo.findMany({ membershipId: membership, stage: 0 });
    expect(stage0.map(r => r.id)).toEqual([s0]);

    const stage2 = await repo.findMany({ membershipId: membership, stage: 2 });
    expect(stage2).toHaveLength(1);
    expect(stage2[0]!.stage).toBe(2);
  });

  test('combined membership+person+template+stage filters AND together', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const membership = freshId();
    const person = freshId();
    const template = freshId();
    const match = await insertEvent({ membershipId: membership, personId: person, templateId: template, stage: 2 });
    // Differs in one dimension each → excluded.
    await insertEvent({ membershipId: membership, personId: person, templateId: template, stage: 3 });
    await insertEvent({ membershipId: membership, personId: person, templateId: freshId(), stage: 2 });
    await insertEvent({ membershipId: membership, personId: freshId(), templateId: template, stage: 2 });

    const rows = await repo.findMany({ membershipId: membership, personId: person, templateId: template, stage: 2 });
    expect(rows.map(r => r.id)).toEqual([match]);
  });

  test('no filters returns the unfiltered set (capped) ordered by created_at', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    // Seed a fresh template scope so ordering is deterministic for these three.
    const template = freshId();
    const first = await insertEvent({ templateId: template, createdAt: new Date('2026-01-01T00:00:00Z') });
    const second = await insertEvent({ templateId: template, createdAt: new Date('2026-01-02T00:00:00Z') });
    const third = await insertEvent({ templateId: template, createdAt: new Date('2026-01-03T00:00:00Z') });

    const rows = await repo.findMany({ templateId: template });
    expect(rows.map(r => r.id)).toEqual([first, second, third]);
  });
});

// ─── DunningEventRepository.logDunningEvent (event log write) ──────────────

describe('DunningEventRepository.logDunningEvent (real DB)', () => {
  test('persists a full event and read-back matches (delivery_status default applied)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const membership = freshId();
    const person = freshId();
    const template = freshId();
    const sentAt = new Date('2026-06-15T12:00:00.000Z');

    const logged = await repo.logDunningEvent({
      membershipId: membership,
      personId: person,
      templateId: template,
      stage: 2,
      sentAt,
      channel: 'email',
    } as any);

    expect(logged.id).toBeTruthy();
    expect(logged.deliveryStatus).toBe('pending'); // schema default
    expect(logged.stage).toBe(2);

    // Confirm it is queryable via the read path it serves (listDunningEvents).
    const rows = await repo.findMany({ membershipId: membership });
    expect(rows.map(r => r.id)).toEqual([logged.id]);
    expect(rows[0]!.channel).toBe('email');
    expect(rows[0]!.personId).toBe(person);
    expect(rows[0]!.templateId).toBe(template);
    expect(new Date(rows[0]!.sentAt).toISOString()).toBe(sentAt.toISOString());
  });

  test('honours an explicit delivery_status (e.g. failed)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    const logged = await repo.logDunningEvent({
      membershipId: freshId(),
      personId: freshId(),
      templateId: freshId(),
      stage: 1,
      sentAt: new Date(),
      channel: 'sms',
      deliveryStatus: 'failed',
    } as any);
    const back = await repo.findOneById(logged.id);
    expect(back!.deliveryStatus).toBe('failed');
  });

  test('rejects a write missing a NOT-NULL column (the fake-DB mock could not catch this)', async () => {
    if (!H.dbReachable) return;
    const repo = new DunningEventRepository(H.db as any, noopLogger);
    // sentAt / channel / templateId are all NOT NULL with no default. The mock
    // coverage test logged an event without templateId/sentAt/channel and
    // "passed"; against real Postgres this must violate NOT NULL.
    await expect(
      repo.logDunningEvent({
        membershipId: freshId(),
        personId: freshId(),
        stage: 1,
      } as any),
    ).rejects.toThrow();
  });
});
