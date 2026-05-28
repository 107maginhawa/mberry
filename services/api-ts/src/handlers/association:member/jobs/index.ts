/**
 * Dues Module Background Jobs
 * Registers and configures dues-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { DeferredScopeError } from '@/core/errors';
import { processDuesReminders } from './reminderProcessor';
import { processWebhookRetry } from './webhookRetryProcessor';
import { processCreditIssue } from './creditIssue';
import { processComplianceThreshold } from './complianceThreshold';
import { registerStatusRecomputeJob } from './statusRecomputeCron';

export { registerStatusRecomputeJob };

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
        // Deferred: wire to payment gateway processor — dues v2 integration. Tracked: GAP-BACKLOG.md
        // Integration point where gateway settlement handler will be called.
        throw new DeferredScopeError('Payment processor');
      },
    });
  });

  // --- Wave 2b: Credit Pipeline ---
  scheduler.registerDelayed('attendance.confirmed', 0, async (context: JobContext) => {
    const data = context.data as Record<string, unknown>;
    await scheduler.trigger('credit.issue', {
      sourceType: 'event_checkin', sourceId: data['checkinId'], personId: data['personId'],
      organizationId: data['organizationId'], creditAmount: data['creditAmount'],
      cpdActivityType: data['cpdActivityType'], attestation: data['attestation'],
    });
  });

  scheduler.registerDelayed('credit.issue', 0, async (context: JobContext) => {
    const result = await processCreditIssue(context);
    if (result?.thresholdMet) {
      await scheduler.trigger('compliance.threshold_met', { personId: result.personId, organizationId: result.organizationId, totalCredits: result.totalCredits, requiredCredits: result.requiredCredits });
    }
  });

  scheduler.registerDelayed('compliance.threshold_met', 0, async (context: JobContext) => {
    await processComplianceThreshold(context);
  });

  scheduler.registerDelayed('certificate.bulk_generate', 0, async (context: JobContext) => {
    const { generateCertificates } = await import('../../certificates/bulkIssueCertificates');
    const data = context.data as Parameters<typeof generateCertificates>[1];
    await generateCertificates(context.db, data, (context.data as Record<string, unknown>)['requestedBy'] as string);
    context.logger.info({ count: data.personIds?.length, orgId: data.organizationId }, 'certificate.bulk_generate: done');
  });
}
