// FLOW-07: Member Import → Matching → Account
// Tests that importMembers calls bulkImportMembers with correct defaults.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { importMembers } from './importMembers';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-07';

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(MembershipRepository, {
    bulkImportMembers: async (members: any[]) => members.map((m: any, i: number) => ({
      id: `membership-${i}`,
      ...m,
    })),
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-07] Member Import → Bulk Creation', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('imports multiple members with correct org and defaults', async () => {
    let capturedMembers: any[] = [];

    mocks = defaultStubs({
      bulkImportMembers: async (members: any[]) => {
        capturedMembers = members;
        return members.map((m: any, i: number) => ({ id: `m-${i}`, ...m }));
      },
    });

    const ctx = makeCtx({
      _body: {
        members: [
          { personId: 'person-1', tierId: 'tier-regular' },
          { personId: 'person-2', tierId: 'tier-senior', memberNumber: 'MEM-002' },
        ],
      },
      _params: { orgId: ORG },
    });
    const response = await importMembers(ctx);

    expect(response.status).toBe(201);
    expect(capturedMembers).toHaveLength(2);
    expect(capturedMembers[0].organizationId).toBe(ORG);
    expect(capturedMembers[0].status).toBe('active');
    expect(capturedMembers[0].gracePeriodDays).toBe(30);
    expect(capturedMembers[1].memberNumber).toBe('MEM-002');
  });

  test('licenseNumber used as memberNumber when memberNumber not provided', async () => {
    let capturedMembers: any[] = [];

    mocks = defaultStubs({
      bulkImportMembers: async (members: any[]) => {
        capturedMembers = members;
        return members.map((m: any, i: number) => ({ id: `m-${i}`, ...m }));
      },
    });

    const ctx = makeCtx({
      _body: {
        members: [
          { personId: 'person-1', tierId: 'tier-regular', licenseNumber: 'LIC-12345' },
        ],
      },
      _params: { orgId: ORG },
    });
    await importMembers(ctx);

    expect(capturedMembers[0].memberNumber).toBe('LIC-12345');
  });

  test('default expiry is 1 year from today', async () => {
    let capturedMembers: any[] = [];

    mocks = defaultStubs({
      bulkImportMembers: async (members: any[]) => {
        capturedMembers = members;
        return members.map((m: any, i: number) => ({ id: `m-${i}`, ...m }));
      },
    });

    const ctx = makeCtx({
      _body: {
        members: [{ personId: 'person-1', tierId: 'tier-regular' }],
      },
      _params: { orgId: ORG },
    });
    await importMembers(ctx);

    // startDate should be today
    const today = new Date().toISOString().split('T')[0];
    expect(capturedMembers[0].startDate).toBe(today);
    // duesExpiryDate should be ~1 year from now
    expect(capturedMembers[0].duesExpiryDate).toBeDefined();
  });

  test('custom start and expiry dates preserved', async () => {
    let capturedMembers: any[] = [];

    mocks = defaultStubs({
      bulkImportMembers: async (members: any[]) => {
        capturedMembers = members;
        return members.map((m: any, i: number) => ({ id: `m-${i}`, ...m }));
      },
    });

    const ctx = makeCtx({
      _body: {
        members: [{
          personId: 'person-1',
          tierId: 'tier-regular',
          startDate: '2025-06-01',
          duesExpiryDate: '2026-06-01',
        }],
      },
      _params: { orgId: ORG },
    });
    await importMembers(ctx);

    expect(capturedMembers[0].startDate).toBe('2025-06-01');
    expect(capturedMembers[0].duesExpiryDate).toBe('2026-06-01');
  });

  test('returns imported count', async () => {
    mocks = defaultStubs();

    const ctx = makeCtx({
      _body: {
        members: [
          { personId: 'p1', tierId: 't1' },
          { personId: 'p2', tierId: 't1' },
          { personId: 'p3', tierId: 't2' },
        ],
      },
      _params: { orgId: ORG },
    });
    const response = await importMembers(ctx);

    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(3);
  });

  // ── Unimplemented side effects (test.todo = RED backlog) ──

  test.todo('existing members matched by license number skip creation');
  test.todo('unmatched members get new person account created');
  test.todo('invitations sent to newly created member accounts');
  test.todo('import report includes matched/created/failed counts');
});
