// Business Rules: [BR-33] — President-only certification, awaitingConfirmation required
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { certifyElection } from './certifyElection';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError, ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const baseElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: 'Board Election 2025',
  type: 'officer' as const,
  status: 'awaitingConfirmation' as const,
  votingMode: 'online' as const,
  nominationsOpenAt: null,
  nominationsCloseAt: null,
  votingOpenAt: null,
  votingCloseAt: null,
  passageThreshold: null,
  positions: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publishedElection = {
  ...baseElection,
  status: 'published' as const,
  publishedAt: new Date(),
};

const presidentTerm = {
  id: 'term-1',
  positionId: 'pos-president',
  personId: 'user-1',
  organizationId: 'org-1',
  status: 'active',
  startDate: new Date('2025-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  positionTitle: 'President',
};

const secretaryTerm = {
  ...presidentTerm,
  id: 'term-2',
  positionId: 'pos-secretary',
  positionTitle: 'Secretary',
};

// ─── Tests ───────────────────────────────────────────────

describe('certifyElection [BR-33]', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  // ─── Auth guards ─────────────────────────────────────

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { electionId: 'election-1' } });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 403 when non-officer tries to certify', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [], // no officer terms
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('returns 403 when officer (non-President) tries to certify', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [secretaryTerm], // Secretary, not President
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // ─── State guards ────────────────────────────────────

  test('returns 404 when election not found', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => undefined,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'nonexistent' },
    });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 422 when election in votingOpen state', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('returns 422 when election in nominationsOpen state', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'nominationsOpen' }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('returns 422 when election in draft state', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'draft' }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    await expect(certifyElection(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Happy path ──────────────────────────────────────

  test('returns 200 when President certifies awaitingConfirmation election', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => baseElection, // status: awaitingConfirmation
      getVoteTallies: async () => [{ positionId: 'pos-1', nomineeId: 'nom-1', count: 10 }],
      getVoterCount: async () => 15,
      listNominees: async () => [{ id: 'nom-1', personId: 'person-1' }],
      updateNomineeStatus: async () => undefined,
      update: async (_id: string, data: any) => ({ ...publishedElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    const response = await certifyElection(ctx);
    expect(response.status).toBe(200);
  });

  test('update sets status to published with publishedAt timestamp', async () => {
    let capturedUpdate: any = null;
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      getVoteTallies: async () => [],
      getVoterCount: async () => 0,
      listNominees: async () => [],
      updateNomineeStatus: async () => undefined,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...publishedElection, ...data };
      },
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    await certifyElection(ctx);
    expect(capturedUpdate.status).toBe('published');
    expect(capturedUpdate.publishedAt).toBeInstanceOf(Date);
  });

  test('response includes election, tallies, and voterCount', async () => {
    const tallies = [{ positionId: 'pos-1', nomineeId: 'nom-1', count: 10 }];
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      getVoteTallies: async () => tallies,
      getVoterCount: async () => 15,
      listNominees: async () => [{ id: 'nom-1', personId: 'person-1' }],
      updateNomineeStatus: async () => undefined,
      update: async () => publishedElection,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [presidentTerm],
    });

    const ctx = makeCtx({
      _params: { electionId: 'election-1' },
    });
    const response = await certifyElection(ctx);
    expect(response.body.tallies).toEqual(tallies);
    expect(response.body.voterCount).toBe(15);
    // election fields are inlined into the flat response (no nested .election envelope)
    expect(response.body.status).toBe('published');
  });
});
