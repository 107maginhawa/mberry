import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ArchiveDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * archiveDocument
 *
 * Path: POST /association/documents/{documentId}/archive
 * OperationId: archiveDocument
 *
 * Sets document status to 'archived'. Does not delete.
 */
export async function archiveDocument(
  ctx: ValidatedContext<never, never, ArchiveDocumentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  // P1: Officer/admin restriction for document archival
  const denied = await requireOfficerTerm(ctx);
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

  if (existing.status === 'archived') {
    throw new BusinessLogicError('Document is already archived', 'ALREADY_ARCHIVED');
  }

  const updated = await repo.updateOneById(documentId, { status: 'archived' });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'document',
    resourceId: documentId,
    description: 'Document archived',
  });

  return ctx.json(updated, 200);
}
