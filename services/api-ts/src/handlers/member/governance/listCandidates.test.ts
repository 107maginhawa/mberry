import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listCandidates } from './listCandidates';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { UnauthorizedError } from '@/core/errors';

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

// ─── Tests ──────────────────────────────────────────────

describe('listCandidates', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: { electionId: 'election-1' } });
    await expect(listCandidates(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('happy path — returns nominees list for election', async () => {
    stubRepo(ElectionsRepository, {
      listNominees: async () => [fakeNominee],
    });

    const ctx = makeCtx({ _query: { electionId: 'election-1' } });
    const res = await listCandidates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('nominee-1');
    expect(res.body.data[0].electionId).toBe('election-1');
  });

  test('returns empty list when no nominees', async () => {
    stubRepo(ElectionsRepository, {
      listNominees: async () => [],
    });

    const ctx = makeCtx({ _query: { electionId: 'election-1' } });
    const res = await listCandidates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('uses empty string as electionId when query param omitted', async () => {
    let capturedId: string | undefined;
    stubRepo(ElectionsRepository, {
      listNominees: async (id: string) => {
        capturedId = id;
        return [];
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listCandidates(ctx);

    expect(capturedId).toBe('');
  });

  test('returns multiple nominees', async () => {
    const nominees = [
      { ...fakeNominee, id: 'nominee-1' },
      { ...fakeNominee, id: 'nominee-2', personId: 'person-2', status: 'accepted' },
    ];
    stubRepo(ElectionsRepository, {
      listNominees: async () => nominees,
    });

    const ctx = makeCtx({ _query: { electionId: 'election-1' } });
    const res = await listCandidates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});
