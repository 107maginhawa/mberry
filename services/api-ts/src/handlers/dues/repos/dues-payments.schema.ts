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
  primaryKey,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { membershipCategories } from '../../association:member/repos/membership.schema';

// Enums
export const billingFrequencyEnum = pgEnum('billing_frequency', ['annual', 'semi-annual', 'quarterly']);

export const duesPaymentMethodEnum = pgEnum('dues_payment_method', [
  'online', 'cash', 'check', 'bankTransfer', 'gcash', 'other'
]);

export const duesPaymentStatusEnum = pgEnum('dues_payment_status', [
  'pending', 'completed', 'failed', 'refunded', 'partiallyRefunded', 'expired',
  'submitted', 'underReview', 'confirmed', 'rejected'
]);

export const gatewayProviderEnum = pgEnum('gateway_provider', ['paymongo', 'stripe']);

// Tables
export const duesOrgConfigs = pgTable('dues_org_config', {
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
  duesConfigId: uuid('dues_config_id').notNull().references(() => duesOrgConfigs.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => membershipCategories.id),
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
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),
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
  paidAt: timestamp('paid_at', { withTimezone: true }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  refundedAmount: integer('refunded_amount').notNull().default(0),
  refundDate: timestamp('refund_date', { withTimezone: true }),
  refundReason: text('refund_reason'),
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
  // [FIX-003] Receipt numbers are unique PER ORG (not globally). Combined with
  // the per-org receipt prefix this prevents cross-org collisions while still
  // forbidding duplicate receipt numbers within an org. Migration 0062.
  receiptUnique: unique('dues_payment_org_receipt_unique').on(table.organizationId, table.receiptNumber),
}));

// [FIX-003 / Batch F] Atomic per-(org, year) receipt sequence source.
// Replaces the racy count(*)-based sequence. See migration 0062.
export const duesReceiptCounters = pgTable('dues_receipt_counter', {
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  nextSequence: integer('next_sequence').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ name: 'dues_receipt_counter_pk', columns: [table.organizationId, table.year] }),
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
  duesConfigId: uuid('dues_config_id').notNull().references(() => duesOrgConfigs.id, { onDelete: 'cascade' }),
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
  encryptedWebhookSecret: text('encrypted_webhook_secret'),
  connected: boolean('connected').notNull().default(false),
  lastTestAt: timestamp('last_test_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('dues_gateway_org_idx').on(table.organizationId),
  uniqueOrg: unique('dues_gateway_org_unique').on(table.organizationId),
}));

// Webhook retry status enum
export const webhookRetryStatusEnum = pgEnum('webhook_retry_status', [
  'processing', 'completed', 'pending_retry', 'dead_letter',
]);

// Webhook retry log table (slice 009, GAP-009)
export const webhookRetryLogs = pgTable('webhook_retry_log', {
  ...baseEntityFields,
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  status: webhookRetryStatusEnum('status').notNull().default('processing'),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  lastError: text('last_error'),
}, (table) => ({
  idempotencyIdx: unique('webhook_retry_idempotency_unique').on(table.idempotencyKey),
  orgIdx: index('webhook_retry_org_idx').on(table.organizationId),
  statusIdx: index('webhook_retry_status_idx').on(table.status),
  nextRetryIdx: index('webhook_retry_next_retry_idx').on(table.nextRetryAt),
}));

// Type exports
export type DuesOrgConfig = typeof duesOrgConfigs.$inferSelect;
export type NewDuesOrgConfig = typeof duesOrgConfigs.$inferInsert;
export type DuesFund = typeof duesFunds.$inferSelect;
export type NewDuesFund = typeof duesFunds.$inferInsert;
export type DuesPayment = typeof duesPayments.$inferSelect;
export type NewDuesPayment = typeof duesPayments.$inferInsert;
export type DuesFundAllocation = typeof duesFundAllocations.$inferSelect;
export type NewDuesFundAllocation = typeof duesFundAllocations.$inferInsert;
export type DuesReminderSchedule = typeof duesReminderSchedules.$inferSelect;
export type DuesGatewayConfig = typeof duesGatewayConfigs.$inferSelect;
export type WebhookRetryLog = typeof webhookRetryLogs.$inferSelect;
export type NewWebhookRetryLog = typeof webhookRetryLogs.$inferInsert;
export type DuesReceiptCounter = typeof duesReceiptCounters.$inferSelect;
