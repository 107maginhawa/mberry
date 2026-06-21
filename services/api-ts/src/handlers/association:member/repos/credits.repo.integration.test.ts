/**
 * Real-DB integration tests for the membership-domain CreditEntryRepository.
 *
 * The existing mock tests (credits.repo.aggregate-filter.test.ts,
 * credits.repo.count-auto.test.ts) only inspect the Drizzle `where` tree they
 * build — they never prove the SQL is *correct*. They cannot catch a wrong
 * GROUP BY, a busted SUM, an org-scope leak, a NULL-category bucket bug, or an
 * ordering regression, because no query ever runs against Postgres.
 *
 * This suite drives the actual query builders against REAL rows so the WHERE
 * predicates, BETWEEN cycle window, GROUP BY/SUM math, org-scoping,
 * verification/void gates, NULL handling and ordering all execute end-to-end,
 * and asserts the REAL returned data (and persisted row state read back from
 * Postgres) — not "no throw".
 *
 * Target: handlers/association:member/repos/credits.repo.ts
 *   CreditEntryRepository:
 *     - findByTrainingAndPerson  (auto-dedupe lookup; type='auto' only)
 *     - countAutoByTraining      (count type='auto' across members)
 *     - sumCreditsForCycle       (SUM over cycle, active+verified, optional org)
 *     - sumCreditsByCategoryBatch(GROUP BY person+category map; NULL→uncategorized)
 *     - sumCreditsByOrg          (GROUP BY org cross-org transcript total)
 *     - listForPerson            (findMany active+verified, ordered by createdAt)
 *     - findManyForPeer          (fail-closed org-scoped listing)
 *     - buildWhereConditions     (via findMany: org/person/type/cycle/status/verif)
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public.credit_entry structure
 * (`CREATE TABLE … (LIKE public.credit_entry INCLUDING ALL)`), so every real
 * column/default/check is present — no hand-DDL drift. FKs are not copied, so
 * credit_entry rows insert directly without parent org/person rows. search_path
 * is pinned via the libpq startup option (no pool-churn race).
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { CreditEntryRepository } from './credits.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const PERSON_1 = '00000000-0000-4000-8000-0000000000c1';
const PERSON_2 = '00000000-0000-4000-8000-0000000000c2';
const TRAINING_1 = '00000000-0000-4000-8000-0000000000e1';

function freshId(): string {
  return crypto.randomUUID();
}

// A wide cycle window that contains every activityDate we seed below.
const CYCLE_START = new Date('2026-01-01T00:00:00.000Z');
const CYCLE_END = new Date('2026-12-31T23:59:59.000Z');

/**
 * Insert a credit_entry row directly via raw SQL and return its id. Raw SQL
 * (rather than the repo) lets us seed arbitrary status/verificationStatus/
 * category/createdAt combinations the repo write-path wouldn't normally
 * produce, so the read-side filters can be proven against adversarial data.
 *
 * The full public.credit_entry copy carries extra NOT NULL columns beyond the
 * ones the reads touch (e.g. activity_name); we set the minimum required set
 * explicitly and rely on column defaults for the rest.
 */
async function insertCredit(opts: {
  id?: string;
  personId?: string;
  organizationId?: string;
  type?: 'auto' | 'manual';
  trainingId?: string | null;
  activityDate?: Date;
  creditAmount?: number;
  category?: string | null;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  status?: 'active' | 'voided' | 'disputed';
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".credit_entry
       (id, person_id, organization_id, type, training_id, activity_name, activity_date,
        credit_amount, cycle_start, cycle_end, category, verification_status, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      opts.personId ?? PERSON_1,
      opts.organizationId ?? ORG_A,
      opts.type ?? 'manual',
      opts.trainingId ?? null,
      'Activity',
      opts.activityDate ?? new Date('2026-06-01T00:00:00.000Z'),
      opts.creditAmount ?? 1,
      CYCLE_START,
      CYCLE_END,
      'category' in opts ? opts.category : 'General',
      opts.verificationStatus ?? 'verified',
      opts.status ?? 'active',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch(['credit_entry']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── findByTrainingAndPerson (auto-dedupe lookup) ─────────────────────────

describe('CreditEntryRepository.findByTrainingAndPerson (real DB)', () => {
  test('returns the existing AUTO entry for a training+person', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const training = freshId();
    const id = await insertCredit({ type: 'auto', trainingId: training, personId: PERSON_1, creditAmount: 2 });

    const found = await repo.findByTrainingAndPerson(training, PERSON_1);
    expect(found?.id).toBe(id);
    expect(found?.type).toBe('auto');
    expect(found?.creditAmount).toBe(2);
  });

  test('ignores a MANUAL entry that happens to reference the same training', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const training = freshId();
    // Only a manual row exists for this training+person → no auto dedupe hit.
    await insertCredit({ type: 'manual', trainingId: training, personId: PERSON_2 });

    expect(await repo.findByTrainingAndPerson(training, PERSON_2)).toBeNull();
  });

  test('returns null when no entry matches the training+person', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    expect(await repo.findByTrainingAndPerson(freshId(), PERSON_1)).toBeNull();
  });

  test('does not match a different person on the same training', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const training = freshId();
    await insertCredit({ type: 'auto', trainingId: training, personId: PERSON_1 });
    // PERSON_2 has no auto entry for this training.
    expect(await repo.findByTrainingAndPerson(training, PERSON_2)).toBeNull();
  });
});

// ─── countAutoByTraining (credit-value lock counter) ──────────────────────

describe('CreditEntryRepository.countAutoByTraining (real DB)', () => {
  test('counts only AUTO entries for the training, across members', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const training = freshId();
    await insertCredit({ type: 'auto', trainingId: training, personId: PERSON_1 });
    await insertCredit({ type: 'auto', trainingId: training, personId: PERSON_2 });
    // A manual entry for the same training must NOT inflate the count.
    await insertCredit({ type: 'manual', trainingId: training, personId: PERSON_1 });
    // An auto entry for a DIFFERENT training must NOT count.
    await insertCredit({ type: 'auto', trainingId: freshId(), personId: PERSON_1 });

    expect(await repo.countAutoByTraining(training)).toBe(2);
  });

  test('returns 0 when no auto entry exists for the training', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const training = freshId();
    await insertCredit({ type: 'manual', trainingId: training });
    expect(await repo.countAutoByTraining(training)).toBe(0);
    expect(await repo.countAutoByTraining(freshId())).toBe(0);
  });
});

// ─── sumCreditsForCycle (SUM + active/verified/cycle/org gates) ───────────

describe('CreditEntryRepository.sumCreditsForCycle (real DB)', () => {
  test('sums credit_amount for active+verified entries inside the cycle window', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    await insertCredit({ personId: person, creditAmount: 10, activityDate: new Date('2026-03-01T00:00:00Z') });
    await insertCredit({ personId: person, creditAmount: 5.5, activityDate: new Date('2026-09-01T00:00:00Z') });

    const total = await repo.sumCreditsForCycle(person, CYCLE_START, CYCLE_END);
    // 10 + 5.5 = 15.5 — float8 preserves the half-credit (BR: fractional CPD).
    expect(total).toBe(15.5);
  });

  test('returns 0 (not null) when no rows match — coalesce branch', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const total = await repo.sumCreditsForCycle(freshId(), CYCLE_START, CYCLE_END);
    expect(total).toBe(0);
  });

  test('excludes voided entries (status != active) and pending/rejected verification', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    await insertCredit({ personId: person, creditAmount: 8, status: 'active', verificationStatus: 'verified' });
    await insertCredit({ personId: person, creditAmount: 100, status: 'voided', verificationStatus: 'verified' });
    await insertCredit({ personId: person, creditAmount: 50, status: 'active', verificationStatus: 'pending' });
    await insertCredit({ personId: person, creditAmount: 25, status: 'active', verificationStatus: 'rejected' });

    // Only the single active+verified row (8) counts; the void + the
    // pending/rejected manual entries are all excluded.
    expect(await repo.sumCreditsForCycle(person, CYCLE_START, CYCLE_END)).toBe(8);
  });

  test('excludes entries whose activityDate falls outside the cycle window (BETWEEN)', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    await insertCredit({ personId: person, creditAmount: 7, activityDate: new Date('2026-06-15T00:00:00Z') });
    // Before the window — excluded by BETWEEN(activity_date, start, end).
    await insertCredit({ personId: person, creditAmount: 99, activityDate: new Date('2025-06-15T00:00:00Z') });
    // After the window — excluded.
    await insertCredit({ personId: person, creditAmount: 88, activityDate: new Date('2027-01-15T00:00:00Z') });

    expect(await repo.sumCreditsForCycle(person, CYCLE_START, CYCLE_END)).toBe(7);
  });

  test('optional organizationId scopes the sum to one org', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    await insertCredit({ personId: person, organizationId: ORG_A, creditAmount: 4 });
    await insertCredit({ personId: person, organizationId: ORG_A, creditAmount: 6 });
    await insertCredit({ personId: person, organizationId: ORG_B, creditAmount: 100 });

    // Org-scoped → only ORG_A's 4+6.
    expect(await repo.sumCreditsForCycle(person, CYCLE_START, CYCLE_END, ORG_A)).toBe(10);
    // No org → both orgs summed (4+6+100).
    expect(await repo.sumCreditsForCycle(person, CYCLE_START, CYCLE_END)).toBe(110);
  });
});

// ─── sumCreditsByCategoryBatch (GROUP BY person+category map) ──────────────

describe('CreditEntryRepository.sumCreditsByCategoryBatch (real DB)', () => {
  test('empty personIds short-circuits to an empty Map (no query)', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const map = await repo.sumCreditsByCategoryBatch([], CYCLE_START, CYCLE_END, ORG_A);
    expect(map.size).toBe(0);
  });

  test('groups per person and per category, summing credit_amount', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const pA = freshId();
    const pB = freshId();
    await insertCredit({ personId: pA, organizationId: org, category: 'General', creditAmount: 3 });
    await insertCredit({ personId: pA, organizationId: org, category: 'General', creditAmount: 2 });
    await insertCredit({ personId: pA, organizationId: org, category: 'Major', creditAmount: 4 });
    await insertCredit({ personId: pB, organizationId: org, category: 'Major', creditAmount: 1 });

    const map = await repo.sumCreditsByCategoryBatch([pA, pB], CYCLE_START, CYCLE_END, org);
    expect(map.get(pA)).toEqual({ General: 5, Major: 4 });
    expect(map.get(pB)).toEqual({ Major: 1 });
  });

  test('NULL category collapses into the "uncategorized" bucket', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const p = freshId();
    await insertCredit({ personId: p, organizationId: org, category: null, creditAmount: 9 });

    const map = await repo.sumCreditsByCategoryBatch([p], CYCLE_START, CYCLE_END, org);
    expect(map.get(p)).toEqual({ uncategorized: 9 });
  });

  test('scopes to the org and excludes voided + pending/rejected entries', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const otherOrg = freshId();
    const p = freshId();
    await insertCredit({ personId: p, organizationId: org, category: 'General', creditAmount: 5 });
    // Different org — excluded by the org filter.
    await insertCredit({ personId: p, organizationId: otherOrg, category: 'General', creditAmount: 50 });
    // Voided + pending — excluded by the active/verified gates.
    await insertCredit({ personId: p, organizationId: org, category: 'General', creditAmount: 70, status: 'voided' });
    await insertCredit({ personId: p, organizationId: org, category: 'General', creditAmount: 80, verificationStatus: 'pending' });

    const map = await repo.sumCreditsByCategoryBatch([p], CYCLE_START, CYCLE_END, org);
    expect(map.get(p)).toEqual({ General: 5 });
  });

  test('a person with no matching rows is absent from the Map', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const present = freshId();
    const absent = freshId();
    await insertCredit({ personId: present, organizationId: org, category: 'General', creditAmount: 1 });

    const map = await repo.sumCreditsByCategoryBatch([present, absent], CYCLE_START, CYCLE_END, org);
    expect(map.has(present)).toBe(true);
    expect(map.has(absent)).toBe(false);
  });
});

// ─── sumCreditsByOrg (GROUP BY org cross-org transcript) ──────────────────

describe('CreditEntryRepository.sumCreditsByOrg (real DB)', () => {
  test('returns one summed row per organization for the person', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    const orgX = freshId();
    const orgY = freshId();
    await insertCredit({ personId: person, organizationId: orgX, creditAmount: 3 });
    await insertCredit({ personId: person, organizationId: orgX, creditAmount: 2.5 });
    await insertCredit({ personId: person, organizationId: orgY, creditAmount: 4 });

    const rows = await repo.sumCreditsByOrg(person, CYCLE_START, CYCLE_END);
    const byOrg = new Map(rows.map(r => [r.organizationId, r.total]));
    expect(byOrg.get(orgX)).toBe(5.5);
    expect(byOrg.get(orgY)).toBe(4);
    expect(rows).toHaveLength(2);
  });

  test('excludes voided + pending/rejected entries from the per-org totals', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    const org = freshId();
    await insertCredit({ personId: person, organizationId: org, creditAmount: 6 });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 100, status: 'voided' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 100, verificationStatus: 'rejected' });

    const rows = await repo.sumCreditsByOrg(person, CYCLE_START, CYCLE_END);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.total).toBe(6);
  });

  test('returns an empty array when the person has no credits in the cycle', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    expect(await repo.sumCreditsByOrg(freshId(), CYCLE_START, CYCLE_END)).toEqual([]);
  });
});

// ─── listForPerson (transcript list: active+verified, ordered) ────────────

describe('CreditEntryRepository.listForPerson (real DB)', () => {
  test('lists active+verified entries for the person, ordered by createdAt', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    const first = await insertCredit({ personId: person, creditAmount: 1, createdAt: new Date('2026-01-02T00:00:00Z') });
    const second = await insertCredit({ personId: person, creditAmount: 2, createdAt: new Date('2026-01-03T00:00:00Z') });
    const third = await insertCredit({ personId: person, creditAmount: 3, createdAt: new Date('2026-01-04T00:00:00Z') });

    const rows = await repo.listForPerson(person);
    expect(rows.map(r => r.id)).toEqual([first, second, third]); // base findMany orders by created_at asc
  });

  test('excludes voided + pending/rejected entries from the transcript', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    const keep = await insertCredit({ personId: person, status: 'active', verificationStatus: 'verified' });
    await insertCredit({ personId: person, status: 'voided', verificationStatus: 'verified' });
    await insertCredit({ personId: person, status: 'active', verificationStatus: 'pending' });

    const rows = await repo.listForPerson(person);
    expect(rows.map(r => r.id)).toEqual([keep]);
  });

  test('honours the optional cycle window filter', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    const inWindow = await insertCredit({ personId: person, activityDate: new Date('2026-05-01T00:00:00Z') });
    await insertCredit({ personId: person, activityDate: new Date('2025-05-01T00:00:00Z') }); // out of window

    const rows = await repo.listForPerson(person, { cycleStart: CYCLE_START, cycleEnd: CYCLE_END });
    expect(rows.map(r => r.id)).toEqual([inWindow]);
  });
});

// ─── findManyForPeer (fail-closed org-scoped peer listing) ────────────────

describe('CreditEntryRepository.findManyForPeer (real DB)', () => {
  test('returns only the target person\'s entries within the given org', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const peer = freshId();
    const other = freshId();
    const a = await insertCredit({ personId: peer, organizationId: org, creditAmount: 1 });
    const b = await insertCredit({ personId: peer, organizationId: org, creditAmount: 2 });
    // Same person but a DIFFERENT org → must be excluded (cross-tenant guard).
    await insertCredit({ personId: peer, organizationId: freshId(), creditAmount: 99 });
    // Another person in the same org → excluded by the person filter.
    await insertCredit({ personId: other, organizationId: org, creditAmount: 88 });

    const rows = await repo.findManyForPeer(org, peer);
    expect(new Set(rows.map(r => r.id))).toEqual(new Set([a, b]));
    expect(rows.every(r => r.organizationId === org && r.personId === peer)).toBe(true);
  });

  test('throws (fail-closed) on empty organizationId — never returns cross-tenant rows', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    await expect(repo.findManyForPeer('', PERSON_1)).rejects.toThrow(/organizationId/);
  });

  test('throws on empty personId', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    await expect(repo.findManyForPeer(ORG_A, '')).rejects.toThrow(/personId/);
  });
});

// ─── buildWhereConditions via findMany (filter matrix) ────────────────────

describe('CreditEntryRepository.findMany / buildWhereConditions (real DB)', () => {
  test('type filter narrows to auto vs manual', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const auto = await insertCredit({ organizationId: org, type: 'auto', trainingId: TRAINING_1 });
    const manual = await insertCredit({ organizationId: org, type: 'manual' });

    const autos = await (repo as any).findMany({ organizationId: org, type: 'auto' });
    expect(autos.map((r: any) => r.id)).toEqual([auto]);

    const manuals = await (repo as any).findMany({ organizationId: org, type: 'manual' });
    expect(manuals.map((r: any) => r.id)).toEqual([manual]);
  });

  test('status filter excludes voided/disputed when status=active', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertCredit({ organizationId: org, status: 'active' });
    await insertCredit({ organizationId: org, status: 'voided' });
    await insertCredit({ organizationId: org, status: 'disputed' });

    const rows = await (repo as any).findMany({ organizationId: org, status: 'active' });
    expect(rows.map((r: any) => r.id)).toEqual([active]);
  });

  test('verificationStatus filter narrows to verified only', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const verified = await insertCredit({ organizationId: org, verificationStatus: 'verified' });
    await insertCredit({ organizationId: org, verificationStatus: 'pending' });
    await insertCredit({ organizationId: org, verificationStatus: 'rejected' });

    const rows = await (repo as any).findMany({ organizationId: org, verificationStatus: 'verified' });
    expect(rows.map((r: any) => r.id)).toEqual([verified]);
  });

  test('cycleStart+cycleEnd applies a BETWEEN window on activity_date', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const org = freshId();
    const inside = await insertCredit({ organizationId: org, activityDate: new Date('2026-04-01T00:00:00Z') });
    await insertCredit({ organizationId: org, activityDate: new Date('2025-04-01T00:00:00Z') });

    const rows = await (repo as any).findMany({
      organizationId: org,
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
    });
    expect(rows.map((r: any) => r.id)).toEqual([inside]);
  });

  test('plain findMany({personId}) (DPA export) returns voided rows too — no forced active filter', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const person = freshId();
    const activeId = await insertCredit({ personId: person, status: 'active', verificationStatus: 'verified' });
    const voidedId = await insertCredit({ personId: person, status: 'voided', verificationStatus: 'verified' });
    const pendingId = await insertCredit({ personId: person, status: 'active', verificationStatus: 'pending' });

    // Unlike listForPerson, a bare personId query is the legal/DPA export path:
    // every entry (including voided + pending) stays in the record.
    const rows = await (repo as any).findMany({ personId: person });
    expect(new Set(rows.map((r: any) => r.id))).toEqual(new Set([activeId, voidedId, pendingId]));
  });

  test('org filter isolates rows from another organization', async () => {
    if (!H.dbReachable) return;
    const repo = new CreditEntryRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertCredit({ organizationId: orgX });
    await insertCredit({ organizationId: orgY });

    const rows = await (repo as any).findMany({ organizationId: orgX });
    expect(rows.map((r: any) => r.id)).toEqual([mine]);
  });
});
