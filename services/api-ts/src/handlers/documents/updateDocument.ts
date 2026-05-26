import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDocumentBody, UpdateDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * updateDocument
 *
 * Path: PATCH /association/documents/{documentId}
 * OperationId: updateDocument
 */
export async function updateDocument(
  ctx: ValidatedContext<UpdateDocumentBody, never, UpdateDocumentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // P1: Officer/admin restriction for document updates
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const { documentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(documentId);
  if (!existing) throw new NotFoundError('Document');

  // Org-scope check
  const orgId = ctx.get('organizationId');
  if (existing.organizationId !== orgId) {
    throw new ForbiddenError('Access denied to this document');
  }

  const updated = await repo.updateOneById(documentId, body as Record<string, unknown>);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'document',
    resourceId: documentId,
    description: 'Document updated',
  });

  return ctx.json(updated, 200);
}
