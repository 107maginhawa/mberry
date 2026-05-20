/**
 * createCreative
 *
 * Path: POST /association/advertising/creatives
 * OperationId: createCreative
 *
 * Submit a creative for admin review (AC-M16-001: no display without approval)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError, NotFoundError } from '@/core/errors';
import { CampaignRepository } from './repos/campaign.repo';
import { CreativeRepository } from './repos/creative.repo';

export async function createCreative(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  if (!body.campaignId) throw new ValidationError('campaignId is required');
  if (!body.title?.trim()) throw new ValidationError('Title is required');
  if (!body.bodyText?.trim()) throw new ValidationError('Body text is required');

  const campaignRepo = new CampaignRepository(db, logger);
  const campaign = await campaignRepo.findOneById(body.campaignId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  const creativeRepo = new CreativeRepository(db, logger);

  // AC-M16-001: creative starts in 'pending' — requires admin approval
  // AC-M16-003: sponsoredLabel always true
  const creative = await creativeRepo.createOne({
    organizationId,
    campaignId: body.campaignId,
    title: body.title.trim(),
    bodyText: body.bodyText.trim(),
    imageUrl: body.imageUrl ?? null,
    clickUrl: body.clickUrl ?? null,
    status: 'pending',
    sponsoredLabel: true, // M16-R3: always labeled "Sponsored"
    createdBy: user.id,
  });

  logger?.info({ creativeId: creative.id, action: 'create_creative' }, 'Creative submitted for review');

  return ctx.json(creative, 201);
}
