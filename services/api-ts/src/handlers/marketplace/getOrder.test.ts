/**
 * Co-located unit tests for the getOrder handler.
 *
 * GET /association/marketplace/orders/:orderId — fetch a single order by ID,
 * org-scoped (FIX-007 / G-10): an order outside the caller's org is
 * indistinguishable from a missing one (404, not 403). Mirrors the mocking
 * style of order-discovery.test.ts so it stays deterministic with no real DB.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { getOrder } from './getOrder';
import { OrderRepository } from './repos/order.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { MarketplaceOrder } from './repos/marketplace.schema';

function makeOrder(overrides: Partial<MarketplaceOrder> = {}): MarketplaceOrder {
  return {
    id: 'order-1', organizationId: 'org-1', listingId: 'listing-1',
    buyerPersonId: 'user-1', vendorId: 'vendor-1', quantity: 1,
    totalPrice: '149.99', status: 'pending', notes: null, fulfilledAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'user-1', updatedBy: 'user-1', version: 1,
    ...overrides,
  } as unknown as MarketplaceOrder;
}

function makeCtx(opts: { params?: Record<string, any> } = {}) {
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: { id: 'user-1', name: 'Test User' }, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => (type === 'param' ? params : {}) },
    json: (data: any, status: number) => { captured = { data, status }; return new Response(JSON.stringify(data), { status }); },
    _captured: () => captured,
  };
  return ctx as any;
}

function makeNoUserCtx(opts: { params?: Record<string, any> } = {}) {
  const ctx = makeCtx(opts);
  const origGet = ctx.get;
  ctx.get = (key: string) => (key === 'user' ? { id: '', name: '' } : origGet(key));
  return ctx;
}

describe('getOrder', () => {
  beforeEach(() => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder()) as any;
  });

  test('throws ValidationError without a valid user', async () => {
    const ctx = makeNoUserCtx({ params: { orderId: 'order-1' } });
    await expect(getOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with the order when it is in the caller org', async () => {
    let lookedUpId: string | undefined;
    OrderRepository.prototype.findOneById = mock(async (id: string) => {
      lookedUpId = id;
      return makeOrder({ id: 'order-1' });
    }) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    const res = await getOrder(ctx);
    const { status, data } = ctx._captured();
    expect(res.status).toBe(200);
    expect(status).toBe(200);
    expect(data.id).toBe('order-1');
    expect(lookedUpId).toBe('order-1');
  });

  test('throws NotFoundError when the order does not exist', async () => {
    OrderRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { orderId: 'order-999' } });
    await expect(getOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when the order belongs to another org (org-scope guard)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ organizationId: 'org-OTHER' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(getOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
