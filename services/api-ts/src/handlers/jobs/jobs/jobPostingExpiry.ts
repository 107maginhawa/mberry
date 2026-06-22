/**
 * BR-37 Job Posting Expiry — background processors.
 *
 * - processJobPostingExpiry: flips active postings past their expiry to
 *   'expired' (which removes them from the public board — searchJobPostings
 *   hides 'expired' by default).
 * - processJobPostingExpiryReminders: notifies the poster 3 days before expiry.
 *   Dedup is structural: the daily run targets only postings whose expiry falls
 *   on (today + 3 days), so each posting is reminded exactly once.
 *
 * Both take an injected `now` so tests are deterministic.
 */
import type { DatabaseInstance } from '@/core/database';
import type { CreateNotificationRequest, NotificationEntry } from '@/core/notifs';
import { JobPostingRepository } from '../repos/jobs.repo';

interface Logger {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

export const REMINDER_DAYS_BEFORE = 3;

export async function processJobPostingExpiry(deps: {
  db: DatabaseInstance;
  logger?: Logger | null;
  now?: Date;
}): Promise<{ expired: number }> {
  const now = deps.now ?? new Date();
  const repo = new JobPostingRepository(deps.db);
  const expired = await repo.expireOverdue(now);
  deps.logger?.info?.(
    { count: expired.length, action: 'job_posting.expire' },
    `Expired ${expired.length} overdue job posting(s)`,
  );
  return { expired: expired.length };
}

export async function processJobPostingExpiryReminders(deps: {
  db: DatabaseInstance;
  logger?: Logger | null;
  createNotification?: (req: CreateNotificationRequest) => Promise<NotificationEntry>;
  now?: Date;
}): Promise<{ reminded: number }> {
  const now = deps.now ?? new Date();
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + REMINDER_DAYS_BEFORE);

  const repo = new JobPostingRepository(deps.db);
  const expiring = await repo.listExpiringOn(target);

  let reminded = 0;
  for (const posting of expiring) {
    if (!posting.postedBy || !deps.createNotification) continue;
    try {
      await deps.createNotification({
        organizationId: posting.organizationId,
        recipient: posting.postedBy,
        type: 'system',
        channel: 'in-app',
        title: 'Job posting expiring soon',
        message: `Your posting "${posting.title}" expires in ${REMINDER_DAYS_BEFORE} days. Extend it to keep it on the board.`,
        relatedEntityType: 'job_posting',
        relatedEntity: posting.id,
      });
      reminded++;
    } catch (err) {
      deps.logger?.warn?.(
        { err, postingId: posting.id, action: 'job_posting.reminder' },
        'Failed to send job posting expiry reminder',
      );
    }
  }

  deps.logger?.info?.(
    { count: reminded, action: 'job_posting.expire_reminder' },
    `Sent ${reminded} job posting expiry reminder(s)`,
  );
  return { reminded };
}
