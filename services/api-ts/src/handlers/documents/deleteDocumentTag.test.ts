import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentTagRepository } from './repos/documents.repo';
import { deleteDocumentTag } from './deleteDocumentTag';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const existingTag = { id: 'tag-1', organizationId: 'tenant-1', name: 'Policy' };

describe('deleteDocumentTag', () => {
  beforeEach(() => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, {
      findOneById: async () => existingTag,
      deleteOneById: async () => {},
    });
  });

  afterEach(() => {
    restoreRepo(DocumentTagRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { tagId: 'tag-1' } });
    await expect(deleteDocumentTag(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 204 on successful deletion', async () => {
    const ctx = makeCtx({ _params: { tagId: 'tag-1' } });
    const res = await deleteDocumentTag(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when tag not found', async () => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, {
      findOneById: async () => null,
      deleteOneById: async () => {},
    });
    const ctx = makeCtx({ _params: { tagId: 'nonexistent' } });
    await expect(deleteDocumentTag(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
