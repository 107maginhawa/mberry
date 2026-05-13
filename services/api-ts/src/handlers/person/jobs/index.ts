/**
 * Person Module Background Jobs
 * Registers and configures person-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { processDeletions } from './deletionProcessor';

/**
 * Register all person module jobs with the scheduler
 */
export function registerPersonJobs(scheduler: JobScheduler): void {
  // Process account deletions daily at midnight
  scheduler.registerCron('person.deletionProcessor', '0 0 * * *', async (context: JobContext) => {
    await processDeletions({ db: context.db, logger: context.logger });
  });
}
