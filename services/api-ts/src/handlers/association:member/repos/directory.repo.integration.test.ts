/**
 * Real-DB integration tests for the membership-domain DirectoryProfileRepository.
 *
 * The existing mock test (directory.repo.coverage.test.ts) only inspects the
 * Drizzle call recording on a scripted fake DB — it asserts that a `where`/
 * `orderBy`/`limit` op was *appended*, never that the resulting SQL is correct.
 * It cannot catch a busted visibility gate, an org-scope leak, a broken ILIKE
 * OR branch, a wrong publish/visibility filter, a cross-table dues/tier/chapter
 * subquery that joins the wrong column, a pagination off-by-one, or an ordering
 * regression — because no query ever touches Postgres.
 *
 * This suite drives the real query builders against REAL rows so the
 * buildWhereConditions matrix (org / person / visibility / q text-search),
 * the searchWithFilters visibility guard + cross-table dues/tier/chapter
 * subqueries + count/order/pagination, and the inherited CRUD path
 * (createOne / findOneById / findOne / updateOneById / count / findMany /
 * findManyWithPagination) all execute end-to-end. Every assertion checks the
 * REAL returned data (and persisted row state read back from Postgres) — never
 * merely "did not throw".
 *
 * Publish/unpublish semantics: the repo has no dedicated publish() method —
 * publishing is a visibility transition ('hidden' -> 'public'/'memberOnly')
 * plus publishedAt, performed via the inherited updateOneById. We exercise that
 * transition and read the persisted visibility/publishedAt back from PG, and we
 * prove searchWithFilters hides 'hidden' (unpublished) rows.
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public.directory_profile / public.membership /
 * public.chapter_affiliation structure (`CREATE TABLE … (LIKE … INCLUDING ALL)`),
 * so every real column/default/check/enum is present — no hand-DDL drift. FKs
 * are not copied, so rows insert directly without parent org/person/tier rows.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DirectoryProfileRepository } from './directory.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

function freshId(): string {
  return crypto.randomUUID();
}

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

/**
 * Insert a directory_profile row directly via raw SQL and return its id.
 * Raw SQL (rather than the repo) lets us seed arbitrary visibility /
 * publishedAt / displayName / bio / specialty / title combinations the read
 * side must filter on, including the 'hidden' (unpublished) state that the
 * search path must exclude.
 *
 * directory_profile NOT-NULL columns without a default: organization_id,
 * person_id, display_name. `visibility` defaults to 'hidden'; everything else
 * (base fields, last_updated_at) carries a default.
 */
async function insertProfile(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  displayName?: string;
  title?: string | null;
  specialty?: string | null;
  bio?: string | null;
  visibility?: 'public' | 'memberOnly' | 'hidden';
  publishedAt?: Date | null;
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".directory_profile
       (id, organization_id, person_id, display_name, title, specialty, bio,
        visibility, published_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? freshId(),
      opts.displayName ?? 'Member',
      opts.title === undefined ? null : opts.title,
      opts.specialty === undefined ? null : opts.specialty,
      opts.bio === undefined ? null : opts.bio,
      opts.visibility ?? 'hidden',
      opts.publishedAt === undefined ? null : opts.publishedAt,
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

/**
 * Insert a membership row (for the duesStatus / tier cross-table subqueries).
 * NOT-NULL without default: organization_id, person_id, tier_id, start_date.
 */
async function insertMembership(opts: {
  organizationId?: string;
  personId: string;
  tierId?: string;
  status?: 'pendingPayment' | 'active' | 'gracePeriod' | 'lapsed' | 'expired' | 'suspended' | 'removed';
  startDate?: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      freshId(),
      opts.organizationId ?? ORG_A,
      opts.personId,
      opts.tierId ?? freshId(),
      opts.startDate ?? '2026-01-01',
      opts.status ?? 'active',
    ],
  );
}

/**
 * Insert a chapter_affiliation row (for the chapter cross-table subquery).
 * NOT-NULL without default: organization_id, person_id, chapter_id, affiliated_at.
 */
async function insertAffiliation(opts: {
  organizationId?: string;
  personId: string;
  chapterId: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".chapter_affiliation
       (id, organization_id, person_id, chapter_id, affiliated_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      freshId(),
      opts.organizationId ?? ORG_A,
      opts.personId,
      opts.chapterId,
      new Date('2026-01-01T00:00:00.000Z'),
    ],
  );
}

beforeAll(async () => {
  H = await createScratch(['directory_profile', 'membership', 'chapter_affiliation']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── buildWhereConditions via findMany — filter matrix ────────────────────

describe('DirectoryProfileRepository.buildWhereConditions / findMany (real DB)', () => {
  test('no filters → unbounded read returns rows (DEFAULT_QUERY_LIMIT applied, no where)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const a = await insertProfile({ displayName: 'Alpha' });
    const b = await insertProfile({ displayName: 'Beta' });

    const rows = await repo.findMany();
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has(a)).toBe(true);
    expect(ids.has(b)).toBe(true);
  });

  test('organizationId filter isolates rows from another org (no cross-tenant leak)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertProfile({ organizationId: orgX });
    await insertProfile({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.organizationId === orgX)).toBe(true);
  });

  test('personId filter narrows to a single member', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const person = freshId();
    const target = await insertProfile({ organizationId: org, personId: person });
    await insertProfile({ organizationId: org, personId: freshId() });

    const rows = await repo.findMany({ organizationId: org, personId: person });
    expect(rows.map((r) => r.id)).toEqual([target]);
  });

  test('visibility filter narrows to the exact visibility state', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const pub = await insertProfile({ organizationId: org, visibility: 'public' });
    const member = await insertProfile({ organizationId: org, visibility: 'memberOnly' });
    const hidden = await insertProfile({ organizationId: org, visibility: 'hidden' });

    expect((await repo.findMany({ organizationId: org, visibility: 'public' })).map((r) => r.id)).toEqual([pub]);
    expect((await repo.findMany({ organizationId: org, visibility: 'memberOnly' })).map((r) => r.id)).toEqual([member]);
    expect((await repo.findMany({ organizationId: org, visibility: 'hidden' })).map((r) => r.id)).toEqual([hidden]);
  });

  test('q text-search matches across displayName / title / specialty / bio (case-insensitive ILIKE)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const byName = await insertProfile({ organizationId: org, displayName: 'Cardiology Smith' });
    const byTitle = await insertProfile({ organizationId: org, displayName: 'Q1', title: 'Senior Cardiologist' });
    const bySpecialty = await insertProfile({ organizationId: org, displayName: 'Q2', specialty: 'Pediatric Cardio' });
    const byBio = await insertProfile({ organizationId: org, displayName: 'Q3', bio: 'Loves cardio research' });
    // Unrelated row — must NOT match the term.
    await insertProfile({ organizationId: org, displayName: 'Dermatology', bio: 'skin' });

    // lowercase term proves ILIKE case-insensitivity against the mixed-case data.
    const rows = await repo.findMany({ organizationId: org, q: 'cardio' });
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([byName, byTitle, bySpecialty, byBio]));
  });

  test('q with a term present in NO column returns nothing', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertProfile({ organizationId: org, displayName: 'Smith', bio: 'general' });
    expect(await repo.findMany({ organizationId: org, q: 'zzznomatch' })).toEqual([]);
  });

  test('combined org + visibility + q narrows on all three (AND semantics)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const hit = await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Public Cardio' });
    // Right text, wrong visibility — excluded by the visibility predicate.
    await insertProfile({ organizationId: org, visibility: 'hidden', displayName: 'Hidden Cardio' });
    // Right visibility + org, wrong text — excluded by q.
    await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Public Derm' });
    // Right everything but wrong org — excluded by org.
    await insertProfile({ organizationId: freshId(), visibility: 'public', displayName: 'Other Cardio' });

    const rows = await repo.findMany({ organizationId: org, visibility: 'public', q: 'cardio' });
    expect(rows.map((r) => r.id)).toEqual([hit]);
  });

  test('findMany orders by created_at and honours pagination limit/offset', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const first = await insertProfile({ organizationId: org, createdAt: new Date('2026-01-02T00:00:00Z') });
    const second = await insertProfile({ organizationId: org, createdAt: new Date('2026-01-03T00:00:00Z') });
    const third = await insertProfile({ organizationId: org, createdAt: new Date('2026-01-04T00:00:00Z') });

    const all = await repo.findMany({ organizationId: org });
    expect(all.map((r) => r.id)).toEqual([first, second, third]);

    // page 1 (limit 2, offset 0)
    const page1 = await repo.findMany({ organizationId: org }, { pagination: { offset: 0, limit: 2 } });
    expect(page1.map((r) => r.id)).toEqual([first, second]);
    // page 2 (limit 2, offset 2)
    const page2 = await repo.findMany({ organizationId: org }, { pagination: { offset: 2, limit: 2 } });
    expect(page2.map((r) => r.id)).toEqual([third]);
  });
});

// ─── findOne / findOneById / count (inherited reads through this repo) ─────

describe('DirectoryProfileRepository.findOne / findOneById / count (real DB)', () => {
  test('findOne returns the matching profile by org+person filter', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const person = freshId();
    const id = await insertProfile({ organizationId: org, personId: person, displayName: 'Solo' });

    const found = await repo.findOne({ organizationId: org, personId: person });
    expect(found?.id).toBe(id);
    expect(found?.displayName).toBe('Solo');
  });

  test('findOne returns null when nothing matches', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    expect(await repo.findOne({ organizationId: freshId(), personId: freshId() })).toBeNull();
  });

  test('findOneById returns the row, and null for an unknown id', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const id = await insertProfile({ displayName: 'ById' });
    expect((await repo.findOneById(id))?.displayName).toBe('ById');
    expect(await repo.findOneById(freshId())).toBeNull();
  });

  test('count respects the same filter matrix as findMany', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertProfile({ organizationId: org, visibility: 'public' });
    await insertProfile({ organizationId: org, visibility: 'public' });
    await insertProfile({ organizationId: org, visibility: 'hidden' });
    await insertProfile({ organizationId: freshId(), visibility: 'public' });

    expect(await repo.count({ organizationId: org })).toBe(3);
    expect(await repo.count({ organizationId: org, visibility: 'public' })).toBe(2);
  });
});

// ─── createOne / updateOneById — publish/unpublish transition + persistence ─

describe('DirectoryProfileRepository create + publish/unpublish (real DB)', () => {
  test('createOne persists a hidden draft (visibility default) read back from PG', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const created = await repo.createOne({
      organizationId: ORG_A,
      personId: freshId(),
      displayName: 'Draft Member',
    } as any);

    expect(created.visibility).toBe('hidden');
    expect(created.publishedAt).toBeNull();

    // Read back independently of the returning() row.
    const { rows } = await H.scopedPool.query(
      `SELECT visibility, published_at FROM "${H.schema}".directory_profile WHERE id = $1`,
      [created.id],
    );
    expect(rows[0].visibility).toBe('hidden');
    expect(rows[0].published_at).toBeNull();
  });

  test('publish: hidden -> public + publishedAt is persisted', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const id = await insertProfile({ visibility: 'hidden', publishedAt: null });
    const publishedAt = new Date('2026-06-21T10:00:00.000Z');

    const updated = await repo.updateOneById(id, {
      visibility: 'public',
      publishedAt,
    } as any);
    expect(updated.visibility).toBe('public');
    expect(updated.version).toBe(2); // optimistic-lock bump from base updateOneById

    const { rows } = await H.scopedPool.query(
      `SELECT visibility, published_at, version FROM "${H.schema}".directory_profile WHERE id = $1`,
      [id],
    );
    expect(rows[0].visibility).toBe('public');
    expect(new Date(rows[0].published_at).toISOString()).toBe(publishedAt.toISOString());
    expect(rows[0].version).toBe(2);
  });

  test('unpublish: public -> hidden is persisted (now excluded from search)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const id = await insertProfile({ organizationId: org, visibility: 'public', displayName: 'WasPublic' });

    await repo.updateOneById(id, { visibility: 'hidden' } as any);

    const { rows } = await H.scopedPool.query(
      `SELECT visibility FROM "${H.schema}".directory_profile WHERE id = $1`,
      [id],
    );
    expect(rows[0].visibility).toBe('hidden');

    // The now-hidden profile must drop out of the public search surface.
    const search = await repo.searchWithFilters({ organizationId: org }, { offset: 0, limit: 50 });
    expect(search.data.map((r) => r.id)).not.toContain(id);
    expect(search.totalCount).toBe(0);
  });
});

// ─── searchWithFilters — visibility guard + count/order/pagination ─────────

describe('DirectoryProfileRepository.searchWithFilters visibility + paging (real DB)', () => {
  test('returns only public + memberOnly profiles; hidden are excluded', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const pub = await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Anna' });
    const member = await insertProfile({ organizationId: org, visibility: 'memberOnly', displayName: 'Bob' });
    await insertProfile({ organizationId: org, visibility: 'hidden', displayName: 'Carol' });

    const res = await repo.searchWithFilters({ organizationId: org }, { offset: 0, limit: 50 });
    expect(new Set(res.data.map((r) => r.id))).toEqual(new Set([pub, member]));
    expect(res.totalCount).toBe(2);
  });

  test('org-scopes the search — another org\'s public profiles are excluded', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const mine = await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Mine' });
    await insertProfile({ organizationId: freshId(), visibility: 'public', displayName: 'Theirs' });

    const res = await repo.searchWithFilters({ organizationId: org }, { offset: 0, limit: 50 });
    expect(res.data.map((r) => r.id)).toEqual([mine]);
    expect(res.totalCount).toBe(1);
  });

  test('orders by displayName and paginates (count reflects full set, data is the page)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    // Insert out of alphabetical order to prove the ORDER BY display_name.
    await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Delta' });
    await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Alpha' });
    await insertProfile({ organizationId: org, visibility: 'memberOnly', displayName: 'Charlie' });
    await insertProfile({ organizationId: org, visibility: 'public', displayName: 'Bravo' });

    const page1 = await repo.searchWithFilters({ organizationId: org }, { offset: 0, limit: 2 });
    expect(page1.data.map((r) => r.displayName)).toEqual(['Alpha', 'Bravo']);
    expect(page1.totalCount).toBe(4); // count ignores limit/offset

    const page2 = await repo.searchWithFilters({ organizationId: org }, { offset: 2, limit: 2 });
    expect(page2.data.map((r) => r.displayName)).toEqual(['Charlie', 'Delta']);
    expect(page2.totalCount).toBe(4);
  });

  test('q text-search narrows the public set (case-insensitive)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const hit = await insertProfile({ organizationId: org, visibility: 'public', specialty: 'Orthodontics' });
    await insertProfile({ organizationId: org, visibility: 'public', specialty: 'Endodontics' });

    const res = await repo.searchWithFilters({ organizationId: org, q: 'ortho' }, { offset: 0, limit: 50 });
    expect(res.data.map((r) => r.id)).toEqual([hit]);
    expect(res.totalCount).toBe(1);
  });
});

// ─── searchWithFilters — cross-table dues/tier/chapter subqueries ──────────

describe('DirectoryProfileRepository.searchWithFilters cross-table subqueries (real DB)', () => {
  test('duesStatus=current keeps only members with an active/gracePeriod membership', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const activePerson = freshId();
    const gracePerson = freshId();
    const lapsedPerson = freshId();
    const noMembershipPerson = freshId();

    const activeProfile = await insertProfile({ organizationId: org, personId: activePerson, visibility: 'public', displayName: 'A Active' });
    const graceProfile = await insertProfile({ organizationId: org, personId: gracePerson, visibility: 'public', displayName: 'B Grace' });
    await insertProfile({ organizationId: org, personId: lapsedPerson, visibility: 'public', displayName: 'C Lapsed' });
    await insertProfile({ organizationId: org, personId: noMembershipPerson, visibility: 'public', displayName: 'D None' });

    await insertMembership({ organizationId: org, personId: activePerson, status: 'active' });
    await insertMembership({ organizationId: org, personId: gracePerson, status: 'gracePeriod' });
    await insertMembership({ organizationId: org, personId: lapsedPerson, status: 'lapsed' });
    // noMembershipPerson has no membership row at all.

    const res = await repo.searchWithFilters(
      { organizationId: org, duesStatus: 'current' },
      { offset: 0, limit: 50 },
    );
    expect(new Set(res.data.map((r) => r.id))).toEqual(new Set([activeProfile, graceProfile]));
    expect(res.totalCount).toBe(2);
  });

  test('duesStatus subquery is org-scoped — a current membership in another org does not qualify', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const person = freshId();
    await insertProfile({ organizationId: org, personId: person, visibility: 'public', displayName: 'Cross' });
    // Active membership but in a DIFFERENT org — the subquery filters on org.
    await insertMembership({ organizationId: freshId(), personId: person, status: 'active' });

    const res = await repo.searchWithFilters(
      { organizationId: org, duesStatus: 'current' },
      { offset: 0, limit: 50 },
    );
    expect(res.data).toEqual([]);
    expect(res.totalCount).toBe(0);
  });

  test('tier filter keeps only members whose membership has the given tier', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const tierGold = freshId();
    const tierSilver = freshId();
    const goldPerson = freshId();
    const silverPerson = freshId();

    const goldProfile = await insertProfile({ organizationId: org, personId: goldPerson, visibility: 'public', displayName: 'Gold' });
    await insertProfile({ organizationId: org, personId: silverPerson, visibility: 'public', displayName: 'Silver' });

    await insertMembership({ organizationId: org, personId: goldPerson, tierId: tierGold });
    await insertMembership({ organizationId: org, personId: silverPerson, tierId: tierSilver });

    const res = await repo.searchWithFilters(
      { organizationId: org, tier: tierGold },
      { offset: 0, limit: 50 },
    );
    expect(res.data.map((r) => r.id)).toEqual([goldProfile]);
    expect(res.totalCount).toBe(1);
  });

  test('chapter filter keeps only members affiliated with the given chapter (org-scoped)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const chapterNorth = freshId();
    const chapterSouth = freshId();
    const northPerson = freshId();
    const southPerson = freshId();
    const crossOrgPerson = freshId();

    const northProfile = await insertProfile({ organizationId: org, personId: northPerson, visibility: 'public', displayName: 'North' });
    await insertProfile({ organizationId: org, personId: southPerson, visibility: 'public', displayName: 'South' });
    await insertProfile({ organizationId: org, personId: crossOrgPerson, visibility: 'public', displayName: 'CrossOrg' });

    await insertAffiliation({ organizationId: org, personId: northPerson, chapterId: chapterNorth });
    await insertAffiliation({ organizationId: org, personId: southPerson, chapterId: chapterSouth });
    // Right chapter id, but the affiliation lives in another org — must not qualify.
    await insertAffiliation({ organizationId: freshId(), personId: crossOrgPerson, chapterId: chapterNorth });

    const res = await repo.searchWithFilters(
      { organizationId: org, chapter: chapterNorth },
      { offset: 0, limit: 50 },
    );
    expect(res.data.map((r) => r.id)).toEqual([northProfile]);
    expect(res.totalCount).toBe(1);
  });

  test('combined tier + chapter + duesStatus AND together (all subqueries must match)', async () => {
    if (!H.dbReachable) return;
    const repo = new DirectoryProfileRepository(H.db as any, noopLogger);
    const org = freshId();
    const tier = freshId();
    const chapter = freshId();

    const fullMatch = freshId();
    const wrongTier = freshId();
    const noChapter = freshId();

    const matchProfile = await insertProfile({ organizationId: org, personId: fullMatch, visibility: 'public', displayName: 'Full' });
    await insertProfile({ organizationId: org, personId: wrongTier, visibility: 'public', displayName: 'WrongTier' });
    await insertProfile({ organizationId: org, personId: noChapter, visibility: 'public', displayName: 'NoChapter' });

    // Full match: active membership w/ tier + chapter affiliation.
    await insertMembership({ organizationId: org, personId: fullMatch, tierId: tier, status: 'active' });
    await insertAffiliation({ organizationId: org, personId: fullMatch, chapterId: chapter });

    // Wrong tier: active + chapter, but a different tier.
    await insertMembership({ organizationId: org, personId: wrongTier, tierId: freshId(), status: 'active' });
    await insertAffiliation({ organizationId: org, personId: wrongTier, chapterId: chapter });

    // No chapter: active membership w/ right tier, but no chapter affiliation.
    await insertMembership({ organizationId: org, personId: noChapter, tierId: tier, status: 'active' });

    const res = await repo.searchWithFilters(
      { organizationId: org, tier, chapter, duesStatus: 'current' },
      { offset: 0, limit: 50 },
    );
    expect(res.data.map((r) => r.id)).toEqual([matchProfile]);
    expect(res.totalCount).toBe(1);
  });
});
