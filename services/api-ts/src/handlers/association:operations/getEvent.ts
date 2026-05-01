import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetEventParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';

/**
 * getEvent
 *
 * Path: GET /association/events/{eventId}
 * OperationId: getEvent
 */
export async function getEvent(
  ctx: ValidatedContext<never, never, GetEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const event = await repo.findOneById((params as any).eventId);
  if (!event) throw new NotFoundError('Event not found');

  return ctx.json(event, 200);
}
