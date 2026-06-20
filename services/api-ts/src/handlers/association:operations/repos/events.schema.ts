/**
 * Database schema for events module.
 * Tables: event, event_registration, check_in, waitlist_entry.
 * Matches events.tsp models.
 */

import {
  pgTable,
  varchar,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  text,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  bigint,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'published',
  'cancelled',
  'completed',
]);

export const registrationStatusEnum = pgEnum('registration_status', [
  'confirmed',
  'waitlisted',
  'cancelled',
  'refunded',
  'noShow',
]);

export const checkInMethodEnum = pgEnum('check_in_method', [
  'qr',
  'manual',
]);

export const eventVisibilityEnum = pgEnum('event_visibility', [
  'internal',
  'network',
]);

export const cpdActivityTypeEnum = pgEnum('cpd_activity_type', [
  'seminar',
  'workshop',
  'conference',
  'webinar',
  'hands_on',
  'community',
  'research',
  'mentorship',
  'self_directed',
  'other',
]);

export const eventTypeEnum = pgEnum('event_type', [
  // Legacy values (kept for existing rows) …
  'generalAssembly', 'inductionCeremony', 'fellowship', 'medicalMission',
  'boardMeeting', 'committeeMeeting', 'fundraiser', 'other',
  // … plus the canonical API/form values (ISSUE-030, migration 0074).
  'assembly', 'seminar', 'social', 'networking', 'governance', 'custom',
]);

export const events = pgTable('event', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  eventType: eventTypeEnum('event_type').default('other'),
  description: text('description'),
  location: varchar('location', { length: 500 }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  capacity: integer('capacity'),
  registrationFee: bigint('registration_fee', { mode: 'number' }).default(0),
  currency: varchar('currency', { length: 3 }).default('PHP'),
  creditBearing: boolean('credit_bearing').default(false),
  creditAmount: doublePrecision('credit_amount').default(0),
  cpdActivityType: cpdActivityTypeEnum('cpd_activity_type'),
  eventSlug: varchar('event_slug', { length: 300 }).unique(),
  coverImageUrl: varchar('cover_image_url', { length: 2048 }),
  status: eventStatusEnum('status').notNull().default('draft'),
  visibility: eventVisibilityEnum('visibility').notNull().default('internal'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => [
  index('idx_event_org').on(table.organizationId),
  index('idx_event_status').on(table.status),
  index('idx_event_start').on(table.startDate),
  index('idx_event_slug').on(table.eventSlug),
]);

export const eventRegistrations = pgTable('event_registration', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  eventId: uuid('event_id').notNull(),
  personId: uuid('person_id').notNull(),
  status: registrationStatusEnum('status').notNull().default('confirmed'),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
}, (table) => [
  index('idx_event_reg_org').on(table.organizationId),
  index('idx_event_reg_event').on(table.eventId),
  index('idx_event_reg_person').on(table.personId),
  // P0 RACE FIX: a person may hold at most ONE active registration per event.
  // Partial unique on (event_id, person_id) WHERE status NOT IN terminal states
  // ('cancelled' | 'refunded') — so a cancelled/refunded reg does NOT block a
  // later re-register, but a duplicate confirmed/waitlisted/noShow row is
  // rejected with 23505 → "already registered".
  uniqueIndex('uq_event_reg_active')
    .on(table.eventId, table.personId)
    .where(sql`status NOT IN ('cancelled', 'refunded')`),
]);

export const checkIns = pgTable('check_in', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  eventId: uuid('event_id').notNull(),
  personId: uuid('person_id').notNull(),
  method: checkInMethodEnum('method').notNull(),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
  checkedInBy: uuid('checked_in_by'),
  attestation: jsonb('attestation').$type<{
    officerId: string;
    method: string;
    deviceInfo?: string;
    timestamp: string;
  }>(),
}, (table) => [
  index('idx_checkin_org').on(table.organizationId),
  index('idx_checkin_event').on(table.eventId),
  index('idx_checkin_person').on(table.personId),
]);

export const waitlistEntries = pgTable('waitlist_entry', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  eventId: uuid('event_id').notNull(),
  personId: uuid('person_id').notNull(),
  position: integer('position').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  promotedAt: timestamp('promoted_at', { withTimezone: true }),
}, (table) => [
  index('idx_waitlist_org').on(table.organizationId),
  index('idx_waitlist_event').on(table.eventId),
]);

// Types
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type NewEventRegistration = typeof eventRegistrations.$inferInsert;
export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type NewWaitlistEntry = typeof waitlistEntries.$inferInsert;
