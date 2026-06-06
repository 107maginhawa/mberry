/**
 * Auth enforcement tests for Certificates module (P1 security fixes).
 *
 * Tests officer restriction on batchGenerateCertificates. IDOR coverage on
 * getCertificate moved with the handler to association:member/getCertificate
 * (deleted at 2579d9b7 — successor has its own auth tests).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CertificatesRepository } from './repos/certificates.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { batchGenerateCertificates } from './batchGenerateCertificates';

// ─── Shared Setup ───────────────────────────────────────

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
