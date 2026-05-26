/**
 * Permission enforcement tests for Documents module.
 *
 * Tests authentication enforcement (401 without session) and documents
 * that the current handlers do NOT enforce org-scope or officer checks
 * (flagging these as missing security controls for future hardening).
 *
 * Current enforcement:
 * - getDocument: 401 without session (UnauthorizedError)
 * - deleteDocument: 401 without session (UnauthorizedError)
 * - archiveDocument: 401 without user (returns 401 JSON)
 * - updateDocument: 401 without session (UnauthorizedError)
 * - searchDocuments: 401 without session (UnauthorizedError)
 *
 * Missing enforcement (documented as negative test expectations):
 * - No org-scope check on getDocument (IDOR risk)
 * - No officer check on delete/archive/update
 * - No privileged access downgrade on search
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { getDocument } from './getDocument';
import { deleteDocument } from './deleteDocument';
import { archiveDocument } from './archiveDocument';
import { updateDocument } from './updateDocument';
import { searchDocuments } from './searchDocuments';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const docInOrg = fakeDocument({ organizationId: 'tenant-1' });
const docOtherOrg = fakeDocument({ organizationId: 'other-org', id: 'doc-cross-org' });

function stubDocRepo(doc: any) {
  stubRepo(DocumentRepository, {
    findOneById: async () => doc,
    deleteOneById: async () => {},
    updateOneById: async (_id: string, data: any) => ({ ...doc, ...data }),
    findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
  });
}

beforeEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
});

afterEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
});

// ─── getDocument: authentication enforcement ───────────

describe('getDocument — authentication enforcement', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
    });

    await expect(getDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns document when authenticated', async () => {
    stubDocRepo(docInOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
    });

    const res = await getDocument(ctx);
    expect(res.status).toBe(200);
  });

  test('SECURITY GAP: cross-org access is not blocked (IDOR risk)', async () => {
    // This test documents that the current handler does NOT check org scope.
    // A proper handler should throw ForbiddenError here.
    stubDocRepo(docOtherOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-cross-org' },
    });

    // Currently succeeds — handler does not check organizationId match
    const res = await getDocument(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── deleteDocument: authentication enforcement ────────

describe('deleteDocument — authentication enforcement', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
    });

    await expect(deleteDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('deletes document when authenticated (no officer check)', async () => {
    stubDocRepo(docInOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
    });

    const res = await deleteDocument(ctx);
    expect(res.status).toBe(204);
  });
});

// ─── archiveDocument: authentication enforcement ───────

describe('archiveDocument — authentication enforcement', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
    });

    const res = await archiveDocument(ctx);
    expect(res.status).toBe(401);
  });

  test('archives document when authenticated (no officer check)', async () => {
    stubDocRepo(docInOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
    });

    const res = await archiveDocument(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── updateDocument: authentication enforcement ────────

describe('updateDocument — authentication enforcement', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
      _body: { title: 'Updated' },
    });

    await expect(updateDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('updates document when authenticated (no officer check)', async () => {
    stubDocRepo(docInOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
      _body: { title: 'Updated' },
    });

    const res = await updateDocument(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── searchDocuments: authentication enforcement ───────

describe('searchDocuments — authentication enforcement', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { offset: '0', limit: '20' },
    });

    await expect(searchDocuments(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns results when authenticated', async () => {
    stubDocRepo(null);
    stubRepo(DocumentRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _query: { offset: '0', limit: '20' },
    });

    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
  });
});
