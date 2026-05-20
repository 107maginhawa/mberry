/**
 * Tests for getAdForPlacement handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-001: Only approved creatives served
 * AC-M16-003: Sponsored label always present
 * AC-M16-004: Member opt-out respected
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { getAdForPlacement } from './getAdForPlacement';
import { CreativeRepository } from './repos/creative.repo';
import { ValidationError } from '@/core/errors';
import type { Creative } from './repos/advertising.schema';

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

function makeCtx(opts: { userId?: string; query?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const query = opts.query ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
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
    expect(data.ad.status).toBe('approved');
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

  test('AC-M16-001: only queries approved status creatives', async () => {
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
