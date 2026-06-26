/**
 * Database schema for dues module — matches TypeSpec API definition
 * Covers dues configuration, invoice generation, and AR aging buckets
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, varchar, timestamp, date, jsonb, pgEnum, index, bigint, integer, uuid, unique } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const duesConfigStatusEnum = pgEnum('dues_config_status', [
  'active',
  'retired',
]);

export const duesInvoiceStatusEnum = pgEnum('dues_invoice_status', [
  'generated',
  'sent',
  'paid',
  'overdue',
  'cancelled',
  'writtenOff',
]);

// ---------------------------------------------------------------------------
// Value Types (JSONB shapes)
// ---------------------------------------------------------------------------

/** Fund allocation rule — percentages must sum to 100 across all allocations */
export interface FundAllocation {
  fundName: string;
  percentage: number;
  isLast: boolean;
}

/** Computed allocation of a specific invoice's revenue to a named fund */
export interface DuesInvoiceAllocation {
  fundName: string;
  amount: number; // cents
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Dues configuration defining amounts and fund allocations for a tier within an organization */
export const duesConfigs = pgTable('dues_config', {
  ...baseEntityFields,

  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  tierId: varchar('tier_id', { length: 255 }).notNull(),
  annualAmount: bigint('annual_amount', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  gracePeriodDays: integer('grace_period_days').default(30).notNull(),
  dueDateDay: integer('due_date_day').default(1).notNull(),
  cycleStartMonth: integer('cycle_start_month').default(1).notNull(),
  fundAllocations: jsonb('fund_allocations').$type<FundAllocation[]>().notNull(),
  effectiveDate: date('effective_date').notNull(),
  status: duesConfigStatusEnum('status').default('active').notNull(),
}, (table) => ({
  orgIdx: index('dues_config_legacy_org_idx').on(table.organizationId),
}));

/** Dues invoice issued to a member for a renewal period */
export const duesInvoices = pgTable('dues_invoice', {
  ...baseEntityFields,

  membershipId: varchar('membership_id', { length: 255 }).notNull(),
  personId: varchar('person_id', { length: 255 }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  fundAllocations: jsonb('fund_allocations').$type<DuesInvoiceAllocation[]>().notNull(),
  status: duesInvoiceStatusEnum('status').default('generated').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentId: varchar('payment_id', { length: 255 }),
}, (table) => ({
  orgStatusIdx: index('dues_invoice_org_status_idx').on(table.organizationId, table.status),
  membershipIdx: index('dues_invoice_membership_idx').on(table.membershipId),
}));

/** Accounts-receivable aging snapshot for an organization as of a specific date */
export const agingBuckets = pgTable('aging_bucket', {
  ...baseEntityFields,

  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  asOfDate: date('as_of_date').notNull(),
  current: bigint('current', { mode: 'number' }).default(0).notNull(),
  thirtyDay: bigint('thirty_day', { mode: 'number' }).default(0).notNull(),
  sixtyDay: bigint('sixty_day', { mode: 'number' }).default(0).notNull(),
  ninetyDay: bigint('ninety_day', { mode: 'number' }).default(0).notNull(),
  overNinety: bigint('over_ninety', { mode: 'number' }).default(0).notNull(),
  totalOutstanding: bigint('total_outstanding', { mode: 'number' }).default(0).notNull(),
}, (table) => ({
  orgIdx: index('aging_bucket_org_idx').on(table.organizationId),
}));

/** Dues reminder log — tracks sent reminders for idempotency */
export const duesReminderLogs = pgTable('dues_reminder_log', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull(),
  scheduleId: uuid('schedule_id'), // nullable for manual sends
  duesConfigId: uuid('dues_config_id').notNull(),
  periodKey: varchar('period_key', { length: 20 }).notNull(), // e.g. "2026", "2026-Q1"
  daysOffset: integer('days_offset').notNull(),
  channel: varchar('channel', { length: 20 }).notNull(), // "in-app", "email", "push"
  notificationId: uuid('notification_id'), // nullable until notification created
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('dues_reminder_log_org_idx').on(table.organizationId),
  personIdx: index('dues_reminder_log_person_idx').on(table.personId),
  idempotencyUniq: unique('dues_reminder_log_idempotency').on(
    table.personId,
    table.scheduleId,
    table.periodKey,
    table.daysOffset,
  ),
}));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type DuesConfig = typeof duesConfigs.$inferSelect;
export type NewDuesConfig = typeof duesConfigs.$inferInsert;

export type DuesInvoice = typeof duesInvoices.$inferSelect;
export type NewDuesInvoice = typeof duesInvoices.$inferInsert;

export type AgingBucket = typeof agingBuckets.$inferSelect;
export type NewAgingBucket = typeof agingBuckets.$inferInsert;

export type DuesReminderLog = typeof duesReminderLogs.$inferSelect;
export type NewDuesReminderLog = typeof duesReminderLogs.$inferInsert;
