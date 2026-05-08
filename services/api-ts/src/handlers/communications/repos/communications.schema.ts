import {
  pgTable, uuid, varchar, integer, boolean, timestamp, text, pgEnum, index, jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

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
  audienceType: varchar('audience_type', { length: 20 }).notNull().default('all'), // 'all' | 'by_category'
  audienceCategories: jsonb('audience_categories').$type<string[]>(), // category IDs
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

// Type exports
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementStats = typeof announcementStats.$inferSelect;
