/**
 * documents — Wave-2 (cluster B2, content) · Slice 4 (axis: workflow)
 * Access log is actually persisted on the view + download paths.
 *
 * Both `getDocument.ts` (action 'view') and `downloadDocument.ts` (action
 * 'download') call `DocumentAccessLogRepository.createOne({documentId,
 * personId, action, accessedAt, ipAddress, organizationId})` best-effort in a
 * try/catch. Until now that write was only ever asserted through a stubbed
 * repo — the real persisted row (and the officer-facing access-log read in
 * `getDocumentAccessLog.ts`, which paginates by documentId) had no real-PG
 * proof. This slice drives the REAL `createOne` exactly as those handlers build
 * the payload, then reads back the persisted rows and exercises the
 * `findManyWithPagination` read the access-log endpoint serves.
 *
 * Metadata-only: document upload streams no bytes here (bytes flow through the
 * separate `storage` module); the access-log row is pure metadata.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createContentScratch, seedOrg } from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { DocumentAccessLogRepository } from './repos/documents.repo';

let H: ScratchDb;

beforeAll(async () => {
  H = await createContentScratch();
});

afterAll(async () => {
  await H?.teardown();
});

describe('documents access-log persistence (view + download) — real-PG', () => {
  test('view then download persist two real rows with correct person/action/document/org', async () => {
    if (!H.dbReachable) return;
    const org = seedOrg();
    const documentId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const repo = new DocumentAccessLogRepository(H.db as never);

    // Drive the write EXACTLY as getDocument.ts builds it (action 'view').
    await repo.createOne({
      documentId,
      personId,
      action: 'view',
      accessedAt: new Date(),
      ipAddress: '203.0.113.7',
      organizationId: org,
    });

    // Drive the write EXACTLY as downloadDocument.ts builds it (action 'download').
    await repo.createOne({
      documentId,
      personId,
      action: 'download',
      accessedAt: new Date(),
      ipAddress: null,
      organizationId: org,
    });

    // Read back the persisted rows via raw SQL (sorted by action).
    const { rows } = await H.scopedPool.query(
      `SELECT action, person_id, document_id, organization_id, ip_address
         FROM "${H.schema}".document_access_log
        WHERE document_id = $1
        ORDER BY action`,
      [documentId],
    );

    expect(rows.map((r) => r.action)).toEqual(['download', 'view']);
    // Every row carries the exact seeded person/document/org.
    for (const r of rows) {
      expect(r.person_id).toBe(personId);
      expect(r.document_id).toBe(documentId);
      expect(r.organization_id).toBe(org);
    }
    // The 'download' row preserved a NULL ip; the 'view' row preserved its ip.
    const download = rows.find((r) => r.action === 'download')!;
    const view = rows.find((r) => r.action === 'view')!;
    expect(download.ip_address).toBeNull();
    expect(view.ip_address).toBe('203.0.113.7');
  });

  test('findManyWithPagination({documentId}) mirrors getDocumentAccessLog: only that document, totalCount 2', async () => {
    if (!H.dbReachable) return;
    const org = seedOrg();
    const documentId = crypto.randomUUID();
    const otherDocumentId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const repo = new DocumentAccessLogRepository(H.db as never);

    // Two access rows for the target document (view + download).
    await repo.createOne({
      documentId,
      personId,
      action: 'view',
      accessedAt: new Date(),
      ipAddress: null,
      organizationId: org,
    });
    await repo.createOne({
      documentId,
      personId,
      action: 'download',
      accessedAt: new Date(),
      ipAddress: null,
      organizationId: org,
    });
    // A row for a DIFFERENT document — must NOT be returned by the filtered read.
    await repo.createOne({
      documentId: otherDocumentId,
      personId,
      action: 'view',
      accessedAt: new Date(),
      ipAddress: null,
      organizationId: org,
    });

    // Mirror getDocumentAccessLog.ts: findManyWithPagination({ documentId }, { pagination }).
    const result = await repo.findManyWithPagination(
      { documentId },
      { pagination: { offset: 0, limit: 20 } },
    );

    expect(result.totalCount).toBe(2);
    expect(result.data.length).toBe(2);
    // Every returned row belongs to the requested document only.
    expect(result.data.every((r) => r.documentId === documentId)).toBe(true);
    expect(result.data.some((r) => r.documentId === otherDocumentId)).toBe(false);
    // Both persisted actions surface to the officer-facing read.
    expect([...result.data.map((r) => r.action)].sort()).toEqual(['download', 'view']);
  });

  test('findManyWithPagination({personId}) for an unrelated person returns totalCount 0', async () => {
    if (!H.dbReachable) return;
    const org = seedOrg();
    const documentId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const repo = new DocumentAccessLogRepository(H.db as never);

    await repo.createOne({
      documentId,
      personId,
      action: 'view',
      accessedAt: new Date(),
      ipAddress: null,
      organizationId: org,
    });

    // A person with no access rows of their own sees nothing (negative branch).
    const result = await repo.findManyWithPagination(
      { personId: crypto.randomUUID() },
      { pagination: { offset: 0, limit: 20 } },
    );
    expect(result.totalCount).toBe(0);
    expect(result.data.length).toBe(0);

    // Sanity: the real owner's row IS findable (proves the filter is selective,
    // not globally empty).
    const owner = await repo.findManyWithPagination(
      { personId },
      { pagination: { offset: 0, limit: 20 } },
    );
    expect(owner.totalCount).toBe(1);
  });
});
