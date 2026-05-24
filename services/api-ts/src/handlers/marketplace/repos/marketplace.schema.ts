/**
 * Database schema for marketplace module - matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL for vendors, listings, and orders
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
export const vendorStatusEnum = pgEnum('vendor_status', [
  'pending',
  'verified',
  'suspended',
  'rejected',
]);

export const vendorCategoryEnum = pgEnum('vendor_category', [
  'emr',
  'supplies',
  'insurance',
  'telehealth',
  'other',
]);

export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'active',
  'archived',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'fulfilled',
  'cancelled',
  'refunded',
]);

// Vendors
export const vendors = pgTable('vendor', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  companyName: text('company_name').notNull(),
  category: vendorCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  verificationStatus: vendorStatusEnum('verification_status')
    .notNull()
    .default('pending'),
  websiteUrl: text('website_url'),
  contactEmail: text('contact_email').notNull(),
  contactPersonId: uuid('contact_person_id'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: uuid('verified_by'),
}, (table) => ({
  orgIdx: index('vendors_org_idx').on(table.organizationId),
  statusIdx: index('vendors_status_idx').on(table.verificationStatus),
  categoryIdx: index('vendors_category_idx').on(table.category),
}));

// Marketplace Listings
export const marketplaceListings = pgTable('marketplace_listing', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }),
  currency: text('currency').default('USD'),
  status: listingStatusEnum('status').notNull().default('draft'),
  categoryTags: jsonb('category_tags').$type<string[]>().default([]),
}, (table) => ({
  orgIdx: index('listings_org_idx').on(table.organizationId),
  vendorIdx: index('listings_vendor_idx').on(table.vendorId),
  statusIdx: index('listings_status_idx').on(table.status),
}));

// Orders
export const marketplaceOrders = pgTable('marketplace_order', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => marketplaceListings.id),
  buyerPersonId: uuid('buyer_person_id').notNull(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  quantity: integer('quantity').notNull().default(1),
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('orders_org_idx').on(table.organizationId),
  buyerIdx: index('orders_buyer_idx').on(table.buyerPersonId),
  vendorIdx: index('orders_vendor_idx').on(table.vendorId),
  statusIdx: index('orders_status_idx').on(table.status),
  listingIdx: index('orders_listing_idx').on(table.listingId),
}));

// Type exports
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type NewMarketplaceListing = typeof marketplaceListings.$inferInsert;

export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;
export type NewMarketplaceOrder = typeof marketplaceOrders.$inferInsert;

// Filter types
export interface VendorFilters {
  organizationId?: string;
  category?: string;
  verificationStatus?: string;
  contactEmail?: string;
}

export interface ListingFilters {
  organizationId?: string;
  vendorId?: string;
  status?: string;
  categoryTag?: string;
}

export interface OrderFilters {
  organizationId?: string;
  buyerPersonId?: string;
  vendorId?: string;
  listingId?: string;
  status?: string;
}
