import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo } from '@/test-utils/make-ctx';
import { updateMember } from './updateMember';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ───────────────────────────────────────────

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const existingMember = {
  membership: {
    id: 'mem-1',
    organizationId: 'org-1',
    personId: 'person-1',
    tierId: 'tier-1',
    categoryId: 'cat-1',
    memberNumber: 'MEM-001',
    status: 'active',
    note: null,
    removedAt: null,
    removalReason: null,
    updatedBy: 'user-1',
    // BR-01 flag fields required by withComputedStatus / persistWithComputedStatus
    duesExpiryDate: FUTURE_EXPIRY,
    suspendedAt: null,
    dateOfDeath: null,
    expelledAt: null,
    resignedAt: null,
    isPendingPayment: false,
    gracePeriodDays: 30,
  },
  person: { id: 'person-1', firstName: 'Alice', lastName: 'Smith', avatar: null },
  category: { id: 'cat-1', name: 'Regular' },
};

const updatedMember = {
  ...existingMember.membership,
  status: 'suspended',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('updateMember [BR-03]', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    domainEvents.reset();
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    domainEvents.reset();
  });

  test('updates member and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: { status: 'suspended' },
    });

    const response = await updateMember(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('suspended');
  });

  test('throws NotFoundError for non-existent member', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => undefined,
      getMemberById: async () => undefined,
      updateMember: async () => updatedMember,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', memberId: 'nonexistent' },
      _body: { status: 'active' },
    });

    await expect(updateMember(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async () => updatedMember,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: { status: 'active' },
    });

    await expect(updateMember(ctx)).rejects.toThrow();
  });

  test('scopes getMember call to orgId from route param', async () => {
    let capturedOrgId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async (orgId: string) => { capturedOrgId = orgId; return existingMember; },
      updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-55', memberId: 'person-1' },
      _body: { status: 'active' },
    });

    await updateMember(ctx);
    expect(capturedOrgId).toBe('org-55');
  });

  test('preserves existing values when body fields are absent', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: {}, // empty body - all values should fall back to existing
    });

    const response = await updateMember(ctx);
    expect(capturedUpdate.categoryId).toBe('cat-1');
    expect(capturedUpdate.memberNumber).toBe('MEM-001');
    // Status is NOT changed (no status in body) — handler doesn't pass status to updateMember,
    // it stays in DB as-is; response reflects existing status
    expect(response.body.data.status).toBe('active');
  });

  test('sets removedAt when status is removed [BR-03]', async () => {
    let capturedRepoUpdate: any = null;
    let capturedDbSet: any = null;
    const db = {
      ...makeMockDb(),
      update: (_table: any) => ({
        set: (data: any) => { capturedDbSet = data; return { where: (_c: any) => ({ returning: async () => [{ ...existingMember.membership, ...data }] }) }; },
      }),
    };
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember, // status: 'active'
      updateMember: async (_id: string, data: any) => { capturedRepoUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      database: db,
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: { status: 'removed', removalReason: 'Non-compliance' },
    });

    await updateMember(ctx);
    // removedAt is set via persistWithComputedStatus (DB direct update, not repo)
    expect(capturedDbSet.removedAt).toBeInstanceOf(Date);
    expect(capturedDbSet.status).toBe('removed');
    // removalReason is set via repo.updateMember
    expect(capturedRepoUpdate.removalReason).toBe('Non-compliance');
  });

  test('uses licenseNumber as memberNumber fallback', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: { licenseNumber: 'LIC-999' },
    });

    await updateMember(ctx);
    expect(capturedUpdate.memberNumber).toBe('LIC-999');
  });

  test('sets updatedBy to session user id', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-3', role: 'admin' },
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: { status: 'active' },
    });

    await updateMember(ctx);
    expect(capturedUpdate.updatedBy).toBe('admin-3');
  });

  // ─── [BR-03] Membership Transitions — Valid ───────────

  describe('[BR-03] valid transitions', () => {
    // Flag fields that produce each "from" computed status
    const statusFlags: Record<string, Record<string, any>> = {
      active:    { duesExpiryDate: FUTURE_EXPIRY, suspendedAt: null, removedAt: null },
      grace:     { duesExpiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], suspendedAt: null, removedAt: null },
      gracePeriod: { duesExpiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], suspendedAt: null, removedAt: null },
      lapsed:    { duesExpiryDate: '2020-01-01', suspendedAt: null, removedAt: null },
      suspended: { suspendedAt: new Date('2025-01-01'), removedAt: null, duesExpiryDate: FUTURE_EXPIRY },
    };

    const validTransitions: Array<[string, string, string | null]> = [
      ['active', 'suspended', 'suspended'],   // officer suspends — sets suspendedAt flag
      ['active', 'removed',   'removed'],     // president removes — sets removedAt flag
      ['grace', 'suspended',  'suspended'],   // officer suspends grace member
      ['lapsed', 'suspended', 'suspended'],   // officer suspends lapsed member
      // lapsed → active: BR-01 computes from duesExpiryDate which is still past,
      // so persistWithComputedStatus writes 'lapsed' back (not 'active').
      // Real path to active from lapsed is via recordDuesPayment (BR-07).
      ['lapsed', 'active', 'lapsed'],
      ['suspended', 'active', 'active'],      // officer restores — clears suspendedAt flag
    ];

    for (const [from, to, expectedDbStatus] of validTransitions) {
      test(`${from} → ${to} succeeds`, async () => {
        const flags = statusFlags[from] ?? {};
        const memberWithStatus = {
          ...existingMember,
          // Include status: from for handler transition validation (reads stored status)
          // Include flag fields for persistWithComputedStatus (BR-01)
          membership: { ...existingMember.membership, status: from, ...flags },
        };
        let capturedDbStatus: string | null = null;
        const db = {
          ...makeMockDb(),
          update: (_table: any) => ({
            set: (data: any) => { capturedDbStatus = data.status; return { where: (_c: any) => ({ returning: async () => [{ ...memberWithStatus.membership, ...data }] }) }; },
          }),
        };
        mocks = stubRepo(MembershipRepository, {
          getMember: async () => memberWithStatus,
          updateMember: async (_id: string, data: any) => ({ ...memberWithStatus.membership, ...data }),
        });

        const ctx = makeCtx({
          database: db,
          _params: { organizationId: 'org-1', memberId: 'person-1' },
          _body: { status: to },
        });

        const response = await updateMember(ctx);
        expect(response.status).toBe(200);
        if (expectedDbStatus !== null) {
          expect(capturedDbStatus).toBe(expectedDbStatus);
        }
      });
    }

    test('same status (no-op) is always valid', async () => {
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember, // status: 'active' via flags
        updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: { status: 'active' },
      });

      const response = await updateMember(ctx);
      // same-status no-op: persistWithComputedStatus NOT called, just repo.updateMember
      expect(response.status).toBe(200);
    });
  });

  // ─── [BR-03] Membership Transitions — Invalid ────────

  describe('[BR-03] invalid transitions silently rejected', () => {
    // Flag fields that produce each "from" computed status
    const statusFlagsInvalid: Record<string, Record<string, any>> = {
      active:    { duesExpiryDate: FUTURE_EXPIRY, suspendedAt: null, removedAt: null },
      grace:     { duesExpiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], suspendedAt: null, removedAt: null },
      gracePeriod: { duesExpiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], suspendedAt: null, removedAt: null },
      lapsed:    { duesExpiryDate: '2020-01-01', suspendedAt: null, removedAt: null },
      suspended: { suspendedAt: new Date('2025-01-01'), removedAt: null, duesExpiryDate: FUTURE_EXPIRY },
      pending:   { isPendingPayment: true, duesExpiryDate: null, suspendedAt: null, removedAt: null },
    };

    const invalidTransitions: Array<[string, string, string]> = [
      ['active', 'lapsed', 'cannot skip to lapsed'],
      ['active', 'grace', 'grace is automatic via expiry, not officer action'],
      ['grace', 'active', 'must pay dues or go through suspended→active'],
      ['grace', 'lapsed', 'lapsed is automatic via grace expiry'],
      ['grace', 'removed', 'only active members can be removed'],
      ['lapsed', 'grace', 'cannot go backwards to grace'],
      ['lapsed', 'removed', 'only active members can be removed'],
      ['suspended', 'grace', 'restore goes to active only'],
      ['suspended', 'lapsed', 'restore goes to active only'],
      ['suspended', 'removed', 'must restore before removing'],
      ['pending', 'active', 'pending→active via reviewApplication only'],
      ['pending', 'suspended', 'must approve first'],
    ];

    for (const [from, to, reason] of invalidTransitions) {
      test(`${from} → ${to} rejected (${reason})`, async () => {
        const flags = statusFlagsInvalid[from] ?? {};
        const memberWithStatus = {
          ...existingMember,
          // Include status: from for handler transition validation (reads stored status)
          // Include flag fields for persistWithComputedStatus (BR-01)
          membership: { ...existingMember.membership, status: from, ...flags },
        };
        let dbStatusUpdated: string | null = null;
        const db = {
          ...makeMockDb(),
          update: (_table: any) => ({
            set: (data: any) => { dbStatusUpdated = data.status; return { where: (_c: any) => ({ returning: async () => [{ ...memberWithStatus.membership, ...data }] }) }; },
          }),
        };
        mocks = stubRepo(MembershipRepository, {
          getMember: async () => memberWithStatus,
          updateMember: async (_id: string, data: any) => ({ ...memberWithStatus.membership, ...data }),
        });

        const ctx = makeCtx({
          database: db,
          _params: { organizationId: 'org-1', memberId: 'person-1' },
          _body: { status: to },
        });

        const response = await updateMember(ctx);
        // [BR-03] Invalid transitions: no error, no state change via persistWithComputedStatus
        expect(response.status).toBe(200);
        // persistWithComputedStatus should NOT have been called for invalid transitions
        expect(dbStatusUpdated).toBeNull();
      });
    }

    // [V-20] "pending" is not a settable status via updateMember — Zod rejects it
    // [V-20] "pending" as a target status is not in the valid enum — Zod rejects it
    const pendingTransitions: Array<[string, string, string]> = [
      ['active', 'pending', 'cannot revert to pending'],
      ['suspended', 'pending', 'cannot revert to pending'],
    ];

    for (const [from, to, reason] of pendingTransitions) {
      test(`${from} → ${to} rejected as validation error (${reason})`, async () => {
        const memberWithStatus = {
          ...existingMember,
          membership: { ...existingMember.membership, status: from },
        };
        mocks = stubRepo(MembershipRepository, {
          getMember: async () => memberWithStatus,
          updateMember: async (_id: string, data: any) => ({ ...memberWithStatus.membership, ...data }),
        });

        const ctx = makeCtx({
          _params: { organizationId: 'org-1', memberId: 'person-1' },
          _body: { status: to },
        });

        // [V-20] "pending" is not in the valid status enum — returns 400
        await expect(updateMember(ctx)).rejects.toBeInstanceOf(ValidationError);
      });
    }
  });

  // ─── [V-20] Input Validation — Invalid status values ──
  describe('[V-20] body.status validation', () => {
    test('rejects invalid status string "banana" with 400', async () => {
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember,
        updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: { status: 'banana' },
      });

      await expect(updateMember(ctx)).rejects.toBeInstanceOf(ValidationError);
    });

    test('rejects empty string status with 400', async () => {
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember,
        updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: { status: '' },
      });

      await expect(updateMember(ctx)).rejects.toBeInstanceOf(ValidationError);
    });

    test('rejects numeric status (type check) with 400', async () => {
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember,
        updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: { status: 123 },
      });

      await expect(updateMember(ctx)).rejects.toBeInstanceOf(ValidationError);
    });

    test('accepts valid status "active" (200)', async () => {
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember,
        updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: { status: 'active' },
      });

      const response = await updateMember(ctx);
      expect(response.status).toBe(200);
    });

    test('accepts missing status (uses current, 200)', async () => {
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember,
        updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: {},
      });

      const response = await updateMember(ctx);
      expect(response.status).toBe(200);
    });
  });
});
