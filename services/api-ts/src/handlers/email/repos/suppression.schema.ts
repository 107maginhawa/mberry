/**
 * Email suppression table schema
 * Tracks suppressed email addresses per organization for bounce, unsubscribe, and complaint handling.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { baseEntityFields, type BaseEntity } from '@/core/database.schema';

/**
 * Reasons an email address can be suppressed
 */
export const suppressionReasonEnum = pgEnum('suppression_reason', [
  'hard_bounce',
  'unsubscribe',
  'complaint',
  'manual',
]);

export type SuppressionReason = typeof suppressionReasonEnum.enumValues[number];

/**
 * Email suppression table
 * Org-scoped — the same email address can be suppressed in different orgs independently.
 */
export const emailSuppressions = pgTable(
  'email_suppression',
  {
    ...baseEntityFields,

    // Multi-tenant scoping
    organizationId: uuid('organization_id').notNull(),

    // Suppressed email address
    email: varchar('email', { length: 255 }).notNull(),

    // Why the email was suppressed
    reason: suppressionReasonEnum('reason').notNull(),

    // When suppression was added (may differ from createdAt in imports)
    suppressedAt: timestamp('suppressed_at').notNull().defaultNow(),

    // Who added the suppression (null = system/automated)
    suppressedBy: uuid('suppressed_by'),

    // Optional notes for manual suppressions
    notes: text('notes'),
  },
  (table) => ({
    // Composite index for fast org+email lookups
    orgEmailIdx: index('email_suppression_org_email_idx').on(table.organizationId, table.email),

    // Standalone email index for cross-org email lookups (admin use)
    emailIdx: index('email_suppression_email_idx').on(table.email),

    // Unique constraint: one suppression per email per org
    orgEmailUnique: unique('email_suppression_org_email_unique').on(
      table.organizationId,
      table.email,
    ),
  }),
);

/**
 * Type exports
 */
export type EmailSuppression = typeof emailSuppressions.$inferSelect;
export type NewEmailSuppression = typeof emailSuppressions.$inferInsert;

/**
 * Filters for listing suppressions
 */
export interface SuppressionFilters {
  organizationId?: string;
  email?: string;
  reason?: SuppressionReason;
}
