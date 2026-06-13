// Business Rules: [WF-077] secret ballot — individual votes must not be linkable to a voter.
// AHA FIX-003 (G3): listBallots returned RAW `election_vote` rows (incl. `voterId`) to any
// caller the admin-only route let through, leaking the voter→nominee linkage, AND it applied
// no org scope (an officer of org A could read org B's ballots, or dump every org's votes when
// no electionId was supplied). These tests pin the hardened behaviour:
//   • officer view is anonymised — no `voterId` ever leaves the handler
//   • a non-officer / cross-org caller is denied (403)
//   • without an electionId the handler refuses an unscoped cross-org dump.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listBallots } from './listBallots';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const election = {
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

// A db whose select chain yields a raw vote row WITH voterId — this is exactly the
// leak the pre-fix handler produced. The fixed handler must route through the repo's
// anonymised projection and never surface voterId regardless of what the table holds.
const rawVoteRow = { id: 'v1', electionId: 'election-1', positionId: 'pos-1', nomineeId: 'nom-1', voterId: 'voter-secret', organizationId: 'org-1' };
function leakyDb(rows: any[]) {
  const chain: any = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain } as any;
}

// ─── Tests ───────────────────────────────────────────────

describe('listBallots ballot secrecy [WF-077] [FIX-003]', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: { electionId: 'election-1' } });
    await expect(listBallots(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('officer view never exposes voterId (no voter→nominee linkage)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => election,
      listAnonymizedVotes: async () => [
        { id: 'v1', electionId: 'election-1', positionId: 'pos-1', nomineeId: 'nom-1', organizationId: 'org-1' },
      ],
    });
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [officerTerm] });
    const ctx = makeCtx({ _query: { electionId: 'election-1' }, database: leakyDb([rawVoteRow]) });
    const res: any = await listBallots(ctx);
    expect(res.status).toBe(200);
    const rows = res.body.data;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.voterId).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(r, 'voterId')).toBe(false);
    }
  });

  test('denies a non-officer / cross-org caller (403)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => election,
      listAnonymizedVotes: async () => [],
    });
    // caller holds no active officer term in the election's org
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _query: { electionId: 'election-1' }, database: leakyDb([rawVoteRow]) });
    const res: any = await listBallots(ctx);
    expect(res.status).toBe(403);
  });

  test('returns no rows when electionId is omitted (no unscoped cross-org dump)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => election,
      listAnonymizedVotes: async () => [{ id: 'v1', electionId: 'election-1', positionId: 'pos-1', nomineeId: 'nom-1' }],
    });
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [officerTerm] });
    const ctx = makeCtx({ _query: {}, database: leakyDb([rawVoteRow]) });
    const res: any = await listBallots(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
