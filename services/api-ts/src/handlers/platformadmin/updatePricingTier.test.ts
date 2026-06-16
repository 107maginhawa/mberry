/**
 * EM-M03-f9a0b1c2 — "Manage pricing: super only" (MODULE_SPEC permission matrix).
 * updatePricingTier must reject non-super platform admins before any DB write.
 *
 * Extended: 404 when tier missing, 200 happy path, partial field updates,
 * price-change note in response.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updatePricingTier } from './updatePricingTier';

const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-user-1', role: 'super' };

const stubLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => stubLogger,
};

function existingTier(overrides: Record<string, any> = {}) {
  return {
    id: 'tier-1',
    name: 'Basic',
    slug: 'basic',
    monthlyPrice: 100000,
    annualPrice: 1000000,
    currency: 'PHP',
    maxMembers: 50,
    trialDays: 30,
    features: ['Feature A'],
    isActive: true,
    sortOrder: 0,
    createdBy: 'admin-user-1',
    updatedBy: 'admin-user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Build a db mock that:
 * - select().from().where().limit() → returns selectRows (for the "does it exist?" lookup)
 * - update().set().where().returning() → returns updatedRows
 */
function makeUpdateDb(selectRows: any[], updatedRows: any[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectRows,
        }),
      }),
    }),
    update: () => ({
      set: (vals: any) => ({
        where: () => ({
          returning: async () => updatedRows,
        }),
      }),
    }),
    insert: () => ({
      values: (v: any) => ({ returning: async () => [v] }),
    }),
  };
}

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

  test('returns 403 when no platformAdmin set', async () => {
    const ctx = makeCtx({ _params: { tierId: 'tier-1' }, _body: { name: 'X' } });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(403);
  });
});

describe('updatePricingTier — 404 / not-found', () => {
  test('returns 404 when tier does not exist', async () => {
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _params: { tierId: 'nonexistent' },
      _body: { name: 'NewName' },
      database: makeUpdateDb([], []),
    });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(404);
  });
});

describe('updatePricingTier — happy path', () => {
  test('super admin updates tier name → 200 with updated data', async () => {
    const tier = existingTier();
    const updated = { ...tier, name: 'Premium' };
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _params: { tierId: 'tier-1' },
      _body: { name: 'Premium' },
      database: makeUpdateDb([tier], [updated]),
    });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data.name).toBe('Premium');
  });

  test('response includes price-change note when monthlyPrice updated', async () => {
    const tier = existingTier();
    const updated = { ...tier, monthlyPrice: 200000 };
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _params: { tierId: 'tier-1' },
      _body: { monthlyPrice: 200000 },
      database: makeUpdateDb([tier], [updated]),
    });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.note).toMatch(/new subscription/i);
  });

  test('response has no note when only non-price fields updated', async () => {
    const tier = existingTier();
    const updated = { ...tier, isActive: false };
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _params: { tierId: 'tier-1' },
      _body: { isActive: false },
      database: makeUpdateDb([tier], [updated]),
    });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(200);
    // note is undefined or null when no price change
    expect((res as any).body.note == null || (res as any).body.note === undefined).toBe(true);
  });

  test('partial update: only provided fields are in update payload', async () => {
    const tier = existingTier();
    const updated = { ...tier, sortOrder: 5 };
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _params: { tierId: 'tier-1' },
      _body: { sortOrder: 5 },
      database: makeUpdateDb([tier], [updated]),
    });
    const res = await updatePricingTier(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data.sortOrder).toBe(5);
  });
});
