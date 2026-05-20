/**
 * Officer authorization middleware.
 * Verifies the authenticated user has an active officer term for the org
 * specified by the :organizationId route parameter. Returns 403 if not an officer.
 *
 * P1-1 FIX: Throws 400 if :organizationId is missing from the route. Every route
 * that uses this middleware MUST include :organizationId in the path. Routes without
 * :organizationId should use per-handler authorization instead.
 *
 * P1-3 FIX: Enforces 2FA for privileged officer positions (President,
 * Treasurer, Secretary). Users holding these positions must have 2FA
 * enabled on their account.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError, ValidationError } from '@/core/errors';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

/**
 * Privileged positions that require 2FA (P1-3).
 * These roles handle finances, governance, or official records.
 */
const PRIVILEGED_POSITIONS = new Set([
  'president',
  'treasurer',
  'secretary',
]);

export function officerAuthMiddleware() {
  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Authentication required');

    const orgId = ctx.req.param('organizationId');
    if (!orgId) {
      throw new ValidationError('Missing organization context — route must include :organizationId parameter');
    }

    const db = ctx.get('database');
    const repo = new OfficerTermRepository(db);
    const terms = await repo.findActiveByPersonAndOrg(user.id, orgId);

    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required for this organization');
    }

    // P1-3: Enforce 2FA for privileged officer positions
    const holdsPrivilegedPosition = terms.some(t => {
      const title = t.positionTitle as string | undefined;
      return title ? PRIVILEGED_POSITIONS.has(title.toLowerCase()) : false;
    });

    if (holdsPrivilegedPosition && !user.twoFactorEnabled) {
      throw new ForbiddenError(
        'Two-factor authentication required for privileged officer positions (President, Treasurer, Secretary). ' +
        'Please enable 2FA in your account settings.',
      );
    }

    return next();
  };
}
