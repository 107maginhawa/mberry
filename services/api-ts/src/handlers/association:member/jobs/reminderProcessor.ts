/**
 * Dues Reminder Processor
 *
 * Runs daily. For each org's enabled reminder schedule entries,
 * finds members whose membership expiry matches the offset and
 * creates notifications via the notifs module.
 *
 * Idempotent — tracks sent reminders in duesReminderLogs to avoid duplicates.
 */

import type { DatabaseInstance } from '@/core/database';
import { eq, and, sql } from 'drizzle-orm';
import { duesOrgConfigs, duesReminderSchedules } from '../repos/dues-payments.schema';
import { duesReminderLogs } from '../repos/dues.schema';
import { memberships } from '../repos/membership.schema';
import { inArray } from 'drizzle-orm';

interface ReminderContext {
  db: DatabaseInstance;
  logger: any;
  /** Optional notification creator — when provided, creates real notifications */
  createNotification?: (params: {
    organizationId: string;
    recipient: string;
    type: 'billing';
    channel: 'in-app' | 'email' | 'push';
    title: string;
    message: string;
  }) => Promise<{ id: string }>;
  /** Optional suppression check — returns true if member should be skipped */
  checkSuppression?: (personId: string, organizationId: string) => Promise<boolean>;
}

export interface ReminderResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}

/**
 * Derive the period key from a target date.
 * Uses the year as the period key (e.g., "2026").
 */
function derivePeriodKey(targetDate: Date): string {
  return targetDate.getFullYear().toString();
}

/**
 * Process all dues reminders for all orgs.
 * Called by the job scheduler (daily at midnight).
 */
export async function processDuesReminders(ctx: ReminderContext): Promise<ReminderResult> {
  const { db, logger } = ctx;
  const result: ReminderResult = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    // Get all configs with their reminder schedules
    const configs = await db
      .select()
      .from(duesOrgConfigs);

    for (const config of configs) {
      let schedules: any[];
      try {
        schedules = await db
          .select()
          .from(duesReminderSchedules)
          .where(and(
            eq(duesReminderSchedules.duesConfigId, config.id),
            eq(duesReminderSchedules.enabled, true),
          ));
      } catch (schedErr) {
        result.errors++;
        logger?.error({ msg: 'Failed to fetch schedules for config', err: schedErr, configId: config.id });
        continue;
      }

      for (const schedule of schedules) {
        result.processed++;

        try {
          // Calculate target date: today - offset days = expiry date
          // If offset is -30, we want members expiring 30 days from now
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - schedule.daysOffset);
          const targetDateStr = targetDate.toISOString().split('T')[0];
          const periodKey = derivePeriodKey(targetDate);

          // 1. Find members whose membership expires on targetDate
          const expiringMembers = await db
            .select({
              id: memberships.id,
              personId: memberships.personId,
              organizationId: memberships.organizationId,
              duesExpiryDate: memberships.duesExpiryDate,
            })
            .from(memberships)
            .where(
              and(
                eq(memberships.organizationId, config.organizationId),
                sql`${memberships.duesExpiryDate}::date = ${targetDateStr}::date`,
                inArray(memberships.status, ['active', 'gracePeriod']),
              ),
            );

          if (expiringMembers.length === 0) {
            logger?.debug({
              msg: 'No members expiring on target date',
              orgId: config.organizationId,
              targetDate: targetDateStr,
            });
            continue;
          }

          // Determine which channels to send on
          const channels: ('in-app' | 'email' | 'push')[] = [];
          if (schedule.channelInapp) channels.push('in-app');
          if (schedule.channelEmail) channels.push('email');
          if (schedule.channelPush) channels.push('push');

          // Batch-fetch all existing reminder logs for this schedule+period (fixes N+1)
          const memberPersonIds = expiringMembers.map(m => m.personId);
          const existingLogs = await db
            .select({
              personId: duesReminderLogs.personId,
              channel: duesReminderLogs.channel,
            })
            .from(duesReminderLogs)
            .where(
              and(
                inArray(duesReminderLogs.personId, memberPersonIds),
                eq(duesReminderLogs.scheduleId, schedule.id),
                eq(duesReminderLogs.periodKey, periodKey),
                eq(duesReminderLogs.daysOffset, schedule.daysOffset),
              ),
            );

          // Build a set of "personId:channel" keys for O(1) lookup
          const sentSet = new Set(existingLogs.map(l => `${l.personId}:${l.channel}`));

          for (const member of expiringMembers) {
            // 1b. Check suppression — skip suppressed members entirely
            if (ctx.checkSuppression) {
              try {
                const isSuppressed = await ctx.checkSuppression(member.personId, config.organizationId);
                if (isSuppressed) {
                  result.skipped++;
                  logger?.debug({
                    msg: 'Member suppressed, skipping all channels',
                    personId: member.personId,
                    orgId: config.organizationId,
                  });
                  continue;
                }
              } catch (suppressErr) {
                logger?.warn({
                  msg: 'Suppression check failed, proceeding with reminder',
                  err: suppressErr,
                  personId: member.personId,
                });
              }
            }

            for (const channel of channels) {
              try {
                // 2. Check idempotency — O(1) Set lookup instead of per-member query
                if (sentSet.has(`${member.personId}:${channel}`)) {
                  result.skipped++;
                  logger?.debug({
                    msg: 'Reminder already sent, skipping',
                    personId: member.personId,
                    scheduleId: schedule.id,
                    periodKey,
                    channel,
                  });
                  continue;
                }

                // 3. Create notification
                let notificationId: string | null = null;
                if (ctx.createNotification) {
                  const notification = await ctx.createNotification({
                    organizationId: config.organizationId,
                    recipient: member.personId,
                    type: 'billing',
                    channel,
                    title: `Dues Reminder: ${schedule.daysOffset < 0 ? Math.abs(schedule.daysOffset) + ' days until expiry' : schedule.daysOffset === 0 ? 'Dues expire today' : schedule.daysOffset + ' days past expiry'}`,
                    message: `Your membership dues are ${schedule.daysOffset < 0 ? 'due in ' + Math.abs(schedule.daysOffset) + ' days' : schedule.daysOffset === 0 ? 'due today' : 'overdue by ' + schedule.daysOffset + ' days'}. Please renew to maintain your membership.`,
                  });
                  notificationId = notification.id;
                }

                // 4. Insert reminder log for idempotency
                await db
                  .insert(duesReminderLogs)
                  .values({
                    organizationId: config.organizationId,
                    personId: member.personId,
                    scheduleId: schedule.id,
                    duesConfigId: config.id,
                    periodKey,
                    daysOffset: schedule.daysOffset,
                    channel,
                    notificationId,
                  });

                result.sent++;

                logger?.info({
                  msg: 'Reminder sent',
                  personId: member.personId,
                  orgId: config.organizationId,
                  channel,
                  daysOffset: schedule.daysOffset,
                  periodKey,
                });
              } catch (memberErr) {
                result.errors++;
                logger?.error({
                  msg: 'Failed to process reminder for member',
                  err: memberErr,
                  personId: member.personId,
                  scheduleId: schedule.id,
                  channel,
                });
              }
            }
          }
        } catch (err) {
          result.errors++;
          logger?.error({ msg: 'Reminder processing error', err, scheduleId: schedule.id });
        }
      }
    }
  } catch (err) {
    logger?.error({ msg: 'Reminder processor failed', err });
    throw err;
  }

  return result;
}
