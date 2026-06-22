/**
 * Jobs module (M15) background jobs — BR-37 Job Posting Expiry.
 *
 * Single entry point for app.ts. Registers two daily crons:
 *   - jobs.expirePostings   (01:00 UTC) — flip overdue active postings to expired
 *   - jobs.expiryReminders  (09:00 UTC) — notify posters 3 days before expiry
 */
import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import { processJobPostingExpiry, processJobPostingExpiryReminders } from './jobPostingExpiry';

export function registerJobPostingJobs(
  scheduler: JobScheduler,
  notifs?: NotificationService,
): void {
  scheduler.registerCron('jobs.expirePostings', '0 1 * * *', async (context: JobContext) => {
    await processJobPostingExpiry({ db: context.db, logger: context.logger });
  });

  scheduler.registerCron('jobs.expiryReminders', '0 9 * * *', async (context: JobContext) => {
    await processJobPostingExpiryReminders({
      db: context.db,
      logger: context.logger,
      createNotification: notifs ? (req) => notifs.createNotification(req) : undefined,
    });
  });
}
