/**
 * Unit tests for the extendJobPosting handler (BR-37). Repo stubbed — no DB.
 * Covers the 200 happy path, the org-scoped 404s, and the missing-org-context
 * 403. The extend math (resets from current expiry, reactivates) is covered on
 * real PG in jobs/jobPostingExpiry.integration.test.ts.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { JobPostingRepository } from './repos/jobs.repo';
import { extendJobPosting } from './extendJobPosting';

const OFFICER = { id: 'officer-1', role: 'association:admin' };

describe('extendJobPosting (unit)', () => {
  afterEach(() => restoreRepo(JobPostingRepository));

  test('200: extends a posting in the caller org', async () => {
    stubRepo(JobPostingRepository, {
      get: async () => ({ id: 'p1', organizationId: 'tenant-1', title: 'Dentist', status: 'expired' }),
      extendPosting: async () => ({ id: 'p1', organizationId: 'tenant-1', title: 'Dentist', status: 'active', expiresAt: new Date() }),
    });
    const ctx = makeCtx({ user: OFFICER, organizationId: 'tenant-1', _params: { postingId: 'p1' } });
    const res = await extendJobPosting(ctx);
    expect((res as unknown as { status: number }).status).toBe(200);
    const body = (res as unknown as { body: { data: { id: string; status: string } } }).body;
    expect(body.data.id).toBe('p1');
    expect(body.data.status).toBe('active');
  });

  test('403 when there is no organization context', async () => {
    stubRepo(JobPostingRepository, {});
    const ctx = makeCtx({ user: OFFICER, organizationId: undefined, _params: { postingId: 'p1' } });
    const res = await extendJobPosting(ctx);
    expect((res as unknown as { status: number }).status).toBe(403);
  });

  test('404 when the posting does not exist', async () => {
    stubRepo(JobPostingRepository, { get: async () => undefined });
    const ctx = makeCtx({ user: OFFICER, organizationId: 'tenant-1', _params: { postingId: 'missing' } });
    await expect(extendJobPosting(ctx)).rejects.toThrow(/not found/i);
  });

  test('404 when the posting belongs to another org (tenant boundary)', async () => {
    stubRepo(JobPostingRepository, {
      get: async () => ({ id: 'p1', organizationId: 'other-org', title: 'Dentist', status: 'active' }),
    });
    const ctx = makeCtx({ user: OFFICER, organizationId: 'tenant-1', _params: { postingId: 'p1' } });
    await expect(extendJobPosting(ctx)).rejects.toThrow(/not found/i);
  });
});
