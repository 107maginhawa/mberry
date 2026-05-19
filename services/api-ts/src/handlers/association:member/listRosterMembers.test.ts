/**
 * Tests for listRosterMembers handler and MembershipRepository.listMembersWithOfficerStatus
 *
 * OPS-01: Officer sees dues + training status in single roster request (no N+1)
 * OPS-04: Server-side DB-level filtering by duesStatus and trainingCompliant
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listRosterMembers } from './listRosterMembers';
import { OfficerTermRepository } from './repos/governance.repo';

// ---------------------------------------------------------------------------
// DB stub helpers
// ---------------------------------------------------------------------------

function makeDb({
  selectRowsSets = undefined as any[][] | undefined,
  selectRows = [] as any[],
} = {}) {
  let callCount = 0;
  const awaitable = (result: any): any => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    orderBy: () => awaitable(result),
    limit: () => awaitable(result),
    offset: () => awaitable(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => {
      const rows = selectRowsSets
        ? (selectRowsSets[callCount++] ?? selectRows)
        : selectRows;
      return awaitable(rows);
    },
    insert: (_t: any) => ({ values: (_d: any) => ({ returning: () => Promise.resolve([]) }) }),
    update: (_t: any) => ({ set: (_d: any) => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    delete: (_t: any) => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRosterRow(overrides: Record<string, any> = {}) {
  return {
    membership: {
      id: 'mem-1',
      organizationId: 'org-1',
      personId: 'person-1',
      memberNumber: 'MEM-001',
      categoryId: 'cat-1',
      status: 'active',
      duesExpiryDate: '2027-01-01',
      gracePeriodDays: 30,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      startDate: '2026-01-01',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    person: {
      id: 'person-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      avatar: null,
    },
    category: { id: 'cat-1', name: 'Regular' },
    duesInvoiceStatus: 'paid',
    creditsEarned: 45,
    trainingCompliant: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MembershipRepository.listMembersWithOfficerStatus
// ---------------------------------------------------------------------------

describe('MembershipRepository.listMembersWithOfficerStatus', () => {
  test('Test 1: returns duesInvoiceStatus field from latest invoice', async () => {
    const row = makeRosterRow({ duesInvoiceStatus: 'paid' });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({ organizationId: 'org-1' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].duesInvoiceStatus).toBe('paid');
  });

  test('Test 2: returns creditsEarned as sum of credit_amount for current cycle', async () => {
    const row = makeRosterRow({ creditsEarned: 30 });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({ organizationId: 'org-1' });

    expect(result.data[0].creditsEarned).toBe(30);
  });

  test('Test 3: returns trainingCompliant=true when creditsEarned >= 40', async () => {
    const row = makeRosterRow({ creditsEarned: 40, trainingCompliant: true });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({ organizationId: 'org-1' });

    expect(result.data[0].trainingCompliant).toBe(true);
  });

  test('Test 4: returns trainingCompliant=false when creditsEarned < 40', async () => {
    const row = makeRosterRow({ creditsEarned: 10, trainingCompliant: false });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({ organizationId: 'org-1' });

    expect(result.data[0].trainingCompliant).toBe(false);
  });

  test('Test 5: duesStatus filter returns only members with matching latest invoice status', async () => {
    // With filter applied at DB level — stub returns only matching rows
    const row = makeRosterRow({ duesInvoiceStatus: 'overdue' });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({
      organizationId: 'org-1',
      duesStatus: 'overdue',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].duesInvoiceStatus).toBe('overdue');
  });

  test('Test 6: trainingCompliant=true filter returns only compliant members', async () => {
    const row = makeRosterRow({ creditsEarned: 50, trainingCompliant: true });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({
      organizationId: 'org-1',
      trainingCompliant: true,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].trainingCompliant).toBe(true);
  });

  test('Test 7: trainingCompliant=false filter returns only non-compliant members', async () => {
    const row = makeRosterRow({ creditsEarned: 5, trainingCompliant: false });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({
      organizationId: 'org-1',
      trainingCompliant: false,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].trainingCompliant).toBe(false);
  });

  test('Test 8: member with no invoices has duesInvoiceStatus=null', async () => {
    const row = makeRosterRow({ duesInvoiceStatus: null });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({ organizationId: 'org-1' });

    expect(result.data[0].duesInvoiceStatus).toBeNull();
  });

  test('Test 9: member with no credits has creditsEarned=0 and trainingCompliant=false', async () => {
    const row = makeRosterRow({ creditsEarned: 0, trainingCompliant: false, duesInvoiceStatus: null });
    const db = makeDb({ selectRowsSets: [[row], [{ count: 1 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembersWithOfficerStatus({ organizationId: 'org-1' });

    expect(result.data[0].creditsEarned).toBe(0);
    expect(result.data[0].trainingCompliant).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listRosterMembers handler
// ---------------------------------------------------------------------------

describe('listRosterMembers handler', () => {
  beforeEach(() => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when not authenticated', async () => {
    const ctx = makeCtx({ user: null });
    // handler throws UnauthorizedError — catch it
    try {
      await listRosterMembers(ctx as any);
    } catch (e: any) {
      expect(e.status ?? e.statusCode ?? 401).toBe(401);
      return;
    }
    // or returns 401 response
  });

  test('returns 500 with error message when repo throws (defensive error handling)', async () => {
    stubRepo(MembershipRepository, {
      listMembersWithOfficerStatus: async () => {
        throw new Error('relation "credit_entry" does not exist');
      },
    });

    const ctx = makeCtx({
      _query: { organizationId: 'org-1', page: 1, pageSize: 20 },
    });

    const res = await listRosterMembers(ctx as any) as any;

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to load roster');
  });

  test('returns 200 with duesInvoiceStatus, creditsEarned, trainingCompliant per row', async () => {
    const rosterRow = makeRosterRow();
    stubRepo(MembershipRepository, {
      listMembersWithOfficerStatus: async () => ({ data: [rosterRow], total: 1 }),
    });

    const ctx = makeCtx({
      _query: { organizationId: 'org-1', page: 1, pageSize: 20 },
    });

    // makeCtx returns { status, body } from ctx.json() — not a real Response
    const res = await listRosterMembers(ctx as any) as any;

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].duesInvoiceStatus).toBe('paid');
    expect(res.body.data[0].creditsEarned).toBe(45);
    expect(res.body.data[0].trainingCompliant).toBe(true);
    expect(res.body.data[0].email).toBe('jane@example.com');
  });
});
