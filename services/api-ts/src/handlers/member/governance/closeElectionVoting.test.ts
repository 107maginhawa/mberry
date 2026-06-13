// Business Rules: [BR-33] — close voting moves votingOpen → awaitingConfirmation
// AHA FIX-001 (G1): the election state-machine dead end. Before this handler
// existed there was NO operation that set `awaitingConfirmation`, so an election
// in `votingOpen` could never reach `certify` (which requires awaitingConfirmation).
// These tests pin the single valid transition and reject every invalid one (422),
// mirroring the state-guard style of certifyElection.test.ts.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { closeElectionVoting } from './closeElectionVoting';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const baseElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: 'Board Election 2025',
  type: 'officer' as const,
  status: 'votingOpen' as const,
  votingMode: 'online' as const,
  nominationsOpenAt: null,
  nominationsCloseAt: null,
  votingOpenAt: new Date(),
  votingCloseAt: null,
  passageThreshold: null,
  positions: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const awaitingElection = {
  ...baseElection,
  status: 'awaitingConfirmation' as const,
};

const officerTerm = {
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

// ─── Tests ───────────────────────────────────────────────

describe('closeElectionVoting [BR-33] [FIX-001]', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    // This file tests business logic, not auth — give every test an officer.
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [officerTerm],
    });
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  // ─── Auth guards ─────────────────────────────────────

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { electionId: 'election-1' } });
    await expect(closeElectionVoting(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 404 when election not found', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { electionId: 'nonexistent' } });
    await expect(closeElectionVoting(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ─── Happy path (the ONLY valid transition) ──────────

  test('returns 200 and moves votingOpen → awaitingConfirmation', async () => {
    let captured: any = null;
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      update: async (_id: string, data: any) => {
        captured = data;
        return { ...awaitingElection, ...data };
      },
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' } });
    const response = await closeElectionVoting(ctx);
    expect(response.status).toBe(200);
    expect(captured.status).toBe('awaitingConfirmation');
  });

  test('sets votingCloseAt timestamp when closing voting', async () => {
    let captured: any = null;
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      update: async (_id: string, data: any) => {
        captured = data;
        return { ...awaitingElection, ...data };
      },
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' } });
    await closeElectionVoting(ctx);
    expect(captured.votingCloseAt).toBeInstanceOf(Date);
  });

  // ─── State guards — every invalid source state → 422 ─

  for (const badStatus of ['draft', 'nominationsOpen', 'awaitingConfirmation', 'published', 'cancelled'] as const) {
    test(`returns 422 when election is in ${badStatus} state`, async () => {
      stubRepo(ElectionsRepository, {
        get: async () => ({ ...baseElection, status: badStatus }),
        update: async () => awaitingElection,
      });
      const ctx = makeCtx({ _params: { electionId: 'election-1' } });
      await expect(closeElectionVoting(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    });
  }

  test('invalid transition uses INVALID_STATUS_TRANSITION error code', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'draft' }),
      update: async () => awaitingElection,
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' } });
    try {
      await closeElectionVoting(ctx);
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('INVALID_STATUS_TRANSITION');
    }
  });
});
