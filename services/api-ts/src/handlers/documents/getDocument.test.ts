import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository } from './repos/documents.repo';
import { getDocument } from './getDocument';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const fakeDoc = {
  id: 'doc-1', organizationId: 'tenant-1', title: 'Test Doc',
  fileName: 'test.pdf', mimeType: 'application/pdf', size: 1024,
  storageKey: 'uploads/test.pdf', status: 'published',
};

describe('getDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findOneById: async () => fakeDoc });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { documentId: 'doc-1' } });
    await expect(getDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with document', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' } });
    const res = await getDocument(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe('doc-1');
  });

  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' } });
    await expect(getDocument(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
