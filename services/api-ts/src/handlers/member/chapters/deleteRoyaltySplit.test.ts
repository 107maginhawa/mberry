import { describe, test, expect, afterEach } from 'bun:test';
import { deleteRoyaltySplit } from './deleteRoyaltySplit';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const existingSplit = {
  id: 'rs-1',
  organizationId: 'tenant-1',
  membershipId: 'mem-1',
  nationalOrgId: 'nat-1',
  chapterId: 'ch-1',
  splitPercentNational: 70,
  splitPercentChapter: 30,
  effectiveDate: '2024-01-01',
};

// ─── Tests ───────────────────────────────────────────────

describe('deleteRoyaltySplit', () => {
  afterEach(() => restoreRepo(RoyaltySplitRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      _params: { royaltySplitId: 'rs-1' },
    });
    await expect(deleteRoyaltySplit(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('throws NotFoundError when royalty split does not exist', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'rs-missing' } });
    await expect(deleteRoyaltySplit(ctx)).rejects.toThrow(NotFoundError);
  });

  test('happy path — returns 204 with null body', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'rs-1' } });
    const response = await deleteRoyaltySplit(ctx) as any;

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  test('calls deleteOneById with correct royaltySplitId', async () => {
    let deletedId: string | undefined;

    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit,
      deleteOneById: async (id: string) => { deletedId = id; },
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'rs-1' } });
    await deleteRoyaltySplit(ctx);

    expect(deletedId).toBe('rs-1');
  });

  test('calls findOneById before deleteOneById — does not delete missing records', async () => {
    let deleteCallCount = 0;

    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => undefined,
      deleteOneById: async () => { deleteCallCount++; },
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'rs-missing' } });
    await expect(deleteRoyaltySplit(ctx)).rejects.toThrow(NotFoundError);
    expect(deleteCallCount).toBe(0);
  });
});
