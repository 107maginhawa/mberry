import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';

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

  const { documentId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(documentId);
  if (!existing) throw new NotFoundError('Document');

  await repo.deleteOneById(documentId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'document',
    resourceId: documentId,
    description: 'Document deleted',
  });

  return ctx.body(null, 204);
}
