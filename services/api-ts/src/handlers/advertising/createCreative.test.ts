/**
 * Tests for createCreative handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-001: Creative approval before display
 * AC-M16-003: Sponsored label always present
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createCreative } from './createCreative';
import { CampaignRepository } from './repos/campaign.repo';
import { CreativeRepository } from './repos/creative.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { Campaign, Creative } from './repos/advertising.schema';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1', organizationId: 'org-1', advertiserId: 'adv-1',
    name: 'Summer Sale', status: 'draft', adSlot: 'feed_banner',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Campaign;
}

function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 'cre-1', organizationId: 'org-1', campaignId: 'camp-1',
    title: 'Buy Now', bodyText: 'Great deals', imageUrl: null,
    clickUrl: 'https://example.com', status: 'pending',
    reviewedBy: null, reviewedAt: null, rejectionReason: null,
    sponsoredLabel: true,
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'user-1', updatedBy: 'user-1', version: 1,
    ...overrides,
  } as unknown as Creative;
}

function makeCtx(opts: { userId?: string; body?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => type === 'json' ? body : {} },
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

  test('returns 201 with creative data when valid', async () => {
    const ctx = makeCtx({ body: { campaignId: 'camp-1', title: 'Ad Title', bodyText: 'Ad body' } });
    await createCreative(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.title).toBe('Ad Title');
  });

  test('AC-M16-001: creative starts in pending status (requires admin approval)', async () => {
    const ctx = makeCtx({ body: { campaignId: 'camp-1', title: 'X', bodyText: 'Y' } });
    await createCreative(ctx);
    const { data } = ctx._captured();
    expect(data.status).toBe('pending');
  });

  test('AC-M16-003: sponsoredLabel is always true', async () => {
    const ctx = makeCtx({ body: { campaignId: 'camp-1', title: 'X', bodyText: 'Y' } });
    await createCreative(ctx);
    const { data } = ctx._captured();
    expect(data.sponsoredLabel).toBe(true);
  });

  test('throws NotFoundError when campaign does not exist', async () => {
    CampaignRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ body: { campaignId: 'camp-999', title: 'X', bodyText: 'Y' } });
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
