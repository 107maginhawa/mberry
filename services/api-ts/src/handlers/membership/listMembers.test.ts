import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listMembers } from './listMembers';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeListResult = {
  data: [
    {
      membership: { id: 'mem-1', organizationId: 'org-1', status: 'active' },
      person: { id: 'p-1', firstName: 'Alice', lastName: 'Smith', avatar: null },
      category: { id: 'cat-1', name: 'Regular' },
    },
  ],
  total: 1,
};

// ─── Tests ──────────────────────────────────────────────

describe('listMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns members list with 200 and meta', async () => {
    mocks = stubRepo(MembershipRepository, {
      listMembers: async () => fakeListResult,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const response = await listMembers(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.meta.limit).toBe(50);
    expect(response.body.meta.offset).toBe(0);
  });

  test('passes orgId as organizationId to repo', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(MembershipRepository, {
      listMembers: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-55' },
    });

    await listMembers(ctx);
    expect(capturedFilters.organizationId).toBe('org-55');
  });

  test('passes query filters to repo', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(MembershipRepository, {
      listMembers: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'active', categoryId: 'cat-2', search: 'Alice', limit: '10', offset: '5' },
    });

    await listMembers(ctx);
    expect(capturedFilters.status).toBe('active');
    expect(capturedFilters.categoryId).toBe('cat-2');
    expect(capturedFilters.search).toBe('Alice');
    expect(capturedFilters.limit).toBe(10);
    expect(capturedFilters.offset).toBe(5);
  });

  test('defaults limit to 50 and offset to 0', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(MembershipRepository, {
      listMembers: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    await listMembers(ctx);
    expect(capturedFilters.limit).toBe(50);
    expect(capturedFilters.offset).toBe(0);
  });

  test('returns empty list when no members', async () => {
    mocks = stubRepo(MembershipRepository, {
      listMembers: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const response = await listMembers(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.meta.total).toBe(0);
  });
});
