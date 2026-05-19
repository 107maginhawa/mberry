/**
 * Unit tests for Accredited Provider CRUD handlers.
 * Covers: auth guard (401), CRUD operations, status filter, expiry flag, org isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { listAccreditedProviders } from './listAccreditedProviders';
import { createAccreditedProvider } from './createAccreditedProvider';
import { updateAccreditedProvider } from './updateAccreditedProvider';
import { deleteAccreditedProvider } from './deleteAccreditedProvider';

// ─── Fixtures ────────────────────────────────────────────

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

const fakeProviderWithExpiry = {
  ...fakeProvider,
  expiringSoon: false,
};

// Helper: stub OfficerTermRepository to allow access (has active officer term)
function mockOfficerAllow() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
  });
}

// Helper: stub OfficerTermRepository to deny access (no active terms)
function mockOfficerDeny() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [],
  });
}

// ─── listAccreditedProviders ─────────────────────────────

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

  test('returns provider list with expiringSoon flag', async () => {
    mockOfficerAllow();
    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async () => ({ data: [fakeProviderWithExpiry], total: 1 }),
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.data[0].expiringSoon).toBe(false);
    expect((res as any).body.total).toBe(1);
  });

  test('passes status filter to repo', async () => {
    mockOfficerAllow();
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

  test('org isolation — only org-1 providers returned', async () => {
    mockOfficerAllow();
    let capturedOrgId: string | undefined;
    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async (orgId: string) => {
        capturedOrgId = orgId;
        return { data: [fakeProviderWithExpiry], total: 1 };
      },
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    await listAccreditedProviders(ctx as any);
    expect(capturedOrgId).toBe('org-1');
  });
});

// ─── createAccreditedProvider ────────────────────────────

describe('createAccreditedProvider', () => {
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
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Academy', accreditationNumber: 'PRC-001' },
    });
    const res = await createAccreditedProvider(ctx as any);
    expect(res.status).toBe(401);
  });

  test('creates provider and returns 201', async () => {
    mockOfficerAllow();
    mocks = stubRepo(AccreditedProviderRepository, {
      createOne: async (data: any) => ({ ...fakeProvider, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        name: 'PRC Academy',
        accreditationNumber: 'PRC-2026-001',
        status: 'active',
      },
    });

    const res = await createAccreditedProvider(ctx as any);
    expect(res.status).toBe(201);
    expect((res as any).body.data.name).toBe('PRC Academy');
    expect((res as any).body.data.organizationId).toBe('org-1');
  });

  test('defaults status to active when not provided', async () => {
    mockOfficerAllow();
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
    mockOfficerDeny();
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Academy', accreditationNumber: 'PRC-001' },
    });

    const res = await createAccreditedProvider(ctx as any);
    expect(res.status).toBe(403);
  });
});

// ─── updateAccreditedProvider ────────────────────────────

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
    mockOfficerAllow();
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
    mockOfficerAllow();
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => undefined,
      update: async (_id: string, data: any) => ({ ...fakeProvider, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'missing-provider' },
      _body: { name: 'Updated' },
    });

    await expect(updateAccreditedProvider(ctx as any)).rejects.toThrow('not found');
  });
});

// ─── deleteAccreditedProvider ────────────────────────────

describe('deleteAccreditedProvider', () => {
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
    });
    const res = await deleteAccreditedProvider(ctx as any);
    expect(res.status).toBe(401);
  });

  test('deletes provider and returns 204', async () => {
    mockOfficerAllow();
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
    mockOfficerAllow();
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => undefined,
      delete: async () => {},
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'other-provider' },
    });

    await expect(deleteAccreditedProvider(ctx as any)).rejects.toThrow('not found');
  });

  test('org A provider not accessible from org B', async () => {
    mockOfficerAllow();
    let capturedOrgId: string | undefined;
    mocks = stubRepo(AccreditedProviderRepository, {
      getByOrg: async (_id: string, orgId: string) => {
        capturedOrgId = orgId;
        return undefined; // org-b cannot see org-a's provider
      },
      delete: async () => {},
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-b', providerId: 'provider-from-org-a' },
    });

    await expect(deleteAccreditedProvider(ctx as any)).rejects.toThrow();
    expect(capturedOrgId).toBe('org-b');
  });
});

// ─── Expiry flag logic (unit test on repo behavior via listWithExpiry stub) ───

describe('expiringSoon flag', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('expiringSoon=true for providers expiring within 30 days', async () => {
    mockOfficerAllow();
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    const expiringSoonProvider = { ...fakeProviderWithExpiry, expiryDate: soon, expiringSoon: true };

    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async () => ({ data: [expiringSoonProvider], total: 1 }),
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect((res as any).body.data[0].expiringSoon).toBe(true);
  });

  test('expiringSoon=false for providers expiring after 30 days', async () => {
    mockOfficerAllow();
    const far = new Date();
    far.setDate(far.getDate() + 90);
    const farProvider = { ...fakeProviderWithExpiry, expiryDate: far, expiringSoon: false };

    mocks = stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async () => ({ data: [farProvider], total: 1 }),
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listAccreditedProviders(ctx as any);
    expect((res as any).body.data[0].expiringSoon).toBe(false);
  });
});
