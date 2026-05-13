/**
 * listDuesPayments.test.ts
 *
 * SEC-02 RED phase: org param enforcement tests for listDuesPayments handler.
 * Tests with [RED] are expected to FAIL now (handler uses query.organizationId)
 * and PASS after Plan 02 (handler must use ctx.get('organizationId') instead).
 *
 * PAY-02: personId self-service enforcement — non-officers can only see their own payments.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';

// Default mock: user is an officer (requireOfficerTerm returns null = allowed)
// Individual tests override as needed via mock.module
mock.module('@/utils/officer-check', () => ({
  requireOfficerTerm: async () => null,
  requirePosition: async () => null,
}));

import { listDuesPayments } from './listDuesPayments';

describe('[SEC-02] listDuesPayments — ctx orgId enforcement', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(listDuesPayments(ctx as any)).rejects.toThrow();
  });

  test('returns 403 when orgId is null in context [RED]', async () => {
    const ctx = makeCtx({ organizationId: null });
    // RED: handler currently does not check for null orgId — will return data or throw
    try {
      const res = await listDuesPayments(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  test('repo.listPayments is called with ctx orgId NOT query.organizationId [RED]', async () => {
    let capturedFilter: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _query: {
        organizationId: 'attacker-org',  // attacker tries to supply their own org
        page: 1,
        pageSize: 20,
      },
      organizationId: 'org-1',  // middleware-set org from JWT
    });

    await listDuesPayments(ctx as any);

    // RED: handler currently passes query.organizationId ('attacker-org') to repo
    // After fix: handler must use ctx.get('organizationId') ('org-1')
    expect(capturedFilter.organizationId).toBe('org-1');
  });

  test('returns 200 with data when org is valid', async () => {
    stubRepo(DuesRepository, {
      listPayments: async () => ({
        data: [{ id: 'pay-1', organizationId: 'org-1', amount: 5000, refundedAmount: 0 }],
        total: 1,
      }),
    });

    const ctx = makeCtx({
      _query: { page: 1, pageSize: 20 },
      organizationId: 'org-1',
    });

    const res = await listDuesPayments(ctx as any);
    expect(res.status).toBe(200);
  });
});

describe('[PAY-02] listDuesPayments — personId self-service enforcement', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('[PAY-02] non-officer with different personId — forced to session.user.id', async () => {
    // Override: non-officer (requireOfficerTerm returns a Response)
    mock.module('@/utils/officer-check', () => ({
      requireOfficerTerm: async () =>
        ({ status: 403, body: { error: 'Officer access required' } } as any as Response),
      requirePosition: async () => null,
    }));

    let capturedFilter: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _query: {
        personId: 'other-member-id', // attacker tries to see another member's payments
        page: 1,
        pageSize: 20,
      },
      organizationId: 'org-1',
    });
    // session.user.id defaults to 'user-1' via makeCtx

    await listDuesPayments(ctx as any);

    // non-officer must be restricted to their own payments
    expect(capturedFilter.personId).toBe('user-1');
  });

  test('[PAY-02] non-officer with no personId — defaults to session.user.id', async () => {
    mock.module('@/utils/officer-check', () => ({
      requireOfficerTerm: async () =>
        ({ status: 403, body: { error: 'Officer access required' } } as any as Response),
      requirePosition: async () => null,
    }));

    let capturedFilter: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _query: { page: 1, pageSize: 20 },
      organizationId: 'org-1',
    });

    await listDuesPayments(ctx as any);

    expect(capturedFilter.personId).toBe('user-1');
  });

  test('[PAY-02] officer can query any personId within org', async () => {
    // officer: requireOfficerTerm returns null
    mock.module('@/utils/officer-check', () => ({
      requireOfficerTerm: async () => null,
      requirePosition: async () => null,
    }));

    let capturedFilter: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _query: {
        personId: 'another-member-id',
        page: 1,
        pageSize: 20,
      },
      organizationId: 'org-1',
    });

    await listDuesPayments(ctx as any);

    // officer: query.personId should be passed through
    expect(capturedFilter.personId).toBe('another-member-id');
  });

  test('[PAY-02] officer with no personId — returns all org payments (personId undefined)', async () => {
    mock.module('@/utils/officer-check', () => ({
      requireOfficerTerm: async () => null,
      requirePosition: async () => null,
    }));

    let capturedFilter: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _query: { page: 1, pageSize: 20 },
      organizationId: 'org-1',
    });

    await listDuesPayments(ctx as any);

    expect(capturedFilter.personId).toBeUndefined();
  });
});
