/**
 * Database schema for committee module (M19).
 * Tables: committee, committee_member.
 */

import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  text,
  uuid,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const committeeStatusEnum = pgEnum('committee_status', [
  'active',
  'completed',
]);

export const committeeMemberRoleEnum = pgEnum('committee_member_role', [
  'member',
  'chairperson',
  'vice_chairperson',
  'secretary',
]);

export const committees = pgTable('committee', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: committeeStatusEnum('status').notNull().default('active'),
  dissolvedAt: timestamp('dissolved_at'),
  dissolvedBy: uuid('dissolved_by'),
  dissolutionReason: text('dissolution_reason'),
}, (table) => [
  index('idx_committee_org').on(table.organizationId),
  index('idx_committee_status').on(table.status),
]);

export const committeeMembers = pgTable('committee_member', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  committeeId: uuid('committee_id').notNull(),
  personId: uuid('person_id').notNull(),
  role: committeeMemberRoleEnum('role').notNull().default('member'),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  removedAt: timestamp('removed_at'),
  active: boolean('active').notNull().default(true),
}, (table) => [
  index('idx_committee_member_org').on(table.organizationId),
  index('idx_committee_member_committee').on(table.committeeId),
  index('idx_committee_member_person').on(table.personId),
]);

// Types
export type Committee = typeof committees.$inferSelect;
export type NewCommittee = typeof committees.$inferInsert;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type NewCommitteeMember = typeof committeeMembers.$inferInsert;
