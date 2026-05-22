import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteDocumentTagParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentTagRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteDocumentTag
 *
 * Path: DELETE /association/document-tags/{tagId}
 * OperationId: deleteDocumentTag
 */
export async function deleteDocumentTag(
  ctx: ValidatedContext<never, never, DeleteDocumentTagParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { tagId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentTagRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(tagId);
  if (!existing) throw new NotFoundError('Document tag');

  await repo.deleteOneById(tagId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'document-tag',
    resourceId: tagId,
    description: 'Document tag deleted',
  });

  return ctx.body(null, 204);
}
