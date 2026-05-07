import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { eq } from 'drizzle-orm';
import { notificationPreferences, NOTIFICATION_CATEGORIES } from './repos/notification-preferences.schema';

/**
 * getMyNotificationPreferences
 *
 * Path: GET /notification-preferences
 * OperationId: getMyNotificationPreferences
 */
export async function getMyNotificationPreferences(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;

  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.personId, personId));

  const byCategory = new Map(rows.map(r => [r.category, r]));

  const result = NOTIFICATION_CATEGORIES.map(category => ({
    category,
    pushEnabled: byCategory.get(category)?.pushEnabled ?? true,
    emailEnabled: byCategory.get(category)?.emailEnabled ?? false,
    inApp: true, // always on, M02-R8
  }));

  return ctx.json(result, 200);
}
