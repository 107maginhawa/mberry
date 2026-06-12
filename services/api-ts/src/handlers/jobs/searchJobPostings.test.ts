/**
 * [M15] searchJobPostings handler tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeJobPosting as createFakeJobPosting } from '@/test-utils/factories';
import { searchJobPostings } from './searchJobPostings';
import { JobPostingRepository } from './repos/jobs.repo';

const now = new Date('2026-06-01T00:00:00Z');

const fakePosting = createFakeJobPosting({
  title: 'Senior Engineer',
  organizationName: 'Acme Corp',
  type: 'full_time' as const,
  status: 'active' as const,
  postedBy: 'user-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
});

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
      organizationId: 'tenant-1',
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

describe('[M15] searchJobPostings org-scope default (FIX-004)', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('defaults the org filter to the tenant-resolved context org when no query param', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(JobPostingRepository, {
      list: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    // orgContextMiddleware verified membership in 'tenant-A' and set ctx.var.organizationId.
    // No organizationId query param is supplied.
    const ctx = makeCtx({
      organizationId: 'tenant-A',
      _query: { status: 'active' },
    });

    const response = await searchJobPostings(ctx);
    expect(response.status).toBe(200);
    // Listing MUST be scoped to the caller's org by default — not unscoped.
    expect(capturedFilters.organizationId).toBe('tenant-A');
  });

  test('ignores a query-supplied organizationId that differs from context org', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(JobPostingRepository, {
      list: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    // Caller is a member of 'tenant-A' but tries to read 'tenant-B' postings via query param.
    const ctx = makeCtx({
      organizationId: 'tenant-A',
      _query: { organizationId: 'tenant-B' },
    });

    const response = await searchJobPostings(ctx);
    expect(response.status).toBe(200);
    // The list MUST stay scoped to the tenant context, never the cross-org query value.
    expect(capturedFilters.organizationId).toBe('tenant-A');
    expect(capturedFilters.organizationId).not.toBe('tenant-B');
  });
});
