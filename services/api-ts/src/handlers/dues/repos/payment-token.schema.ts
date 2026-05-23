/**
 * Database schema for one-tap payment tokens.
 * Allows officers to generate secure payment links for members.
 * Tokens are HMAC-SHA256 signed, single-use, 72-hour expiry.
 */

import {
  pgTable,
  varchar,
  timestamp,
  integer,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

export const paymentTokens = pgTable('payment_token', {
  ...baseEntityFields,

  /** HMAC-SHA256 hash of the raw token (never store raw) */
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),

  /** Member this payment is for */
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),

  /** Organization the payment belongs to */
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  /** Optional invoice reference */
  invoiceId: uuid('invoice_id'),

  /** Amount in cents */
  amount: integer('amount').notNull(),

  /** ISO 4217 currency code */
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),

  /** When the token expires (default: 72 hours from creation) */
  expiresAt: timestamp('expires_at').notNull(),

  /** When the token was used for checkout (null = unused) */
  usedAt: timestamp('used_at'),

  /** Officer who created this payment link */
  createdByOfficer: uuid('created_by_officer').notNull().references(() => persons.id),
}, (table) => [
  index('idx_payment_token_hash').on(table.tokenHash),
  index('idx_payment_token_person').on(table.personId),
  index('idx_payment_token_org').on(table.organizationId),
]);

export type PaymentToken = typeof paymentTokens.$inferSelect;
export type NewPaymentToken = typeof paymentTokens.$inferInsert;
