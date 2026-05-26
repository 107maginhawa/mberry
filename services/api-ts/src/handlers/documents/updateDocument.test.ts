import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { updateDocument } from './updateDocument';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const existingDoc = { id: 'doc-1', organizationId: 'tenant-1', title: 'Old Title', status: 'published' };
const updatedDoc = { ...existingDoc, title: 'New Title' };

describe('updateDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => existingDoc,
      updateOneById: async () => updatedDoc,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { documentId: 'doc-1' }, _body: {} });
    await expect(updateDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with updated document', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { title: 'New Title' } });
    const res = await updateDocument(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.title).toBe('New Title');
  });

  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => null,
      updateOneById: async () => updatedDoc,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' }, _body: {} });
    await expect(updateDocument(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
