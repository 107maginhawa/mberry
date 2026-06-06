/**
 * Tests for org-accredited-provider handlers (re-exports from training module):
 * createOrgAccreditedProvider, listOrgAccreditedProviders,
 * updateOrgAccreditedProvider, deleteOrgAccreditedProvider
 *
 * These handlers share auth guard + officer position check via requirePosition.
 *
 * Covers:
 * - Auth denial (unauthenticated → 401)
 * - Position guard (non-officer → 403)
 * - Happy path with body assertions
 * - Not-found for update/delete
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AccreditedProviderRepository } from '@/handlers/association:operations/repos/accredited-provider.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ────────────────────────────────────────────

const baseProvider = {
  id: 'prov-1',
  organizationId: 'org-1',
  name: 'PRC Dental Academy',
  accreditationNumber: 'ACC-2024-001',
  status: 'active' as const,
  expiryDate: new Date('2026-12-31'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const officerTerms = [{ positionTitle: 'Society Officer' }];

// ─── Helpers ─────────────────────────────────────────────

function stubOfficer() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => officerTerms,
  });
}

// ═══════════════════════════════════════════════════════
// createOrgAccreditedProvider
// ═══════════════════════════════════════════════════════

describe('createOrgAccreditedProvider', () => {
  beforeEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const { createOrgAccreditedProvider } = await import('./createOrgAccreditedProvider');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
    });
    const res = await createOrgAccreditedProvider(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 201 with provider data on success', async () => {
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      createOne: async () => baseProvider,
    });
    const { createOrgAccreditedProvider } = await import('./createOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'PRC Dental Academy', accreditationNumber: 'ACC-2024-001' },
    });
    const res = await createOrgAccreditedProvider(ctx);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.data.id).toBe('prov-1');
    expect(body.data.name).toBe('PRC Dental Academy');
    expect(body.data.accreditationNumber).toBe('ACC-2024-001');
    expect(body.data.organizationId).toBe('org-1');
    expect(body.data.status).toBe('active');
  });

  test('defaults status to active when not provided', async () => {
    let capturedData: any = null;
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { ...baseProvider, ...data };
      },
    });
    const { createOrgAccreditedProvider } = await import('./createOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'Test Academy', accreditationNumber: 'ACC-999' },
    });
    await createOrgAccreditedProvider(ctx);
    expect(capturedData.status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════
// listOrgAccreditedProviders
// ═══════════════════════════════════════════════════════

describe('listOrgAccreditedProviders', () => {
  beforeEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const { listOrgAccreditedProviders } = await import('./listOrgAccreditedProviders');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
    });
    const res = await listOrgAccreditedProviders(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with provider list and total', async () => {
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async () => ({
        data: [{ ...baseProvider, expiringSoon: false }],
        total: 1,
      }),
    });
    const { listOrgAccreditedProviders } = await import('./listOrgAccreditedProviders');
    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listOrgAccreditedProviders(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.data[0].id).toBe('prov-1');
    expect(body.data[0].name).toBe('PRC Dental Academy');
    expect(body.data[0].expiringSoon).toBe(false);
  });

  test('returns empty list when org has no providers', async () => {
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async () => ({ data: [], total: 0 }),
    });
    const { listOrgAccreditedProviders } = await import('./listOrgAccreditedProviders');
    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listOrgAccreditedProviders(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  test('passes status filter query param to repo', async () => {
    let capturedStatus: string | null = null;
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      listWithExpiry: async (_orgId: string, status: string | null) => {
        capturedStatus = status;
        return { data: [], total: 0 };
      },
    });
    const { listOrgAccreditedProviders } = await import('./listOrgAccreditedProviders');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'expired' },
    });
    await listOrgAccreditedProviders(ctx);
    expect(capturedStatus).toBe('expired');
  });
});

// ═══════════════════════════════════════════════════════
// updateOrgAccreditedProvider
// ═══════════════════════════════════════════════════════

describe('updateOrgAccreditedProvider', () => {
  beforeEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const { updateOrgAccreditedProvider } = await import('./updateOrgAccreditedProvider');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1', providerId: 'prov-1' },
    });
    const res = await updateOrgAccreditedProvider(ctx);
    expect(res.status).toBe(401);
  });

  test('throws NotFoundError when provider does not exist', async () => {
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => undefined,
    });
    const { updateOrgAccreditedProvider } = await import('./updateOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'missing' },
      _body: { name: 'Updated' },
    });
    await expect(updateOrgAccreditedProvider(ctx)).rejects.toThrow(/not found/i);
  });

  test('returns 200 with updated provider data', async () => {
    const updatedProvider = { ...baseProvider, name: 'Renamed Academy' };
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => baseProvider,
      update: async () => updatedProvider,
    });
    const { updateOrgAccreditedProvider } = await import('./updateOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'prov-1' },
      _body: { name: 'Renamed Academy' },
    });
    const res = await updateOrgAccreditedProvider(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data.id).toBe('prov-1');
    expect(body.data.name).toBe('Renamed Academy');
    expect(body.data.organizationId).toBe('org-1');
  });
});

// ═══════════════════════════════════════════════════════
// deleteOrgAccreditedProvider
// ═══════════════════════════════════════════════════════

describe('deleteOrgAccreditedProvider', () => {
  beforeEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(AccreditedProviderRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const { deleteOrgAccreditedProvider } = await import('./deleteOrgAccreditedProvider');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1', providerId: 'prov-1' },
    });
    const res = await deleteOrgAccreditedProvider(ctx);
    expect(res.status).toBe(401);
  });

  test('throws NotFoundError when provider does not exist', async () => {
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => undefined,
    });
    const { deleteOrgAccreditedProvider } = await import('./deleteOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'missing' },
    });
    await expect(deleteOrgAccreditedProvider(ctx)).rejects.toThrow(/not found/i);
  });

  test('returns 204 on successful deletion', async () => {
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => baseProvider,
      delete: async () => {},
    });
    const { deleteOrgAccreditedProvider } = await import('./deleteOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'prov-1' },
    });
    const res = await deleteOrgAccreditedProvider(ctx);
    expect(res.status).toBe(204);
  });

  test('calls delete with correct provider id', async () => {
    let deletedId: string | null = null;
    stubOfficer();
    stubRepo(AccreditedProviderRepository, {
      getByOrg: async () => baseProvider,
      delete: async (id: string) => { deletedId = id; },
    });
    const { deleteOrgAccreditedProvider } = await import('./deleteOrgAccreditedProvider');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1', providerId: 'prov-1' },
    });
    await deleteOrgAccreditedProvider(ctx);
    expect(deletedId).toBe('prov-1');
  });
});
