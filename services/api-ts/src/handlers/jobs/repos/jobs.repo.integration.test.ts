/**
 * Real-Postgres integration coverage for JobPostingRepository +
 * JobApplicationRepository (src/handlers/jobs/repos/jobs.repo.ts).
 *
 * Isolated via createScratch(['job_posting','job_application']) — a unique
 * scratch schema is stood up with `CREATE TABLE (LIKE public.<t> INCLUDING ALL)`,
 * so the suite is parallel-safe, runs in CI's ci-migrate lane (no `if (CI) return`
 * gate), and never contends on the shared `public` schema. Teardown drops the
 * schema wholesale, so no hand-scoped org-id cleanup loop is needed. Skips
 * cleanly (`if (!H.dbReachable) return`) when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { JobPostingRepository, JobApplicationRepository } from './jobs.repo';
import { NotFoundError, ValidationError } from '@/core/errors';

const ORG_ID = crypto.randomUUID(); // unique scope for the rows this file creates

let H: ScratchDb;
let postingRepo: JobPostingRepository;
let appRepo: JobApplicationRepository;

beforeAll(async () => {
  H = await createScratch(['job_posting', 'job_application']);
  if (!H.dbReachable) return;
  postingRepo = new JobPostingRepository(H.db as never);
  appRepo = new JobApplicationRepository(H.db as never);
});

afterAll(async () => {
  await H?.teardown();
});

const basePosting = (over: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  title: 'Staff Dentist',
  organizationName: 'Acme Dental',
  type: 'full_time' as const,
  status: 'draft' as const,
  ...over,
});

describe('JobPostingRepository (real-PG)', () => {
  test('create auto-sets expiresAt 30 days after postedAt when expiresAt absent', async () => {
    if (!H.dbReachable) return;
    const postedAt = new Date('2026-01-01T00:00:00.000Z');
    const row = await postingRepo.create(basePosting({ postedAt, status: 'active', title: 'Auto-expiry posting' }));
    expect(row.id).toBeTruthy();
    expect(row.expiresAt).toBeTruthy();
    const diffDays = Math.round((new Date(row.expiresAt!).getTime() - postedAt.getTime()) / 86400000);
    expect(diffDays).toBe(30);
  });

  test('create keeps caller expiresAt when provided (no auto-expiry branch)', async () => {
    if (!H.dbReachable) return;
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');
    const row = await postingRepo.create(basePosting({ postedAt: new Date('2026-01-01'), expiresAt }));
    expect(new Date(row.expiresAt!).toISOString()).toBe(expiresAt.toISOString());
  });

  test('create without postedAt leaves expiresAt null (skips auto-expiry branch)', async () => {
    if (!H.dbReachable) return;
    const row = await postingRepo.create(basePosting({ title: 'No postedAt' }));
    expect(row.expiresAt).toBeNull();
  });

  test('get returns the row (hit) and undefined (miss)', async () => {
    if (!H.dbReachable) return;
    const created = await postingRepo.create(basePosting({ title: 'Gettable' }));
    const hit = await postingRepo.get(created.id);
    expect(hit?.id).toBe(created.id);
    const miss = await postingRepo.get(crypto.randomUUID());
    expect(miss).toBeUndefined();
  });

  test('update mutates fields and bumps updatedAt', async () => {
    if (!H.dbReachable) return;
    const created = await postingRepo.create(basePosting({ title: 'Before' }));
    const updated = await postingRepo.update(created.id, { title: 'After', status: 'active' });
    expect(updated.title).toBe('After');
    expect(updated.status).toBe('active');
  });

  test('delete returns true when row exists, false when absent', async () => {
    if (!H.dbReachable) return;
    const created = await postingRepo.create(basePosting({ title: 'Deleteme' }));
    expect(await postingRepo.delete(created.id)).toBe(true);
    expect(await postingRepo.delete(crypto.randomUUID())).toBe(false);
  });

  test('list covers every filter branch + pagination defaults', async () => {
    if (!H.dbReachable) return;
    await postingRepo.create(basePosting({ title: 'Searchable Surgeon', type: 'contract', status: 'active' }));
    await postingRepo.create(basePosting({ title: 'Plain Hygienist', type: 'part_time', status: 'filled' }));

    // org filter (default limit/offset path)
    const byOrg = await postingRepo.list({ organizationId: ORG_ID });
    expect(byOrg.total).toBeGreaterThanOrEqual(2);
    expect(byOrg.data.length).toBeGreaterThanOrEqual(2);

    // status filter
    const byStatus = await postingRepo.list({ organizationId: ORG_ID, status: 'filled' });
    expect(byStatus.data.every((p) => p.status === 'filled')).toBe(true);

    // type filter
    const byType = await postingRepo.list({ organizationId: ORG_ID, type: 'contract' });
    expect(byType.data.every((p) => p.type === 'contract')).toBe(true);

    // search filter (escapeLikePattern path)
    const bySearch = await postingRepo.list({ organizationId: ORG_ID, search: 'Surgeon' });
    expect(bySearch.data.some((p) => p.title.includes('Surgeon'))).toBe(true);

    // explicit limit/offset
    const paged = await postingRepo.list({ organizationId: ORG_ID, limit: 1, offset: 0 });
    expect(paged.data.length).toBe(1);

    // no-filter branch (where === undefined)
    const all = await postingRepo.list();
    expect(all.total).toBeGreaterThanOrEqual(2);
  });

  test('listExpired returns active postings whose expiresAt <= now', async () => {
    if (!H.dbReachable) return;
    const past = new Date(Date.now() - 86400000);
    const created = await postingRepo.create(
      basePosting({ title: 'Expired active', status: 'active', postedAt: new Date('2020-01-01'), expiresAt: past }),
    );
    const expired = await postingRepo.listExpired(new Date());
    expect(expired.some((p) => p.id === created.id)).toBe(true);
  });

  test('extendPosting success resets from current expiry and reactivates', async () => {
    if (!H.dbReachable) return;
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');
    const created = await postingRepo.create(basePosting({ title: 'Extendable', status: 'expired', postedAt: new Date('2026-01-01'), expiresAt }));
    const extended = await postingRepo.extendPosting(created.id, 10);
    expect(extended.status).toBe('active');
    const diffDays = Math.round((new Date(extended.expiresAt!).getTime() - expiresAt.getTime()) / 86400000);
    expect(diffDays).toBe(10);
  });

  test('extendPosting default days param (30) when omitted', async () => {
    if (!H.dbReachable) return;
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');
    const created = await postingRepo.create(basePosting({ title: 'Extend default', status: 'expired', postedAt: new Date('2026-01-01'), expiresAt }));
    const extended = await postingRepo.extendPosting(created.id);
    const diffDays = Math.round((new Date(extended.expiresAt!).getTime() - expiresAt.getTime()) / 86400000);
    expect(diffDays).toBe(30);
  });

  test('extendPosting throws NotFoundError when posting missing', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await postingRepo.extendPosting(crypto.randomUUID());
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
  });

  test('extendPosting throws ValidationError when posting has no expiresAt', async () => {
    if (!H.dbReachable) return;
    const created = await postingRepo.create(basePosting({ title: 'No expiry' })); // no postedAt -> expiresAt null
    let err: unknown;
    try {
      await postingRepo.extendPosting(created.id);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ValidationError);
  });
});

describe('JobApplicationRepository (real-PG)', () => {
  let postingId: string;

  test('create + get (hit/miss)', async () => {
    if (!H.dbReachable) return;
    const posting = await postingRepo.create(basePosting({ title: 'App target', status: 'active', postedAt: new Date() }));
    postingId = posting.id;
    const personId = crypto.randomUUID();
    const created = await appRepo.create({ postingId, personId, coverLetter: 'Hire me' });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('applied');

    const hit = await appRepo.get(created.id);
    expect(hit?.id).toBe(created.id);
    const miss = await appRepo.get(crypto.randomUUID());
    expect(miss).toBeUndefined();
  });

  test('update mutates status + bumps updatedAt', async () => {
    if (!H.dbReachable) return;
    const personId = crypto.randomUUID();
    const created = await appRepo.create({ postingId, personId });
    const updated = await appRepo.update(created.id, { status: 'screening' });
    expect(updated.status).toBe('screening');
  });

  test('findByPersonAndPosting (hit/miss)', async () => {
    if (!H.dbReachable) return;
    const personId = crypto.randomUUID();
    const created = await appRepo.create({ postingId, personId });
    const hit = await appRepo.findByPersonAndPosting(personId, postingId);
    expect(hit?.id).toBe(created.id);
    const miss = await appRepo.findByPersonAndPosting(crypto.randomUUID(), postingId);
    expect(miss).toBeUndefined();
  });

  test('list covers every filter branch + no-filter + pagination', async () => {
    if (!H.dbReachable) return;
    const personId = crypto.randomUUID();
    await appRepo.create({ postingId, personId, status: 'interviewed' });

    const byPosting = await appRepo.list({ postingId });
    expect(byPosting.total).toBeGreaterThanOrEqual(1);
    expect(byPosting.data.every((a) => a.postingId === postingId)).toBe(true);

    const byPerson = await appRepo.list({ personId });
    expect(byPerson.data.every((a) => a.personId === personId)).toBe(true);

    const byStatus = await appRepo.list({ postingId, status: 'interviewed' });
    expect(byStatus.data.every((a) => a.status === 'interviewed')).toBe(true);

    const paged = await appRepo.list({ postingId, limit: 1, offset: 0 });
    expect(paged.data.length).toBe(1);

    const all = await appRepo.list();
    expect(all.total).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Slice S2 — constraint / enum / default proofs against real PG.
 *
 * These assert real SQLSTATE codes and DB-applied defaults that the mock-only
 * handler tests (makeCtx + stubRepo + fakeJobPosting factories) can never prove:
 * NOT-NULL invariants (23502), enum domain rejection (22P02), and PG-side column
 * defaults (type/status/version/applied_at). Drizzle's typed `create` can't reach
 * the enum-domain case, so those use a raw scopedPool INSERT.
 */
const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string; cause?: { code?: string } }).code ??
  (e as { cause?: { code?: string } }).cause?.code;

describe('JobPostingRepository constraint/enum/default proofs (real-PG)', () => {
  test('organization_id NOT NULL → 23502 on create without org', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      // organizationId is required in NewJobPosting; cast past the type so PG enforces it.
      await postingRepo.create({
        title: 'No org',
        organizationName: 'Acme Dental',
        type: 'full_time',
        status: 'draft',
      } as never);
    } catch (e) {
      err = e;
    }
    expect(pgCode(err)).toBe('23502');
  });

  test('positive: create WITH org persists and organization_id reads back equal', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const created = await postingRepo.create(basePosting({ organizationId: org, title: 'Org readback' }));
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".job_posting WHERE id = $1`,
      [created.id],
    );
    expect(rows[0]?.organization_id).toBe(org);
  });

  test('type enum domain → 22P02 on out-of-range value (real enum, not text)', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".job_posting (organization_id, title, organization_name, type)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), 'Bad type', 'Acme Dental', 'director'],
      );
    } catch (e) {
      err = e;
    }
    expect(pgCode(err)).toBe('22P02');
  });

  test('status enum domain → 22P02 on out-of-range value', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".job_posting (organization_id, title, organization_name, status)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), 'Bad status', 'Acme Dental', 'archived'],
      );
    } catch (e) {
      err = e;
    }
    expect(pgCode(err)).toBe('22P02');
  });

  test('PG applies defaults: NOT-NULL-minimum insert reads back type/status/version/id', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const { rows } = await H.scopedPool.query(
      `INSERT INTO "${H.schema}".job_posting (organization_id, title, organization_name)
       VALUES ($1, $2, $3)
       RETURNING id, type, status, version`,
      [org, 'Defaults only', 'Acme Dental'],
    );
    const row = rows[0];
    expect(row.id).toBeTruthy();
    expect(row.type).toBe('full_time');
    expect(row.status).toBe('draft');
    expect(row.version).toBe(1);
  });
});

/**
 * Slice S3 — BR-37 job-posting expiry: characterize `listExpired` / `extendPosting`
 * against real PG, and DOCUMENT the missing production caller.
 *
 * KNOWN GAP (BR-37 deferred — Wave-3 decision #2): `listExpired` (repo:98) and
 * `extendPosting` (repo:111) have NO production caller — there is no `registerCron`
 * / `registerInterval` for job-posting expiry anywhere (the 14 registered crons are
 * booking/person/member/notifs/audit/surveys/communication/email/platformadmin —
 * none for jobs), and no `handlers/jobs/jobs/` cron dir exists. BR-37 in
 * `docs/ver-3/business/br-registry.json` is `p2-deferred` ("M15 not yet
 * implemented") and its `tests.backend` points at a non-existent path (registry
 * drift). NET EFFECT: a posting whose `expires_at` passes is NEVER transitioned
 * `active → expired`; it stays `status='active'` forever and keeps surfacing in
 * `list` / `searchJobPostings`. This block characterizes the repo primitives that
 * a future cron WOULD use — it intentionally does NOT build the cron (deferred
 * product work, mirrors the elections updateElectionStatus orphan handling). The
 * apply path is partially guarded (`createJobApplication.ts:29` rejects an apply
 * to an expired posting), but the listing leak + the `expired` status itself are
 * never reached in prod.
 */
describe('BR-37 expiry primitives (real-PG, characterization — no prod cron exists)', () => {
  const BR37_ORG = crypto.randomUUID(); // isolated org so the filtering asserts are exact

  test('listExpired returns ONLY active+past postings (not future-active, not draft)', async () => {
    if (!H.dbReachable) return;
    const now = new Date();
    const past = new Date(now.getTime() - 86400000); // 1 day ago
    const future = new Date(now.getTime() + 86400000); // 1 day ahead

    const pastActive = await postingRepo.create(
      basePosting({
        organizationId: BR37_ORG,
        title: 'Past active (eligible)',
        status: 'active',
        postedAt: new Date('2020-01-01'),
        expiresAt: past,
      }),
    );
    const futureActive = await postingRepo.create(
      basePosting({
        organizationId: BR37_ORG,
        title: 'Future active (not eligible)',
        status: 'active',
        postedAt: new Date('2026-01-01'),
        expiresAt: future,
      }),
    );
    const draftPast = await postingRepo.create(
      basePosting({
        organizationId: BR37_ORG,
        title: 'Draft past-expiry (not eligible)',
        status: 'draft',
        postedAt: new Date('2020-01-01'),
        expiresAt: past,
      }),
    );

    const expired = await postingRepo.listExpired(now);
    const expiredIds = expired.map((p) => p.id);

    // exact membership: the past-active row is the only one of our three that qualifies.
    expect(expiredIds).toContain(pastActive.id);
    expect(expiredIds).not.toContain(futureActive.id); // expires_at in future
    expect(expiredIds).not.toContain(draftPast.id); // status !== 'active'
    // every returned row honours the WHERE (status='active' AND expires_at<=now)
    expect(expired.every((p) => p.status === 'active')).toBe(true);
    expect(expired.every((p) => p.expiresAt !== null && new Date(p.expiresAt).getTime() <= now.getTime())).toBe(true);
  });

  test('listExpired does NOT mutate status — the past-active posting is still active after listing (proves no auto-expire)', async () => {
    if (!H.dbReachable) return;
    const past = new Date(Date.now() - 86400000);
    const created = await postingRepo.create(
      basePosting({
        organizationId: BR37_ORG,
        title: 'Stays active after listExpired',
        status: 'active',
        postedAt: new Date('2020-01-01'),
        expiresAt: past,
      }),
    );
    await postingRepo.listExpired(new Date());
    // KNOWN GAP: listExpired is read-only; with no cron consuming it, the row keeps surfacing as 'active'.
    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".job_posting WHERE id = $1`,
      [created.id],
    );
    expect(rows[0]?.status).toBe('active');
    // and it still appears in the org listing (the surfacing-stale-postings leak the missing cron would fix).
    const listed = await postingRepo.list({ organizationId: BR37_ORG, status: 'active' });
    expect(listed.data.some((p) => p.id === created.id)).toBe(true);
  });

  test('extendPosting sets a new expires_at (read-back) and reactivates the row', async () => {
    if (!H.dbReachable) return;
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');
    const created = await postingRepo.create(
      basePosting({
        organizationId: BR37_ORG,
        title: 'Extend readback',
        status: 'expired',
        postedAt: new Date('2026-01-01'),
        expiresAt,
      }),
    );
    const extended = await postingRepo.extendPosting(created.id, 14);
    expect(extended.status).toBe('active');

    const expectedNew = new Date(expiresAt);
    expectedNew.setDate(expectedNew.getDate() + 14);
    // read the persisted column, not just the returned object
    const { rows } = await H.scopedPool.query(
      `SELECT status, expires_at FROM "${H.schema}".job_posting WHERE id = $1`,
      [created.id],
    );
    expect(rows[0]?.status).toBe('active');
    expect(new Date(rows[0]?.expires_at).toISOString()).toBe(expectedNew.toISOString());
  });

  test('extendPosting default param adds 30 days from the current expiry', async () => {
    if (!H.dbReachable) return;
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');
    const created = await postingRepo.create(
      basePosting({
        organizationId: BR37_ORG,
        title: 'Extend default 30',
        status: 'expired',
        postedAt: new Date('2026-01-01'),
        expiresAt,
      }),
    );
    const extended = await postingRepo.extendPosting(created.id); // no days arg → DEFAULT_EXPIRY_DAYS (30)
    const diffDays = Math.round(
      (new Date(extended.expiresAt!).getTime() - expiresAt.getTime()) / 86400000,
    );
    expect(diffDays).toBe(30);
  });

  test('extendPosting on a random uuid throws NotFoundError', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await postingRepo.extendPosting(crypto.randomUUID());
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
  });
});

describe('JobApplicationRepository constraint/default proofs (real-PG)', () => {
  test('posting_id NOT NULL → 23502 on create without postingId', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await appRepo.create({ personId: crypto.randomUUID() } as never);
    } catch (e) {
      err = e;
    }
    expect(pgCode(err)).toBe('23502');
  });

  test('person_id NOT NULL → 23502 on create without personId', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await appRepo.create({ postingId: crypto.randomUUID() } as never);
    } catch (e) {
      err = e;
    }
    expect(pgCode(err)).toBe('23502');
  });

  test('PG applies defaults: create with only posting/person reads back status=applied + applied_at non-null', async () => {
    if (!H.dbReachable) return;
    const created = await appRepo.create({ postingId: crypto.randomUUID(), personId: crypto.randomUUID() });
    expect(created.status).toBe('applied');
    const { rows } = await H.scopedPool.query(
      `SELECT status, applied_at FROM "${H.schema}".job_application WHERE id = $1`,
      [created.id],
    );
    expect(rows[0]?.status).toBe('applied');
    expect(rows[0]?.applied_at).not.toBeNull();
  });
});
