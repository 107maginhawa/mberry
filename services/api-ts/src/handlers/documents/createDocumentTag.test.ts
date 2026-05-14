import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentTagRepository } from './repos/documents.repo';
import { createDocumentTag } from './createDocumentTag';

const fakeTag = { id: 'tag-1', organizationId: 'tenant-1', name: 'Policy', color: '#ff0000' };

describe('createDocumentTag', () => {
  beforeEach(() => {
    restoreRepo(DocumentTagRepository);
    stubRepo(DocumentTagRepository, { createOne: async () => fakeTag });
  });

  afterEach(() => {
    restoreRepo(DocumentTagRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _body: { name: 'Policy' } });
    const res = await createDocumentTag(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { name: 'Policy' } });
    const res = await createDocumentTag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 with created tag', async () => {
    const ctx = makeCtx({ _body: { name: 'Policy', color: '#ff0000' } });
    const res = await createDocumentTag(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.name).toBe('Policy');
  });
});
