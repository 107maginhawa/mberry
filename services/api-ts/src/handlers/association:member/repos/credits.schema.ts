/**
 * Database schema for credit tracking module (M10).
 * Tables: credit_entry.
 * Professional license tables already exist via credentials.tsp generated schema.
 */

import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  uuid,
  pgEnum,
  index,
  bigint,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const creditEntryTypeEnum = pgEnum('credit_entry_type', [
  'auto',   // From platform training attendance (BR-13)
  'manual', // Self-reported external activity
]);

export const creditEntries = pgTable('credit_entry', {
  ...baseEntityFields,
  personId: uuid('person_id').notNull(),
  /** Organization where the credit was earned */
  organizationId: uuid('organization_id').notNull(),
  type: creditEntryTypeEnum('type').notNull(),
  /** Link to training record for auto entries */
  trainingId: uuid('training_id'),
  /** Activity name (required for manual entries) */
  activityName: varchar('activity_name', { length: 300 }).notNull(),
  /** Provider/organizer (for manual entries) */
  provider: varchar('provider', { length: 300 }),
  /** Date the activity occurred */
  activityDate: timestamp('activity_date').notNull(),
  /** Credit value */
  creditAmount: integer('credit_amount').notNull(),
  /** Cycle this entry belongs to (computed) */
  cycleStart: timestamp('cycle_start').notNull(),
  cycleEnd: timestamp('cycle_end').notNull(),
  /** Supporting document ID (for manual entries) */
  supportingDocumentId: uuid('supporting_document_id'),
}, (table) => [
  index('idx_credit_person').on(table.personId),
  index('idx_credit_org').on(table.organizationId),
  index('idx_credit_cycle').on(table.personId, table.cycleStart, table.cycleEnd),
  index('idx_credit_training').on(table.trainingId),
]);

// Types
export type CreditEntry = typeof creditEntries.$inferSelect;
export type NewCreditEntry = typeof creditEntries.$inferInsert;
