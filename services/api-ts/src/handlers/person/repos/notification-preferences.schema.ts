/**
 * Database schema for notification preferences.
 *
 * Per-person, per-category push/email toggles.
 * In-app notifications are always on (M02-R8) — not stored.
 * High-priority items always push regardless of preference.
 */

import { pgTable, uuid, boolean, varchar, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const notificationPreferences = pgTable(
  'notification_preference',
  {
    ...baseEntityFields,
    personId: uuid('person_id').notNull(),
    organizationId: uuid('organization_id').notNull(), // Multi-tenant scoping (P0-7)
    category: varchar('category', { length: 50 }).notNull(), // dues, events, trainings, announcements, credits
    pushEnabled: boolean('push_enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(false),
  },
  (table) => ({
    personCategoryOrgIdx: uniqueIndex('notif_pref_person_cat_org_idx').on(table.personId, table.category, table.organizationId),
    personIdx: index('notif_pref_person_idx').on(table.personId),
    orgIdx: index('notif_pref_org_idx').on(table.organizationId),
  }),
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;

/** Valid notification categories */
export const NOTIFICATION_CATEGORIES = ['dues', 'events', 'trainings', 'announcements', 'credits'] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];
