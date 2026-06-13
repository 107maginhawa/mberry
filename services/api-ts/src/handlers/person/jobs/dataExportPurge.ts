/**
 * Data-Export Payload Purge (FIX-009 / §13 / DPA data-minimization)
 *
 * Runs daily. Finds data-export rows whose 7-day download link (`expiresAt`)
 * has elapsed and still carry a `payload` (the full-PII JSONB snapshot), and
 * nulls the payload + download link, flipping `status` to 'expired'.
 *
 * DPA 2012 minimization: a personal-data snapshot must not be retained past
 * the window it was needed for. Fresh (not-yet-expired) exports are untouched.
 *
 * Per-record evaluation mirrors `deletionProcessor` — the expiry comparison is
 * done in JS per candidate so the job's retention logic is unit-provable.
 */

import type { DatabaseInstance } from '@/core/database';
import { and, isNotNull, eq } from 'drizzle-orm';
import { dataExports } from '../repos/data-export.schema';

interface PurgeContext {
  db: DatabaseInstance;
  logger: any;
}

export interface PurgeResult {
  purged: number;
}

/**
 * Purge expired data-export payloads.
 * Called by the job scheduler (daily).
 */
export async function processExpiredDataExports(ctx: PurgeContext): Promise<PurgeResult> {
  const { db, logger } = ctx;

  // Candidate rows: still hold a payload AND have a TTL set.
  const candidates = await db
    .select({ id: dataExports.id, expiresAt: dataExports.expiresAt })
    .from(dataExports)
    .where(and(isNotNull(dataExports.payload), isNotNull(dataExports.expiresAt)));

  const now = new Date();
  const expired = candidates.filter(
    (row: { id: string; expiresAt: Date | null }) => row.expiresAt != null && new Date(row.expiresAt) < now,
  );

  for (const row of expired) {
    try {
      await db
        .update(dataExports)
        .set({ payload: null, downloadUrl: null, status: 'expired' })
        .where(eq(dataExports.id, row.id));
    } catch (err) {
      logger?.error({ error: err, exportId: row.id }, 'Failed to purge expired data-export payload');
    }
  }

  if (expired.length > 0) {
    logger?.info({ purged: expired.length }, 'Purged expired data-export payloads (DPA minimization)');
  }

  return { purged: expired.length };
}
