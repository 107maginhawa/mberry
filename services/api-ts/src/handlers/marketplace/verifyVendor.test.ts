/**
 * Tests for verifyVendor handler
 * Slice 045: Marketplace Vendor Management (M17)
 * BR-38: Vendor must be verified by admin before listings visible
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { verifyVendor } from './verifyVendor';
import { VendorRepository } from './repos/vendor.repo';
import { ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { Vendor } from './repos/marketplace.schema';

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vendor-1', organizationId: 'org-1', companyName: 'Acme Medical',
    category: 'supplies', description: 'Medical supplies vendor',
    verificationStatus: 'pending', contactEmail: 'vendor@acme.com',
    websiteUrl: null, contactPersonId: null,
    verifiedAt: null, verifiedBy: null,
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'user-1', updatedBy: 'user-1', version: 1,
    ...overrides,
  } as unknown as Vendor;
}

function makeCtx(opts: { userId?: string; params?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    req: { valid: (type: string) => type === 'param' ? params : {} },
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

describe('verifyVendor (BR-38)', () => {
  beforeEach(() => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    VendorRepository.prototype.verifyVendor = mock(async () =>
      makeVendor({ verificationStatus: 'verified', verifiedBy: 'user-1', verifiedAt: new Date() })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { vendorId: 'vendor-1' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with verified vendor status', async () => {
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await verifyVendor(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('verified');
    expect(data.verifiedBy).toBe('user-1');
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
