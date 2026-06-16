import { describe, test, expect, afterEach } from 'bun:test';
import { updateRoyaltySplit } from './updateRoyaltySplit';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';

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

describe('updateRoyaltySplit', () => {
  afterEach(() => restoreRepo(RoyaltySplitRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentNational: 60, splitPercentChapter: 40 },
    });
    await expect(updateRoyaltySplit(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('throws NotFoundError when royalty split does not exist', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-missing' },
      _body: { splitPercentNational: 60, splitPercentChapter: 40 },
    });
    await expect(updateRoyaltySplit(ctx)).rejects.toThrow(NotFoundError);
  });

  test('throws BusinessLogicError when new percentages do not sum to 100', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit,
    });

    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentNational: 60, splitPercentChapter: 20 },
    });
    await expect(updateRoyaltySplit(ctx)).rejects.toThrow(BusinessLogicError);
  });

  test('throws BusinessLogicError when partial update causes invalid total (new national + existing chapter != 100)', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit, // existing: 70/30
    });

    // Only updating national to 80 — falls back to existing chapter=30 → 80+30=110 → invalid
    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentNational: 80 },
    });
    await expect(updateRoyaltySplit(ctx)).rejects.toThrow(BusinessLogicError);
  });

  test('happy path — partial update using existing values to form valid 100 total', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit, // existing: 70/30
      updateOneById: async (_id: string, body: any) => ({ ...existingSplit, ...body }),
    });

    // Only updating chapter — 70 + 30 = 100 (national stays 70 from existing)
    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentChapter: 30 },
    });
    const response = await updateRoyaltySplit(ctx) as any;

    expect(response.status).toBe(200);
  });

  test('happy path — full update returns updated split with status 200', async () => {
    const updatedSplit = { ...existingSplit, splitPercentNational: 60, splitPercentChapter: 40 };
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit,
      updateOneById: async () => updatedSplit,
    });

    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentNational: 60, splitPercentChapter: 40 },
    });
    const response = await updateRoyaltySplit(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedSplit);
    expect(response.body.splitPercentNational).toBe(60);
    expect(response.body.splitPercentChapter).toBe(40);
  });

  test('passes correct id and body to repo.updateOneById', async () => {
    let capturedId: string | undefined;
    let capturedBody: any;

    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit,
      updateOneById: async (id: string, body: any) => {
        capturedId = id;
        capturedBody = body;
        return { ...existingSplit, ...body };
      },
    });

    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentNational: 70, splitPercentChapter: 30 },
    });
    await updateRoyaltySplit(ctx);

    expect(capturedId).toBe('rs-1');
    expect(capturedBody).toMatchObject({ splitPercentNational: 70, splitPercentChapter: 30 });
  });

  test('exact 100 boundary — 100/0 split is valid', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => existingSplit,
      updateOneById: async (_id: string, body: any) => ({ ...existingSplit, ...body }),
    });

    const ctx = makeCtx({
      _params: { royaltySplitId: 'rs-1' },
      _body: { splitPercentNational: 100, splitPercentChapter: 0 },
    });
    const response = await updateRoyaltySplit(ctx) as any;

    expect(response.status).toBe(200);
  });
});
