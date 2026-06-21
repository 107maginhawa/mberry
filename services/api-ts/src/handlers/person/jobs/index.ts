/**
 * Person Module Background Jobs
 * Registers and configures person-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { processDeletions } from './deletionProcessor';
import { processExpiredDataExports } from './dataExportPurge';
import { createAuditService } from '@/core/audit';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';

/**
 * Register all person module jobs with the scheduler
 */
export function registerPersonJobs(scheduler: JobScheduler): void {
  // Process account deletions daily at midnight. Pass an audit sink so the DPA-05
  // deletion audit row is actually written (previously processDeletions ran with no
  // audit, so the `if (audit)` block was skipped and no deletion was ever audited).
  scheduler.registerCron('person.deletionProcessor', '0 0 * * *', async (context: JobContext) => {
    const audit = createAuditService(new AuditRepository(context.db, context.logger));
    await processDeletions({ db: context.db, logger: context.logger, audit });
  });

  // Purge expired data-export payloads daily at 03:00 (DPA minimization) — FIX-009
  scheduler.registerCron('person.dataExportPurge', '0 3 * * *', async (context: JobContext) => {
    await processExpiredDataExports({ db: context.db, logger: context.logger });
  });
}
