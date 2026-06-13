/**
 * Organization-scoped authorization utilities.
 *
 * Used by association handlers to enforce role-based access control
 * within an organization context.
 */

import type { BaseContext } from '@/types/app';

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
 * Check that the current user has access to this org.
 * Returns a 403 Response if denied, or null if allowed.
 */
export function requireTenantAccess(ctx: BaseContext): Response | null {
  const orgId = ctx.get('organizationId');
  const orgMembership = ctx.get('orgMembership');

  if (!orgId || !orgMembership) {
    return ctx.json({ error: 'Organization access required' }, 403);
  }

  if (orgMembership.organizationId !== orgId) {
    return ctx.json({ error: 'Organization mismatch' }, 403);
  }

  return null;
}
