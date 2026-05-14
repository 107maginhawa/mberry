import { describe, test, expect, afterEach } from 'bun:test';
import { mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { listAccreditedProviders } from './listAccreditedProviders';

const fakeProviderWithExpiry = {
  id: 'provider-1',
  organizationId: 'org-1',
  name: 'PRC Academy',
  accreditationNumber: 'PRC-2026-001',
  status: 'active' as const,
  expiryDate: new Date('2027-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  expiringSoon: false,
};

describe('listAccreditedProviders', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns provider list with expiringSoon flag and 200', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async () => ({ data: [fakeProviderWithExpiry], total: 1 }),
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.total).toBe(1);
  });

  test('passes status filter to repo', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    let capturedStatus: string | null | undefined;
    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async (_orgId: string, status: string | null | undefined) => {
        capturedStatus = status;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'active' },
    });
    await listAccreditedProviders(ctx as any);
    expect(capturedStatus).toBe('active');
  });

  test('returns 403 for non-officer', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async (ctx: any) => ctx.json({ error: 'Position access denied' }, 403),
    }));
    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect(res.status).toBe(403);
  });
});
