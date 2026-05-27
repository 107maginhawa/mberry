/**
 * Database schema for platform administration module.
 * Tables: association, organization, feature_flag, platform_admin, impersonation_session.
 */

import {
  pgTable,
  varchar,
  integer,
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

export const orgLifecycleStatusEnum = pgEnum('org_lifecycle_status', [
  'trial',
  'active',
  'suspended',
  'cancelled',
]);

export const orgTypeEnum = pgEnum('org_type', [
  'chapter',
  'society',
  'national',
  'clinic',
]);

export const adminRoleEnum = pgEnum('admin_role', [
  'super',
  'support',
  'analyst',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const associations = pgTable('association', {
  ...baseEntityFields,
  name: varchar('name', { length: 255 }).notNull(),
  country: varchar('country', { length: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  locale: varchar('locale', { length: 10 }).default('en'),
  licenseFormatRegex: varchar('license_format_regex', { length: 500 }),
  creditCyclePeriod: integer('credit_cycle_period'),
  requiredCreditsPerCycle: integer('required_credits_per_cycle'),
  carryoverEnabled: boolean('carryover_enabled').default(false),
  /** BR-11: configurable cycle start month (1-12). Null = registration-based. */
  cycleStartMonth: integer('cycle_start_month'),
  /** BR-11: configurable cycle start day (1-31). Defaults to 1 if month set. */
  cycleStartDay: integer('cycle_start_day'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
}, (table) => [
  uniqueIndex('idx_association_name').on(table.name),
  index('idx_association_country').on(table.country),
]);

export const organizations = pgTable('organization', {
  ...baseEntityFields,
  associationId: uuid('association_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  orgType: orgTypeEnum('org_type').notNull(),
  region: varchar('region', { length: 100 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  status: orgLifecycleStatusEnum('status').notNull().default('trial'),
  trialStartDate: timestamp('trial_start_date', { withTimezone: true }),
  trialEndDate: timestamp('trial_end_date', { withTimezone: true }),
  featureFlags: jsonb('feature_flags').$type<Record<string, boolean>>(),
}, (table) => [
  index('idx_org_association').on(table.associationId),
  index('idx_org_status').on(table.status),
  uniqueIndex('idx_org_name_association').on(table.name, table.associationId),
  uniqueIndex('idx_org_slug').on(table.slug),
]);

export const featureFlags = pgTable('feature_flag', {
  ...baseEntityFields,
  targetType: varchar('target_type', { length: 50 }).notNull(), // 'association', 'org', 'tier'
  targetId: varchar('target_id', { length: 255 }).notNull(),
  moduleName: varchar('module_name', { length: 100 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  isOverride: boolean('is_override').notNull().default(false),
}, (table) => [
  index('idx_ff_target').on(table.targetType, table.targetId),
  uniqueIndex('idx_ff_unique').on(table.targetType, table.targetId, table.moduleName),
]);

export const platformAdmins = pgTable('platform_admin', {
  ...baseEntityFields,
  userId: uuid('user_id').notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  role: adminRoleEnum('role').notNull(),
});

export const impersonationSessions = pgTable('impersonation_session', {
  ...baseEntityFields,
  adminId: uuid('admin_id').notNull(),
  targetUserId: uuid('target_user_id').notNull(),
  targetOrgId: uuid('target_org_id'),
  sessionToken: varchar('session_token', { length: 255 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
}, (table) => [
  index('idx_impersonation_admin').on(table.adminId),
  index('idx_impersonation_target').on(table.targetUserId),
]);

// ---------------------------------------------------------------------------
// Compliance — Breach Incidents (DPA 2012 / M3-R11)
// ---------------------------------------------------------------------------

export const breachStatusEnum = pgEnum('breach_status', ['reported', 'investigating', 'notified', 'resolved']);

export const breachIncidents = pgTable('breach_incident', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id'),  // nullable for platform-wide
  reportedBy: uuid('reported_by').notNull(),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  description: text('description').notNull(),
  affectedRecordsCount: integer('affected_records_count'),
  dataCategories: jsonb('data_categories').$type<string[]>(),
  notificationDeadline: timestamp('notification_deadline', { withTimezone: true }).notNull(),
  status: breachStatusEnum('status').notNull().default('reported'),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  npcReferenceNumber: varchar('npc_reference_number', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedBy: uuid('updated_by').notNull(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Association = typeof associations.$inferSelect;
export type NewAssociation = typeof associations.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type NewPlatformAdmin = typeof platformAdmins.$inferInsert;
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type NewImpersonationSession = typeof impersonationSessions.$inferInsert;
export type BreachIncident = typeof breachIncidents.$inferSelect;
export type NewBreachIncident = typeof breachIncidents.$inferInsert;
