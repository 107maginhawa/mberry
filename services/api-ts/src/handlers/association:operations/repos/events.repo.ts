/**
 * Event repositories - Data access layer for events, registrations, check-ins, and waitlist
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
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
      conditions.push(eq(events.status, filters.status as any));
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

    if (!updated) throw new Error(`Event ${id} not found`);
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

    if (!updated) throw new Error(`Event ${id} not found`);
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
      conditions.push(eq(eventRegistrations.status, filters.status as any));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
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
   */
  async nextPosition(eventId: string): Promise<number> {
    const entries = await this.findMany({ eventId } as WaitlistEntryFilters);
    return entries.length + 1;
  }
}
