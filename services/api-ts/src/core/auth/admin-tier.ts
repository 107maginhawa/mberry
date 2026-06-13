/**
 * Platform-admin tier authorization (AHA FIX-008 / G1).
 *
 * Q1 decision (CONTINUE-48): the canonical admin role taxonomy is the code enum
 * `super | support | analyst` (platformadmin/repos/platform-admin.schema.ts
 * adminRoleEnum), NOT the stale MODULE_SPEC §6 `super/admin/support` wording
 * (synced to the enum by FIX-005).
 *
 * Q8 decision: `analyst` is READ-ONLY — national/revenue analytics + all reads,
 * never a mutation, never impersonation.
 *
 * This helper is the tier gate for `/admin/*` mutating handlers. The
 * `platformAdminAuthMiddleware` (middleware/platform-admin-auth.ts) has already
 * confirmed the caller is a platform admin and set `ctx.platformAdmin`; this
 * helper only enforces WHICH tier may perform the action.
 *
 * It mirrors `requirePosition` (core/auth/officer-checks.ts): it returns a 403
 * `Response` when the caller's tier is not allowed, or `null` when allowed, so
 * handlers use it as `const denied = requireAdminTier(ctx, ...); if (denied) return denied;`.
 */

import type { Context } from 'hono';

export type AdminRole = 'super' | 'support' | 'analyst';

/** Mutations reserved for super admins (associations, orgs, flags, admins, pricing, subscriptions). */
export const SUPER_ONLY: AdminRole[] = ['super'];

/** Mutations available to support and super (tickets, breaches, impersonation). */
export const SUPPORT_OR_SUPER: AdminRole[] = ['super', 'support'];

/**
 * Enforce that the calling platform admin holds one of the allowed tiers.
 *
 * @param ctx     Hono context — `platformAdmin` must already be set by
 *                `platformAdminAuthMiddleware`.
 * @param allowed Tiers permitted to perform the action (e.g. SUPER_ONLY).
 * @returns A 403 `Response` if denied, or `null` if allowed.
 */
export function requireAdminTier(ctx: Context, allowed: AdminRole[]): Response | null {
  const admin = ctx.get('platformAdmin') as { role?: string } | undefined;
  if (!admin) {
    return ctx.json({ error: 'Platform admin access required' }, 403);
  }

  if (!admin.role || !allowed.includes(admin.role as AdminRole)) {
    const need = allowed.includes('support') ? 'Support or super' : 'Super';
    return ctx.json({ error: `${need} admin access required` }, 403);
  }

  return null;
}
