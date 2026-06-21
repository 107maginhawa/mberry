/**
 * Real-PG integration suite — documents version lifecycle (B2 documents s5).
 *
 * Proves the metadata-only version lifecycle that actually exists:
 *   - DocumentVersionRepository.getLatestVersionNumber returns 0 when no version,
 *     then the MAX(version_number) as v1/v2 are inserted.
 *   - Ordering is by version_number DESC (NOT created_at): v1 is seeded with a
 *     LATER created_at than v2, yet getLatestVersionNumber still returns 2.
 *   - Persisted rows round-trip file_name/storage_key.
 *   - findMany({documentId}) is org/document-scoped — a version for a doc in
 *     ORG_B is excluded.
 *
 * KNOWN GAP (documented, not invented): document/version upload is METADATA-ONLY
 * — createOne persists storage_key/file_name/version_number rows but never streams
 * bytes (bytes flow through the separate `storage` module). This suite tests the
 * metadata lifecycle only; the byte-upload path is out of scope.
 *
 * Mirrors association:operations/repos/events.repo.integration.test.ts idioms.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DocumentVersionRepository } from './documents.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let versions: DocumentVersionRepository;

const ORG_A = '00000000-0000-4000-8000-00000000d5a1';
const ORG_B = '00000000-0000-4000-8000-00000000d5b2';
const DOC_A = '00000000-0000-4000-8000-00000000d5c1';
const DOC_B = '00000000-0000-4000-8000-00000000d5c2';
const UPLOADER = '00000000-0000-4000-8000-00000000d5e1';

/** Seed a document_version row directly (raw INSERT), filling NOT-NULL cols. */
async function seedVersion(
  o: {
    id?: string;
    organizationId?: string;
    documentId?: string;
    versionNumber: number;
    fileName?: string;
    storageKey?: string;
    uploadedBy?: string;
    /** ISO timestamp for created_at — used to prove ordering is NOT time-based. */
    createdAt?: string;
  },
): Promise<string> {
  const id = o.id ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".document_version
       (id, organization_id, document_id, version_number, file_name, storage_key, uploaded_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))`,
    [
      id,
      o.organizationId ?? ORG_A,
      o.documentId ?? DOC_A,
      o.versionNumber,
      o.fileName ?? `v${o.versionNumber}.pdf`,
      o.storageKey ?? `org/${o.documentId ?? DOC_A}/v${o.versionNumber}`,
      o.uploadedBy ?? UPLOADER,
      o.createdAt ?? null,
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch(['document', 'document_version']);
  if (!H.dbReachable) return;
  versions = new DocumentVersionRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('DocumentVersionRepository — version lifecycle (metadata-only)', () => {
  test('getLatestVersionNumber returns 0 before any version exists', async () => {
    if (!H.dbReachable) return;
    expect(await versions.getLatestVersionNumber(DOC_A)).toBe(0);
  });

  test('getLatestVersionNumber climbs 0→1→2 as versions are inserted via createOne; ordering is by version_number, not created_at', async () => {
    if (!H.dbReachable) return;
    // Fresh document id for isolation from the previous test.
    const docId = crypto.randomUUID();
    expect(await versions.getLatestVersionNumber(docId)).toBe(0);

    // v1 seeded with a LATER created_at than v2 — if ordering were time-based,
    // getLatestVersionNumber would wrongly return 1. We prove it returns 2.
    await versions.createOne({
      organizationId: ORG_A,
      documentId: docId,
      versionNumber: 1,
      fileName: 'manual-v1.pdf',
      storageKey: `org/${docId}/v1`,
      uploadedBy: UPLOADER,
      createdAt: new Date('2030-01-02T00:00:00Z'),
    } as never);
    expect(await versions.getLatestVersionNumber(docId)).toBe(1);

    await versions.createOne({
      organizationId: ORG_A,
      documentId: docId,
      versionNumber: 2,
      fileName: 'manual-v2.pdf',
      storageKey: `org/${docId}/v2`,
      uploadedBy: UPLOADER,
      createdAt: new Date('2030-01-01T00:00:00Z'), // EARLIER than v1
    } as never);
    expect(await versions.getLatestVersionNumber(docId)).toBe(2);

    // Read-back: both version_numbers persisted with their file_name/storage_key,
    // and getLatestVersionNumber picked the higher number despite the earlier time.
    const { rows } = await H.scopedPool.query(
      `SELECT version_number, file_name, storage_key
         FROM "${H.schema}".document_version
        WHERE document_id=$1
        ORDER BY version_number ASC`,
      [docId],
    );
    expect(rows.map((r) => r.version_number)).toEqual([1, 2]);
    expect(rows.map((r) => r.file_name)).toEqual(['manual-v1.pdf', 'manual-v2.pdf']);
    expect(rows.map((r) => r.storage_key)).toEqual([`org/${docId}/v1`, `org/${docId}/v2`]);
  });

  test('findMany({documentId}) is document-scoped — a version for a different (ORG_B) doc is excluded', async () => {
    if (!H.dbReachable) return;
    await seedVersion({ documentId: DOC_A, organizationId: ORG_A, versionNumber: 1, fileName: 'a-v1.pdf' });
    await seedVersion({ documentId: DOC_A, organizationId: ORG_A, versionNumber: 2, fileName: 'a-v2.pdf' });
    // A version belonging to a DIFFERENT document in ORG_B.
    await seedVersion({ documentId: DOC_B, organizationId: ORG_B, versionNumber: 1, fileName: 'b-v1.pdf' });

    const aVersions = await versions.findMany({ documentId: DOC_A } as never);
    expect(aVersions.length).toBe(2);
    expect(aVersions.every((v) => v.documentId === DOC_A)).toBe(true);
    expect(aVersions.map((v) => v.versionNumber).sort()).toEqual([1, 2]);
    // The ORG_B document's version never leaks into the DOC_A read.
    expect(aVersions.some((v) => v.documentId === DOC_B)).toBe(false);

    // And getLatestVersionNumber stays document-scoped too.
    expect(await versions.getLatestVersionNumber(DOC_A)).toBe(2);
    expect(await versions.getLatestVersionNumber(DOC_B)).toBe(1);
  });
});
