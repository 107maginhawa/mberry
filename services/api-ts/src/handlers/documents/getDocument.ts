import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';

/**
 * getDocument
 *
 * Path: GET /association/documents/{documentId}
 * OperationId: getDocument
 */
export async function getDocument(
  ctx: ValidatedContext<never, never, GetDocumentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const document = await repo.findOneById(params.documentId);
  if (!document) throw new NotFoundError('Document');

  // P0-01: Org-scope check to prevent IDOR
  const orgId = ctx.get('organizationId');
  if (document.organizationId !== orgId) {
    throw new ForbiddenError('Access denied to this document');
  }

  ctx.set('auditResourceId', params.documentId);
  ctx.set('auditDescription', `Document accessed: ${document.title ?? params.documentId}`);

  return ctx.json(document, 200);
}
