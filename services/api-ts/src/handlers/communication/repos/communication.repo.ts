/**
 * Repositories for communication module.
 */

import { eq, and, gte, like, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import {
  messageTemplates, messages, subscriptionTopics, personSubscriptions,
  type NewMessageTemplate, type MessageTemplate,
  type NewMessage, type Message,
  type NewSubscriptionTopic, type SubscriptionTopic,
  type NewPersonSubscription, type PersonSubscription,
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

  async findByTenant(tenantId: string): Promise<MessageTemplate[]> {
    return this.db.select().from(messageTemplates).where(eq(messageTemplates.tenantId, tenantId));
  }

  async search(tenantId: string, filters: {
    q?: string;
    channel?: string;
    category?: string;
    status?: string;
    isTransactional?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<MessageTemplate[]> {
    const conditions = [eq(messageTemplates.tenantId, tenantId)];
    if (filters.channel) conditions.push(eq(messageTemplates.channel, filters.channel as any));
    if (filters.category) conditions.push(eq(messageTemplates.category, filters.category));
    if (filters.status) conditions.push(eq(messageTemplates.status, filters.status as any));
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

  async findByTenant(tenantId: string): Promise<Message[]> {
    return this.db.select().from(messages).where(eq(messages.tenantId, tenantId));
  }

  async search(tenantId: string, filters: {
    channel?: string;
    senderId?: string;
    status?: string;
    scheduledAfter?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Message[]> {
    const conditions = [eq(messages.tenantId, tenantId)];
    if (filters.channel) conditions.push(eq(messages.channel, filters.channel as any));
    if (filters.senderId) conditions.push(eq(messages.senderId, filters.senderId));
    if (filters.status) conditions.push(eq(messages.status, filters.status as any));
    if (filters.scheduledAfter) conditions.push(gte(messages.scheduledAt, filters.scheduledAfter));

    return this.db.select().from(messages)
      .where(and(...conditions))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);
  }

  /**
   * BR-28 deduplication: check if a message with same channel + recipient was already sent today.
   */
  async findDuplicateSentToday(tenantId: string, channel: string, recipientPersonId: string): Promise<Message | undefined> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await this.db.select().from(messages)
      .where(and(
        eq(messages.tenantId, tenantId),
        eq(messages.channel, channel as any),
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

  async findByTenant(tenantId: string): Promise<SubscriptionTopic[]> {
    return this.db.select().from(subscriptionTopics).where(eq(subscriptionTopics.tenantId, tenantId));
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

  async findByPerson(personId: string, tenantId: string): Promise<PersonSubscription[]> {
    return this.db.select().from(personSubscriptions)
      .where(and(eq(personSubscriptions.personId, personId), eq(personSubscriptions.tenantId, tenantId)));
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
