/**
 * Real-PG lifecycle integration test for the storage handlers (workflow gap).
 *
 * The existing storage-handlers.test.ts drives each handler in isolation with a
 * fully mocked repo prototype — it proves the call shape but never persists a
 * `stored_file` row nor runs the real status transitions through SQL. This suite
 * fills the missing WORKFLOW: it drives the REAL handlers
 * (`uploadFile` → `completeFileUpload` → `getFileDownload`) against a faithful
 * `createScratch(['stored_file'])` table (LIKE public.stored_file INCLUDING ALL),
 * a REAL `StorageFileRepository`, and a FAKE in-memory `StorageProvider`.
 *
 * SCOPE: metadata-level lifecycle only. Bytes / MinIO PUT/GET are OUT OF SCOPE —
 * the fake provider only tracks which fileIds "exist" so we can exercise the
 * verify-success and verify-failure branches. Assertions read back the persisted
 * ROW (status + version) via H.scopedPool to prove the transitions executed
 * against Postgres, not a mocked single flip.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import type { StorageProvider } from '@/core/storage';
import { uploadFile } from './uploadFile';
import { completeFileUpload } from './completeFileUpload';
import { getFileDownload } from './getFileDownload';
import { BusinessLogicError, ForbiddenError } from '@/core/errors';

let H: ScratchDb;

const ORG_A = '00000000-0000-4000-8000-00000000a001';
const ORG_B = '00000000-0000-4000-8000-00000000a002';
const OWNER_1 = '00000000-0000-4000-8000-00000000c001';

const noopLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => noopLogger };

/**
 * In-memory fake StorageProvider — tracks which fileIds "exist" so the
 * verify-success / verify-failure branches of completeFileUpload can run.
 * Bytes/MinIO are intentionally NOT modelled (out of scope).
 */
function makeFakeStorage(existing: Set<string> = new Set()): StorageProvider {
  return {
    generateUploadUrl: async (fileId: string) => `https://fake.local/upload/${fileId}`,
    generateDownloadUrl: async (fileId: string) => `https://fake.local/download/${fileId}`,
    deleteFile: async (fileId: string) => { existing.delete(fileId); },
    verifyFileExists: async (fileId: string) => existing.has(fileId),
    initializeBucket: async () => {},
    healthCheck: async () => true,
  };
}

/** Thin ctx whose `database` is the scratch drizzle instance. */
function makeCtx(opts: {
  body?: unknown;
  params?: Record<string, string>;
  storage: StorageProvider;
  user?: { id: string; role?: string } | null;
  organizationId?: string;
}) {
  const user = opts.user !== undefined ? opts.user : { id: OWNER_1, role: 'user' };
  const organizationId = opts.organizationId ?? ORG_A;
  let captured: { data: unknown; status: number } = { data: null, status: 0 };

  const store: Record<string, unknown> = {
    storage: opts.storage,
    logger: noopLogger,
    requestId: 'test-trace',
    database: H.db,
    user,
    auth: {},
    organizationId,
  };

  return {
    get: (key: string) => store[key],
    req: {
      json: async () => opts.body,
      param: (key: string) => opts.params?.[key] ?? '',
      query: () => null,
      header: () => null,
    },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as never;
}

async function readRow(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT id, status, version, owner, organization_id FROM "${H.schema}".stored_file WHERE id = $1`,
    [id],
  );
  return rows[0] as
    | { id: string; status: string; version: number; owner: string; organization_id: string | null }
    | undefined;
}

beforeAll(async () => {
  H = await createScratch(['stored_file']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── Happy lifecycle: upload → complete → download ─────────────────────────

describe('storage lifecycle upload→complete→download (real DB)', () => {
  test('uploadFile persists a single uploading row with version=1', async () => {
    if (!H.dbReachable) return;
    const storage = makeFakeStorage();
    const ctx = makeCtx({
      storage,
      body: { filename: 'invoice.pdf', size: 4096, mimeType: 'application/pdf' },
    });

    const res = await uploadFile(ctx);
    expect(res.status).toBe(201);
    const { data, status } = (ctx as any)._captured();
    expect(status).toBe(201);
    const fileId = (data as { file: string }).file;
    expect(fileId).toBeTruthy();

    const row = await readRow(fileId);
    expect(row).toBeTruthy();
    expect(row!.status).toBe('uploading');
    expect(row!.version).toBe(1);
    expect(row!.owner).toBe(OWNER_1);
    expect(row!.organization_id).toBe(ORG_A);
  });

  test('completeFileUpload (verify→true) drives uploading→processing→available, version 1→3', async () => {
    if (!H.dbReachable) return;
    const storage = makeFakeStorage();
    const upCtx = makeCtx({
      storage,
      body: { filename: 'doc.pdf', size: 100, mimeType: 'application/pdf' },
    });
    await uploadFile(upCtx);
    const fileId = ((upCtx as any)._captured().data as { file: string }).file;

    // Re-create storage with the object marked present so verifyFileExists → true.
    const presentStorage = makeFakeStorage(new Set([fileId]));

    const before = await readRow(fileId);
    expect(before!.version).toBe(1);

    const compCtx = makeCtx({ storage: presentStorage, params: { file: fileId } });
    const res = await completeFileUpload(compCtx);
    expect(res.status).toBe(200);
    const { data } = (compCtx as any)._captured();
    expect((data as { status: string }).status).toBe('available');

    // TWO updateOneStatusById calls (uploading→processing, processing→available)
    // each bump version: 1 → 2 → 3. Proves both SQL transitions ran.
    const after = await readRow(fileId);
    expect(after!.status).toBe('available');
    expect(after!.version).toBe(3);
  });

  test('getFileDownload on an available row returns 200 + downloadUrl + available file', async () => {
    if (!H.dbReachable) return;
    const upStorage = makeFakeStorage();
    const upCtx = makeCtx({
      storage: upStorage,
      body: { filename: 'report.pdf', size: 200, mimeType: 'application/pdf' },
    });
    await uploadFile(upCtx);
    const fileId = ((upCtx as any)._captured().data as { file: string }).file;

    const storage = makeFakeStorage(new Set([fileId]));
    await completeFileUpload(makeCtx({ storage, params: { file: fileId } }));

    const dlCtx = makeCtx({ storage, params: { file: fileId } });
    const res = await getFileDownload(dlCtx);
    expect(res.status).toBe(200);
    const { data } = (dlCtx as any)._captured();
    const payload = data as { downloadUrl: string; file: { id: string; status: string } };
    expect(payload.downloadUrl).toBe(`https://fake.local/download/${fileId}`);
    expect(payload.file.id).toBe(fileId);
    expect(payload.file.status).toBe('available');
  });
});

// ─── Verify-failure branch ─────────────────────────────────────────────────

describe('storage lifecycle verify-failure (real DB)', () => {
  test('completeFileUpload (verify→false) throws UPLOAD_VERIFICATION_FAILED and persists status=failed', async () => {
    if (!H.dbReachable) return;
    // Empty storage → verifyFileExists returns false for everything.
    const storage = makeFakeStorage();
    const upCtx = makeCtx({
      storage,
      body: { filename: 'missing.pdf', size: 50, mimeType: 'application/pdf' },
    });
    await uploadFile(upCtx);
    const fileId = ((upCtx as any)._captured().data as { file: string }).file;

    const compCtx = makeCtx({ storage, params: { file: fileId } });
    let err: unknown;
    try {
      await completeFileUpload(compCtx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('UPLOAD_VERIFICATION_FAILED');

    // The failure path updates status to 'failed' against real PG (version 1→2).
    const row = await readRow(fileId);
    expect(row!.status).toBe('failed');
    expect(row!.version).toBe(2);
  });
});

// ─── Not-available download + tenant guard ─────────────────────────────────

describe('storage lifecycle access guards (real DB)', () => {
  test('getFileDownload while still uploading throws FILE_NOT_AVAILABLE', async () => {
    if (!H.dbReachable) return;
    const storage = makeFakeStorage();
    const upCtx = makeCtx({
      storage,
      body: { filename: 'pending.pdf', size: 10, mimeType: 'application/pdf' },
    });
    await uploadFile(upCtx);
    const fileId = ((upCtx as any)._captured().data as { file: string }).file;

    // Not completed → still 'uploading'.
    const dlCtx = makeCtx({ storage, params: { file: fileId } });
    let err: unknown;
    try {
      await getFileDownload(dlCtx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('FILE_NOT_AVAILABLE');
  });

  test('completeFileUpload from a foreign org is rejected (ForbiddenError) before owner check', async () => {
    if (!H.dbReachable) return;
    const storage = makeFakeStorage();
    // Upload as ORG_A / OWNER_1.
    const upCtx = makeCtx({
      storage,
      body: { filename: 'tenant.pdf', size: 10, mimeType: 'application/pdf' },
    });
    await uploadFile(upCtx);
    const fileId = ((upCtx as any)._captured().data as { file: string }).file;

    // Foreign-org caller who is even the SAME owner uuid → tenant guard fires first.
    const presentStorage = makeFakeStorage(new Set([fileId]));
    const foreignCtx = makeCtx({
      storage: presentStorage,
      params: { file: fileId },
      organizationId: ORG_B,
      user: { id: OWNER_1, role: 'user' },
    });
    await expect(completeFileUpload(foreignCtx)).rejects.toBeInstanceOf(ForbiddenError);

    // Row untouched — still uploading, version 1 (no failed/processing write happened).
    const row = await readRow(fileId);
    expect(row!.status).toBe('uploading');
    expect(row!.version).toBe(1);
  });

  test('getFileDownload from a foreign org is rejected (ForbiddenError)', async () => {
    if (!H.dbReachable) return;
    const upStorage = makeFakeStorage();
    const upCtx = makeCtx({
      storage: upStorage,
      body: { filename: 'tenant-dl.pdf', size: 10, mimeType: 'application/pdf' },
    });
    await uploadFile(upCtx);
    const fileId = ((upCtx as any)._captured().data as { file: string }).file;

    const storage = makeFakeStorage(new Set([fileId]));
    await completeFileUpload(makeCtx({ storage, params: { file: fileId } }));

    const foreignCtx = makeCtx({
      storage,
      params: { file: fileId },
      organizationId: ORG_B,
      user: { id: OWNER_1, role: 'user' },
    });
    await expect(getFileDownload(foreignCtx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
