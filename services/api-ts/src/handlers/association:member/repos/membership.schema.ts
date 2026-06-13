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
  uniqueIndex,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

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
  'removed',
  'resigned',    // LIF-04: voluntary departure
  'deceased',    // LIF-04: member death
  'expelled',    // LIF-04: disciplinary removal
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

    organizationId: uuid('organization_id').notNull(),
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
    orgIdx: index('membership_tier_org_idx').on(table.organizationId),
    orgCodeIdx: index('membership_tier_org_code_idx').on(
      table.organizationId,
      table.code,
    ),
  }),
);

/** Membership category grouping tiers for reporting and eligibility */
export const membershipCategories = pgTable(
  'membership_category',
  {
    ...baseEntityFields,

    organizationId: uuid('organization_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    applicableTiers: jsonb('applicable_tiers').$type<string[]>().notNull(),
  },
  (table) => ({
    orgIdx: index('membership_category_org_idx').on(table.organizationId),
  }),
);

/** Individual membership record linking a person to an organization and tier */
export const memberships = pgTable(
  'membership',
  {
    ...baseEntityFields,

    organizationId: uuid('organization_id').notNull(),
    personId: uuid('person_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => membershipTiers.id),
    categoryId: uuid('category_id').references(() => membershipCategories.id),
    memberNumber: varchar('member_number', { length: 50 }),
    startDate: date('start_date').notNull(),
    duesExpiryDate: date('dues_expiry_date'),
    gracePeriodDays: integer('grace_period_days').notNull().default(30),
    status: membershipStatusEnum('status').notNull().default('pendingPayment'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    resignedAt: timestamp('resigned_at', { withTimezone: true }), // LIF-04: voluntary departure (distinct from removed)
    removalReason: varchar('removal_reason', { length: 500 }),
    dateOfDeath: date('date_of_death'),               // LIF-04: recorded on deceased
    note: text('note'),
  },
  (table) => ({
    orgPersonUniq: uniqueIndex('membership_org_person_unique').on(
      table.organizationId,
      table.personId,
    ),
    orgStatusIdx: index('membership_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
  }),
);

/** Application submitted by a prospective member */
export const membershipApplications = pgTable(
  'membership_application',
  {
    ...baseEntityFields,

    organizationId: uuid('organization_id').notNull(),
    personId: uuid('person_id').notNull(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => membershipTiers.id),
    applicationDate: date('application_date').notNull(),
    status: applicationStatusEnum('status').notNull().default('submitted'),
    reviewedBy: uuid('reviewed_by').references(() => persons.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    denialReason: text('denial_reason'),
  },
  (table) => ({
    orgStatusIdx: index('membership_app_org_status_idx').on(
      table.organizationId,
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
