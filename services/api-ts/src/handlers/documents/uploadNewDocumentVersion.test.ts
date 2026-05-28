import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository, DocumentVersionRepository } from './repos/documents.repo';
import { uploadNewDocumentVersion } from './uploadNewDocumentVersion';
import { NotFoundError } from '@/core/errors';

const existingDoc = { id: 'doc-1', organizationId: 'tenant-1', title: 'Test Doc', status: 'published' };
const newVersion = { id: 'ver-2', documentId: 'doc-1', versionNumber: 2, fileName: 'v2.pdf', fileSize: 2048 };

describe('uploadNewDocumentVersion', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => existingDoc,
      updateOneById: async () => existingDoc,
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 1,
      createOne: async () => newVersion,
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentVersionRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 with new version', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.versionNumber).toBe(2);
  });

  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    await expect(uploadNewDocumentVersion(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('[EF-M11-005] throws NotFoundError when document belongs to different org (IDOR)', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => ({ id: 'doc-1', organizationId: 'other-org', title: 'Stolen Doc', status: 'published' }),
    });
    // Caller's org is 'tenant-1' (default from makeCtx), document belongs to 'other-org'
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    await expect(uploadNewDocumentVersion(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('[EF-M11-005] allows upload when document belongs to same org', async () => {
    // existingDoc has organizationId: 'tenant-1' which matches makeCtx default
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(201);
  });
});
