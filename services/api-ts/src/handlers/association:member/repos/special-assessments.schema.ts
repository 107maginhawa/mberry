/**
 * Database schema for special assessments — one-time charges alongside dues.
 * Uses Drizzle ORM with PostgreSQL.
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  pgEnum,
  index,
  bigint,
  date,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { duesFunds } from './dues-payments.schema';
import { duesInvoices } from './dues.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const assessmentAppliesToEnum = pgEnum('assessment_applies_to', ['all', 'selected']);
export const assessmentStatusEnum = pgEnum('assessment_status', ['draft', 'active', 'closed']);
export const assessmentTargetStatusEnum = pgEnum('assessment_target_status', ['pending', 'paid']);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Special assessment — a one-time charge created by an officer */
export const specialAssessments = pgTable('special_assessment', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  amount: bigint('amount', { mode: 'number' }).notNull(), // cents
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  dueDate: date('due_date').notNull(),
  fundId: uuid('fund_id').references(() => duesFunds.id),
  appliesTo: assessmentAppliesToEnum('applies_to').notNull().default('all'),
  status: assessmentStatusEnum('status').notNull().default('draft'),
}, (table) => ({
  orgIdx: index('special_assessment_org_idx').on(table.organizationId),
  orgStatusIdx: index('special_assessment_org_status_idx').on(table.organizationId, table.status),
}));

/** Target member for a special assessment */
export const specialAssessmentTargets = pgTable('special_assessment_target', {
  ...baseEntityFields,

  assessmentId: uuid('assessment_id').notNull().references(() => specialAssessments.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => persons.id),
  invoiceId: uuid('invoice_id').references(() => duesInvoices.id),
  status: assessmentTargetStatusEnum('target_status').notNull().default('pending'),
}, (table) => ({
  assessmentIdx: index('special_assessment_target_assessment_idx').on(table.assessmentId),
  personIdx: index('special_assessment_target_person_idx').on(table.personId),
  assessmentPersonIdx: index('special_assessment_target_assessment_person_idx').on(table.assessmentId, table.personId),
}));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type SpecialAssessment = typeof specialAssessments.$inferSelect;
export type NewSpecialAssessment = typeof specialAssessments.$inferInsert;
export type SpecialAssessmentTarget = typeof specialAssessmentTargets.$inferSelect;
export type NewSpecialAssessmentTarget = typeof specialAssessmentTargets.$inferInsert;
