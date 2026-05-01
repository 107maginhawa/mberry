/**
 * Database schema for person privacy settings.
 *
 * Controls which profile fields are visible in the member directory.
 * One row per person per org — privacy can differ across organizations.
 *
 * Defaults per M02-C2.3: email hidden, phone hidden, photo visible, address hidden.
 */

import { pgTable, uuid, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const personPrivacySettings = pgTable(
  'person_privacy_setting',
  {
    ...baseEntityFields,
    personId: uuid('person_id').notNull(),
    orgId: uuid('org_id').notNull(),
    emailVisible: boolean('email_visible').notNull().default(false),
    phoneVisible: boolean('phone_visible').notNull().default(false),
    photoVisible: boolean('photo_visible').notNull().default(true),
    addressVisible: boolean('address_visible').notNull().default(false),
  },
  (table) => ({
    personOrgIdx: uniqueIndex('privacy_person_org_idx').on(table.personId, table.orgId),
    personIdx: index('privacy_person_idx').on(table.personId),
  }),
);

export type PersonPrivacySetting = typeof personPrivacySettings.$inferSelect;
export type NewPersonPrivacySetting = typeof personPrivacySettings.$inferInsert;
