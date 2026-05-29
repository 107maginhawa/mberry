/**
 * Permission enforcement tests for Documents module.
 *
 * Tests authentication enforcement (401 without session),
 * org-scope IDOR prevention, and officer role requirements
 * added in Wave A auth hardening.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { getDocument } from './getDocument';
import { deleteDocument } from './deleteDocument';
import { archiveDocument } from './archiveDocument';
import { updateDocument } from './updateDocument';
import { searchDocuments } from './searchDocuments';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';

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

function stubOfficer(isOfficer: boolean) {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => isOfficer ? [{ id: 'term-1', positionTitle: 'President' }] : [],
  });
}

beforeEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
  restoreRepo(OfficerTermRepository);
});

afterEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
  restoreRepo(OfficerTermRepository);
});

// ─── getDocument: authentication + org-scope ─────────────

describe('getDocument — authentication enforcement', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
    });

    await expect(getDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns document when authenticated and same org', async () => {
    stubDocRepo(docInOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
    });

    const res = await getDocument(ctx);
    expect(res.status).toBe(200);
  });

  test('blocks cross-org access (IDOR prevention)', async () => {
    stubDocRepo(docOtherOrg);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-cross-org' },
    });

    await expect(getDocument(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── deleteDocument: authentication + officer ────────────

describe('deleteDocument — authentication enforcement', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
    });

    await expect(deleteDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('deletes document when officer', async () => {
    stubDocRepo(docInOrg);
    stubOfficer(true);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
    });

    const res = await deleteDocument(ctx);
    expect(res.status).toBe(204);
  });
});

// ─── archiveDocument: authentication + officer ───────────

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

  test('archives document when officer', async () => {
    stubDocRepo(docInOrg);
    stubOfficer(true);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
    });

    const res = await archiveDocument(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── updateDocument: authentication + officer ────────────

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

  test('updates document when officer', async () => {
    stubDocRepo(docInOrg);
    stubOfficer(true);

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
      _body: { title: 'Updated' },
    });

    const res = await updateDocument(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── searchDocuments: authentication enforcement ─────────

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
