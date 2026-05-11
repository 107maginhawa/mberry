import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
  text,
  boolean,
  numeric,
  pgEnum,
  index,
  unique,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

// Enums
export const billingFrequencyEnum = pgEnum('billing_frequency', ['annual', 'quarterly']);

export const duesPaymentMethodEnum = pgEnum('dues_payment_method', [
  'online', 'cash', 'check', 'bankTransfer', 'gcash', 'other'
]);

export const duesPaymentStatusEnum = pgEnum('dues_payment_status', [
  'pending', 'completed', 'failed', 'refunded', 'partiallyRefunded', 'expired',
  'submitted', 'underReview', 'confirmed', 'rejected'
]);

export const gatewayProviderEnum = pgEnum('gateway_provider', ['paymongo', 'stripe']);

// Tables
export const duesConfigs = pgTable('dues_org_config', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  defaultAmount: integer('default_amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  billingFrequency: billingFrequencyEnum('billing_frequency').notNull().default('annual'),
  dueDateMonth: integer('due_date_month'),
  dueDateDay: integer('due_date_day').notNull().default(1),
  gracePeriodDays: integer('grace_period_days').notNull().default(30),
}, (table) => ({
  orgIdx: index('dues_config_org_idx').on(table.organizationId),
  uniqueOrg: unique('dues_config_org_unique').on(table.organizationId),
}));

export const duesCategoryOverrides = pgTable('dues_category_override', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  duesConfigId: uuid('dues_config_id').notNull().references(() => duesConfigs.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull(),
  overrideAmount: integer('override_amount').notNull(),
}, (table) => ({
  orgIdx: index('dues_cat_override_org_idx').on(table.organizationId),
  configIdx: index('dues_cat_override_config_idx').on(table.duesConfigId),
  uniqueCatConfig: unique('dues_cat_override_unique').on(table.duesConfigId, table.categoryId),
}));

export const duesFunds = pgTable('dues_fund', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 100 }).notNull(),
  percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  orgIdx: index('dues_fund_org_idx').on(table.organizationId),
  orgSortIdx: index('dues_fund_org_sort_idx').on(table.organizationId, table.sortOrder),
}));

export const duesPayments = pgTable('dues_payment', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id'),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  paymentMethod: duesPaymentMethodEnum('payment_method').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  status: duesPaymentStatusEnum('status').notNull().default('pending'),
  recordedBy: uuid('recorded_by').references(() => persons.id),
  membershipExtendedFrom: date('membership_extended_from'),
  membershipExtendedTo: date('membership_extended_to'),
  paidAt: timestamp('paid_at'),
  expiredAt: timestamp('expired_at'),
  refundedAmount: integer('refunded_amount').notNull().default(0),
  proofStorageKey: varchar('proof_storage_key', { length: 500 }),
  proofFileName: varchar('proof_file_name', { length: 255 }),
  proofMimeType: varchar('proof_mime_type', { length: 100 }),
  rejectionReason: text('rejection_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  orgIdx: index('dues_payment_org_idx').on(table.organizationId),
  personIdx: index('dues_payment_person_idx').on(table.personId),
  statusIdx: index('dues_payment_status_idx').on(table.status),
  orgPersonIdx: index('dues_payment_org_person_idx').on(table.organizationId, table.personId),
  receiptUnique: unique('dues_payment_receipt_unique').on(table.receiptNumber),
}));

export const duesFundAllocations = pgTable('dues_fund_allocation', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  paymentId: uuid('payment_id').notNull().references(() => duesPayments.id, { onDelete: 'cascade' }),
  fundId: uuid('fund_id').notNull().references(() => duesFunds.id),
  amount: integer('amount').notNull(),
  isReversal: boolean('is_reversal').notNull().default(false),
}, (table) => ({
  orgIdx: index('dues_fund_alloc_org_idx').on(table.organizationId),
  paymentIdx: index('dues_fund_alloc_payment_idx').on(table.paymentId),
  fundIdx: index('dues_fund_alloc_fund_idx').on(table.fundId),
}));

export const duesReminderSchedules = pgTable('dues_reminder_schedule', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  duesConfigId: uuid('dues_config_id').notNull().references(() => duesConfigs.id, { onDelete: 'cascade' }),
  daysOffset: integer('days_offset').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  channelInapp: boolean('channel_inapp').notNull().default(true),
  channelPush: boolean('channel_push').notNull().default(true),
  channelEmail: boolean('channel_email').notNull().default(true),
  isCustom: boolean('is_custom').notNull().default(false),
}, (table) => ({
  orgIdx: index('dues_reminder_org_idx').on(table.organizationId),
  configIdx: index('dues_reminder_config_idx').on(table.duesConfigId),
}));

export const duesGatewayConfigs = pgTable('dues_gateway_config', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  provider: gatewayProviderEnum('provider').notNull(),
  publicKey: varchar('public_key', { length: 255 }).notNull(),
  encryptedSecret: text('encrypted_secret').notNull(),
  connected: boolean('connected').notNull().default(false),
  lastTestAt: timestamp('last_test_at'),
}, (table) => ({
  orgIdx: index('dues_gateway_org_idx').on(table.organizationId),
  uniqueOrg: unique('dues_gateway_org_unique').on(table.organizationId),
}));

// Type exports
export type DuesConfig = typeof duesConfigs.$inferSelect;
export type NewDuesConfig = typeof duesConfigs.$inferInsert;
export type DuesFund = typeof duesFunds.$inferSelect;
export type NewDuesFund = typeof duesFunds.$inferInsert;
export type DuesPayment = typeof duesPayments.$inferSelect;
export type NewDuesPayment = typeof duesPayments.$inferInsert;
export type DuesFundAllocation = typeof duesFundAllocations.$inferSelect;
export type NewDuesFundAllocation = typeof duesFundAllocations.$inferInsert;
export type DuesReminderSchedule = typeof duesReminderSchedules.$inferSelect;
export type DuesGatewayConfig = typeof duesGatewayConfigs.$inferSelect;
