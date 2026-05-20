/**
 * Database schema for committee tasks (M19).
 * Table: committee_task.
 */

import {
  pgTable,
  varchar,
  timestamp,
  text,
  uuid,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const committeeTaskStatusEnum = pgEnum('committee_task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const committeeTaskPriorityEnum = pgEnum('committee_task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const committeeTasks = pgTable('committee_task', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  committeeId: uuid('committee_id').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  assigneeId: uuid('assignee_id'),
  status: committeeTaskStatusEnum('status').notNull().default('pending'),
  priority: committeeTaskPriorityEnum('priority').notNull().default('medium'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by'),
}, (table) => [
  index('idx_committee_task_org').on(table.organizationId),
  index('idx_committee_task_committee').on(table.committeeId),
  index('idx_committee_task_assignee').on(table.assigneeId),
  index('idx_committee_task_status').on(table.status),
  index('idx_committee_task_due').on(table.dueDate),
]);

// Types
export type CommitteeTask = typeof committeeTasks.$inferSelect;
export type NewCommitteeTask = typeof committeeTasks.$inferInsert;
