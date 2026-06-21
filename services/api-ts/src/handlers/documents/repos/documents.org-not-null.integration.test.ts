/**
 * documents — Wave-2 (cluster B2, content) · Slice 3
 * org_id NOT NULL characterization across all 4 document tables (23502).
 *
 * Live DB confirmed: `organization_id uuid NOT NULL` on `document`,
 * `document_version`, `document_tag`, `document_access_log`. There are NO
 * unique constraints on these tables, so the ONLY Postgres error-code surface
 * here is 23502 (not-null violation). These tests prove the multi-tenant
 * org-scoping invariant actually fires at the SQL layer (characterization —
 * org_id was already NOT NULL, no migration needed).
 *
 * For each table: a raw INSERT omitting `organization_id` (but filling every
 * OTHER NOT-NULL-without-default column) raises 23502; the same INSERT WITH a
 * valid org_id succeeds and reads back the seeded org uuid.
 *
 * Note (DRIFT, do NOT assert bigint): `document.size` is `text` + nullable in
 * the live DB despite the Drizzle schema declaring `bigint('size')` — omitted
 * here (nullable). `document.file_name` carries a DB default `''` so it is
 * intentionally included only in the positive insert for clarity, never the
 * driver of the 23502.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createContentScratch, seedOrg } from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

beforeAll(async () => {
  H = await createContentScratch();
});

afterAll(async () => {
  await H?.teardown();
});

/** Capture the Postgres error code off either the error or its `cause`. */
function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.code ?? err.cause?.code;
}

describe('documents org_id NOT NULL invariant (23502) — real-PG', () => {
  test('document: INSERT without organization_id raises 23502', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".document
           (title, mime_type, storage_key, owner_id, owner_type)
         VALUES ($1,$2,$3,$4,$5)`,
        ['Policy', 'application/pdf', 'docs/policy.pdf', crypto.randomUUID(), 'person'],
      );
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('document_version: INSERT without organization_id raises 23502', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".document_version
           (document_id, version_number, file_name, uploaded_by)
         VALUES ($1,$2,$3,$4)`,
        [crypto.randomUUID(), 1, 'policy-v1.pdf', crypto.randomUUID()],
      );
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('document_tag: INSERT without organization_id raises 23502', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".document_tag (name) VALUES ($1)`,
        ['compliance'],
      );
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('document_access_log: INSERT without organization_id raises 23502', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".document_access_log
           (document_id, person_id, action)
         VALUES ($1,$2,$3)`,
        [crypto.randomUUID(), crypto.randomUUID(), 'view'],
      );
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('positive: each table accepts a valid organization_id and reads it back', async () => {
    if (!H.dbReachable) return;
    const org = seedOrg();

    // document
    const docId = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".document
         (id, organization_id, title, file_name, mime_type, storage_key, owner_id, owner_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [docId, org, 'Policy', 'policy.pdf', 'application/pdf', 'docs/policy.pdf', crypto.randomUUID(), 'person'],
    );

    // document_version
    const verId = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".document_version
         (id, organization_id, document_id, version_number, file_name, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [verId, org, docId, 1, 'policy-v1.pdf', crypto.randomUUID()],
    );

    // document_tag
    const tagId = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".document_tag (id, organization_id, name) VALUES ($1,$2,$3)`,
      [tagId, org, 'compliance'],
    );

    // document_access_log
    const logId = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".document_access_log
         (id, organization_id, document_id, person_id, action)
       VALUES ($1,$2,$3,$4,$5)`,
      [logId, org, docId, crypto.randomUUID(), 'view'],
    );

    for (const [table, id] of [
      ['document', docId],
      ['document_version', verId],
      ['document_tag', tagId],
      ['document_access_log', logId],
    ] as const) {
      const { rows } = await H.scopedPool.query(
        `SELECT organization_id FROM "${H.schema}".${table} WHERE id = $1`,
        [id],
      );
      expect(rows[0]?.organization_id).toBe(org);
    }
  });
});
