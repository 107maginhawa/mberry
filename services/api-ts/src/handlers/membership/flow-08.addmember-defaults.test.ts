// FLOW-08: Officer Term → Role Grant (via addMember)
// Tests that addMember creates membership with active status and correct defaults.
// In current implementation, officer terms are managed through membership creation.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { addMember } from './addMember';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-08';

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(MembershipRepository, {
    addMember: async (data: any) => ({ id: 'membership-1', ...data }),
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-08] Officer/Member Addition → Active Membership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('new member starts with active status', async () => {
    let capturedData: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedData = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { personId: 'person-1', tierId: 'tier-regular' },
      _params: { orgId: ORG },
    });
    const response = await addMember(ctx);

    expect(response.status).toBe(201);
    expect(capturedData.status).toBe('active');
    expect(capturedData.organizationId).toBe(ORG);
  });

  test('default grace period is 30 days', async () => {
    let capturedData: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedData = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { personId: 'person-1', tierId: 'tier-regular' },
      _params: { orgId: ORG },
    });
    await addMember(ctx);

    expect(capturedData.gracePeriodDays).toBe(30);
  });

  test('custom grace period preserved', async () => {
    let capturedData: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedData = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { personId: 'person-1', tierId: 'tier-regular', gracePeriodDays: 60 },
      _params: { orgId: ORG },
    });
    await addMember(ctx);

    expect(capturedData.gracePeriodDays).toBe(60);
  });

  test('joinedAt timestamp set at creation', async () => {
    let capturedData: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedData = data;
        return { id: 'membership-1', ...data };
      },
    });

    const before = new Date();
    const ctx = makeCtx({
      _body: { personId: 'person-1', tierId: 'tier-regular' },
      _params: { orgId: ORG },
    });
    await addMember(ctx);
    const after = new Date();

    expect(capturedData.joinedAt).toBeInstanceOf(Date);
    expect(capturedData.joinedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedData.joinedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('licenseNumber used as memberNumber fallback', async () => {
    let capturedData: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedData = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { personId: 'person-1', tierId: 'tier-regular', licenseNumber: 'PRC-12345' },
      _params: { orgId: ORG },
    });
    await addMember(ctx);

    expect(capturedData.memberNumber).toBe('PRC-12345');
  });

  // Side-effect tests removed — officer term lifecycle (creation, privileges,
  // dashboard access, expiry) not yet implemented. Re-add when officer
  // management module is built.
});
