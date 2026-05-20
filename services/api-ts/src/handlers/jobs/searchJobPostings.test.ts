/**
 * [M15] searchJobPostings handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { searchJobPostings } from './searchJobPostings';
import { JobPostingRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');

const fakePosting = {
  id: 'job-1',
  organizationId: 'org-1',
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  type: 'full_time' as const,
  status: 'active' as const,
  postedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
};

describe('[M15] searchJobPostings', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns paginated results', async () => {
    mocks = stubRepo(JobPostingRepository, {
      list: async () => ({ data: [fakePosting], total: 1 }),
    });

    const ctx = makeCtx({ _query: { status: 'active' } });
    const response = await searchJobPostings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe('job-1');
    expect(response.body.pagination.total).toBe(1);
  });

  test('returns empty array when no results', async () => {
    mocks = stubRepo(JobPostingRepository, {
      list: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({ _query: {} });
    const response = await searchJobPostings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.pagination.total).toBe(0);
  });

  test('passes filters through', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(JobPostingRepository, {
      list: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      _query: { status: 'active', type: 'contract', search: 'senior', limit: '10', offset: '5' },
    });

    await searchJobPostings(ctx);
    expect(capturedFilters.status).toBe('active');
    expect(capturedFilters.type).toBe('contract');
    expect(capturedFilters.search).toBe('senior');
    expect(capturedFilters.limit).toBe(10);
    expect(capturedFilters.offset).toBe(5);
  });
});
