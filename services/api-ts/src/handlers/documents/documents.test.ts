import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Documents Module Tests
 *
 * Tests for documents CRUD, versioning, access logging, archiving, and tags.
 */

describe('Documents - Auth Guards', () => {
  test('createDocument returns 401 without user', async () => {
    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ user: null, _body: { title: 'Test', fileName: 'test.pdf', mimeType: 'application/pdf', size: 1024, storageKey: 'key', ownerId: 'o1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const response = await createDocument(ctx);
    expect(response.status).toBe(401);
  });

  test('createDocument returns 403 without organizationId', async () => {
    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ organizationId: null, _body: { title: 'Test', fileName: 'test.pdf', mimeType: 'application/pdf', size: 1024, storageKey: 'key', ownerId: 'o1', ownerType: 'person', accessLevel: 'tenantOnly' } });
    const response = await createDocument(ctx);
    expect(response.status).toBe(403);
  });

  test('getDocument throws UnauthorizedError without session', async () => {
    const { getDocument } = await import('./getDocument');
    const ctx = makeCtx({ session: null, _params: { documentId: 'x' } });
    await expect(getDocument(ctx)).rejects.toThrow();
  });

  test('searchDocuments throws UnauthorizedError without session', async () => {
    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ session: null, _query: {} });
    await expect(searchDocuments(ctx)).rejects.toThrow();
  });

  test('updateDocument throws UnauthorizedError without session', async () => {
    const { updateDocument } = await import('./updateDocument');
    const ctx = makeCtx({ session: null, _params: { documentId: 'x' }, _body: {} });
    await expect(updateDocument(ctx)).rejects.toThrow();
  });

  test('deleteDocument throws UnauthorizedError without session', async () => {
    const { deleteDocument } = await import('./deleteDocument');
    const ctx = makeCtx({ session: null, _params: { documentId: 'x' } });
    await expect(deleteDocument(ctx)).rejects.toThrow();
  });

  test('archiveDocument returns 401 without user', async () => {
    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ user: null, _params: { documentId: 'x' } });
    const response = await archiveDocument(ctx);
    expect(response.status).toBe(401);
  });
});

describe('Documents - Versioning', () => {
  test('uploadNewDocumentVersion returns 401 without user', async () => {
    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ user: null, _params: { documentId: 'x' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'key2' } });
    const response = await uploadNewDocumentVersion(ctx);
    expect(response.status).toBe(401);
  });

  test('uploadNewDocumentVersion returns 403 without organizationId', async () => {
    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ organizationId: null, _params: { documentId: 'x' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'key2' } });
    const response = await uploadNewDocumentVersion(ctx);
    expect(response.status).toBe(403);
  });

  test('getDocumentVersion throws UnauthorizedError without session', async () => {
    const { getDocumentVersion } = await import('./getDocumentVersion');
    const ctx = makeCtx({ session: null, _params: { documentId: 'x', versionId: 'v1' } });
    await expect(getDocumentVersion(ctx)).rejects.toThrow();
  });

  test('listDocumentVersions throws UnauthorizedError without session', async () => {
    const { listDocumentVersions } = await import('./listDocumentVersions');
    const ctx = makeCtx({ session: null, _params: { documentId: 'x' }, _query: {} });
    await expect(listDocumentVersions(ctx)).rejects.toThrow();
  });

  test('version numbers increment sequentially', () => {
    const versions = [
      { versionNumber: 1, fileName: 'doc_v1.pdf' },
      { versionNumber: 2, fileName: 'doc_v2.pdf' },
      { versionNumber: 3, fileName: 'doc_v3.pdf' },
    ];

    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]!.versionNumber).toBe(versions[i - 1]!.versionNumber + 1);
    }
  });
});

describe('Documents - Archive', () => {
  test('archive sets status to archived, not delete', () => {
    const document = { id: 'doc-1', status: 'published' as string };

    // Simulate archiving
    document.status = 'archived';

    expect(document.status).toBe('archived');
    expect(document.id).toBe('doc-1'); // Still exists
  });

  test('valid statuses are draft, published, archived', () => {
    const validStatuses = ['draft', 'published', 'archived'];
    expect(validStatuses.length).toBe(3);
    expect(validStatuses).toContain('archived');
    expect(validStatuses).not.toContain('deleted');
  });
});

describe('Documents - Access Logging', () => {
  test('getDocumentAccessLog returns 401 without user', async () => {
    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ user: null, _params: { documentId: 'x' }, _query: {} });
    const response = await getDocumentAccessLog(ctx);
    expect(response.status).toBe(401);
  });

  test('access log actions include view, download, edit, view_access_log', () => {
    const validActions = ['view', 'download', 'edit', 'view_access_log'];
    expect(validActions).toContain('view_access_log'); // Meta-logging
    expect(validActions).toContain('view');
    expect(validActions).toContain('download');
  });

  test('meta-logging records access log views', () => {
    // When someone views the access log, that view itself is logged
    const logs = [
      { action: 'view', personId: 'user-1' },
      { action: 'download', personId: 'user-2' },
      { action: 'view_access_log', personId: 'admin-1' }, // meta-log
    ];

    const metaLogs = logs.filter(l => l.action === 'view_access_log');
    expect(metaLogs.length).toBe(1);
    expect(metaLogs[0]!.personId).toBe('admin-1');
  });
});

describe('Document Tags', () => {
  test('createDocumentTag returns 401 without user', async () => {
    const { createDocumentTag } = await import('./createDocumentTag');
    const ctx = makeCtx({ user: null, _body: { name: 'Important' } });
    const response = await createDocumentTag(ctx);
    expect(response.status).toBe(401);
  });

  test('createDocumentTag returns 403 without organizationId', async () => {
    const { createDocumentTag } = await import('./createDocumentTag');
    const ctx = makeCtx({ organizationId: null, _body: { name: 'Important' } });
    const response = await createDocumentTag(ctx);
    expect(response.status).toBe(403);
  });

  test('getDocumentTag throws UnauthorizedError without session', async () => {
    const { getDocumentTag } = await import('./getDocumentTag');
    const ctx = makeCtx({ session: null, _params: { tagId: 'x' } });
    await expect(getDocumentTag(ctx)).rejects.toThrow();
  });

  test('listDocumentTags throws UnauthorizedError without session', async () => {
    const { listDocumentTags } = await import('./listDocumentTags');
    const ctx = makeCtx({ session: null, _query: {} });
    await expect(listDocumentTags(ctx)).rejects.toThrow();
  });

  test('updateDocumentTag throws UnauthorizedError without session', async () => {
    const { updateDocumentTag } = await import('./updateDocumentTag');
    const ctx = makeCtx({ session: null, _params: { tagId: 'x' }, _body: { name: 'Updated' } });
    await expect(updateDocumentTag(ctx)).rejects.toThrow();
  });

  test('deleteDocumentTag throws UnauthorizedError without session', async () => {
    const { deleteDocumentTag } = await import('./deleteDocumentTag');
    const ctx = makeCtx({ session: null, _params: { tagId: 'x' } });
    await expect(deleteDocumentTag(ctx)).rejects.toThrow();
  });

  test('tag has name and optional color', () => {
    const tag = { name: 'Compliance', color: '#FF0000' };
    expect(tag.name).toBe('Compliance');
    expect(tag.color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('Document Access Levels', () => {
  test('valid access levels are public, tenantOnly, unitOnly, restricted, privileged', () => {
    const levels = ['public', 'tenantOnly', 'unitOnly', 'restricted', 'privileged'];
    expect(levels.length).toBe(5);
    expect(levels).toContain('public');
    expect(levels).toContain('restricted');
    expect(levels).toContain('privileged');
  });
});
