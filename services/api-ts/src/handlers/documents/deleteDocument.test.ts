import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { deleteDocument } from './deleteDocument';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const existingDoc = { id: 'doc-1', organizationId: 'tenant-1', title: 'Test Doc', status: 'published' };

describe('deleteDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => existingDoc,
      deleteOneById: async () => {},
    });
    // Stub officer check to allow access in unit tests
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { documentId: 'doc-1' } });
    await expect(deleteDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 204 on successful deletion', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' } });
    const res = await deleteDocument(ctx);
    expect(res.status).toBe(204);
  });

  // 403 for non-president officer is now enforced by requirePositionMiddleware
  // (President) at the route level — see middleware/require-position.test.ts.


  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => null,
      deleteOneById: async () => {},
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' } });
    await expect(deleteDocument(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
