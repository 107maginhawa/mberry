/**
 * Event repositories - Data access layer for events, registrations, check-ins, and waitlist
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { NotFoundError } from '@/core/errors';
import {
  events,
  eventRegistrations,
  checkIns,
  waitlistEntries,
  type Event,
  type NewEvent,
  type EventRegistration,
  type NewEventRegistration,
  type CheckIn,
  type NewCheckIn,
  type WaitlistEntry,
  type NewWaitlistEntry,
} from './events.schema';

// ---------------------------------------------------------------------------
// EventRepository
// ---------------------------------------------------------------------------

export interface EventFilters {
  organizationId?: string;
  status?: string;
}

export class EventRepository extends DatabaseRepository<Event, NewEvent, EventFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, events, logger);
  }

  protected buildWhereConditions(filters?: EventFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(events.organizationId, filters.organizationId));
    }
    if (filters.status) {
      conditions.push(eq(events.status, filters.status as Event['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Publish a draft event: set status to published and record publishedAt.
   */
  async publish(id: string): Promise<Event> {
    const [updated] = await this.db
      .update(events)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    if (!updated) throw new NotFoundError(`Event ${id} not found`, { resourceType: 'Event', resource: id });
    return updated as Event;
  }

  /**
   * Complete an event: set status to completed.
   */
  async complete(id: string): Promise<Event> {
    const [updated] = await this.db
      .update(events)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    if (!updated) throw new NotFoundError(`Event ${id} not found`, { resourceType: 'Event', resource: id });
    return updated as Event;
  }

  /**
   * Cancel an event: set status to cancelled.
   */
  async cancel(id: string): Promise<Event> {
    const [updated] = await this.db
      .update(events)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    if (!updated) throw new NotFoundError(`Event ${id} not found`, { resourceType: 'Event', resource: id });
    return updated as Event;
  }
}

// ---------------------------------------------------------------------------
// EventRegistrationRepository
// ---------------------------------------------------------------------------

export interface EventRegistrationFilters {
  eventId?: string;
  personId?: string;
  status?: string;
}

export class EventRegistrationRepository extends DatabaseRepository<
  EventRegistration,
  NewEventRegistration,
  EventRegistrationFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, eventRegistrations, logger);
  }

  protected buildWhereConditions(filters?: EventRegistrationFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.eventId) {
      conditions.push(eq(eventRegistrations.eventId, filters.eventId));
    }
    if (filters.personId) {
      conditions.push(eq(eventRegistrations.personId, filters.personId));
    }
    if (filters.status) {
      conditions.push(eq(eventRegistrations.status, filters.status as EventRegistration['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Aggregate attendee counts for one event's door screen — a single query (no N+1, no 100-row
   * cap). Counts use the REAL registration_status enum values ('cancelled'/'refunded'/'noShow');
   * check_in links by (event_id, person_id) — there is no registration_id on check_in — so a person
   * with multiple check-ins fans out the join, hence COUNT(DISTINCT registration) on every total.
   */
  async summaryByEvent(
    eventId: string,
    orgId: string,
  ): Promise<{ totalAttending: number; paid: number; checkedIn: number; noShow: number }> {
    const attending = sql`${eventRegistrations.status} NOT IN ('cancelled', 'refunded')`;
    const [row] = await this.db
      .select({
        totalAttending: sql<number>`COUNT(DISTINCT ${eventRegistrations.id}) FILTER (WHERE ${attending})::int`,
        paid: sql<number>`COUNT(DISTINCT ${eventRegistrations.id}) FILTER (WHERE ${attending} AND ${eventRegistrations.paidAt} IS NOT NULL)::int`,
        checkedIn: sql<number>`COUNT(DISTINCT ${eventRegistrations.id}) FILTER (WHERE ${attending} AND ${checkIns.id} IS NOT NULL)::int`,
        noShow: sql<number>`COUNT(DISTINCT ${eventRegistrations.id}) FILTER (WHERE ${eventRegistrations.status} = 'noShow')::int`,
      })
      .from(eventRegistrations)
      .leftJoin(
        checkIns,
        and(eq(checkIns.eventId, eventRegistrations.eventId), eq(checkIns.personId, eventRegistrations.personId)),
      )
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.organizationId, orgId)));
    return {
      totalAttending: row?.totalAttending ?? 0,
      paid: row?.paid ?? 0,
      checkedIn: row?.checkedIn ?? 0,
      noShow: row?.noShow ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// CheckInRepository
// ---------------------------------------------------------------------------

export interface CheckInFilters {
  eventId?: string;
  personId?: string;
}

export class CheckInRepository extends DatabaseRepository<CheckIn, NewCheckIn, CheckInFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, checkIns, logger);
  }

  protected buildWhereConditions(filters?: CheckInFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.eventId) {
      conditions.push(eq(checkIns.eventId, filters.eventId));
    }
    if (filters.personId) {
      conditions.push(eq(checkIns.personId, filters.personId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// WaitlistEntryRepository
// ---------------------------------------------------------------------------

export interface WaitlistEntryFilters {
  eventId?: string;
  personId?: string;
}

export class WaitlistEntryRepository extends DatabaseRepository<
  WaitlistEntry,
  NewWaitlistEntry,
  WaitlistEntryFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, waitlistEntries, logger);
  }

  protected buildWhereConditions(filters?: WaitlistEntryFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.eventId) {
      conditions.push(eq(waitlistEntries.eventId, filters.eventId));
    }
    if (filters.personId) {
      conditions.push(eq(waitlistEntries.personId, filters.personId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Get the next position number for a given event's waitlist.
   * Uses MAX(position) + 1 to avoid gaps after deletions/promotions.
   */
  async nextPosition(eventId: string): Promise<number> {
    const entries = await this.findMany({ eventId } as WaitlistEntryFilters);
    if (entries.length === 0) return 1;
    return Math.max(...entries.map(e => e.position ?? 0)) + 1;
  }

  /**
   * Promote the next unpromoted waitlist entry (FIFO by position).
   * Sets promotedAt timestamp. Returns the promoted entry or null if none.
   */
  async promoteNext(eventId: string): Promise<WaitlistEntry | null> {
    const entries = await this.findMany({ eventId } as WaitlistEntryFilters);
    const unpromoted = entries
      .filter(e => !e.promotedAt)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (unpromoted.length === 0) return null;
    const next = unpromoted[0]!;
    const [promoted] = await this.db
      .update(waitlistEntries)
      .set({ promotedAt: new Date(), updatedAt: new Date() } as Partial<WaitlistEntry>)
      .where(eq(waitlistEntries.id, next.id))
      .returning();
    return promoted as WaitlistEntry;
  }
}
