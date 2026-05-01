/**
 * Database schema for documents module (M11).
 * Tables: document, document_version, document_tag, document_access_log.
 * Matches documents.tsp models.
 */

import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  uuid,
  pgEnum,
  index,
  jsonb,
  bigint,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const documentStatusEnum = pgEnum('document_status', [
  'draft',
  'published',
  'archived',
]);

export const documents = pgTable('document', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  fileName: varchar('file_name', { length: 300 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: bigint('size', { mode: 'number' }).notNull().default(0),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  ownerId: uuid('owner_id').notNull(),
  ownerType: varchar('owner_type', { length: 100 }).notNull(),
  accessLevel: varchar('access_level', { length: 50 }).notNull().default('tenantOnly'),
  category: varchar('category', { length: 100 }),
  status: documentStatusEnum('document_status').notNull().default('draft'),
  currentVersionId: uuid('current_version_id'),
  tags: jsonb('tags').$type<string[]>().default([]),
}, (table) => [
  index('idx_doc_tenant').on(table.tenantId),
  index('idx_doc_owner').on(table.ownerId),
  index('idx_doc_status').on(table.status),
]);

export const documentVersions = pgTable('document_version', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  documentId: uuid('document_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  fileName: varchar('file_name', { length: 300 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  uploadedBy: uuid('uploaded_by').notNull(),
  changeNote: text('change_note'),
}, (table) => [
  index('idx_docver_document').on(table.documentId),
]);

export const documentTags = pgTable('document_tag', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }),
}, (table) => [
  index('idx_doctag_tenant').on(table.tenantId),
]);

export const documentAccessLogs = pgTable('document_access_log', {
  ...baseEntityFields,
  documentId: uuid('document_id').notNull(),
  personId: uuid('person_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'view', 'download', 'edit'
  accessedAt: timestamp('accessed_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
}, (table) => [
  index('idx_docaccess_document').on(table.documentId),
  index('idx_docaccess_person').on(table.personId),
]);

// Types
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type DocumentTag = typeof documentTags.$inferSelect;
export type NewDocumentTag = typeof documentTags.$inferInsert;
export type DocumentAccessLog = typeof documentAccessLogs.$inferSelect;
export type NewDocumentAccessLog = typeof documentAccessLogs.$inferInsert;
