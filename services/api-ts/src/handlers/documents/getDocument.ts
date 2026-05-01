import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
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

  const document = await repo.findOneById((params as any).documentId);
  if (!document) throw new NotFoundError('Document');

  return ctx.json(document, 200);
}
