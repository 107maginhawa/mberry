import { describe, test, expect, afterEach } from 'bun:test';
import { deleteChapterAffiliation } from './deleteChapterAffiliation';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const existingAffiliation = {
  id: 'aff-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  chapterId: 'ch-1',
  isPrimary: false,
  status: 'active',
};

// ─── Tests ───────────────────────────────────────────────

describe('deleteChapterAffiliation', () => {
  afterEach(() => restoreRepo(ChapterAffiliationRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      _params: { affiliationId: 'aff-1' },
    });
    await expect(deleteChapterAffiliation(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('throws NotFoundError when affiliation does not exist', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { affiliationId: 'aff-missing' } });
    await expect(deleteChapterAffiliation(ctx)).rejects.toThrow(NotFoundError);
  });

  test('happy path — returns 204 with null body', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => existingAffiliation,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { affiliationId: 'aff-1' } });
    const response = await deleteChapterAffiliation(ctx) as any;

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  test('calls deleteOneById with correct affiliationId', async () => {
    let deletedId: string | undefined;

    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => existingAffiliation,
      deleteOneById: async (id: string) => { deletedId = id; },
    });

    const ctx = makeCtx({ _params: { affiliationId: 'aff-1' } });
    await deleteChapterAffiliation(ctx);

    expect(deletedId).toBe('aff-1');
  });
});
