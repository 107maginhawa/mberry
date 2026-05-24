/**
 * Database schema for credit tracking module (M10).
 * Tables: credit_entry, org_cpd_config.
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
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { cpdActivityTypeEnum } from '../../association:operations/repos/events.schema';

export const creditEntryTypeEnum = pgEnum('credit_entry_type', [
  'auto',   // From platform training attendance (BR-13)
  'manual', // Self-reported external activity
]);

export const creditSourceTypeEnum = pgEnum('credit_source_type', [
  'event_checkin', 'training_completion', 'course_completion', 'manual_award',
]);

export const creditStatusEnum = pgEnum('credit_status', ['active', 'voided', 'disputed']);

export const cpdCategoryEnum = pgEnum('credit_cpd_category', ['General', 'Major', 'Self-Directed']);

export const verificationStatusEnum = pgEnum('credit_verification_status', ['pending', 'verified', 'rejected']);

export const creditEntries = pgTable('credit_entry', {
  ...baseEntityFields,
  personId: uuid('person_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  type: creditEntryTypeEnum('type').notNull(),
  trainingId: uuid('training_id'),
  activityName: varchar('activity_name', { length: 300 }).notNull(),
  provider: varchar('provider', { length: 300 }),
  activityDate: timestamp('activity_date', { withTimezone: true }).notNull(),
  creditAmount: integer('credit_amount').notNull(),
  cycleStart: timestamp('cycle_start', { withTimezone: true }).notNull(),
  cycleEnd: timestamp('cycle_end', { withTimezone: true }).notNull(),
  supportingDocumentId: uuid('supporting_document_id'),
  category: cpdCategoryEnum('category'),
  approvalCode: varchar('approval_code', { length: 100 }),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),
  // Wave 2b
  sourceType: creditSourceTypeEnum('source_type'),
  sourceId: uuid('source_id'),
  cpdActivityType: cpdActivityTypeEnum('cpd_activity_type'),
  attestation: jsonb('attestation'),
  status: creditStatusEnum('status').default('active'),
  voidedReason: varchar('voided_reason', { length: 500 }),
}, (table) => [
  index('idx_credit_person').on(table.personId),
  index('idx_credit_org').on(table.organizationId),
  index('idx_credit_cycle').on(table.personId, table.cycleStart, table.cycleEnd),
  index('idx_credit_training').on(table.trainingId),
  index('idx_credit_source').on(table.sourceType, table.sourceId),
  unique('uq_credit_source_person').on(table.sourceType, table.sourceId, table.personId),
]);

export type CreditEntry = typeof creditEntries.$inferSelect;
export type NewCreditEntry = typeof creditEntries.$inferInsert;

export const orgCpdConfig = pgTable('org_cpd_config', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  requiredCredits: integer('required_credits').notNull().default(60),
  cycleLengthYears: integer('cycle_length_years').notNull().default(3),
  sdlCapPercent: integer('sdl_cap_percent').notNull().default(40),
  activityTypeMinimums: jsonb('activity_type_minimums'),
  cycleStartMonth: integer('cycle_start_month').notNull().default(1),
}, (table) => [
  unique('uq_org_cpd_config_org').on(table.organizationId),
]);

export type OrgCpdConfig = typeof orgCpdConfig.$inferSelect;
export type NewOrgCpdConfig = typeof orgCpdConfig.$inferInsert;
