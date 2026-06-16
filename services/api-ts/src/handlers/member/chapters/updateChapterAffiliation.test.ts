import { describe, test, expect, afterEach } from 'bun:test';
import { updateChapterAffiliation } from './updateChapterAffiliation';
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
  joinedAt: '2024-01-01',
};

const updatedAffiliation = {
  ...existingAffiliation,
  status: 'transferred',
};

// ─── Tests ───────────────────────────────────────────────

describe('updateChapterAffiliation', () => {
  afterEach(() => restoreRepo(ChapterAffiliationRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      _params: { affiliationId: 'aff-1' },
      _body: { status: 'transferred' },
    });
    await expect(updateChapterAffiliation(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('throws NotFoundError when affiliation does not exist', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { affiliationId: 'aff-missing' },
      _body: { status: 'transferred' },
    });
    await expect(updateChapterAffiliation(ctx)).rejects.toThrow(NotFoundError);
  });

  test('happy path — returns updated affiliation with status 200', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => existingAffiliation,
      updateOneById: async () => updatedAffiliation,
    });

    const ctx = makeCtx({
      _params: { affiliationId: 'aff-1' },
      _body: { status: 'transferred' },
    });
    const response = await updateChapterAffiliation(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedAffiliation);
    expect(response.body.status).toBe('transferred');
  });

  test('passes correct affiliationId and body to repo.updateOneById', async () => {
    let capturedId: string | undefined;
    let capturedBody: any;

    stubRepo(ChapterAffiliationRepository, {
      findOneById: async () => existingAffiliation,
      updateOneById: async (id: string, body: any) => {
        capturedId = id;
        capturedBody = body;
        return { ...existingAffiliation, ...body };
      },
    });

    const ctx = makeCtx({
      _params: { affiliationId: 'aff-1' },
      _body: { isPrimary: true },
    });
    await updateChapterAffiliation(ctx);

    expect(capturedId).toBe('aff-1');
    expect(capturedBody).toMatchObject({ isPrimary: true });
  });
});
