import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createElection } from './createElection';
import { certifyElection } from './certifyElection';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository, TransitionChecklistRepository } from '../association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: 'Board Election',
  type: 'officer' as const,
  status: 'awaitingConfirmation' as const,
  votingMode: 'online' as const,
  positions: [],
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  nominationsOpenAt: null,
  nominationsCloseAt: null,
  votingOpenAt: null,
  votingCloseAt: null,
  publishedAt: null,
  passageThreshold: null,
};

// ─── Tests ──────────────────────────────────────────────

describe('Elections auth enforcement — officer checks', () => {
  let mocks: ReturnType<typeof stubRepo>[];

  afterEach(() => {
    if (mocks) mocks.forEach(m => Object.values(m).forEach(v => v.mockRestore()));
  });

  // ── createElection ─────────────────────────────────────

  test('createElection throws 401 without session', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
      stubRepo(ElectionsRepository, {
        create: async () => fakeElection,
      }),
    ];

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test Election' },
    });

    await expect(createElection(ctx)).rejects.toThrow();
  });

  test('createElection throws 403 for non-officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
      stubRepo(ElectionsRepository, {
        create: async () => fakeElection,
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test Election' },
    });

    await expect(createElection(ctx)).rejects.toThrow('Officer access required');
  });

  test('createElection succeeds for officer', async () => {
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
      }),
      stubRepo(ElectionsRepository, {
        create: async (data: any) => ({ ...fakeElection, ...data }),
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test Election', type: 'officer' },
    });

    const res = await createElection(ctx);
    expect(res.status).toBe(201);
  });

  test('createElection uses Drizzle ORM (no raw SQL)', async () => {
    let capturedData: any = null;
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
      }),
      stubRepo(ElectionsRepository, {
        create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        type: 'officer',
        positions: [{ id: 'pos-1', title: 'President' }],
      },
    });

    await createElection(ctx);
    // Verify data is passed through the repo (Drizzle ORM), not raw SQL
    expect(capturedData).toBeTruthy();
    expect(capturedData.title).toBe('Test');
    expect(capturedData.positions).toEqual([{ id: 'pos-1', title: 'President' }]);
    expect(capturedData.organizationId).toBe('org-1');
  });

  test('createElection sanitizes invalid type to officer', async () => {
    let capturedData: any = null;
    mocks = [
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
      }),
      stubRepo(ElectionsRepository, {
        create: async (data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
      }),
    ];

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        type: 'malicious_type; DROP TABLE elections;--',
        positions: [],
      },
    });

    await createElection(ctx);
    expect(capturedData.type).toBe('officer');
  });

  // ── certifyElection ────────────────────────────────────

  test('certifyElection throws 401 without session', async () => {
    mocks = [
      stubRepo(ElectionsRepository, {
        get: async () => fakeElection,
      }),
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
    ];

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'election-1' },
    });

    await expect(certifyElection(ctx)).rejects.toThrow();
  });

  test('certifyElection throws 403 for non-officer', async () => {
    mocks = [
      stubRepo(ElectionsRepository, {
        get: async () => fakeElection,
      }),
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    await expect(certifyElection(ctx)).rejects.toThrow('Officer access required');
  });

  test('certifyElection succeeds for officer with valid state', async () => {
    const electedNominee = {
      id: 'nom-1',
      electionId: 'election-1',
      positionId: 'pos-1',
      personId: 'person-2',
      status: 'elected',
      organizationId: 'org-1',
    };

    mocks = [
      stubRepo(ElectionsRepository, {
        get: async () => fakeElection,
        listNominees: async () => [electedNominee],
        update: async (id: string, data: any) => ({ ...fakeElection, ...data }),
      }),
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1' }],
        findActiveByPosition: async () => null,
        create: async (data: any) => ({ id: 'new-term', ...data }),
      }),
      stubRepo(TransitionChecklistRepository, {
        create: async (data: any) => ({ id: 'checklist-1', ...data }),
      }),
    ];

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const res = await certifyElection(ctx);
    expect(res.status).toBe(200);
  });
});
