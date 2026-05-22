/**
 * Tests for reportAd handler
 * Slice 046: Advertising Campaigns (M16)
 * M16-R5: Auto-pause after N reports
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { reportAd } from './reportAd';
import { CreativeRepository } from './repos/creative.repo';
import { CampaignRepository } from './repos/campaign.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { Creative, Campaign } from './repos/advertising.schema';

// Mock-Classification: APPROPRIATE — ad service with moderation boundary
function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 'cre-1', organizationId: 'org-1', campaignId: 'camp-1',
    title: 'Buy Now', bodyText: 'Great deals', status: 'approved',
    sponsoredLabel: true, reviewedBy: 'admin-1', reviewedAt: new Date(),
    rejectionReason: null, imageUrl: null, clickUrl: 'https://example.com',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'user-1', updatedBy: 'user-1', version: 1,
    ...overrides,
  } as unknown as Creative;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1', organizationId: 'org-1', advertiserId: 'adv-1',
    name: 'Summer Sale', status: 'active', adSlot: 'feed_banner',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Campaign;
}

function makeCtx(opts: { userId?: string; body?: Record<string, any>; params?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => type === 'json' ? body : type === 'param' ? params : {} },
    json: (data: any, status: number) => { captured = { data, status }; return new Response(JSON.stringify(data), { status }); },
    _captured: () => captured,
  };
  return ctx as any;
}

function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => key === 'user' ? { id: '', name: '' } : origGet(key);
  return ctx;
}

describe('reportAd', () => {
  let pauseCampaign: ReturnType<typeof mock>;

  beforeEach(() => {
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative()) as any;
    CreativeRepository.prototype.countReports = mock(async () => 2) as any;
    pauseCampaign = mock(async () => makeCampaign({ status: 'paused' }));
    CampaignRepository.prototype.pauseCampaign = pauseCampaign as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Inappropriate' } });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with report count', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Misleading ad' } });
    await reportAd(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.reportCount).toBe(3); // 2 existing + 1 new
    expect(data.autoPaused).toBe(false);
  });

  test('throws NotFoundError when creative does not exist', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-999' }, body: { reason: 'X' } });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when reason is missing', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: {} });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('M16-R5: auto-pauses campaign when reports reach threshold', async () => {
    CreativeRepository.prototype.countReports = mock(async () => 4) as any; // 4 + 1 = 5 = threshold
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Bad content' } });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(true);
    expect(pauseCampaign).toHaveBeenCalledTimes(1);
  });

  test('M16-R5: does not auto-pause below threshold', async () => {
    CreativeRepository.prototype.countReports = mock(async () => 1) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Bad content' } });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(false);
    expect(pauseCampaign).not.toHaveBeenCalled();
  });
});
