import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateRoyaltySplitBody, UpdateRoyaltySplitParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { RoyaltySplitRepository } from './repos/chapters.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateRoyaltySplit
 *
 * Path: PATCH /association/member/royalty-splits/{royaltySplitId}
 * OperationId: updateRoyaltySplit
 */
export async function updateRoyaltySplit(
  ctx: ValidatedContext<UpdateRoyaltySplitBody, never, UpdateRoyaltySplitParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { royaltySplitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new RoyaltySplitRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(royaltySplitId);
  if (!existing) throw new NotFoundError('Royalty split');

  // If split percentages are being updated, validate they sum to 100
  const splitNational = (body as any).splitPercentNational ?? existing.splitPercentNational;
  const splitChapter = (body as any).splitPercentChapter ?? existing.splitPercentChapter;

  if (Number(splitNational) + Number(splitChapter) !== 100) {
    throw new BusinessLogicError(
      'splitPercentNational + splitPercentChapter must equal 100',
      'INVALID_SPLIT_TOTAL',
    );
  }

  const updated = await repo.updateOneById(royaltySplitId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'royalty-split',
    resourceId: royaltySplitId,
    description: 'Royalty split updated',
  });

  return ctx.json(updated, 200);
}
