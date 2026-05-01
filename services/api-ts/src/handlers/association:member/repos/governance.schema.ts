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
} from 'drizzle-orm/pg-core';
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
  tenantId: uuid('tenant_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  level: positionLevelEnum('level').notNull(),
  termLengthMonths: integer('term_length_months').notNull().default(12),
  maxTerms: integer('max_terms'),
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  index('idx_position_org').on(table.organizationId),
  index('idx_position_tenant').on(table.tenantId),
]);

export const officerTerms = pgTable('officer_term', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  positionId: uuid('position_id').notNull(),
  personId: uuid('person_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  status: termStatusEnum('status').notNull().default('upcoming'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  notes: text('notes'),
}, (table) => [
  index('idx_officer_term_org').on(table.organizationId),
  index('idx_officer_term_person').on(table.personId),
  index('idx_officer_term_position').on(table.positionId),
  index('idx_officer_term_tenant').on(table.tenantId),
]);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type OfficerTerm = typeof officerTerms.$inferSelect;
export type NewOfficerTerm = typeof officerTerms.$inferInsert;
