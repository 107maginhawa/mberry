import { eq, and, desc, gte, lte, like, sql, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
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
    if (filters?.search) conditions.push(like(events.title, `%${filters.search}%`));
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
    if (filters?.search) conditions.push(like(events.title, `%${filters.search}%`));
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
  async listRegistrations(eventId: string) {
    return this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId))
      .orderBy(eventRegistrations.createdAt);
  }

  async register(data: NewEventRegistration): Promise<EventRegistration> {
    const [result] = await this.db.insert(eventRegistrations).values(data).returning();
    return result!;
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
  async listAttendance(eventId: string) {
    return this.db
      .select()
      .from(checkIns)
      .where(eq(checkIns.eventId, eventId))
      .orderBy(desc(checkIns.checkedInAt));
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
