/**
 * createCampaign
 *
 * Path: POST /association/advertising/campaigns
 * OperationId: createCampaign
 *
 * Create a new ad campaign. Targeting is segment-based only (M16-R2).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { AdvertiserRepository } from './repos/advertiser.repo';
import { CampaignRepository } from './repos/campaign.repo';

export async function createCampaign(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'advertising' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  if (!body.advertiserId) throw new ValidationError('advertiserId is required');
  if (!body.name?.trim()) throw new ValidationError('Campaign name is required');

  // M16-R2: reject if PII fields are present in targeting
  if (body.targetEmail || body.targetPhone || body.targetName) {
    throw new ValidationError('Targeting by PII (email, phone, name) is not allowed. Use segment-based targeting only.');
  }

  const advertiserRepo = new AdvertiserRepository(db, logger);
  const advertiser = await advertiserRepo.findOneById(body.advertiserId);
  if (!advertiser) throw new NotFoundError('Advertiser not found');

  const campaignRepo = new CampaignRepository(db, logger);

  const campaign = await campaignRepo.createOne({
    organizationId,
    advertiserId: body.advertiserId,
    name: body.name.trim(),
    description: body.description ?? null,
    status: 'draft',
    targetSegmentId: body.targetSegmentId ?? null,
    targetSegmentSize: body.targetSegmentSize ?? null,
    budgetCents: body.budgetCents ?? 0,
    spentCents: 0,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    adSlot: body.adSlot ?? 'feed_banner',
    createdBy: user.id,
  });

  logger?.info({ campaignId: campaign.id, action: 'create_campaign' }, 'Campaign created');

  return ctx.json(campaign, 201);
}
