import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CertificatesRepository } from './repos/certificates.repo';
import { listCertificates } from './listCertificates';

describe('[BR-20] listCertificates', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns certificates for authenticated user with 200', async () => {
    const certs = [
      { id: 'cert-1', certificateNumber: 'CERT-001' },
      { id: 'cert-2', certificateNumber: 'CERT-002' },
    ];
    mocks = stubRepo(CertificatesRepository, {
      listByPerson: async () => certs,
    });
    const ctx = makeCtx({});
    const res = await listCertificates(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('returns empty array when user has no certificates', async () => {
    mocks = stubRepo(CertificatesRepository, {
      listByPerson: async () => [],
    });
    const ctx = makeCtx({});
    const res = await listCertificates(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('crashes without session (auth middleware handles this)', async () => {
    mocks = stubRepo(CertificatesRepository, {
      listByPerson: async () => [],
    });
    const ctx = makeCtx({ user: null, session: null });
    await expect(listCertificates(ctx)).rejects.toThrow();
  });
});
