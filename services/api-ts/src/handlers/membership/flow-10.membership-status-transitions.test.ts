// FLOW-10: Membership Expiry → Status Downgrade
// Tests BR-03 state machine in updateMember: valid transitions enforced,
// invalid transitions silently rejected.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateMember } from './updateMember';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-10';
const MEMBER_ID = 'member-1';

function fakeMember(status: string) {
  return {
    membership: {
      id: MEMBER_ID,
      organizationId: ORG,
      personId: 'person-1',
      status,
      categoryId: 'cat-1',
      tierId: 'tier-1',
      memberNumber: 'MEM-001',
      note: null,
      removedAt: null,
      removalReason: null,
    },
    person: { id: 'person-1', firstName: 'Juan', lastName: 'Dela Cruz' },
  };
}

function defaultStubs(currentStatus: string, overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(MembershipRepository, {
    getMember: async () => fakeMember(currentStatus),
    getMemberById: async () => fakeMember(currentStatus),
    updateMember: async (id: string, data: any) => ({ id, ...data }),
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-10] Membership Status Transitions (BR-03)', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // ── Valid transitions ──

  test('active → suspended: valid', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('active', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'suspended' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    const response = await updateMember(ctx);

    expect(response.status).toBe(200);
    expect(capturedStatus).toBe('suspended');
  });

  test('active → removed: valid, sets removedAt', async () => {
    let capturedData: any = null;

    mocks = defaultStubs('active', {
      updateMember: async (_id: string, data: any) => {
        capturedData = data;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'removed', removalReason: 'Violation' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    expect(capturedData.status).toBe('removed');
    expect(capturedData.removedAt).toBeInstanceOf(Date);
    expect(capturedData.removalReason).toBe('Violation');
  });

  test('lapsed → active: valid (reinstatement)', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('lapsed', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'active' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    expect(capturedStatus).toBe('active');
  });

  test('suspended → active: valid (reactivation)', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('suspended', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'active' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    expect(capturedStatus).toBe('active');
  });

  // ── Invalid transitions (silently rejected) ──

  test('active → lapsed: invalid, stays active', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('active', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'lapsed' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    // Invalid transition — silently keeps current status
    expect(capturedStatus).toBe('active');
  });

  test('lapsed → removed: invalid, stays lapsed', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('lapsed', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'removed' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    expect(capturedStatus).toBe('lapsed');
  });

  test('same status is no-op (valid)', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('active', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'active' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    expect(capturedStatus).toBe('active');
  });

  // ── Edge cases ──

  test('nonexistent member throws NotFoundError', async () => {
    mocks = defaultStubs('active', {
      getMember: async () => undefined,
      getMemberById: async () => undefined,
    });

    const ctx = makeCtx({
      _body: { status: 'suspended' },
      _params: { organizationId: ORG, memberId: 'nonexistent' },
    });

    try {
      await updateMember(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('not found');
    }
  });

  test('no status in body keeps current status', async () => {
    let capturedStatus: string | null = null;

    mocks = defaultStubs('active', {
      updateMember: async (_id: string, data: any) => {
        capturedStatus = data.status;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { note: 'Updated contact info' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    expect(capturedStatus).toBe('active');
  });

  // Side-effect tests removed — auto-transition cron (active→grace→lapsed)
  // and status change notifications not yet implemented. Re-add when
  // membership lifecycle automation is built.
});
