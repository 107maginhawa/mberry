import { describe, test, expect, afterEach } from 'bun:test';
import { getRoyaltySplit } from './getRoyaltySplit';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';

// ─── Fixtures ────────────────────────────────────────────

const fakeRoyaltySplit = {
  id: 'rs-1',
  organizationId: 'tenant-1',
  membershipId: 'mem-1',
  nationalOrgId: 'national-1',
  chapterId: 'chapter-a',
  splitPercentNational: 70,
  splitPercentChapter: 30,
  effectiveDate: '2024-01-01',
};

// ─── Tests ───────────────────────────────────────────────

describe('getRoyaltySplit', () => {
  afterEach(() => restoreRepo(RoyaltySplitRepository));

  test('happy path — returns 200 with royalty split data', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => fakeRoyaltySplit,
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'rs-1' } });
    const res = await getRoyaltySplit(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('rs-1');
    expect(res.body.splitPercentNational).toBe(70);
    expect(res.body.splitPercentChapter).toBe(30);
    expect(res.body.membershipId).toBe('mem-1');
  });

  test('throws NotFoundError when royalty split does not exist', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'no-such' } });
    await expect(getRoyaltySplit(ctx)).rejects.toThrow();
  });

  test('throws when no session (unauthorized)', async () => {
    stubRepo(RoyaltySplitRepository, {
      findOneById: async () => fakeRoyaltySplit,
    });

    const ctx = makeCtx({ user: null, session: null, _params: { royaltySplitId: 'rs-1' } });
    await expect(getRoyaltySplit(ctx)).rejects.toThrow();
  });

  test('calls findOneById with correct royaltySplitId', async () => {
    let capturedId: string | undefined;
    stubRepo(RoyaltySplitRepository, {
      findOneById: async (id: string) => {
        capturedId = id;
        return fakeRoyaltySplit;
      },
    });

    const ctx = makeCtx({ _params: { royaltySplitId: 'rs-1' } });
    await getRoyaltySplit(ctx);

    expect(capturedId).toBe('rs-1');
  });
});
