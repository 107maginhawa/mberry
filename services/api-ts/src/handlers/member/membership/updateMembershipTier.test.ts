import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMembershipTier } from '@/test-utils/factories';
import { updateMembershipTier } from './updateMembershipTier';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

describe('updateMembershipTier', () => {
  afterEach(() => {
    restoreRepo(MembershipTierRepository);
  });

  test('updates tier and returns 200 (happy path)', async () => {
    const existing = fakeMembershipTier({ id: 'tier-1', name: 'Regular' });
    const updated = { ...existing, name: 'Premium', annualFee: 200_00 };
    stubRepo(MembershipTierRepository, {
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { tierId: 'tier-1' },
      _body: { name: 'Premium', annualFee: 200_00 },
    });

    const response = await updateMembershipTier(ctx);
    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.id).toBe('tier-1');
    expect(body.name).toBe('Premium');
    expect(body.annualFee).toBe(200_00);
  });

  test('updateOneById is called with tierId and body', async () => {
    let capturedId: string | undefined;
    let capturedData: any;
    const existing = fakeMembershipTier({ id: 'tier-2' });
    stubRepo(MembershipTierRepository, {
      findOneById: async () => existing,
      updateOneById: async (id: string, data: any) => {
        capturedId = id;
        capturedData = data;
        return { ...existing, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { tierId: 'tier-2' },
      _body: { code: 'PREM' },
    });

    await updateMembershipTier(ctx);
    expect(capturedId).toBe('tier-2');
    expect(capturedData.code).toBe('PREM');
  });

  test('throws NotFoundError when tier does not exist', async () => {
    stubRepo(MembershipTierRepository, {
      findOneById: async () => undefined,
      updateOneById: async () => ({}),
    });

    const ctx = makeCtx({
      _params: { tierId: 'missing-tier' },
      _body: { name: 'X' },
    });

    await expect(updateMembershipTier(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { tierId: 'tier-1' },
      _body: { name: 'X' },
    });
    await expect(updateMembershipTier(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('findOneById is called with correct tierId', async () => {
    let lookedUpId: string | undefined;
    stubRepo(MembershipTierRepository, {
      findOneById: async (id: string) => {
        lookedUpId = id;
        return fakeMembershipTier({ id });
      },
      updateOneById: async (_id: string, data: any) => ({ id: _id, ...data }),
    });

    const ctx = makeCtx({
      _params: { tierId: 'tier-99' },
      _body: {},
    });

    await updateMembershipTier(ctx);
    expect(lookedUpId).toBe('tier-99');
  });

  test('returned body reflects updated fields', async () => {
    const base = fakeMembershipTier({ id: 'tier-3', status: 'active' });
    stubRepo(MembershipTierRepository, {
      findOneById: async () => base,
      updateOneById: async (_id: string, data: any) => ({ ...base, ...data }),
    });

    const ctx = makeCtx({
      _params: { tierId: 'tier-3' },
      _body: { status: 'inactive', currency: 'USD' },
    });

    const response = await updateMembershipTier(ctx);
    const body = (response as any).body;
    expect(body.status).toBe('inactive');
    expect(body.currency).toBe('USD');
  });
});
