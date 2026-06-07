import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';

/**
 * deletePosition
 *
 * Path: DELETE /association/member/positions/{positionId}
 * OperationId: deletePosition
 */
export async function deletePosition(
  ctx: ValidatedContext<never, never, { positionId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { positionId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PositionRepository(db, logger);

  const existing = await repo.findById(positionId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Position');
  }

  await repo.delete(positionId);

  ctx.set('auditResourceId', positionId);
  ctx.set('auditDescription', 'Position deleted');

  return ctx.json({ success: true });
}
