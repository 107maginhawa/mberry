/**
 * reviewCreative
 *
 * Path: POST /association/advertising/creatives/:creativeId/review
 * OperationId: reviewCreative
 *
 * Admin approves or rejects a creative (AC-M16-001)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { CreativeRepository } from './repos/creative.repo';

export async function reviewCreative(ctx: ValidatedContext<any, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { creativeId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
    throw new ValidationError('decision must be "approved" or "rejected"');
  }

  if (body.decision === 'rejected' && !body.reason?.trim()) {
    throw new ValidationError('Rejection reason is required');
  }

  const repo = new CreativeRepository(db, logger);
  const creative = await repo.findOneById(creativeId);

  if (!creative) throw new NotFoundError('Creative not found');
  if (creative.status !== 'pending') {
    throw new BusinessLogicError('Only pending creatives can be reviewed');
  }

  let updated: any;
  if (body.decision === 'approved') {
    updated = await repo.approveCreative(creativeId, user.id);
  } else {
    updated = await repo.rejectCreative(creativeId, user.id, body.reason.trim());
  }

  logger?.info({
    creativeId,
    decision: body.decision,
    reviewedBy: user.id,
    action: 'review_creative',
  }, 'Creative reviewed');

  return ctx.json(updated, 200);
}
