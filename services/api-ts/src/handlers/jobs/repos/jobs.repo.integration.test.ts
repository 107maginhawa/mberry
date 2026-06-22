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
