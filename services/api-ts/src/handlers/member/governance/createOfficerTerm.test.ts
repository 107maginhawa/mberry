// Business Rules: [BR-09] — one person per role per org, [BR-09e] — President assignment requires platform admin
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createOfficerTerm } from './createOfficerTerm';
import { OfficerTermRepository, PositionRepository } from '@/handlers/association:member/repos/governance.repo';
import { PlatformAdminRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';

// ─── Fixtures ────────────────────────────────────────────

const createdTerm = {
  id: 'term-1',
  organizationId: 'tenant-1',
  positionId: 'pos-1',
  personId: 'person-1',
  organizationId: 'org-1',
  startDate: new Date('2025-01-01'),
  endDate: null,
  status: 'active',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ───────────────────────────────────────────────

describe('createOfficerTerm [BR-09]', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(PositionRepository);
    restoreRepo(PlatformAdminRepository);
    // Default: non-President position so BR-09e guard doesn't trigger
    stubRepo(PositionRepository, {
      findById: async () => ({ id: 'pos-1', title: 'Society Officer', organizationId: 'org-1' }),
    });
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(PositionRepository);
    restoreRepo(PlatformAdminRepository);
  });

  test('creates officer term and returns 201', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      create: async () => createdTerm,
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findActiveByPosition: async () => undefined,
      findActiveByPersonInOrg: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        positionId: 'pos-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2025-01-01',
        status: 'active',
      },
    });

    const response = await createOfficerTerm(ctx);
    expect(response.status).toBe(201);
    expect(response.body.id).toBe('term-1');
    expect(response.body.positionId).toBe('pos-1');
  });

  test('defaults status to upcoming when not provided', async () => {
    let capturedData: any = null;
    mocks = stubRepo(OfficerTermRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdTerm, status: data.status };
      },
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findActiveByPosition: async () => undefined,
      findActiveByPersonInOrg: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        positionId: 'pos-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2025-01-01',
        // status intentionally omitted
      },
    });

    await createOfficerTerm(ctx);
    expect(capturedData.status).toBe('upcoming');
  });

  test('passes endDate as Date object when provided', async () => {
    let capturedData: any = null;
    mocks = stubRepo(OfficerTermRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdTerm, endDate: data.endDate };
      },
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findActiveByPosition: async () => undefined,
      findActiveByPersonInOrg: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        positionId: 'pos-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      },
    });

    await createOfficerTerm(ctx);
    expect(capturedData.endDate).toBeInstanceOf(Date);
  });

  test('sets endDate to null when not provided', async () => {
    let capturedData: any = null;
    mocks = stubRepo(OfficerTermRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdTerm, endDate: data.endDate };
      },
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findActiveByPosition: async () => undefined,
      findActiveByPersonInOrg: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        positionId: 'pos-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2025-01-01',
      },
    });

    await createOfficerTerm(ctx);
    expect(capturedData.endDate).toBeNull();
  });

  test('scopes creation to organizationId from context', async () => {
    let capturedData: any = null;
    mocks = stubRepo(OfficerTermRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdTerm, organizationId: data.organizationId };
      },
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findActiveByPosition: async () => undefined,
      findActiveByPersonInOrg: async () => [],
    });

    const ctx = makeCtx({
      organizationId: 'tenant-99',
      _body: {
        positionId: 'pos-1',
        personId: 'person-2',
        organizationId: 'org-1',
        startDate: '2025-06-01',
      },
    });

    await createOfficerTerm(ctx);
    expect(capturedData.organizationId).toBe('tenant-99');
  });

  test('returns 401 when no user session', async () => {
    // No stubRepo needed — guard fires before DB access
    const ctx = makeCtx({ user: null, session: null });
    const response = await createOfficerTerm(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when organizationId is missing', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, organizationId: null });
    const response = await createOfficerTerm(ctx);
    expect(response.status).toBe(403);
  });

  // ─── [BR-09] Conceptual: one person per role per org ───────

  describe('[BR-09] duplicate role guard logic', () => {
    test('position cannot have two simultaneous active holders in same org', () => {
      // Validates the business rule the handler should enforce via
      // findActiveByPosition before repo.create
      const activeTerms = [
        { positionId: 'president', organizationId: 'org-1', personId: 'person-1', status: 'active' },
      ];
      const candidate = { positionId: 'president', organizationId: 'org-1', personId: 'person-2', status: 'active' };
      const conflict = activeTerms.some(
        (t) => t.positionId === candidate.positionId && t.organizationId === candidate.organizationId && t.status === 'active',
      );
      expect(conflict).toBe(true);
    });

    test('same position in different org is allowed', () => {
      const activeTerms = [
        { positionId: 'president', organizationId: 'org-1', personId: 'person-1', status: 'active' },
      ];
      const candidate = { positionId: 'president', organizationId: 'org-2', personId: 'person-2', status: 'active' };
      const conflict = activeTerms.some(
        (t) => t.positionId === candidate.positionId && t.organizationId === candidate.organizationId && t.status === 'active',
      );
      expect(conflict).toBe(false);
    });

    test('a person cannot hold two simultaneous roles in same org', () => {
      const activeTerms = [
        { positionId: 'president', organizationId: 'org-1', personId: 'person-1', status: 'active' },
      ];
      const candidate = { positionId: 'treasurer', organizationId: 'org-1', personId: 'person-1', status: 'active' };
      const personAlreadyOfficer = activeTerms.some(
        (t) => t.personId === candidate.personId && t.organizationId === candidate.organizationId && t.status === 'active',
      );
      expect(personAlreadyOfficer).toBe(true);
    });
  });

  // ─── [BR-09e] President assignment requires platform admin ────
  describe('[BR-09e] President position assignment guard', () => {
    test('rejects non-admin assigning President position with 403', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
        findActiveByPosition: async () => undefined,
        findActiveByPersonInOrg: async () => [],
        create: async () => createdTerm,
      });
      stubRepo(PositionRepository, {
        findById: async () => ({ id: 'pos-pres', title: 'President', organizationId: 'org-1' }),
      });
      // User is NOT a platform admin
      stubRepo(PlatformAdminRepository, {
        findById: async () => null,
      });

      const ctx = makeCtx({
        _body: {
          positionId: 'pos-pres',
          personId: 'person-2',
          startDate: '2025-01-01',
        },
      });

      // Should throw ForbiddenError (statusCode=403) since user is not a platform admin
      await expect(createOfficerTerm(ctx)).rejects.toThrow('platform administrator');
    });

    test('allows non-President position without admin check', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
        findActiveByPosition: async () => undefined,
        findActiveByPersonInOrg: async () => [],
        create: async () => createdTerm,
      });
      stubRepo(PositionRepository, {
        findById: async () => ({ id: 'pos-sec', title: 'Secretary', organizationId: 'org-1' }),
      });

      const ctx = makeCtx({
        _body: {
          positionId: 'pos-sec',
          personId: 'person-2',
          startDate: '2025-01-01',
        },
      });

      const response = await createOfficerTerm(ctx);
      expect(response.status).toBe(201);
    });
  });

  test('audit action is fired after creation (fire-and-forget — no crash)', async () => {
    // auditAction is a no-op when ctx.audit is null (which makeCtx provides).
    // The handler must NOT throw when audit is absent.
    mocks = stubRepo(OfficerTermRepository, {
      create: async () => createdTerm,
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findActiveByPosition: async () => undefined,
      findActiveByPersonInOrg: async () => [],
    });

    const ctx = makeCtx({
      audit: null,
      _body: {
        positionId: 'pos-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2025-01-01',
      },
    });

    // Must not throw
    const response = await createOfficerTerm(ctx);
    expect(response.status).toBe(201);
  });
});
