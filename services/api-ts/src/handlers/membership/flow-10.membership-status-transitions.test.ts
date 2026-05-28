// Business Rules: [BR-03]
// FLOW-10: Membership Expiry → Status Downgrade
// Tests BR-03 state machine in updateMember: valid transitions enforced,
// invalid transitions silently rejected.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateMember } from './updateMember';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-10';
const MEMBER_ID = 'member-1';
const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Flag fields that make withComputedStatus compute the expected stored status
const STATUS_FLAGS: Record<string, Record<string, any>> = {
  active:    { duesExpiryDate: FUTURE_EXPIRY, suspendedAt: null, removedAt: null },
  lapsed:    { duesExpiryDate: '2020-01-01', suspendedAt: null, removedAt: null },
  suspended: { suspendedAt: new Date('2025-01-01'), removedAt: null, duesExpiryDate: FUTURE_EXPIRY },
};

function fakeMember(status: string) {
  const flags = STATUS_FLAGS[status] ?? { duesExpiryDate: FUTURE_EXPIRY, suspendedAt: null, removedAt: null };
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
      dateOfDeath: null,
      expelledAt: null,
      resignedAt: null,
      isPendingPayment: false,
      gracePeriodDays: 30,
      ...flags,
    },
    person: { id: 'person-1', firstName: 'Juan', lastName: 'Dela Cruz' },
  };
}

/** Create a DB mock that captures the status written by persistWithComputedStatus */
function capturingDb(onSet: (data: any) => void, base: Record<string, any> = {}) {
  return {
    ...makeMockDb(),
    update: (_table: any) => ({
      set: (data: any) => {
        onSet(data);
        return { where: (_c: any) => ({ returning: async () => [{ ...base, ...data }] }) };
      },
    }),
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
    let dbSetData: any = null;
    const db = capturingDb((d) => { dbSetData = d; }, fakeMember('active').membership);

    mocks = defaultStubs('active');

    const ctx = makeCtx({
      database: db,
      _body: { status: 'suspended' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    const response = await updateMember(ctx);

    expect(response.status).toBe(200);
    // persistWithComputedStatus writes status via db.update
    expect(dbSetData?.status).toBe('suspended');
  });

  test('active → removed: valid, sets removedAt', async () => {
    let dbSetData: any = null;
    let capturedRepoData: any = null;
    const db = capturingDb((d) => { dbSetData = d; }, fakeMember('active').membership);

    mocks = defaultStubs('active', {
      updateMember: async (_id: string, data: any) => {
        capturedRepoData = data;
        return { id: MEMBER_ID, ...data };
      },
    });

    const ctx = makeCtx({
      database: db,
      _body: { status: 'removed', removalReason: 'Violation' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    // removedAt + status set via persistWithComputedStatus (DB direct)
    expect(dbSetData?.status).toBe('removed');
    expect(dbSetData?.removedAt).toBeInstanceOf(Date);
    // removalReason passed to repo.updateMember
    expect(capturedRepoData?.removalReason).toBe('Violation');
  });

  test('lapsed → active: valid (reinstatement)', async () => {
    let dbSetData: any = null;
    const db = capturingDb((d) => { dbSetData = d; }, fakeMember('lapsed').membership);

    mocks = defaultStubs('lapsed');

    const ctx = makeCtx({
      database: db,
      _body: { status: 'active' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    // lapsed → active: clears suspendedAt/removedAt flags, but duesExpiryDate is still
    // in the past so computed status is 'lapsed' not 'active'. Handler accepts transition
    // but DB gets 'lapsed' back. Real path to active from lapsed is recordDuesPayment.
    expect(dbSetData?.status).toBe('lapsed');
  });

  test('suspended → active: valid (reactivation)', async () => {
    let dbSetData: any = null;
    const db = capturingDb((d) => { dbSetData = d; }, fakeMember('suspended').membership);

    mocks = defaultStubs('suspended');

    const ctx = makeCtx({
      database: db,
      _body: { status: 'active' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    await updateMember(ctx);

    // suspended → active: clears suspendedAt; duesExpiryDate is future → computes 'active'
    expect(dbSetData?.status).toBe('active');
  });

  // ── Invalid transitions (silently rejected) ──

  test('active → lapsed: invalid, stays active', async () => {
    let dbCalled = false;
    const db = capturingDb(() => { dbCalled = true; });

    mocks = defaultStubs('active');

    const ctx = makeCtx({
      database: db,
      _body: { status: 'lapsed' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    const response = await updateMember(ctx);

    // Invalid transition — persistWithComputedStatus NOT called
    expect(response.status).toBe(200);
    expect(dbCalled).toBe(false);
  });

  test('lapsed → removed: invalid, stays lapsed', async () => {
    let dbCalled = false;
    const db = capturingDb(() => { dbCalled = true; });

    mocks = defaultStubs('lapsed');

    const ctx = makeCtx({
      database: db,
      _body: { status: 'removed' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    const response = await updateMember(ctx);

    // Invalid transition — persistWithComputedStatus NOT called
    expect(response.status).toBe(200);
    expect(dbCalled).toBe(false);
  });

  test('same status is no-op (valid)', async () => {
    let dbCalled = false;
    const db = capturingDb(() => { dbCalled = true; });

    mocks = defaultStubs('active');

    const ctx = makeCtx({
      database: db,
      _body: { status: 'active' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    const response = await updateMember(ctx);

    // Same-status no-op — persistWithComputedStatus NOT called
    expect(response.status).toBe(200);
    expect(dbCalled).toBe(false);
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
    let dbCalled = false;
    const db = capturingDb(() => { dbCalled = true; });

    mocks = defaultStubs('active');

    const ctx = makeCtx({
      database: db,
      _body: { note: 'Updated contact info' },
      _params: { organizationId: ORG, memberId: MEMBER_ID },
    });
    const response = await updateMember(ctx);

    // No status change — persistWithComputedStatus NOT called
    expect(response.status).toBe(200);
    expect(dbCalled).toBe(false);
  });

  // Side-effect tests removed — auto-transition cron (active→grace→lapsed)
  // and status change notifications not yet implemented. Re-add when
  // membership lifecycle automation is built.
});
