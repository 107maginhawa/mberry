/**
 * Database schema for member directory profiles
 * Matches TypeSpec API definitions in specs/api/src/association/member/directory.tsp
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, varchar, uuid, timestamp, boolean, text, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const directoryVisibilityEnum = pgEnum('directory_visibility', [
  'public',
  'memberOnly',
  'hidden',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** A member's curated public-facing profile in the association directory */
export const directoryProfiles = pgTable('directory_profile', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  title: varchar('title', { length: 100 }),
  organization: varchar('organization', { length: 150 }),
  specialty: varchar('specialty', { length: 150 }),
  location: varchar('location', { length: 150 }),
  photoUrl: varchar('photo_url', { length: 2048 }),
  bio: text('bio'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  website: varchar('website', { length: 2048 }),
  socialLinks: jsonb('social_links').$type<Record<string, string>>(),
  visibility: directoryVisibilityEnum('visibility').default('hidden').notNull(),
  publishedAt: timestamp('published_at'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
}, (table) => ({
  orgPersonIdx: index('directory_profile_org_person_idx').on(table.organizationId, table.personId),
  orgVisibilityIdx: index('directory_profile_org_visibility_idx').on(table.organizationId, table.visibility),
}));

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type DirectoryProfile = typeof directoryProfiles.$inferSelect;
export type NewDirectoryProfile = typeof directoryProfiles.$inferInsert;
