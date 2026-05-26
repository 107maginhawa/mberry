/**
 * Permission enforcement tests for Certificates module.
 *
 * Verifies:
 * - generateCertificatePdf: member cannot generate PDF for another member's certificate
 * - generateCertificatePdf: returns 401 without user
 * - getCertificate: owner-only access (ForbiddenError for non-owner)
 * - batchGenerateCertificates: returns 401 without user
 * - batchGenerateCertificates: cross-org cert filtered as error
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeCertificate } from '@/test-utils/factories';
import { CertificatesRepository } from './repos/certificates.repo';
import { getCertificate } from './getCertificate';
import { generateCertificatePdf } from './generateCertificatePdf';
import { batchGenerateCertificates } from './batchGenerateCertificates';
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
const crossOrgCert = fakeCertificate({
  personId: 'other-user',
  organizationId: 'other-org',
  id: 'cert-cross-org',
  certificateNumber: 'CERT-2026-0003',
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

// ─── getCertificate: owner-only ────────────────────────

describe('getCertificate — cross-user access blocked', () => {
  test('throws ForbiddenError when non-owner accesses certificate', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => otherUserCert,
    });

    // user-1 trying to access other-user's cert
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { id: 'cert-other' },
    });

    await expect(getCertificate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows owner to access their certificate', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => ownedCert,
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { id: 'cert-1' },
    });

    const res = await getCertificate(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── batchGenerateCertificates: auth check ─────────────

describe('batchGenerateCertificates — authentication', () => {
  test('returns 401 without authenticated user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      organizationId: 'tenant-1',
      _body: { certificateIds: ['cert-1'] },
    });

    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organization context', async () => {
    const ctx = makeCtx({
      organizationId: null,
      _body: {
        certificateIds: ['cert-1'],
        template: {
          trainingTitle: 'Test',
          organizationName: 'Org',
          certificateType: 'attendance',
        },
      },
    });

    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(403);
  });

  test('cross-org certificate is reported as error in batch results', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => crossOrgCert,
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _body: {
        certificateIds: ['cert-cross-org'],
        template: {
          trainingTitle: 'CPD Seminar',
          organizationName: 'Dental Association',
          certificateType: 'attendance',
        },
      },
    });

    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(200);
    // The cross-org cert should be reported as an error in results
    expect(res.body.results[0].status).toBe('error');
    expect(res.body.results[0].error).toContain('different organization');
  });

  test('same-org certificate succeeds in batch', async () => {
    stubRepo(CertificatesRepository, {
      get: async () => ownedCert,
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _body: {
        certificateIds: ['cert-1'],
        template: {
          trainingTitle: 'CPD Seminar',
          organizationName: 'Dental Association',
          certificateType: 'attendance',
        },
      },
    });

    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe('success');
    expect(res.body.summary.success).toBe(1);
  });
});
