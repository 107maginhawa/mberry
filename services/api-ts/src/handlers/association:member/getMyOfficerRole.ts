import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { OfficerTermRepository } from './repos/governance.repo';

/**
 * getMyOfficerRole
 *
 * Returns the authenticated user's active officer position(s) for a specific org.
 * Returns 200 with role data if officer, 200 with empty array if not.
 * Used by frontend guard to determine officer access per org.
 */
export async function getMyOfficerRole(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.req.param('orgId');
  if (!orgId) return ctx.json({ error: 'orgId required' }, 400);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new OfficerTermRepository(db, ctx.get('logger'));

  const activeTerms = await repo.findActiveByPersonAndOrg(user.id, orgId);

  return ctx.json({
    data: {
      isOfficer: activeTerms.length > 0,
      positions: activeTerms.map((t) => ({
        id: t.positionId,
        title: t.positionTitle,
        termId: t.id,
        startDate: t.startDate,
        endDate: t.endDate,
      })),
    },
  }, 200);
}
