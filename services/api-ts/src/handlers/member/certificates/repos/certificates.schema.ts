import {
  pgTable, uuid, varchar, timestamp, integer, index, unique, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { cpdActivityTypeEnum } from '@/handlers/association:operations/repos/events.schema';

export const certificateStatusEnum = pgEnum('certificate_status', ['issued', 'revoked']);

export const certificates = pgTable('certificate', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),
  // Q8 Option A (AHA Step 38): nullable + lazy-link. A real trainingId links the
  // cert to its training activity; NULL = historical/unlinked (pre-launch bogus
  // rows NULLed by migration 0069). Uniqueness is enforced only WHERE NOT NULL.
  trainingId: uuid('training_id'),
  certificateNumber: varchar('certificate_number', { length: 50 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  templateId: varchar('template_id', { length: 100 }),
  signingOfficerId: uuid('signing_officer_id'),
  creditHours: integer('credit_hours'),
  // FIX-005: certificate kind persisted at issuance so the PDF resolves it
  // server-side instead of trusting a client body override (forgery surface).
  certificateType: varchar('certificate_type', { length: 20 }),
  cpdActivityType: cpdActivityTypeEnum('cpd_activity_type'),
  status: certificateStatusEnum('status').default('issued'),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: varchar('revoked_reason', { length: 500 }),
}, (table) => ({
  orgIdx: index('certificate_org_idx').on(table.organizationId),
  personIdx: index('certificate_person_idx').on(table.personId),
  trainingIdx: index('certificate_training_idx').on(table.trainingId),
  certNumUnique: unique('certificate_cert_num_unique').on(table.certificateNumber),
  // Q8 Option A: partial unique — one cert per (training, person) only among
  // linked rows. NULL trainingId rows (historical/unlinked) are excluded, so a
  // member may hold many unlinked certs while real-training dupes still reject.
  trainingPersonUnique: uniqueIndex('certificate_training_person_unique')
    .on(table.trainingId, table.personId)
    .where(sql`${table.trainingId} IS NOT NULL`),
  statusIdx: index('certificate_status_idx').on(table.status),
}));

export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;

export const orgCertificateSeq = pgTable('org_certificate_seq', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  year: integer('year').notNull(),
  lastSeq: integer('last_seq').notNull().default(0),
  orgCode: varchar('org_code', { length: 20 }).notNull(),
}, (table) => ({
  orgYearUnique: unique('org_cert_seq_org_year_unique').on(table.organizationId, table.year),
}));

export type OrgCertificateSeq = typeof orgCertificateSeq.$inferSelect;
