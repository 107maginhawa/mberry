/**
 * Co-located unit tests for the listOrders handler.
 *
 * Path: GET /association/marketplace/orders (FIX-006 G-08 / FIX-007 G-10).
 * Mirrors the mocking/setup style of the sibling order-discovery.test.ts:
 * stub OrderRepository.prototype.findMany, drive the real handler with a
 * hand-built Hono-shaped Context, and assert on the captured Response.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { listOrders } from './listOrders';
import { OrderRepository } from './repos/order.repo';
import { ValidationError } from '@/core/errors';
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

describe('listOrders (FIX-006 G-08)', () => {
  let capturedFilters: any;
  let capturedOptions: any;

  beforeEach(() => {
    capturedFilters = undefined;
    capturedOptions = undefined;
    OrderRepository.prototype.findMany = mock(async (filters: any, options: any) => {
      capturedFilters = filters;
      capturedOptions = options;
      return [makeOrder({ id: 'o-1' }), makeOrder({ id: 'o-2' })];
    }) as any;
  });

  test('throws ValidationError without a valid user', async () => {
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

  test('forwards buyer/vendor/status query filters to the repo', async () => {
    const ctx = makeCtx({ query: { buyerPersonId: 'buyer-9', vendorId: 'vendor-7', status: 'pending' } });
    await listOrders(ctx);
    expect(capturedFilters.buyerPersonId).toBe('buyer-9');
    expect(capturedFilters.vendorId).toBe('vendor-7');
    expect(capturedFilters.status).toBe('pending');
  });

  test('defaults pagination to limit 20 / offset 0 when unspecified', async () => {
    const ctx = makeCtx({ query: {} });
    await listOrders(ctx);
    const { data } = ctx._captured();
    expect(capturedOptions.pagination).toEqual({ limit: 20, offset: 0 });
    expect(data.pagination).toEqual({ limit: 20, offset: 0 });
  });

  test('clamps the requested limit to a maximum of 100', async () => {
    const ctx = makeCtx({ query: { limit: '500', offset: '40' } });
    await listOrders(ctx);
    const { data } = ctx._captured();
    expect(capturedOptions.pagination.limit).toBe(100);
    expect(capturedOptions.pagination.offset).toBe(40);
    expect(data.pagination).toEqual({ limit: 100, offset: 40 });
  });
});
