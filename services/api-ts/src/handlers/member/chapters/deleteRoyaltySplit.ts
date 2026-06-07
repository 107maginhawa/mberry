import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteRoyaltySplitParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * deleteRoyaltySplit
 *
 * Path: DELETE /association/member/royalty-splits/{royaltySplitId}
 * OperationId: deleteRoyaltySplit
 */
export async function deleteRoyaltySplit(
  ctx: ValidatedContext<never, never, DeleteRoyaltySplitParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { royaltySplitId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new RoyaltySplitRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(royaltySplitId);
  if (!existing) throw new NotFoundError('Royalty split');

  await repo.deleteOneById(royaltySplitId);

  ctx.set('auditResourceId', royaltySplitId);
  ctx.set('auditDescription', 'Royalty split deleted');

  return ctx.body(null, 204);
}
