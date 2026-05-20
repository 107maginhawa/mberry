import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDocumentTagParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentTagRepository } from './repos/documents.repo';

/**
 * getDocumentTag
 *
 * Path: GET /association/document-tags/{tagId}
 * OperationId: getDocumentTag
 */
export async function getDocumentTag(
  ctx: ValidatedContext<never, never, GetDocumentTagParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentTagRepository(db, ctx.get('logger'));

  const tag = await repo.findOneById(params.tagId);
  if (!tag) throw new NotFoundError('Document tag');

  return ctx.json(tag, 200);
}
