/**
 * downloadDocument — hand-wired handler unit tests.
 *
 * Covers the auth matrix (admin / member-of-org / outsider) and the
 * compliance access-log write (FIX-003 / FIX-009).
 *
 * downloadDocument is hand-wired (mounted outside /association/*), self-enforces
 * org membership via getPlatformAdminPort / getMembershipPort, writes a
 * `document_access_log` row (action: 'download') best-effort, then 302-redirects
 * to a presigned storage URL.
 *
 * The membership port (getMembershipPort) uses a raw db.select() chain rather
 * than a stubbable repo class, so these tests inject a mock db whose select
 * chain returns a controllable membership row.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { PlatformAdminRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { downloadDocument } from './downloadDocument';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';

const DOC_ID = 'doc-1';
const ORG_ID = 'tenant-1';
const docInOrg = fakeDocument({ id: DOC_ID, organizationId: ORG_ID, storageKey: 'uploads/test.pdf' });

/**
 * Build a mock db whose `.select(...).from(...).where(...).limit(...)` chain
 * resolves to `membershipRows`. The membership port awaits the chain (no
 * .limit() in its query, but it destructures `[row]`), so returning an array
 * is sufficient. We make every chain method return `this`/array.
 */
function makeDbWithMembership(membershipRows: any[]) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    orderBy: () => chain,
    then: (resolve: (v: any[]) => any) => resolve(membershipRows),
  };
  return chain;
}

/**
 * Minimal hand-rolled context for the hand-wired downloadDocument handler,
 * which reads from a raw Hono Context (not the ValidatedContext used by
 * makeCtx). Captures the redirect target and lets us inject db/storage/admin.
 */
function makeDownloadCtx(opts: {
  session?: any;
  documentId?: string;
  db?: any;
  storage?: any;
}) {
  const vars: Record<string, any> = {
    session: opts.session === undefined
      ? { id: 'session-1', userId: 'user-1', user: { id: 'user-1' } }
      : opts.session,
    database: opts.db ?? makeDbWithMembership([]),
    storage: opts.storage ?? { generateDownloadUrl: async () => 'https://storage.example/presigned' },
    logger: null,
    organizationId: ORG_ID,
  };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      param: (k: string) => (k === 'documentId' ? (opts.documentId ?? DOC_ID) : ''),
      header: () => null,
    },
    redirect: (url: string, status: number) => ({ status, headers: { Location: url }, _redirect: url } as any),
    json: (body: any, status: number) => ({ status, body } as any),
  } as any;
}

let accessLogRows: any[] = [];

function stubAccessLogCapture() {
  accessLogRows = [];
  stubRepo(DocumentAccessLogRepository, {
    createOne: async (row: any) => { accessLogRows.push(row); return row; },
  });
}

beforeEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
  restoreRepo(PlatformAdminRepository);
  accessLogRows = [];
});

afterEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
  restoreRepo(PlatformAdminRepository);
});

// ─── Auth matrix ────────────────────────────────────────────────────────────

describe('downloadDocument — auth matrix', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeDownloadCtx({ session: null });
    await expect(downloadDocument(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws NotFoundError when document does not exist', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => null });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    stubAccessLogCapture();
    const ctx = makeDownloadCtx({});
    await expect(downloadDocument(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('platform admin can download (no membership needed)', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => ({ id: 'pa-1', userId: 'user-1', role: 'admin' }) });
    stubAccessLogCapture();
    const ctx = makeDownloadCtx({ db: makeDbWithMembership([]) });
    const res = await downloadDocument(ctx);
    expect(res.status).toBe(302);
    expect((res as any).headers.Location).toBe('https://storage.example/presigned');
  });

  test('active member of the org can download', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    stubAccessLogCapture();
    const ctx = makeDownloadCtx({
      db: makeDbWithMembership([{ id: 'm-1', personId: 'user-1', organizationId: ORG_ID, status: 'active' }]),
    });
    const res = await downloadDocument(ctx);
    expect(res.status).toBe(302);
  });

  test('outsider (not admin, not member) is forbidden', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    stubAccessLogCapture();
    const ctx = makeDownloadCtx({ db: makeDbWithMembership([]) }); // no membership row
    await expect(downloadDocument(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── FIX-003: compliance access-log write on download ─────────────────────────

describe('downloadDocument — access-log write (FIX-003)', () => {
  test('writes a document_access_log row with action="download" on successful download', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    stubAccessLogCapture();
    const ctx = makeDownloadCtx({
      db: makeDbWithMembership([{ id: 'm-1', personId: 'user-1', organizationId: ORG_ID, status: 'active' }]),
    });
    const res = await downloadDocument(ctx);
    expect(res.status).toBe(302);

    expect(accessLogRows).toHaveLength(1);
    expect(accessLogRows[0].action).toBe('download');
    expect(accessLogRows[0].documentId).toBe(DOC_ID);
    expect(accessLogRows[0].personId).toBe('user-1');
    expect(accessLogRows[0].organizationId).toBe(ORG_ID);
  });

  test('does NOT write an access-log row when access is forbidden', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    stubAccessLogCapture();
    const ctx = makeDownloadCtx({ db: makeDbWithMembership([]) });
    await expect(downloadDocument(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    expect(accessLogRows).toHaveLength(0);
  });

  test('access-log write failure does not break the download response (best-effort)', async () => {
    stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
    stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => { throw new Error('db down'); },
    });
    const ctx = makeDownloadCtx({
      db: makeDbWithMembership([{ id: 'm-1', personId: 'user-1', organizationId: ORG_ID, status: 'active' }]),
    });
    const res = await downloadDocument(ctx);
    expect(res.status).toBe(302);
  });
});
