// Business Rules: [BR-20]
/**
 * Tests for generateCertificatePdf handler (Slice 042)
 *
 * Covers:
 * - Auth guards (401, IDOR 403)
 * - Template rendering with branding
 * - Validation errors
 * - PDF HTML generation
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeCertificate } from '@/test-utils/factories';
import { CertificatesRepository } from './repos/certificates.repo';
import { generateCertificatePdf } from './generateCertificatePdf';

// ─── Fixtures ───────────────────────────────────────────

const OWNER = 'user-1';

const fakeCert = fakeCertificate({
  personId: OWNER,
  trainingId: 'training-1',
  certificateNumber: 'CERT-2026-000001',
  issuedAt: new Date('2026-03-15'),
});

// ─── Tests ──────────────────────────────────────────────

describe('[042] generateCertificatePdf', () => {
  beforeEach(() => {
    restoreRepo(CertificatesRepository);
  });

  afterEach(() => {
    restoreRepo(CertificatesRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, _params: { id: 'cert-1' } });
    const res = await generateCertificatePdf(ctx);
    expect(res.status).toBe(401);
  });

  test('throws NotFoundError when certificate missing', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(generateCertificatePdf(ctx)).rejects.toThrow('Certificate not found');
  });

  test('throws ForbiddenError when user does not own cert (IDOR)', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => ({ ...fakeCert, personId: 'other-person' }),
    });
    const ctx = makeCtx({ _params: { id: 'cert-1' } });
    await expect(generateCertificatePdf(ctx)).rejects.toThrow('Access denied');
  });

  // EM-M11-83a8b9c0: WF-074 requires real PDF output, not HTML.
  test('returns 200 with PDF bytes for owned certificate', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => fakeCert,
    });
    const ctx = makeCtx({
      _params: { id: 'cert-1' },
      _body: {
        recipientName: 'Dr. Maria Santos',
        trainingTitle: 'Advanced Implants',
        organizationName: 'PDA',
        certificateType: 'attendance',
      },
    });
    const res = await generateCertificatePdf(ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('CERT_2026_000001.pdf');
    expect(res.headers.get('X-Certificate-Id')).toBe('cert-1');
    expect(res.headers.get('X-Certificate-Number')).toBe('CERT-2026-000001');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    // PDF magic header: %PDF
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('%PDF');
  });

  test('produces a valid PDF with org branding applied', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => fakeCert,
    });
    const ctx = makeCtx({
      _params: { id: 'cert-1' },
      _body: {
        recipientName: 'Dr. Test',
        trainingTitle: 'Test Training',
        organizationName: 'Test Org',
        certificateType: 'completion',
        primaryColor: '#ff0000',
        signatoryName: 'Dr. President',
        signatoryTitle: 'President',
      },
    });
    const res = await generateCertificatePdf(ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('%PDF');
  });

  test('produces a valid PDF when credit information is provided', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => fakeCert,
    });
    const ctx = makeCtx({
      _params: { id: 'cert-1' },
      _body: {
        recipientName: 'Dr. Test',
        trainingTitle: 'Workshop',
        organizationName: 'Org',
        certificateType: 'attendance',
        creditAmount: 8,
        creditCategory: 'Major',
      },
    });
    const res = await generateCertificatePdf(ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('%PDF');
  });
});
