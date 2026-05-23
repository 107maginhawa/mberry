/**
 * Survey Module Background Jobs
 * Registers and configures survey-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import type { DatabaseInstance } from '@/core/database';
import { SurveyResponseRepository } from '../repos/survey.repo';

/**
 * Register all survey module jobs with the scheduler
 */
export function registerSurveyJobs(
  scheduler: JobScheduler,
  notifs: NotificationService
): void {
  // Expire pending responses older than 48 hours — runs daily at 4 AM
  scheduler.registerCron('survey.expirePending', '0 4 * * *', async (context: JobContext) => {
    const db = context.db as DatabaseInstance | undefined;
    if (!db) {
      return;
    }

    const responseRepo = new SurveyResponseRepository(db);
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const skippedCount = await responseRepo.markPendingAsSkippedBefore(cutoff);

    if (skippedCount > 0) {
      context.logger?.info(
        { skippedCount, cutoff: cutoff.toISOString() },
        'Expired pending survey responses'
      );
    }
  });
}
