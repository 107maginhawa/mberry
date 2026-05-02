/**
 * Dues Module Background Jobs
 * Registers and configures dues-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { processDuesReminders } from './reminderProcessor';

/**
 * Register all dues module jobs with the scheduler
 */
export function registerDuesJobs(scheduler: JobScheduler): void {
  // Process dues reminders daily at midnight
  scheduler.registerCron('dues.reminderProcessor', '0 0 * * *', async (context: JobContext) => {
    await processDuesReminders({ db: context.db, logger: context.logger });
  });
}
