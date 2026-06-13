/**
 * reportBreach
 *
 * Path: POST /admin/breaches
 * Records a new personal data breach incident under DPA 2012 / M3-R11.
 * Computes the 72-hour NPC notification deadline from discoveredAt.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';
import { breachIncidents } from './repos/platform-admin.schema';
import { requireAdminTier, SUPPORT_OR_SUPER } from '@/core/auth/admin-tier';

export async function reportBreach(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const admin = ctx.get('platformAdmin');
  if (!admin) return ctx.json({ error: 'Platform admin access required' }, 403);

  // FIX-008 (G1) / Q8: reporting a breach is a support-or-super mutation;
  // analyst is read-only.
  const denied = requireAdminTier(ctx, SUPPORT_OR_SUPER);
  if (denied) return denied;

  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'platformadmin' }) ?? baseLogger;

  const body = await ctx.req.json();
  const { organizationId, discoveredAt, description, affectedRecordsCount, dataCategories } = body;

  // discoveredAt and description presence guaranteed by zValidator in app.ts

  const discovered = new Date(discoveredAt);
  if (Number.isNaN(discovered.getTime())) {
    throw new ValidationError('discoveredAt must be a valid ISO date');
  }
  if (discovered > new Date()) {
    throw new ValidationError('discoveredAt cannot be in the future');
  }

  // DPA 2012: 72-hour deadline for NPC notification
  const notificationDeadline = new Date(discovered.getTime() + 72 * 60 * 60 * 1000);
  const now = new Date();

  const [breach] = await db.insert(breachIncidents).values({
    organizationId: organizationId ?? null,
    reportedBy: admin.userId,
    discoveredAt: discovered,
    description,
    affectedRecordsCount: affectedRecordsCount ?? null,
    dataCategories: dataCategories ?? null,
    notificationDeadline,
    status: 'reported',
    createdBy: admin.userId,
    updatedBy: admin.userId,
  }).returning();

  if (!breach) {
    logger.error('Failed to insert breach incident');
    return ctx.json({ error: 'Failed to create breach incident' }, 500);
  }

  const hoursRemaining = (breach.notificationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  await domainEvents.emit('breach.reported', {
    breachId: breach.id,
    reportedBy: breach.reportedBy,
    organizationId: breach.organizationId ?? null,
    discoveredAt: breach.discoveredAt.toISOString(),
    notificationDeadline: breach.notificationDeadline.toISOString(),
    description: breach.description,
  });

  logger.info({ action: 'reportBreach.1', breachId: breach.id, hoursRemaining }, 'Breach incident reported');

  return ctx.json({ data: breach, hoursRemaining: Math.max(0, hoursRemaining) }, 201);
}
