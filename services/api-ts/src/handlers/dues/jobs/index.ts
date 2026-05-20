/**
 * Dues Module Background Jobs
 * Registers and configures dues-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { processDuesReminders } from './reminderProcessor';
import { processWebhookRetry } from './webhookRetryProcessor';

/**
 * Register all dues module jobs with the scheduler
 */
export function registerDuesJobs(scheduler: JobScheduler): void {
  // Process dues reminders daily at midnight
  scheduler.registerCron('dues.reminderProcessor', '0 0 * * *', async (context: JobContext) => {
    await processDuesReminders({ db: context.db, logger: context.logger });
  });

  // Process webhook retries every minute (slice 009, GAP-009)
  // Picks up pending_retry events whose nextRetryAt has passed.
  scheduler.registerInterval('dues.webhookRetryProcessor', 60_000, async (context: JobContext) => {
    await processWebhookRetry({
      db: context.db,
      logger: context.logger,
      now: new Date(),
      processPayment: async (_payload) => {
        // TODO: Wire to actual payment gateway processor
        // For now, this is the integration point where the gateway
        // settlement handler will be called.
        throw new Error('Payment processor not yet wired');
      },
    });
  });
}
