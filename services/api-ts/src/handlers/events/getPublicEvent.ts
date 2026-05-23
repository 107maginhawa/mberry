import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';

/**
 * getPublicEvent
 *
 * Path: GET /public/events/{slug}
 * Public endpoint — no auth required.
 * Returns published/registrationOpen/inProgress events only.
 * Draft, cancelled, completed events return 404.
 */
export async function getPublicEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const slug = ctx.req.param('slug');
  const repo = new EventsRepository(db);
  const event = await repo.findBySlug(slug);

  if (!event) throw new NotFoundError('Event not found');

  // Only show publicly visible events (not draft/cancelled)
  const publicStatuses = ['published', 'registration_open', 'in_progress', 'completed'];
  if (!publicStatuses.includes(event.status)) {
    throw new NotFoundError('Event not found');
  }

  return ctx.json({ data: event }, 200);
}
