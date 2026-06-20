/**
 * Tests for the file-upload orchestration flow.
 *
 * The flow imports three generated SDK functions and global fetch.
 * We use mock.module() to replace the generated module at the module level
 * so that all subsequent imports (including the flow itself) see the mocks.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

// -------------------------------------------------------------------
// Module-level mocks — must be declared before the subject import
// -------------------------------------------------------------------

const mockUploadFile = mock(async (_opts: unknown) => ({
  data: {
    file: 'file-uuid-123',
    uploadUrl: 'https://s3.example.com/presigned-upload',
    uploadMethod: 'PUT' as const,
    expiresAt: new Date('2030-01-01'),
  },
}));

const mockCompleteFileUpload = mock(async (_opts: unknown) => ({ data: {} }));

const mockGetFileDownload = mock(async (_opts: unknown) => ({
  data: {
    downloadUrl: 'https://s3.example.com/presigned-download',
    expiresAt: new Date('2030-01-01'),
    file: {
      id: 'file-uuid-123',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      filename: 'test.txt',
      mimeType: 'text/plain',
      size: BigInt(100),
    },
  },
}));

mock.module('../generated/sdk.gen', () => ({
  uploadFile: mockUploadFile,
  completeFileUpload: mockCompleteFileUpload,
  getFileDownload: mockGetFileDownload,
}));

// S3 fetch mock — replaces globalThis.fetch for the PUT call
const mockFetch = mock(async (_url: unknown, _init?: unknown) =>
  new Response(null, { status: 200, statusText: 'OK' }),
);

// Store original fetch to restore between tests
const originalFetch = globalThis.fetch;

// -------------------------------------------------------------------
// Subject under test (imported after mocks are in place)
// -------------------------------------------------------------------

import { uploadFile, FileTooLargeError, S3UploadError } from './file-upload';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function makeFile(name: string, size: number, type = 'text/plain'): File {
  // Bun's File constructor accepts content, name, options
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('uploadFile', () => {
  beforeEach(() => {
    mockUploadFile.mockClear();
    mockCompleteFileUpload.mockClear();
    mockGetFileDownload.mockClear();
    mockFetch.mockClear();

    // Reset to successful S3 response
    mockFetch.mockImplementation(async (_url: unknown, _init?: unknown) =>
      new Response(null, { status: 200, statusText: 'OK' }),
    );

    // Install mock fetch globally
    (globalThis as Record<string, unknown>).fetch = mockFetch;
  });

  // Restore real fetch after each describe block
  // (bun:test doesn't have afterAll per-describe but afterEach works here)
  // We'll restore in a final explicit test; in practice each test installs its own.

  test('rejects file that exceeds default 50 MB limit', async () => {
    const bigFile = makeFile('big.bin', 51 * 1024 * 1024);
    await expect(uploadFile(bigFile)).rejects.toBeInstanceOf(FileTooLargeError);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  test('rejects file that exceeds custom maxBytes', async () => {
    const file = makeFile('medium.txt', 2000);
    await expect(uploadFile(file, { maxBytes: 1000 })).rejects.toBeInstanceOf(FileTooLargeError);
  });

  test('FileTooLargeError carries the limit in bytes', async () => {
    const limit = 1024;
    const file = makeFile('large.txt', 2048);
    try {
      await uploadFile(file, { maxBytes: limit });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(FileTooLargeError);
      expect((err as FileTooLargeError).limitBytes).toBe(limit);
    }
  });

  test('calls presign → PUT → complete → download in order', async () => {
    const calls: string[] = [];

    mockUploadFile.mockImplementation(async (_opts: unknown) => {
      calls.push('presign');
      return {
        data: {
          file: 'file-uuid-123',
          uploadUrl: 'https://s3.example.com/presigned-upload',
          uploadMethod: 'PUT' as const,
          expiresAt: new Date('2030-01-01'),
        },
      };
    });

    mockFetch.mockImplementation(async (_url: unknown, _init?: unknown) => {
      calls.push('s3-put');
      return new Response(null, { status: 200 });
    });

    mockCompleteFileUpload.mockImplementation(async (_opts: unknown) => {
      calls.push('complete');
      return { data: {} };
    });

    mockGetFileDownload.mockImplementation(async (_opts: unknown) => {
      calls.push('download');
      return {
        data: {
          downloadUrl: 'https://s3.example.com/presigned-download',
          expiresAt: new Date('2030-01-01'),
          file: { id: 'file-uuid-123', version: 1, createdAt: new Date(), updatedAt: new Date() },
        },
      };
    });

    const file = makeFile('test.txt', 100);
    await uploadFile(file);

    expect(calls).toEqual(['presign', 's3-put', 'complete', 'download']);
  });

  test('returns fileId, downloadUrl, and expiresAt on success', async () => {
    const expiresAt = new Date('2030-06-01');
    mockGetFileDownload.mockImplementation(async (_opts: unknown) => ({
      data: {
        downloadUrl: 'https://cdn.example.com/file',
        expiresAt,
        file: { id: 'returned-id', version: 1, createdAt: new Date(), updatedAt: new Date() },
      },
    }));

    const file = makeFile('photo.jpg', 500, 'image/jpeg');
    const result = await uploadFile(file);

    expect(result.fileId).toBe('returned-id');
    expect(result.downloadUrl).toBe('https://cdn.example.com/file');
    expect(result.expiresAt).toBe(expiresAt);
  });

  test('passes file metadata (name, size, mimeType) to presign step', async () => {
    const file = makeFile('report.pdf', 1024, 'application/pdf');
    await uploadFile(file);

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    const callArgs = mockUploadFile.mock.calls[0][0] as {
      body: { filename: string; size: bigint; mimeType: string };
    };
    expect(callArgs.body.filename).toBe('report.pdf');
    expect(callArgs.body.mimeType).toBe('application/pdf');
    // size must be a plain number, NOT a BigInt: the SDK's jsonBodySerializer
    // stringifies BigInt → the backend validator rejects size as a string (400).
    // Regression guard for the BigInt-stringify upload trap.
    expect(callArgs.body.size).toBe(1024);
    expect(typeof callArgs.body.size).toBe('number');
  });

  test('throws S3UploadError when PUT returns non-2xx', async () => {
    mockFetch.mockImplementation(async (_url: unknown, _init?: unknown) =>
      new Response(null, { status: 403, statusText: 'Forbidden' }),
    );

    const file = makeFile('test.txt', 100);
    await expect(uploadFile(file)).rejects.toBeInstanceOf(S3UploadError);
  });

  test('S3UploadError carries status and statusText', async () => {
    mockFetch.mockImplementation(async (_url: unknown, _init?: unknown) =>
      new Response(null, { status: 503, statusText: 'Service Unavailable' }),
    );

    const file = makeFile('test.txt', 100);
    try {
      await uploadFile(file);
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(S3UploadError);
      expect((err as S3UploadError).status).toBe(503);
      expect((err as S3UploadError).statusText).toBe('Service Unavailable');
    }
  });

  test('does not call complete or download when S3 PUT fails', async () => {
    mockFetch.mockImplementation(async (_url: unknown, _init?: unknown) =>
      new Response(null, { status: 500 }),
    );

    const file = makeFile('test.txt', 100);
    await expect(uploadFile(file)).rejects.toBeInstanceOf(S3UploadError);
    expect(mockCompleteFileUpload).not.toHaveBeenCalled();
    expect(mockGetFileDownload).not.toHaveBeenCalled();
  });

  test('calls onProgress callbacks at expected milestones', async () => {
    const progressValues: number[] = [];
    const file = makeFile('test.txt', 100);

    await uploadFile(file, { onProgress: (p) => progressValues.push(p) });

    // The flow calls onProgress at 10, 30, 60, 80, 100
    expect(progressValues).toContain(10);
    expect(progressValues).toContain(30);
    expect(progressValues).toContain(60);
    expect(progressValues).toContain(80);
    expect(progressValues).toContain(100);
    // Monotonically non-decreasing
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
  });

  test('PUT uses the presigned uploadUrl from the API', async () => {
    const presignedUrl = 'https://s3.example.com/specific-presigned-url?token=xyz';
    mockUploadFile.mockImplementation(async (_opts: unknown) => ({
      data: {
        file: 'file-uuid-123',
        uploadUrl: presignedUrl,
        uploadMethod: 'PUT' as const,
        expiresAt: new Date('2030-01-01'),
      },
    }));

    const file = makeFile('test.txt', 100);
    await uploadFile(file);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [fetchedUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchedUrl).toBe(presignedUrl);
  });

  test('PUT is issued with correct method and Content-Type header', async () => {
    const file = makeFile('image.png', 256, 'image/png');
    await uploadFile(file);

    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchInit.method).toBe('PUT');
    expect((fetchInit.headers as Record<string, string>)['Content-Type']).toBe('image/png');
  });
});
