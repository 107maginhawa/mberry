/**
 * Officer authorization middleware.
 * Verifies the authenticated user has an active officer term for the org
 * specified by the :orgId route parameter. Returns 403 if not an officer.
 *
 * For routes without :orgId in the path (e.g., /events/update/:id),
 * the per-handler org ownership check (P1-2) handles authorization instead.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError } from '@/core/errors';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

export function officerAuthMiddleware() {
  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Authentication required');

    const orgId = ctx.req.param('orgId');
    if (!orgId) {
      // Route doesn't have :orgId — skip middleware, rely on per-handler checks
      return next();
    }

    const db = ctx.get('database');
    const repo = new OfficerTermRepository(db);
    const terms = await repo.findActiveByPersonAndOrg(user.id, orgId);

    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required for this organization');
    }

    return next();
  };
}
