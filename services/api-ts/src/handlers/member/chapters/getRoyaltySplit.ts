import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetRoyaltySplitParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * getRoyaltySplit
 *
 * Path: GET /association/member/royalty-splits/{royaltySplitId}
 * OperationId: getRoyaltySplit
 */
export async function getRoyaltySplit(
  ctx: ValidatedContext<never, never, GetRoyaltySplitParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new RoyaltySplitRepository(db, ctx.get('logger'));

  const { royaltySplitId } = params as { royaltySplitId: string };
  const royaltySplit = await repo.findOneById(royaltySplitId);
  if (!royaltySplit) throw new NotFoundError('Royalty split');

  return ctx.json(royaltySplit, 200);
}
