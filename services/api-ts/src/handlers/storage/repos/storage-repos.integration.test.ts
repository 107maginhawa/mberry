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
 * Pattern mirrors dues/repos/dues-repos.integration.test.ts: a per-run scratch
 * schema with hand-written DDL for ONLY the tables the exercised methods touch.
 * Enums modelled as `text`. Requires a reachable Postgres (DATABASE_URL or the
 * repo default); if unreachable the suite skips cleanly.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { StorageFileRepository } from './file.repo';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `storage_repos_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let setupPool: Pool;
let scopedPool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

// uuid NOT NULL columns need real UUIDs.
const ORG_A = '00000000-0000-4000-8000-00000000a001';
const ORG_B = '00000000-0000-4000-8000-00000000b001';
const OWNER_1 = '00000000-0000-4000-8000-00000000c001';
const OWNER_2 = '00000000-0000-4000-8000-00000000c002';

function freshId(): string {
  return crypto.randomUUID();
}

async function ddl(client: any) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await client.query(`SET search_path TO "${TEST_SCHEMA}", public`);

  const baseCols = `
    version integer NOT NULL DEFAULT 1,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()`;

  // stored_file — the only table this repo touches. status enum modelled as text.
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".stored_file (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      filename varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      size bigint NOT NULL,
      status text NOT NULL DEFAULT 'uploading',
      owner uuid NOT NULL,
      uploaded_at timestamptz DEFAULT now(),${baseCols}
    )
  `);
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
  } as any);
}

beforeAll(async () => {
  setupPool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await setupPool.connect();
    try {
      await ddl(client);
      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[storage-repos integration] Postgres unreachable, skipping: ${(err as Error).message}`);
    return;
  }

  scopedPool = new Pool({
    connectionString: DB_URL,
    options: `-c search_path="${TEST_SCHEMA}",public`,
    max: 4,
    connectionTimeoutMillis: 15000,
  });
  db = drizzle(scopedPool);
});

afterAll(async () => {
  if (dbReachable) {
    try {
      const client = await setupPool.connect();
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      } finally {
        client.release();
      }
    } catch {
      /* best-effort cleanup */
    }
  }
  if (scopedPool) await scopedPool.end();
  if (setupPool) await setupPool.end();
});

// ─── createOne + findOneById round-trip ───────────────────────────────────

describe('StorageFileRepository create/read (real DB)', () => {
  test('createOne persists the file and returns the full row', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
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
  });

  test('findOneById returns the row for a known id, null otherwise', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    const created = await makeFile(repo, { organizationId: ORG_A, owner: OWNER_1 });

    const found = await repo.findOneById(created.id);
    expect(found?.id).toBe(created.id);

    expect(await repo.findOneById(freshId())).toBeNull();
  });
});

// ─── Org-scoped read via findOne(filters) ─────────────────────────────────

describe('StorageFileRepository.findOne org scoping (real DB)', () => {
  test('findOne returns a file matching the org filter', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    const created = await makeFile(repo, {
      organizationId: ORG_A,
      owner: OWNER_1,
      filename: 'scoped.pdf',
    });

    // The base findOne uses buildWhereConditions; with no other rows guaranteed
    // unique, assert the org filter resolves to a row in ORG_A.
    const found = await repo.findOne({ organizationId: ORG_A, owner: OWNER_1, status: 'available' });
    expect(found).toBeTruthy();
    expect(found!.organizationId).toBe(ORG_A);

    // Confirm the specific file is reachable by combining owner+status into the scope.
    const list = await repo.findMany({ organizationId: ORG_A, owner: OWNER_1, status: 'available' });
    expect(list.some((f) => f.id === created.id)).toBe(true);
  });

  test('findOne with a non-matching status filter returns null', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    const uniqueOrg = freshId();
    await makeFile(repo, { organizationId: uniqueOrg, owner: OWNER_1, status: 'available' });

    // No 'failed' files exist for this fresh org → scoped lookup returns null.
    expect(await repo.findOne({ organizationId: uniqueOrg, status: 'failed' })).toBeNull();
  });
});

// ─── SECURITY: cross-org isolation (P0-7 / IDOR) ──────────────────────────

describe('StorageFileRepository cross-org isolation (real DB) [SECURITY]', () => {
  test('a file created under ORG_A is NOT returned by an ORG_B-scoped query', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
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
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
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
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
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
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    const created = await makeFile(repo, {
      organizationId: ORG_A,
      owner: OWNER_1,
      status: 'uploading',
    });
    expect(created.version).toBe(1);

    const updated = await repo.updateOneStatusById(created.id, 'available');
    expect(updated.status).toBe('available');
    expect(updated.version).toBe(2);

    // Re-read confirms persistence.
    const reread = await repo.findOneById(created.id);
    expect(reread?.status).toBe('available');
  });

  test('updateOneById throws NotFoundError for a missing id', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    await expect(repo.updateOneById(freshId(), { status: 'failed' } as any)).rejects.toThrow();
  });
});

// ─── Hard delete ──────────────────────────────────────────────────────────

describe('StorageFileRepository delete (real DB)', () => {
  test('deleteOneById removes the row', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    const created = await makeFile(repo, { organizationId: ORG_A, owner: OWNER_1 });
    expect(await repo.findOneById(created.id)).toBeTruthy();

    await repo.deleteOneById(created.id);
    expect(await repo.findOneById(created.id)).toBeNull();
  });

  test('deleting a file in ORG_A leaves ORG_B files untouched', async () => {
    if (!dbReachable) return;
    const repo = new StorageFileRepository(db as any);
    const orgA = freshId();
    const orgB = freshId();
    const a = await makeFile(repo, { organizationId: orgA, owner: OWNER_1 });
    const b = await makeFile(repo, { organizationId: orgB, owner: OWNER_2 });

    await repo.deleteOneById(a.id);
    expect(await repo.findOneById(a.id)).toBeNull();
    expect(await repo.findOneById(b.id)).toBeTruthy();
  });
});
