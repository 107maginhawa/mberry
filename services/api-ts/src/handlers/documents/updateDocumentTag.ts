import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDocumentTagBody, UpdateDocumentTagParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentTagRepository } from './repos/documents.repo';

/**
 * updateDocumentTag
 *
 * Path: PATCH /association/document-tags/{tagId}
 * OperationId: updateDocumentTag
 */
export async function updateDocumentTag(
  ctx: ValidatedContext<UpdateDocumentTagBody, never, UpdateDocumentTagParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { tagId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentTagRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(tagId);
  if (!existing) throw new NotFoundError('Document tag');

  const updated = await repo.updateOneById(tagId, body as Record<string, unknown>);

  ctx.set('auditResourceId', tagId);
  ctx.set('auditDescription', 'Document tag updated');

  return ctx.json(updated, 200);
}
