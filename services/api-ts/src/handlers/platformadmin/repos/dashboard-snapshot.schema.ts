/**
 * Database schema for National Dashboard module (M14).
 * Tables: chapter_snapshot, national_dashboard_access, dashboard_export_log.
 */

import {
  pgTable,
  varchar,
  numeric,
  timestamp,
  text,
  uuid,
  pgEnum,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const reportTypeEnum = pgEnum('dashboard_report_type', [
  'association_summary',
  'dues_collection',
  'cpd_compliance',
  'activity',
]);

export const outputFormatEnum = pgEnum('dashboard_output_format', [
  'pdf',
  'csv',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * chapter_snapshot — monthly aggregate metrics per chapter (org).
 * Populated by a scheduled job; never contains individual member data.
 */
export const chapterSnapshots = pgTable('chapter_snapshot', {
  ...baseEntityFields,
  orgId: uuid('org_id').notNull(),
  associationId: uuid('association_id').notNull(),
  /** YYYY-MM format */
  snapshotMonth: varchar('snapshot_month', { length: 7 }).notNull(),
  totalMembers: integer('total_members').notNull(),
  activeMembers: integer('active_members'),
  graceMembers: integer('grace_members'),
  lapsedMembers: integer('lapsed_members'),
  suspendedMembers: integer('suspended_members'),
  /** Collected / Expected ratio (0-1) */
  collectionRate: numeric('collection_rate'),
  totalCollected: numeric('total_collected'),
  totalExpected: numeric('total_expected'),
  /** Weighted CPD compliance rate (0-1) */
  cpdComplianceRate: numeric('cpd_compliance_rate'),
  avgCreditsPerMember: numeric('avg_credits_per_member'),
  activityCount90d: integer('activity_count_90d'),
}, (table) => [
  index('idx_chapter_snapshot_org').on(table.orgId),
  index('idx_chapter_snapshot_association').on(table.associationId),
  index('idx_chapter_snapshot_month').on(table.snapshotMonth),
]);

/**
 * national_dashboard_access — tracks which members have been designated
 * as national officers by a platform admin, scoped per association.
 * BR-36: only active (revokedAt IS NULL) grants confer access.
 */
export const nationalDashboardAccess = pgTable('national_dashboard_access', {
  ...baseEntityFields,
  associationId: uuid('association_id').notNull(),
  memberId: uuid('member_id').notNull(),
  grantedBy: uuid('granted_by').notNull(),
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
}, (table) => [
  index('idx_nda_association').on(table.associationId),
  index('idx_nda_member').on(table.memberId),
]);

/**
 * dashboard_export_log — immutable audit trail of every export.
 * BR-36: all exports must be logged with who/when/what/format.
 */
export const dashboardExportLogs = pgTable('dashboard_export_log', {
  ...baseEntityFields,
  exportedBy: uuid('exported_by').notNull(),
  associationId: uuid('association_id').notNull(),
  reportType: reportTypeEnum('report_type').notNull(),
  /** 'all_chapters' or comma-separated org IDs */
  scope: text('scope').notNull(),
  dateRangeStart: timestamp('date_range_start').notNull(),
  dateRangeEnd: timestamp('date_range_end').notNull(),
  outputFormat: outputFormatEnum('output_format').notNull(),
}, (table) => [
  index('idx_export_log_association').on(table.associationId),
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChapterSnapshot = typeof chapterSnapshots.$inferSelect;
export type NewChapterSnapshot = typeof chapterSnapshots.$inferInsert;
export type NationalDashboardAccess = typeof nationalDashboardAccess.$inferSelect;
export type NewNationalDashboardAccess = typeof nationalDashboardAccess.$inferInsert;
export type DashboardExportLog = typeof dashboardExportLogs.$inferSelect;
export type NewDashboardExportLog = typeof dashboardExportLogs.$inferInsert;
