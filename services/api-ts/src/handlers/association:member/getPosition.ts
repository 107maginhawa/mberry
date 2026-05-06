import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { PositionRepository } from './repos/governance.repo';

/**
 * getPosition
 *
 * Path: GET /association/member/positions/{positionId}
 * OperationId: getPosition
 */
export async function getPosition(
  ctx: ValidatedContext<never, never, { positionId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { positionId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PositionRepository(db, logger);

  const position = await repo.findById(positionId);
  if (!position || position.organizationId !== orgId) {
    throw new NotFoundError('Position');
  }

  return ctx.json(position);
}
