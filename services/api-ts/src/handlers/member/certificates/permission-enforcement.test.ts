/**
 * Permission enforcement tests for Certificates module.
 *
 * Verifies:
 * - generateCertificatePdf: member cannot generate PDF for another member's certificate
 * - generateCertificatePdf: returns 401 without user
 *
 * getCertificate owner-only coverage moved with the handler to
 * association:member/getCertificate (deleted at 2579d9b7).
 * batchGenerateCertificates coverage removed with the handler — successor
 * association:member/bulkIssueCertificates owns the bulk-issue surface.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeCertificate } from '@/test-utils/factories';
import { CertificatesRepository } from './repos/certificates.repo';
import { generateCertificatePdf } from './generateCertificatePdf';
import { ForbiddenError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const ownedCert = fakeCertificate({
  personId: 'user-1',
  organizationId: 'tenant-1',
  certificateNumber: 'CERT-2026-0001',
});
const otherUserCert = fakeCertificate({
  personId: 'other-user',
  organizationId: 'tenant-1',
  id: 'cert-other',
  certificateNumber: 'CERT-2026-0002',
});

beforeEach(() => {
  restoreRepo(CertificatesRepository);
});

afterEach(() => {
  restoreRepo(CertificatesRepository);
});

// ─── generateCertificatePdf: owner-only ────────────────

describe('generateCertificatePdf — member cannot generate for others', () => {
  test('throws ForbiddenError when user tries to generate PDF for another member', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => otherUserCert,
    });

    // user-1 trying to generate PDF for other-user's certificate
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { id: 'cert-other' },
      _body: {},
    });

    await expect(generateCertificatePdf(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows certificate owner to generate their PDF', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => ownedCert,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', name: 'Test User', role: 'user', twoFactorEnabled: true },
      organizationId: 'tenant-1',
      _params: { id: 'cert-1' },
      _body: {
        recipientName: 'Test User',
        trainingTitle: 'CPD Seminar',
        organizationName: 'Dental Association',
        certificateType: 'attendance',
      },
    });

    const res = await generateCertificatePdf(ctx);
    expect(res.status).toBe(200);
  });

  test('returns 401 without authenticated user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      organizationId: 'tenant-1',
      _params: { id: 'cert-1' },
      _body: {},
    });

    const res = await generateCertificatePdf(ctx);
    expect(res.status).toBe(401);
  });
});

// batchGenerateCertificates blocks removed with the handler — coverage moved
// to association:member/bulkIssueCertificates tests.
