/**
 * Documents Module — Handler Unit Tests
 *
 * Covers: createDocument, updateDocument, archiveDocument, deleteDocument,
 *         uploadNewDocumentVersion, getDocumentAccessLog, searchDocuments
 *
 * Pattern: stub DocumentRepository / DocumentVersionRepository /
 *          DocumentAccessLogRepository on the prototype, then restore in
 *          afterEach so parallel tests don't bleed state.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument as createFakeDocument } from '@/test-utils/factories';
import { DocumentRepository, DocumentVersionRepository, DocumentAccessLogRepository } from './repos/documents.repo';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const DOC_ID = 'doc-00000000-0000-4000-8000-000000000001';
const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const VERSION_ID = 'ver-00000000-0000-4000-8000-000000000002';

const fakeDocument = createFakeDocument({
  id: DOC_ID,
  organizationId: ORG_ID,
  title: 'Test Document',
  ownerId: USER_ID,
  ownerType: 'person',
  accessLevel: 'tenantOnly',
  category: null,
  tags: [],
  currentVersionId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

const archivedDocument = { ...fakeDocument, status: 'archived' };

const fakeVersion = {
  id: VERSION_ID,
  documentId: DOC_ID,
  organizationId: ORG_ID,
  versionNumber: 2,
  fileName: 'test-v2.pdf',
  fileSize: 2048,
  storageKey: 'uploads/test-v2.pdf',
  uploadedBy: USER_ID,
  changeNote: null,
  createdAt: new Date('2026-01-02'),
};

const fakeAccessLog = {
  id: 'log-1',
  documentId: DOC_ID,
  personId: USER_ID,
  action: 'view_access_log',
  accessedAt: new Date('2026-01-01T10:00:00Z'),
  ipAddress: null,
  organizationId: ORG_ID,
};

const paginatedEmpty = { data: [], totalCount: 0 };
const paginatedLogs = { data: [fakeAccessLog], totalCount: 1 };
const paginatedDocs = { data: [fakeDocument], totalCount: 1 };

// ─── auditAction no-op (used by most handlers) ────────────────────────────────
// Handlers import auditAction from @/utils/audit. We don't need to assert on
// it — just ensure the handlers don't throw. The database mock on the ctx
// already returns a transaction no-op.

// ─── createDocument ───────────────────────────────────────────────────────────

describe('createDocument', () => {
  beforeEach(() => restoreRepo(DocumentRepository));
  afterEach(() => restoreRepo(DocumentRepository));

  const validBody = {
    title: 'Test Document',
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    storageKey: 'uploads/test.pdf',
    ownerId: USER_ID,
    ownerType: 'person',
    accessLevel: 'tenantOnly',
  };

  test('returns 401 when no user', async () => {
    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ user: null, _body: validBody });
    const res = await createDocument(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no orgId', async () => {
    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ organizationId: null, _body: validBody });
    const res = await createDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 with created document on success', async () => {
    stubRepo(DocumentRepository, {
      createOne: async () => fakeDocument,
    });

    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ _body: validBody });
    const res = await createDocument(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.id).toBe(DOC_ID);
  });

  test('uses published status by default (not draft)', async () => {
    let capturedInput: any;
    stubRepo(DocumentRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...fakeDocument, ...input };
      },
    });

    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ _body: validBody });
    await createDocument(ctx);
    expect(capturedInput.status).toBe('published');
  });

  test('passes through optional category and tags', async () => {
    let capturedInput: any;
    stubRepo(DocumentRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...fakeDocument, ...input };
      },
    });

    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({
      _body: { ...validBody, category: 'compliance', tags: ['tag-1'] },
    });
    await createDocument(ctx);
    expect(capturedInput.category).toBe('compliance');
    expect(capturedInput.tags).toEqual(['tag-1']);
  });

  test('defaults category to null and tags to [] when not provided', async () => {
    let capturedInput: any;
    stubRepo(DocumentRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...fakeDocument, ...input };
      },
    });

    const { createDocument } = await import('./createDocument');
    const ctx = makeCtx({ _body: validBody });
    await createDocument(ctx);
    expect(capturedInput.category).toBeNull();
    expect(capturedInput.tags).toEqual([]);
  });
});

// ─── updateDocument ───────────────────────────────────────────────────────────

describe('updateDocument', () => {
  beforeEach(() => restoreRepo(DocumentRepository));
  afterEach(() => restoreRepo(DocumentRepository));

  test('throws when no session', async () => {
    const { updateDocument } = await import('./updateDocument');
    const ctx = makeCtx({ session: null, _params: { documentId: DOC_ID }, _body: {} });
    await expect(updateDocument(ctx)).rejects.toThrow();
  });

  test('throws NOT_FOUND when document does not exist', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => undefined,
    });

    const { updateDocument } = await import('./updateDocument');
    const ctx = makeCtx({ _params: { documentId: 'missing' }, _body: { title: 'New' } });
    const err = await updateDocument(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('returns 200 with updated document on success', async () => {
    const updatedDoc = { ...fakeDocument, title: 'Updated Title' };
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => updatedDoc,
    });

    const { updateDocument } = await import('./updateDocument');
    const ctx = makeCtx({
      _params: { documentId: DOC_ID },
      _body: { title: 'Updated Title' },
    });
    const res = await updateDocument(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.title).toBe('Updated Title');
  });

  test('calls updateOneById with provided documentId', async () => {
    let capturedId: string | undefined;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async (id: string) => {
        capturedId = id;
        return fakeDocument;
      },
    });

    const { updateDocument } = await import('./updateDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _body: {} });
    await updateDocument(ctx);
    expect(capturedId).toBe(DOC_ID);
  });
});

// ─── archiveDocument ──────────────────────────────────────────────────────────

describe('archiveDocument', () => {
  beforeEach(() => restoreRepo(DocumentRepository));
  afterEach(() => restoreRepo(DocumentRepository));

  test('returns 401 when no user', async () => {
    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ user: null, _params: { documentId: DOC_ID } });
    const res = await archiveDocument(ctx);
    expect(res.status).toBe(401);
  });

  test('throws NOT_FOUND when document does not exist', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => undefined,
    });

    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ _params: { documentId: 'missing' } });
    const err = await archiveDocument(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('throws ALREADY_ARCHIVED when document is already archived', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => archivedDocument,
    });

    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID } });
    const err = await archiveDocument(ctx).catch((e: any) => e);
    expect(err.code).toBe('ALREADY_ARCHIVED');
  });

  test('returns 200 and sets status to archived on success', async () => {
    const updatedDoc = { ...fakeDocument, status: 'archived' };
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => updatedDoc,
    });

    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID } });
    const res = await archiveDocument(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('archived');
  });

  test('calls updateOneById with status=archived', async () => {
    let capturedPatch: any;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async (_id: string, patch: any) => {
        capturedPatch = patch;
        return { ...fakeDocument, ...patch };
      },
    });

    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID } });
    await archiveDocument(ctx);
    expect(capturedPatch.status).toBe('archived');
  });

  test('does not delete — document still has its id after archiving', async () => {
    const updatedDoc = { ...fakeDocument, status: 'archived' };
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => updatedDoc,
    });

    const { archiveDocument } = await import('./archiveDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID } });
    const res = await archiveDocument(ctx);
    expect((res as any).body.id).toBe(DOC_ID);
  });
});

// ─── deleteDocument ───────────────────────────────────────────────────────────

describe('deleteDocument', () => {
  beforeEach(() => restoreRepo(DocumentRepository));
  afterEach(() => restoreRepo(DocumentRepository));

  test('throws when no session', async () => {
    const { deleteDocument } = await import('./deleteDocument');
    const ctx = makeCtx({ session: null, _params: { documentId: DOC_ID } });
    await expect(deleteDocument(ctx)).rejects.toThrow();
  });

  test('throws NOT_FOUND when document does not exist', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => undefined,
    });

    const { deleteDocument } = await import('./deleteDocument');
    const ctx = makeCtx({ _params: { documentId: 'missing' } });
    const err = await deleteDocument(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('returns 204 with null body on successful delete', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      deleteOneById: async () => undefined,
    });

    const { deleteDocument } = await import('./deleteDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID } });
    const res = await deleteDocument(ctx);
    expect(res.status).toBe(204);
    expect((res as any).body).toBeNull();
  });

  test('calls deleteOneById with correct id', async () => {
    let deletedId: string | undefined;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      deleteOneById: async (id: string) => {
        deletedId = id;
      },
    });

    const { deleteDocument } = await import('./deleteDocument');
    const ctx = makeCtx({ _params: { documentId: DOC_ID } });
    await deleteDocument(ctx);
    expect(deletedId).toBe(DOC_ID);
  });
});

// ─── uploadNewDocumentVersion ─────────────────────────────────────────────────

describe('uploadNewDocumentVersion', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentVersionRepository);
  });
  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentVersionRepository);
  });

  const validVersionBody = {
    fileName: 'test-v2.pdf',
    size: 2048,
    storageKey: 'uploads/test-v2.pdf',
  };

  test('returns 401 when no user', async () => {
    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ user: null, _params: { documentId: DOC_ID }, _body: validVersionBody });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no orgId', async () => {
    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ organizationId: null, _params: { documentId: DOC_ID }, _body: validVersionBody });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NOT_FOUND when document does not exist', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => undefined,
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ _params: { documentId: 'missing' }, _body: validVersionBody });
    const err = await uploadNewDocumentVersion(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('returns 201 with new version on success', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => ({ ...fakeDocument, currentVersionId: VERSION_ID }),
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 1,
      createOne: async () => fakeVersion,
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _body: validVersionBody });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.id).toBe(VERSION_ID);
  });

  test('increments version number from latest', async () => {
    let capturedVersionNumber: number | undefined;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => fakeDocument,
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 3, // current latest is 3
      createOne: async (input: any) => {
        capturedVersionNumber = input.versionNumber;
        return { ...fakeVersion, versionNumber: input.versionNumber };
      },
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _body: validVersionBody });
    await uploadNewDocumentVersion(ctx);
    expect(capturedVersionNumber).toBe(4); // 3 + 1
  });

  test('version number starts at 1 when no prior versions exist', async () => {
    let capturedVersionNumber: number | undefined;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => fakeDocument,
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 0, // no prior versions
      createOne: async (input: any) => {
        capturedVersionNumber = input.versionNumber;
        return { ...fakeVersion, versionNumber: input.versionNumber };
      },
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _body: validVersionBody });
    await uploadNewDocumentVersion(ctx);
    expect(capturedVersionNumber).toBe(1);
  });

  test('updates document currentVersionId to new version id', async () => {
    let capturedPatch: any;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async (_id: string, patch: any) => {
        capturedPatch = patch;
        return { ...fakeDocument, ...patch };
      },
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 1,
      createOne: async () => fakeVersion,
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _body: validVersionBody });
    await uploadNewDocumentVersion(ctx);
    expect(capturedPatch.currentVersionId).toBe(VERSION_ID);
  });

  test('passes changeNotes when provided', async () => {
    let capturedInput: any;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => fakeDocument,
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 1,
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...fakeVersion, changeNote: input.changeNote };
      },
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({
      _params: { documentId: DOC_ID },
      _body: { ...validVersionBody, changeNotes: 'Fixed typo on page 3' },
    });
    await uploadNewDocumentVersion(ctx);
    expect(capturedInput.changeNote).toBe('Fixed typo on page 3');
  });

  test('defaults changeNote to null when changeNotes not provided', async () => {
    let capturedInput: any;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
      updateOneById: async () => fakeDocument,
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 1,
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...fakeVersion, changeNote: input.changeNote };
      },
    });

    const { uploadNewDocumentVersion } = await import('./uploadNewDocumentVersion');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _body: validVersionBody });
    await uploadNewDocumentVersion(ctx);
    expect(capturedInput.changeNote).toBeNull();
  });
});

// ─── getDocumentAccessLog ─────────────────────────────────────────────────────

describe('getDocumentAccessLog', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentAccessLogRepository);
  });
  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentAccessLogRepository);
  });

  test('returns 401 when no user', async () => {
    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ user: null, _params: { documentId: DOC_ID }, _query: {} });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(401);
  });

  test('throws NOT_FOUND when document does not exist', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => undefined,
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: 'missing' }, _query: {} });
    const err = await getDocumentAccessLog(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('returns 200 with paginated access log on success', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
    });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => fakeAccessLog,
      findManyWithPagination: async () => paginatedLogs,
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _query: {} });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].action).toBe('view_access_log');
  });

  test('includes correct pagination metadata', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
    });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => fakeAccessLog,
      findManyWithPagination: async () => ({ data: [], totalCount: 40 }),
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _query: { offset: '0', limit: '20' } });
    const res = await getDocumentAccessLog(ctx);
    const { pagination } = (res as any).body;
    expect(pagination.totalCount).toBe(40);
    expect(pagination.totalPages).toBe(2);
    expect(pagination.currentPage).toBe(1);
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.hasPreviousPage).toBe(false);
  });

  test('meta-logs the access log view (createOne called with view_access_log action)', async () => {
    let capturedLogEntry: any;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
    });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async (entry: any) => {
        capturedLogEntry = entry;
        return { ...fakeAccessLog, ...entry };
      },
      findManyWithPagination: async () => paginatedEmpty,
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _query: {} });
    await getDocumentAccessLog(ctx);
    expect(capturedLogEntry.action).toBe('view_access_log');
    expect(capturedLogEntry.personId).toBe(USER_ID);
    expect(capturedLogEntry.documentId).toBe(DOC_ID);
  });

  test('still returns results even if meta-logging throws (non-critical path)', async () => {
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
    });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => { throw new Error('DB write failed'); },
      findManyWithPagination: async () => paginatedLogs,
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _query: {} });
    // Should NOT throw despite createOne failing
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(200);
  });

  test('formats accessedAt as ISO string', async () => {
    const accessedAt = new Date('2026-03-15T14:30:00Z');
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
    });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => fakeAccessLog,
      findManyWithPagination: async () => ({
        data: [{ ...fakeAccessLog, accessedAt }],
        totalCount: 1,
      }),
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _query: {} });
    const res = await getDocumentAccessLog(ctx);
    expect((res as any).body.data[0].accessedAt).toBe('2026-03-15T14:30:00.000Z');
  });

  test('respects custom offset and limit query params', async () => {
    let capturedPagination: any;
    stubRepo(DocumentRepository, {
      findOneById: async () => fakeDocument,
    });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => fakeAccessLog,
      findManyWithPagination: async (_filters: any, options: any) => {
        capturedPagination = options.pagination;
        return paginatedEmpty;
      },
    });

    const { getDocumentAccessLog } = await import('./getDocumentAccessLog');
    const ctx = makeCtx({ _params: { documentId: DOC_ID }, _query: { offset: '40', limit: '10' } });
    await getDocumentAccessLog(ctx);
    expect(capturedPagination.offset).toBe(40);
    expect(capturedPagination.limit).toBe(10);
  });
});

// ─── searchDocuments ──────────────────────────────────────────────────────────

describe('searchDocuments', () => {
  beforeEach(() => restoreRepo(DocumentRepository));
  afterEach(() => restoreRepo(DocumentRepository));

  test('throws when no session', async () => {
    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ session: null, _query: {} });
    await expect(searchDocuments(ctx)).rejects.toThrow();
  });

  test('returns 200 with paginated documents on success', async () => {
    stubRepo(DocumentRepository, {
      findManyWithPagination: async () => paginatedDocs,
    });

    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ _query: {} });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(DOC_ID);
  });

  test('returns empty data array when no documents match', async () => {
    stubRepo(DocumentRepository, {
      findManyWithPagination: async () => paginatedEmpty,
    });

    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ _query: { q: 'nonexistent' } });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(0);
    expect((res as any).body.pagination.totalCount).toBe(0);
  });

  test('passes organizationId filter from orgId context', async () => {
    let capturedFilters: any;
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return paginatedEmpty;
      },
    });

    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ organizationId: ORG_ID, _query: {} });
    await searchDocuments(ctx);
    expect(capturedFilters.organizationId).toBe(ORG_ID);
  });

  test('passes query filters (ownerId, ownerType, accessLevel, category, q)', async () => {
    let capturedFilters: any;
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return paginatedEmpty;
      },
    });

    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({
      _query: {
        ownerId: 'owner-99',
        ownerType: 'chapter',
        accessLevel: 'public',
        category: 'compliance',
        q: 'dental',
      },
    });
    await searchDocuments(ctx);
    expect(capturedFilters.ownerId).toBe('owner-99');
    expect(capturedFilters.ownerType).toBe('chapter');
    expect(capturedFilters.accessLevel).toBe('public');
    expect(capturedFilters.category).toBe('compliance');
    expect(capturedFilters.q).toBe('dental');
  });

  test('includes correct pagination metadata', async () => {
    stubRepo(DocumentRepository, {
      findManyWithPagination: async () => ({ data: Array(5).fill(fakeDocument), totalCount: 25 }),
    });

    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ _query: { offset: '20', limit: '5' } });
    const res = await searchDocuments(ctx);
    const { pagination } = (res as any).body;
    expect(pagination.totalCount).toBe(25);
    expect(pagination.totalPages).toBe(5);
    expect(pagination.currentPage).toBe(5);
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.hasPreviousPage).toBe(true);
  });

  test('defaults offset to 0 and limit to 20 when not provided', async () => {
    let capturedPagination: any;
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (_filters: any, options: any) => {
        capturedPagination = options.pagination;
        return paginatedEmpty;
      },
    });

    const { searchDocuments } = await import('./searchDocuments');
    const ctx = makeCtx({ _query: {} });
    await searchDocuments(ctx);
    expect(capturedPagination.offset).toBe(0);
    expect(capturedPagination.limit).toBe(20);
  });
});
