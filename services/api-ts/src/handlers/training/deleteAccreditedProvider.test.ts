import { describe, test, expect, afterEach } from 'bun:test';
import { mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { deleteAccreditedProvider } from './deleteAccreditedProvider';

const fakeProvider = {
  id: 'provider-1',
  organizationId: 'org-1',
  name: 'PRC Academy',
  accreditationNumber: 'PRC-2026-001',
  status: 'active' as const,
  expiryDate: new Date('2027-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('deleteAccreditedProvider', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1', providerId: 'provider-1' },
    });
    const res = await deleteAccreditedProvider(ctx as any);
    expect(res.status).toBe(401);
  });

  test('deletes provider and returns 204', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    let deleteCalled = false;
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => fakeProvider,
      delete: async () => { deleteCalled = true; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'provider-1' },
    });

    const res = await deleteAccreditedProvider(ctx as any);
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  test('throws NotFoundError when provider not found in org', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => undefined,
      delete: async () => {},
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'other-provider' },
    });

    await expect(deleteAccreditedProvider(ctx as any)).rejects.toThrow('not found');
  });

  test('returns 403 for non-officer', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async (ctx: any) => ctx.json({ error: 'Position access denied' }, 403),
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'provider-1' },
    });

    const res = await deleteAccreditedProvider(ctx as any);
    expect(res.status).toBe(403);
  });
});
