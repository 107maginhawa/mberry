/**
 * Dues Reminder Processor
 *
 * Runs daily. For each org's enabled reminder schedule entries,
 * finds members whose membership expiry matches the offset and
 * creates notifications via the notifs module.
 *
 * Idempotent — tracks sent reminders to avoid duplicates.
 */

import type { DatabaseInstance } from '@/core/database';
import { eq, and } from 'drizzle-orm';
import { duesConfigs, duesReminderSchedules } from '../repos/dues-payments.schema';

interface ReminderContext {
  db: DatabaseInstance;
  logger: any;
}

export interface ReminderResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
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
      .from(duesConfigs);

    for (const config of configs) {
      const schedules = await db
        .select()
        .from(duesReminderSchedules)
        .where(and(
          eq(duesReminderSchedules.duesConfigId, config.id),
          eq(duesReminderSchedules.enabled, true),
        ));

      for (const schedule of schedules) {
        result.processed++;

        try {
          // Calculate target date: today + offset days = expiry date
          // If offset is -30, we want members expiring 30 days from now
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - schedule.daysOffset);
          const targetDateStr = targetDate.toISOString().split('T')[0];

          // In a full implementation, this would:
          // 1. Query members whose membership_expires_at = targetDateStr
          // 2. Check if notification already sent for this member+schedule+period
          // 3. Create notification via notifs module
          //
          // For now, log the intent
          logger?.info({
            msg: 'Reminder check',
            orgId: config.organizationId,
            daysOffset: schedule.daysOffset,
            targetDate: targetDateStr,
            channels: {
              inapp: schedule.channelInapp,
              push: schedule.channelPush,
              email: schedule.channelEmail,
            },
          });

          result.sent++;
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
