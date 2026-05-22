import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { PositionRepository } from './repos/governance.repo';

/**
 * listPositions
 *
 * Path: GET /association/member/positions
 * OperationId: listPositions
 */
export async function listPositions(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PositionRepository(db, logger);

  const positions = await repo.findByOrg(orgId);

  return ctx.json({ items: positions });
}
