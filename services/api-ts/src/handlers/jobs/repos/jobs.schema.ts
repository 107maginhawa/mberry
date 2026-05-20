/**
 * Database schema for job board module (M15).
 * Tables: job_posting, job_application.
 * Matches volunteer.tsp JobPosting / JobApplication models.
 */

import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  uuid,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const jobPostingStatusEnum = pgEnum('job_posting_status', [
  'draft',
  'active',
  'filled',
  'expired',
  'closed',
]);

export const jobPostingTypeEnum = pgEnum('job_posting_type', [
  'full_time',
  'part_time',
  'contract',
  'fellowship',
  'internship',
]);

export const jobApplicationStatusEnum = pgEnum('job_application_status', [
  'applied',
  'screening',
  'interviewed',
  'offered',
  'hired',
  'rejected',
  'withdrawn',
]);

export const jobPostings = pgTable('job_posting', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  organizationName: varchar('organization_name', { length: 255 }).notNull(),
  location: varchar('location', { length: 500 }),
  type: jobPostingTypeEnum('type').notNull().default('full_time'),
  salary: varchar('salary', { length: 255 }),
  description: text('description'),
  requirements: jsonb('requirements').$type<string[]>(),
  postedAt: timestamp('posted_at'),
  expiresAt: timestamp('expires_at'),
  status: jobPostingStatusEnum('status').notNull().default('draft'),
  postedBy: uuid('posted_by'),
}, (table) => [
  index('idx_job_posting_org').on(table.organizationId),
  index('idx_job_posting_status').on(table.status),
  index('idx_job_posting_expires').on(table.expiresAt),
  index('idx_job_posting_type').on(table.type),
]);

export const jobApplications = pgTable('job_application', {
  ...baseEntityFields,
  postingId: uuid('posting_id').notNull(),
  personId: uuid('person_id').notNull(),
  resumeRef: varchar('resume_ref', { length: 500 }),
  coverLetter: text('cover_letter'),
  appliedAt: timestamp('applied_at').notNull().defaultNow(),
  status: jobApplicationStatusEnum('status').notNull().default('applied'),
}, (table) => [
  index('idx_job_app_posting').on(table.postingId),
  index('idx_job_app_person').on(table.personId),
  index('idx_job_app_status').on(table.status),
]);

// Types
export type JobPosting = typeof jobPostings.$inferSelect;
export type NewJobPosting = typeof jobPostings.$inferInsert;
export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;
