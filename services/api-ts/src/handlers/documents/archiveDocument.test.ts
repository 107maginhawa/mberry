import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { archiveDocument } from './archiveDocument';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

const publishedDoc = { id: 'doc-1', organizationId: 'tenant-1', title: 'Test Doc', status: 'published' };
const archivedDoc = { ...publishedDoc, status: 'archived' };

describe('archiveDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => publishedDoc,
      updateOneById: async () => archivedDoc,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { documentId: 'doc-1' } });
    const res = await archiveDocument(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with archived document', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' } });
    const res = await archiveDocument(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.status).toBe('archived');
  });

  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => null,
      updateOneById: async () => archivedDoc,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' } });
    await expect(archiveDocument(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when already archived', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => archivedDoc,
      updateOneById: async () => archivedDoc,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    const ctx = makeCtx({ _params: { documentId: 'doc-1' } });
    await expect(archiveDocument(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
