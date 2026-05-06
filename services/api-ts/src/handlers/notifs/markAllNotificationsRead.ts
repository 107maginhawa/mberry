import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError } from '@/core/errors';
import { NotificationRepository } from './repos/notification.repo';
import { PersonRepository } from '../person/repos/person.repo';

/**
 * markAllNotificationsRead
 *
 * Path: POST /notifs/read-all
 * OperationId: markAllNotificationsRead
 * Security: bearerAuth
 *
 * Marks all unread notifications for the authenticated user as read.
 * Returns { success: true } on completion.
 */
export async function markAllNotificationsRead(
  ctx: BaseContext
): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user) {
    throw new UnauthorizedError();
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const personRepo = new PersonRepository(db, logger);
  const repo = new NotificationRepository(db, personRepo, logger);

  await repo.markAllAsRead(user.id);

  return ctx.json({ success: true }, 200);
}
