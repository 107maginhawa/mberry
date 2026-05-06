/**
 * Database schema for communication module.
 * Tables: message_template, message, subscription_topic, person_subscription.
 * Matches communication.tsp models.
 */

import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const channelEnum = pgEnum('comm_channel', [
  'email',
  'push',
  'inApp',
  'sms',
]);

export const templateStatusEnum = pgEnum('template_status', [
  'draft',
  'active',
  'archived',
]);

export const messageStatusEnum = pgEnum('message_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
  'failed',
]);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
  'bounced',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const messageTemplates = pgTable('message_template', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  channel: channelEnum('channel').notNull(),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  mergeFields: jsonb('merge_fields').$type<string[]>().default([]),
  category: varchar('category', { length: 100 }).notNull(),
  isTransactional: boolean('is_transactional').notNull().default(false),
  status: templateStatusEnum('status').notNull().default('draft'),
}, (table) => [
  index('idx_msg_template_org').on(table.organizationId),
  index('idx_msg_template_category').on(table.category),
]);

export const messages = pgTable('message', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  templateId: uuid('template_id'),
  channel: channelEnum('channel').notNull(),
  senderId: uuid('sender_id').notNull(),
  recipients: jsonb('recipients').$type<MessageRecipient[]>().default([]),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  status: messageStatusEnum('status').notNull().default('draft'),
}, (table) => [
  index('idx_message_org').on(table.organizationId),
  index('idx_message_status').on(table.status),
  index('idx_message_sender').on(table.senderId),
]);

export const subscriptionTopics = pgTable('subscription_topic', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  channel: channelEnum('channel').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  defaultEnabled: boolean('default_enabled').notNull().default(true),
}, (table) => [
  index('idx_sub_topic_org').on(table.organizationId),
]);

export const personSubscriptions = pgTable('person_subscription', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull(),
  topicId: uuid('topic_id').notNull(),
  enabled: boolean('enabled').notNull().default(true),
}, (table) => [
  index('idx_person_sub_org').on(table.organizationId),
  index('idx_person_sub_person').on(table.personId),
  uniqueIndex('idx_person_sub_unique').on(table.personId, table.topicId),
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageRecipient {
  personId: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  deliveredAt?: string;
}

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type SubscriptionTopic = typeof subscriptionTopics.$inferSelect;
export type NewSubscriptionTopic = typeof subscriptionTopics.$inferInsert;
export type PersonSubscription = typeof personSubscriptions.$inferSelect;
export type NewPersonSubscription = typeof personSubscriptions.$inferInsert;
