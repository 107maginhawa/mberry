/**
 * Repositories for communication module.
 */

import { eq, and, gte, lte, like, sql, desc, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import type { DatabaseInstance } from '@/core/database';
import { escapeLikePattern } from '@/utils/sanitize';
import {
  messageTemplates, messages, subscriptionTopics, personSubscriptions,
  announcements, announcementStats, savedSegments,
  type NewMessageTemplate, type MessageTemplate,
  type NewMessage, type Message,
  type NewSubscriptionTopic, type SubscriptionTopic,
  type NewPersonSubscription, type PersonSubscription,
  type Announcement, type NewAnnouncement, type AnnouncementStats,
  type SavedSegment, type NewSavedSegment,
} from './communication.schema';

export class MessageTemplateRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewMessageTemplate): Promise<MessageTemplate> {
    const [row] = await this.db.insert(messageTemplates).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<MessageTemplate | undefined> {
    const [row] = await this.db.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
    return row;
  }

  async findByOrg(organizationId: string): Promise<MessageTemplate[]> {
    return this.db.select().from(messageTemplates).where(eq(messageTemplates.organizationId, organizationId)).limit(100);
  }

  async search(organizationId: string, filters: {
    q?: string;
    channel?: string;
    category?: string;
    status?: string;
    isTransactional?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<MessageTemplate[]> {
    const conditions = [eq(messageTemplates.organizationId, organizationId)];
    if (filters.channel) conditions.push(eq(messageTemplates.channel, filters.channel as MessageTemplate['channel']));
    if (filters.category) conditions.push(eq(messageTemplates.category, filters.category));
    if (filters.status) conditions.push(eq(messageTemplates.status, filters.status as MessageTemplate['status']));
    if (filters.isTransactional !== undefined) conditions.push(eq(messageTemplates.isTransactional, filters.isTransactional));
    if (filters.q) conditions.push(like(messageTemplates.name, `%${filters.q}%`));

    return this.db.select().from(messageTemplates)
      .where(and(...conditions))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);
  }

  async update(id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate | undefined> {
    const [row] = await this.db.update(messageTemplates).set({ ...data, updatedAt: new Date() }).where(eq(messageTemplates.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  }
}

export class MessageRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewMessage): Promise<Message> {
    const [row] = await this.db.insert(messages).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<Message | undefined> {
    const [row] = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return row;
  }

  async findByOrg(organizationId: string): Promise<Message[]> {
    return this.db.select().from(messages).where(eq(messages.organizationId, organizationId)).limit(100);
  }

  async search(organizationId: string, filters: {
    channel?: string;
    senderId?: string;
    status?: string;
    scheduledAfter?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Message[]> {
    const conditions = [eq(messages.organizationId, organizationId)];
    if (filters.channel) conditions.push(eq(messages.channel, filters.channel as Message['channel']));
    if (filters.senderId) conditions.push(eq(messages.senderId, filters.senderId));
    if (filters.status) conditions.push(eq(messages.status, filters.status as Message['status']));
    if (filters.scheduledAfter) conditions.push(gte(messages.scheduledAt, filters.scheduledAfter));

    return this.db.select().from(messages)
      .where(and(...conditions))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);
  }

  /**
   * BR-28 deduplication: check if a message with same channel + recipient was already sent today.
   */
  async findDuplicateSentToday(organizationId: string, channel: string, recipientPersonId: string): Promise<Message | undefined> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await this.db.select().from(messages)
      .where(and(
        eq(messages.organizationId, organizationId),
        eq(messages.channel, channel as Message['channel']),
        eq(messages.status, 'sent'),
        gte(messages.sentAt, startOfDay),
      ))
      .limit(100);

    // Check recipients JSONB for matching personId
    return rows.find(m =>
      Array.isArray(m.recipients) && m.recipients.some((r: any) => r.personId === recipientPersonId)
    );
  }

  /**
   * Batch dedup check: returns person IDs from the given list who already
   * received a message on this channel today. Single query replaces N+1.
   */
  async findDuplicatesSentToday(organizationId: string, channel: string, personIds: string[]): Promise<string[]> {
    if (personIds.length === 0) return [];

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await this.db.select().from(messages)
      .where(and(
        eq(messages.organizationId, organizationId),
        eq(messages.channel, channel as Message['channel']),
        eq(messages.status, 'sent'),
        gte(messages.sentAt, startOfDay),
      ))
      .limit(500);

    const personIdSet = new Set(personIds);
    const duplicates = new Set<string>();

    for (const m of rows) {
      if (Array.isArray(m.recipients)) {
        for (const r of m.recipients) {
          if (r.personId && personIdSet.has(r.personId)) {
            duplicates.add(r.personId);
          }
        }
      }
    }

    return [...duplicates];
  }

  async update(id: string, data: Partial<Message>): Promise<Message | undefined> {
    const [row] = await this.db.update(messages).set({ ...data, updatedAt: new Date() }).where(eq(messages.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(messages).where(eq(messages.id, id));
  }
}

export class SubscriptionTopicRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewSubscriptionTopic): Promise<SubscriptionTopic> {
    const [row] = await this.db.insert(subscriptionTopics).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<SubscriptionTopic | undefined> {
    const [row] = await this.db.select().from(subscriptionTopics).where(eq(subscriptionTopics.id, id)).limit(1);
    return row;
  }

  async findByOrg(organizationId: string): Promise<SubscriptionTopic[]> {
    return this.db.select().from(subscriptionTopics).where(eq(subscriptionTopics.organizationId, organizationId)).limit(100);
  }

  async findByName(organizationId: string, name: string): Promise<SubscriptionTopic | undefined> {
    const [row] = await this.db.select().from(subscriptionTopics)
      .where(and(eq(subscriptionTopics.organizationId, organizationId), eq(subscriptionTopics.name, name)))
      .limit(1);
    return row;
  }

  /**
   * Resolve a subscription topic by (org, name), creating it if absent.
   * Used to map the notification-preferences UI category keys onto real
   * topic UUIDs so person_subscription.topic_id (a uuid column) never
   * receives a synthetic string. Idempotent on the (org, name) pair.
   */
  async findOrCreateByName(
    organizationId: string,
    name: string,
    defaults?: Partial<Pick<NewSubscriptionTopic, 'channel' | 'category' | 'description' | 'defaultEnabled'>>,
  ): Promise<SubscriptionTopic> {
    const existing = await this.findByName(organizationId, name);
    if (existing) return existing;
    return this.create({
      organizationId,
      name,
      channel: defaults?.channel ?? 'email',
      category: defaults?.category ?? name,
      description: defaults?.description ?? null,
      defaultEnabled: defaults?.defaultEnabled ?? true,
    } as NewSubscriptionTopic);
  }

  async update(id: string, data: Partial<SubscriptionTopic>): Promise<SubscriptionTopic | undefined> {
    const [row] = await this.db.update(subscriptionTopics).set({ ...data, updatedAt: new Date() }).where(eq(subscriptionTopics.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(subscriptionTopics).where(eq(subscriptionTopics.id, id));
  }
}

export class PersonSubscriptionRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewPersonSubscription): Promise<PersonSubscription> {
    const [row] = await this.db.insert(personSubscriptions).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<PersonSubscription | undefined> {
    const [row] = await this.db.select().from(personSubscriptions).where(eq(personSubscriptions.id, id)).limit(1);
    return row;
  }

  async findByPerson(personId: string, organizationId: string): Promise<PersonSubscription[]> {
    return this.db.select().from(personSubscriptions)
      .where(and(eq(personSubscriptions.personId, personId), eq(personSubscriptions.organizationId, organizationId)))
      .limit(100);
  }

  /**
   * Like findByPerson, but enriches each row with the topic name so the
   * notification-preferences UI can map a stored topic UUID back to its
   * category and reflect saved toggle state on reload (FIX-005 round-trip).
   */
  async findByPersonWithTopic(
    personId: string,
    organizationId: string,
  ): Promise<Array<PersonSubscription & { topicName: string | null }>> {
    const rows = await this.db
      .select({
        sub: personSubscriptions,
        topicName: subscriptionTopics.name,
      })
      .from(personSubscriptions)
      .leftJoin(subscriptionTopics, eq(personSubscriptions.topicId, subscriptionTopics.id))
      .where(and(eq(personSubscriptions.personId, personId), eq(personSubscriptions.organizationId, organizationId)))
      .limit(100);
    return rows.map((r) => ({ ...r.sub, topicName: r.topicName ?? null }));
  }

  async findByPersonAndTopic(personId: string, topicId: string): Promise<PersonSubscription | undefined> {
    const [row] = await this.db.select().from(personSubscriptions)
      .where(and(eq(personSubscriptions.personId, personId), eq(personSubscriptions.topicId, topicId)))
      .limit(1);
    return row;
  }

  async upsert(data: NewPersonSubscription): Promise<PersonSubscription> {
    const existing = await this.findByPersonAndTopic(data.personId, data.topicId);
    if (existing) {
      const [row] = await this.db.update(personSubscriptions)
        .set({ enabled: data.enabled, updatedAt: new Date() })
        .where(eq(personSubscriptions.id, existing.id))
        .returning();
      return row!;
    }
    return this.create(data);
  }

  async bulkUpsert(items: NewPersonSubscription[]): Promise<PersonSubscription[]> {
    if (items.length === 0) return [];
    return this.db.insert(personSubscriptions)
      .values(items)
      .onConflictDoUpdate({
        target: [personSubscriptions.personId, personSubscriptions.topicId],
        set: { enabled: sql`excluded.enabled`, updatedAt: new Date() },
      })
      .returning();
  }

  async update(id: string, data: Partial<PersonSubscription>): Promise<PersonSubscription | undefined> {
    const [row] = await this.db.update(personSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(personSubscriptions.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(personSubscriptions).where(eq(personSubscriptions.id, id));
  }
}

export class CommunicationsRepository {
  constructor(private db: DatabaseInstance) {}

  async list(orgId: string, filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    // Fail loud on an empty org instead of letting Postgres cast '' to uuid and
    // throw `invalid input syntax for type uuid: ""`. This is an org-scoped read;
    // a cross-org caller (e.g. the scheduled-send cron) must use findScheduledDue().
    if (!orgId) throw new Error('CommunicationsRepository.list requires a non-empty organizationId');
    const conditions: SQL<unknown>[] = [eq(announcements.organizationId, orgId)];
    if (filters?.status) conditions.push(eq(announcements.status, filters.status as Announcement['status']));
    if (filters?.search) conditions.push(like(announcements.title, `%${escapeLikePattern(filters.search)}%`));

    // FIX-008: left-join announcement_stats so the analytics dashboard (which reads
    // `announcement.stats` off this list endpoint) shows the real delivery counts
    // written by the now-live fan-out. Mirrors the per-row stats shape from get().
    const [rows, countResult] = await Promise.all([
      this.db.select({ announcement: announcements, stats: announcementStats })
        .from(announcements)
        .leftJoin(announcementStats, eq(announcementStats.announcementId, announcements.id))
        .where(and(...conditions))
        .orderBy(desc(announcements.createdAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db.select({ count: sql<number>`count(*)::int` }).from(announcements).where(and(...conditions)),
    ]);
    const data = rows.map((r) => ({ ...r.announcement, stats: r.stats ?? undefined }));
    return { data, total: countResult[0]?.count ?? 0 };
  }

  /**
   * Cron-only: scheduled announcements now due to send (scheduledAt <= now()),
   * ACROSS EVERY org. Deliberately NOT org-scoped — the processScheduled cron
   * spans all orgs and has no single organizationId to pass. `now()` uses the DB
   * clock; null scheduledAt rows are excluded by the comparison.
   */
  async findScheduledDue(limit = 10): Promise<Announcement[]> {
    return this.db
      .select()
      .from(announcements)
      .where(and(eq(announcements.status, 'scheduled'), lte(announcements.scheduledAt, sql`now()`)))
      .orderBy(announcements.scheduledAt)
      .limit(limit);
  }

  async get(id: string, orgId?: string): Promise<(Announcement & { stats?: AnnouncementStats }) | undefined> {
    const conditions = orgId
      ? and(eq(announcements.id, id), eq(announcements.organizationId, orgId))
      : eq(announcements.id, id);
    const [announcement] = await this.db.select().from(announcements).where(conditions).limit(1);
    if (!announcement) return undefined;
    const [stats] = await this.db.select().from(announcementStats).where(eq(announcementStats.announcementId, id)).limit(1);
    return { ...announcement, stats: stats ?? undefined };
  }

  async create(data: NewAnnouncement): Promise<Announcement> {
    const [result] = await this.db.insert(announcements).values(data).returning();
    return result!;
  }

  async updateStatus(id: string, status: string, extra?: Partial<Announcement>, orgId?: string): Promise<Announcement> {
    const conditions = orgId
      ? and(eq(announcements.id, id), eq(announcements.organizationId, orgId))
      : eq(announcements.id, id);
    const [result] = await this.db.update(announcements)
      .set({ status: status as Announcement['status'], ...extra, updatedAt: new Date() })
      .where(conditions).returning();
    return result!;
  }

  async update(id: string, data: Partial<Announcement>, orgId?: string): Promise<Announcement> {
    const conditions = orgId
      ? and(eq(announcements.id, id), eq(announcements.organizationId, orgId))
      : eq(announcements.id, id);
    const [result] = await this.db.update(announcements)
      .set({ ...data, updatedAt: new Date() })
      .where(conditions).returning();
    return result!;
  }

  async delete(id: string, orgId?: string): Promise<void> {
    const conditions = orgId
      ? and(eq(announcements.id, id), eq(announcements.organizationId, orgId))
      : eq(announcements.id, id);
    await this.db.delete(announcements).where(conditions);
  }

  async createStats(
    announcementId: string,
    recipients: number,
    organizationId: string,
    deliveryCounts?: { emailSent?: number; pushDelivered?: number; inappViews?: number },
  ) {
    await this.db.insert(announcementStats).values({
      announcementId,
      recipients,
      organizationId,
      emailSent: deliveryCounts?.emailSent ?? 0,
      pushDelivered: deliveryCounts?.pushDelivered ?? 0,
      inappViews: deliveryCounts?.inappViews ?? 0,
    });
  }

  async getStats(orgId: string) {
    const [stats] = await this.db.select({
      totalThisMonth: sql<number>`count(CASE WHEN ${announcements.publishedAt} >= date_trunc('month', NOW()) THEN 1 END)::int`,
      totalRecipients: sql<number>`COALESCE(SUM(CASE WHEN ${announcements.status} = 'sent' THEN 1 ELSE 0 END), 0)::int`,
    }).from(announcements).where(eq(announcements.organizationId, orgId));
    return stats;
  }
}

// ---------------------------------------------------------------------------
// Saved Segments
// ---------------------------------------------------------------------------

export class SavedSegmentRepository {
  constructor(private db: DatabaseInstance) {}

  async create(data: NewSavedSegment): Promise<SavedSegment> {
    const [row] = await this.db.insert(savedSegments).values(data).returning();
    return row!;
  }

  async list(organizationId: string): Promise<SavedSegment[]> {
    return this.db.select().from(savedSegments)
      .where(eq(savedSegments.organizationId, organizationId))
      .orderBy(desc(savedSegments.createdAt))
      .limit(100);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.db.delete(savedSegments)
      .where(and(eq(savedSegments.id, id), eq(savedSegments.organizationId, organizationId)));
  }
}

// ───────────────────────────────────────────────────────────────────────────
// NotificationPreferencePort adapter (AHA FIX-004 / G4)
//
// Lets the notifs module READ the canonical `person_subscription` preference
// store at delivery time WITHOUT importing across the module boundary — the
// adapter lives next to its owning repo and is resolved via core/ports.
//
// Per-category, opt-out / fail-open. A category is "disabled" only when an
// explicit `enabled = false` person_subscription row exists for a topic whose
// `category` OR `name` (case-insensitive) matches the requested category. The
// dual match absorbs the seed's two vocabularies for the same logical category
// (e.g. topic name `dues` carries category `billing`; name `announcements`
// carries category `general`). Anything else → enabled (send). This is NOT the
// blunt "any disabled sub = global opt-out" semantics used by announcementSend.
// ───────────────────────────────────────────────────────────────────────────
import type { NotificationPreferencePort } from '@/core/ports/notification-preference.port';

export function notificationPreferenceRepoPort(
  db: DatabaseInstance,
  logger?: Logger,
): NotificationPreferencePort {
  return {
    async isCategoryEnabledForPerson(
      personId: string,
      organizationId: string,
      category: string,
    ): Promise<boolean> {
      if (!personId || !organizationId || !category) return true; // fail-open
      const cat = category.trim().toLowerCase();
      try {
        // Find any EXPLICITLY-disabled subscription for this person whose topic
        // matches the category by either the topic.category or topic.name
        // column. We only need existence, so limit(1).
        const [row] = await db
          .select({ id: personSubscriptions.id })
          .from(personSubscriptions)
          .innerJoin(
            subscriptionTopics,
            eq(personSubscriptions.topicId, subscriptionTopics.id),
          )
          .where(
            and(
              eq(personSubscriptions.personId, personId),
              eq(personSubscriptions.organizationId, organizationId),
              eq(personSubscriptions.enabled, false),
              sql`(lower(${subscriptionTopics.category}) = ${cat} OR lower(${subscriptionTopics.name}) = ${cat})`,
            ),
          )
          .limit(1);
        // A matching explicit-disable row ⇒ category disabled ⇒ false (skip).
        return !row;
      } catch (err) {
        // Fail-open on any lookup error — never silently drop a notification
        // because the preference store was unreachable.
        logger?.warn(
          { err, personId, organizationId, category: cat },
          'notificationPreferenceRepoPort: lookup failed, failing open (send)',
        );
        return true;
      }
    },
  };
}
