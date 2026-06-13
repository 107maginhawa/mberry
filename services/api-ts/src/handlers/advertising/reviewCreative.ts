/**
 * reviewCreative
 *
 * Path: POST /association/advertising/creatives/:creativeId/review
 * OperationId: reviewCreative
 *
 * Admin approves or rejects a creative (AC-M16-001 / BR-45)
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
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'advertising' }) ?? baseLogger;

  // Contract: ReviewCreativeRequest = { approved: boolean, rejectionReason?: string }
  // (advertising.tsp). The generated zValidator strips to this shape, so the
  // handler MUST read `approved`/`rejectionReason`.
  if (typeof body.approved !== 'boolean') {
    throw new ValidationError('approved must be a boolean');
  }

  if (body.approved === false && !body.rejectionReason?.trim()) {
    throw new ValidationError('Rejection reason is required when approved is false');
  }

  const repo = new CreativeRepository(db, logger);
  const creative = await repo.findOneById(creativeId);

  if (!creative) throw new NotFoundError('Creative not found');
  if (creative.status !== 'pending') {
    throw new BusinessLogicError('Only pending creatives can be reviewed');
  }

  let updated: any;
  if (body.approved) {
    updated = await repo.approveCreative(creativeId, user.id);
  } else {
    updated = await repo.rejectCreative(creativeId, user.id, body.rejectionReason.trim());
  }

  // Audit (FIX-012): expose the actual review outcome on the per-route audit event.
  ctx.set('auditResourceId', creativeId);
  ctx.set('auditDescription', `Creative ${creativeId} review: ${body.approved ? 'approved' : 'rejected'} by ${user.id}`);

  logger?.info({
    creativeId,
    approved: body.approved,
    reviewedBy: user.id,
    action: 'review_creative',
  }, 'Creative reviewed');

  return ctx.json(updated, 200);
}
