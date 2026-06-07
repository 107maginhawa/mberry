/**
 * Membership Module Background Jobs
 *
 * Re-exports both membership-domain registrars:
 *   - registerStatusRecomputeJob (BR-01 status recompute, daily 03:00 UTC)
 *   - registerMembershipJobs (GAP-015 graceToLapsed transition, daily 02:00 UTC)
 *
 * Single entry point for app.ts; both invoked at boot.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import { processGraceToLapsed } from './graceToLapsed';

export { registerStatusRecomputeJob } from './statusRecomputeCron';

/**
 * Register all membership module jobs with the scheduler.
 *
 * @param scheduler - The job scheduler to register with
 * @param notifs - Optional notification service for sending transition alerts
 */
export function registerMembershipJobs(
  scheduler: JobScheduler,
  notifs?: NotificationService,
): void {
  // GAP-015: Transition grace-period memberships to lapsed daily at 2 AM UTC
  scheduler.registerCron(
    'membership.graceToLapsed',
    '0 2 * * *',
    async (context: JobContext) => {
      await processGraceToLapsed({
        db: context.db,
        logger: context.logger,
        createNotification: notifs
          ? (params) => notifs.createNotification(params)
          : undefined,
      });
    },
  );
}
