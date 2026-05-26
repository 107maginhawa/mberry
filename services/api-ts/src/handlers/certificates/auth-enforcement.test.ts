/**
 * Auth enforcement tests for Certificates module (P1 security fixes).
 *
 * Tests IDOR prevention on getCertificate and officer restriction on batchGenerateCertificates.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeCertificate } from '@/test-utils/factories';
import { CertificatesRepository } from './repos/certificates.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getCertificate } from './getCertificate';
import { batchGenerateCertificates } from './batchGenerateCertificates';
import { ForbiddenError, UnauthorizedError } from '@/core/errors';

// ─── Shared Setup ───────────────────────────────────────

const ownedCert = fakeCertificate({ personId: 'user-1', organizationId: 'tenant-1' });
const otherCert = fakeCertificate({ personId: 'other-user', organizationId: 'other-org', id: 'cert-other' });

function stubOfficerAllowed() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
  });
}

function stubOfficerDenied() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [],
  });
}

beforeEach(() => {
  restoreRepo(CertificatesRepository);
  restoreRepo(OfficerTermRepository);
});

afterEach(() => {
  restoreRepo(CertificatesRepository);
  restoreRepo(OfficerTermRepository);
});

// ─── P1: getCertificate IDOR prevention ─────────────────

describe('P1: getCertificate IDOR prevention', () => {
  test('returns certificate when owner matches', async () => {
    stubRepo(CertificatesRepository, { get: async () => ownedCert });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { id: 'cert-1' },
    });
    const res = await getCertificate(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError for cross-org non-owner access', async () => {
    stubRepo(CertificatesRepository, { get: async () => otherCert });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { id: 'cert-other' },
    });
    await expect(getCertificate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows same-org access even if not owner (officers viewing member certs)', async () => {
    const sameOrgCert = fakeCertificate({ personId: 'other-user', organizationId: 'tenant-1' });
    stubRepo(CertificatesRepository, { get: async () => sameOrgCert });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { id: 'cert-1' },
    });
    const res = await getCertificate(ctx);
    expect(res.status).toBe(200);
  });

  test('throws UnauthorizedError without user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'cert-1' },
    });
    await expect(getCertificate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

// ─── P1: batchGenerateCertificates officer restriction ──

describe('P1: batchGenerateCertificates officer restriction', () => {
  test('returns 403 for non-officer', async () => {
    stubOfficerDenied();
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _body: {
        certificateIds: ['cert-1'],
        template: { trainingTitle: 'Test', organizationName: 'Org', certificateType: 'attendance' },
      },
    });
    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      organizationId: 'tenant-1',
      _body: { certificateIds: ['cert-1'] },
    });
    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(401);
  });
});
