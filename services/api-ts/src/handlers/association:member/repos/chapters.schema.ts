/**
 * Database schema for chapter affiliations, affiliation transfers, and royalty splits
 * Matches TypeSpec API definitions in specs/api/src/association/member/chapters.tsp
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, varchar, uuid, timestamp, date, boolean, real, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const affiliationStatusEnum = pgEnum('affiliation_status', [
  'active',
  'transferred',
  'withdrawn',
]);

export const transferStatusEnum = pgEnum('transfer_status', [
  'requested',
  'pendingSourceApproval',
  'pendingTargetApproval',
  'approved',
  'denied',
  'completed',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Affiliation between a person and a chapter within the association */
export const chapterAffiliations = pgTable('chapter_affiliation', {
  ...baseEntityFields,

  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  chapterId: uuid('chapter_id').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  affiliatedAt: timestamp('affiliated_at').notNull(),
  transferredFrom: uuid('transferred_from'),
  status: affiliationStatusEnum('status').default('active').notNull(),
}, (table) => ({
  tenantPersonIdx: index('chapter_affiliation_tenant_person_idx').on(table.tenantId, table.personId),
  tenantChapterIdx: index('chapter_affiliation_tenant_chapter_idx').on(table.tenantId, table.chapterId),
}));

/** Request to transfer a member's primary chapter affiliation */
export const affiliationTransfers = pgTable('affiliation_transfer', {
  ...baseEntityFields,

  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  fromChapterId: uuid('from_chapter_id').notNull(),
  toChapterId: uuid('to_chapter_id').notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  requestedBy: uuid('requested_by').notNull(),
  approvedBySource: uuid('approved_by_source'),
  approvedByTarget: uuid('approved_by_target'),
  status: transferStatusEnum('status').default('requested').notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  tenantStatusIdx: index('affiliation_transfer_tenant_status_idx').on(table.tenantId, table.status),
}));

/** Royalty split configuration for dues revenue between national org and chapter */
export const royaltySplits = pgTable('royalty_split', {
  ...baseEntityFields,

  tenantId: uuid('tenant_id').notNull(),
  membershipId: uuid('membership_id').notNull(),
  nationalOrgId: uuid('national_org_id').notNull(),
  chapterId: uuid('chapter_id').notNull(),
  splitPercentNational: real('split_percent_national').notNull(),
  splitPercentChapter: real('split_percent_chapter').notNull(),
  effectiveDate: date('effective_date').notNull(),
}, (table) => ({
  tenantChapterIdx: index('royalty_split_tenant_chapter_idx').on(table.tenantId, table.chapterId),
  tenantMembershipIdx: index('royalty_split_tenant_membership_idx').on(table.tenantId, table.membershipId),
}));

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ChapterAffiliation = typeof chapterAffiliations.$inferSelect;
export type NewChapterAffiliation = typeof chapterAffiliations.$inferInsert;

export type AffiliationTransfer = typeof affiliationTransfers.$inferSelect;
export type NewAffiliationTransfer = typeof affiliationTransfers.$inferInsert;

export type RoyaltySplit = typeof royaltySplits.$inferSelect;
export type NewRoyaltySplit = typeof royaltySplits.$inferInsert;
