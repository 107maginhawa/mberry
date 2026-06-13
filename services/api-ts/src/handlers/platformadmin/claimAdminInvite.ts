import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * claimAdminInvite
 *
 * Path: POST /platform-admin/claim  (authenticated, NOT behind the /admin/*
 * platform-admin gate — the invitee is not yet a platform admin).
 *
 * FIX-003 (G4 / WF-022): inviteAdmin creates a platform_admin row with a
 * placeholder `userId` (crypto.randomUUID), so the invitee can never satisfy
 * `platformAdminAuthMiddleware.findByUserId`. This handler binds that row to
 * the invitee's REAL Better-Auth `userId`, keyed on their verified email, so
 * subsequent requests pass the gate. The verified-email match is the claim
 * credential: platform_admin.email is unique, and Better-Auth enforces one
 * account per email, so only the intended invitee can claim their row.
 */
export async function claimAdminInvite(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as { id: string; email?: string; emailVerified?: boolean } | undefined;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  // An unverified email must not be allowed to claim privileged admin access.
  if (user.emailVerified === false) {
    return ctx.json({ error: 'Verify your email before claiming an admin invitation' }, 403);
  }

  const email = (user.email ?? '').toLowerCase().trim();
  if (!email) {
    return ctx.json({ error: 'Authenticated account has no email to match an invitation' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PlatformAdminRepository(db, logger);

  const admin = await repo.findByEmail(email);
  if (!admin) {
    return ctx.json({ error: 'No platform admin invitation found for this account' }, 404);
  }

  // Idempotent: the row is already bound to this user — nothing to do.
  if (admin.userId === user.id) {
    return ctx.json({ id: admin.id, email: admin.email, role: admin.role, claimed: true }, 200);
  }

  // Bind the invited row to the authenticated Better-Auth user.
  const bound = await repo.update(admin.id, { userId: user.id });

  ctx.set('auditResourceId', admin.id);
  ctx.set('auditDescription', `Platform admin invitation for "${admin.email}" claimed by user ${user.id}`);

  domainEvents
    .emit('admin.invite.claimed', {
      adminId: admin.id,
      userId: user.id,
      email: admin.email,
      role: admin.role,
    })
    .catch(() => {});

  return ctx.json({ id: admin.id, email: bound?.email ?? admin.email, role: admin.role, claimed: true }, 200);
}
