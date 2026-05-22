/**
 * Database schema for advertising module - matches TypeSpec + M16 spec
 * Uses Drizzle ORM with PostgreSQL for advertisers, campaigns, creatives
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// Enums
export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'pending_review',
  'active',
  'paused',
  'completed',
  'rejected',
]);

export const creativeStatusEnum = pgEnum('creative_status', [
  'pending',
  'approved',
  'rejected',
]);

export const adSlotEnum = pgEnum('ad_slot', [
  'feed_banner',
  'sidebar',
  'email_footer',
  'event_sponsor',
]);

// Advertisers
export const advertisers = pgTable('advertiser', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  companyName: text('company_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPersonId: uuid('contact_person_id'),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => ({
  orgIdx: index('advertisers_org_idx').on(table.organizationId),
}));

// Campaigns
export const campaigns = pgTable('ad_campaign', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  advertiserId: uuid('advertiser_id')
    .notNull()
    .references(() => advertisers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: campaignStatusEnum('status').notNull().default('draft'),

  // Targeting — segment-based only, no PII (M16-R2)
  targetSegmentId: text('target_segment_id'),
  targetSegmentSize: integer('target_segment_size'),

  // Budget (M16-R6)
  budgetCents: integer('budget_cents').notNull().default(0),
  spentCents: integer('spent_cents').notNull().default(0),

  // Schedule
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),

  // Slots
  adSlot: adSlotEnum('ad_slot').notNull().default('feed_banner'),
}, (table) => ({
  orgIdx: index('campaigns_org_idx').on(table.organizationId),
  advertiserIdx: index('campaigns_advertiser_idx').on(table.advertiserId),
  statusIdx: index('campaigns_status_idx').on(table.status),
  slotIdx: index('campaigns_slot_idx').on(table.adSlot),
}));

// Creatives (ad assets)
export const creatives = pgTable('ad_creative', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  bodyText: text('body_text').notNull(),
  imageUrl: text('image_url'),
  clickUrl: text('click_url'),

  // Review status (M16-R1: admin approval before display)
  status: creativeStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),

  // M16-R3: must be labeled "Sponsored"
  sponsoredLabel: boolean('sponsored_label').notNull().default(true),
}, (table) => ({
  campaignIdx: index('creatives_campaign_idx').on(table.campaignId),
  statusIdx: index('creatives_status_idx').on(table.status),
}));

// Member ad opt-out (M16-R4)
export const memberAdOptOuts = pgTable('member_ad_opt_out', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull(),
  optedOutAt: timestamp('opted_out_at').notNull().defaultNow(),
}, (table) => ({
  personIdx: index('ad_opt_out_person_idx').on(table.personId),
  orgPersonIdx: index('ad_opt_out_org_person_idx').on(table.organizationId, table.personId),
}));

// Ad reports (M16-R5)
export const adReports = pgTable('ad_report', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  creativeId: uuid('creative_id')
    .notNull()
    .references(() => creatives.id),
  reporterPersonId: uuid('reporter_person_id').notNull(),
  reason: text('reason').notNull(),
}, (table) => ({
  creativeIdx: index('ad_reports_creative_idx').on(table.creativeId),
}));

// Type exports
export type Advertiser = typeof advertisers.$inferSelect;
export type NewAdvertiser = typeof advertisers.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

export type Creative = typeof creatives.$inferSelect;
export type NewCreative = typeof creatives.$inferInsert;

export type MemberAdOptOut = typeof memberAdOptOuts.$inferSelect;
export type NewMemberAdOptOut = typeof memberAdOptOuts.$inferInsert;

export type AdReport = typeof adReports.$inferSelect;
export type NewAdReport = typeof adReports.$inferInsert;

// Filter types
export interface AdvertiserFilters {
  organizationId?: string;
  isActive?: boolean;
}

export interface CampaignFilters {
  organizationId?: string;
  advertiserId?: string;
  status?: string;
  adSlot?: string;
}

export interface CreativeFilters {
  organizationId?: string;
  campaignId?: string;
  status?: string;
}

export interface AdReportFilters {
  organizationId?: string;
  creativeId?: string;
}
