import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentVersionRepository } from './repos/documents.repo';
import { listDocumentVersions } from './listDocumentVersions';
import { fakeDocumentVersion } from '@/test-utils/factories';
import { UnauthorizedError } from '@/core/errors';

const fakeVersions = [
  fakeDocumentVersion(),
  fakeDocumentVersion({ id: 'ver-2', versionNumber: 2 }),
];

describe('listDocumentVersions', () => {
  beforeEach(() => {
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentVersionRepository, {
      findManyWithPagination: async () => ({ data: fakeVersions, totalCount: 2 }),
    });
  });

  afterEach(() => {
    restoreRepo(DocumentVersionRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { documentId: 'doc-1' }, _query: {} });
    await expect(listDocumentVersions(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with paginated versions', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _query: {} });
    const res = await listDocumentVersions(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(2);
  });

  test('returns empty list when no versions', async () => {
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentVersionRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });
    const ctx = makeCtx({ _params: { documentId: 'doc-new' }, _query: {} });
    const res = await listDocumentVersions(ctx);
    expect((res as any).body?.data).toHaveLength(0);
  });
});
