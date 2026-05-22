/**
 * [M15] deleteJobPosting handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeJobPosting as createFakeJobPosting } from '@/test-utils/factories';
import { deleteJobPosting } from './deleteJobPosting';
import { JobPostingRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');

const fakePosting = createFakeJobPosting({
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  status: 'active' as const,
  postedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
});

describe('[M15] deleteJobPosting', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 204 for existing posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
      delete: async () => true,
    });

    const ctx = makeCtx({ _params: { postingId: 'job-1' } });
    const response = await deleteJobPosting(ctx);
    expect(response.status).toBe(204);
  });

  test('returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { postingId: 'missing' } });
    const response = await deleteJobPosting(ctx);
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });
});
