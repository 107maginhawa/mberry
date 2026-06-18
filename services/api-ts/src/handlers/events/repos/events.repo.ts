import { eq, and, desc, gte, lte, like, sql, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { escapeLikePattern } from '@/utils/sanitize';
import {
  events,
  eventRegistrations,
  checkIns,
  type Event,
  type NewEvent,
  type EventRegistration,
  type NewEventRegistration,
  type CheckIn,
  type NewCheckIn,
} from '../../association:operations/repos/events.schema';

export class EventsRepository {
  constructor(private db: DatabaseInstance) {}

  async list(
    orgId: string,
    filters?: {
      status?: string;
      type?: string;
      search?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions: SQL<unknown>[] = [
      eq(events.organizationId, orgId),
    ];
    if (filters?.status) {
      const statuses = filters.status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        conditions.push(eq(events.status, statuses[0] as Event['status']));
      } else {
        conditions.push(inArray(events.status, statuses as Event['status'][]));
      }
    }
    if (filters?.type) conditions.push(eq(events.eventType, filters.type as NonNullable<Event['eventType']>));
    if (filters?.search) conditions.push(like(events.title, `%${escapeLikePattern(filters.search)}%`));
    if (filters?.from) conditions.push(gte(events.startDate, filters.from));
    if (filters?.to) conditions.push(lte(events.startDate, filters.to));

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.startDate))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(...conditions)),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<Event | undefined> {
    const [event] = await this.db.select().from(events).where(eq(events.id, id)).limit(1);
    return event;
  }

  async listPublic(filters?: {
    eventType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    pricing?: 'free' | 'paid' | 'all';
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: SQL<unknown>[] = [
      eq(events.visibility, 'network'),
      inArray(events.status, ['published', 'completed'] as Event['status'][]),
    ];

    if (filters?.eventType) conditions.push(eq(events.eventType, filters.eventType as NonNullable<Event['eventType']>));
    if (filters?.dateFrom) conditions.push(gte(events.startDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(events.startDate, filters.dateTo));
    if (filters?.search) conditions.push(like(events.title, `%${escapeLikePattern(filters.search)}%`));
    if (filters?.pricing === 'free') conditions.push(eq(events.registrationFee, 0));
    if (filters?.pricing === 'paid') conditions.push(sql`${events.registrationFee} > 0`);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.startDate))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(...conditions)),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async findBySlug(slug: string): Promise<Event | undefined> {
    const [event] = await this.db.select().from(events).where(eq(events.eventSlug, slug)).limit(1);
    return event;
  }

  async create(data: NewEvent): Promise<Event> {
    const [result] = await this.db.insert(events).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<Event>): Promise<Event> {
    const [result] = await this.db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return result!;
  }

  async getStats(orgId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [stats] = await this.db
      .select({
        totalThisMonth: sql<number>`count(CASE WHEN ${events.startDate} >= ${monthStart} THEN 1 END)::int`,
        totalRegistrations: sql<number>`0::int`,
      })
      .from(events)
      .where(eq(events.organizationId, orgId));
    return stats;
  }

  // Registrations
  async listRegistrations(eventId: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId))
      .orderBy(eventRegistrations.createdAt)
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);
  }

  async register(data: NewEventRegistration): Promise<EventRegistration> {
    const [result] = await this.db.insert(eventRegistrations).values(data).returning();
    return result!;
  }

  /**
   * P0 RACE FIX + P1 single-row transition: atomic capacity-aware registration.
   *
   * Single-row-per-(event,person) model (industry standard): a person holds at
   * most ONE registration row per event, which TRANSITIONS through states rather
   * than spawning duplicate rows. All work happens inside ONE serializable-by-lock
   * transaction:
   *   - `SELECT … FOR UPDATE` on the parent event row serialises concurrent
   *     registrants for the SAME event, so the confirmed-count each one sees
   *     already reflects the other's committed write — capacity is race-safe.
   *   - Look up the existing (event, person) row and branch:
   *       • none                  → INSERT 'confirmed' (or 'waitlisted' at cap)
   *       • existing 'confirmed'   → idempotent: return it unchanged (handler 409)
   *       • existing 'waitlisted'  → idempotent: return it unchanged (graceful,
   *                                  promotion happens via the waitlist path)
   *       • terminal ('cancelled' | 'refunded' | 'noShow')
   *                                → RE-ACTIVATE: UPDATE the SAME row back to
   *                                  'confirmed' (or 'waitlisted' at cap). One row
   *                                  preserved, so the unique index stays satisfied.
   *   - If confirmed >= capacity the (re)activated row is 'waitlisted' instead of
   *     'confirmed' (preserves existing waitlist product behaviour) — capacity can
   *     never be exceeded.
   *   - The partial unique index uq_event_reg_active remains the backstop for the
   *     true concurrent double-INSERT race: two registrants with no existing row
   *     both inserting — the loser raises 23505, surfaced as a duplicate.
   *
   * @returns the registration row plus an `outcome` discriminator:
   *   - 'created'      a brand new row was inserted ('confirmed' | 'waitlisted')
   *   - 'reactivated'  a terminal row was transitioned back to active
   *   - 'idempotent'   an already-active row was returned unchanged (the handler
   *                    maps a 'confirmed' idempotent to 409 "already registered")
   * @throws  Error with code '23505' on a genuinely concurrent duplicate insert.
   */
  async registerAtomic(input: {
    eventId: string;
    personId: string;
    organizationId: string;
    capacity: number | null;
    createdBy: string;
    updatedBy: string;
  }): Promise<EventRegistration & { outcome: 'created' | 'reactivated' | 'idempotent' }> {
    const TERMINAL: EventRegistration['status'][] = ['cancelled', 'refunded', 'noShow'];

    return this.db.transaction(async (tx) => {
      // Lock the event row so concurrent registrants for THIS event serialise.
      await tx
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, input.eventId))
        .for('update')
        .limit(1);

      // Find an existing row for (event, person). There is at most one active
      // row (unique index), but a terminal row may also exist — pick whichever.
      const [existing] = await tx
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, input.eventId),
            eq(eventRegistrations.personId, input.personId),
          ),
        )
        .limit(1);

      // Already active → idempotent, no state change. Handler treats 'confirmed'
      // as a 409 "already registered" and 'waitlisted' as a graceful waitlist
      // response; neither surfaces a 23505.
      if (existing && (existing.status === 'confirmed' || existing.status === 'waitlisted')) {
        return { ...existing, outcome: 'idempotent' };
      }

      // Compute the target active status from current confirmed capacity.
      let status: EventRegistration['status'] = 'confirmed';
      if (input.capacity != null) {
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, input.eventId),
              eq(eventRegistrations.status, 'confirmed'),
            ),
          );
        const confirmed = countRow?.count ?? 0;
        if (confirmed >= input.capacity) {
          status = 'waitlisted';
        }
      }

      // Existing terminal row → RE-ACTIVATE the SAME row (single-row model).
      if (existing && TERMINAL.includes(existing.status)) {
        const [result] = await tx
          .update(eventRegistrations)
          .set({
            status,
            cancelledAt: null,
            refundedAt: null,
            updatedBy: input.updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(eventRegistrations.id, existing.id))
          .returning();
        return { ...result!, outcome: 'reactivated' };
      }

      // No existing row → fresh insert. Unique index is the backstop for a
      // genuinely concurrent double-insert (loser raises 23505).
      const [result] = await tx
        .insert(eventRegistrations)
        .values({
          eventId: input.eventId,
          personId: input.personId,
          organizationId: input.organizationId,
          status,
          createdBy: input.createdBy,
          updatedBy: input.updatedBy,
        })
        .returning();
      return { ...result!, outcome: 'created' };
    });
  }

  async getRegistrationCount(eventId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, 'confirmed'),
        ),
      );
    return result?.count ?? 0;
  }

  // Check-ins (attendance)
  async listAttendance(eventId: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(checkIns)
      .where(eq(checkIns.eventId, eventId))
      .orderBy(desc(checkIns.checkedInAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);
  }

  async checkIn(data: NewCheckIn): Promise<CheckIn> {
    const [result] = await this.db.insert(checkIns).values(data).returning();
    return result!;
  }

  async isCheckedIn(eventId: string, personId: string): Promise<boolean> {
    const [existing] = await this.db
      .select()
      .from(checkIns)
      .where(
        and(eq(checkIns.eventId, eventId), eq(checkIns.personId, personId)),
      )
      .limit(1);
    return !!existing;
  }

  async getAttendanceStats(eventId: string) {
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        qr: sql<number>`count(CASE WHEN ${checkIns.method} = 'qr' THEN 1 END)::int`,
        manual: sql<number>`count(CASE WHEN ${checkIns.method} = 'manual' THEN 1 END)::int`,
      })
      .from(checkIns)
      .where(eq(checkIns.eventId, eventId));
    return stats;
  }

  async getRegistration(registrationId: string): Promise<EventRegistration | undefined> {
    const [reg] = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.id, registrationId))
      .limit(1);
    return reg;
  }

  async getFirstWaitlisted(eventId: string): Promise<EventRegistration | undefined> {
    const [reg] = await this.db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, 'waitlisted'),
        ),
      )
      .orderBy(eventRegistrations.createdAt)
      .limit(1);
    return reg;
  }

  async updateRegistration(registrationId: string, data: Partial<EventRegistration>): Promise<EventRegistration> {
    const [result] = await this.db
      .update(eventRegistrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eventRegistrations.id, registrationId))
      .returning();
    return result!;
  }

  // Member view
  async listByPerson(personId: string) {
    return this.db
      .select({ registration: eventRegistrations, event: events })
      .from(eventRegistrations)
      .innerJoin(events, eq(eventRegistrations.eventId, events.id))
      .where(eq(eventRegistrations.personId, personId))
      .orderBy(desc(events.startDate));
  }
}
