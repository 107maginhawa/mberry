import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeAccreditedProvider as createFakeProvider } from '@/test-utils/factories';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { updateAccreditedProvider } from './updateAccreditedProvider';

const fakeProvider = createFakeProvider({
  accreditationNumber: 'PRC-2026-001',
  status: 'active' as const,
  expiryDate: new Date('2027-01-01'),
});

describe('updateAccreditedProvider', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
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
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
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
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
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
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'provider-1' },
      _body: { name: 'Updated' },
    });

    const res = await updateAccreditedProvider(ctx as any);
    expect(res.status).toBe(403);
  });
});
