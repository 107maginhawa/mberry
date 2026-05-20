import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { updateMember } from './updateMember';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, ValidationError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const existingMember = {
  membership: {
    id: 'mem-1',
    organizationId: 'org-1',
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

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
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

    await updateMember(ctx);
    expect(capturedUpdate.categoryId).toBe('cat-1');
    expect(capturedUpdate.status).toBe('active');
    expect(capturedUpdate.memberNumber).toBe('MEM-001');
  });

  test('sets removedAt when status is removed [BR-03]', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember, // status: 'active'
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', memberId: 'person-1' },
      _body: { status: 'removed', removalReason: 'Non-compliance' },
    });

    await updateMember(ctx);
    expect(capturedUpdate.removedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.removalReason).toBe('Non-compliance');
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
    const validTransitions: Array<[string, string]> = [
      ['active', 'suspended'],    // officer suspends
      ['active', 'removed'],   // president removes
      ['grace', 'suspended'],     // officer suspends grace member
      ['lapsed', 'suspended'],    // officer suspends lapsed member
      ['lapsed', 'active'],       // member pays dues (manual restore)
      ['suspended', 'active'],    // officer restores
    ];

    for (const [from, to] of validTransitions) {
      test(`${from} → ${to} succeeds`, async () => {
        const memberWithStatus = {
          ...existingMember,
          membership: { ...existingMember.membership, status: from },
        };
        let capturedStatus: string | null = null;
        mocks = stubRepo(MembershipRepository, {
          getMember: async () => memberWithStatus,
          updateMember: async (_id: string, data: any) => {
            capturedStatus = data.status;
            return { ...memberWithStatus.membership, ...data };
          },
        });

        const ctx = makeCtx({
          _params: { organizationId: 'org-1', memberId: 'person-1' },
          _body: { status: to },
        });

        const response = await updateMember(ctx);
        expect(response.status).toBe(200);
        expect(capturedStatus).toBe(to);
      });
    }

    test('same status (no-op) is always valid', async () => {
      let capturedStatus: string | null = null;
      mocks = stubRepo(MembershipRepository, {
        getMember: async () => existingMember, // status: 'active'
        updateMember: async (_id: string, data: any) => {
          capturedStatus = data.status;
          return { ...existingMember.membership, ...data };
        },
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1', memberId: 'person-1' },
        _body: { status: 'active' },
      });

      const response = await updateMember(ctx);
      expect(response.status).toBe(200);
      expect(capturedStatus).toBe('active');
    });
  });

  // ─── [BR-03] Membership Transitions — Invalid ────────

  describe('[BR-03] invalid transitions silently rejected', () => {
    const invalidTransitions: Array<[string, string, string]> = [
      ['active', 'pending', 'cannot revert to pending'],
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
      ['suspended', 'pending', 'cannot revert to pending'],
      ['pending', 'active', 'pending→active via reviewApplication only'],
      ['pending', 'suspended', 'must approve first'],
    ];

    for (const [from, to, reason] of invalidTransitions) {
      test(`${from} → ${to} rejected (${reason})`, async () => {
        const memberWithStatus = {
          ...existingMember,
          membership: { ...existingMember.membership, status: from },
        };
        let capturedStatus: string | null = null;
        mocks = stubRepo(MembershipRepository, {
          getMember: async () => memberWithStatus,
          updateMember: async (_id: string, data: any) => {
            capturedStatus = data.status;
            return { ...memberWithStatus.membership, ...data };
          },
        });

        const ctx = makeCtx({
          _params: { organizationId: 'org-1', memberId: 'person-1' },
          _body: { status: to },
        });

        const response = await updateMember(ctx);
        // [BR-03] Invalid transitions: no error, no state change
        expect(response.status).toBe(200);
        expect(capturedStatus).toBe(from); // status unchanged
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
