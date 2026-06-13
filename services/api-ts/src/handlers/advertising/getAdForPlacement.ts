/**
 * getAdForPlacement
 *
 * Path: GET /association/advertising/placement
 * OperationId: getAdForPlacement
 *
 * Retrieve an ad for display in a feed slot.
 * Respects opt-out (M16-R4), approval gate (AC-M16-001 / BR-45),
 * campaign status + schedule (M16-R6), and sponsored label (AC-M16-003 / BR-47).
 *
 * AHA FIX-008 / G-02: opt-out is read SERVER-SIDE from member_ad_opt_out — the
 * client `optedOut` query flag is no longer trusted (it was trivially
 * bypassable).
 * AHA FIX-010 / G-09: serving is gated on the parent campaign being `active`
 * and within its `starts_at..ends_at` window — paused/expired/draft/
 * not-yet-started campaigns no longer serve.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import { CreativeRepository } from './repos/creative.repo';
import { CampaignRepository } from './repos/campaign.repo';
import { MemberAdOptOutRepository } from './repos/optOut.repo';

export async function getAdForPlacement(ctx: ValidatedContext<never, any, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  // query is read for adSlot only; `optedOut` is intentionally NOT trusted.
  ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  // AC-M16-004 (FIX-008): authoritative, server-side opt-out check.
  const optOutRepo = new MemberAdOptOutRepository(db, logger);
  if (await optOutRepo.isOptedOut(organizationId, user.id)) {
    return ctx.json({
      ad: null,
      generic: true,
      reason: 'member_opted_out',
    }, 200);
  }

  const repo = new CreativeRepository(db, logger);

  // AC-M16-001: only approved creatives are eligible.
  const approvedCreatives = await repo.findMany({
    organizationId,
    status: 'approved',
  });

  if (!Array.isArray(approvedCreatives) || approvedCreatives.length === 0) {
    return ctx.json({ ad: null, generic: true, reason: 'no_approved_ads' }, 200);
  }

  // M16-R6 (FIX-010): gate on parent campaign status + schedule window.
  const campaignIds = [...new Set(approvedCreatives.map((c) => c.campaignId))];
  const campaignRepo = new CampaignRepository(db, logger);
  const campaigns = await campaignRepo.findByIds(campaignIds, organizationId);
  const now = new Date();
  const servableCampaignIds = new Set(
    campaigns
      .filter((c) => {
        if (c.status !== 'active') return false;
        if (c.startsAt && new Date(c.startsAt) > now) return false; // not started
        if (c.endsAt && new Date(c.endsAt) < now) return false; // ended
        return true;
      })
      .map((c) => c.id),
  );

  const servable = approvedCreatives.filter((c) => servableCampaignIds.has(c.campaignId));

  if (servable.length === 0) {
    return ctx.json({ ad: null, generic: true, reason: 'no_approved_ads' }, 200);
  }

  // Select first eligible creative (in production: weighted/randomized).
  const creative = servable[0];

  // AC-M16-003: ensure sponsored label.
  return ctx.json({
    ad: {
      ...creative,
      sponsoredLabel: true, // Always enforce
    },
    generic: false,
  }, 200);
}
