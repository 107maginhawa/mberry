/**
 * Repositories for communication module.
 */

import { eq, and, gte, like, sql, desc, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import type { DatabaseInstance } from '@/core/database';
import {
  messageTemplates, messages, subscriptionTopics, personSubscriptions,
  announcements, announcementStats,
  type NewMessageTemplate, type MessageTemplate,
  type NewMessage, type Message,
  type NewSubscriptionTopic, type SubscriptionTopic,
  type NewPersonSubscription, type PersonSubscription,
  type Announcement, type NewAnnouncement, type AnnouncementStats,
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
      .where(and(eq(personSubscriptions.personId, personId), eq(personSubscriptions.organizationId, organizationId)));
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
    const conditions: SQL<unknown>[] = [eq(announcements.organizationId, orgId)];
    if (filters?.status) conditions.push(eq(announcements.status, filters.status as Announcement['status']));
    if (filters?.search) conditions.push(like(announcements.title, `%${filters.search}%`));

    const [data, countResult] = await Promise.all([
      this.db.select().from(announcements)
        .where(and(...conditions))
        .orderBy(desc(announcements.createdAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db.select({ count: sql<number>`count(*)::int` }).from(announcements).where(and(...conditions)),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
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

  async createStats(announcementId: string, recipients: number, organizationId: string) {
    await this.db.insert(announcementStats).values({ announcementId, recipients, organizationId });
  }

  async getStats(orgId: string) {
    const [stats] = await this.db.select({
      totalThisMonth: sql<number>`count(CASE WHEN ${announcements.publishedAt} >= date_trunc('month', NOW()) THEN 1 END)::int`,
      totalRecipients: sql<number>`COALESCE(SUM(CASE WHEN ${announcements.status} = 'sent' THEN 1 ELSE 0 END), 0)::int`,
    }).from(announcements).where(eq(announcements.organizationId, orgId));
    return stats;
  }
}
