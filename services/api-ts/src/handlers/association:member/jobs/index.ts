/**
 * Dues Module Background Jobs
 * Registers and configures dues-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { BillingService } from '@/core/billing';
import { processDuesReminders } from '@/handlers/member/duesspecialassessments/jobs/reminderProcessor';
import { processWebhookRetry } from '@/handlers/member/duesspecialassessments/jobs/webhookRetryProcessor';
import { processCreditIssue } from './creditIssue';
import { processComplianceThreshold } from './complianceThreshold';
import { createProcessPayment } from '@/handlers/member/duesspecialassessments/jobs/processStripePayment';

/**
 * Register all dues module jobs with the scheduler
 */
export function registerDuesJobs(scheduler: JobScheduler, billing: BillingService): void {
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
      processPayment: createProcessPayment(billing, context.db, context.logger),
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
    const { generateCertificates } = await import('@/handlers/member/certificates/bulkIssueCertificates');
    const data = context.data as Parameters<typeof generateCertificates>[1];
    await generateCertificates(context.db, data, (context.data as Record<string, unknown>)['requestedBy'] as string);
    context.logger.info({ count: data.personIds?.length, orgId: data.organizationId }, 'certificate.bulk_generate: done');
  });
}
