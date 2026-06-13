/**
 * Tests for order discovery & cancellation handlers
 * FIX-006 (G-08): listOrders / getOrder / cancelOrder. Before the fix there
 * was no way to discover an order to fulfil and no way to cancel one
 * (OrderRepository.cancelOrder was dead). All lookups are org-scoped
 * (FIX-007 / G-10 org-scope half).
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { listOrders } from './listOrders';
import { getOrder } from './getOrder';
import { cancelOrder } from './cancelOrder';
import { OrderRepository } from './repos/order.repo';
import { ValidationError, NotFoundError, ConflictError } from '@/core/errors';
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

function makeCtx(opts: { userId?: string; params?: Record<string, any>; query?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const params = opts.params ?? {};
  const query = opts.query ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => type === 'param' ? params : type === 'query' ? query : {} },
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

// ===========================================================================
// listOrders
// ===========================================================================

describe('listOrders (FIX-006 G-08)', () => {
  let capturedFilters: any;
  beforeEach(() => {
    capturedFilters = undefined;
    OrderRepository.prototype.findMany = mock(async (filters: any) => {
      capturedFilters = filters;
      return [makeOrder({ id: 'o-1' }), makeOrder({ id: 'o-2' })];
    }) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ query: {} });
    await expect(listOrders(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with the caller-org-scoped orders', async () => {
    const ctx = makeCtx({ query: {} });
    await listOrders(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data.length).toBe(2);
    expect(capturedFilters.organizationId).toBe('org-1');
  });

  test('forwards buyer/status query filters', async () => {
    const ctx = makeCtx({ query: { buyerPersonId: 'buyer-9', status: 'pending' } });
    await listOrders(ctx);
    expect(capturedFilters.buyerPersonId).toBe('buyer-9');
    expect(capturedFilters.status).toBe('pending');
  });
});

// ===========================================================================
// getOrder
// ===========================================================================

describe('getOrder (FIX-006 G-08)', () => {
  beforeEach(() => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder()) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { orderId: 'order-1' } });
    await expect(getOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with the order when it is in the caller org', async () => {
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await getOrder(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('order-1');
  });

  test('throws NotFoundError when the order does not exist', async () => {
    OrderRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { orderId: 'order-999' } });
    await expect(getOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when the order belongs to another org (org-scope)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ organizationId: 'org-OTHER' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(getOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ===========================================================================
// cancelOrder — wires the previously-dead OrderRepository.cancelOrder
// ===========================================================================

describe('cancelOrder (FIX-006 G-08)', () => {
  beforeEach(() => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'pending' })) as any;
    OrderRepository.prototype.cancelOrder = mock(async () => makeOrder({ status: 'cancelled' })) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('cancels a pending order (pending → cancelled)', async () => {
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await cancelOrder(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('cancelled');
  });

  test('cancels a confirmed order (confirmed → cancelled)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'confirmed' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await cancelOrder(ctx);
    const { status } = ctx._captured();
    expect(status).toBe(200);
  });

  test('throws ConflictError when the order is already fulfilled', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'fulfilled' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ConflictError when the order is already cancelled (terminal)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'cancelled' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws NotFoundError when the order does not exist', async () => {
    OrderRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { orderId: 'order-999' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when the order belongs to another org (org-scope)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ organizationId: 'org-OTHER' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
