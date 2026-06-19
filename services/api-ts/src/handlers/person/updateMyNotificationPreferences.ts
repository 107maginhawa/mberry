import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { UpdateMyNotificationPreferencesBody } from '@/generated/openapi/validators';
import { eq, and } from 'drizzle-orm';
import { notificationPreferences, NOTIFICATION_CATEGORIES } from './repos/notification-preferences.schema';

/**
 * updateMyNotificationPreferences
 *
 * Path: PATCH /notification-preferences
 * OperationId: updateMyNotificationPreferences
 */
export async function updateMyNotificationPreferences(
  ctx: ValidatedContext<UpdateMyNotificationPreferencesBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;
  const organizationId = ctx.get('organizationId') as string;
  const body = ctx.req.valid('json');
  // The request contract carries updates under `preferences[]`. The UI toggles
  // one category at a time, so operate on the first entry (single-row response).
  const b = body.preferences?.[0];

  if (!b?.category) throw new ValidationError('category is required');
  if (!NOTIFICATION_CATEGORIES.includes(b.category as typeof NOTIFICATION_CATEGORIES[number])) {
    throw new ValidationError(`Invalid category. Must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}`);
  }

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.personId, personId),
      eq(notificationPreferences.category, b.category),
    ))
    .limit(1);

  const updates = {
    pushEnabled: b.pushEnabled ?? existing?.pushEnabled ?? true,
    emailEnabled: b.emailEnabled ?? existing?.emailEnabled ?? false,
  };

  let row;
  if (existing) {
    [row] = await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationPreferences.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(notificationPreferences)
      .values({ personId, category: b.category, organizationId, ...updates })
      .returning();
  }

  ctx.set('auditResourceId', personId);
  ctx.set('auditDescription', `Notification preference updated: ${b.category}`);
  ctx.set('auditDetails', { category: b.category });

  return ctx.json(row, existing ? 200 : 201);
}
