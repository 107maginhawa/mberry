import { describe, test, expect, afterEach } from 'bun:test';
import { createRoyaltySplit } from './createRoyaltySplit';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';
import { BusinessLogicError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const validBody = {
  membershipId: 'mem-1',
  nationalOrgId: 'nat-1',
  chapterId: 'ch-1',
  splitPercentNational: 70,
  splitPercentChapter: 30,
  effectiveDate: '2024-01-01',
};

const createdSplit = {
  id: 'rs-new',
  organizationId: 'tenant-1',
  ...validBody,
};

// ─── Tests ───────────────────────────────────────────────

describe('createRoyaltySplit', () => {
  afterEach(() => restoreRepo(RoyaltySplitRepository));

  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      user: null,
      _body: validBody,
    });
    const response = await createRoyaltySplit(ctx) as any;

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'Unauthorized' });
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({
      _body: validBody,
      organizationId: null,
    });
    const response = await createRoyaltySplit(ctx) as any;

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: 'Organization context required' });
  });

  test('throws BusinessLogicError when percentages do not sum to 100', async () => {
    const ctx = makeCtx({
      _body: { ...validBody, splitPercentNational: 60, splitPercentChapter: 30 },
    });
    await expect(createRoyaltySplit(ctx)).rejects.toThrow(BusinessLogicError);
  });

  test('throws BusinessLogicError when percentages sum to more than 100', async () => {
    const ctx = makeCtx({
      _body: { ...validBody, splitPercentNational: 80, splitPercentChapter: 30 },
    });
    await expect(createRoyaltySplit(ctx)).rejects.toThrow(BusinessLogicError);
  });

  test('happy path — returns created royalty split with status 201', async () => {
    stubRepo(RoyaltySplitRepository, {
      createOne: async () => createdSplit,
    });

    const ctx = makeCtx({ _body: validBody });
    const response = await createRoyaltySplit(ctx) as any;

    expect(response.status).toBe(201);
    expect(response.body).toEqual(createdSplit);
    expect(response.body.id).toBe('rs-new');
    expect(response.body.splitPercentNational).toBe(70);
    expect(response.body.splitPercentChapter).toBe(30);
  });

  test('passes organizationId from context to repo.createOne', async () => {
    let capturedData: any;
    stubRepo(RoyaltySplitRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'rs-new', ...data };
      },
    });

    const ctx = makeCtx({ _body: validBody, organizationId: 'tenant-1' });
    await createRoyaltySplit(ctx);

    expect(capturedData.organizationId).toBe('tenant-1');
    expect(capturedData.membershipId).toBe('mem-1');
    expect(capturedData.nationalOrgId).toBe('nat-1');
    expect(capturedData.chapterId).toBe('ch-1');
    expect(capturedData.splitPercentNational).toBe(70);
    expect(capturedData.splitPercentChapter).toBe(30);
  });

  test('exact 100 split boundary — 50/50 is valid', async () => {
    stubRepo(RoyaltySplitRepository, {
      createOne: async (data: any) => ({ id: 'rs-50', organizationId: 'tenant-1', ...data }),
    });

    const ctx = makeCtx({
      _body: { ...validBody, splitPercentNational: 50, splitPercentChapter: 50 },
    });
    const response = await createRoyaltySplit(ctx) as any;

    expect(response.status).toBe(201);
  });
});
