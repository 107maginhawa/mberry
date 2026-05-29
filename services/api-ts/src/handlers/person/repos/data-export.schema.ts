/**
 * Database schema for DataExport (M02 / WF-014 / M2-R4)
 *
 * Tracks DPA-portability export requests through their lifecycle:
 *   requested -> processing -> ready -> expired
 *   requested -> processing -> failed
 *
 * The aggregated personal data is stored in `payload` and served via the
 * download endpoint while the export is `ready` and not past `expiresAt`
 * (7-day TTL). Rate limited to 1 request per 24h per person (M2-R4).
 */

import { pgTable, uuid, timestamp, jsonb, text, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dataExportStatusEnum = pgEnum('data_export_status', [
  'requested',
  'processing',
  'ready',
  'failed',
  'expired',
]);

export const dataExports = pgTable('data_export', {
  ...baseEntityFields,

  personId: uuid('person_id').notNull(),
  status: dataExportStatusEnum('status').notNull().default('requested'),
  downloadUrl: text('download_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
}, (table) => ({
  personIdx: index('data_export_person_idx').on(table.personId, table.requestedAt),
}));

export type DataExport = typeof dataExports.$inferSelect;
export type NewDataExport = typeof dataExports.$inferInsert;
