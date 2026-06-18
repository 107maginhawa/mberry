import { describe, test, expect, afterEach } from 'bun:test';
import { createChapterAffiliation } from './createChapterAffiliation';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';

// ─── Fixtures ────────────────────────────────────────────

const validBody = {
  personId: 'person-1',
  chapterId: 'chapter-a',
  isPrimary: false,
};

const createdAffiliation = {
  id: 'affil-new',
  organizationId: 'tenant-1',
  personId: 'person-1',
  chapterId: 'chapter-a',
  isPrimary: false,
  affiliatedAt: new Date('2024-06-01'),
  transferredFrom: null,
  status: 'active' as const,
};

// ─── Tests ───────────────────────────────────────────────

describe('createChapterAffiliation', () => {
  afterEach(() => restoreRepo(ChapterAffiliationRepository));

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: validBody });
    const res = await createChapterAffiliation(ctx) as any;

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ _body: validBody, organizationId: null });
    const res = await createChapterAffiliation(ctx) as any;

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Organization context required' });
  });

  test('happy path — returns 201 with created affiliation', async () => {
    stubRepo(ChapterAffiliationRepository, {
      createOne: async () => createdAffiliation,
    });

    const ctx = makeCtx({ _body: validBody });
    const res = await createChapterAffiliation(ctx) as any;

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('affil-new');
    expect(res.body.personId).toBe('person-1');
    expect(res.body.chapterId).toBe('chapter-a');
    expect(res.body.status).toBe('active');
  });

  test('passes organizationId and body fields to repo.createOne', async () => {
    let capturedData: any;
    stubRepo(ChapterAffiliationRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'affil-new', ...data };
      },
    });

    const ctx = makeCtx({ _body: { ...validBody, isPrimary: true }, organizationId: 'org-42' });
    await createChapterAffiliation(ctx);

    expect(capturedData.organizationId).toBe('org-42');
    expect(capturedData.personId).toBe('person-1');
    expect(capturedData.chapterId).toBe('chapter-a');
    expect(capturedData.isPrimary).toBe(true);
    expect(capturedData.status).toBe('active');
  });

  test('defaults isPrimary to false when not provided', async () => {
    let capturedData: any;
    stubRepo(ChapterAffiliationRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'affil-new', ...data };
      },
    });

    const ctx = makeCtx({ _body: { personId: 'person-1', chapterId: 'chapter-a' } });
    await createChapterAffiliation(ctx);

    expect(capturedData.isPrimary).toBe(false);
  });
});
