import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository } from './repos/documents.repo';
import { searchDocuments } from './searchDocuments';
import { UnauthorizedError } from '@/core/errors';

// Factory N/A: paginated query result wrapper
const fakeResult = {
  data: [{ id: 'doc-1', title: 'Test' }],
  totalCount: 1,
};

describe('searchDocuments', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findManyWithPagination: async () => fakeResult });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    await expect(searchDocuments(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with paginated results', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(1);
  });

  test('returns empty results when no documents match', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findManyWithPagination: async () => ({ data: [], totalCount: 0 }) });
    const ctx = makeCtx({ _query: { q: 'nonexistent' } });
    const res = await searchDocuments(ctx);
    expect((res as any).body?.data).toHaveLength(0);
    expect((res as any).body?.pagination?.totalCount).toBe(0);
  });
});
