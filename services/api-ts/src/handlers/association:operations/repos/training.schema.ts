/**
 * Database schema for training module.
 * Tables: training, training_enrollment, course, course_enrollment, quiz_attempt.
 * Matches training.tsp models.
 */

import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  jsonb,
  uuid,
  pgEnum,
  index,
  bigint,
  real,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const trainingStatusEnum = pgEnum('training_status', [
  'draft',
  'published',
  'cancelled',
  'completed',
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'enrolled',
  'completed',
  'cancelled',
  'noShow',
]);

export const courseStatusEnum = pgEnum('course_status', [
  'draft',
  'published',
  'archived',
]);

export const trainings = pgTable('training', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  instructorName: varchar('instructor_name', { length: 200 }),
  instructorId: uuid('instructor_id'),
  location: varchar('location', { length: 500 }),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  capacity: integer('capacity'),
  registrationFee: bigint('registration_fee', { mode: 'number' }).default(0),
  currency: varchar('currency', { length: 3 }).default('PHP'),
  creditBearing: boolean('credit_bearing').default(false),
  creditAmount: integer('credit_amount').default(0),
  status: trainingStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at'),
}, (table) => [
  index('idx_training_org').on(table.organizationId),
  index('idx_training_status').on(table.status),
]);

export const trainingEnrollments = pgTable('training_enrollment', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  trainingId: uuid('training_id').notNull(),
  personId: uuid('person_id').notNull(),
  status: enrollmentStatusEnum('status').notNull().default('enrolled'),
  enrolledAt: timestamp('enrolled_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
}, (table) => [
  index('idx_training_enroll_org').on(table.organizationId),
  index('idx_training_enroll_training').on(table.trainingId),
  index('idx_training_enroll_person').on(table.personId),
]);

export const courses = pgTable('course', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  creditAmount: integer('credit_amount').default(0),
  status: courseStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at'),
}, (table) => [
  index('idx_course_org').on(table.organizationId),
]);

export const courseEnrollments = pgTable('course_enrollment', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  courseId: uuid('course_id').notNull(),
  personId: uuid('person_id').notNull(),
  progress: real('progress').default(0),
  completedAt: timestamp('completed_at'),
  status: enrollmentStatusEnum('status').notNull().default('enrolled'),
}, (table) => [
  index('idx_course_enroll_org').on(table.organizationId),
  index('idx_course_enroll_course').on(table.courseId),
  index('idx_course_enroll_person').on(table.personId),
]);

export const quizAttempts = pgTable('quiz_attempt', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  courseId: uuid('course_id').notNull(),
  personId: uuid('person_id').notNull(),
  score: real('score'),
  maxScore: real('max_score'),
  passed: boolean('passed'),
  attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
  answers: jsonb('answers').$type<Record<string, unknown>>(),
}, (table) => [
  index('idx_quiz_org').on(table.organizationId),
  index('idx_quiz_course').on(table.courseId),
  index('idx_quiz_person').on(table.personId),
]);

// Types
export type Training = typeof trainings.$inferSelect;
export type NewTraining = typeof trainings.$inferInsert;
export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;
export type NewTrainingEnrollment = typeof trainingEnrollments.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type NewCourseEnrollment = typeof courseEnrollments.$inferInsert;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
