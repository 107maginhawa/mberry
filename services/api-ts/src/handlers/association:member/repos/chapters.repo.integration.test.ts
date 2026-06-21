/**
 * Real-DB integration tests for the chapters-domain repositories:
 *   - ChapterAffiliationRepository  (chapter_affiliation)
 *   - AffiliationTransferRepository (affiliation_transfer — dual-approval lifecycle)
 *   - RoyaltySplitRepository        (royalty_split — national/chapter allocation)
 *
 * The existing mock test (chapters.repo.coverage.test.ts) only inspects the
 * Drizzle `where` tree these repos build — it never proves the SQL is *correct*.
 * It cannot catch an org-scope leak in `buildWhereConditions`, a busted
 * `setPrimary` (which must clear isPrimary on EVERY sibling row for the person
 * and flip exactly one to true), a status/enum filter regression on the transfer
 * lifecycle, a wrong split-percentage round-trip, or a NULL-approver gap —
 * because no query ever runs against Postgres.
 *
 * This suite drives the actual query builders against REAL rows so the WHERE
 * predicates, multi-row UPDATE in `setPrimary`, org-scoping, enum/status filters,
 * ordering, real-typed (real/date/timestamptz) round-trips and persisted row
 * state read back from Postgres all execute end-to-end — and asserts the REAL
 * returned data, not "no throw".
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real
 * column/default/check/enum is present — no hand-DDL drift. FKs are not copied,
 * so rows insert directly without parent org/person/chapter rows.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  ChapterAffiliationRepository,
  AffiliationTransferRepository,
  RoyaltySplitRepository,
} from './chapters.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const PERSON_1 = '00000000-0000-4000-8000-0000000000c1';
const PERSON_2 = '00000000-0000-4000-8000-0000000000c2';
const CHAPTER_1 = '00000000-0000-4000-8000-0000000000d1';
const CHAPTER_2 = '00000000-0000-4000-8000-0000000000d2';

function freshId(): string {
  return crypto.randomUUID();
}

// ─── raw seeders ──────────────────────────────────────────────────────────
// Raw SQL (rather than the repo write path) lets us seed arbitrary
// status/isPrimary/approver combinations so the read/update side can be proven
// against adversarial data. We set every real NOT-NULL column that has no
// default and rely on column defaults (id, timestamps, version, status, …) for
// the rest.

async function insertAffiliation(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  chapterId?: string;
  isPrimary?: boolean;
  affiliatedAt?: Date;
  transferredFrom?: string | null;
  status?: 'active' | 'transferred' | 'withdrawn';
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".chapter_affiliation
       (id, organization_id, person_id, chapter_id, is_primary, affiliated_at, transferred_from, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::affiliation_status,'active'))`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? PERSON_1,
      opts.chapterId ?? CHAPTER_1,
      opts.isPrimary ?? false,
      opts.affiliatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
      opts.transferredFrom ?? null,
      opts.status ?? null,
    ],
  );
  return id;
}

async function insertTransfer(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  fromChapterId?: string;
  toChapterId?: string;
  requestedBy?: string;
  approvedBySource?: string | null;
  approvedByTarget?: string | null;
  status?:
    | 'requested'
    | 'pendingSourceApproval'
    | 'pendingTargetApproval'
    | 'approved'
    | 'denied'
    | 'completed'
    | 'cancelled';
  completedAt?: Date | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".affiliation_transfer
       (id, organization_id, person_id, from_chapter_id, to_chapter_id, requested_by,
        approved_by_source, approved_by_target, status, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::transfer_status,'requested'),$10)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? PERSON_1,
      opts.fromChapterId ?? CHAPTER_1,
      opts.toChapterId ?? CHAPTER_2,
      opts.requestedBy ?? PERSON_1,
      opts.approvedBySource ?? null,
      opts.approvedByTarget ?? null,
      opts.status ?? null,
      opts.completedAt ?? null,
    ],
  );
  return id;
}

async function insertSplit(opts: {
  id?: string;
  organizationId?: string;
  membershipId?: string;
  nationalOrgId?: string;
  chapterId?: string;
  splitPercentNational?: number;
  splitPercentChapter?: number;
  effectiveDate?: string; // 'YYYY-MM-DD'
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".royalty_split
       (id, organization_id, membership_id, national_org_id, chapter_id,
        split_percent_national, split_percent_chapter, effective_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.membershipId ?? freshId(),
      opts.nationalOrgId ?? ORG_A,
      opts.chapterId ?? CHAPTER_1,
      opts.splitPercentNational ?? 60,
      opts.splitPercentChapter ?? 40,
      opts.effectiveDate ?? '2026-01-01',
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch(['chapter_affiliation', 'affiliation_transfer', 'royalty_split']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// ChapterAffiliationRepository
// ═══════════════════════════════════════════════════════════════════════════

// ─── setPrimary (multi-row clear + single set) ────────────────────────────
describe('ChapterAffiliationRepository.setPrimary (real DB)', () => {
  test('flips target to primary and clears every sibling for the same person/org', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const person = freshId();
    // Three affiliations for the same person in ORG_A; the first is currently primary.
    const a = await insertAffiliation({ organizationId: ORG_A, personId: person, chapterId: CHAPTER_1, isPrimary: true });
    const b = await insertAffiliation({ organizationId: ORG_A, personId: person, chapterId: CHAPTER_2, isPrimary: false });
    const c = await insertAffiliation({ organizationId: ORG_A, personId: person, chapterId: freshId(), isPrimary: false });

    const updated = await repo.setPrimary(b, ORG_A);
    expect(updated.id).toBe(b);
    expect(updated.isPrimary).toBe(true);

    // Read back the persisted state for all three rows from Postgres.
    const { rows } = await H.scopedPool.query(
      `SELECT id, is_primary FROM "${H.schema}".chapter_affiliation WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [[a, b, c]],
    );
    const byId = new Map(rows.map((r: any) => [r.id, r.is_primary]));
    expect(byId.get(a)).toBe(false); // previous primary cleared
    expect(byId.get(b)).toBe(true);  // new primary
    expect(byId.get(c)).toBe(false); // other sibling stays false
  });

  test('does NOT touch the same person in a different org (org-scoped clear)', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const person = freshId();
    // Person has a primary affiliation in ORG_B that must survive an ORG_A setPrimary.
    const orgBPrimary = await insertAffiliation({ organizationId: ORG_B, personId: person, isPrimary: true });
    const orgATarget = await insertAffiliation({ organizationId: ORG_A, personId: person, isPrimary: false });

    await repo.setPrimary(orgATarget, ORG_A);

    const { rows } = await H.scopedPool.query(
      `SELECT id, is_primary FROM "${H.schema}".chapter_affiliation WHERE id = ANY($1::uuid[])`,
      [[orgBPrimary, orgATarget]],
    );
    const byId = new Map(rows.map((r: any) => [r.id, r.is_primary]));
    expect(byId.get(orgBPrimary)).toBe(true);  // untouched — different org
    expect(byId.get(orgATarget)).toBe(true);
  });

  test('does NOT touch a different person in the same org', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const target = await insertAffiliation({ organizationId: ORG_A, personId: PERSON_1, isPrimary: false });
    const otherPersonPrimary = await insertAffiliation({ organizationId: ORG_A, personId: PERSON_2, isPrimary: true });

    await repo.setPrimary(target, ORG_A);

    const { rows } = await H.scopedPool.query(
      `SELECT is_primary FROM "${H.schema}".chapter_affiliation WHERE id = $1`,
      [otherPersonPrimary],
    );
    expect(rows[0].is_primary).toBe(true); // person filter protected this row
  });

  test('bumps updatedAt on the cleared rows and the new primary', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const person = freshId();
    const old = new Date('2020-01-01T00:00:00.000Z');
    const a = await insertAffiliation({ organizationId: ORG_A, personId: person, isPrimary: true });
    const b = await insertAffiliation({ organizationId: ORG_A, personId: person, isPrimary: false });
    // Force a known-old updatedAt so we can prove the UPDATE refreshed it.
    await H.scopedPool.query(
      `UPDATE "${H.schema}".chapter_affiliation SET updated_at = $1 WHERE id = ANY($2::uuid[])`,
      [old, [a, b]],
    );

    await repo.setPrimary(b, ORG_A);

    const { rows } = await H.scopedPool.query(
      `SELECT id, updated_at FROM "${H.schema}".chapter_affiliation WHERE id = ANY($1::uuid[])`,
      [[a, b]],
    );
    for (const r of rows) {
      expect(new Date(r.updated_at).getTime()).toBeGreaterThan(old.getTime());
    }
  });

  test('throws NotFoundError when the target affiliation does not exist', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    await expect(repo.setPrimary(freshId(), ORG_A)).rejects.toThrow(/not found/i);
  });
});

// ─── findMany / buildWhereConditions filter matrix ────────────────────────
describe('ChapterAffiliationRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates rows from another org (tenant guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertAffiliation({ organizationId: orgX });
    await insertAffiliation({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.organizationId === orgX)).toBe(true);
  });

  test('personId + chapterId filters narrow to the matching affiliation', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const org = freshId();
    const wanted = await insertAffiliation({ organizationId: org, personId: PERSON_1, chapterId: CHAPTER_1 });
    await insertAffiliation({ organizationId: org, personId: PERSON_1, chapterId: CHAPTER_2 }); // wrong chapter
    await insertAffiliation({ organizationId: org, personId: PERSON_2, chapterId: CHAPTER_1 }); // wrong person

    const rows = await repo.findMany({ organizationId: org, personId: PERSON_1, chapterId: CHAPTER_1 });
    expect(rows.map((r) => r.id)).toEqual([wanted]);
  });

  test('isPrimary=false is honoured (explicit-false guard, not skipped)', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const org = freshId();
    const primary = await insertAffiliation({ organizationId: org, isPrimary: true });
    const secondary = await insertAffiliation({ organizationId: org, isPrimary: false });

    const falses = await repo.findMany({ organizationId: org, isPrimary: false });
    expect(falses.map((r) => r.id)).toEqual([secondary]);

    const trues = await repo.findMany({ organizationId: org, isPrimary: true });
    expect(trues.map((r) => r.id)).toEqual([primary]);
  });

  test('status filter excludes transferred/withdrawn when status=active', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertAffiliation({ organizationId: org, status: 'active' });
    await insertAffiliation({ organizationId: org, status: 'transferred' });
    await insertAffiliation({ organizationId: org, status: 'withdrawn' });

    const rows = await repo.findMany({ organizationId: org, status: 'active' });
    expect(rows.map((r) => r.id)).toEqual([active]);
  });

  test('count() respects the same filters', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertAffiliation({ organizationId: org, status: 'active' });
    await insertAffiliation({ organizationId: org, status: 'active' });
    await insertAffiliation({ organizationId: org, status: 'withdrawn' });

    expect(await repo.count({ organizationId: org })).toBe(3);
    expect(await repo.count({ organizationId: org, status: 'active' })).toBe(2);
  });

  test('findOne returns a single matching row (or null)', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const org = freshId();
    const id = await insertAffiliation({ organizationId: org, personId: PERSON_1, chapterId: CHAPTER_1 });

    const found = await repo.findOne({ organizationId: org, personId: PERSON_1, chapterId: CHAPTER_1 });
    expect(found?.id).toBe(id);

    const miss = await repo.findOne({ organizationId: org, personId: PERSON_2 });
    expect(miss).toBeNull();
  });

  test('createOne persists an affiliation that reads back through findOneById', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const org = freshId();
    const created = await repo.createOne({
      organizationId: org,
      personId: PERSON_1,
      chapterId: CHAPTER_1,
      isPrimary: true,
      affiliatedAt: new Date('2026-02-02T00:00:00.000Z'),
      status: 'active',
    } as any);

    const reread = await repo.findOneById(created.id);
    expect(reread?.organizationId).toBe(org);
    expect(reread?.isPrimary).toBe(true);
    expect(reread?.status).toBe('active');
  });

  test('updateOneById transitions status to withdrawn and bumps version', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const id = await insertAffiliation({ organizationId: ORG_A, status: 'active' });

    const updated = await repo.updateOneById(id, { status: 'withdrawn' } as any);
    expect(updated.status).toBe('withdrawn');
    expect(updated.version).toBe(2); // baseEntityFields default 1 → +1

    const reread = await repo.findOneById(id);
    expect(reread?.status).toBe('withdrawn');
  });

  test('deleteOneById hard-deletes the row', async () => {
    if (!H.dbReachable) return;
    const repo = new ChapterAffiliationRepository(H.db as any, noopLogger);
    const id = await insertAffiliation({ organizationId: ORG_A });
    await repo.deleteOneById(id);
    expect(await repo.findOneById(id)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AffiliationTransferRepository — dual-approval lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe('AffiliationTransferRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates transfers from another org', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertTransfer({ organizationId: orgX });
    await insertTransfer({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('status filter narrows to a single lifecycle state', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const org = freshId();
    const requested = await insertTransfer({ organizationId: org, status: 'requested' });
    const pendingSource = await insertTransfer({ organizationId: org, status: 'pendingSourceApproval' });
    const completed = await insertTransfer({ organizationId: org, status: 'completed' });

    expect((await repo.findMany({ organizationId: org, status: 'requested' })).map((r) => r.id)).toEqual([requested]);
    expect((await repo.findMany({ organizationId: org, status: 'pendingSourceApproval' })).map((r) => r.id)).toEqual([
      pendingSource,
    ]);
    expect((await repo.findMany({ organizationId: org, status: 'completed' })).map((r) => r.id)).toEqual([completed]);
  });

  test('fromChapterId + toChapterId filters narrow to the matching transfer', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const org = freshId();
    const wanted = await insertTransfer({ organizationId: org, fromChapterId: CHAPTER_1, toChapterId: CHAPTER_2 });
    await insertTransfer({ organizationId: org, fromChapterId: CHAPTER_2, toChapterId: CHAPTER_1 }); // reversed

    const rows = await repo.findMany({ organizationId: org, fromChapterId: CHAPTER_1, toChapterId: CHAPTER_2 });
    expect(rows.map((r) => r.id)).toEqual([wanted]);
  });

  test('personId filter narrows to the transferring member', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const org = freshId();
    const mine = await insertTransfer({ organizationId: org, personId: PERSON_1 });
    await insertTransfer({ organizationId: org, personId: PERSON_2 });

    const rows = await repo.findMany({ organizationId: org, personId: PERSON_1 });
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('count() reflects only the org-scoped transfers', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertTransfer({ organizationId: org });
    await insertTransfer({ organizationId: org });
    await insertTransfer({ organizationId: freshId() }); // different org

    expect(await repo.count({ organizationId: org })).toBe(2);
  });
});

describe('AffiliationTransferRepository dual-approval state machine (real DB)', () => {
  test('createOne defaults a brand-new transfer to status=requested with null approvers', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const created = await repo.createOne({
      organizationId: ORG_A,
      personId: PERSON_1,
      fromChapterId: CHAPTER_1,
      toChapterId: CHAPTER_2,
      requestedBy: PERSON_1,
    } as any);

    expect(created.status).toBe('requested');
    expect(created.approvedBySource).toBeNull();
    expect(created.approvedByTarget).toBeNull();
    expect(created.completedAt).toBeNull();
  });

  test('source approval persists approvedBySource and advances to pendingTargetApproval', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const id = await insertTransfer({ status: 'pendingSourceApproval', approvedBySource: null });

    const sourceOfficer = freshId();
    await repo.updateOneById(id, {
      approvedBySource: sourceOfficer,
      status: 'pendingTargetApproval',
    } as any);

    const reread = await repo.findOneById(id);
    expect(reread?.approvedBySource).toBe(sourceOfficer);
    expect(reread?.approvedByTarget).toBeNull(); // target approval still outstanding
    expect(reread?.status).toBe('pendingTargetApproval');
  });

  test('second (target) approval records both approvers and completes the transfer', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const sourceOfficer = freshId();
    const id = await insertTransfer({
      status: 'pendingTargetApproval',
      approvedBySource: sourceOfficer,
      approvedByTarget: null,
    });

    const targetOfficer = freshId();
    const completedAt = new Date('2026-03-03T00:00:00.000Z');
    await repo.updateOneById(id, {
      approvedByTarget: targetOfficer,
      status: 'completed',
      completedAt,
    } as any);

    const reread = await repo.findOneById(id);
    // Dual-approval invariant: BOTH approver columns populated once completed.
    expect(reread?.approvedBySource).toBe(sourceOfficer);
    expect(reread?.approvedByTarget).toBe(targetOfficer);
    expect(reread?.status).toBe('completed');
    expect(reread?.completedAt).not.toBeNull();
    expect(new Date(reread!.completedAt as any).getTime()).toBe(completedAt.getTime());
  });

  test('a denied transfer keeps the partial approver set and never completes', async () => {
    if (!H.dbReachable) return;
    const repo = new AffiliationTransferRepository(H.db as any, noopLogger);
    const sourceOfficer = freshId();
    const id = await insertTransfer({
      status: 'pendingTargetApproval',
      approvedBySource: sourceOfficer,
    });

    await repo.updateOneById(id, { status: 'denied' } as any);

    const reread = await repo.findOneById(id);
    expect(reread?.status).toBe('denied');
    expect(reread?.approvedBySource).toBe(sourceOfficer);
    expect(reread?.approvedByTarget).toBeNull();
    expect(reread?.completedAt).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RoyaltySplitRepository — national/chapter allocation
// ═══════════════════════════════════════════════════════════════════════════

describe('RoyaltySplitRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates splits from another org', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertSplit({ organizationId: orgX });
    await insertSplit({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('membershipId filter narrows to a single member configuration', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const org = freshId();
    const memberA = freshId();
    const memberB = freshId();
    const wanted = await insertSplit({ organizationId: org, membershipId: memberA });
    await insertSplit({ organizationId: org, membershipId: memberB });

    const rows = await repo.findMany({ organizationId: org, membershipId: memberA });
    expect(rows.map((r) => r.id)).toEqual([wanted]);
  });

  test('chapterId + nationalOrgId filters narrow to the matching split', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const org = freshId();
    const national = freshId();
    const wanted = await insertSplit({ organizationId: org, chapterId: CHAPTER_1, nationalOrgId: national });
    await insertSplit({ organizationId: org, chapterId: CHAPTER_2, nationalOrgId: national }); // wrong chapter
    await insertSplit({ organizationId: org, chapterId: CHAPTER_1, nationalOrgId: freshId() }); // wrong national org

    const rows = await repo.findMany({ organizationId: org, chapterId: CHAPTER_1, nationalOrgId: national });
    expect(rows.map((r) => r.id)).toEqual([wanted]);
  });

  test('count() reflects only the org-scoped splits', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertSplit({ organizationId: org });
    await insertSplit({ organizationId: org });
    await insertSplit({ organizationId: freshId() });

    expect(await repo.count({ organizationId: org })).toBe(2);
  });
});

describe('RoyaltySplitRepository allocation persistence (real DB)', () => {
  test('createOne round-trips the national/chapter percentages and effective date', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const org = freshId();
    const membership = freshId();
    const created = await repo.createOne({
      organizationId: org,
      membershipId: membership,
      nationalOrgId: org,
      chapterId: CHAPTER_1,
      splitPercentNational: 70,
      splitPercentChapter: 30,
      effectiveDate: '2026-04-01',
    } as any);

    const reread = await repo.findOneById(created.id);
    // 70/30 split round-trips intact (real-typed column, sums to 100).
    expect(reread?.splitPercentNational).toBe(70);
    expect(reread?.splitPercentChapter).toBe(30);
    expect(reread!.splitPercentNational + reread!.splitPercentChapter).toBe(100);
    expect(reread?.effectiveDate).toBe('2026-04-01');
  });

  test('fractional split percentages survive the real-typed round-trip', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const id = await insertSplit({ splitPercentNational: 62.5, splitPercentChapter: 37.5 });

    const reread = await repo.findOneById(id);
    expect(reread?.splitPercentNational).toBe(62.5);
    expect(reread?.splitPercentChapter).toBe(37.5);
  });

  test('updateOneById re-allocates the split and bumps version', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const id = await insertSplit({ splitPercentNational: 60, splitPercentChapter: 40 });

    const updated = await repo.updateOneById(id, {
      splitPercentNational: 50,
      splitPercentChapter: 50,
    } as any);
    expect(updated.splitPercentNational).toBe(50);
    expect(updated.splitPercentChapter).toBe(50);
    expect(updated.version).toBe(2);

    const reread = await repo.findOneById(id);
    expect(reread?.splitPercentNational).toBe(50);
    expect(reread?.splitPercentChapter).toBe(50);
  });

  test('deleteOneById hard-deletes the split row', async () => {
    if (!H.dbReachable) return;
    const repo = new RoyaltySplitRepository(H.db as any, noopLogger);
    const id = await insertSplit({});
    await repo.deleteOneById(id);
    expect(await repo.findOneById(id)).toBeNull();
  });
});
