/**
 * EM-M03-f9a0b1c2 — "Manage pricing: super only" (MODULE_SPEC permission matrix).
 * updatePricingTier must reject non-super platform admins before any DB write.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updatePricingTier } from './updatePricingTier';

describe('[EM-M03-f9a0b1c2] updatePricingTier — super-only', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { tierId: 'tier-1' }, _body: { name: 'X' } });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller is support (not super)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'u-1', role: 'support' }, _params: { tierId: 'tier-1' }, _body: { name: 'X' } });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when caller is analyst (not super)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'u-1', role: 'analyst' }, _params: { tierId: 'tier-1' }, _body: { name: 'X' } });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(403);
  });
});
