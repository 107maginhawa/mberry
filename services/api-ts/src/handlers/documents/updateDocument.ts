import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDocumentBody, UpdateDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

// [EM-M11-b4f29d18] Document status lifecycle: draft → published → archived.
// Archived is terminal; published cannot revert to draft.
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

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

  // [EM-M11-b4f29d18] Guard status changes against the document state machine.
  const nextStatus = (body as Record<string, unknown>)['status'] as string | undefined;
  if (nextStatus && nextStatus !== existing.status) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BusinessLogicError(
        `Invalid document status transition: ${existing.status} → ${nextStatus}`,
        'INVALID_STATUS_TRANSITION',
      );
    }
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
