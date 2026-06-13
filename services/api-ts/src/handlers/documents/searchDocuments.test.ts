import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository } from './repos/documents.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { searchDocuments } from './searchDocuments';
import { UnauthorizedError } from '@/core/errors';

// Factory N/A: paginated query result wrapper
const fakeResult = {
  data: [{ id: 'doc-1', title: 'Test' }],
  totalCount: 1,
};

function stubOfficer(isOfficer: boolean) {
  restoreRepo(OfficerTermRepository);
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => isOfficer ? [{ positionTitle: 'President' }] : [],
  });
}

describe('searchDocuments', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(DocumentRepository, { findManyWithPagination: async () => fakeResult });
    // Default: caller is an officer unless a test overrides.
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    await expect(searchDocuments(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 200 with paginated results', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(1);
  });

  test('returns empty results when no documents match', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findManyWithPagination: async () => ({ data: [], totalCount: 0 }) });
    const ctx = makeCtx({ _query: { q: 'nonexistent' } });
    const res = await searchDocuments(ctx);
    expect((res as any).body?.data).toHaveLength(0);
    expect((res as any).body?.pagination?.totalCount).toBe(0);
  });
});

// ─── FIX-004: status enforcement (WF-073 publish semantics) ───────────────────

describe('searchDocuments — status enforcement', () => {
  let capturedFilters: any;

  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    capturedFilters = undefined;
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('non-officer (member) is forced to status="published" even with no status query', async () => {
    stubOfficer(false);
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: {} });
    const res = await searchDocuments(ctx);
    expect(res.status).toBe(200);
    expect(capturedFilters.status).toBe('published');
  });

  test('non-officer cannot escalate to draft by passing status=draft', async () => {
    stubOfficer(false);
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: { status: 'draft' } });
    await searchDocuments(ctx);
    // Member's draft request is overridden back to published.
    expect(capturedFilters.status).toBe('published');
  });

  test('officer with no status filter sees all statuses (no status constraint)', async () => {
    stubOfficer(true);
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: {} });
    await searchDocuments(ctx);
    expect(capturedFilters.status).toBeUndefined();
  });

  test('officer status filter is respected (draft)', async () => {
    stubOfficer(true);
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: { status: 'draft' } });
    await searchDocuments(ctx);
    expect(capturedFilters.status).toBe('draft');
  });

  test('officer status filter is respected (archived)', async () => {
    stubOfficer(true);
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: { status: 'archived' } });
    await searchDocuments(ctx);
    expect(capturedFilters.status).toBe('archived');
  });
});

// ─── FIX-004: tag filter wiring (previously a no-op) ──────────────────────────

describe('searchDocuments — tag filter', () => {
  let capturedFilters: any;

  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
    capturedFilters = undefined;
    stubRepo(DocumentRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('tag query param is passed through to the repo filter', async () => {
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: { tag: 'compliance' } });
    await searchDocuments(ctx);
    expect(capturedFilters.tag).toBe('compliance');
  });

  test('tag is undefined in filters when not provided', async () => {
    const ctx = makeCtx({ organizationId: 'tenant-1', _query: {} });
    await searchDocuments(ctx);
    expect(capturedFilters.tag).toBeUndefined();
  });
});
