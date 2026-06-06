/**
 * Entity-orgId officer-gated authorization middleware (P1.5 Bucket F).
 *
 * Replaces the dominant hand-rolled pattern in 68 handler files:
 *   const entity = await repo.findOneById(entityId);
 *   if (!entity) throw new NotFoundError(...);
 *   const denied = await requirePosition(ctx, [...], entity.organizationId);
 *   if (denied) return denied;
 *
 * Unlike `requireOfficerMiddleware`, the org id is not on the path or in
 * the body — it's a field on an entity that must be loaded first. The
 * generator therefore emits this middleware AFTER zValidator runs so the
 * loader can read the validated path/body parameters.
 *
 * Driven by TypeSpec `@extension("x-require-officer-for-entity", #{ idParam, loader, loaderFrom })`.
 *
 * P1-3: When the officer holds any privileged position (President,
 * Treasurer, Secretary), enforces 2FA in production — matching
 * requireOfficerMiddleware.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError, ValidationError, NotFoundError } from '@/core/errors';
import { getGovernancePort, type GovernancePort } from '@/core/ports';

const PRIVILEGED_POSITIONS = new Set(['president', 'treasurer', 'secretary']);

export interface RequireOfficerForEntityDeps {
  /** Path parameter holding the entity id (e.g. `"documentId"`, `"trainingId"`). */
  entityIdParam: string;
  /**
   * Loader returning the entity's organization id, or null if the entity
   * does not exist. The middleware throws NotFoundError on null.
   */
  loadOrgIdFromEntity: (ctx: Context, entityId: string) => Promise<string | null>;
  /** Optional override for testing. */
  governancePort?: GovernancePort;
}

export function requireOfficerForEntityMiddleware(deps: RequireOfficerForEntityDeps) {
  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Authentication required');

    const entityId = ctx.req.param(deps.entityIdParam);
    if (!entityId) {
      throw new ValidationError(`Missing ${deps.entityIdParam} path parameter`);
    }

    const orgId = await deps.loadOrgIdFromEntity(ctx, entityId);
    if (!orgId) {
      throw new NotFoundError(`Entity ${entityId} not found`);
    }

    const db = ctx.get('database');
    const port = deps.governancePort ?? (await getGovernancePort(db));
    const terms = await port.findActiveOfficerTermsByPersonAndOrg(user.id, orgId);
    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required for this organization');
    }

    const holdsPrivileged = terms.some(t => {
      const title = ((t.positionTitle as string) ?? '').toLowerCase();
      return PRIVILEGED_POSITIONS.has(title);
    });
    const isDev = process.env['NODE_ENV'] !== 'production';
    if (holdsPrivileged && !user.twoFactorEnabled && !isDev) {
      throw new ForbiddenError(
        'Two-factor authentication required for privileged officer positions (President, Treasurer, Secretary). Please enable 2FA in your account settings.',
      );
    }

    return next();
  };
}
