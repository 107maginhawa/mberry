/**
 * reportAd
 *
 * Path: POST /association/advertising/creatives/:creativeId/report
 * OperationId: reportAd
 *
 * Member reports an ad (M16-R5: auto-pause after threshold)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { CreativeRepository } from './repos/creative.repo';
import { CampaignRepository } from './repos/campaign.repo';

const REPORT_THRESHOLD = 5; // Configurable per M16-R5

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

  const creativeRepo = new CreativeRepository(db, logger);
  const creative = await creativeRepo.findOneById(creativeId);
  if (!creative) throw new NotFoundError('Creative not found');

  // Count reports (simulated — in production, insert report + count)
  const reportCount = await creativeRepo.countReports(creativeId);
  const newCount = reportCount + 1;

  let autoPaused = false;

  // M16-R5: auto-pause campaign if reports exceed threshold
  if (newCount >= REPORT_THRESHOLD) {
    const campaignRepo = new CampaignRepository(db, logger);
    await campaignRepo.pauseCampaign(creative.campaignId, 'system');
    autoPaused = true;

    logger?.warn({
      creativeId,
      campaignId: creative.campaignId,
      reportCount: newCount,
      action: 'auto_pause_campaign',
    }, 'Campaign auto-paused due to reports');
  }

  logger?.info({
    creativeId,
    reportedBy: user.id,
    reason: body.reason,
    action: 'report_ad',
  }, 'Ad reported');

  return ctx.json({
    creativeId,
    reportCount: newCount,
    autoPaused,
  }, 200);
}
