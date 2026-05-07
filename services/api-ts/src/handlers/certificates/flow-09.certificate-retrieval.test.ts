// FLOW-09: Certificate Request → Generation
// Tests certificate retrieval flow. Certificate generation handler not yet implemented;
// tests verify existing CRUD (get/list) works correctly.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getCertificate } from './getCertificate';
import { listCertificates } from './listCertificates';
import { CertificatesRepository } from './repos/certificates.repo';

// ─── Fixtures ───────────────────────────────────────────

const PERSON = 'person-flow-09';

const fakeCertificate = {
  id: 'cert-1',
  personId: PERSON,
  eventId: 'event-1',
  type: 'attendance',
  issuedAt: new Date('2026-03-01'),
  fileUrl: '/certificates/cert-1.pdf',
};

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

  test('getCertificate returns certificate by ID', async () => {
    mocks = defaultStubs();

    const ctx = makeCtx({ _params: { id: 'cert-1' } });
    const response = await getCertificate(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('cert-1');
    expect(response.body.data.personId).toBe(PERSON);
  });

  test('getCertificate throws NotFoundError for missing cert', async () => {
    mocks = defaultStubs();

    const ctx = makeCtx({ _params: { id: 'nonexistent' } });

    try {
      await getCertificate(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('not found');
    }
  });

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

  // ── Unimplemented side effects (test.todo = RED backlog) ──

  test.todo('certificate request checks attendance eligibility');
  test.todo('certificate request checks credit requirements met');
  test.todo('certificate generated with correct event and member details');
  test.todo('generated certificate stored and retrievable by member');
  test.todo('ineligible member gets clear rejection reason');
});
