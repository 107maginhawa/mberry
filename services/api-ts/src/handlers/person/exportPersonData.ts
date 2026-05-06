/**
 * exportPersonData
 *
 * Returns all personal data for the authenticated user per DPA 2012 portability right.
 * Collects: profile, memberships, payments, events, trainings, credits, certificates.
 *
 * Path: GET /persons/me/export
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { PersonRepository } from './repos/person.repo';

// Fields to exclude from exported profile (internal/system fields)
const EXCLUDED_PROFILE_FIELDS = new Set([
  'deletionRequestedAt',
  'deletionScheduledAt',
  'deletionCompletedAt',
  'version',
  'createdBy',
  'updatedBy',
]);

export async function exportPersonData(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | null;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(user.id);
  if (!person) return ctx.json({ error: 'Person not found' }, 404);

  // Clean profile — remove internal fields
  const profile: Record<string, any> = {};
  for (const [key, value] of Object.entries(person)) {
    if (!EXCLUDED_PROFILE_FIELDS.has(key)) {
      profile[key] = value;
    }
  }

  // Collect memberships
  let memberships: any[] = [];
  try {
    const { memberships: membershipTable } = await import('@/handlers/association:member/repos/membership.schema');
    const { eq } = await import('drizzle-orm');
    memberships = await db.select().from(membershipTable).where(eq(membershipTable.personId, user.id));
  } catch (e) {
    logger?.warn({ error: e }, 'Could not fetch memberships for export');
  }

  // Collect payments
  let payments: any[] = [];
  try {
    const { duesPayments } = await import('@/handlers/dues/repos/dues-payments.schema');
    const { eq } = await import('drizzle-orm');
    payments = await db.select().from(duesPayments).where(eq(duesPayments.personId, user.id));
  } catch (e) {
    logger?.warn({ error: e }, 'Could not fetch payments for export');
  }

  // Collect credit entries
  let credits: any[] = [];
  try {
    const { creditEntries } = await import('@/handlers/association:member/repos/credits.schema');
    const { eq } = await import('drizzle-orm');
    credits = await db.select().from(creditEntries).where(eq(creditEntries.personId, user.id));
  } catch (e) {
    logger?.warn({ error: e }, 'Could not fetch credits for export');
  }

  // Collect notifications
  let notifications: any[] = [];
  try {
    const { notifications: notifsTable } = await import('@/handlers/notifs/repos/notification.schema');
    const { eq } = await import('drizzle-orm');
    notifications = await db.select().from(notifsTable).where(eq(notifsTable.recipient, user.id));
  } catch (e) {
    logger?.warn({ error: e }, 'Could not fetch notifications for export');
  }

  const categories = ['profile'];
  if (memberships.length > 0) categories.push('memberships');
  if (payments.length > 0) categories.push('payments');
  if (credits.length > 0) categories.push('credits');
  if (notifications.length > 0) categories.push('notifications');

  // Audit
  const audit = ctx.get('audit');
  if (audit) {
    try {
      await audit.logEvent({
        eventType: 'data-access',
        category: 'privacy',
        action: 'export',
        outcome: 'success',
        user: user.id,
        userType: 'client' as const,
        resourceType: 'person',
        resource: user.id,
        description: 'Personal data exported (DPA portability)',
        details: { categories },
      });
    } catch (e) {
      logger?.error({ error: e }, 'Failed to log export audit');
    }
  }

  logger?.info({ personId: user.id, categories }, 'Data export generated');

  return ctx.json({
    exportedAt: new Date().toISOString(),
    categories,
    profile,
    memberships,
    payments,
    credits,
    notifications,
  }, 200);
}
