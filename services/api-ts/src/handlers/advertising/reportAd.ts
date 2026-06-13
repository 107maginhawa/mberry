/**
 * reportAd
 *
 * Path: POST /association/advertising/creatives/:creativeId/report
 * OperationId: reportAd
 *
 * Member reports an ad (M16-R5: persist report, auto-pause the creative after
 * a threshold of reports within a rolling window).
 *
 * AHA FIX-009 / G-03: previously this was "simulated" — it never inserted a
 * report row, used a threshold of 5 (spec m16 §4 = 3), had no rolling window,
 * and paused the whole CAMPAIGN. Now each report is persisted to ad_report;
 * the count is over a rolling 7-day window; at 3 reports the CREATIVE (not the
 * campaign) is auto-paused for re-review; and an admin notification is fired.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { CreativeRepository } from './repos/creative.repo';
import { NotificationRepository } from '../notifs/repos/notification.repo';
import { PersonRepository } from '../person/repos/person.repo';

const REPORT_THRESHOLD = 3; // spec m16 §4 / M16-R5
const REPORT_WINDOW_DAYS = 7; // rolling window

export async function reportAd(ctx: ValidatedContext<any, never, any>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const { creativeId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'advertising' }) ?? baseLogger;

  if (!body.reason?.trim()) throw new ValidationError('Report reason is required');

  const organizationId = ctx.get('organizationId') as string | undefined;

  const creativeRepo = new CreativeRepository(db, logger);
  const creative = await creativeRepo.findOneById(creativeId);
  if (!creative) throw new NotFoundError('Creative not found');

  // Org isolation: a member may only report a creative in their own org.
  // Returning 404 (not 403) avoids leaking the existence of other orgs' creatives.
  if (!organizationId || creative.organizationId !== organizationId) {
    throw new NotFoundError('Creative not found');
  }

  // Persist the report (no longer simulated).
  await creativeRepo.createReport({
    organizationId: creative.organizationId,
    creativeId,
    reporterPersonId: user.id,
    reason: body.reason.trim(),
    actorId: user.id,
  });

  // Count reports within the rolling window (includes the row just inserted).
  const reportCount = await creativeRepo.countReportsWithinDays(creativeId, REPORT_WINDOW_DAYS);

  let autoPaused = false;

  // M16-R5: auto-pause the CREATIVE once the threshold is met — but only if it
  // is currently serving (approved). A creative that is already pending/rejected
  // is not re-paused (the report is still recorded).
  if (reportCount >= REPORT_THRESHOLD && creative.status === 'approved') {
    await creativeRepo.pauseCreative(creativeId);
    autoPaused = true;

    logger?.warn({
      creativeId,
      campaignId: creative.campaignId,
      reportCount,
      windowDays: REPORT_WINDOW_DAYS,
      action: 'auto_pause_creative',
    }, 'Creative auto-paused (reverted to pending) due to member reports');

    // Notify an admin/owner that the creative was auto-paused (V1 RECOMMENDED).
    // Fire-and-forget — a notification failure must not fail the report.
    if (creative.createdBy) {
      try {
        const personRepo = new PersonRepository(db, logger);
        const notifRepo = new NotificationRepository(db, personRepo, logger);
        await notifRepo.createNotificationForModule({
          organizationId: creative.organizationId,
          recipient: creative.createdBy,
          type: 'system',
          channel: 'in-app',
          title: 'Ad creative auto-paused',
          message: `Creative "${creative.title}" was auto-paused after ${reportCount} member reports within ${REPORT_WINDOW_DAYS} days and is awaiting re-review.`,
          relatedEntityType: 'ad_creative',
          relatedEntity: creativeId,
        });
      } catch (err) {
        logger?.error({ err, creativeId, action: 'auto_pause_notify_failed' }, 'Failed to notify admin of auto-paused creative');
      }
    }
  }

  logger?.info({
    creativeId,
    reportedBy: user.id,
    reason: body.reason,
    reportCount,
    autoPaused,
    action: 'report_ad',
  }, 'Ad reported');

  return ctx.json({
    creativeId,
    reportCount,
    autoPaused,
  }, 200);
}
