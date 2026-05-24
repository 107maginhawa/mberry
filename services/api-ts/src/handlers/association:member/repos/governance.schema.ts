/**
 * Database schema for governance module — positions and officer terms.
 * Matches TypeSpec governance.tsp definitions (Wave 1 scope: positions + terms only).
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
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';

export const positionLevelEnum = pgEnum('position_level', [
  'national',
  'regional',
  'chapter',
]);

export const termStatusEnum = pgEnum('term_status', [
  'upcoming',
  'active',
  'completed',
  'resigned',
  'removed',
]);

export const positions = pgTable('position', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  level: positionLevelEnum('level').notNull(),
  termLengthMonths: integer('term_length_months').notNull().default(12),
  maxTerms: integer('max_terms'),
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  index('idx_position_org').on(table.organizationId),
]);

export const officerTerms = pgTable('officer_term', {
  ...baseEntityFields,
  positionId: uuid('position_id').notNull().references(() => positions.id),
  personId: uuid('person_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  status: termStatusEnum('status').notNull().default('upcoming'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  notes: text('notes'),
}, (table) => [
  index('idx_officer_term_org').on(table.organizationId),
  index('idx_officer_term_person').on(table.personId),
  index('idx_officer_term_position').on(table.positionId),
  check('officer_term_date_order', sql`${table.endDate} IS NULL OR ${table.endDate} > ${table.startDate}`),
]);

// ─── Transition Checklist (M4-R3) ────────────────────────

export const transitionChecklistStatusEnum = pgEnum('transition_checklist_status', [
  'pending',
  'completed',
]);

export const transitionChecklists = pgTable('transition_checklist', {
  ...baseEntityFields,
  officerTermId: uuid('officer_term_id').notNull().references(() => officerTerms.id),
  organizationId: uuid('organization_id').notNull(),
  item: varchar('item', { length: 500 }).notNull(),
  status: transitionChecklistStatusEnum('status').notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by'),
  notes: text('notes'),
}, (table) => [
  index('idx_transition_checklist_term').on(table.officerTermId),
  index('idx_transition_checklist_org').on(table.organizationId),
]);

// ─── Disciplinary Action (M4-R4) ─────────────────────────

export const disciplinaryActionTypeEnum = pgEnum('disciplinary_action_type', [
  'warning',
  'suspension',
  'removal',
  'probation',
]);

export const disciplinaryActions = pgTable('disciplinary_action', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  targetPersonId: uuid('target_person_id').notNull(),
  issuedBy: uuid('issued_by').notNull(),
  actionType: disciplinaryActionTypeEnum('action_type').notNull(),
  reason: text('reason').notNull(), // M4-R4: mandatory reason
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  notes: text('notes'),
  // M4-R4: immutable — no update allowed after creation
}, (table) => [
  index('idx_disciplinary_action_org').on(table.organizationId),
  index('idx_disciplinary_action_target').on(table.targetPersonId),
  index('idx_disciplinary_action_issuer').on(table.issuedBy),
]);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type OfficerTerm = typeof officerTerms.$inferSelect;
export type NewOfficerTerm = typeof officerTerms.$inferInsert;
export type TransitionChecklist = typeof transitionChecklists.$inferSelect;
export type NewTransitionChecklist = typeof transitionChecklists.$inferInsert;
export type DisciplinaryAction = typeof disciplinaryActions.$inferSelect;
export type NewDisciplinaryAction = typeof disciplinaryActions.$inferInsert;
