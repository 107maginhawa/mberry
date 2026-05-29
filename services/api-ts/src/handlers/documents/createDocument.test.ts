import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { createDocument } from './createDocument';

const fakeDoc = fakeDocument({ ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' });

let lastCreateInput: any = null;

describe('createDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    lastCreateInput = null;
    stubRepo(DocumentRepository, {
      createOne: async (input: any) => {
        lastCreateInput = input;
        return fakeDoc;
      },
    });
    // Default: caller is an active officer (so org-owned creates are allowed).
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
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

  // EM-M11-7a3e1c02: documents start as draft, not auto-published.
  test('defaults status to draft when not provided', async () => {
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: 'k', ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    await createDocument(ctx);
    expect(lastCreateInput?.status).toBe('draft');
  });

  test('honors explicit published status', async () => {
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: 'k', ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly', status: 'published' } });
    await createDocument(ctx);
    expect(lastCreateInput?.status).toBe('published');
  });

  // EM-M11-g4b67c23: org-owned documents require officer access.
  test('allows a member to create their own person-owned document', async () => {
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: 'k', ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
  });

  test('returns 403 when non-officer creates an org-owned document', async () => {
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: 'k', ownerId: 'org-1', ownerType: 'organization', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('allows an officer to create an org-owned document', async () => {
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: 'k', ownerId: 'org-1', ownerType: 'organization', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
  });
});
