import { describe, test, expect, afterEach } from 'bun:test';
import { mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { updateAccreditedProvider } from './updateAccreditedProvider';

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

describe('updateAccreditedProvider', () => {
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
      _body: { name: 'Updated' },
    });
    const res = await updateAccreditedProvider(ctx as any);
    expect(res.status).toBe(401);
  });

  test('updates provider and returns 200', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => fakeProvider,
      update: async (_id: string, data: any) => ({ ...fakeProvider, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'provider-1' },
      _body: { name: 'Updated Academy' },
    });

    const res = await updateAccreditedProvider(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data.name).toBe('Updated Academy');
  });

  test('throws NotFoundError when provider not found for org', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => undefined,
      update: async (_id: string, data: any) => ({ ...fakeProvider, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'missing' },
      _body: { name: 'Updated' },
    });

    await expect(updateAccreditedProvider(ctx as any)).rejects.toThrow('not found');
  });

  test('returns 403 for non-officer', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async (ctx: any) => ctx.json({ error: 'Position access denied' }, 403),
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'provider-1' },
      _body: { name: 'Updated' },
    });

    const res = await updateAccreditedProvider(ctx as any);
    expect(res.status).toBe(403);
  });
});
