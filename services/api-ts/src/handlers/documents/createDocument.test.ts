import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument, fakeStoredFile } from '@/test-utils/factories';
import { DocumentRepository } from './repos/documents.repo';
import { StorageFileRepository } from '@/handlers/storage/repos/file.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { createDocument } from './createDocument';

const fakeDoc = fakeDocument({ ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' });

// Storage mints keys as the StoredFile UUID, so storageKey must be a UUID for
// the ownership gate to even reach the lookup.
const VALID_KEY = '11111111-1111-4111-8111-111111111111';

let lastCreateInput: any = null;

describe('createDocument', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(StorageFileRepository);
    restoreRepo(OfficerTermRepository);
    lastCreateInput = null;
    stubRepo(DocumentRepository, {
      createOne: async (input: any) => {
        lastCreateInput = input;
        return fakeDoc;
      },
    });
    // Default: the storageKey resolves to a StoredFile the caller (user-1) owns
    // in their org (tenant-1) — so the ownership gate passes. Tests that probe
    // the cross-tenant exfil path override this stub.
    stubRepo(StorageFileRepository, {
      findOneById: async (id: string) =>
        fakeStoredFile({ id, organizationId: 'tenant-1', owner: 'user-1' }),
    });
    // Default: caller is an active officer (so org-owned creates are allowed).
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(StorageFileRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1024, storageKey: VALID_KEY, ownerId: 'o', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1024, storageKey: VALID_KEY, ownerId: 'o', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 on success', async () => {
    const ctx = makeCtx({ _body: { title: 'Test Doc', fileName: 'test.pdf', mimeType: 'application/pdf', size: 1024, storageKey: VALID_KEY, ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.id).toBe('doc-1');
  });

  // EM-M11-7a3e1c02: documents start as draft, not auto-published.
  test('defaults status to draft when not provided', async () => {
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: VALID_KEY, ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    await createDocument(ctx);
    expect(lastCreateInput?.status).toBe('draft');
  });

  test('honors explicit published status', async () => {
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: VALID_KEY, ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly', status: 'published' } });
    await createDocument(ctx);
    expect(lastCreateInput?.status).toBe('published');
  });

  // EM-M11-g4b67c23: org-owned documents require officer access.
  test('allows a member to create their own person-owned document', async () => {
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: VALID_KEY, ownerId: 'user-1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
  });

  test('returns 403 when non-officer creates an org-owned document', async () => {
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: VALID_KEY, ownerId: 'org-1', ownerType: 'organization', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('allows an officer to create an org-owned document', async () => {
    const ctx = makeCtx({ _body: { title: 'T', fileName: 'f.pdf', mimeType: 'application/pdf', size: 1, storageKey: VALID_KEY, ownerId: 'org-1', ownerType: 'organization', accessLevel: 'tenantOnly' } });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
  });

  // SEC (cross-tenant exfil): a self-owned document whose storageKey points at
  // a file the caller does not own / is in another org must be rejected, even
  // though the self-owned branch bypasses the officer check.
  describe('storageKey ownership gate (cross-tenant exfil)', () => {
    const selfOwnedBody = {
      title: 'Mine',
      fileName: 'f.pdf',
      mimeType: 'application/pdf',
      size: 1,
      storageKey: VALID_KEY,
      ownerId: 'user-1',
      ownerType: 'person' as const,
      accessLevel: 'tenantOnly' as const,
    };

    test('rejects a storageKey pointing at another ORG file (404 → ValidationError)', async () => {
      restoreRepo(StorageFileRepository);
      stubRepo(StorageFileRepository, {
        findOneById: async (id: string) =>
          fakeStoredFile({ id, organizationId: 'evil-org', owner: 'user-1' }),
      });
      const ctx = makeCtx({ _body: selfOwnedBody });
      await expect(createDocument(ctx)).rejects.toThrow(/storageKey/);
    });

    test('rejects a storageKey owned by another USER in the same org', async () => {
      restoreRepo(StorageFileRepository);
      stubRepo(StorageFileRepository, {
        findOneById: async (id: string) =>
          fakeStoredFile({ id, organizationId: 'tenant-1', owner: 'other-user' }),
      });
      const ctx = makeCtx({ _body: selfOwnedBody });
      await expect(createDocument(ctx)).rejects.toThrow(/storageKey/);
    });

    test('rejects a storageKey that resolves to no StoredFile row', async () => {
      restoreRepo(StorageFileRepository);
      stubRepo(StorageFileRepository, { findOneById: async () => undefined });
      const ctx = makeCtx({ _body: selfOwnedBody });
      await expect(createDocument(ctx)).rejects.toThrow(/storageKey/);
    });

    // Robustness: a non-UUID storageKey (e.g. a path) must be a clean 400, not a
    // 500 from Postgres `invalid input syntax for type uuid`. The lookup must
    // never run for a malformed key.
    test('rejects a non-UUID storageKey before any DB lookup (no 500)', async () => {
      let lookupCalled = false;
      restoreRepo(StorageFileRepository);
      stubRepo(StorageFileRepository, {
        findOneById: async () => {
          lookupCalled = true;
          return undefined;
        },
      });
      const ctx = makeCtx({ _body: { ...selfOwnedBody, storageKey: 'test/contract/policy.pdf' } });
      await expect(createDocument(ctx)).rejects.toThrow(/storageKey/);
      expect(lookupCalled).toBe(false);
    });

    test('accepts a storageKey the caller owns in their org', async () => {
      // default beforeEach stub: owner user-1, org tenant-1
      const ctx = makeCtx({ _body: selfOwnedBody });
      const res = await createDocument(ctx);
      expect(res.status).toBe(201);
    });
  });
});
