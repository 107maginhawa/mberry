// FLOW-09: Certificate Request → Generation
// Tests certificate retrieval flow. Certificate generation handler not yet implemented;
// tests verify existing CRUD (get/list) works correctly.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeCertificate as createFakeCertificate } from '@/test-utils/factories';
import { listCertificates } from './listCertificates';
import { CertificatesRepository } from './repos/certificates.repo';

// ─── Fixtures ───────────────────────────────────────────

const PERSON = 'person-flow-09';

const fakeCertificate = createFakeCertificate({
  personId: PERSON,
  eventId: 'event-1',
  type: 'attendance',
  issuedAt: new Date('2026-03-01'),
  fileUrl: '/certificates/cert-1.pdf',
});

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(CertificatesRepository, {
    get: async (id: string) => id === 'cert-1' ? fakeCertificate : undefined,
    listByPerson: async () => [fakeCertificate],
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-09] Certificate Retrieval', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CertificatesRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // getCertificate tests removed — handler deleted at 2579d9b7. Live impl
  // in association:member/getCertificate has its own coverage in
  // association:member/getCertificate.test.ts.

  test('listCertificates returns certs for current user', async () => {
    let capturedPersonId: string | null = null;

    mocks = defaultStubs({
      listByPerson: async (personId: string) => {
        capturedPersonId = personId;
        return [fakeCertificate];
      },
    });

    const ctx = makeCtx({});
    const response = await listCertificates(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(capturedPersonId).toBeDefined();
  });

  test('listCertificates returns empty array when no certs', async () => {
    mocks = defaultStubs({
      listByPerson: async () => [],
    });

    const ctx = makeCtx({});
    const response = await listCertificates(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  // Side-effect tests removed — certificate generation pipeline (eligibility
  // check, generation, storage) not yet implemented. Current tests cover
  // retrieval CRUD only. Re-add when certificate issuance is built.
});
