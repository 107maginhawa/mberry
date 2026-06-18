import { describe, test, expect, afterEach } from 'bun:test';
import { setPrimaryChapterAffiliation } from './setPrimaryChapterAffiliation';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const primaryAffiliation = {
  id: 'aff-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  chapterId: 'ch-1',
  isPrimary: true,
  status: 'active',
};

// ─── Tests ───────────────────────────────────────────────

describe('setPrimaryChapterAffiliation', () => {
  afterEach(() => restoreRepo(ChapterAffiliationRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      _params: { affiliationId: 'aff-1' },
    });
    await expect(setPrimaryChapterAffiliation(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('returns 403 when organizationId is missing', async () => {
    const ctx = makeCtx({
      _params: { affiliationId: 'aff-1' },
      organizationId: null,
    });
    const response = await setPrimaryChapterAffiliation(ctx) as any;

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: 'Organization context required' });
  });

  test('happy path — returns updated affiliation with status 200', async () => {
    stubRepo(ChapterAffiliationRepository, {
      setPrimary: async () => primaryAffiliation,
    });

    const ctx = makeCtx({ _params: { affiliationId: 'aff-1' } });
    const response = await setPrimaryChapterAffiliation(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body).toEqual(primaryAffiliation);
    expect(response.body.isPrimary).toBe(true);
  });

  test('passes affiliationId and organizationId to repo.setPrimary', async () => {
    let capturedAffId: string | undefined;
    let capturedOrgId: string | undefined;

    stubRepo(ChapterAffiliationRepository, {
      setPrimary: async (affId: string, orgId: string) => {
        capturedAffId = affId;
        capturedOrgId = orgId;
        return primaryAffiliation;
      },
    });

    const ctx = makeCtx({
      _params: { affiliationId: 'aff-1' },
      organizationId: 'tenant-1',
    });
    await setPrimaryChapterAffiliation(ctx);

    expect(capturedAffId).toBe('aff-1');
    expect(capturedOrgId).toBe('tenant-1');
  });
});
