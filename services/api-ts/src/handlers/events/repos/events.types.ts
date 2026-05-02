import {
  pgTable, uuid, varchar, integer, boolean, timestamp, text, pgEnum, index, jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

export const eventTypeEnum = pgEnum('event_type', [
  'general_assembly', 'induction_ceremony', 'fellowship', 'medical_mission',
  'board_meeting', 'committee_meeting', 'fundraiser', 'other'
]);

export const eventStatusEnum = pgEnum('event_status', [
  'draft', 'published', 'cancelled'
]);

export const eventVisibilityEnum = pgEnum('event_visibility', [
  'internal', 'network'
]);

export const locationTypeEnum = pgEnum('event_location_type', ['in_person', 'online']);

export const registrationStatusEnum = pgEnum('registration_status', [
  'registered', 'waitlisted', 'cancelled', 'pending_payment'
]);

export const checkinMethodEnum = pgEnum('checkin_method', ['qr', 'manual']);

export const events = pgTable('event', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  type: eventTypeEnum('type').notNull(),
  description: text('description'),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  locationType: locationTypeEnum('location_type').notNull().default('in_person'),
  locationDetails: jsonb('location_details').$type<{ venue?: string; address?: string; meetingUrl?: string }>(),
  coverImage: text('cover_image'),
  registrationEnabled: boolean('registration_enabled').notNull().default(true),
  fee: integer('fee').default(0), // cents
  capacity: integer('capacity'), // null = unlimited
  qrEnabled: boolean('qr_enabled').notNull().default(true),
  visibility: eventVisibilityEnum('visibility').notNull().default('internal'),
  status: eventStatusEnum('status').notNull().default('draft'),
}, (table) => ({
  orgIdx: index('event_org_idx').on(table.organizationId),
  statusIdx: index('event_status_idx').on(table.status),
  startAtIdx: index('event_start_at_idx').on(table.startAt),
  orgStatusIdx: index('event_org_status_idx').on(table.organizationId, table.status),
}));

export const eventRegistrations = pgTable('event_registration', {
  ...baseEntityFields,
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  status: registrationStatusEnum('status').notNull().default('registered'),
  paymentStatus: varchar('payment_status', { length: 20 }),
  waitlistPosition: integer('waitlist_position'),
}, (table) => ({
  eventIdx: index('event_reg_event_idx').on(table.eventId),
  personIdx: index('event_reg_person_idx').on(table.personId),
  eventPersonIdx: index('event_reg_event_person_idx').on(table.eventId, table.personId),
}));

export const eventAttendance = pgTable('event_attendance', {
  ...baseEntityFields,
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  checkedInAt: timestamp('checked_in_at').notNull().defaultNow(),
  method: checkinMethodEnum('method').notNull().default('manual'),
}, (table) => ({
  eventIdx: index('event_att_event_idx').on(table.eventId),
  personIdx: index('event_att_person_idx').on(table.personId),
  eventPersonIdx: index('event_att_event_person_idx').on(table.eventId, table.personId),
}));

// Type exports
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type NewEventRegistration = typeof eventRegistrations.$inferInsert;
export type EventAttendance = typeof eventAttendance.$inferSelect;
export type NewEventAttendance = typeof eventAttendance.$inferInsert;
