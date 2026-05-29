/**
 * Database schema for PRC-accredited training providers.
 * Table: accredited_provider
 */

import { pgTable, varchar, uuid, pgEnum, index, timestamp } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const providerStatusEnum = pgEnum('accredited_provider_status', ['active', 'suspended', 'expired']);

export const accreditedProviders = pgTable('accredited_provider', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  accreditationNumber: varchar('accreditation_number', { length: 100 }).notNull(),
  status: providerStatusEnum('status').notNull().default('active'),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
}, (table) => [
  index('idx_accredited_provider_org').on(table.organizationId),
  index('idx_accredited_provider_status').on(table.status),
]);

export type AccreditedProvider = typeof accreditedProviders.$inferSelect;
export type NewAccreditedProvider = typeof accreditedProviders.$inferInsert;
