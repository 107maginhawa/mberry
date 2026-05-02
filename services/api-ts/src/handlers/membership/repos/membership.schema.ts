import {
  pgTable, uuid, varchar, integer, boolean, timestamp, text, pgEnum, index, unique, jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

export const membershipStatusEnum = pgEnum('membership_status', [
  'active', 'grace', 'lapsed', 'suspended', 'pending'
]);

export const billingCycleEnum = pgEnum('membership_billing_cycle', [
  'annual', 'quarterly', 'custom'
]);

export const applicationStatusEnum = pgEnum('application_status', [
  'pending', 'approved', 'rejected', 'info_requested'
]);

export const membershipCategories = pgTable('membership_category', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  duesAmount: integer('dues_amount').notNull().default(0), // cents
  billingCycle: billingCycleEnum('billing_cycle').notNull().default('annual'),
  customMonths: integer('custom_months'), // 1-24, only for custom cycle
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  orgIdx: index('membership_cat_org_idx').on(table.organizationId),
  orgNameUnique: unique('membership_cat_org_name_unique').on(table.organizationId, table.name),
}));

export const memberships = pgTable('membership', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => membershipCategories.id),
  licenseNumber: varchar('license_number', { length: 50 }),
  status: membershipStatusEnum('status').notNull().default('active'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  duesExpiryDate: timestamp('dues_expiry_date'),
  suspendedAt: timestamp('suspended_at'),
  suspendedReason: text('suspended_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  orgIdx: index('membership_org_idx').on(table.organizationId),
  personIdx: index('membership_person_idx').on(table.personId),
  statusIdx: index('membership_status_idx').on(table.status),
  orgPersonUnique: unique('membership_org_person_unique').on(table.organizationId, table.personId),
  licenseIdx: index('membership_license_idx').on(table.licenseNumber),
}));

export const membershipApplications = pgTable('membership_application', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => membershipCategories.id),
  status: applicationStatusEnum('status').notNull().default('pending'),
  message: text('message'),
  reviewedBy: uuid('reviewed_by').references(() => persons.id),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  infoRequestMessage: text('info_request_message'),
}, (table) => ({
  orgIdx: index('membership_app_org_idx').on(table.organizationId),
  statusIdx: index('membership_app_status_idx').on(table.status),
  personIdx: index('membership_app_person_idx').on(table.personId),
}));

// Type exports
export type MembershipCategory = typeof membershipCategories.$inferSelect;
export type NewMembershipCategory = typeof membershipCategories.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type MembershipApplication = typeof membershipApplications.$inferSelect;
export type NewMembershipApplication = typeof membershipApplications.$inferInsert;
