/**
 * Co-located unit tests for cancelOrder.
 *
 * Path: POST /association/marketplace/orders/:orderId/cancel
 * Drives MARKETPLACE_ORDER_VALID_TRANSITIONS (pending|confirmed → cancelled),
 * org-scoping, and the user/auth guard. Mocking mirrors the aggregated
 * sibling suite (order-discovery.test.ts): bun:test + a hand-built ctx +
 * OrderRepository.prototype stubs (no real DB).
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
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

function makeCtx(opts: { userId?: string; params?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => (type === 'param' ? params : {}) },
    json: (data: any, status: number) => { captured = { data, status }; return new Response(JSON.stringify(data), { status }); },
    _captured: () => captured,
  };
  return ctx as any;
}

function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => (key === 'user' ? { id: '', name: '' } : origGet(key));
  return ctx;
}

describe('cancelOrder', () => {
  let cancelArgs: { orderId?: string; userId?: string };
  beforeEach(() => {
    cancelArgs = {};
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'pending' })) as any;
    OrderRepository.prototype.cancelOrder = mock(async (orderId: string, userId: string) => {
      cancelArgs = { orderId, userId };
      return makeOrder({ id: orderId, status: 'cancelled', updatedBy: userId });
    }) as any;
  });

  test('throws ValidationError without a valid user', async () => {
    const ctx = makeNoUserCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('cancels a pending order and returns 200 with cancelled status', async () => {
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await cancelOrder(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('cancelled');
    // repo.cancelOrder must be driven with the path orderId + acting user id
    expect(cancelArgs.orderId).toBe('order-1');
    expect(cancelArgs.userId).toBe('user-1');
  });

  test('cancels a confirmed order (confirmed → cancelled)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'confirmed' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await cancelOrder(ctx);
    expect(ctx._captured().status).toBe(200);
  });

  test('throws ConflictError when the order is already fulfilled (invalid transition)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'fulfilled' })) as any;
    const cancelSpy = mock(async () => makeOrder({ status: 'cancelled' }));
    OrderRepository.prototype.cancelOrder = cancelSpy as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(ConflictError);
    // guard must short-circuit before mutating the repo
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  test('throws NotFoundError when the order does not exist', async () => {
    OrderRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { orderId: 'order-999' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when the order belongs to another org (org-scope guard)', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ organizationId: 'org-OTHER' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(cancelOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
