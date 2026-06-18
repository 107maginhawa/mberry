import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateDocumentBody } from '@/generated/openapi/validators';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { z } from 'zod';
import { DocumentRepository } from './repos/documents.repo';
import { StorageFileRepository } from '@/handlers/storage/repos/file.repo';
import { isBlockedDocumentFile } from '@/utils/sanitize';
import { requireOfficerTerm } from '@/core/auth/officer-checks';
import { domainEvents } from '@/core/domain-events';

/**
 * createDocument
 *
 * Path: POST /association/documents
 * OperationId: createDocument
 */
export async function createDocument(
  ctx: ValidatedContext<CreateDocumentBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');

  // EF-M11-004: Block SVG uploads (XSS vector — script tags, event handlers, foreignObject)
  if (isBlockedDocumentFile(body.fileName, body.mimeType)) {
    throw new ValidationError('SVG files are not allowed due to security risks. Please convert to PNG or PDF.');
  }

  // EM-M11-g4b67c23: role guard. Members may create documents they personally
  // own (member:owner); org/chapter-scoped documents require officer access.
  const isSelfOwned = body.ownerType === 'person' && body.ownerId === user.id;
  if (!isSelfOwned) {
    const denied = await requireOfficerTerm(ctx);
    if (denied) return denied;
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DocumentRepository(db, logger);

  // SEC (cross-tenant exfil): the client-supplied storageKey must reference a
  // StoredFile this caller legitimately owns in this org. Storage mints keys as
  // the StoredFile.id (see handlers/storage/uploadFile.ts — the file UUID is
  // used as BOTH the DB id and the object key passed to generateUploadUrl), so
  // we resolve the key as that id and enforce owner + org. Without this, a
  // member could create a self-owned document whose storageKey points at any
  // object in the bucket (another org's file UUID) and then presign-download it.
  //
  // Robustness: storage mints keys as a UUID (the StoredFile.id). If the client
  // sends a non-UUID storageKey (e.g. a path), `findOneById` would run
  // `... WHERE id = '<path>'` and Postgres throws `invalid input syntax for
  // type uuid` → unhandled 500. Validate the shape first and reject with the
  // same clean 400 used for the ownership failure.
  if (!z.string().uuid().safeParse(body.storageKey).success) {
    throw new ValidationError(
      'storageKey does not reference a file you uploaded in this organization',
    );
  }

  const storageRepo = new StorageFileRepository(db, logger);
  const storedFile = await storageRepo.findOneById(body.storageKey);
  if (
    !storedFile ||
    storedFile.organizationId !== orgId ||
    storedFile.owner !== user.id
  ) {
    throw new ValidationError(
      'storageKey does not reference a file you uploaded in this organization',
    );
  }

  // EM-M11-7a3e1c02: honor the document lifecycle (draft -> published -> archived).
  // Default to draft so documents are not auto-published on creation.
  const document = await repo.createOne({
    organizationId: orgId,
    title: body.title,
    fileName: body.fileName,
    mimeType: body.mimeType,
    size: body.size,
    storageKey: body.storageKey,
    ownerId: body.ownerId,
    ownerType: body.ownerType,
    accessLevel: body.accessLevel,
    category: body.category ?? null,
    tags: body.tags ?? [],
    status: body.status ?? 'draft',
  });

  ctx.set('auditResourceId', document.id);
  ctx.set('auditDescription', `Document "${body.title}" created`);

  // EM-M11-d1e34f90: emit DocumentUploaded domain event.
  domainEvents.emit('document.created', {
    documentId: document.id,
    organizationId: orgId,
    ownerId: body.ownerId,
    ownerType: body.ownerType,
    createdBy: user.id,
    isNewVersion: false,
  }).catch(() => {});

  return ctx.json(document, 201);
}
