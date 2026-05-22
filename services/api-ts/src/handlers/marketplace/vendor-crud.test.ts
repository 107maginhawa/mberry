/**
 * Tests for marketplace vendor CRUD handlers
 * Slice 045: Marketplace Vendor Management (M17)
 * BR-38: Vendor must be verified by admin
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createVendor } from './createVendor';
import { getVendor } from './getVendor';
import { listVendors } from './listVendors';
import { updateVendor } from './updateVendor';
import { VendorRepository } from './repos/vendor.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { Vendor } from './repos/marketplace.schema';

// Mock-Classification: APPROPRIATE — marketplace with payment gateway boundary
function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vendor-1', organizationId: 'org-1', companyName: 'Acme Medical',
    category: 'supplies', description: 'Medical supplies vendor',
    verificationStatus: 'verified', contactEmail: 'vendor@acme.com',
    websiteUrl: 'https://acme.com', contactPersonId: null,
    verifiedAt: new Date(), verifiedBy: 'admin-1',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'admin-1', updatedBy: 'admin-1', version: 1,
    ...overrides,
  } as unknown as Vendor;
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

  test('returns 201 with vendor data and pending status', async () => {
    const ctx = makeCtx({ body: { companyName: 'Acme', contactEmail: 'v@acme.com', category: 'supplies', description: 'desc' } });
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
    expect(data.companyName).toBe('Acme Medical');
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

  test('returns 200 with vendors list and pagination', async () => {
    const ctx = makeCtx({ query: {} });
    await listVendors(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('v-1');
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
