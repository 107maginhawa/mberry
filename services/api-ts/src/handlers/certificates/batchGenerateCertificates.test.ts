/**
 * Tests for batchGenerateCertificates handler (Slice 042)
 *
 * Covers:
 * - Auth guards (401, 403 org context)
 * - Batch generation with multiple certificates
 * - Per-row error handling (partial failure)
 * - Max batch size enforcement
 * - Org isolation (cross-org rejection)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CertificatesRepository } from './repos/certificates.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { batchGenerateCertificates } from './batchGenerateCertificates';

// Stub officer check globally — auth enforcement tested in auth-enforcement.test.ts
stubRepo(OfficerTermRepository, {
  findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
});

// ─── Fixtures ───────────────────────────────────────────

function makeCert(id: string, orgId: string = 'org-1', personId: string = 'person-1') {
  return {
    id,
    organizationId: orgId,
    personId,
    trainingId: 'training-1',
    certificateNumber: `CERT-2026-${id}`,
    issuedAt: new Date('2026-03-15'),
  };
}

const validBody = {
  certificateIds: ['cert-1', 'cert-2'],
  template: {
    trainingTitle: 'Advanced Implants Workshop',
    organizationName: 'PDA',
    certificateType: 'attendance' as const,
    creditAmount: 8,
  },
  recipientNames: {
    'person-1': 'Dr. Maria Santos',
    'person-2': 'Dr. Juan Cruz',
  },
};

// ─── Tests ──────────────────────────────────────────────

describe('[042] batchGenerateCertificates', () => {
  beforeEach(() => {
    restoreRepo(CertificatesRepository);
  });

  afterEach(() => {
    restoreRepo(CertificatesRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, _body: validBody });
    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: validBody });
    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 400 when certificateIds is empty', async () => {
    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { ...validBody, certificateIds: [] },
    });
    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must not be empty');
  });

  test('returns 400 when batch exceeds max size', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `cert-${i}`);
    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { ...validBody, certificateIds: ids },
    });
    const res = await batchGenerateCertificates(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('maximum');
  });

  test('generates HTML for all valid certificates', async () => {
    stubRepo(CertificatesRepository, {
      getMany: async () => [
        makeCert('cert-1', 'org-1', 'person-1'),
        makeCert('cert-2', 'org-1', 'person-2'),
      ],
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: validBody });
    const res = await batchGenerateCertificates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[0].html).toContain('Dr. Maria Santos');
    expect(res.body.results[1].status).toBe('success');
    expect(res.body.results[1].html).toContain('Dr. Juan Cruz');
    expect(res.body.summary.success).toBe(2);
    expect(res.body.summary.errors).toBe(0);
  });

  test('handles partial failure — some certs not found', async () => {
    stubRepo(CertificatesRepository, {
      getMany: async () => [
        makeCert('cert-1', 'org-1', 'person-1'),
        // cert-2 not found — absent from results
      ],
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: validBody });
    const res = await batchGenerateCertificates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[1].status).toBe('error');
    expect(res.body.results[1].error).toContain('not found');
    expect(res.body.summary.success).toBe(1);
    expect(res.body.summary.errors).toBe(1);
  });

  test('rejects certificates from different organization', async () => {
    stubRepo(CertificatesRepository, {
      getMany: async () => [
        makeCert('cert-1', 'org-1', 'person-1'),
        makeCert('cert-2', 'other-org', 'person-2'), // wrong org
      ],
    });

    const ctx = makeCtx({ organizationId: 'org-1', _body: validBody });
    const res = await batchGenerateCertificates(ctx);

    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[1].status).toBe('error');
    expect(res.body.results[1].error).toContain('different organization');
  });

  test('uses default recipientName when not in recipientNames map', async () => {
    stubRepo(CertificatesRepository, {
      getMany: async () => [makeCert('cert-1', 'org-1', 'unknown-person')],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        ...validBody,
        certificateIds: ['cert-1'],
        recipientNames: {}, // no mapping for unknown-person
      },
    });
    const res = await batchGenerateCertificates(ctx);

    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[0].html).toContain('Member'); // default name
  });

  test('applies branding to all certificates', async () => {
    stubRepo(CertificatesRepository, {
      getMany: async () => [makeCert('cert-1', 'org-1')],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        ...validBody,
        certificateIds: ['cert-1'],
        branding: { primaryColor: '#123456', signatoryName: 'Dr. Boss' },
      },
    });
    const res = await batchGenerateCertificates(ctx);

    expect(res.body.results[0].html).toContain('#123456');
    expect(res.body.results[0].html).toContain('Dr. Boss');
  });
});
