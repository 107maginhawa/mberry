import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDocumentBody, UpdateDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';

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

  const { documentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(documentId);
  if (!existing) throw new NotFoundError('Document');

  const updated = await repo.updateOneById(documentId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'document',
    resourceId: documentId,
    description: 'Document updated',
  });

  return ctx.json(updated, 200);
}
