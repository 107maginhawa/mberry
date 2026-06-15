/**
 * Auth enforcement tests for Storage module (P0-03 security fix).
 *
 * Tests ownership verification on completeFileUpload.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeStoredFile } from '@/test-utils/factories';
import { StorageFileRepository } from './repos/file.repo';
import { completeFileUpload } from './completeFileUpload';
import { ForbiddenError, UnauthorizedError } from '@/core/errors';

// ─── Shared Setup ───────────────────────────────────────

const ownedFile = fakeStoredFile({ owner: 'user-1', status: 'uploading' });
const otherFile = fakeStoredFile({ owner: 'other-user', id: 'file-other', status: 'uploading' });

const mockStorage = {
  verifyFileExists: async () => true,
  generateUploadUrl: async () => ({ url: '', expiresAt: new Date() }),
  generateDownloadUrl: async () => ({ url: '', expiresAt: new Date() }),
  deleteFile: async () => {},
};

function stubFileRepoWith(file: any) {
  stubRepo(StorageFileRepository, {
    findOneById: async () => file,
    updateOneStatusById: async (_id: string, status: string) => ({ ...file, status }),
  });
}

beforeEach(() => {
  restoreRepo(StorageFileRepository);
});

afterEach(() => {
  restoreRepo(StorageFileRepository);
});

// ─── P0-03: completeFileUpload ownership ────────────────

describe('P0-03: completeFileUpload ownership check', () => {
  test('succeeds when owner matches', async () => {
    stubFileRepoWith(ownedFile);
    const ctx = makeCtx({
      _params: { file: 'file-1' },
      storage: mockStorage,
    });
    const res = await completeFileUpload(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError when different user tries to complete', async () => {
    stubFileRepoWith(otherFile);
    const ctx = makeCtx({
      _params: { file: 'file-other' },
      storage: mockStorage,
    });
    await expect(completeFileUpload(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows admin to complete any upload', async () => {
    stubFileRepoWith(otherFile);
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin', twoFactorEnabled: true },
      _params: { file: 'file-other' },
      storage: mockStorage,
    });
    const res = await completeFileUpload(ctx);
    expect(res.status).toBe(200);
  });

  test('rejects unauthenticated request (fail-closed, not just middleware)', async () => {
    stubFileRepoWith(ownedFile);
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { file: 'file-1' },
      storage: mockStorage,
    });
    // P0-2: a falsy user must fail closed (401), not silently skip the ownership check.
    await expect(completeFileUpload(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
