/**
 * Tests for storage handlers: getFile, getFileDownload, listFiles, deleteFile, completeFileUpload
 *
 * Covers per handler:
 * - Auth guard (ValidationError when user missing/invalid)
 * - Happy path
 * - Not-found where applicable
 * - Access control (owner vs admin vs forbidden)
 * - Edge cases (status checks, storage failures)
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { getFile } from './getFile';
import { getFileDownload } from './getFileDownload';
import { listFiles } from './listFiles';
import { deleteFile } from './deleteFile';
import { completeFileUpload } from './completeFileUpload';
import { StorageFileRepository } from './repos/file.repo';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from '@/core/errors';

// Mock-Classification: APPROPRIATE — S3/MinIO external storage boundary
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FILE_RECORD = {
  id: 'file-1',
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  status: 'available' as const,
  owner: 'user-1',
  organizationId: 'org-1',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

function makeUser(overrides: Partial<{ id: string; role: string }> = {}) {
  return { id: 'user-1', role: 'user', ...overrides };
}

function makeAdmin(overrides: Partial<{ id: string; role: string }> = {}) {
  return { id: 'admin-1', role: 'admin', ...overrides };
}

// ---------------------------------------------------------------------------
// Shared context builder (follows uploadFile.test.ts pattern)
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  user?: ReturnType<typeof makeUser> | null;
  params?: Record<string, string>;
  query?: Record<string, string>;
  storage?: any;
  auth?: any;
  audit?: any;
  logger?: any;
  organizationId?: string;
} = {}) {
  const user = opts.user !== undefined ? opts.user : makeUser();
  const logger = opts.logger ?? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
  const params = opts.params ?? { file: 'file-1' };
  const queryValues = opts.query ?? {};
  const organizationId = opts.organizationId ?? 'org-1';

  const defaultStorage = {
    generateDownloadUrl: mock(async () => 'https://s3.example.com/download/presigned'),
    deleteFile: mock(async () => {}),
    verifyFileExists: mock(async () => true),
  };
  const storage = opts.storage ?? defaultStorage;

  const auth = opts.auth ?? {};

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        storage,
        logger,
        database: {},
        user,
        auth,
        audit: opts.audit ?? null,
        organizationId,
      };
      return store[key];
    },
    req: {
      param: (key: string) => params[key] || '',
      query: (key?: string) => {
        if (key) return queryValues[key] ?? null;
        return { ...queryValues };
      },
      header: () => null,
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    body: (data: any, status: number) => {
      captured = { data, status };
      return new Response(null, { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

// ---------------------------------------------------------------------------
// Patch repo prototype (same pattern as uploadFile.test.ts)
// ---------------------------------------------------------------------------

function patchRepo(overrides: {
  findOneById?: ReturnType<typeof mock>;
  findManyWithPagination?: ReturnType<typeof mock>;
  deleteOneById?: ReturnType<typeof mock>;
  updateOneStatusById?: ReturnType<typeof mock>;
} = {}) {
  const findOneById = overrides.findOneById ?? mock(async () => ({ ...FILE_RECORD }));
  const findManyWithPagination = overrides.findManyWithPagination ?? mock(async () => ({
    data: [{ ...FILE_RECORD }],
    totalCount: 1,
  }));
  const deleteOneById = overrides.deleteOneById ?? mock(async () => {});
  const updateOneStatusById = overrides.updateOneStatusById ?? mock(async (_id: string, status: string) => ({
    ...FILE_RECORD,
    status,
  }));

  StorageFileRepository.prototype.findOneById = findOneById as any;
  StorageFileRepository.prototype.findManyWithPagination = findManyWithPagination as any;
  StorageFileRepository.prototype.deleteOneById = deleteOneById as any;
  StorageFileRepository.prototype.updateOneStatusById = updateOneStatusById as any;

  return { findOneById, findManyWithPagination, deleteOneById, updateOneStatusById };
}

// ═══════════════════════════════════════════════════════════════════════════
// getFile
// ═══════════════════════════════════════════════════════════════════════════

describe('getFile', () => {
  beforeEach(() => {
    patchRepo();
  });

  test('throws ValidationError when user has no id', async () => {
    const ctx = makeCtx({ user: { id: '', role: 'user' } as any });
    await expect(getFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws when user is null (auth guard)', async () => {
    const ctx = makeCtx({ user: null });
    await expect(getFile(ctx)).rejects.toThrow();
  });

  test('returns 200 with file metadata on success (owner)', async () => {
    patchRepo();
    const ctx = makeCtx({});
    await getFile(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('file-1');
    expect(data.filename).toBe('report.pdf');
  });

  test('includes downloadUrl when file is available', async () => {
    patchRepo();
    const ctx = makeCtx({});
    await getFile(ctx);

    const { data } = ctx._captured();
    expect(data.downloadUrl).toBe('https://s3.example.com/download/presigned');
    expect(data.downloadExpiresAt).toBeDefined();
    expect(data.downloadMethod).toBe('GET');
  });

  test('throws NotFoundError when file does not exist', async () => {
    patchRepo({ findOneById: mock(async () => null) });
    const ctx = makeCtx({});
    await expect(getFile(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not owner and not admin', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, owner: 'other-user' })) });
    const ctx = makeCtx({ user: makeUser() }); // role: 'user', not admin
    await expect(getFile(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows admin to access any file', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, owner: 'other-user' })) });
    const ctx = makeCtx({ user: makeAdmin() });
    await getFile(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
  });

  test('throws ValidationError when fileId is empty', async () => {
    const ctx = makeCtx({ params: { file: '' } });
    await expect(getFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('adds statusMessage when file is not available and download requested', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, status: 'uploading' })) });
    const ctx = makeCtx({});
    await getFile(ctx);

    const { data } = ctx._captured();
    expect(data.statusMessage).toContain('not available');
  });

  test('adds downloadError when storage.generateDownloadUrl fails', async () => {
    const failingStorage = {
      generateDownloadUrl: mock(async () => { throw new Error('S3 down'); }),
    };
    patchRepo();
    const ctx = makeCtx({ storage: failingStorage });
    await getFile(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.downloadError).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getFileDownload
// ═══════════════════════════════════════════════════════════════════════════

describe('getFileDownload', () => {
  beforeEach(() => {
    patchRepo();
  });

  test('throws ValidationError when user has no id', async () => {
    const ctx = makeCtx({ user: { id: '', role: 'user' } as any });
    await expect(getFileDownload(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws when user is null (auth guard)', async () => {
    const ctx = makeCtx({ user: null });
    await expect(getFileDownload(ctx)).rejects.toThrow();
  });

  test('returns 200 with download URL on success (owner)', async () => {
    patchRepo();
    const ctx = makeCtx({});
    await getFileDownload(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.downloadUrl).toBe('https://s3.example.com/download/presigned');
    expect(data.expiresAt).toBeDefined();
    expect(data.file).toBeDefined();
    expect(data.file.id).toBe('file-1');
  });

  test('throws NotFoundError when file does not exist', async () => {
    patchRepo({ findOneById: mock(async () => null) });
    const ctx = makeCtx({});
    await expect(getFileDownload(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not owner and not admin', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, owner: 'other-user' })) });
    const ctx = makeCtx({ user: makeUser() });
    await expect(getFileDownload(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows admin to download any file', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, owner: 'other-user' })) });
    const ctx = makeCtx({ user: makeAdmin() });
    await getFileDownload(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
  });

  test('throws BusinessLogicError when file is not available', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, status: 'uploading' })) });
    const ctx = makeCtx({});
    await expect(getFileDownload(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// listFiles
// ═══════════════════════════════════════════════════════════════════════════

describe('listFiles', () => {
  beforeEach(() => {
    patchRepo();
  });

  test('throws ValidationError when user has no id', async () => {
    const ctx = makeCtx({ user: { id: '', role: 'user' } as any });
    await expect(listFiles(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws when user is null (auth guard)', async () => {
    const ctx = makeCtx({ user: null });
    await expect(listFiles(ctx)).rejects.toThrow();
  });

  test('returns 200 with paginated file list on success', async () => {
    patchRepo();
    const ctx = makeCtx({});
    await listFiles(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data).toBeArray();
    expect(data.data.length).toBe(1);
    expect(data.pagination).toBeDefined();
  });

  test('scopes non-admin users to their own files', async () => {
    const { findManyWithPagination } = patchRepo();
    const ctx = makeCtx({ user: makeUser({ id: 'user-42' }) });
    await listFiles(ctx);

    const callArg = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.owner).toBe('user-42');
  });

  test('admin can list all files without owner filter', async () => {
    const { findManyWithPagination } = patchRepo();
    const ctx = makeCtx({ user: makeAdmin() });
    await listFiles(ctx);

    const callArg = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.owner).toBeUndefined();
  });

  test('includes organizationId in filters for multi-tenant scoping', async () => {
    const { findManyWithPagination } = patchRepo();
    const ctx = makeCtx({ organizationId: 'org-99' });
    await listFiles(ctx);

    const callArg = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.organizationId).toBe('org-99');
  });

  test('returns empty list when no files match', async () => {
    patchRepo({
      findManyWithPagination: mock(async () => ({ data: [], totalCount: 0 })),
    });
    const ctx = makeCtx({});
    await listFiles(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deleteFile
// ═══════════════════════════════════════════════════════════════════════════

describe('deleteFile', () => {
  beforeEach(() => {
    patchRepo();
  });

  test('throws ValidationError when user has no id', async () => {
    const ctx = makeCtx({ user: { id: '', role: 'user' } as any });
    await expect(deleteFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws when user is null (auth guard)', async () => {
    const ctx = makeCtx({ user: null });
    await expect(deleteFile(ctx)).rejects.toThrow();
  });

  test('returns 204 on successful deletion (owner)', async () => {
    const { deleteOneById } = patchRepo();
    const ctx = makeCtx({});
    await deleteFile(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(204);
    expect(deleteOneById).toHaveBeenCalledTimes(1);
  });

  test('throws NotFoundError when file does not exist', async () => {
    patchRepo({ findOneById: mock(async () => null) });
    const ctx = makeCtx({});
    await expect(deleteFile(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not owner and not admin', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, owner: 'other-user' })) });
    const ctx = makeCtx({ user: makeUser() });
    await expect(deleteFile(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows admin to delete any file', async () => {
    patchRepo({ findOneById: mock(async () => ({ ...FILE_RECORD, owner: 'other-user' })) });
    const ctx = makeCtx({ user: makeAdmin() });
    await deleteFile(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(204);
  });

  test('throws ValidationError when fileId is empty', async () => {
    const ctx = makeCtx({ params: { file: '' } });
    await expect(deleteFile(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('still deletes DB record when storage deletion fails', async () => {
    const failingStorage = {
      generateDownloadUrl: mock(async () => ''),
      deleteFile: mock(async () => { throw new Error('S3 unavailable'); }),
      verifyFileExists: mock(async () => true),
    };
    const { deleteOneById } = patchRepo();
    const ctx = makeCtx({ storage: failingStorage });
    await deleteFile(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(204);
    expect(deleteOneById).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// completeFileUpload
// ═══════════════════════════════════════════════════════════════════════════

describe('completeFileUpload', () => {
  beforeEach(() => {
    patchRepo();
  });

  test('returns 200 with updated file on success', async () => {
    patchRepo({
      findOneById: mock(async () => ({ ...FILE_RECORD, status: 'uploading' })),
    });
    const ctx = makeCtx({});
    await completeFileUpload(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('available');
  });

  test('throws NotFoundError when file does not exist', async () => {
    patchRepo({ findOneById: mock(async () => null) });
    const ctx = makeCtx({});
    await expect(completeFileUpload(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when file is not in uploading status', async () => {
    patchRepo({
      findOneById: mock(async () => ({ ...FILE_RECORD, status: 'available' })),
    });
    const ctx = makeCtx({});
    await expect(completeFileUpload(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws BusinessLogicError when file not found in storage', async () => {
    const storage = {
      generateDownloadUrl: mock(async () => ''),
      deleteFile: mock(async () => {}),
      verifyFileExists: mock(async () => false),
    };
    const { updateOneStatusById } = patchRepo({
      findOneById: mock(async () => ({ ...FILE_RECORD, status: 'uploading' })),
    });
    const ctx = makeCtx({ storage });
    await expect(completeFileUpload(ctx)).rejects.toBeInstanceOf(BusinessLogicError);

    // Should have updated status to 'failed'
    expect(updateOneStatusById).toHaveBeenCalledTimes(1);
    const callArgs = (updateOneStatusById as ReturnType<typeof mock>).mock.calls[0] as any[];
    expect(callArgs[0]).toBe('file-1');
    expect(callArgs[1]).toBe('failed');
  });

  test('transitions through processing to available', async () => {
    const { updateOneStatusById } = patchRepo({
      findOneById: mock(async () => ({ ...FILE_RECORD, status: 'uploading' })),
    });
    const ctx = makeCtx({});
    await completeFileUpload(ctx);

    // Called twice: once for 'processing', once for 'available'
    expect(updateOneStatusById).toHaveBeenCalledTimes(2);
    const calls = (updateOneStatusById as ReturnType<typeof mock>).mock.calls;
    expect(calls[0][1]).toBe('processing');
    expect(calls[1][1]).toBe('available');
  });
});
