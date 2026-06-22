/**
 * Real-PG integration for BR-37 job-posting expiry: the expiry cron, the
 * 3-days-before reminder cron, the public-board exclusion of expired postings,
 * and the extend (resets-from-current-expiry) behavior. createScratch isolates
 * a job_posting/job_application schema; skips cleanly when DB is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { JobPostingRepository } from '../repos/jobs.repo';
import { processJobPostingExpiry, processJobPostingExpiryReminders } from './jobPostingExpiry';

const ORG = crypto.randomUUID();
let H: ScratchDb;
let repo: JobPostingRepository;

beforeAll(async () => {
  H = await createScratch(['job_posting', 'job_application']);
  if (H.dbReachable) repo = new JobPostingRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

function daysFromNow(now: Date, d: number): Date {
  const x = new Date(now);
  x.setUTCDate(x.getUTCDate() + d);
  return x;
}

const base = (over: Record<string, unknown> = {}) => ({
  organizationId: ORG,
  title: 'Staff Dentist',
  organizationName: 'Acme Dental',
  type: 'full_time' as const,
  status: 'active' as const,
  postedBy: crypto.randomUUID(),
  ...over,
});

describe('BR-37 job posting expiry — real PG', () => {
  test('expiry cron flips overdue active postings to expired; future ones untouched', async () => {
    if (!H.dbReachable) return;
    const now = new Date('2026-06-22T00:00:00.000Z');
    const overdue = await repo.create(base({ expiresAt: daysFromNow(now, -1) }) as never);
    const future = await repo.create(base({ expiresAt: daysFromNow(now, 10) }) as never);

    const res = await processJobPostingExpiry({ db: H.db as never, now });
    expect(res.expired).toBe(1);
    expect((await repo.get(overdue.id))?.status).toBe('expired');
    expect((await repo.get(future.id))?.status).toBe('active');
  });

  test('reminder cron notifies the poster exactly 3 days before expiry (not 1 or 5)', async () => {
    if (!H.dbReachable) return;
    const now = new Date('2026-07-01T00:00:00.000Z');
    const in3 = await repo.create(base({ expiresAt: daysFromNow(now, 3) }) as never);
    await repo.create(base({ expiresAt: daysFromNow(now, 5) }) as never);
    await repo.create(base({ expiresAt: daysFromNow(now, 1) }) as never);

    const sent: Array<Record<string, unknown>> = [];
    const res = await processJobPostingExpiryReminders({
      db: H.db as never,
      now,
      createNotification: async (r) => { sent.push(r as Record<string, unknown>); return {} as never; },
    });

    expect(res.reminded).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.relatedEntity).toBe(in3.id);
    expect(sent[0]!.recipient).toBe((await repo.get(in3.id))?.postedBy);
    expect(sent[0]!.type).toBe('system');
  });

  test('public board hides expired by default; explicit status=expired returns them', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    await repo.create(base({ organizationId: org, status: 'active', expiresAt: new Date('2027-01-01T00:00:00Z') }) as never);
    await repo.create(base({ organizationId: org, status: 'expired', expiresAt: new Date('2020-01-01T00:00:00Z') }) as never);

    const def = await repo.list({ organizationId: org });
    expect(def.data.length).toBe(1);
    expect(def.data.every((p) => p.status !== 'expired')).toBe(true);

    const expired = await repo.list({ organizationId: org, status: 'expired' });
    expect(expired.data.length).toBe(1);
    expect(expired.data[0]!.status).toBe('expired');
  });

  test('extend adds 30 days to the CURRENT expiry (not today) and reactivates an expired posting', async () => {
    if (!H.dbReachable) return;
    const expiry = new Date('2026-08-01T00:00:00.000Z');
    const p = await repo.create(base({ status: 'expired', expiresAt: expiry }) as never);

    const extended = await repo.extendPosting(p.id);
    expect(extended.status).toBe('active');

    const expected = new Date(expiry);
    expected.setDate(expected.getDate() + 30);
    expect(new Date(extended.expiresAt!).toISOString()).toBe(expected.toISOString());
  });
});
