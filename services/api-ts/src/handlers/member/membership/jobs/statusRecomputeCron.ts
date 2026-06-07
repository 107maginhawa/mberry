/**
 * BR-01 Safety Net — Membership Status Recompute Cron
 *
 * Runs daily at 03:00 UTC. Queries all non-terminal memberships and
 * recomputes their status from source fields. If the stored status
 * diverges from the computed status, the row is updated and a warning
 * is logged. This is a defensive safety net, not the primary computation
 * path (status is computed at query time per BR-01).
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { notInArray, sql } from 'drizzle-orm';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import {
  computeMembershipStatus,
  type ComputedMembershipStatus,
  type MembershipStatusInput,
} from '../utils/compute-membership-status';

/** Terminal statuses that must never be overwritten by automation */
const TERMINAL_STATUSES = ['deceased', 'expelled', 'resigned', 'removed'] as const;

const BATCH_SIZE = 100;

/**
 * Register the daily membership status recompute cron job.
 *
 * @param scheduler - Job scheduler instance
 * @param db        - Drizzle database instance (passed via JobContext)
 * @param logger    - Pino logger (passed via JobContext)
 *
 * The function only registers the job; actual execution uses the
 * db/logger from JobContext at runtime so the signature mirrors the
 * pattern used by other jobs in this module.
 */
export function registerStatusRecomputeJob(
  scheduler: JobScheduler,
  // db and logger come from JobContext at runtime — kept in signature
  // to make wiring explicit at the call site in app.ts
  _db?: unknown,
  _logger?: unknown,
): void {
  scheduler.registerCron(
    'membership.statusRecompute',
    '0 3 * * *',
    async (context: JobContext) => {
      const { db, logger, jobId } = context;

      logger.info({ jobId }, 'Membership status recompute job starting');

      let offset = 0;
      let totalProcessed = 0;
      let totalDiscrepancies = 0;

      try {
        while (true) {
          // Fetch one batch of non-terminal memberships with FOR UPDATE SKIP LOCKED
          // to handle concurrent scheduler instances safely.
          const batch = await db.execute(sql`
            SELECT
              id,
              status,
              dues_expiry_date  AS "duesExpiryDate",
              grace_period_days AS "gracePeriodDays",
              suspended_at      AS "suspendedAt",
              removed_at        AS "removedAt",
              date_of_death     AS "dateOfDeath",
              is_expired        AS "isExpired",
              is_pending_payment AS "isPendingPayment"
            FROM membership
            WHERE status NOT IN (${sql.join(
              TERMINAL_STATUSES.map((s) => sql`${s}`),
              sql`, `,
            )})
            ORDER BY id
            LIMIT ${BATCH_SIZE}
            OFFSET ${offset}
            FOR UPDATE SKIP LOCKED
          `);

          // Drizzle execute() returns { rows: unknown[] }
          const rows = (batch as unknown as { rows: Record<string, unknown>[] }).rows;

          if (!rows || rows.length === 0) {
            break;
          }

          for (const row of rows) {
            const membershipId = row['id'] as string;
            const storedStatus = row['status'] as ComputedMembershipStatus;

            const input: MembershipStatusInput = {
              duesExpiryDate: (row['duesExpiryDate'] as string | null) ?? null,
              gracePeriodDays: (row['gracePeriodDays'] as number) ?? 30,
              suspendedAt: row['suspendedAt'] ? new Date(row['suspendedAt'] as string) : null,
              removedAt: row['removedAt'] ? new Date(row['removedAt'] as string) : null,
              dateOfDeath: (row['dateOfDeath'] as string | null) ?? null,
              isExpired: Boolean(row['isExpired']),
              isPendingPayment: Boolean(row['isPendingPayment']),
              // expelledAt / resignedAt are not stored as timestamps in this schema;
              // those terminal states are excluded from the query above.
            };

            const computedStatus = computeMembershipStatus(input);

            if (storedStatus !== computedStatus) {
              // Update the diverged row
              await db
                .update(memberships)
                .set({ status: computedStatus })
                .where(sql`id = ${membershipId}`);

              logger.warn(
                {
                  jobId,
                  membershipId,
                  oldStatus: storedStatus,
                  newStatus: computedStatus,
                },
                'Membership status discrepancy corrected',
              );

              totalDiscrepancies++;
            }
          }

          totalProcessed += rows.length;

          if (rows.length < BATCH_SIZE) {
            // Last batch — no more rows to process
            break;
          }

          offset += BATCH_SIZE;
        }

        logger.info(
          { jobId, totalProcessed, totalDiscrepancies },
          `Recomputed ${totalProcessed} memberships, ${totalDiscrepancies} discrepancies found`,
        );
      } catch (error) {
        logger.error({ error, jobId, totalProcessed, totalDiscrepancies }, 'Membership status recompute job failed');
        throw error;
      }
    },
  );
}
