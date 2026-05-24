/**
 * Dues Module Background Jobs
 * Registers and configures dues-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { DeferredScopeError } from '@/core/errors';
import { processDuesReminders } from './reminderProcessor';
import { processWebhookRetry } from './webhookRetryProcessor';
import { generateAutoInvoices } from './autoInvoiceGenerator';

/**
 * Register all dues module jobs with the scheduler
 */
export function registerDuesJobs(scheduler: JobScheduler): void {
  // Process dues reminders daily at midnight
  scheduler.registerCron('dues.reminderProcessor', '0 0 * * *', async (context: JobContext) => {
    await processDuesReminders({ db: context.db, logger: context.logger });
  });

  // Auto-generate invoices daily at 1 AM UTC on billing cycle dates
  scheduler.registerCron('dues.autoInvoiceGenerator', '0 1 * * *', async (context: JobContext) => {
    await generateAutoInvoices({ db: context.db, logger: context.logger });
  });

  // Process webhook retries every minute (slice 009, GAP-009)
  // Picks up pending_retry events whose nextRetryAt has passed.
  scheduler.registerInterval('dues.webhookRetryProcessor', 60_000, async (context: JobContext) => {
    await processWebhookRetry({
      db: context.db,
      logger: context.logger,
      now: new Date(),
      processPayment: async (_payload) => {
        // Deferred: wire to payment gateway processor — dues v2 integration. Tracked: GAP-BACKLOG.md
        // Integration point where gateway settlement handler will be called.
        throw new DeferredScopeError('Payment processor');
      },
    });
  });
}
