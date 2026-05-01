/**
 * Database schema for credentials module — professional licenses and renewal alerts.
 * Matches TypeSpec credentials.tsp ProfessionalLicense and LicenseRenewalAlert models.
 */

import {
  pgTable,
  varchar,
  integer,
  timestamp,
  date,
  uuid,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const licenseStatusEnum = pgEnum('license_status', [
  'active',
  'expired',
  'suspended',
  'revoked',
  'pending',
]);

export const renewalAlertStatusEnum = pgEnum('renewal_alert_status', [
  'pending',
  'sent',
  'acknowledged',
  'dismissed',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const professionalLicenses = pgTable('professional_license', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  licenseType: varchar('license_type', { length: 100 }).notNull(),
  licenseNumber: varchar('license_number', { length: 100 }).notNull(),
  issuingAuthority: varchar('issuing_authority', { length: 200 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 100 }).notNull(),
  issuedDate: date('issued_date').notNull(),
  expirationDate: date('expiration_date').notNull(),
  status: licenseStatusEnum('status').notNull(),
  documentRef: varchar('document_ref', { length: 500 }),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: uuid('verified_by'),
}, (table) => [
  index('idx_license_tenant').on(table.tenantId),
  index('idx_license_person').on(table.personId),
  index('idx_license_status').on(table.status),
  index('idx_license_expiration').on(table.expirationDate),
]);

export const licenseRenewalAlerts = pgTable('license_renewal_alert', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  licenseId: uuid('license_id').notNull(),
  personId: uuid('person_id').notNull(),
  alertDate: date('alert_date').notNull(),
  daysUntilExpiry: integer('days_until_expiry').notNull(),
  status: renewalAlertStatusEnum('status').notNull(),
}, (table) => [
  index('idx_renewal_alert_tenant').on(table.tenantId),
  index('idx_renewal_alert_license').on(table.licenseId),
  index('idx_renewal_alert_person').on(table.personId),
  index('idx_renewal_alert_status').on(table.status),
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfessionalLicense = typeof professionalLicenses.$inferSelect;
export type NewProfessionalLicense = typeof professionalLicenses.$inferInsert;

export type LicenseRenewalAlert = typeof licenseRenewalAlerts.$inferSelect;
export type NewLicenseRenewalAlert = typeof licenseRenewalAlerts.$inferInsert;
