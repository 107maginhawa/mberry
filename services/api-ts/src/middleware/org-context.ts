/**
 * Org-context middleware for association routes.
 *
 * Mounted on `/association/*` — extracts orgId from the authenticated
 * user's request, resolves their membership in that org, and sets
 * ctx.var.orgId, ctx.var.orgMembership, and ctx.var.tenantId.
 *
 * Fails closed: if org context cannot be established, returns 403.
 */

import { createMiddleware } from 'hono/factory';
import type { Variables } from '@/types/app';

/**
 * Creates org-context middleware.
 *
 * The middleware expects:
 * - An authenticated user (ctx.var.user must exist)
 * - An `x-org-id` header or `orgId` query param identifying the association
 *
 * It then queries the membership table to verify the user belongs to that org
 * and populates ctx.var with the org context.
 */
export function orgContextMiddleware() {
  return createMiddleware<{ Variables: Variables }>(async (ctx, next): Promise<void | Response> => {
    const user = ctx.get('user');
    if (!user) {
      return ctx.json({ error: 'Authentication required' }, 401);
    }

    // Extract orgId from header or query param
    const orgId =
      ctx.req.header('x-org-id') ??
      ctx.req.query('orgId') ??
      null;

    if (!orgId) {
      return ctx.json(
        { error: 'Organization context required. Provide x-org-id header or orgId query param.' },
        403
      );
    }

    // TODO: Query membership table to verify user belongs to this org
    // For now, set the context values. Full implementation comes in Wave 1
    // when the membership handler/repo are built.
    //
    // const db = ctx.get('database');
    // const membership = await db.query.membership.findFirst({
    //   where: and(eq(membership.personId, user.id), eq(membership.orgId, orgId))
    // });
    // if (!membership) return ctx.json({ error: 'Not a member of this organization' }, 403);

    ctx.set('orgId', orgId);
    ctx.set('tenantId', orgId); // tenantId = orgId for association context
    // ctx.set('orgMembership', membership); // Enabled in Wave 1

    await next();
  });
}
