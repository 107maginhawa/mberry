import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocumentTag } from '@/test-utils/factories';
import { DocumentTagRepository } from './repos/documents.repo';
import { getDocumentTag } from './getDocumentTag';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const fakeTag = fakeDocumentTag();

describe('getDocumentTag', () => {
  beforeEach(() => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, { findOneById: async () => fakeTag });
  });

  afterEach(() => {
    restoreRepo(DocumentTagRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { tagId: 'tag-1' } });
    await expect(getDocumentTag(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with tag', async () => {
    const ctx = makeCtx({ _params: { tagId: 'tag-1' } });
    const res = await getDocumentTag(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.name).toBe('Policy');
  });

  test('throws NotFoundError when tag not found', async () => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { tagId: 'nonexistent' } });
    await expect(getDocumentTag(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
