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
  integer,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

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

// ---------------------------------------------------------------------------
// Announcement tables (merged from communications module)
// ---------------------------------------------------------------------------

export const announcementStatusEnum = pgEnum('announcement_status', [
  'draft', 'scheduled', 'sent', 'scheduledFailed', 'archived'
]);

export const announcementVisibilityEnum = pgEnum('announcement_visibility', [
  'internal', 'network'
]);

export const announcements = pgTable('announcement', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  authorId: uuid('author_id').notNull().references(() => persons.id),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  audienceType: varchar('audience_type', { length: 20 }).notNull().default('all'),
  audienceCategories: jsonb('audience_categories').$type<string[]>(),
  channelPush: boolean('channel_push').notNull().default(true),
  channelEmail: boolean('channel_email').notNull().default(false),
  visibility: announcementVisibilityEnum('visibility').notNull().default('internal'),
  status: announcementStatusEnum('status').notNull().default('draft'),
  scheduledAt: timestamp('scheduled_at'),
  publishedAt: timestamp('published_at'),
}, (table) => ({
  orgIdx: index('announcement_org_idx').on(table.organizationId),
  statusIdx: index('announcement_status_idx').on(table.status),
  orgStatusIdx: index('announcement_org_status_idx').on(table.organizationId, table.status),
}));

export const announcementStats = pgTable('announcement_stats', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  announcementId: uuid('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  recipients: integer('recipients').notNull().default(0),
  inappViews: integer('inapp_views').notNull().default(0),
  pushDelivered: integer('push_delivered').notNull().default(0),
  emailSent: integer('email_sent').notNull().default(0),
  emailOpened: integer('email_opened').notNull().default(0),
}, (table) => ({
  orgIdx: index('ann_stats_org_idx').on(table.organizationId),
  announcementIdx: index('ann_stats_announcement_idx').on(table.announcementId),
}));

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementStats = typeof announcementStats.$inferSelect;
