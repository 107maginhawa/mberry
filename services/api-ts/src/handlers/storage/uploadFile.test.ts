/**
 * Tests for uploadFile handler
 *
 * Covers:
 * - Successful presigned-URL generation (returns 201 with upload metadata)
 * - File size over 50 MB → ValidationError
 * - Missing/invalid user → ValidationError
 * - Storage provider failure → cleanup of DB record + re-throw
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
import { uploadFile } from './uploadFile';
import { StorageFileRepository } from './repos/file.repo';
import { ValidationError } from '@/core/errors';

// Mock-Classification: APPROPRIATE — S3/MinIO external storage boundary
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

function makeBody(overrides: Record<string, any> = {}) {
  return {
    filename: 'photo.jpg',
    size: 1 * MB,
    mimeType: 'image/jpeg',
    ...overrides,
  };
}

function makeUser(overrides: Partial<{ id: string }> = {}) {
  return { id: 'user-1', role: 'user', ...overrides };
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  body?: Record<string, any>;
  user?: ReturnType<typeof makeUser> | null;
  storage?: any;
  logger?: any;
  organizationId?: string | null;
}) {
  const body = opts.body ?? makeBody();
  const user = opts.user !== undefined ? opts.user : makeUser();
  const logger = opts.logger ?? { debug: () => {}, info: () => {}, error: () => {} };
  // Storage uploads are tenant-scoped (P0-7 / migration 0081). Default to a real
  // org so the happy-path tests reach the repo; pass `null` to exercise the
  // missing-org guard.
  const organizationId = opts.organizationId !== undefined ? opts.organizationId : 'org-1';

  const defaultStorage = {
    generateUploadUrl: mock(async () => 'https://s3.example.com/upload/presigned'),
  };
  const storage = opts.storage ?? defaultStorage;

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        storage,
        logger,
        database: {},
        user,
        organizationId,
      };
      return store[key];
    },
    req: {
      json: mock(async () => body),
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

// ---------------------------------------------------------------------------
// Patch repo prototype
// ---------------------------------------------------------------------------

function patchRepo(overrides: {
  createOne?: ReturnType<typeof mock>;
  deleteOneById?: ReturnType<typeof mock>;
} = {}) {
  const createOne = overrides.createOne ?? mock(async () => ({}));
  const deleteOneById = overrides.deleteOneById ?? mock(async () => {});

  StorageFileRepository.prototype.createOne = createOne as any;
  StorageFileRepository.prototype.deleteOneById = deleteOneById as any;

  return { createOne, deleteOneById };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[BR-31] uploadFile', () => {
  beforeEach(() => {
    patchRepo();
  });

  test('returns 201 with presigned upload metadata on success', async () => {
    const { createOne } = patchRepo();
    const ctx = makeCtx({});
    await uploadFile(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(201);
    expect(data.uploadUrl).toBe('https://s3.example.com/upload/presigned');
    expect(data.uploadMethod).toBe('PUT');
    expect(data.file).toBeDefined();
    expect(data.expiresAt).toBeDefined();
    expect(createOne).toHaveBeenCalledTimes(1);
  });

  test('sets initial file status to "uploading"', async () => {
    const { createOne } = patchRepo();
    const ctx = makeCtx({});
    await uploadFile(ctx);

    const callArg = (createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.status).toBe('uploading');
  });

  test('sets file owner to authenticated user id', async () => {
    const { createOne } = patchRepo();
    const ctx = makeCtx({ user: makeUser({ id: 'user-abc' }) });
    await uploadFile(ctx);

    const callArg = (createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.owner).toBe('user-abc');
  });

  test('throws ValidationError when file size exceeds 50 MB', async () => {
    const ctx = makeCtx({ body: makeBody({ size: 51 * MB }) });
    await expect(uploadFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when user is missing id', async () => {
    const ctx = makeCtx({ user: { id: '' } as any });
    await expect(uploadFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when user is null', async () => {
    const ctx = makeCtx({ user: null });
    // user?.id is undefined which is falsy → ValidationError
    await expect(uploadFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError (no tenant-less upload) when org context is missing', async () => {
    // P0-7 / migration 0081: a non-member (or a request without x-org-id) reaches
    // the handler with no organizationId. The guard fails fast with a 400 instead
    // of a DB 23502 not-null violation, and NO row is ever attempted.
    const { createOne } = patchRepo();
    const ctx = makeCtx({ organizationId: null });
    await expect(uploadFile(ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(createOne).not.toHaveBeenCalled();
  });

  test('deletes DB record and re-throws when storage.generateUploadUrl fails', async () => {
    const failingStorage = {
      generateUploadUrl: mock(async () => { throw new Error('S3 unavailable'); }),
    };
    const { createOne, deleteOneById } = patchRepo();
    const ctx = makeCtx({ storage: failingStorage });

    await expect(uploadFile(ctx)).rejects.toThrow('S3 unavailable');
    expect(createOne).toHaveBeenCalledTimes(1);
    expect(deleteOneById).toHaveBeenCalledTimes(1);
  });

  test('does not call deleteOneById when DB record creation itself fails', async () => {
    const { createOne, deleteOneById } = patchRepo({
      createOne: mock(async () => { throw new Error('DB error'); }),
    });
    const ctx = makeCtx({});

    await expect(uploadFile(ctx)).rejects.toThrow('DB error');
    expect(deleteOneById).not.toHaveBeenCalled();
  });

  test('passes mimeType to storage.generateUploadUrl', async () => {
    const storage = {
      generateUploadUrl: mock(async () => 'https://example.com/url'),
    };
    patchRepo();
    const ctx = makeCtx({ body: makeBody({ mimeType: 'application/pdf' }), storage });
    await uploadFile(ctx);

    expect((storage.generateUploadUrl as ReturnType<typeof mock>).mock.calls[0][1]).toBe('application/pdf');
  });

  test('rejects SVG uploads — XSS vector without content sanitization', async () => {
    const ctx = makeCtx({ body: makeBody({ mimeType: 'image/svg+xml', filename: 'icon.svg' }) });
    await expect(uploadFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
