/**
 * Officer authorization middleware.
 * Verifies the authenticated user has an active officer term for the org
 * specified by the :orgId route parameter. Returns 403 if not an officer.
 *
 * P1-1 FIX: Throws 400 if :orgId is missing from the route. Every route
 * that uses this middleware MUST include :orgId in the path. Routes without
 * :orgId should use per-handler authorization instead.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError, ValidationError } from '@/core/errors';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

export function officerAuthMiddleware() {
  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Authentication required');

    const orgId = ctx.req.param('orgId');
    if (!orgId) {
      throw new ValidationError('Missing organization context — route must include :orgId parameter');
    }

    const db = ctx.get('database');
    const repo = new OfficerTermRepository(db);
    const terms = await repo.findActiveByPersonAndOrg(user.id, orgId);

    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required for this organization');
    }

    // P1-3: 2FA enforcement deferred — Better-Auth 2FA not yet configured.
    // Re-enable when twoFactorEnabled field is populated for seed/real users.

    return next();
  };
}
