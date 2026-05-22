import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { UpdateMyNotificationPreferencesBody } from '@/generated/openapi/validators';
import { eq, and } from 'drizzle-orm';
import { notificationPreferences, NOTIFICATION_CATEGORIES } from './repos/notification-preferences.schema';
import { auditAction } from '@/utils/audit';

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
  const b = body as Record<string, unknown>;

  if (!b['category']) throw new ValidationError('category is required');
  if (!NOTIFICATION_CATEGORIES.includes(b['category'] as typeof NOTIFICATION_CATEGORIES[number])) {
    throw new ValidationError(`Invalid category. Must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}`);
  }

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.personId, personId),
      eq(notificationPreferences.category, b['category'] as string),
    ))
    .limit(1);

  const updates = {
    pushEnabled: (b['pushEnabled'] as boolean | undefined) ?? existing?.pushEnabled ?? true,
    emailEnabled: (b['emailEnabled'] as boolean | undefined) ?? existing?.emailEnabled ?? false,
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
      .values({ personId, category: b['category'] as string, organizationId, ...updates })
      .returning();
  }

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'notification-preferences',
    resourceId: personId,
    description: `Notification preference updated: ${b['category']}`,
    details: { category: b['category'] as string },
  });

  return ctx.json(row, existing ? 200 : 201);
}
