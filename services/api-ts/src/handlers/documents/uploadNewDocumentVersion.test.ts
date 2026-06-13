import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DocumentRepository, DocumentVersionRepository } from './repos/documents.repo';
import { uploadNewDocumentVersion } from './uploadNewDocumentVersion';
import { NotFoundError } from '@/core/errors';

const existingDoc = { id: 'doc-1', organizationId: 'tenant-1', title: 'Test Doc', status: 'published' };
const newVersion = { id: 'ver-2', documentId: 'doc-1', versionNumber: 2, fileName: 'v2.pdf', fileSize: 2048 };

describe('uploadNewDocumentVersion', () => {
  beforeEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentVersionRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => existingDoc,
      updateOneById: async () => existingDoc,
    });
    stubRepo(DocumentVersionRepository, {
      getLatestVersionNumber: async () => 1,
      createOne: async () => newVersion,
    });
  });

  afterEach(() => {
    restoreRepo(DocumentRepository);
    restoreRepo(DocumentVersionRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 with new version', async () => {
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.versionNumber).toBe(2);
  });

  test('throws NotFoundError when document not found', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { documentId: 'nonexistent' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    await expect(uploadNewDocumentVersion(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('[EF-M11-005] throws NotFoundError when document belongs to different org (IDOR)', async () => {
    restoreRepo(DocumentRepository);
    stubRepo(DocumentRepository, {
      findOneById: async () => ({ id: 'doc-1', organizationId: 'other-org', title: 'Stolen Doc', status: 'published' }),
    });
    // Caller's org is 'tenant-1' (default from makeCtx), document belongs to 'other-org'
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    await expect(uploadNewDocumentVersion(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('[EF-M11-005] allows upload when document belongs to same org', async () => {
    // existingDoc has organizationId: 'tenant-1' which matches makeCtx default
    const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' } });
    const res = await uploadNewDocumentVersion(ctx);
    expect(res.status).toBe(201);
  });

  // [AC-M11-006] Version History — drives the REAL handler (replaces the former
  // fake-green ac-m11.documents.test.ts simulation that asserted against a local
  // `uploadNewVersion` closure). Proves the handler itself computes the next
  // version number from the repo's latest and records the real uploader id.
  describe('[AC-M11-006] version numbering is handler-computed (not stubbed)', () => {
    test('next version number = repo latest + 1 (monotonic increment)', async () => {
      restoreRepo(DocumentVersionRepository);
      let createdWith: { versionNumber: number; uploadedBy: string } | undefined;
      stubRepo(DocumentVersionRepository, {
        // repo reports the document already has 4 versions
        getLatestVersionNumber: async () => 4,
        // echo back what the handler actually computed/passed
        createOne: async (input: any) => {
          createdWith = { versionNumber: input.versionNumber, uploadedBy: input.uploadedBy };
          return { id: 'ver-5', ...input };
        },
      });
      const ctx = makeCtx({
        user: { id: 'person-editor-99' } as any,
        _params: { documentId: 'doc-1' },
        _body: { fileName: 'v5.pdf', size: 4096, storageKey: 'uploads/v5.pdf' },
      });
      const res = await uploadNewDocumentVersion(ctx);
      expect(res.status).toBe(201);
      // The handler must derive 5 from latest(4)+1 — a hardcoded stub return can't prove this.
      expect(createdWith?.versionNumber).toBe(5);
      expect((res as any).body?.versionNumber).toBe(5);
    });

    test('first version of a fresh document is numbered 1', async () => {
      restoreRepo(DocumentVersionRepository);
      let createdVersion: number | undefined;
      stubRepo(DocumentVersionRepository, {
        getLatestVersionNumber: async () => 0, // no prior versions
        createOne: async (input: any) => {
          createdVersion = input.versionNumber;
          return { id: 'ver-1', ...input };
        },
      });
      const ctx = makeCtx({ _params: { documentId: 'doc-1' }, _body: { fileName: 'v1.pdf', size: 1024, storageKey: 'uploads/v1.pdf' } });
      await uploadNewDocumentVersion(ctx);
      expect(createdVersion).toBe(1);
    });

    test('records the acting uploader id on the new version (immutable provenance)', async () => {
      restoreRepo(DocumentVersionRepository);
      let recordedUploader: string | undefined;
      stubRepo(DocumentVersionRepository, {
        getLatestVersionNumber: async () => 1,
        createOne: async (input: any) => {
          recordedUploader = input.uploadedBy;
          return { id: 'ver-2', ...input };
        },
      });
      const ctx = makeCtx({
        user: { id: 'person-uploader-42' } as any,
        _params: { documentId: 'doc-1' },
        _body: { fileName: 'v2.pdf', size: 2048, storageKey: 'uploads/v2.pdf' },
      });
      await uploadNewDocumentVersion(ctx);
      expect(recordedUploader).toBe('person-uploader-42');
    });
  });
});
