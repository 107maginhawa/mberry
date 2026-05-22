import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { eq } from 'drizzle-orm';
import { notificationPreferences, NOTIFICATION_CATEGORIES } from './repos/notification-preferences.schema';

/**
 * getNotificationPreferences
 *
 * Path: GET /persons/me/notification-preferences
 * Returns notification preferences for all categories.
 * Missing categories return defaults (push on, email off).
 */
export async function getNotificationPreferences(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;

  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.personId, user.id));

  // Merge with defaults for missing categories
  const byCategory = new Map(rows.map(r => [r.category, r]));

  const result = NOTIFICATION_CATEGORIES.map(category => ({
    category,
    pushEnabled: byCategory.get(category)?.pushEnabled ?? true,
    emailEnabled: byCategory.get(category)?.emailEnabled ?? false,
    inApp: true, // always on, M02-R8
  }));

  return ctx.json(result, 200);
}
