/**
 * Tests for marketplace listing and order handlers
 * Slice 045: Marketplace Vendor Management (M17)
 * BR-38: Verified vendor required for listings
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createListing } from './createListing';
import { listListings } from './listListings';
import { createOrder } from './createOrder';
import { fulfillOrder } from './fulfillOrder';
import { VendorRepository } from './repos/vendor.repo';
import { ListingRepository } from './repos/listing.repo';
import { OrderRepository } from './repos/order.repo';
import { ValidationError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
import type { Vendor, MarketplaceListing, MarketplaceOrder } from './repos/marketplace.schema';

// Mock-Classification: APPROPRIATE — marketplace with payment + inventory boundary
function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vendor-1', organizationId: 'org-1', companyName: 'Acme Medical',
    category: 'supplies', description: 'Medical supplies', verificationStatus: 'verified',
    contactEmail: 'vendor@acme.com', websiteUrl: null, contactPersonId: null,
    verifiedAt: new Date(), verifiedBy: 'admin-1',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Vendor;
}

function makeListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 'listing-1', organizationId: 'org-1', vendorId: 'vendor-1',
    title: 'Premium Stethoscope', description: 'High-quality stethoscope',
    price: '149.99', currency: 'USD', status: 'active', categoryTags: ['equipment'],
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'user-1', updatedBy: 'user-1', version: 1,
    ...overrides,
  } as unknown as MarketplaceListing;
}

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

function makeCtx(opts: { userId?: string; body?: Record<string, any>; params?: Record<string, any>; query?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const params = opts.params ?? {};
  const query = opts.query ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => type === 'json' ? body : type === 'param' ? params : type === 'query' ? query : {} },
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
// createListing (BR-38: requires verified vendor)
// ===========================================================================

describe('createListing', () => {
  beforeEach(() => {
    VendorRepository.prototype.findOneById = mock(async () => makeVendor({ verificationStatus: 'verified' })) as any;
    ListingRepository.prototype.createOne = mock(async (data: any) =>
      makeListing({ id: 'listing-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { vendorId: 'vendor-1', title: 'X', description: 'Y' } });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 with listing data for verified vendor', async () => {
    const ctx = makeCtx({ body: { vendorId: 'vendor-1', title: 'Widget', description: 'A widget' } });
    await createListing(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.title).toBe('Widget');
    expect(data.status).toBe('draft');
  });

  test('throws BusinessLogicError when vendor is not verified (BR-38)', async () => {
    VendorRepository.prototype.findOneById = mock(async () => makeVendor({ verificationStatus: 'pending' })) as any;
    const ctx = makeCtx({ body: { vendorId: 'vendor-1', title: 'Widget', description: 'A widget' } });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws NotFoundError when vendor does not exist', async () => {
    VendorRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ body: { vendorId: 'vendor-999', title: 'X', description: 'Y' } });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when title is missing', async () => {
    const ctx = makeCtx({ body: { vendorId: 'vendor-1', description: 'Y' } });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when vendorId is missing', async () => {
    const ctx = makeCtx({ body: { title: 'X', description: 'Y' } });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ===========================================================================
// listListings
// ===========================================================================

describe('listListings', () => {
  beforeEach(() => {
    ListingRepository.prototype.findMany = mock(async () => [
      makeListing({ id: 'l-1' }),
      makeListing({ id: 'l-2' }),
    ]) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ query: {} });
    await expect(listListings(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with paginated listings', async () => {
    const ctx = makeCtx({ query: {} });
    await listListings(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('l-1');
  });
});

// ===========================================================================
// createOrder
// ===========================================================================

describe('createOrder', () => {
  beforeEach(() => {
    ListingRepository.prototype.findOneById = mock(async () => makeListing()) as any;
    OrderRepository.prototype.createOne = mock(async (data: any) =>
      makeOrder({ id: 'order-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { listingId: 'listing-1' } });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 with order in pending status', async () => {
    const ctx = makeCtx({ body: { listingId: 'listing-1' } });
    await createOrder(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.status).toBe('pending');
    expect(data.listingId).toBe('listing-1');
  });

  test('throws NotFoundError when listing does not exist', async () => {
    ListingRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ body: { listingId: 'listing-999' } });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when listing is not active', async () => {
    ListingRepository.prototype.findOneById = mock(async () => makeListing({ status: 'archived' })) as any;
    const ctx = makeCtx({ body: { listingId: 'listing-1' } });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws ValidationError when listingId is missing', async () => {
    const ctx = makeCtx({ body: {} });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when quantity < 1', async () => {
    const ctx = makeCtx({ body: { listingId: 'listing-1', quantity: 0 } });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('calculates total price from listing price * quantity', async () => {
    const ctx = makeCtx({ body: { listingId: 'listing-1', quantity: 3 } });
    await createOrder(ctx);
    const { data } = ctx._captured();
    expect(data.totalPrice).toBe('449.97');
  });

  // FIX-005 (G-11): a listing with no price must NOT yield a silent ₱0 order.
  test('throws BusinessLogicError when listing has no price (null-price guard)', async () => {
    ListingRepository.prototype.findOneById = mock(async () => makeListing({ price: null })) as any;
    const ctx = makeCtx({ body: { listingId: 'listing-1' } });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // FIX-007 (G-10, org-scope half): a listing in another org must be unreachable.
  test('throws NotFoundError when listing belongs to another org (org-scope)', async () => {
    ListingRepository.prototype.findOneById = mock(async () =>
      makeListing({ organizationId: 'org-OTHER' })
    ) as any;
    const ctx = makeCtx({ body: { listingId: 'listing-1' } });
    await expect(createOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ===========================================================================
// fulfillOrder
// ===========================================================================

describe('fulfillOrder', () => {
  beforeEach(() => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder()) as any;
    OrderRepository.prototype.fulfillOrder = mock(async () =>
      makeOrder({ status: 'fulfilled', fulfilledAt: new Date() })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { orderId: 'order-1' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with fulfilled order status', async () => {
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await fulfillOrder(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('fulfilled');
    expect(data.fulfilledAt).toBeDefined();
  });

  test('throws NotFoundError when order does not exist', async () => {
    OrderRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { orderId: 'order-999' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError when order already fulfilled', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'fulfilled' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ConflictError when order is cancelled', async () => {
    OrderRepository.prototype.findOneById = mock(async () => makeOrder({ status: 'cancelled' })) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  // FIX-007 (G-10, org-scope half): an order in another org must be unreachable.
  test('throws NotFoundError when order belongs to another org (org-scope)', async () => {
    OrderRepository.prototype.findOneById = mock(async () =>
      makeOrder({ organizationId: 'org-OTHER' })
    ) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
