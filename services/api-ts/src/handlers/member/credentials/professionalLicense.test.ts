// FIX-008 (Batch D): per-handler unit suite for professional-license lifecycle CRUD.
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createProfessionalLicense } from './createProfessionalLicense';
import { getProfessionalLicense } from './getProfessionalLicense';
import { updateProfessionalLicense } from './updateProfessionalLicense';
import { deleteProfessionalLicense } from './deleteProfessionalLicense';
import { listProfessionalLicenses } from './listProfessionalLicenses';
import { ProfessionalLicenseRepository } from '@/handlers/association:member/repos/credits.repo';

afterEach(() => restoreRepo(ProfessionalLicenseRepository));

const licenseBody = {
  personId: 'p1',
  licenseType: 'PRC',
  licenseNumber: 'LIC-001',
  issuingAuthority: 'PRC',
  jurisdiction: 'PH',
  issuedDate: '2024-01-01',
  expirationDate: '2027-01-01',
  status: 'active',
  documentRef: null,
};

describe('createProfessionalLicense', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: licenseBody });
    expect((await createProfessionalLicense(ctx)).status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: licenseBody });
    expect((await createProfessionalLicense(ctx)).status).toBe(403);
  });

  test('persists a license scoped to the caller org on happy path', async () => {
    let createdArgs: any = null;
    stubRepo(ProfessionalLicenseRepository, {
      createOne: async (args: any) => { createdArgs = args; return { id: 'lic-1', ...args }; },
    });
    const ctx = makeCtx({ _body: licenseBody });
    const res = await createProfessionalLicense(ctx) as any;
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('lic-1');
    expect(createdArgs.organizationId).toBe('tenant-1');
    expect(createdArgs.licenseNumber).toBe('LIC-001');
  });
});

describe('getProfessionalLicense', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { licenseId: 'lic-1' } });
    expect((await getProfessionalLicense(ctx)).status).toBe(401);
  });

  test('throws NotFound for an unknown license', async () => {
    stubRepo(ProfessionalLicenseRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { licenseId: 'missing' } });
    await expect(getProfessionalLicense(ctx)).rejects.toThrow(/ProfessionalLicense/i);
  });

  test('returns the license on happy path', async () => {
    stubRepo(ProfessionalLicenseRepository, { findOneById: async () => ({ id: 'lic-1', licenseNumber: 'LIC-001' }) });
    const ctx = makeCtx({ _params: { licenseId: 'lic-1' } });
    const res = await getProfessionalLicense(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.licenseNumber).toBe('LIC-001');
  });
});

describe('updateProfessionalLicense', () => {
  test('throws NotFound when updating a missing license', async () => {
    stubRepo(ProfessionalLicenseRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { licenseId: 'missing' }, _body: { status: 'expired' } });
    await expect(updateProfessionalLicense(ctx)).rejects.toThrow(/ProfessionalLicense/i);
  });

  test('applies the patch on happy path', async () => {
    stubRepo(ProfessionalLicenseRepository, {
      findOneById: async () => ({ id: 'lic-1', status: 'active' }),
      updateOneById: async (_id: string, patch: any) => ({ id: 'lic-1', ...patch }),
    });
    const ctx = makeCtx({ _params: { licenseId: 'lic-1' }, _body: { status: 'expired' } });
    const res = await updateProfessionalLicense(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('expired');
  });
});

describe('deleteProfessionalLicense', () => {
  test('throws NotFound when deleting a missing license', async () => {
    stubRepo(ProfessionalLicenseRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { licenseId: 'missing' } });
    await expect(deleteProfessionalLicense(ctx)).rejects.toThrow(/ProfessionalLicense/i);
  });

  test('deletes (soft-delete with actor id) and returns 204', async () => {
    let deletedWith: any[] = [];
    stubRepo(ProfessionalLicenseRepository, {
      findOneById: async () => ({ id: 'lic-1' }),
      deleteOneById: async (...args: any[]) => { deletedWith = args; },
    });
    const ctx = makeCtx({ _params: { licenseId: 'lic-1' } });
    const res = await deleteProfessionalLicense(ctx);
    expect(res.status).toBe(204);
    // delete records the acting user id (audit trail for a regulated record)
    expect(deletedWith[0]).toBe('lic-1');
    expect(deletedWith[1]).toBe('user-1');
  });
});

describe('listProfessionalLicenses', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _query: {} });
    expect((await listProfessionalLicenses(ctx)).status).toBe(401);
  });

  test('returns paginated licenses scoped to the org', async () => {
    let filters: any = null;
    stubRepo(ProfessionalLicenseRepository, {
      findManyWithPagination: async (f: any) => { filters = f; return { data: [{ id: 'lic-1' }], totalCount: 1 }; },
    });
    const ctx = makeCtx({ _query: { limit: '20', offset: '0', personId: 'p1' } });
    const res = await listProfessionalLicenses(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination.totalCount).toBe(1);
    expect(filters.organizationId).toBe('tenant-1');
    expect(filters.personId).toBe('p1');
  });
});
