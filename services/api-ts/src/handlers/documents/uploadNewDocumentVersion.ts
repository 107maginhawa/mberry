import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UploadNewDocumentVersionBody, UploadNewDocumentVersionParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { DocumentRepository, DocumentVersionRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';
import { isBlockedDocumentFile } from '@/utils/sanitize';

/**
 * uploadNewDocumentVersion
 *
 * Path: POST /association/documents/{documentId}/versions
 * OperationId: uploadNewDocumentVersion
 *
 * Increments version number and links to document.
 */
export async function uploadNewDocumentVersion(
  ctx: ValidatedContext<UploadNewDocumentVersionBody, never, UploadNewDocumentVersionParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { documentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  // EF-M11-004: Block SVG uploads (XSS vector — script tags, event handlers, foreignObject)
  if (isBlockedDocumentFile(body.fileName)) {
    throw new ValidationError('SVG files are not allowed due to security risks. Please convert to PNG or PDF.');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const docRepo = new DocumentRepository(db, logger);
  const versionRepo = new DocumentVersionRepository(db, logger);

  const document = await docRepo.findOneById(documentId);
  if (!document) throw new NotFoundError('Document');
  // EF-M11-005: IDOR guard — verify document belongs to caller's org
  if (document.organizationId !== orgId) throw new NotFoundError('Document');

  // Get next version number
  const latestVersion = await versionRepo.getLatestVersionNumber(documentId);
  const nextVersion = latestVersion + 1;

  const version = await versionRepo.createOne({
    organizationId: orgId,
    documentId,
    versionNumber: nextVersion,
    fileName: body.fileName,
    fileSize: body.size,
    storageKey: body.storageKey,
    uploadedBy: user.id,
    changeNote: body.changeNotes ?? null,
  });

  // Update document's currentVersionId
  await docRepo.updateOneById(documentId, { currentVersionId: version.id });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'document-version',
    resourceId: version.id,
    description: `Document version ${nextVersion} uploaded for document ${documentId}`,
  });

  return ctx.json(version, 201);
}
