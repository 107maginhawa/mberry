import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getMembershipTier } from './getMembershipTier';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { NotFoundError, UnauthorizedError } from '@/core/errors';

describe('getMembershipTier', () => {
  afterEach(() => {
    restoreRepo(MembershipTierRepository);
  });

  test('returns the tier when found', async () => {
    stubRepo(MembershipTierRepository, {
      findOneById: async (id: string) => ({ id, name: 'Gold', organizationId: 'tenant-1' }),
    });

    const ctx = makeCtx({ _params: { tierId: 'tier-1' } });
    const response = await getMembershipTier(ctx);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('tier-1');
    expect(response.body.name).toBe('Gold');
  });

  test('throws UnauthorizedError when no session', async () => {
    stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1' }),
    });

    const ctx = makeCtx({ user: null, session: null, _params: { tierId: 'tier-1' } });
    await expect(getMembershipTier(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws NotFoundError when tier does not exist', async () => {
    stubRepo(MembershipTierRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { tierId: 'nonexistent' } });
    await expect(getMembershipTier(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('passes the route tierId to the repo', async () => {
    let capturedId: string | null = null;
    stubRepo(MembershipTierRepository, {
      findOneById: async (id: string) => { capturedId = id; return { id }; },
    });

    const ctx = makeCtx({ _params: { tierId: 'tier-99' } });
    await getMembershipTier(ctx);
    expect(capturedId).toBe('tier-99');
  });
});
