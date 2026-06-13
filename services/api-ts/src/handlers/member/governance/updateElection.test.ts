// Business Rules: [M12-R2] result finality — published election results are immutable.
// AHA FIX-005 (G5): updateElection had NO state/immutability guard. It allowed PATCH
// of title/dates/positions on PUBLISHED elections (M12-R2 / AC-M12-003 violation) and
// regenerated position ids on every update — orphaning nominee/vote position refs once
// nominations had opened. These tests pin the guard:
//   • published / cancelled elections reject ALL mutation (422 ELECTION_IMMUTABLE)
//   • positions are frozen once the election leaves `draft` (422 ELECTION_POSITIONS_LOCKED)
//   • mutable fields (title/dates) still update in draft / nominationsOpen.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateElection } from './updateElection';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const baseElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: 'Board Election 2025',
  type: 'officer' as const,
  status: 'draft' as const,
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

describe('updateElection immutability guard [M12-R2] [FIX-005]', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    // These tests exercise business logic, not auth — give every test an officer.
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
    const ctx = makeCtx({ user: null, session: null, _params: { electionId: 'election-1' }, _body: { title: 'New' } });
    await expect(updateElection(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 404 when election not found', async () => {
    stubRepo(ElectionsRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { electionId: 'nonexistent' }, _body: { title: 'New' } });
    await expect(updateElection(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ─── Mutable while draft / pre-finalisation ──────────

  test('allows title update on a draft election', async () => {
    let captured: any = null;
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      update: async (_id: string, data: any) => { captured = data; return { ...baseElection, ...data }; },
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { title: 'Renamed Election' } });
    const res = await updateElection(ctx);
    expect(res.status).toBe(200);
    expect(captured.title).toBe('Renamed Election');
  });

  test('allows title update on a nominationsOpen election (positions untouched)', async () => {
    let captured: any = null;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'nominationsOpen' as const }),
      update: async (_id: string, data: any) => { captured = data; return { ...baseElection, status: 'nominationsOpen', ...data }; },
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { title: 'Renamed' } });
    const res = await updateElection(ctx);
    expect(res.status).toBe(200);
    expect(captured.title).toBe('Renamed');
  });

  test('allows positions update on a draft election (ids generated)', async () => {
    let captured: any = null;
    stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      update: async (_id: string, data: any) => { captured = data; return { ...baseElection, ...data }; },
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { positions: ['President', 'Treasurer'] } });
    const res = await updateElection(ctx);
    expect(res.status).toBe(200);
    expect(Array.isArray(captured.positions)).toBe(true);
    expect(captured.positions).toHaveLength(2);
    expect(captured.positions[0]).toHaveProperty('id');
    expect(captured.positions[0].title).toBe('President');
  });

  // ─── Immutability: published / cancelled are terminal ─

  test('rejects ANY update on a published election (422)', async () => {
    let updateCalled = false;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'published' as const, publishedAt: new Date() }),
      update: async () => { updateCalled = true; return baseElection; },
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { title: 'Tampered' } });
    await expect(updateElection(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    expect(updateCalled).toBe(false); // no mutation reached the repo
  });

  test('rejects ANY update on a cancelled election (422)', async () => {
    let updateCalled = false;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'cancelled' as const }),
      update: async () => { updateCalled = true; return baseElection; },
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { title: 'Tampered' } });
    await expect(updateElection(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    expect(updateCalled).toBe(false);
  });

  test('published-election rejection uses ELECTION_IMMUTABLE code', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'published' as const }),
      update: async () => baseElection,
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { title: 'Tampered' } });
    try {
      await updateElection(ctx);
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('ELECTION_IMMUTABLE');
    }
  });

  // ─── Positions frozen once nominations open ───────────

  for (const lockedStatus of ['nominationsOpen', 'votingOpen', 'awaitingConfirmation'] as const) {
    test(`rejects positions change in ${lockedStatus} state (422)`, async () => {
      let updateCalled = false;
      stubRepo(ElectionsRepository, {
        get: async () => ({ ...baseElection, status: lockedStatus }),
        update: async () => { updateCalled = true; return baseElection; },
      });
      const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { positions: ['President'] } });
      await expect(updateElection(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      expect(updateCalled).toBe(false);
    });
  }

  test('positions-locked rejection uses ELECTION_POSITIONS_LOCKED code', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' as const }),
      update: async () => baseElection,
    });
    const ctx = makeCtx({ _params: { electionId: 'election-1' }, _body: { positions: ['President'] } });
    try {
      await updateElection(ctx);
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('ELECTION_POSITIONS_LOCKED');
    }
  });
});
