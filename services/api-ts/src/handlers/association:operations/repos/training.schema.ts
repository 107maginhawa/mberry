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
  uniqueIndex,
  bigint,
  real,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';

export const trainingVisibilityEnum = pgEnum('training_visibility', ['internal', 'network']);

/**
 * FIX-007 (M9-R1): platform-defined training delivery formats. Mirrors the
 * TypeSpec `TrainingType` enum (training.tsp). The set is immutable —
 * per-org custom types are explicitly forbidden by M9-R1.
 */
export const trainingTypeEnum = pgEnum('training_type', [
  'seminar',
  'workshop',
  'webinar',
  'self_paced',
  'hands_on',
]);

export const trainingStatusEnum = pgEnum('training_status', [
  'draft',
  'published',
  'cancelled',
  'completed',
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  // TC-DEC-01 (Step 47): proof-of-payment holding state for paid trainings.
  // A paid enrollment starts here; an officer confirms offline payment to
  // move it to `enrolled`. Only `enrolled` may be completed for credit.
  'payment_pending',
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
  /** FIX-007 (M9-R1): platform training delivery format (nullable for pre-migration rows). */
  type: trainingTypeEnum('type'),
  description: text('description'),
  instructorName: varchar('instructor_name', { length: 200 }),
  instructorId: uuid('instructor_id'),
  location: varchar('location', { length: 500 }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  capacity: integer('capacity'),
  registrationFee: bigint('registration_fee', { mode: 'number' }).default(0),
  currency: varchar('currency', { length: 3 }).default('PHP'),
  creditBearing: boolean('credit_bearing').default(false),
  creditAmount: integer('credit_amount').default(0),
  status: trainingStatusEnum('status').notNull().default('draft'),
  visibility: trainingVisibilityEnum('visibility').notNull().default('network'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  /** PRC accreditation number for this training */
  prcAccreditationNumber: varchar('prc_accreditation_number', { length: 100 }),
  /** Reference to the accredited provider (no DB FK — validated in handler) */
  accreditedProviderId: uuid('accredited_provider_id'),
}, (table) => [
  index('idx_training_org').on(table.organizationId),
  index('idx_training_status').on(table.status),
  index('idx_training_type').on(table.type),
]);

export const trainingEnrollments = pgTable('training_enrollment', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  trainingId: uuid('training_id').notNull(),
  personId: uuid('person_id').notNull(),
  status: enrollmentStatusEnum('status').notNull().default('enrolled'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  // TC-DEC-01 (Step 47): proof-of-payment fields for paid trainings. The
  // member attaches an offline-payment proof (submitTrainingPaymentProof);
  // an officer confirms it (confirmTrainingPayment), recording who/when.
  proofStorageKey: varchar('proof_storage_key', { length: 500 }),
  proofFileName: varchar('proof_file_name', { length: 255 }),
  proofMimeType: varchar('proof_mime_type', { length: 100 }),
  paymentSubmittedAt: timestamp('payment_submitted_at', { withTimezone: true }),
  paymentConfirmedBy: uuid('payment_confirmed_by'),
  paymentConfirmedAt: timestamp('payment_confirmed_at', { withTimezone: true }),
}, (table) => [
  index('idx_training_enroll_org').on(table.organizationId),
  index('idx_training_enroll_training').on(table.trainingId),
  index('idx_training_enroll_person').on(table.personId),
  // FIX-010 (G10): DB backstop for the duplicate-enrollment guard. A member
  // may hold at most one ACTIVE (non-cancelled) enrollment per training; the
  // partial unique index lets a member re-enroll after cancelling while
  // preventing duplicate live rows even under a race.
  uniqueIndex('uq_training_enroll_active')
    .on(table.trainingId, table.personId)
    .where(sql`${table.status} <> 'cancelled'`),
]);

export const courses = pgTable('course', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  creditAmount: integer('credit_amount').default(0),
  status: courseStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => [
  index('idx_course_org').on(table.organizationId),
]);

export const courseEnrollments = pgTable('course_enrollment', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  courseId: uuid('course_id').notNull(),
  personId: uuid('person_id').notNull(),
  progress: real('progress').default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
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
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
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
