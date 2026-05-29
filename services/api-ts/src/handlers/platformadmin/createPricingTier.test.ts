/**
 * EM-M03-f9a0b1c2 — "Manage pricing: super only" (MODULE_SPEC permission matrix).
 * createPricingTier must reject non-super platform admins before any DB write.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createPricingTier } from './createPricingTier';

const body = { name: 'Pro', slug: 'pro', monthlyPrice: 1000, annualPrice: 10000 };

describe('[EM-M03-f9a0b1c2] createPricingTier — super-only', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: body });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller is support (not super)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'u-1', role: 'support' }, _body: body });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when caller is analyst (not super)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'u-1', role: 'analyst' }, _body: body });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(403);
  });
});
