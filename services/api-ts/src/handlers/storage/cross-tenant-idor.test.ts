/**
 * Cross-tenant IDOR tests for the Storage module (audit P0-1).
 *
 * The single-file handlers (completeFileUpload / getFileDownload / deleteFile)
 * resolve a file by UUID and check owner-or-admin, but did NOT verify the file
 * belongs to the caller's organization. An admin in org A could therefore
 * finalize / download / delete a file belonging to org B by guessing its UUID.
 *
 * These assert the org (tenant) boundary is enforced BEFORE owner/admin — so
 * even an org admin is rejected for a foreign-org file.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeStoredFile } from '@/test-utils/factories';
import { StorageFileRepository } from './repos/file.repo';
import { completeFileUpload } from './completeFileUpload';
import { getFileDownload } from './getFileDownload';
import { deleteFile } from './deleteFile';
import { ForbiddenError } from '@/core/errors';

const mockStorage = {
  verifyFileExists: async () => true,
  generateUploadUrl: async () => ({ url: '', expiresAt: new Date() }),
  generateDownloadUrl: async () => 'https://s3.example.com/download/presigned',
  deleteFile: async () => {},
};

// Caller is in 'tenant-1' (shared makeCtx default); the file lives in 'evil-org'.
const foreignUploading = fakeStoredFile({ organizationId: 'evil-org', owner: 'other-user', id: 'file-foreign', status: 'uploading' });
const foreignAvailable = fakeStoredFile({ organizationId: 'evil-org', owner: 'other-user', id: 'file-foreign', status: 'available' });

const ADMIN = { id: 'admin-1', role: 'admin', twoFactorEnabled: true };

afterEach(() => restoreRepo(StorageFileRepository));

describe('P0-1: storage cross-tenant IDOR', () => {
  test('completeFileUpload rejects a foreign-org file even for an admin', async () => {
    stubRepo(StorageFileRepository, {
      findOneById: async () => foreignUploading,
      updateOneStatusById: async (_id: string, status: string) => ({ ...foreignUploading, status }),
    });
    const ctx = makeCtx({ user: ADMIN, _params: { file: 'file-foreign' }, storage: mockStorage });
    await expect(completeFileUpload(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('getFileDownload rejects a foreign-org file even for an admin', async () => {
    stubRepo(StorageFileRepository, { findOneById: async () => foreignAvailable });
    const ctx = makeCtx({ user: ADMIN, _params: { file: 'file-foreign' }, storage: mockStorage });
    await expect(getFileDownload(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('deleteFile rejects a foreign-org file even for an admin', async () => {
    stubRepo(StorageFileRepository, {
      findOneById: async () => foreignAvailable,
      deleteOneById: async () => {},
    });
    const ctx = makeCtx({ user: ADMIN, _params: { file: 'file-foreign' }, storage: mockStorage });
    await expect(deleteFile(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('same-org admin is still allowed (boundary is org, not role)', async () => {
    const sameOrg = fakeStoredFile({ organizationId: 'tenant-1', owner: 'other-user', id: 'file-same', status: 'uploading' });
    stubRepo(StorageFileRepository, {
      findOneById: async () => sameOrg,
      updateOneStatusById: async (_id: string, status: string) => ({ ...sameOrg, status }),
    });
    const ctx = makeCtx({ user: ADMIN, _params: { file: 'file-same' }, storage: mockStorage });
    const res = await completeFileUpload(ctx);
    expect(res.status).toBe(200);
  });
});
