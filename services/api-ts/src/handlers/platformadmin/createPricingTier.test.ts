/**
 * EM-M03-f9a0b1c2 — "Manage pricing: super only" (MODULE_SPEC permission matrix).
 * createPricingTier must reject non-super platform admins before any DB write.
 *
 * Extended: validation paths, happy path (201), slug normalization, currency default, 500 on failed insert.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createPricingTier } from './createPricingTier';
import { ValidationError } from '@/core/errors';

const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-user-1', role: 'super' };

// The handler calls logger.info/logger.error; makeCtx sets logger=null by default.
const stubLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => stubLogger,
};

function makeTier(overrides: Record<string, any> = {}) {
  return {
    id: 'tier-1',
    name: 'Pro',
    slug: 'pro',
    monthlyPrice: 1000,
    annualPrice: 10000,
    currency: 'PHP',
    maxMembers: null,
    trialDays: 30,
    features: [],
    isActive: true,
    sortOrder: 0,
    createdBy: 'admin-user-1',
    updatedBy: 'admin-user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInsertDb(insertedTier: any) {
  return {
    insert: () => ({
      values: (vals: any) => ({
        returning: async () => [{ ...insertedTier, ...vals }],
      }),
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
  };
}

function makeFailInsertDb() {
  return {
    insert: () => ({
      values: (_vals: any) => ({
        returning: async () => [],
      }),
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
  };
}

const validBody = { name: 'Pro', slug: 'pro', monthlyPrice: 1000, annualPrice: 10000 };

describe('[EM-M03-f9a0b1c2] createPricingTier — super-only', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: validBody });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller is support (not super)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'u-1', role: 'support' }, _body: validBody });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when caller is analyst (not super)', async () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1', userId: 'u-1', role: 'analyst' }, _body: validBody });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when no platformAdmin set', async () => {
    const ctx = makeCtx({ _body: validBody });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(403);
  });
});

describe('createPricingTier — validation', () => {
  test('throws ValidationError when slug missing', async () => {
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _body: { name: 'Pro', monthlyPrice: 1000, annualPrice: 10000 },
      database: makeInsertDb(makeTier()),
    });
    await expect(createPricingTier(ctx as any)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when monthlyPrice is negative', async () => {
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _body: { name: 'Pro', slug: 'pro', monthlyPrice: -1, annualPrice: 10000 },
      database: makeInsertDb(makeTier()),
    });
    await expect(createPricingTier(ctx as any)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when monthlyPrice is not a number', async () => {
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _body: { name: 'Pro', slug: 'pro', monthlyPrice: 'free', annualPrice: 10000 },
      database: makeInsertDb(makeTier()),
    });
    await expect(createPricingTier(ctx as any)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when annualPrice is negative', async () => {
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _body: { name: 'Pro', slug: 'pro', monthlyPrice: 1000, annualPrice: -1 },
      database: makeInsertDb(makeTier()),
    });
    await expect(createPricingTier(ctx as any)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('createPricingTier — happy path', () => {
  test('super admin creates tier → 201 with tier data', async () => {
    const tier = makeTier();
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _body: validBody,
      database: makeInsertDb(tier),
    });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(201);
    expect((res as any).body.data).toBeDefined();
    expect((res as any).body.data.slug).toBe('pro');
  });

  test('slug is lowercased and trimmed on insert', async () => {
    let capturedSlug: string | undefined;
    const db = {
      insert: () => ({
        values: (vals: any) => {
          capturedSlug = vals.slug;
          return { returning: async () => [{ id: 'tier-1', ...vals }] };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _body: { name: 'Premium', slug: '  PREMIUM  ', monthlyPrice: 2000, annualPrice: 20000 },
      database: db,
    });
    await createPricingTier(ctx as any);
    expect(capturedSlug).toBe('premium');
  });

  test('defaults currency to PHP when omitted', async () => {
    let capturedCurrency: string | undefined;
    const db = {
      insert: () => ({
        values: (vals: any) => {
          capturedCurrency = vals.currency;
          return { returning: async () => [{ id: 'tier-1', ...vals }] };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _body: validBody,
      database: db,
    });
    await createPricingTier(ctx as any);
    expect(capturedCurrency).toBe('PHP');
  });

  test('returns 500 when insert returns empty (DB failure)', async () => {
    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      logger: stubLogger,
      _body: validBody,
      database: makeFailInsertDb(),
    });
    const res = await createPricingTier(ctx as any);
    expect(res.status).toBe(500);
  });
});
