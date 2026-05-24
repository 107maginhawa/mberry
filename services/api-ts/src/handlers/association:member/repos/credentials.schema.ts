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
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

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
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull(),
  licenseType: varchar('license_type', { length: 100 }).notNull(),
  licenseNumber: varchar('license_number', { length: 100 }).notNull(),
  issuingAuthority: varchar('issuing_authority', { length: 200 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 100 }).notNull(),
  issuedDate: date('issued_date').notNull(),
  expirationDate: date('expiration_date').notNull(),
  status: licenseStatusEnum('status').notNull(),
  documentRef: varchar('document_ref', { length: 500 }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: uuid('verified_by'),
}, (table) => [
  index('idx_license_org').on(table.organizationId),
  index('idx_license_person').on(table.personId),
  index('idx_license_status').on(table.status),
  index('idx_license_expiration').on(table.expirationDate),
]);

export const licenseRenewalAlerts = pgTable('license_renewal_alert', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  licenseId: uuid('license_id').notNull(),
  personId: uuid('person_id').notNull(),
  alertDate: date('alert_date').notNull(),
  daysUntilExpiry: integer('days_until_expiry').notNull(),
  status: renewalAlertStatusEnum('status').notNull(),
}, (table) => [
  index('idx_renewal_alert_org').on(table.organizationId),
  index('idx_renewal_alert_license').on(table.licenseId),
  index('idx_renewal_alert_person').on(table.personId),
  index('idx_renewal_alert_status').on(table.status),
]);

// ---------------------------------------------------------------------------
// Credential Template & Digital Credential enumerations
// ---------------------------------------------------------------------------

export const credentialTypeEnum = pgEnum('credential_type', [
  'memberCard',
  'certificate',
  'badge',
  'license',
]);

export const credentialTemplateStatusEnum = pgEnum('credential_template_status', [
  'active',
  'retired',
]);

export const credentialStatusEnum = pgEnum('credential_status', [
  'active',
  'suspended',
  'revoked',
  'expired',
]);

// ---------------------------------------------------------------------------
// Credential Templates
// ---------------------------------------------------------------------------

export const credentialTemplates = pgTable('credential_template', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: credentialTypeEnum('type').notNull(),
  design: varchar('design', { length: 50000 }),
  validityPeriod: integer('validity_period'), // days
  status: credentialTemplateStatusEnum('status').notNull().default('active'),
}, (table) => [
  index('idx_cred_template_org').on(table.organizationId),
  index('idx_cred_template_type').on(table.type),
  index('idx_cred_template_status').on(table.status),
]);

// ---------------------------------------------------------------------------
// Digital Credentials
// ---------------------------------------------------------------------------

export const digitalCredentials = pgTable('digital_credential', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull(),
  templateId: uuid('template_id').notNull(),
  membershipId: uuid('membership_id'),
  credentialNumber: varchar('credential_number', { length: 100 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: credentialStatusEnum('credential_dc_status').notNull().default('active'),
  qrPayload: varchar('qr_payload', { length: 4096 }),
  hmacKey: varchar('hmac_key', { length: 256 }),
  pdfUrl: varchar('pdf_url', { length: 2048 }),
  verificationUrl: varchar('verification_url', { length: 2048 }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revocationReason: varchar('revocation_reason', { length: 500 }),
}, (table) => [
  index('idx_dc_org').on(table.organizationId),
  index('idx_dc_person').on(table.personId),
  index('idx_dc_template').on(table.templateId),
  index('idx_dc_status').on(table.status),
  index('idx_dc_credential_number').on(table.credentialNumber),
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfessionalLicense = typeof professionalLicenses.$inferSelect;
export type NewProfessionalLicense = typeof professionalLicenses.$inferInsert;

export type LicenseRenewalAlert = typeof licenseRenewalAlerts.$inferSelect;
export type NewLicenseRenewalAlert = typeof licenseRenewalAlerts.$inferInsert;

export type CredentialTemplate = typeof credentialTemplates.$inferSelect;
export type NewCredentialTemplate = typeof credentialTemplates.$inferInsert;

export type DigitalCredential = typeof digitalCredentials.$inferSelect;
export type NewDigitalCredential = typeof digitalCredentials.$inferInsert;
