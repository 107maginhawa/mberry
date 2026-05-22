/**
 * Tests for createCampaign handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-002: Targeting without PII
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createCampaign } from './createCampaign';
import { AdvertiserRepository } from './repos/advertiser.repo';
import { CampaignRepository } from './repos/campaign.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { Advertiser, Campaign } from './repos/advertising.schema';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

function makeAdvertiser(overrides: Partial<Advertiser> = {}): Advertiser {
  return {
    id: 'adv-1', organizationId: 'org-1', companyName: 'AdCorp',
    contactEmail: 'ads@corp.com', contactPersonId: null, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Advertiser;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1', organizationId: 'org-1', advertiserId: 'adv-1',
    name: 'Summer Sale', description: 'Campaign for summer', status: 'draft',
    targetSegmentId: 'seg-1', targetSegmentSize: 500, budgetCents: 100000,
    spentCents: 0, startsAt: null, endsAt: null, adSlot: 'feed_banner',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Campaign;
}

function makeCtx(opts: { userId?: string; body?: Record<string, any>; organizationId?: string } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const organizationId = opts.organizationId ?? 'org-1';
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = { user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId };
      return store[key];
    },
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

  test('returns 201 with campaign data when valid', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'Summer Sale', targetSegmentId: 'seg-1' } });
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

  test('campaign starts in draft status', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'X' } });
    await createCampaign(ctx);
    const { data } = ctx._captured();
    expect(data.status).toBe('draft');
  });

  // AC-M16-002: Targeting without PII
  test('AC-M16-002: rejects targeting by email (PII)', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'X', targetEmail: 'user@example.com' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-002: rejects targeting by phone (PII)', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'X', targetPhone: '+1234567890' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-002: rejects targeting by name (PII)', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'X', targetName: 'John Doe' } });
    await expect(createCampaign(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-002: allows segment-based targeting', async () => {
    const ctx = makeCtx({ body: { advertiserId: 'adv-1', name: 'X', targetSegmentId: 'seg-active-members' } });
    await createCampaign(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.targetSegmentId).toBe('seg-active-members');
  });
});
