import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { getDocumentAccessLog } from './getDocumentAccessLog';
import { NotFoundError } from '@/core/errors';

const existingDoc = { id: 'doc-1', organizationId: 'tenant-1', title: 'Test Doc', status: 'published' };
const fakeLogs = [
  { id: 'log-1', documentId: 'doc-1', accessedBy: 'user-1', action: 'view', accessedAt: new Date() },
];

describe('getDocumentAccessLog', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentAccessLogRepository);
    stubRepo(DocumentRepository, { findOneById: async () => existingDoc });
    stubRepo(DocumentAccessLogRepository, {
      findManyWithPagination: async () => ({ data: fakeLogs, totalCount: 1 }),
      createOne: async () => ({}),
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentAccessLogRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { documentId: 'doc-1' }, _query: {} });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with access log entries', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _query: {} });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(1);
  });

  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' }, _query: {} });
    await expect(getDocumentAccessLog(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
