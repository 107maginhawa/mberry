import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createPosition
 *
 * Path: POST /association/member/positions
 * OperationId: createPosition
 */
export async function createPosition(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PositionRepository(db, logger);

  const position = await repo.create({
    organizationId: orgId,
    title: body.title,
    description: body.description || null,
    level: body.level,
    termLengthMonths: body.termLengthMonths,
    maxTerms: body.maxTerms ?? null,
    sortOrder: body.sortOrder ?? 0,
  });

  ctx.set('auditResourceId', position.id);
  ctx.set('auditDescription', 'Position created');

  return ctx.json(position, 201);
}
