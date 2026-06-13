/**
 * Tests for getAdForPlacement handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-001: Only approved creatives served
 * AC-M16-003: Sponsored label always present
 * AC-M16-004: Member opt-out respected — SERVER-SIDE (AHA FIX-008 / G-02)
 * M16-R6:     Campaign status + schedule gating at serve (AHA FIX-010 / G-09)
 *
 * RED-first notes:
 *  - The previous handler trusted a client `query.optedOut` flag (trivially
 *    bypassable). These tests require the opt-out to be read from the DB and
 *    require the client flag to be IGNORED.
 *  - The previous handler served any `approved` creative regardless of its
 *    campaign's status/schedule. These tests require paused/expired/draft/
 *    not-yet-started campaigns to NOT serve.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { getAdForPlacement } from './getAdForPlacement';
import { CreativeRepository } from './repos/creative.repo';
import { CampaignRepository } from './repos/campaign.repo';
import { MemberAdOptOutRepository } from './repos/optOut.repo';
import { ValidationError } from '@/core/errors';
import type { Creative, Campaign } from './repos/advertising.schema';

const DAY = 24 * 60 * 60 * 1000;

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
    startsAt: null, endsAt: null,
    budgetCents: 100000, spentCents: 0,
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Campaign;
}

function makeCtx(opts: { userId?: string; query?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const query = opts.query ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => logger };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1', requestId: 'trace-1' })[key],
    req: { valid: (type: string) => type === 'query' ? query : {} },
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

describe('getAdForPlacement', () => {
  beforeEach(() => {
    MemberAdOptOutRepository.prototype.isOptedOut = mock(async () => false) as any;
    CreativeRepository.prototype.findMany = mock(async () => [
      makeCreative({ status: 'approved', sponsoredLabel: true, campaignId: 'camp-1' }),
    ]) as any;
    CampaignRepository.prototype.findByIds = mock(async () => [
      makeCampaign({ id: 'camp-1', status: 'active', startsAt: null, endsAt: null }),
    ]) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ query: {} });
    await expect(getAdForPlacement(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('serves approved ad with sponsored label for an active in-window campaign (AC-M16-001 + AC-M16-003)', async () => {
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.generic).toBe(false);
    expect(data.ad).toBeDefined();
    expect(data.ad.sponsoredLabel).toBe(true);
    expect(data.ad.status).toBe('approved');
  });

  // ── FIX-008: server-side opt-out, no client flag ──────────────────────────

  test('AC-M16-004: returns generic when member opted out (read SERVER-SIDE, no client flag)', async () => {
    MemberAdOptOutRepository.prototype.isOptedOut = mock(async () => true) as any;
    const ctx = makeCtx({ query: {} }); // NOTE: no optedOut query flag
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.generic).toBe(true);
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('member_opted_out');
  });

  test('AC-M16-004: IGNORES a client optedOut=true flag when the member is NOT opted out in the DB', async () => {
    // isOptedOut → false (DB is the source of truth); client flag must not be trusted
    const ctx = makeCtx({ query: { optedOut: 'true' } });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    // Still serves a real ad — the client cannot force opt-out via a query flag
    expect(data.generic).toBe(false);
    expect(data.reason).not.toBe('member_opted_out');
    expect(data.ad).toBeDefined();
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

  // ── FIX-010: campaign status + schedule gating ────────────────────────────

  test('M16-R6: does NOT serve an approved creative whose campaign is paused', async () => {
    CampaignRepository.prototype.findByIds = mock(async () => [
      makeCampaign({ id: 'camp-1', status: 'paused' }),
    ]) as any;
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.generic).toBe(true);
    expect(data.reason).toBe('no_approved_ads');
    expect(data.ad).toBeNull();
  });

  test('M16-R6: does NOT serve an approved creative whose campaign is draft', async () => {
    CampaignRepository.prototype.findByIds = mock(async () => [
      makeCampaign({ id: 'camp-1', status: 'draft' }),
    ]) as any;
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.generic).toBe(true);
    expect(data.ad).toBeNull();
  });

  test('M16-R6: does NOT serve when the campaign schedule has ended (expired)', async () => {
    CampaignRepository.prototype.findByIds = mock(async () => [
      makeCampaign({ id: 'camp-1', status: 'active', startsAt: new Date(Date.now() - 10 * DAY), endsAt: new Date(Date.now() - DAY) }),
    ]) as any;
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.generic).toBe(true);
    expect(data.ad).toBeNull();
  });

  test('M16-R6: does NOT serve when the campaign has not started yet', async () => {
    CampaignRepository.prototype.findByIds = mock(async () => [
      makeCampaign({ id: 'camp-1', status: 'active', startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + 10 * DAY) }),
    ]) as any;
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.generic).toBe(true);
    expect(data.ad).toBeNull();
  });

  test('M16-R6: serves when the campaign is active and now is within the schedule window', async () => {
    CampaignRepository.prototype.findByIds = mock(async () => [
      makeCampaign({ id: 'camp-1', status: 'active', startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) }),
    ]) as any;
    const ctx = makeCtx({ query: {} });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.generic).toBe(false);
    expect(data.ad).toBeDefined();
    expect(data.ad.sponsoredLabel).toBe(true);
  });
});
