import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getCandidate } from './getCandidate';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeNominee = {
  id: 'nominee-1',
  electionId: 'election-1',
  positionId: 'pos-1',
  personId: 'person-1',
  nominatedBy: 'user-1',
  status: 'nominated',
  organizationId: 'tenant-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * getCandidate uses raw db.select().from().where().limit() — no repo class.
 * We supply a custom database mock via makeCtx({ database: ... }).
 */
function makeSelectDb(rows: any[]) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
  };
  return chain;
}

// ─── Tests ──────────────────────────────────────────────

describe('getCandidate', () => {
  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { candidateId: 'nominee-1' } });
    await expect(getCandidate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('happy path — returns nominee data', async () => {
    const ctx = makeCtx({
      database: makeSelectDb([fakeNominee]),
      _params: { candidateId: 'nominee-1' },
    });
    const res = await getCandidate(ctx);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('nominee-1');
    expect(res.body.electionId).toBe('election-1');
    expect(res.body.status).toBe('nominated');
  });

  test('throws NotFoundError when nominee does not exist', async () => {
    const ctx = makeCtx({
      database: makeSelectDb([]),
      _params: { candidateId: 'no-such' },
    });
    await expect(getCandidate(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
