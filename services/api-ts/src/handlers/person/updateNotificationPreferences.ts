import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { eq, and } from 'drizzle-orm';
import { ValidationError } from '@/core/errors';
import { notificationPreferences, NOTIFICATION_CATEGORIES } from './repos/notification-preferences.schema';

/**
 * updateNotificationPreferences
 *
 * Path: PATCH /persons/me/notification-preferences
 * Body: { category, pushEnabled?, emailEnabled? }
 *
 * Upserts notification preference for one category.
 */
export async function updateNotificationPreferences(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const body = await ctx.req.json().catch(() => null) as any;
  if (!body?.category) {
    throw new ValidationError('category is required');
  }

  if (!NOTIFICATION_CATEGORIES.includes(body.category)) {
    throw new ValidationError(`Invalid category. Must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}`);
  }

  const db = ctx.get('database') as DatabaseInstance;

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.personId, user.id),
      eq(notificationPreferences.category, body.category),
    ))
    .limit(1);

  const updates = {
    pushEnabled: body.pushEnabled ?? existing?.pushEnabled ?? true,
    emailEnabled: body.emailEnabled ?? existing?.emailEnabled ?? false,
  };

  if (existing) {
    const [row] = await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationPreferences.id, existing.id))
      .returning();
    return ctx.json(row, 200);
  }

  const [row] = await db
    .insert(notificationPreferences)
    .values({
      personId: user.id,
      category: body.category,
      ...updates,
    })
    .returning();

  return ctx.json(row, 201);
}
