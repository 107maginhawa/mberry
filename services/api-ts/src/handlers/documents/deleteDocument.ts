import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteDocument
 *
 * Path: DELETE /association/documents/{documentId}
 * OperationId: deleteDocument
 */
export async function deleteDocument(
  ctx: ValidatedContext<never, never, DeleteDocumentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // [EM-M11-h5c78d34] Document deletion is president-only (spec: super/admin/president).
  // requireOfficerTerm allowed any officer, which was over-permissive.
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const { documentId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(documentId);
  if (!existing) throw new NotFoundError('Document');

  // Org-scope check
  const orgId = ctx.get('organizationId');
  if (existing.organizationId !== orgId) {
    throw new ForbiddenError('Access denied to this document');
  }

  await repo.deleteOneById(documentId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'document',
    resourceId: documentId,
    description: 'Document deleted',
  });

  return ctx.body(null, 204);
}
