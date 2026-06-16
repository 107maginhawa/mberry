import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, makeUser, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listMyCertificates } from './listMyCertificates';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeCert = {
  id: 'cred-1',
  personId: 'user-1',
  organizationId: 'tenant-1',
  templateId: 'tmpl-1',
  status: 'active',
  credentialNumber: 'CERT-001',
  issuedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Tests ──────────────────────────────────────────────

describe('listMyCertificates', () => {
  afterEach(() => restoreRepo(DigitalCredentialRepository));

  test('happy path — returns caller certs wrapped in data + total', async () => {
    stubRepo(DigitalCredentialRepository, {
      findMany: async () => [fakeCert],
    });

    const ctx = makeCtx({ user: makeUser({ id: 'user-1' }), _query: {} });
    const res = await listMyCertificates(ctx);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('cred-1');
    expect(res.body.total).toBe(1);
  });

  test('queries by caller personId — not a different user', async () => {
    let capturedFilters: any;
    stubRepo(DigitalCredentialRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
    });

    const ctx = makeCtx({ user: makeUser({ id: 'caller-99' }), _query: {} });
    await listMyCertificates(ctx);

    // Critical: handler scopes query to session.user.id
    expect(capturedFilters.personId).toBe('caller-99');
  });

  test('empty results — returns data:[] total:0', async () => {
    stubRepo(DigitalCredentialRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({ _query: {} });
    const res = await listMyCertificates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test('passes organizationId query filter to repo', async () => {
    let capturedFilters: any;
    stubRepo(DigitalCredentialRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-99' } });
    await listMyCertificates(ctx);

    expect(capturedFilters.organizationId).toBe('org-99');
  });

  test('passes status query filter to repo', async () => {
    let capturedFilters: any;
    stubRepo(DigitalCredentialRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
    });

    const ctx = makeCtx({ _query: { status: 'expired' } });
    await listMyCertificates(ctx);

    expect(capturedFilters.status).toBe('expired');
  });

  test('throws on missing session (unauthorized)', async () => {
    stubRepo(DigitalCredentialRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({ user: null, session: null, _query: {} });
    await expect(listMyCertificates(ctx)).rejects.toThrow();
  });

  test('total matches data length for multiple certs', async () => {
    const certs = [
      { ...fakeCert, id: 'cred-1' },
      { ...fakeCert, id: 'cred-2' },
      { ...fakeCert, id: 'cred-3' },
    ];
    stubRepo(DigitalCredentialRepository, {
      findMany: async () => certs,
    });

    const ctx = makeCtx({ _query: {} });
    const res = await listMyCertificates(ctx);

    expect(res.body.data).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });
});
