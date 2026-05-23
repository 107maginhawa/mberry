import {
  pgTable, uuid, varchar, timestamp, integer, index, unique, pgEnum,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { cpdActivityTypeEnum } from '../../association:operations/repos/events.schema';

export const certificateStatusEnum = pgEnum('certificate_status', ['issued', 'revoked']);

export const certificates = pgTable('certificate', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),
  trainingId: uuid('training_id').notNull(),
  certificateNumber: varchar('certificate_number', { length: 50 }).notNull(),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  templateId: varchar('template_id', { length: 100 }),
  signingOfficerId: uuid('signing_officer_id'),
  creditHours: integer('credit_hours'),
  cpdActivityType: cpdActivityTypeEnum('cpd_activity_type'),
  status: certificateStatusEnum('status').default('issued'),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  revokedAt: timestamp('revoked_at'),
  revokedReason: varchar('revoked_reason', { length: 500 }),
}, (table) => ({
  orgIdx: index('certificate_org_idx').on(table.organizationId),
  personIdx: index('certificate_person_idx').on(table.personId),
  trainingIdx: index('certificate_training_idx').on(table.trainingId),
  certNumUnique: unique('certificate_cert_num_unique').on(table.certificateNumber),
  trainingPersonUnique: unique('certificate_training_person_unique').on(table.trainingId, table.personId),
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
