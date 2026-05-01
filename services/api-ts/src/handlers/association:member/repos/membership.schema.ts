/**
 * Database schema for membership module — matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL
 *
 * Covers: MembershipTier, Membership, MembershipApplication, MembershipCategory
 */

import {
  pgTable,
  varchar,
  bigint,
  integer,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** Lifecycle status of a membership tier */
export const tierStatusEnum = pgEnum('tier_status', [
  'active',
  'retired',
]);

/** Lifecycle status of a membership record */
export const membershipStatusEnum = pgEnum('membership_status', [
  'pendingPayment',
  'active',
  'gracePeriod',
  'lapsed',
  'expired',
  'suspended',
  'terminated',
]);

/** Status of a membership application */
export const applicationStatusEnum = pgEnum('application_status', [
  'submitted',
  'underReview',
  'approved',
  'denied',
  'waitlisted',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Membership tier defining fee structure and benefits */
export const membershipTiers = pgTable(
  'membership_tier',
  {
    ...baseEntityFields,

    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 30 }).notNull(),
    description: text('description'),
    annualFee: bigint('annual_fee', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    benefits: jsonb('benefits').$type<string[]>(),
    maxMembers: integer('max_members'),
    status: tierStatusEnum('status').notNull().default('active'),
  },
  (table) => ({
    tenantIdx: index('membership_tier_tenant_idx').on(table.tenantId),
    tenantCodeIdx: index('membership_tier_tenant_code_idx').on(
      table.tenantId,
      table.code,
    ),
  }),
);

/** Membership category grouping tiers for reporting and eligibility */
export const membershipCategories = pgTable(
  'membership_category',
  {
    ...baseEntityFields,

    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id'),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    applicableTiers: jsonb('applicable_tiers').$type<string[]>().notNull(),
  },
  (table) => ({
    tenantIdx: index('membership_category_tenant_idx').on(table.tenantId),
  }),
);

/** Individual membership record linking a person to an organization and tier */
export const memberships = pgTable(
  'membership',
  {
    ...baseEntityFields,

    tenantId: uuid('tenant_id').notNull(),
    personId: uuid('person_id').notNull(),
    orgId: uuid('org_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => membershipTiers.id),
    categoryId: uuid('category_id').references(() => membershipCategories.id),
    memberNumber: varchar('member_number', { length: 50 }),
    startDate: date('start_date').notNull(),
    duesExpiryDate: date('dues_expiry_date').notNull(),
    gracePeriodDays: integer('grace_period_days').notNull().default(30),
    status: membershipStatusEnum('status').notNull().default('pendingPayment'),
    joinedAt: timestamp('joined_at').notNull(),
    terminatedAt: timestamp('terminated_at'),
    terminationReason: varchar('termination_reason', { length: 500 }),
    note: text('note'),
  },
  (table) => ({
    tenantOrgIdx: index('membership_tenant_org_idx').on(
      table.tenantId,
      table.orgId,
    ),
    tenantPersonIdx: index('membership_tenant_person_idx').on(
      table.tenantId,
      table.personId,
    ),
    tenantStatusIdx: index('membership_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);

/** Application submitted by a prospective member */
export const membershipApplications = pgTable(
  'membership_application',
  {
    ...baseEntityFields,

    tenantId: uuid('tenant_id').notNull(),
    personId: uuid('person_id').notNull(),
    orgId: uuid('org_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => membershipTiers.id),
    applicationDate: date('application_date').notNull(),
    status: applicationStatusEnum('status').notNull().default('submitted'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    denialReason: text('denial_reason'),
  },
  (table) => ({
    tenantOrgStatusIdx: index('membership_app_tenant_org_status_idx').on(
      table.tenantId,
      table.orgId,
      table.status,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type MembershipTier = typeof membershipTiers.$inferSelect;
export type NewMembershipTier = typeof membershipTiers.$inferInsert;

export type MembershipCategory = typeof membershipCategories.$inferSelect;
export type NewMembershipCategory = typeof membershipCategories.$inferInsert;

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;

export type MembershipApplication = typeof membershipApplications.$inferSelect;
export type NewMembershipApplication = typeof membershipApplications.$inferInsert;
