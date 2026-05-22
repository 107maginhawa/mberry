/**
 * Database schema for Professional Feed module (M13).
 * Tables: feed_post, feed_post_reaction, feed_post_report, feed_muted_author.
 */

import {
  pgTable,
  varchar,
  boolean,
  text,
  uuid,
  pgEnum,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const feedPostTypeEnum = pgEnum('feed_post_type', [
  'announcement',
  'event_highlight',
  'training_opportunity',
  'achievement',
  'clinical_update',
]);

export const feedPostVisibilityEnum = pgEnum('feed_post_visibility', [
  'org',
  'network',
]);

export const feedPostStatusEnum = pgEnum('feed_post_status', [
  'published',
  'draft',
  'flagged',
  'removed',
]);

export const feedPosts = pgTable('feed_post', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  authorId: uuid('author_id').notNull(),
  postType: feedPostTypeEnum('post_type').notNull(),
  bodyText: text('body_text').notNull(),
  visibility: feedPostVisibilityEnum('visibility').notNull().default('org'),
  status: feedPostStatusEnum('status').notNull().default('published'),
  isPinned: boolean('is_pinned').notNull().default(false),
  isSponsored: boolean('is_sponsored').notNull().default(false),
  isRemoved: boolean('is_removed').notNull().default(false),
  removedBy: uuid('removed_by'),
  removedReason: text('removed_reason'),
  reportCount: integer('report_count').notNull().default(0),
}, (table) => [
  index('idx_feed_post_org').on(table.organizationId),
  index('idx_feed_post_author').on(table.authorId),
  index('idx_feed_post_status').on(table.status),
]);

export const feedPostReactions = pgTable('feed_post_reaction', {
  ...baseEntityFields,
  postId: uuid('post_id').notNull(),
  memberId: uuid('member_id').notNull(),
  reactionType: varchar('reaction_type', { length: 50 }).notNull().default('like'),
}, (table) => [
  index('idx_feed_reaction_post').on(table.postId),
  index('idx_feed_reaction_member').on(table.memberId),
]);

export const feedPostReports = pgTable('feed_post_report', {
  ...baseEntityFields,
  postId: uuid('post_id').notNull(),
  reporterId: uuid('reporter_id').notNull(),
  reason: text('reason'),
}, (table) => [
  index('idx_feed_report_post').on(table.postId),
]);

export const feedMutedAuthors = pgTable('feed_muted_author', {
  ...baseEntityFields,
  memberId: uuid('member_id').notNull(),
  mutedAuthorId: uuid('muted_author_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
}, (table) => [
  index('idx_feed_muted_member').on(table.memberId),
  index('idx_feed_muted_org').on(table.organizationId),
]);

// Types
export type FeedPost = typeof feedPosts.$inferSelect;
export type NewFeedPost = typeof feedPosts.$inferInsert;
export type FeedPostReaction = typeof feedPostReactions.$inferSelect;
export type NewFeedPostReaction = typeof feedPostReactions.$inferInsert;
export type FeedPostReport = typeof feedPostReports.$inferSelect;
export type NewFeedPostReport = typeof feedPostReports.$inferInsert;
export type FeedMutedAuthor = typeof feedMutedAuthors.$inferSelect;
export type NewFeedMutedAuthor = typeof feedMutedAuthors.$inferInsert;
