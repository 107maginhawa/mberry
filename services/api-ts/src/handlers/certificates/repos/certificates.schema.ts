import {
  pgTable, uuid, varchar, timestamp, index, unique,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

export const certificates = pgTable('certificate', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  trainingId: uuid('training_id').notNull(),
  certificateNumber: varchar('certificate_number', { length: 50 }).notNull(),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('certificate_org_idx').on(table.organizationId),
  personIdx: index('certificate_person_idx').on(table.personId),
  trainingIdx: index('certificate_training_idx').on(table.trainingId),
  certNumUnique: unique('certificate_cert_num_unique').on(table.certificateNumber),
  trainingPersonUnique: unique('certificate_training_person_unique').on(table.trainingId, table.personId),
}));

// Type exports
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
