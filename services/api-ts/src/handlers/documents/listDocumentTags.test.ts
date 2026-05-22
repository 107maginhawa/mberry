import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocumentTag } from '@/test-utils/factories';
import { DocumentTagRepository } from './repos/documents.repo';
import { listDocumentTags } from './listDocumentTags';
import { UnauthorizedError } from '@/core/errors';

const fakeTags = [
  fakeDocumentTag({ id: 'tag-1', name: 'Policy' }),
  fakeDocumentTag({ id: 'tag-2', name: 'Form' }),
];

describe('listDocumentTags', () => {
  beforeEach(() => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, {
      findManyWithPagination: async () => ({ data: fakeTags, totalCount: 2 }),
    });
  });

  afterEach(() => {
    restoreRepo(DocumentTagRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    await expect(listDocumentTags(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with paginated tags', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await listDocumentTags(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(2);
    expect((res as any).body?.pagination).toBeDefined();
  });

  test('returns empty list when no tags', async () => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });
    const ctx = makeCtx({ _query: {} });
    const res = await listDocumentTags(ctx);
    expect((res as any).body?.data).toHaveLength(0);
  });
});
