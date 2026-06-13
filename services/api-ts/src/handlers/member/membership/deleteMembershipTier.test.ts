import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeMembershipTier } from '@/test-utils/factories';
import { deleteMembershipTier } from './deleteMembershipTier';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { NotFoundError, UnauthorizedError, ConflictError } from '@/core/errors';

describe('deleteMembershipTier', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // FIX-015 / BR-04: deleting a tier with members assigned must surface a
  // friendly 409 (ConflictError), not a raw FK-violation 500.
  test('throws ConflictError when the tier has members assigned (FIX-015)', async () => {
    mocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'tenant-1' }),
      countMembersInTier: async () => 3,
      deleteOneById: async () => { throw new Error('FK violation — should not be reached'); },
    });

    const ctx = makeCtx({ _params: { tierId: 'tier-1' } });
    await expect(deleteMembershipTier(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('deletes a tier with no members assigned and returns 204 (FIX-015)', async () => {
    let deleted = false;
    mocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'tenant-1' }),
      countMembersInTier: async () => 0,
      deleteOneById: async () => { deleted = true; },
    });

    const ctx = makeCtx({ _params: { tierId: 'tier-1' } });
    const response = await deleteMembershipTier(ctx);
    expect(response.status).toBe(204);
    expect(deleted).toBe(true);
  });

  test('throws NotFoundError for a non-existent tier', async () => {
    mocks = stubRepo(MembershipTierRepository, { findOneById: async () => undefined });
    const ctx = makeCtx({ _params: { tierId: 'nope' } });
    await expect(deleteMembershipTier(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeMembershipTier({ id: 'tier-1', organizationId: 'tenant-1' }),
    });
    const ctx = makeCtx({ user: null, session: null, _params: { tierId: 'tier-1' } });
    await expect(deleteMembershipTier(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
