/**
 * Tests for updateListing handler
 * FIX-003 (G-04): listing lifecycle transition (draft → active → archived).
 * Before the fix no endpoint moved a listing off 'draft', so the member buy
 * flow dead-ended (createOrder is active-only).
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { updateListing } from './updateListing';
import { ListingRepository } from './repos/listing.repo';
import { ValidationError, NotFoundError, ConflictError } from '@/core/errors';
import type { MarketplaceListing } from './repos/marketplace.schema';

function makeListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 'listing-1', organizationId: 'org-1', vendorId: 'vendor-1',
    title: 'Premium Stethoscope', description: 'High-quality stethoscope',
    price: '149.99', currency: 'USD', status: 'draft', categoryTags: ['equipment'],
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'user-1', updatedBy: 'user-1', version: 1,
    ...overrides,
  } as unknown as MarketplaceListing;
}

function makeCtx(opts: { userId?: string; body?: Record<string, any>; params?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => type === 'param' ? params : type === 'json' ? body : {} },
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

describe('updateListing (FIX-003 G-04)', () => {
  beforeEach(() => {
    ListingRepository.prototype.findOneById = mock(async () => makeListing({ status: 'draft' })) as any;
    ListingRepository.prototype.updateOneById = mock(async (_id: string, data: any) =>
      makeListing({ ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { listingId: 'listing-1' }, body: { status: 'active' } });
    await expect(updateListing(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('activates a draft listing (draft → active)', async () => {
    const ctx = makeCtx({ params: { listingId: 'listing-1' }, body: { status: 'active' } });
    await updateListing(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('active');
  });

  test('archives an active listing (active → archived)', async () => {
    ListingRepository.prototype.findOneById = mock(async () => makeListing({ status: 'active' })) as any;
    const ctx = makeCtx({ params: { listingId: 'listing-1' }, body: { status: 'archived' } });
    await updateListing(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('archived');
  });

  test('throws ConflictError on an invalid transition (draft → archived)', async () => {
    const ctx = makeCtx({ params: { listingId: 'listing-1' }, body: { status: 'archived' } });
    await expect(updateListing(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws NotFoundError when the listing does not exist', async () => {
    ListingRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { listingId: 'listing-999' }, body: { status: 'active' } });
    await expect(updateListing(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when the listing belongs to another org (org-scope)', async () => {
    ListingRepository.prototype.findOneById = mock(async () =>
      makeListing({ organizationId: 'org-OTHER' })
    ) as any;
    const ctx = makeCtx({ params: { listingId: 'listing-1' }, body: { status: 'active' } });
    await expect(updateListing(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('updates editable fields without a status change', async () => {
    const ctx = makeCtx({ params: { listingId: 'listing-1' }, body: { title: 'Renamed' } });
    await updateListing(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.title).toBe('Renamed');
  });

  test('throws ValidationError when no updatable fields are provided', async () => {
    const ctx = makeCtx({ params: { listingId: 'listing-1' }, body: {} });
    await expect(updateListing(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
