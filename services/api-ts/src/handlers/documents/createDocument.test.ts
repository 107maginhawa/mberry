import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository } from './repos/documents.repo';
import { createDocument } from './createDocument';

const fakeDoc = fakeDocument({ ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' });

describe('createDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { createOne: async () => fakeDoc });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1024, storageKey: 'k', ownerId: 'o', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1024, storageKey: 'k', ownerId: 'o', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 on success', async () => {
    const ctx = makeCtx({ _body: { title: 'Test Doc', fileName: 'test.pdf', mimeType: 'application/pdf', size: 1024, storageKey: 'uploads/test.pdf', ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.id).toBe('doc-1');
  });
});
