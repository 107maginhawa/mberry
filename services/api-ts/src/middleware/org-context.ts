/**
 * Org-context middleware for association routes.
 *
 * Mounted on `/association/*` — extracts organizationId from the authenticated
 * user's request, resolves their membership in that org, and sets
 * ctx.var.organizationId and ctx.var.orgMembership.
 *
 * Fails closed: if org context cannot be established, returns 403.
 */

import { createMiddleware } from 'hono/factory';
import { eq, and, inArray } from 'drizzle-orm';
import type { Variables } from '@/types/app';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';

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
/** Paths under /association/* that are user-scoped and don't require org context */
const ORG_CONTEXT_EXEMPT: { path: string; methods: string[] }[] = [
  { path: '/association/event-lifecycle/my', methods: ['GET'] },
  { path: '/association/training-lifecycle/my', methods: ['GET'] },
];

export function orgContextMiddleware() {
  return createMiddleware<{ Variables: Variables }>(async (ctx, next): Promise<void | Response> => {
    // Skip org-context for user-scoped endpoints (e.g. "my events", "my certificates")
    const isExempt = ORG_CONTEXT_EXEMPT.some(
      (e) =>
        (ctx.req.path.endsWith(e.path) || ctx.req.path === e.path) &&
        e.methods.includes(ctx.req.method)
    );
    if (isExempt) {
      await next();
      return;
    }

    const user = ctx.get('user');
    if (!user) {
      return ctx.json({ error: 'Authentication required' }, 401);
    }

    // Extract orgId from header, query params, path params, or URL path UUID
    let orgId =
      ctx.req.header('x-org-id') ??
      ctx.req.query('orgId') ??
      ctx.req.query('organizationId') ??
      ctx.req.param('organizationId') ??
      null;

    // Fallback: extract UUID from URL path (for routes like /dues-reporting/:organizationId/dashboard
    // where ctx.req.param() doesn't work in wildcard middleware)
    if (!orgId) {
      const uuidMatch = ctx.req.path.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) orgId = uuidMatch[1]!;
    }

    // Fallback: extract from request body for mutation methods
    if (!orgId && ['POST', 'PUT', 'PATCH'].includes(ctx.req.method)) {
      try {
        const body = await ctx.req.json();
        orgId = body?.organizationId ?? body?.orgId ?? null;
      } catch {
        // Body not JSON or already consumed — continue without
      }
    }

    if (!orgId) {
      return ctx.json(
        { error: 'Organization context required. Provide x-org-id header or orgId query param.' },
        403
      );
    }

    const db = ctx.get('database');

    // Check if user is a platform admin — bypass membership check
    const [admin] = await db
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, user.id))
      .limit(1);

    if (admin) {
      ctx.set('organizationId', orgId);
      ctx.set('orgMembership', {
        membershipId: 'platform-admin',
        personId: user.id,
        organizationId: orgId,
        role: 'admin',
        status: 'active',
      });
      await next();
      return;
    }

    // Query membership table to verify user belongs to this org
    const [membership] = await db
      .select({
        id: memberships.id,
        personId: memberships.personId,
        organizationId: memberships.organizationId,
        status: memberships.status,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.personId, user.id),
          eq(memberships.organizationId, orgId),
          inArray(memberships.status, ['active', 'gracePeriod']),
        )
      )
      .limit(1);

    if (!membership) {
      return ctx.json(
        { error: 'Not a member of this organization' },
        403
      );
    }

    ctx.set('organizationId', orgId);
    ctx.set('orgMembership', {
      membershipId: membership.id,
      personId: membership.personId,
      organizationId: membership.organizationId,
      role: 'member', // role granularity comes from governance module
      status: membership.status,
    });

    await next();
  });
}
