/**
 * getDocument — compliance access-log write (FIX-003 / AC-M11-005).
 *
 * Proves that viewing a document via the real `getDocument` handler persists a
 * `document_access_log` row (action: 'view'), best-effort. This replaces the
 * previous in-memory simulation in ac-m11.documents.test.ts which tested local
 * closures, not the handler (fake-green).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDocument } from '@/test-utils/factories';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { getDocument } from './getDocument';

const DOC_ID = 'doc-1';
const ORG_ID = 'tenant-1';
const docInOrg = fakeDocument({ id: DOC_ID, organizationId: ORG_ID, title: 'Board Minutes' });

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
  accessLogRows = [];
  stubRepo(DocumentRepository, { findOneById: async () => docInOrg });
});

afterEach(() => {
  restoreRepo(DocumentRepository);
  restoreRepo(DocumentAccessLogRepository);
});

describe('[AC-M11-005] getDocument access-log write (real handler)', () => {
  test('writes a document_access_log row with action="view" on successful view', async () => {
    stubAccessLogCapture();
    const ctx = makeCtx({ organizationId: ORG_ID, _params: { documentId: DOC_ID } });
    const res = await getDocument(ctx);
    expect(res.status).toBe(200);

    expect(accessLogRows).toHaveLength(1);
    expect(accessLogRows[0].action).toBe('view');
    expect(accessLogRows[0].documentId).toBe(DOC_ID);
    expect(accessLogRows[0].personId).toBe('user-1');
    expect(accessLogRows[0].organizationId).toBe(ORG_ID);
    expect(accessLogRows[0].accessedAt).toBeInstanceOf(Date);
  });

  test('does NOT write an access-log row when the document is cross-org (forbidden)', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findOneById: async () => fakeDocument({ id: DOC_ID, organizationId: 'other-org' }) });
    stubAccessLogCapture();
    const ctx = makeCtx({ organizationId: ORG_ID, _params: { documentId: DOC_ID } });
    await expect(getDocument(ctx)).rejects.toBeTruthy();
    expect(accessLogRows).toHaveLength(0);
  });

  test('access-log write failure does not break the view response (best-effort)', async () => {
    stubRepo(DocumentAccessLogRepository, {
      createOne: async () => { throw new Error('db down'); },
    });
    const ctx = makeCtx({ organizationId: ORG_ID, _params: { documentId: DOC_ID } });
    const res = await getDocument(ctx);
    expect(res.status).toBe(200);
  });
});
