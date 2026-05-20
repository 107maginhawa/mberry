/**
 * Tests for advertising handlers — advertiser management, campaign CRUD,
 * creative review/approval, feed placement.
 *
 * Slice 046: Advertising Campaigns (M16, stabilize, large)
 *
 * Acceptance criteria:
 *   AC-M16-001: Creative approval before display
 *   AC-M16-002: Targeting without PII
 *   AC-M16-003: Sponsored label always present
 *   AC-M16-004: Member opt-out respected
 *
 * Business rules:
 *   M16-R1: Admin approval before display
 *   M16-R2: Segment-based targeting only, no PII
 *   M16-R3: Sponsored label required
 *   M16-R4: Opt-out respected immediately
 *   M16-R5: Auto-pause after N reports
 *   M16-R6: Budget exhaustion pauses delivery
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

import { createAdvertiser } from './createAdvertiser';
import { createCampaign } from './createCampaign';
import { createCreative } from './createCreative';
import { reviewCreative } from './reviewCreative';
import { getAdForPlacement } from './getAdForPlacement';
import { setMemberOptOut } from './setMemberOptOut';
import { reportAd } from './reportAd';

import { AdvertiserRepository } from './repos/advertiser.repo';
import { CampaignRepository } from './repos/campaign.repo';
import { CreativeRepository } from './repos/creative.repo';
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import type { Advertiser, Campaign, Creative } from './repos/advertising.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAdvertiser(overrides: Partial<Advertiser> = {}): Advertiser {
  return {
    id: 'adv-1',
    organizationId: 'org-1',
    companyName: 'AdCorp',
    contactEmail: 'ads@corp.com',
    contactPersonId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    version: 1,
    ...overrides,
  } as unknown as Advertiser;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1',
    organizationId: 'org-1',
    advertiserId: 'adv-1',
    name: 'Summer Sale',
    description: 'Campaign for summer',
    status: 'draft',
    targetSegmentId: 'seg-1',
    targetSegmentSize: 500,
    budgetCents: 100000,
    spentCents: 0,
    startsAt: null,
    endsAt: null,
    adSlot: 'feed_banner',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    version: 1,
    ...overrides,
  } as unknown as Campaign;
}

function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 'cre-1',
    organizationId: 'org-1',
    campaignId: 'camp-1',
    title: 'Buy Now',
    bodyText: 'Great deals this summer',
    imageUrl: 'https://img.example.com/ad.png',
    clickUrl: 'https://example.com/deal',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    sponsoredLabel: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as Creative;
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  userId?: string;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  organizationId?: string;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const query = opts.query ?? {};
  const params = opts.params ?? {};
  const organizationId = opts.organizationId ?? 'org-1';
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: userId ? { id: userId, name: 'Test User' } : null,
        database: {},
        logger,
        organizationId,
      };
      return store[key];
    },
    req: {
      valid: (type: string) => {
        if (type === 'param') return params;
        if (type === 'json') return body;
        if (type === 'query') return query;
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => {
    if (key === 'user') return { id: '', name: '' };
    return origGet(key);
  };
  return ctx;
}

// ===========================================================================
// createAdvertiser
// ===========================================================================

describe('createAdvertiser', () => {
  beforeEach(() => {
    AdvertiserRepository.prototype.createOne = mock(async (data: any) =>
      makeAdvertiser({ id: 'adv-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { companyName: 'X', contactEmail: 'x@x.com' } });
    await expect(createAdvertiser(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when creating an advertiser', async () => {
    const ctx = makeCtx({ body: { companyName: 'AdCorp', contactEmail: 'ads@corp.com' } });
    await createAdvertiser(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.companyName).toBe('AdCorp');
    expect(data.isActive).toBe(true);
  });

  test('throws ValidationError when companyName is missing', async () => {
    const ctx = makeCtx({ body: { contactEmail: 'x@x.com' } });
    await expect(createAdvertiser(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when contactEmail is missing', async () => {
    const ctx = makeCtx({ body: { companyName: 'X' } });
    await expect(createAdvertiser(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ===========================================================================
// createCampaign
// ===========================================================================

describe('createCampaign', () => {
  beforeEach(() => {
    AdvertiserRepository.prototype.findOneById = mock(async () => makeAdvertiser()) as any;
    CampaignRepository.prototype.createOne = mock(async (data: any) =>
      makeCampaign({ id: 'camp-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { advertiserId: 'adv-1', name: 'X' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when creating a campaign', async () => {
    const ctx = makeCtx({
      body: { advertiserId: 'adv-1', name: 'Summer Sale', targetSegmentId: 'seg-1' },
    });
    await createCampaign(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.name).toBe('Summer Sale');
    expect(data.status).toBe('draft');
  });

  test('throws NotFoundError when advertiser does not exist', async () => {
    AdvertiserRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ body: { advertiserId: 'adv-999', name: 'X' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when advertiserId is missing', async () => {
    const ctx = makeCtx({ body: { name: 'X' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when name is missing', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  // AC-M16-002: Targeting without PII
  test('AC-M16-002: rejects targeting by email (PII)', async () => {
    const ctx = makeCtx({
      body: { advertiserId: 'adv-1', name: 'X', targetEmail: 'user@example.com' },
    });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-002: rejects targeting by phone (PII)', async () => {
    const ctx = makeCtx({
      body: { advertiserId: 'adv-1', name: 'X', targetPhone: '+1234567890' },
    });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-002: rejects targeting by name (PII)', async () => {
    const ctx = makeCtx({
      body: { advertiserId: 'adv-1', name: 'X', targetName: 'John Doe' },
    });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-002: allows segment-based targeting', async () => {
    const ctx = makeCtx({
      body: { advertiserId: 'adv-1', name: 'X', targetSegmentId: 'seg-active-members' },
    });
    await createCampaign(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.targetSegmentId).toBe('seg-active-members');
  });

  test('campaign starts in draft status', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'X' } });
    await createCampaign(ctx);
    const { data } = ctx._captured();
    expect(data.status).toBe('draft');
  });
});

// ===========================================================================
// createCreative (AC-M16-001, AC-M16-003)
// ===========================================================================

describe('createCreative', () => {
  beforeEach(() => {
    CampaignRepository.prototype.findOneById = mock(async () => makeCampaign()) as any;
    CreativeRepository.prototype.createOne = mock(async (data: any) =>
      makeCreative({ id: 'cre-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { campaignId: 'camp-1', title: 'X', bodyText: 'Y' } });
    await expect(createCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when submitting a creative', async () => {
    const ctx = makeCtx({
      body: { campaignId: 'camp-1', title: 'Ad Title', bodyText: 'Ad body' },
    });
    await createCreative(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.title).toBe('Ad Title');
  });

  test('AC-M16-001: creative starts in pending status (requires admin approval)', async () => {
    const ctx = makeCtx({
      body: { campaignId: 'camp-1', title: 'X', bodyText: 'Y' },
    });
    await createCreative(ctx);
    const { data } = ctx._captured();
    expect(data.status).toBe('pending');
  });

  test('AC-M16-003: sponsoredLabel is always true', async () => {
    const ctx = makeCtx({
      body: { campaignId: 'camp-1', title: 'X', bodyText: 'Y' },
    });
    await createCreative(ctx);
    const { data } = ctx._captured();
    expect(data.sponsoredLabel).toBe(true);
  });

  test('throws NotFoundError when campaign does not exist', async () => {
    CampaignRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({
      body: { campaignId: 'camp-999', title: 'X', bodyText: 'Y' },
    });
    await expect(createCreative(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when title is missing', async () => {
    const ctx = makeCtx({ body: { campaignId: 'camp-1', bodyText: 'Y' } });
    await expect(createCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when bodyText is missing', async () => {
    const ctx = makeCtx({ body: { campaignId: 'camp-1', title: 'X' } });
    await expect(createCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ===========================================================================
// reviewCreative (AC-M16-001: approval gate)
// ===========================================================================

describe('reviewCreative', () => {
  beforeEach(() => {
    CreativeRepository.prototype.findOneById = mock(async () =>
      makeCreative({ status: 'pending' })
    ) as any;
    CreativeRepository.prototype.approveCreative = mock(async () =>
      makeCreative({ status: 'approved', reviewedBy: 'admin-1' })
    ) as any;
    CreativeRepository.prototype.rejectCreative = mock(async () =>
      makeCreative({ status: 'rejected', reviewedBy: 'admin-1', rejectionReason: 'Inappropriate' })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({
      params: { creativeId: 'cre-1' },
      body: { decision: 'approved' },
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-001: approves a pending creative', async () => {
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { decision: 'approved' },
    });
    await reviewCreative(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('approved');
  });

  test('AC-M16-001: rejects a pending creative with reason', async () => {
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { decision: 'rejected', reason: 'Inappropriate content' },
    });
    await reviewCreative(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('rejected');
  });

  test('throws ValidationError when decision is invalid', async () => {
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { decision: 'maybe' },
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when rejecting without reason', async () => {
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { decision: 'rejected' },
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws NotFoundError when creative does not exist', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({
      params: { creativeId: 'cre-999' },
      body: { decision: 'approved' },
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when creative is already reviewed', async () => {
    CreativeRepository.prototype.findOneById = mock(async () =>
      makeCreative({ status: 'approved' })
    ) as any;
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { decision: 'approved' },
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});

// ===========================================================================
// getAdForPlacement (AC-M16-001, AC-M16-003, AC-M16-004)
// ===========================================================================

describe('getAdForPlacement', () => {
  beforeEach(() => {
    CreativeRepository.prototype.findMany = mock(async () => [
      makeCreative({ status: 'approved', sponsoredLabel: true }),
    ]) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ query: {} });
    await expect(getAdForPlacement(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns approved ad with sponsored label (AC-M16-001 + AC-M16-003)', async () => {
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.generic).toBe(false);
    expect(data.ad).toBeDefined();
    expect(data.ad.sponsoredLabel).toBe(true);
  });

  test('AC-M16-004: returns generic ad when member opted out', async () => {
    const ctx = makeCtx({ query: { optedOut: 'true' } });
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.generic).toBe(true);
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('member_opted_out');
  });

  test('returns generic when no approved creatives exist', async () => {
    CreativeRepository.prototype.findMany = mock(async () => []) as any;
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.generic).toBe(true);
    expect(data.reason).toBe('no_approved_ads');
  });

  test('AC-M16-001: never returns pending creatives', async () => {
    // findMany mock filters by status='approved', so pending won't be returned
    // Verify the filter is applied correctly
    const findManyMock = mock(async (filters: any) => {
      expect(filters.status).toBe('approved');
      return [makeCreative({ status: 'approved' })];
    });
    CreativeRepository.prototype.findMany = findManyMock as any;

    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// setMemberOptOut (AC-M16-004)
// ===========================================================================

describe('setMemberOptOut', () => {
  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { optOut: true } });
    await expect(setMemberOptOut(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-004: returns opt-out confirmation with immediate effect', async () => {
    const ctx = makeCtx({ body: { optOut: true } });
    await setMemberOptOut(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.optedOut).toBe(true);
    expect(data.effectiveImmediately).toBe(true);
  });

  test('AC-M16-004: allows opting back in', async () => {
    const ctx = makeCtx({ body: { optOut: false } });
    await setMemberOptOut(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.optedOut).toBe(false);
  });

  test('defaults to opt-out when body is empty', async () => {
    const ctx = makeCtx({ body: {} });
    await setMemberOptOut(ctx);
    const { data } = ctx._captured();
    expect(data.optedOut).toBe(true);
  });
});

// ===========================================================================
// reportAd (M16-R5: auto-pause after threshold)
// ===========================================================================

describe('reportAd', () => {
  let pauseCampaign: ReturnType<typeof mock>;

  beforeEach(() => {
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative()) as any;
    CreativeRepository.prototype.countReports = mock(async () => 2) as any;
    pauseCampaign = mock(async () => makeCampaign({ status: 'paused' }));
    CampaignRepository.prototype.pauseCampaign = pauseCampaign as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({
      params: { creativeId: 'cre-1' },
      body: { reason: 'Inappropriate' },
    });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with report count', async () => {
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { reason: 'Misleading ad' },
    });
    await reportAd(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.reportCount).toBe(3); // 2 existing + 1 new
    expect(data.autoPaused).toBe(false);
  });

  test('throws NotFoundError when creative does not exist', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({
      params: { creativeId: 'cre-999' },
      body: { reason: 'X' },
    });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when reason is missing', async () => {
    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: {},
    });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('M16-R5: auto-pauses campaign when reports reach threshold', async () => {
    CreativeRepository.prototype.countReports = mock(async () => 4) as any; // 4 + 1 = 5 = threshold

    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { reason: 'Bad content' },
    });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(true);
    expect(pauseCampaign).toHaveBeenCalledTimes(1);
  });

  test('M16-R5: does not auto-pause below threshold', async () => {
    CreativeRepository.prototype.countReports = mock(async () => 1) as any;

    const ctx = makeCtx({
      params: { creativeId: 'cre-1' },
      body: { reason: 'Bad content' },
    });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(false);
    expect(pauseCampaign).not.toHaveBeenCalled();
  });
});
