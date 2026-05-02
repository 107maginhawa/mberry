import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listPayments } from './listPayments';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePayments = [
  { id: 'pay-1', organizationId: 'org-1', personId: 'person-1', amount: 5000, status: 'completed' },
  { id: 'pay-2', organizationId: 'org-1', personId: 'person-2', amount: 3000, status: 'pending' },
];

// ─── Tests ──────────────────────────────────────────────

describe('listPayments', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns payments with meta and 200', async () => {
    mocks = stubRepo(DuesRepository, {
      listPayments: async () => ({ data: fakePayments, total: 2 }),
    });

    const ctx = makeCtx({
      _query: { organizationId: 'org-1' },
    });

    const response = await listPayments(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.total).toBe(2);
  });

  test('scopes to member when scope=member', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(DuesRepository, {
      listPayments: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      user: { id: 'person-1', role: 'member' },
      _query: { scope: 'member' },
    });

    await listPayments(ctx);
    expect(capturedFilters.personId).toBe('person-1');
  });

  test('passes organizationId filter from query', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(DuesRepository, {
      listPayments: async (filters: any) => { capturedFilters = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      _query: { organizationId: 'org-99' },
    });

    await listPayments(ctx);
    expect(capturedFilters.organizationId).toBe('org-99');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      listPayments: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { scope: 'member' },
    });

    // When scope=member, handler accesses session.user.id which will throw
    await expect(listPayments(ctx)).rejects.toThrow();
  });
});
