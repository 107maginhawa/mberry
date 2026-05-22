import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeAccreditedProvider as createFakeProvider } from '@/test-utils/factories';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { listAccreditedProviders } from './listAccreditedProviders';

const fakeProviderWithExpiry = {
  ...createFakeProvider({
    accreditationNumber: 'PRC-2026-001',
    status: 'active' as const,
    expiryDate: new Date('2027-01-01'),
  }),
  expiringSoon: false,
};

describe('listAccreditedProviders', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns provider list with expiringSoon flag and 200', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
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
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
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
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect(res.status).toBe(403);
  });
});
