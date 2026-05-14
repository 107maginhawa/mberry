import { describe, test, expect, afterEach } from 'bun:test';
import { mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { createAccreditedProvider } from './createAccreditedProvider';

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

describe('createAccreditedProvider', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Academy', accreditationNumber: 'PRC-001' },
    });
    const res = await createAccreditedProvider(ctx as any);
    expect(res.status).toBe(401);
  });

  test('creates provider and returns 201', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(AccreditedProviderRepository, {
      createOne: async (data: any) => ({ ...fakeProvider, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Academy', accreditationNumber: 'PRC-2026-001', status: 'active' },
    });

    const res = await createAccreditedProvider(ctx as any);
    expect(res.status).toBe(201);
    expect((res as any).body.data.name).toBe('PRC Academy');
    expect((res as any).body.data.organizationId).toBe('org-1');
  });

  test('defaults status to active when not provided', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    let capturedData: any;
    mocks = stubRepo(AccreditedProviderRepository, {
      createOne: async (data: any) => { capturedData = data; return { ...fakeProvider, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Academy', accreditationNumber: 'PRC-001' },
    });

    await createAccreditedProvider(ctx as any);
    expect(capturedData.status).toBe('active');
  });

  test('returns 403 for non-officer', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async (ctx: any) => ctx.json({ error: 'Position access denied' }, 403),
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Academy', accreditationNumber: 'PRC-001' },
    });

    const res = await createAccreditedProvider(ctx as any);
    expect(res.status).toBe(403);
  });
});
