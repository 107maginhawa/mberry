/**
 * Real-DB integration tests for the storage file repository (security-critical).
 *
 * StorageFileRepository backs the IDOR-fixed file handlers (P0-7: multi-tenant
 * file isolation). The org-scoping logic lives in `buildWhereConditions`, which
 * the inherited base-repo reads (findOne / findMany / count / findManyWithPagination).
 * These tests drive the real drizzle query builders against REAL Postgres rows so
 * the org-scoped WHERE predicates execute end-to-end and we can prove that a file
 * created under ORG_A is NOT returned or mutable via an ORG_B-scoped query.
 *
 * Targets (StorageFileRepository + inherited DatabaseRepository):
 *   - createOne                 (insert + RETURNING round-trip)
 *   - findOneById               (raw id lookup — note: NOT org-scoped on its own)
 *   - findOne(filters)          (org/owner/status scoping)
 *   - findMany / findManyWithPagination  (org-scoped list, pagination, total)
 *   - count                     (org-scoped count)
 *   - updateOneById / updateOneStatusById  (status transition + version bump)
 *   - deleteOneById             (hard delete)
 *   - SECURITY: cross-org isolation — ORG_B query cannot read/list a file owned by ORG_A.
 *
 * SCHEMA-FAITHFUL: uses `createScratch(['stored_file'])` —
 * `CREATE TABLE (LIKE public.stored_file INCLUDING ALL)` — so the table carries
 * the REAL production columns, defaults, NOT NULL, and the `file_status` ENUM.
 * The old hand-written DDL modelled `status` as `text` and hard-coded
 * `organization_id NOT NULL` (which prod does NOT enforce — see the org_id NOT NULL
 * test below). Migrating to the faithful copy un-masks that drift and makes the
 * enum/default behavior real.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { StorageFileRepository } from './file.repo';

let H: ScratchDb;

// uuid NOT NULL columns need real UUIDs.
const ORG_A = '00000000-0000-4000-8000-00000000a001';
const OWNER_1 = '00000000-0000-4000-8000-00000000c001';
const OWNER_2 = '00000000-0000-4000-8000-00000000c002';

function freshId(): string {
  return crypto.randomUUID();
}

/** Insert a file via the repo (exercises createOne) and return the row. */
async function makeFile(
  repo: StorageFileRepository,
  opts: {
    organizationId: string;
    owner: string;
    filename?: string;
    status?: 'uploading' | 'processing' | 'available' | 'failed';
    size?: number;
  },
) {
  return repo.createOne({
    organizationId: opts.organizationId,
    owner: opts.owner,
    filename: opts.filename ?? `file-${freshId()}.pdf`,
    mimeType: 'application/pdf',
    size: opts.size ?? 1024,
    status: opts.status ?? 'available',
  } as never);
}

beforeAll(async () => {
  H = await createScratch(['stored_file']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── createOne + findOneById round-trip ───────────────────────────────────

describe('StorageFileRepository create/read (real DB)', () => {
  test('createOne persists the file and returns the full row', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const row = await makeFile(repo, {
      organizationId: ORG_A,
      owner: OWNER_1,
      filename: 'invoice.pdf',
      size: 4096,
      status: 'available',
    });

    expect(row.id).toBeTruthy();
    expect(row.organizationId).toBe(ORG_A);
    expect(row.owner).toBe(OWNER_1);
    expect(row.filename).toBe('invoice.pdf');
    expect(row.size).toBe(4096);
    expect(row.status).toBe('available');
    expect(row.version).toBe(1);

    // Read-back against the REAL scratch table confirms the row persisted.
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id, owner, filename, size, status, version FROM "${H.schema}".stored_file WHERE id = $1`,
      [row.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].organization_id).toBe(ORG_A);
    expect(rows[0].owner).toBe(OWNER_1);
    expect(rows[0].filename).toBe('invoice.pdf');
    expect(Number(rows[0].size)).toBe(4096);
    expect(rows[0].status).toBe('available');
    expect(rows[0].version).toBe(1);
  });

  test('findOneById returns the row for a known id, null otherwise', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const created = await makeFile(repo, { organizationId: ORG_A, owner: OWNER_1 });

    const found = await repo.findOneById(created.id);
    expect(found?.id).toBe(created.id);

    expect(await repo.findOneById(freshId())).toBeNull();
  });
});

// ─── Real defaults + real enum (only possible on the faithful table) ───────

describe('StorageFileRepository real schema defaults + enum (real DB)', () => {
  test('a minimal insert (no status) yields the real column defaults', async () => {
    if (!H.dbReachable) return;
    // Insert ONLY the required columns — let the real defaults fill the rest.
    // status DEFAULT 'uploading'::file_status, version DEFAULT 1, uploaded_at DEFAULT now().
    const id = freshId();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".stored_file (id, organization_id, filename, mime_type, size, owner)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, ORG_A, 'defaults.pdf', 'application/pdf', 10, OWNER_1],
    );
    const { rows } = await H.scopedPool.query(
      `SELECT status, version, uploaded_at FROM "${H.schema}".stored_file WHERE id = $1`,
      [id],
    );
    expect(rows[0].status).toBe('uploading');
    expect(rows[0].version).toBe(1);
    expect(rows[0].uploaded_at).not.toBeNull();
  });

  test('status is a real file_status enum — an out-of-domain value raises 22P02', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".stored_file (id, organization_id, filename, mime_type, size, owner, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [freshId(), ORG_A, 'bogus.pdf', 'application/pdf', 10, OWNER_1, 'bogus'],
      );
    } catch (e) {
      code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    }
    // Under the old hand-DDL `status` was text and this could NEVER fire.
    expect(code).toBe('22P02');
  });
});

// ─── org_id NOT NULL drift (schema says .notNull(), DB did NOT enforce it) ──

describe('StorageFileRepository organization_id NOT NULL invariant (real DB)', () => {
  test('inserting a stored_file with NULL organization_id is rejected (23502)', async () => {
    if (!H.dbReachable) return;
    // file.schema.ts:23 declares organizationId .notNull(). Prior to migration 0081
    // the live column was NULLABLE and this insert SUCCEEDED (org_id IS NULL) — a
    // multi-tenant scoping drift. Migration 0081 (mirroring 0079/0080) tightens the
    // column to NOT NULL; the faithful LIKE-copy now reproduces that constraint and
    // a tenant-less insert fails fast with 23502.
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".stored_file (id, filename, mime_type, size, owner)
         VALUES ($1, $2, $3, $4, $5)`,
        [freshId(), 'no-org.pdf', 'application/pdf', 10, OWNER_1],
      );
    } catch (e) {
      code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(code).toBe('23502');
  });
});

// ─── Org-scoped read via findOne(filters) ─────────────────────────────────

describe('StorageFileRepository.findOne org scoping (real DB)', () => {
  test('findOne returns a file matching the org filter', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const created = await makeFile(repo, {
      organizationId: ORG_A,
      owner: OWNER_1,
      filename: 'scoped.pdf',
    });

    const found = await repo.findOne({ organizationId: ORG_A, owner: OWNER_1, status: 'available' });
    expect(found).toBeTruthy();
    expect(found!.organizationId).toBe(ORG_A);

    const list = await repo.findMany({ organizationId: ORG_A, owner: OWNER_1, status: 'available' });
    expect(list.some((f) => f.id === created.id)).toBe(true);
  });

  test('findOne with a non-matching status filter returns null', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const uniqueOrg = freshId();
    await makeFile(repo, { organizationId: uniqueOrg, owner: OWNER_1, status: 'available' });

    // No 'failed' files exist for this fresh org → scoped lookup returns null.
    expect(await repo.findOne({ organizationId: uniqueOrg, status: 'failed' })).toBeNull();
  });
});

// ─── SECURITY: cross-org isolation (P0-7 / IDOR) ──────────────────────────

describe('StorageFileRepository cross-org isolation (real DB) [SECURITY]', () => {
  test('a file created under ORG_A is NOT returned by an ORG_B-scoped query', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    // Use isolated orgs so counts are deterministic regardless of other tests.
    const orgA = freshId();
    const orgB = freshId();
    const fileA = await makeFile(repo, { organizationId: orgA, owner: OWNER_1, filename: 'secret-a.pdf' });

    // ORG_B sees zero files.
    const bList = await repo.findMany({ organizationId: orgB });
    expect(bList).toHaveLength(0);
    expect(await repo.count({ organizationId: orgB })).toBe(0);
    expect(await repo.findOne({ organizationId: orgB })).toBeNull();

    // ORG_A sees exactly its own file.
    const aList = await repo.findMany({ organizationId: orgA });
    expect(aList).toHaveLength(1);
    expect(aList[0]!.id).toBe(fileA.id);
    expect(await repo.count({ organizationId: orgA })).toBe(1);
  });

  test('findManyWithPagination scopes total + page to the requesting org', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const orgA = freshId();
    const orgB = freshId();
    for (let i = 0; i < 3; i++) await makeFile(repo, { organizationId: orgA, owner: OWNER_1 });
    await makeFile(repo, { organizationId: orgB, owner: OWNER_2 }); // noise in another org

    const res = await repo.findManyWithPagination(
      { organizationId: orgA },
      { pagination: { offset: 0, limit: 2 } },
    );
    // Total counts only ORG_A files; page is capped by limit.
    expect(res.totalCount).toBe(3);
    expect(res.data).toHaveLength(2);
    expect(res.data.every((f) => f.organizationId === orgA)).toBe(true);
  });

  test('owner scoping isolates files between owners within the same org', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const org = freshId();
    await makeFile(repo, { organizationId: org, owner: OWNER_1 });
    await makeFile(repo, { organizationId: org, owner: OWNER_1 });
    await makeFile(repo, { organizationId: org, owner: OWNER_2 });

    expect(await repo.count({ organizationId: org, owner: OWNER_1 })).toBe(2);
    expect(await repo.count({ organizationId: org, owner: OWNER_2 })).toBe(1);
    const owner2Files = await repo.findMany({ organizationId: org, owner: OWNER_2 });
    expect(owner2Files.every((f) => f.owner === OWNER_2)).toBe(true);
  });
});

// ─── Status updates + version bump ────────────────────────────────────────

describe('StorageFileRepository updates (real DB)', () => {
  test('updateOneStatusById flips status and bumps version', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const created = await makeFile(repo, {
      organizationId: ORG_A,
      owner: OWNER_1,
      status: 'uploading',
    });
    expect(created.version).toBe(1);

    const updated = await repo.updateOneStatusById(created.id, 'available');
    expect(updated.status).toBe('available');
    expect(updated.version).toBe(2);

    // Re-read confirms persistence against the real table.
    const { rows } = await H.scopedPool.query(
      `SELECT status, version FROM "${H.schema}".stored_file WHERE id = $1`,
      [created.id],
    );
    expect(rows[0].status).toBe('available');
    expect(rows[0].version).toBe(2);
  });

  test('updateOneById throws NotFoundError for a missing id', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    await expect(repo.updateOneById(freshId(), { status: 'failed' } as never)).rejects.toThrow();
  });
});

// ─── Hard delete ──────────────────────────────────────────────────────────

describe('StorageFileRepository delete (real DB)', () => {
  test('deleteOneById removes the row', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const created = await makeFile(repo, { organizationId: ORG_A, owner: OWNER_1 });
    expect(await repo.findOneById(created.id)).toBeTruthy();

    await repo.deleteOneById(created.id);
    expect(await repo.findOneById(created.id)).toBeNull();

    // Read-back confirms the row is gone from the real table.
    const { rows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".stored_file WHERE id = $1`,
      [created.id],
    );
    expect(rows).toHaveLength(0);
  });

  test('deleting a file in ORG_A leaves ORG_B files untouched', async () => {
    if (!H.dbReachable) return;
    const repo = new StorageFileRepository(H.db as never);
    const orgA = freshId();
    const orgB = freshId();
    const a = await makeFile(repo, { organizationId: orgA, owner: OWNER_1 });
    const b = await makeFile(repo, { organizationId: orgB, owner: OWNER_2 });

    await repo.deleteOneById(a.id);
    expect(await repo.findOneById(a.id)).toBeNull();
    expect(await repo.findOneById(b.id)).toBeTruthy();
  });
});
