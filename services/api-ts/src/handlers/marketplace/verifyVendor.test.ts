/**
 * Tests for verifyVendor handler
 * Slice 045: Marketplace Vendor Management (M17)
 *
 * RULE (local label): Vendor must be verified by an admin/officer before its
 * listings are visible — the vendor verification lifecycle gate.
 *
 * NOTE: earlier revisions tagged this "BR-38", but registry BR-38 is the
 * deferred billing rule "Marketplace Referral Disclosure" (br-registry.json),
 * NOT vendor verification. The 'BR-38' references below are a stale local label,
 * not the registry BR-38 — kept descriptive only to avoid registry confusion.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { verifyVendor } from './verifyVendor';
import { VendorRepository } from './repos/vendor.repo';
import { ValidationError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
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

function makeCtx(opts: { userId?: string; params?: Record<string, any>; body?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const params = opts.params ?? {};
  const body = opts.body ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
    set: (_key: string, _val: any) => {},
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

describe('verifyVendor (vendor verification gate — local label, not registry BR-38)', () => {
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

  test('throws ConflictError when vendor is already verified (FSM guard)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'verified' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('verifyVendor — MARKETPLACE_VENDOR_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    VendorRepository.prototype.verifyVendor = mock(async () =>
      makeVendor({ verificationStatus: 'verified', verifiedBy: 'user-1', verifiedAt: new Date() })
    ) as any;
  });

  test('throws ConflictError when verifying a rejected vendor (terminal)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'rejected' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ConflictError when verifying a suspended vendor (must go verified)', async () => {
    // suspended -> verified is allowed; this exercises the success-side path
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'suspended' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    // suspended -> verified IS allowed per FSM: should NOT throw
    await verifyVendor(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('verified');
  });

  test('allows pending -> verified (happy path)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' } });
    await verifyVendor(ctx);
    const { status } = ctx._captured();
    expect(status).toBe(200);
  });
});

// ===========================================================================
// FIX-004 (G-05): decision-based vendor review — reject / suspend reachable.
// Before the fix the handler hardcoded the 'verified' target, so a reject or
// suspend request silently landed the vendor in 'verified' (approve-only
// theater). These assert the requested transition is honored.
// ===========================================================================

describe('verifyVendor — decision-based review (FIX-004 G-05)', () => {
  beforeEach(() => {
    (VendorRepository.prototype as any).verifyVendor = mock(async () =>
      makeVendor({ verificationStatus: 'verified', verifiedBy: 'user-1', verifiedAt: new Date() })
    );
    (VendorRepository.prototype as any).rejectVendor = mock(async () =>
      makeVendor({ verificationStatus: 'rejected', updatedBy: 'user-1' })
    );
    (VendorRepository.prototype as any).suspendVendor = mock(async () =>
      makeVendor({ verificationStatus: 'suspended', updatedBy: 'user-1' })
    );
  });

  test('decision "rejected" transitions a pending vendor to rejected', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: { decision: 'rejected' } });
    await verifyVendor(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('rejected');
  });

  test('decision "suspended" transitions a verified vendor to suspended', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'verified' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: { decision: 'suspended' } });
    await verifyVendor(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('suspended');
  });

  test('decision "verified" (explicit) approves a pending vendor', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: { decision: 'verified' } });
    await verifyVendor(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('verified');
  });

  test('omitted decision defaults to verified (backward compatible)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: {} });
    await verifyVendor(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.verificationStatus).toBe('verified');
  });

  test('rejects an invalid transition (suspend a pending vendor → 409)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: { decision: 'suspended' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('rejects an unknown decision value (400)', async () => {
    VendorRepository.prototype.findOneById = mock(async () =>
      makeVendor({ verificationStatus: 'pending' })
    ) as any;
    const ctx = makeCtx({ params: { vendorId: 'vendor-1' }, body: { decision: 'banished' } });
    await expect(verifyVendor(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
