/**
 * Tests for marketplace handlers — vendor CRUD, product listings,
 * order lifecycle, vendor permissions.
 *
 * Slice 045: Marketplace Vendor Management (M17, stabilize)
 *
 * Business rules:
 *   BR-38: Vendor must be verified before listings visible
 *   M17-R1: Active membership required
 *   M17-R3: Suspended vendor hides listings, preserves data
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

import { createVendor } from './createVendor';
import { getVendor } from './getVendor';
import { listVendors } from './listVendors';
import { updateVendor } from './updateVendor';
import { verifyVendor } from './verifyVendor';
import { createListing } from './createListing';
import { listListings } from './listListings';
import { createOrder } from './createOrder';
import { fulfillOrder } from './fulfillOrder';

import { VendorRepository } from './repos/vendor.repo';
import { ListingRepository } from './repos/listing.repo';
import { OrderRepository } from './repos/order.repo';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from '@/core/errors';
import type { Vendor, MarketplaceListing, MarketplaceOrder } from './repos/marketplace.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vendor-1',
    organizationId: 'org-1',
    companyName: 'Acme Medical',
    category: 'supplies',
    description: 'Medical supplies vendor',
    verificationStatus: 'verified',
    contactEmail: 'vendor@acme.com',
    websiteUrl: 'https://acme.com',
    contactPersonId: null,
    verifiedAt: new Date(),
    verifiedBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    version: 1,
    ...overrides,
  } as unknown as Vendor;
}

function makeListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 'listing-1',
    organizationId: 'org-1',
    vendorId: 'vendor-1',
    title: 'Premium Stethoscope',
    description: 'High-quality stethoscope',
    price: '149.99',
    currency: 'USD',
    status: 'active',
    categoryTags: ['equipment'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as MarketplaceListing;
}

function makeOrder(overrides: Partial<MarketplaceOrder> = {}): MarketplaceOrder {
  return {
    id: 'order-1',
    organizationId: 'org-1',
    listingId: 'listing-1',
    buyerPersonId: 'user-1',
    vendorId: 'vendor-1',
    quantity: 1,
    totalPrice: '149.99',
    status: 'pending',
    notes: null,
    fulfilledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as MarketplaceOrder;
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  userId?: string;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  organizationId?: string;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const query = opts.query ?? {};
  const params = opts.params ?? {};
  const organizationId = opts.organizationId ?? 'org-1';
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: userId ? { id: userId, name: 'Test User' } : null,
        database: {},
        logger,
        organizationId,
      };
      return store[key];
    },
    req: {
      valid: (type: string) => {
        if (type === 'param') return params;
        if (type === 'json') return body;
        if (type === 'query') return query;
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => {
    if (key === 'user') return { id: '', name: '' };
    return origGet(key);
  };
  return ctx;
}

// ===========================================================================
// createVendor
// ===========================================================================

describe('createVendor', () => {
  beforeEach(() => {
    VendorRepository.prototype.createOne = mock(async (data: any) =>
      makeVendor({ id: 'vendor-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { companyName: 'X', contactEmail: 'x@x.com', category: 'emr', description: 'desc' } });
    await expect(createVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when creating a vendor', async () => {
    const ctx = makeCtx({
      body: { companyName: 'Acme', contactEmail: 'v@acme.com', category: 'supplies', description: 'desc' },
    });
    await createVendor(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.companyName).toBe('Acme');
    expect(data.verificationStatus).toBe('pending');
  });

  test('throws ValidationError when companyName is missing', async () => {
    const ctx = makeCtx({ body: { contactEmail: 'v@x.com', category: 'emr', description: 'desc' } });
    await expect(createVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when contactEmail is missing', async () => {
    const ctx = makeCtx({ body: { companyName: 'X', category: 'emr', description: 'desc' } });
    await expect(createVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when category is missing', async () => {
    const ctx = makeCtx({ body: { companyName: 'X', contactEmail: 'x@x.com', description: 'desc' } });
    await expect(createVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when description is missing', async () => {
    const ctx = makeCtx({ body: { companyName: 'X', contactEmail: 'x@x.com', category: 'emr' } });
    await expect(createVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('new vendor starts with pending status', async () => {
    const ctx = makeCtx({
      body: { companyName: 'X', contactEmail: 'x@x.com', category: 'emr', description: 'desc' },
    });
    await createVendor(ctx);

    const { data } = ctx._captured();
    expect(data.verificationStatus).toBe('pending');
  });
});

// ===========================================================================
// getVendor
// ===========================================================================

describe('getVendor', () => {
  beforeEach(() => {
    VendorRepository.prototype.findOneById = mock(async () => makeVendor()) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { vendorId: 'vendor-1' } });
    await expect(getVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with vendor data', async () => {
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await getVendor(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('vendor-1');
  });

  test('throws NotFoundError when vendor does not exist', async () => {
    VendorRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-999' } });
    await expect(getVendor(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ===========================================================================
// listVendors
// ===========================================================================

describe('listVendors', () => {
  beforeEach(() => {
    VendorRepository.prototype.findMany = mock(async () => [
      makeVendor({ id: 'v-1' }),
      makeVendor({ id: 'v-2' }),
    ]) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ query: {} });
    await expect(listVendors(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with paginated vendors', async () => {
    const ctx = makeCtx({ query: {} });
    await listVendors(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
    expect(data.data.length).toBe(2);
  });
});

// ===========================================================================
// updateVendor
// ===========================================================================

describe('updateVendor', () => {
  beforeEach(() => {
    VendorRepository.prototype.findOneById = mock(async () => makeVendor()) as any;
    VendorRepository.prototype.updateOneById = mock(async (_id: string, updates: any) =>
      makeVendor(updates)
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { vendorId: 'vendor-1' }, body: { companyName: 'New' } });
    await expect(updateVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with updated vendor', async () => {
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: { companyName: 'Updated Co' } });
    await updateVendor(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.companyName).toBe('Updated Co');
  });

  test('throws NotFoundError when vendor does not exist', async () => {
    VendorRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-999' }, body: { companyName: 'X' } });
    await expect(updateVendor(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ===========================================================================
// verifyVendor (BR-38: vendor must be verified by admin)
// ===========================================================================

describe('verifyVendor', () => {
  beforeEach(() => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    VendorRepository.prototype.verifyVendor = mock(async () =>
      makeVendor({ verificationStatus: 'verified', verifiedBy: 'user-1' })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { vendorId: 'vendor-1' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with verified vendor', async () => {
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await verifyVendor(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('verified');
  });

  test('throws NotFoundError when vendor does not exist', async () => {
    VendorRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-999' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when vendor is already verified', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'verified' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});

// ===========================================================================
// createListing (BR-38: requires verified vendor)
// ===========================================================================

describe('createListing', () => {
  beforeEach(() => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'verified' })
    ) as any;
    ListingRepository.prototype.createOne = mock(async (data: any) =>
      makeListing({ id: 'listing-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({
      body: { vendorId: 'vendor-1', title: 'X', description: 'Y' },
    });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when creating a listing for verified vendor', async () => {
    const ctx = makeCtx({
      body: { vendorId: 'vendor-1', title: 'Widget', description: 'A widget' },
    });
    await createListing(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.title).toBe('Widget');
  });

  test('throws BusinessLogicError when vendor is not verified (BR-38)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;

    const ctx = makeCtx({
      body: { vendorId: 'vendor-1', title: 'Widget', description: 'A widget' },
    });
    await expect(createListing(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws NotFoundError when vendor does not exist', async () => {
    VendorRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({
      body: { vendorId: 'vendor-999', title: 'X', description: 'Y' },
    });
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

  test('listing starts in draft status', async () => {
    const ctx = makeCtx({
      body: { vendorId: 'vendor-1', title: 'Widget', description: 'A widget' },
    });
    await createListing(ctx);

    const { data } = ctx._captured();
    expect(data.status).toBe('draft');
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
  });
});

// ===========================================================================
// createOrder — order lifecycle
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

  test('returns 201 when placing an order', async () => {
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
    ListingRepository.prototype.findOneById = mock(async () =>
      makeListing({ status: 'archived' })
    ) as any;
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
});

// ===========================================================================
// fulfillOrder — order lifecycle
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

  test('returns 200 with fulfilled order', async () => {
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await fulfillOrder(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('fulfilled');
  });

  test('throws NotFoundError when order does not exist', async () => {
    OrderRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { orderId: 'order-999' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when order already fulfilled', async () => {
    OrderRepository.prototype.findOneById = mock(async () =>
      makeOrder({ status: 'fulfilled' })
    ) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when order is cancelled', async () => {
    OrderRepository.prototype.findOneById = mock(async () =>
      makeOrder({ status: 'cancelled' })
    ) as any;
    const ctx = makeCtx({ params: { orderId: 'order-1' } });
    await expect(fulfillOrder(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
