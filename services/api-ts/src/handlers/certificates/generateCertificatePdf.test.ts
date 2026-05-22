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

  test('returns 200 with HTML content for owned certificate', async () => {
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
    expect(res.body.certificateId).toBe('cert-1');
    expect(res.body.certificateNumber).toBe('CERT-2026-000001');
    expect(res.body.html).toContain('Dr. Maria Santos');
    expect(res.body.html).toContain('Advanced Implants');
    expect(res.body.html).toContain('Certificate of Attendance');
    expect(res.body.contentType).toBe('text/html');
  });

  test('applies org branding (logo, color, signatory)', async () => {
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
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#ff0000',
        signatoryName: 'Dr. President',
        signatoryTitle: 'President',
      },
    });
    const res = await generateCertificatePdf(ctx);

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('https://example.com/logo.png');
    expect(res.body.html).toContain('#ff0000');
    expect(res.body.html).toContain('Dr. President');
    expect(res.body.html).toContain('Certificate of Completion');
  });

  test('includes credit information when provided', async () => {
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
    expect(res.body.html).toContain('8 CPD Credits');
    expect(res.body.html).toContain('(Major)');
  });
});
