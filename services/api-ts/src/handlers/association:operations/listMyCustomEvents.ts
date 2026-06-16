import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListMyCustomEventsQuery } from '@/generated/openapi/validators';
import { events, eventRegistrations } from './repos/events.schema';
import { clampPageSize } from '@/core/pagination';
import { eq, desc } from 'drizzle-orm';

/**
 * listMyCustomEvents
 *
 * Path: GET /association/event-lifecycle/my
 * OperationId: listMyCustomEvents
 *
 * Returns events the authenticated user is registered for.
 * Response shape: { data: [{ registration: {...}, event: {...} }] }
 */
export async function listMyCustomEvents(
  ctx: ValidatedContext<never, ListMyCustomEventsQuery, never>
): Promise<Response> {
  // Get session directly (route lacks auth middleware)
  const auth = ctx.get('auth' as 'database');
  const session = auth ? await (auth as unknown as { api: { getSession: (opts: { headers: Headers }) => Promise<{ user: { id: string } } | null> } }).api.getSession({ headers: ctx.req.raw.headers }) : null;
  if (!session?.user) return ctx.json({ error: 'Unauthorized' }, 401);

  const userId = session.user.id;
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const limit = clampPageSize(query.limit === undefined ? 20 : Number(query.limit));
  const offset = Math.max(0, Number(query.offset) || 0);

  const rows = await db
    .select({
      // Event fields
      eventId: events.id,
      eventTitle: events.title,
      eventType: events.eventType,
      eventDescription: events.description,
      eventLocation: events.location,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      eventCapacity: events.capacity,
      eventRegistrationFee: events.registrationFee,
      eventCurrency: events.currency,
      eventCreditBearing: events.creditBearing,
      eventCreditAmount: events.creditAmount,
      eventStatus: events.status,
      eventVisibility: events.visibility,
      eventOrganizationId: events.organizationId,
      // Registration fields
      regId: eventRegistrations.id,
      regStatus: eventRegistrations.status,
      regPersonId: eventRegistrations.personId,
      regEventId: eventRegistrations.eventId,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(eq(eventRegistrations.personId, userId))
    .orderBy(desc(events.startDate))
    .limit(limit)
    .offset(offset);

  // Shape into { registration, event } pairs that frontend expects
  const data = rows.map((r) => ({
    registration: {
      id: r.regId,
      status: r.regStatus,
      personId: r.regPersonId,
      eventId: r.regEventId,
    },
    event: {
      id: r.eventId,
      title: r.eventTitle,
      eventType: r.eventType,
      description: r.eventDescription,
      location: r.eventLocation,
      startDate: r.eventStartDate,
      endDate: r.eventEndDate,
      capacity: r.eventCapacity,
      registrationFee: r.eventRegistrationFee,
      currency: r.eventCurrency,
      creditBearing: r.eventCreditBearing,
      creditAmount: r.eventCreditAmount,
      status: r.eventStatus,
      visibility: r.eventVisibility,
      organizationId: r.eventOrganizationId,
    },
  }));

  return ctx.json({ data, totalCount: data.length, limit, offset }, 200);
}
