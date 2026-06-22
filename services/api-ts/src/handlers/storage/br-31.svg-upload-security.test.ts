// Business Rules: [BR-31]
/**
 * [BR-31] SVG Upload Security — REAL production control tests.
 *
 * BR-31 design is BLOCK, not sanitize. There is NO SVG sanitizer in
 * production `src/` — the previous version of this file defined inline
 * `sanitizeSvg`/`removeScriptTags`/… helpers and asserted against THEM,
 * which made the suite green-but-vacuous (it tested test code, not prod).
 *
 * The load-bearing prod XSS controls are:
 *   1. storage upload MIME allowlist — `uploadFile.ts` ALLOWED_MIME_TYPES
 *      deliberately excludes `image/svg+xml`, rejecting it with a
 *      ValidationError BEFORE any DB write.
 *   2. documents path — `isBlockedDocumentFile()` (`@/utils/sanitize`)
 *      blocks `image/svg+xml` MIME and `.svg`/`.svgz` extensions.
 *
 * This suite points assertions at those REAL controls.
 */

import { describe, test, expect, mock } from 'bun:test';
import { uploadFile } from './uploadFile';
import { StorageFileRepository } from './repos/file.repo';
import { isBlockedDocumentFile } from '@/utils/sanitize';
import { ValidationError } from '@/core/errors';

// ---------------------------------------------------------------------------
// ctx builder — mirrors uploadFile.test.ts so we drive the REAL handler
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

function makeCtx(opts: { body: Record<string, unknown> }) {
  const storage = {
    generateUploadUrl: mock(async () => 'https://s3.example.com/upload/presigned'),
  };
  const logger = { debug: () => {}, info: () => {}, error: () => {}, child: () => logger };

  let captured: { data: unknown; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, unknown> = {
        storage,
        logger,
        database: {},
        user: { id: 'user-1' },
        organizationId: 'org-1',
        requestId: 'req-1',
      };
      return store[key];
    },
    req: { json: mock(async () => opts.body) },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as never as Parameters<typeof uploadFile>[0] & { _captured: () => typeof captured };
}

// ---------------------------------------------------------------------------
// [BR-31] documents path — isBlockedDocumentFile real allow/deny boundary
// ---------------------------------------------------------------------------

describe('[BR-31] isBlockedDocumentFile — REAL document-upload block control', () => {
  test('[BR-31] blocks .svg with image/svg+xml mime', () => {
    expect(isBlockedDocumentFile('icon.svg', 'image/svg+xml')).toBe(true);
  });

  test('[BR-31] blocks .svgz on extension alone (no mime)', () => {
    expect(isBlockedDocumentFile('logo.svgz')).toBe(true);
  });

  test('[BR-31] blocks bare image/svg+xml mime even with a non-svg filename', () => {
    expect(isBlockedDocumentFile('tricky.png', 'image/svg+xml')).toBe(true);
  });

  test('[BR-31] allows png', () => {
    expect(isBlockedDocumentFile('photo.png', 'image/png')).toBe(false);
  });

  test('[BR-31] allows jpeg', () => {
    expect(isBlockedDocumentFile('photo.jpg', 'image/jpeg')).toBe(false);
  });

  test('[BR-31] allows pdf', () => {
    expect(isBlockedDocumentFile('report.pdf', 'application/pdf')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// [BR-31] storage path — uploadFile MIME allowlist rejects SVG before DB write
// ---------------------------------------------------------------------------

describe('[BR-31] uploadFile MIME allowlist — REAL storage block control', () => {
  test('[BR-31] rejects image/svg+xml with ValidationError BEFORE any DB write', async () => {
    const createOne = mock(async () => ({}));
    StorageFileRepository.prototype.createOne = createOne as never;

    const ctx = makeCtx({
      body: { filename: 'icon.svg', size: 1 * MB, mimeType: 'image/svg+xml' },
    });

    await expect(uploadFile(ctx)).rejects.toThrow(
      "File type 'image/svg+xml' is not allowed",
    );
    await expect(
      uploadFile(makeCtx({ body: { filename: 'icon.svg', size: 1 * MB, mimeType: 'image/svg+xml' } })),
    ).rejects.toBeInstanceOf(ValidationError);

    // The allowlist gate fires before repo.createOne — no row is ever attempted.
    expect(createOne).not.toHaveBeenCalled();
  });

  test('[BR-31] positive: image/png passes the MIME allowlist gate (reaches DB write)', async () => {
    const createOne = mock(async () => ({}));
    StorageFileRepository.prototype.createOne = createOne as never;

    const ctx = makeCtx({
      body: { filename: 'photo.png', size: 1 * MB, mimeType: 'image/png' },
    });

    const res = await uploadFile(ctx);
    expect(res.status).toBe(201);
    // png is allowed → the handler proceeded past the gate and wrote the row.
    expect(createOne).toHaveBeenCalledTimes(1);
  });
});
