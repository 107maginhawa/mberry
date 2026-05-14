import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentVersionRepository } from './repos/documents.repo';
import { getDocumentVersion } from './getDocumentVersion';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const fakeVersion = {
  id: 'ver-1', documentId: 'doc-1', organizationId: 'tenant-1',
  versionNumber: 2, fileName: 'v2.pdf', fileSize: 2048,
};

describe('getDocumentVersion', () => {
  beforeEach(() => {
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentVersionRepository, { findOneById: async () => fakeVersion });
  });

  afterEach(() => {
    restoreRepo(DocumentVersionRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { documentId: 'doc-1', versionId: 'ver-1' } });
    await expect(getDocumentVersion(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with version', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1', versionId: 'ver-1' } });
    const res = await getDocumentVersion(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe('ver-1');
  });

  test('throws NotFoundError when version belongs to different document', async () => {
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentVersionRepository, { findOneById: async () => fakeVersion });
    const ctx = makeCtx({ _params: { documentId: 'doc-OTHER', versionId: 'ver-1' } });
    await expect(getDocumentVersion(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when version not found', async () => {
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentVersionRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { documentId: 'doc-1', versionId: 'nonexistent' } });
    await expect(getDocumentVersion(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
