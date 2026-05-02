import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CertificatesRepository } from './repos/certificates.repo';
import { getCertificate } from './getCertificate';

describe('getCertificate', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns certificate with 200', async () => {
    const cert = { id: 'cert-1', certificateNumber: 'CERT-2026-001', personId: 'p-1' };
    mocks = stubRepo(CertificatesRepository, {
      get: async () => cert,
    });
    const ctx = makeCtx({ _params: { id: 'cert-1' } });
    const res = await getCertificate(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(cert);
  });

  test('throws NotFoundError when certificate does not exist', async () => {
    mocks = stubRepo(CertificatesRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(getCertificate(ctx)).rejects.toThrow('Certificate not found');
  });
});
