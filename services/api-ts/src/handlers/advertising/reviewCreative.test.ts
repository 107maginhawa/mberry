/**
 * Tests for reviewCreative handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-001: Admin approval gate
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { reviewCreative } from './reviewCreative';
import { CreativeRepository } from './repos/creative.repo';
import { ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { Creative } from './repos/advertising.schema';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

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

function makeCtx(opts: { userId?: string; body?: Record<string, any>; params?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    set: (_key: string, _val: any) => {},
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

describe('reviewCreative', () => {
  beforeEach(() => {
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative({ status: 'pending' })) as any;
    CreativeRepository.prototype.approveCreative = mock(async () =>
      makeCreative({ status: 'approved', reviewedBy: 'admin-1' })
    ) as any;
    CreativeRepository.prototype.rejectCreative = mock(async () =>
      makeCreative({ status: 'rejected', reviewedBy: 'admin-1', rejectionReason: 'Inappropriate' })
    ) as any;
  });

  // Contract alignment (Batch D): the generated validator strips to the contract
  // shape `{ approved: boolean, rejectionReason?: string }` (advertising.tsp
  // ReviewCreativeRequest). The handler must read `approved`/`rejectionReason`,
  // NOT the legacy `decision`/`reason` fields.
  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { creativeId: 'cre-1' }, body: { approved: true } });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-001: approves a pending creative when approved=true', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { approved: true } });
    await reviewCreative(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('approved');
    expect(data.reviewedBy).toBe('admin-1');
  });

  test('AC-M16-001: rejects a pending creative when approved=false with rejectionReason', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { approved: false, rejectionReason: 'Inappropriate content' } });
    await reviewCreative(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('rejected');
    expect(data.rejectionReason).toBe('Inappropriate');
  });

  test('throws ValidationError when approved is not a boolean', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: {} });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when rejecting (approved=false) without rejectionReason', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { approved: false } });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws NotFoundError when creative does not exist', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-999' }, body: { approved: true } });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when creative is already reviewed', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative({ status: 'approved' })) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { approved: true } });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
