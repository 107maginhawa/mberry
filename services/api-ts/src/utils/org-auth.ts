/**
 * Organization-scoped authorization utilities.
 *
 * Used by association handlers to enforce role-based access control
 * within an organization context.
 */

import type { BaseContext } from '@/types/app';

/** Roles in order of descending privilege */
const ROLE_HIERARCHY = [
  'president',
  'vice-president',
  'secretary',
  'treasurer',
  'board-member',
  'officer',
  'staff',
  'member',
] as const;

type OrgRole = (typeof ROLE_HIERARCHY)[number];

/**
 * Check that the current user has one of the required roles in the org.
 * Returns a 403 Response if denied, or null if allowed.
 */
export function requireOrgRole(
  ctx: BaseContext,
  allowedRoles: readonly string[]
): Response | null {
  const membership = ctx.get('orgMembership');
  if (!membership) {
    return ctx.json({ error: 'Organization membership required' }, 403);
  }

  if (!allowedRoles.includes(membership.role)) {
    return ctx.json(
      { error: `Requires one of: ${allowedRoles.join(', ')}` },
      403
    );
  }

  return null;
}

/**
 * Check that the current user has an active membership status.
 * Returns a 403 Response if not active, or null if allowed.
 */
export function requireActiveStatus(ctx: BaseContext): Response | null {
  const membership = ctx.get('orgMembership');
  if (!membership) {
    return ctx.json({ error: 'Organization membership required' }, 403);
  }

  if (membership.status !== 'active' && membership.status !== 'grace') {
    return ctx.json(
      { error: 'Active membership required' },
      403
    );
  }

  return null;
}

/**
 * Check that the current user has access to this tenant/org.
 * Returns a 403 Response if denied, or null if allowed.
 */
export function requireTenantAccess(ctx: BaseContext): Response | null {
  const tenantId = ctx.get('tenantId');
  const orgMembership = ctx.get('orgMembership');

  if (!tenantId || !orgMembership) {
    return ctx.json({ error: 'Tenant access required' }, 403);
  }

  if (orgMembership.orgId !== tenantId) {
    return ctx.json({ error: 'Tenant mismatch' }, 403);
  }

  return null;
}

/**
 * Check if a role is at least as privileged as the minimum required role.
 */
export function hasMinimumRole(userRole: string, minimumRole: OrgRole): boolean {
  const userIdx = ROLE_HIERARCHY.indexOf(userRole as OrgRole);
  const minIdx = ROLE_HIERARCHY.indexOf(minimumRole);
  if (userIdx === -1) return false;
  return userIdx <= minIdx; // Lower index = higher privilege
}
