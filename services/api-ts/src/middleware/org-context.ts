/**
 * Org-context middleware for association routes.
 *
 * Mounted on `/association/*` — extracts organizationId from the authenticated
 * user's request, resolves their membership in that org, and sets
 * ctx.var.organizationId and ctx.var.orgMembership.
 *
 * Fails closed: if org context cannot be established, returns 403.
 *
 * S-C4-014 (Wave G2): membership + platform-admin lookups go through
 * `core/ports` instead of importing handler-owned schemas / repos.
 */

import { createMiddleware } from 'hono/factory';
import type { Variables } from '@/types/app';
import {
  getMembershipPort,
  getPlatformAdminPort,
  type MembershipPort,
  type PlatformAdminPort,
} from '@/core/ports';

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
  // Applicants by definition are not yet org members — POST applications
  // and read tiers must not require existing membership. Once a person
  // has an approved application, they become a member and subsequent
  // /association/member/* calls go through the standard membership check.
  { path: '/association/member/applications', methods: ['POST'] },
  { path: '/association/member/tiers', methods: ['GET'] },
];

export interface OrgContextDeps {
  membershipPort?: MembershipPort;
  platformAdminPort?: PlatformAdminPort;
}

export function orgContextMiddleware(deps: OrgContextDeps = {}) {
  return createMiddleware<{ Variables: Variables }>(async (ctx, next): Promise<void | Response> => {
    // Skip org-context for user-scoped endpoints (e.g. "my events", "my certificates")
    const isExempt = ORG_CONTEXT_EXEMPT.some(
      (e) =>
        (ctx.req.path.endsWith(e.path) || ctx.req.path === e.path) &&
        e.methods.includes(ctx.req.method)
    );
    if (isExempt) {
      // Surface orgId to handlers when provided — applicants POSTing to
      // /association/member/applications still need ctx.get('organizationId')
      // populated even though we skip the membership check.
      const exemptOrgId =
        ctx.req.header('x-org-id') ??
        ctx.req.query('orgId') ??
        ctx.req.query('organizationId') ??
        null;
      if (exemptOrgId) {
        ctx.set('organizationId', exemptOrgId);
      }
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
    const adminPort = deps.platformAdminPort ?? (await getPlatformAdminPort(db));
    const admin = await adminPort.findByUserId(user.id);

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
    const membershipPort = deps.membershipPort ?? (await getMembershipPort(db));
    const membership = await membershipPort.findActiveMembershipByPersonAndOrg(user.id, orgId);

    if (!membership) {
      return ctx.json(
        { error: 'Not a member of this organization' },
        403
      );
    }

    ctx.set('organizationId', orgId);
    ctx.set('orgMembership', {
      membershipId: membership.membershipId,
      personId: membership.personId,
      organizationId: membership.organizationId,
      role: 'member', // role granularity comes from governance module
      status: membership.status,
    });

    await next();
  });
}

/**
 * Fail-open org-context middleware for non-association routes.
 *
 * Same org extraction logic as orgContextMiddleware, but:
 * - Skips silently if no user authenticated (unauthenticated routes like webhooks)
 * - Skips silently if no org context found (not all requests need org)
 * - Skips silently if membership check fails (handler decides access)
 *
 * Use on /billing/*, /booking/*, /comms/*, /storage/*, /reviews/*, /audit/*, /persons/*
 * where org context is helpful but not mandatory.
 */
export function orgContextOptionalMiddleware(deps: OrgContextDeps = {}) {
  return createMiddleware<{ Variables: Variables }>(async (ctx, next): Promise<void | Response> => {
    const user = ctx.get('user');
    if (!user) {
      await next();
      return;
    }

    // Extract orgId from header, query params, path params, or URL path UUID
    let orgId =
      ctx.req.header('x-org-id') ??
      ctx.req.query('orgId') ??
      ctx.req.query('organizationId') ??
      ctx.req.param('organizationId') ??
      null;

    if (!orgId) {
      const uuidMatch = ctx.req.path.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) orgId = uuidMatch[1]!;
    }

    if (!orgId && ['POST', 'PUT', 'PATCH'].includes(ctx.req.method)) {
      try {
        const body = await ctx.req.json();
        orgId = body?.organizationId ?? body?.orgId ?? null;
      } catch {
        // Body not JSON or already consumed
      }
    }

    if (!orgId) {
      await next();
      return;
    }

    const db = ctx.get('database');

    // Platform admin bypass
    const adminPort = deps.platformAdminPort ?? (await getPlatformAdminPort(db));
    const admin = await adminPort.findByUserId(user.id);

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

    // Check membership — skip silently if not a member
    const membershipPort = deps.membershipPort ?? (await getMembershipPort(db));
    const membership = await membershipPort.findActiveMembershipByPersonAndOrg(user.id, orgId);

    if (membership) {
      ctx.set('organizationId', orgId);
      ctx.set('orgMembership', {
        membershipId: membership.membershipId,
        personId: membership.personId,
        organizationId: membership.organizationId,
        role: 'member',
        status: membership.status,
      });
    }

    await next();
  });
}
