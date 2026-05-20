/**
 * Grace-to-Lapsed Membership Transition Processor (GAP-015, BR-02)
 *
 * Runs as a daily cron job. Queries memberships in gracePeriod status where
 * dues_expiry_date + grace_period_days < now(). Batch updates to lapsed.
 * Logs each transition to membership_status_history.
 * Sends notifications when a createNotification callback is provided.
 *
 * Idempotent: only selects memberships still in gracePeriod status.
 * Re-runs safely skip already-transitioned members.
 */

import type { DatabaseInstance } from '@/core/database';
import { eq, and, sql } from 'drizzle-orm';
import { memberships } from '../../association:member/repos/membership.schema';
import { membershipStatusHistory } from '../../association:member/repos/status-history.schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraceToLapsedContext {
  db: DatabaseInstance;
  logger: any;
  /** Optional notification creator — creates real notifications when provided */
  createNotification?: (params: {
    organizationId: string;
    recipient: string;
    type: 'billing';
    channel: 'in-app';
    title: string;
    message: string;
  }) => Promise<{ id: string }>;
}

export interface GraceToLapsedResult {
  transitioned: number;
  skipped: number;
  errors: number;
  notified: number;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Process all grace-period memberships whose grace window has expired.
 * Called by the job scheduler (daily cron).
 *
 * The WHERE clause ensures idempotency:
 *   status = 'gracePeriod' AND (dues_expiry_date + grace_period_days) < now()
 *
 * Members already transitioned to 'lapsed' are never re-selected.
 */
export async function processGraceToLapsed(
  ctx: GraceToLapsedContext,
): Promise<GraceToLapsedResult> {
  const { db, logger } = ctx;
  const result: GraceToLapsedResult = {
    transitioned: 0,
    skipped: 0,
    errors: 0,
    notified: 0,
  };

  try {
    // Query memberships in gracePeriod whose grace window has expired.
    // BR-02: grace_period_days is per-membership (0-90, default 30).
    // The date arithmetic is done in SQL for correctness across timezones.
    const expiredMembers = await db
      .select({
        id: memberships.id,
        personId: memberships.personId,
        organizationId: memberships.organizationId,
        status: memberships.status,
        duesExpiryDate: memberships.duesExpiryDate,
        gracePeriodDays: memberships.gracePeriodDays,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.status, 'gracePeriod'),
          sql`(${memberships.duesExpiryDate}::date + ${memberships.gracePeriodDays} * INTERVAL '1 day') < NOW()`,
        ),
      );

    if (expiredMembers.length === 0) {
      logger?.debug({ msg: 'No expired grace-period memberships found' });
      return result;
    }

    logger?.info({
      msg: 'Found expired grace-period memberships',
      count: expiredMembers.length,
    });

    // Process each member individually for error isolation
    for (const member of expiredMembers) {
      try {
        // 1. Update membership status to lapsed
        await db
          .update(memberships)
          .set({
            status: 'lapsed',
            updatedAt: new Date(),
          })
          .where(eq(memberships.id, member.id));

        // 2. Record status change in history (system-initiated, no changedBy)
        await db
          .insert(membershipStatusHistory)
          .values({
            organizationId: member.organizationId,
            membershipId: member.id,
            personId: member.personId,
            fromStatus: 'gracePeriod',
            toStatus: 'lapsed',
            reason: 'grace_period_expired',
            changedAt: new Date(),
          });

        result.transitioned++;

        // 3. Send notification (best-effort, does not block transition)
        if (ctx.createNotification) {
          try {
            await ctx.createNotification({
              organizationId: member.organizationId,
              recipient: member.personId,
              type: 'billing',
              channel: 'in-app',
              title: 'Membership lapsed',
              message:
                'Your membership has lapsed due to expired grace period. Please renew your dues to restore your membership.',
            });
            result.notified++;
          } catch (notifErr) {
            logger?.warn({
              msg: 'Failed to send lapse notification',
              err: notifErr,
              personId: member.personId,
              membershipId: member.id,
            });
            // Notification failure is not a processing error
          }
        }

        logger?.info({
          msg: 'Transitioned membership to lapsed',
          membershipId: member.id,
          personId: member.personId,
          organizationId: member.organizationId,
        });
      } catch (memberErr) {
        result.errors++;
        logger?.error({
          msg: 'Failed to transition membership',
          err: memberErr,
          membershipId: member.id,
          personId: member.personId,
        });
      }
    }
  } catch (err) {
    logger?.error({ msg: 'Grace-to-lapsed processor failed', err });
    throw err;
  }

  logger?.info({
    msg: 'Grace-to-lapsed processing complete',
    ...result,
  });

  return result;
}
