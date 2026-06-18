/**
 * [M15] getJobPosting handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeJobPosting as createFakeJobPosting } from '@/test-utils/factories';
import { getJobPosting } from './getJobPosting';
import { JobPostingRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');

const fakePosting = createFakeJobPosting({
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  location: 'Remote',
  type: 'full_time' as const,
  status: 'active' as const,
  postedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
});

describe('[M15] getJobPosting', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 200 with posting data for existing posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => fakePosting,
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { postingId: 'job-1' } });
    const response = await getJobPosting(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('job-1');
    expect(response.body.data.title).toBe('Senior Engineer');
    expect(response.body.data.status).toBe('active');
  });

  test('returns 404 for non-existent posting', async () => {
    mocks = stubRepo(JobPostingRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { postingId: 'does-not-exist' } });
    const response = await getJobPosting(ctx);
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });
});
