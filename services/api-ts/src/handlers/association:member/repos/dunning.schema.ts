/**
 * Database schema for dunning module — dunning templates and event tracking
 * Covers automated dues reminder escalation workflows
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, varchar, timestamp, text, integer, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const dunningChannelEnum = pgEnum('dunning_channel', [
  'email',
  'sms',
  'letter',
]);

export const dunningTemplateStatusEnum = pgEnum('dunning_template_status', [
  'active',
  'inactive',
]);

export const dunningDeliveryStatusEnum = pgEnum('dunning_delivery_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Dunning template defining escalation stage content and channel */
export const dunningTemplates = pgTable('dunning_template', {
  ...baseEntityFields,

  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  stage: integer('stage').notNull(), // 1-5
  daysAfterDue: integer('days_after_due').notNull(), // >= 0
  channel: dunningChannelEnum('channel').notNull(),
  subject: varchar('subject', { length: 200 }), // nullable, for email
  body: text('body').notNull(),
  status: dunningTemplateStatusEnum('status').default('active').notNull(),
}, (table) => ({
  orgIdx: index('dunning_template_org_idx').on(table.organizationId),
  orgStageIdx: index('dunning_template_org_stage_idx').on(table.organizationId, table.stage),
}));

/** Dunning event log — records each reminder sent to a member */
export const dunningEvents = pgTable('dunning_event', {
  ...baseEntityFields,

  membershipId: varchar('membership_id', { length: 255 }).notNull(),
  personId: varchar('person_id', { length: 255 }).notNull(),
  templateId: varchar('template_id', { length: 255 }).notNull(),
  stage: integer('stage').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  channel: dunningChannelEnum('channel').notNull(),
  deliveryStatus: dunningDeliveryStatusEnum('delivery_status').default('pending').notNull(),
}, (table) => ({
  membershipIdx: index('dunning_event_membership_idx').on(table.membershipId),
  templateIdx: index('dunning_event_template_idx').on(table.templateId),
  personIdx: index('dunning_event_person_idx').on(table.personId),
}));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type DunningTemplate = typeof dunningTemplates.$inferSelect;
export type NewDunningTemplate = typeof dunningTemplates.$inferInsert;

export type DunningEvent = typeof dunningEvents.$inferSelect;
export type NewDunningEvent = typeof dunningEvents.$inferInsert;
