import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateRoyaltySplitBody } from '@/generated/openapi/validators';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * createRoyaltySplit
 *
 * Path: POST /association/member/royalty-splits
 * OperationId: createRoyaltySplit
 */
export async function createRoyaltySplit(
  ctx: ValidatedContext<CreateRoyaltySplitBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new RoyaltySplitRepository(db, logger);

  const splitNational = Number(body.splitPercentNational);
  const splitChapter = Number(body.splitPercentChapter);

  if (splitNational + splitChapter !== 100) {
    throw new BusinessLogicError(
      'splitPercentNational + splitPercentChapter must equal 100',
      'INVALID_SPLIT_TOTAL',
    );
  }

  const royaltySplit = await repo.createOne({
    organizationId: orgId,
    membershipId: body.membershipId,
    nationalOrgId: body.nationalOrgId,
    chapterId: body.chapterId,
    splitPercentNational: splitNational,
    splitPercentChapter: splitChapter,
    effectiveDate: body.effectiveDate,
  });

  ctx.set('auditResourceId', royaltySplit.id);
  ctx.set('auditDescription', 'Royalty split created');

  return ctx.json(royaltySplit, 201);
}
