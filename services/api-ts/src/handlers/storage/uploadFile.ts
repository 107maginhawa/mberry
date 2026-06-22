import type { BaseContext } from '@/types/app';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { type FileUploadResponse, type NewStoredFile } from './repos/file.schema';
import type { StorageProvider } from '@/core/storage';
import { StorageFileRepository } from './repos/file.repo';
import { addMinutes } from 'date-fns';
import path from 'path';

/** Allowed MIME types for file upload */
const ALLOWED_MIME_TYPES = new Set([
  // Images (SVG excluded — requires content sanitization to prevent XSS)
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain', 'text/csv',
  // Archives
  'application/zip',
]);

/** Sanitize filename: strip path components, null bytes, control chars */
function sanitizeFilename(filename: string): string {
  // Extract basename (strip directory traversal)
  let clean = path.basename(filename);
  // Remove null bytes and control characters (eslint-disable-next-line: intentional control char matching)
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[\x00-\x1f]/g, '');
  // Collapse whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  if (!clean || clean === '.' || clean === '..') {
    throw new ValidationError('Invalid filename');
  }
  return clean;
}

/**
 * uploadFile
 * 
 * Path: POST /storage/files/upload
 * OperationId: uploadFile
 */
export async function uploadFile(
  ctx: BaseContext
): Promise<Response> {
  // Get request body
  const body = await ctx.req.json() as {
    filename: string;
    size: number;
    mimeType: string;
  };
  if (!body.filename || !body.mimeType || typeof body.size !== 'number') {
    throw new ValidationError('Missing required fields: filename, mimeType, size');
  }
  
  // Validate MIME type against allowlist
  if (!ALLOWED_MIME_TYPES.has(body.mimeType)) {
    throw new ValidationError(`File type '${body.mimeType}' is not allowed`);
  }

  // Sanitize filename (strips path traversal, null bytes, control chars)
  body.filename = sanitizeFilename(body.filename);

  // Get dependencies from context (injected by middleware)
  const storage = ctx.get('storage') as StorageProvider;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'storage' }) ?? baseLogger;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new StorageFileRepository(db, logger);

  // Check file size limit (50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (body.size > MAX_FILE_SIZE) {
    throw new ValidationError('File size exceeds maximum limit of 50MB');
  }
  
  // Generate unique file ID
  const fileId = uuidv4();
  
  // Get authenticated user from Better-Auth
  const user = ctx.get('user') as User;

  if (!user?.id) {
    throw new ValidationError('Valid user ID required');
  }

  // Multi-tenant scoping (P0-7)
  const organizationId = ctx.get('organizationId') as string;

  // P0-7 / migration 0081: stored_file.organization_id is NOT NULL — every file
  // must be tenant-scoped. The /storage/* route uses orgContextOptionalMiddleware,
  // so a non-member (or a request without x-org-id) reaches here with no org; fail
  // fast with a clean 400 rather than a DB 23502 not-null violation (a 500).
  if (!organizationId) {
    throw new ValidationError('Organization context is required to upload a file');
  }

  // Create database record with "uploading" status
  let fileCreated = false;
  
  try {
    await repo.createOne({
      id: fileId, // Use the same UUID for both storage key and database record
      organizationId,
      filename: body.filename,
      mimeType: body.mimeType,
      size: body.size,
      status: 'uploading',
      owner: user.id,
    } as NewStoredFile);
    fileCreated = true;
    
    // Generate presigned upload URL
    logger?.debug({ action: 'uploadFile.1', fileId, mimeType: body.mimeType }, 'Generating presigned upload URL');
    const uploadUrl = await storage.generateUploadUrl(fileId, body.mimeType);
    logger?.debug({ action: 'uploadFile.2', fileId, uploadUrl }, 'Generated presigned upload URL');

    // Calculate expiry time (5 minutes from now)
    const expiresAt = addMinutes(new Date(), 5);
    
    // Return upload response
    const response: FileUploadResponse = {
      file: fileId,
      uploadUrl,
      uploadMethod: 'PUT',
      expiresAt,
    };
    
    logger?.info({ action: 'uploadFile.3', fileId, filename: body.filename, size: body.size }, 'File upload initiated');
    
    return ctx.json(response, 201);
  } catch (error) {
    // Clean up database record if it was created
    if (fileCreated) {
      try {
        await repo.deleteOneById(fileId);
      } catch (cleanupError) {
        logger?.error({ action: 'uploadFile.4', error: cleanupError, fileId }, 'Failed to clean up database record');
      }
    }
    
    throw error; // Re-throw original error for global handler
  }
}