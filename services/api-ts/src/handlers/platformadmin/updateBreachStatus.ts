/**
 * updateBreachStatus
 *
 * Path: PUT /admin/breaches/:id
 * Transitions breach incident status (DPA 2012 / M3-R11).
 * Valid transitions: reported→investigating, investigating→notified, notified→resolved
 * When notified: npcReferenceNumber required, notifiedAt set to now.
 * When resolved: resolvedAt set to now.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError, ValidationError } from '@/core/errors';
import { breachIncidents, type BreachIncident } from './repos/platform-admin.schema';
import { auditAction } from '@/core/audit/audit-action';
import { requireAdminTier, SUPPORT_OR_SUPER } from '@/core/auth/admin-tier';

const VALID_TRANSITIONS: Record<string, string> = {
  reported: 'investigating',
  investigating: 'notified',
  notified: 'resolved',
};

export async function updateBreachStatus(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const admin = ctx.get('platformAdmin');
  if (!admin) return ctx.json({ error: 'Platform admin access required' }, 403);

  // FIX-008 (G1) / Q8: transitioning breach status is a support-or-super
  // mutation; analyst is read-only.
  const denied = requireAdminTier(ctx, SUPPORT_OR_SUPER);
  if (denied) return denied;

  const db = ctx.get('database') as DatabaseInstance;
  const id = ctx.req.param('id') as string;
  const body = await ctx.req.json();
  const { status, npcReferenceNumber } = body as { status?: string; npcReferenceNumber?: string };

  // status presence + enum guaranteed by zValidator in app.ts

  const [existing] = await db
    .select()
    .from(breachIncidents)
    .where(eq(breachIncidents.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Breach incident not found');
  }

  const allowedNext = VALID_TRANSITIONS[existing.status];
  if (allowedNext !== status) {
    throw new BusinessLogicError(
      `Invalid transition from "${existing.status}" to "${status}". Expected "${allowedNext}"`,
      'INVALID_BREACH_TRANSITION',
    );
  }

  if (status === 'notified' && !npcReferenceNumber) {
    throw new ValidationError('npcReferenceNumber is required when marking a breach as notified');
  }

  const now = new Date();

  // Build a typed partial update — avoid index-signature Record<string,unknown>
  const patch: Partial<BreachIncident> = {
    status: status as BreachIncident['status'],
    updatedAt: now,
    updatedBy: admin.userId,
  };

  if (status === 'notified') {
    patch.notifiedAt = now;
    patch.npcReferenceNumber = npcReferenceNumber;
  }
  if (status === 'resolved') {
    patch.resolvedAt = now;
  }

  const [updated] = await db
    .update(breachIncidents)
    .set(patch)
    .where(eq(breachIncidents.id, id))
    .returning();

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'breach_incident',
    resourceId: id,
    description: `Breach status transitioned from "${existing.status}" to "${status}"`,
  });

  return ctx.json({ data: updated }, 200);
}
