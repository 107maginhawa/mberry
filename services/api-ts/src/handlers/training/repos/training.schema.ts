import {
  pgTable, uuid, varchar, integer, boolean, timestamp, text, numeric, pgEnum, index, jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

export const trainingTypeEnum = pgEnum('training_type', [
  'seminar', 'workshop', 'convention', 'online_course', 'skills_training'
]);

export const trainingStatusEnum = pgEnum('training_status', [
  'draft', 'published', 'cancelled', 'pending_approval'
]);

export const enrollmentModeEnum = pgEnum('enrollment_mode', [
  'open', 'approval_required', 'invitation_only'
]);

export const regulatoryApprovalEnum = pgEnum('regulatory_approval', [
  'prc_approved', 'pending_approval', 'not_applicable'
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'enrolled', 'pending_approval', 'pending_payment', 'waitlisted', 'rejected', 'cancelled'
]);

export const trainings = pgTable('training', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  type: trainingTypeEnum('type').notNull(),
  description: text('description'),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at'),
  scheduleDescription: text('schedule_description'), // for multi-session
  locationType: varchar('location_type', { length: 20 }).notNull().default('in_person'),
  locationDetails: jsonb('location_details').$type<{ venue?: string; address?: string; meetingUrl?: string }>(),
  coverImage: text('cover_image'),
  creditValue: numeric('credit_value', { precision: 5, scale: 1 }).notNull().default('0'),
  creditValueLocked: boolean('credit_value_locked').notNull().default(false),
  regulatoryApproval: regulatoryApprovalEnum('regulatory_approval').notNull().default('not_applicable'),
  regulatoryReference: varchar('regulatory_reference', { length: 100 }),
  enrollmentMode: enrollmentModeEnum('enrollment_mode').notNull().default('open'),
  fee: integer('fee').default(0), // cents
  capacity: integer('capacity'), // null = unlimited
  visibility: varchar('visibility', { length: 20 }).notNull().default('network'),
  status: trainingStatusEnum('status').notNull().default('draft'),
}, (table) => ({
  orgIdx: index('training_org_idx').on(table.organizationId),
  statusIdx: index('training_status_idx').on(table.status),
  startAtIdx: index('training_start_at_idx').on(table.startAt),
  orgStatusIdx: index('training_org_status_idx').on(table.organizationId, table.status),
}));

export const trainingEnrollments = pgTable('training_enrollment', {
  ...baseEntityFields,
  trainingId: uuid('training_id').notNull().references(() => trainings.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  status: enrollmentStatusEnum('status').notNull().default('enrolled'),
  paymentStatus: varchar('payment_status', { length: 20 }),
  waitlistPosition: integer('waitlist_position'),
}, (table) => ({
  trainingIdx: index('training_enroll_training_idx').on(table.trainingId),
  personIdx: index('training_enroll_person_idx').on(table.personId),
  trainingPersonIdx: index('training_enroll_tp_idx').on(table.trainingId, table.personId),
}));

export const trainingAttendance = pgTable('training_attendance', {
  ...baseEntityFields,
  trainingId: uuid('training_id').notNull().references(() => trainings.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at').notNull().defaultNow(),
  method: varchar('method', { length: 20 }).notNull().default('manual'),
  creditsAwarded: numeric('credits_awarded', { precision: 5, scale: 1 }).notNull().default('0'),
}, (table) => ({
  trainingIdx: index('training_att_training_idx').on(table.trainingId),
  personIdx: index('training_att_person_idx').on(table.personId),
  trainingPersonIdx: index('training_att_tp_idx').on(table.trainingId, table.personId),
}));

// Type exports
export type Training = typeof trainings.$inferSelect;
export type NewTraining = typeof trainings.$inferInsert;
export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;
export type NewTrainingEnrollment = typeof trainingEnrollments.$inferInsert;
export type TrainingAttendance = typeof trainingAttendance.$inferSelect;
export type NewTrainingAttendance = typeof trainingAttendance.$inferInsert;
