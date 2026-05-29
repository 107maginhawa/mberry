/**
 * Auth enforcement tests for Documents module (P0/P1 security fixes).
 *
 * Tests IDOR prevention, officer-only restrictions, and org-scope checks.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getDocument } from './getDocument';
import { getDocumentAccessLog } from './getDocumentAccessLog';
import { searchDocuments } from './searchDocuments';
import { deleteDocument } from './deleteDocument';
import { archiveDocument } from './archiveDocument';
import { updateDocument } from './updateDocument';
import { ForbiddenError, UnauthorizedError } from '@/core/errors';

// ─── Shared Setup ───────────────────────────────────────

const docInOrg = fakeDocument({ organizationId: 'tenant-1' });
const docOtherOrg = fakeDocument({ organizationId: 'other-org', id: 'doc-other' });

function stubDocRepoWith(doc: any) {
  stubRepo(DocumentRepository, {
    findOneById: async () => doc,
    deleteOneById: async () => {},
    updateOneById: async (_id: string, data: any) => ({ ...doc, ...data }),
    findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
  });
}

function stubOfficerAllowed() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
  });
}

function stubOfficerDenied() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [],
  });
}

function stubAccessLog() {
  stubRepo(DocumentAccessLogRepository, {
    createOne: async () => ({}),
    findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
  });
}

beforeEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(OfficerTermRepository);
  restoreRepo(DocumentAccessLogRepository);
});

afterEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(OfficerTermRepository);
  restoreRepo(DocumentAccessLogRepository);
});

// ─── P0-01: getDocument IDOR ────────────────────────────

describe('P0-01: getDocument org-scope check', () => {
  test('returns document when org matches', async () => {
    stubDocRepoWith(docInOrg);
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-1' } });
    const res = await getDocument(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError when org does not match (IDOR)', async () => {
    stubDocRepoWith(docOtherOrg);
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-other' } });
    await expect(getDocument(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { documentId: 'doc-1' } });
    await expect(getDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

// ─── P0-02: getDocumentAccessLog officer restriction ────

describe('P0-02: getDocumentAccessLog officer restriction', () => {
  test('returns 403 for non-officer members', async () => {
    stubDocRepoWith(docInOrg);
    stubAccessLog();
    stubOfficerDenied();
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
      _query: {},
    });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 for officers', async () => {
    stubDocRepoWith(docInOrg);
    stubAccessLog();
    stubOfficerAllowed();
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
      _query: {},
    });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(200);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { documentId: 'doc-1' },
      _query: {},
    });
    const res = await getDocumentAccessLog(ctx);
    expect(res.status).toBe(401);
  });
});

// ─── P0-04: searchDocuments accessLevel ─────────────────

describe('P0-04: searchDocuments accessLevel enforcement', () => {
  test('allows public/internal access for members', async () => {
    stubDocRepoWith(null);
    stubOfficerDenied();
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (filter: any) => {
        // Should be downgraded to 'tenantOnly' for non-officers
        expect(filter.accessLevel).toBe('tenantOnly');
        return { data: [], totalCount: 0 };
      },
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _query: { accessLevel: 'privileged', offset: '0', limit: '20' },
    });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
  });

  test('allows privileged access for officers', async () => {
    stubOfficerAllowed();
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (filter: any) => {
        expect(filter.accessLevel).toBe('privileged');
        return { data: [], totalCount: 0 };
      },
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _query: { accessLevel: 'privileged', offset: '0', limit: '20' },
    });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── P1: deleteDocument officer restriction ─────────────

describe('P1: deleteDocument officer restriction', () => {
  test('returns 403 for non-officer', async () => {
    stubDocRepoWith(docInOrg);
    stubOfficerDenied();
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-1' } });
    const res = await deleteDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('succeeds for officer in same org', async () => {
    stubDocRepoWith(docInOrg);
    stubOfficerAllowed();
    stubRepo(DocumentRepository, {
      findOneById: async () => docInOrg,
      deleteOneById: async () => {},
    });
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-1' } });
    const res = await deleteDocument(ctx);
    expect(res.status).toBe(204);
  });

  test('throws ForbiddenError for cross-org document', async () => {
    stubOfficerAllowed();
    stubRepo(DocumentRepository, {
      findOneById: async () => docOtherOrg,
      deleteOneById: async () => {},
    });
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-other' } });
    await expect(deleteDocument(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── P1: archiveDocument officer restriction ────────────

describe('P1: archiveDocument officer restriction', () => {
  test('returns 403 for non-officer', async () => {
    stubDocRepoWith(docInOrg);
    stubOfficerDenied();
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-1' } });
    const res = await archiveDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('succeeds for officer in same org', async () => {
    stubDocRepoWith(docInOrg);
    stubOfficerAllowed();
    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { documentId: 'doc-1' } });
    const res = await archiveDocument(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── P1: updateDocument officer restriction ─────────────

describe('P1: updateDocument officer restriction', () => {
  test('returns 403 for non-officer', async () => {
    stubDocRepoWith(docInOrg);
    stubOfficerDenied();
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
      _body: { title: 'Updated' },
    });
    const res = await updateDocument(ctx);
    expect(res.status).toBe(403);
  });

  test('succeeds for officer in same org', async () => {
    stubDocRepoWith(docInOrg);
    stubOfficerAllowed();
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-1' },
      _body: { title: 'Updated' },
    });
    const res = await updateDocument(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError for cross-org document', async () => {
    stubOfficerAllowed();
    stubRepo(DocumentRepository, {
      findOneById: async () => docOtherOrg,
      updateOneById: async () => docOtherOrg,
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { documentId: 'doc-other' },
      _body: { title: 'Hijacked' },
    });
    await expect(updateDocument(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
