import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { PositionRepository } from './repos/governance.repo';
import { auditAction } from '@/utils/audit';

/**
 * updatePosition
 *
 * Path: PATCH /association/member/positions/{positionId}
 * OperationId: updatePosition
 */
export async function updatePosition(
  ctx: ValidatedContext<any, never, { positionId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { positionId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PositionRepository(db, logger);

  const existing = await repo.findById(positionId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Position');
  }

  const updated = await repo.update(positionId, body);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'position',
    resourceId: positionId,
    description: 'Position updated',
  });

  return ctx.json(updated);
}
