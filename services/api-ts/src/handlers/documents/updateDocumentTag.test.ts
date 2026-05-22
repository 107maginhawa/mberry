import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentTagRepository } from './repos/documents.repo';
import { updateDocumentTag } from './updateDocumentTag';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const existingTag = { id: 'tag-1', organizationId: 'tenant-1', name: 'Policy', color: null };
const updatedTag = { ...existingTag, name: 'Policy v2', color: '#00ff00' };

describe('updateDocumentTag', () => {
  beforeEach(() => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, {
      findOneById: async () => existingTag,
      updateOneById: async () => updatedTag,
    });
  });

  afterEach(() => {
    restoreRepo(DocumentTagRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { tagId: 'tag-1' }, _body: {} });
    await expect(updateDocumentTag(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with updated tag', async () => {
    const ctx = makeCtx({ _params: { tagId: 'tag-1' }, _body: { name: 'Policy v2', color: '#00ff00' } });
    const res = await updateDocumentTag(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.name).toBe('Policy v2');
  });

  test('throws NotFoundError when tag not found', async () => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, {
      findOneById: async () => null,
      updateOneById: async () => updatedTag,
    });
    const ctx = makeCtx({ _params: { tagId: 'nonexistent' }, _body: {} });
    await expect(updateDocumentTag(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
