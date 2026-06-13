// AHA FIX-003 (G3): members had NO way to read their own ballots — the only listing
// endpoint (listBallots) is admin-only, so the "already voted?" self-check 403'd and the
// member silently re-submitted into a DUPLICATE_VOTE. `myBallots` is the member-scoped
// self-read: it returns ONLY the calling member's own ballots, keyed off the SESSION user
// id (never a client-supplied voterId), so a member can never read another voter's ballots.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { myBallots } from './myBallots';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { UnauthorizedError } from '@/core/errors';

describe('myBallots member self-read [FIX-003]', () => {
  beforeEach(() => restoreRepo(ElectionsRepository));
  afterEach(() => restoreRepo(ElectionsRepository));

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: { electionId: 'election-1' } });
    await expect(myBallots(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns only the calling member’s own ballots, voter-scoped to the session user', async () => {
    let capturedVoter: string | null = null;
    let capturedElection: string | null = null;
    stubRepo(ElectionsRepository, {
      listVotesForVoter: async (electionId: string, voterId: string) => {
        capturedElection = electionId;
        capturedVoter = voterId;
        return [{ id: 'v1', electionId, positionId: 'pos-1', nomineeId: 'nom-1', voterId }];
      },
    });
    const ctx = makeCtx({
      user: { id: 'member-9', role: 'user', twoFactorEnabled: true },
      _query: { electionId: 'election-1' },
    });
    const res: any = await myBallots(ctx);
    expect(res.status).toBe(200);
    // The voter filter is taken from the authenticated session, NOT from the request.
    expect(capturedVoter).toBe('member-9');
    expect(capturedElection).toBe('election-1');
    expect(res.body.data).toHaveLength(1);
  });

  test('returns empty when electionId is omitted', async () => {
    let called = false;
    stubRepo(ElectionsRepository, {
      listVotesForVoter: async () => { called = true; return [{ id: 'x' }]; },
    });
    const ctx = makeCtx({ _query: {} });
    const res: any = await myBallots(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(called).toBe(false);
  });
});
