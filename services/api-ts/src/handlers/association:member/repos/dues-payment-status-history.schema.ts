import {
  pgTable,
  uuid,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { duesPayments, duesPaymentStatusEnum } from './dues-payments.schema';

/**
 * Dues payment status change history.
 * Tracks every payment status transition for financial audit trail.
 * Additive — does not modify the dues_payment table.
 */
export const duesPaymentStatusHistory = pgTable('dues_payment_status_history', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  paymentId: uuid('payment_id').notNull().references(() => duesPayments.id, { onDelete: 'restrict' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),
  fromStatus: duesPaymentStatusEnum('from_status'),
  toStatus: duesPaymentStatusEnum('to_status').notNull(),
  reason: text('reason'),
  changedBy: uuid('changed_by').references(() => persons.id, { onDelete: 'restrict' }),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('dues_payment_status_history_org_idx').on(table.organizationId),
  paymentIdx: index('dues_payment_status_history_payment_idx').on(table.paymentId),
  personIdx: index('dues_payment_status_history_person_idx').on(table.personId),
  changedAtIdx: index('dues_payment_status_history_changed_at_idx').on(table.changedAt),
}));

export type DuesPaymentStatusHistory = typeof duesPaymentStatusHistory.$inferSelect;
export type NewDuesPaymentStatusHistory = typeof duesPaymentStatusHistory.$inferInsert;
