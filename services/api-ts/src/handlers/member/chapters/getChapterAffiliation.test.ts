import { describe, test, expect, afterEach } from 'bun:test';
import { getChapterAffiliation } from './getChapterAffiliation';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';

// ─── Fixtures ────────────────────────────────────────────

const fakeAffiliation = {
  id: 'affil-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  chapterId: 'chapter-a',
  isPrimary: true,
  affiliatedAt: new Date('2024-01-15'),
  transferredFrom: null,
  status: 'active' as const,
};

// ─── Tests ───────────────────────────────────────────────

describe('getChapterAffiliation', () => {
  afterEach(() => restoreRepo(ChapterAffiliationRepository));

  test('happy path — returns 200 with affiliation data', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => fakeAffiliation,
    });

    const ctx = makeCtx({ _params: { affiliationId: 'affil-1' } });
    const res = await getChapterAffiliation(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('affil-1');
    expect(res.body.chapterId).toBe('chapter-a');
    expect(res.body.isPrimary).toBe(true);
    expect(res.body.status).toBe('active');
  });

  test('throws NotFoundError when affiliation does not exist', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({ _params: { affiliationId: 'no-such' } });
    await expect(getChapterAffiliation(ctx)).rejects.toThrow();
  });

  test('throws when no session (unauthorized)', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => fakeAffiliation,
    });

    const ctx = makeCtx({ user: null, session: null, _params: { affiliationId: 'affil-1' } });
    await expect(getChapterAffiliation(ctx)).rejects.toThrow();
  });

  test('calls findOneById with correct affiliationId', async () => {
    let capturedId: string | undefined;
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async (id: string) => {
        capturedId = id;
        return fakeAffiliation;
      },
    });

    const ctx = makeCtx({ _params: { affiliationId: 'affil-1' } });
    await getChapterAffiliation(ctx);

    expect(capturedId).toBe('affil-1');
  });
});
