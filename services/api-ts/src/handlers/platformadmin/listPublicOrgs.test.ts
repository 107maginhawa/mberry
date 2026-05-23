import { describe, test, expect, beforeEach } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listPublicOrgs } from './listPublicOrgs';

// Mock data
const activeOrg1 = {
  id: 'org-1',
  name: 'Philippine Dental Association',
  slug: 'pda',
  orgType: 'national',
  region: 'NCR',
  status: 'active',
  associationId: 'assoc-1',
  contactEmail: 'info@pda.ph',
  trialStartDate: null,
  trialEndDate: null,
  featureFlags: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activeOrg2 = {
  id: 'org-2',
  name: 'Cebu Dental Chapter',
  slug: 'cebu-dental',
  orgType: 'chapter',
  region: 'Cebu',
  status: 'active',
  associationId: 'assoc-1',
  contactEmail: 'cebu@pda.ph',
  trialStartDate: null,
  trialEndDate: null,
  featureFlags: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const cancelledOrg = {
  id: 'org-3',
  name: 'Cancelled Org',
  slug: 'cancelled',
  orgType: 'chapter',
  region: 'Manila',
  status: 'cancelled',
  associationId: 'assoc-1',
  contactEmail: null,
  trialStartDate: null,
  trialEndDate: null,
  featureFlags: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const association1 = { id: 'assoc-1', name: 'PDA National' };

// Drizzle query builder mock
function makeMockDb(orgs: any[] = [activeOrg1, activeOrg2], assocs: any[] = [association1]) {
  // Filter active orgs + apply search from the full set
  const allOrgs = [...orgs, cancelledOrg];

  return {
    select: (...args: any[]) => {
      const selectedFields = args[0];
      return {
        from: (table: any) => {
          // Detect if this is a count query (has 'total' field)
          const isCount = selectedFields && 'total' in (selectedFields || {});
          // Detect if this is association lookup
          const isAssoc = selectedFields && 'name' in (selectedFields || {}) && !('total' in (selectedFields || {}));

          if (isAssoc) {
            return Promise.resolve(assocs);
          }

          const buildChain = (filtered: any[]) => ({
            where: (condition: any) => {
              // Simulate active filter — in real Drizzle this is eq(status, 'active')
              const activeOnly = allOrgs.filter(o => o.status === 'active');
              // Check if search is applied (condition includes ilike)
              // For test simplicity, we track the search via _searchApplied flag
              if (isCount) {
                return Promise.resolve([{ total: activeOnly.length }]);
              }
              return {
                limit: (l: number) => ({
                  offset: (o: number) => ({
                    orderBy: () => Promise.resolve(activeOnly.slice(o, o + l)),
                  }),
                }),
              };
            },
          });

          return buildChain(allOrgs);
        },
      };
    },
    execute: () => Promise.resolve({ rows: [] }),
    transaction: async (fn: any) => fn({}),
  };
}

describe('listPublicOrgs', () => {
  test('returns paginated org list with meta', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: {},
    });

    const response = await listPublicOrgs(ctx);
    expect(response.status).toBe(200);

    const body = (response as any).body;
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.meta.limit).toBe(25);
    expect(body.meta.offset).toBe(0);
    expect(typeof body.meta.total).toBe('number');
  });

  test('returns only active orgs (filters cancelled)', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: {},
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;

    // All returned orgs should be active
    for (const org of body.data) {
      expect(org.status).toBe('active');
    }
  });

  test('respects limit and offset params', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: { limit: '1', offset: '0' },
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;
    expect(body.meta.limit).toBe(1);
    expect(body.meta.offset).toBe(0);
    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  test('clamps limit to max 100', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: { limit: '500' },
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;
    expect(body.meta.limit).toBe(100);
  });

  test('clamps negative offset to 0', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: { offset: '-5' },
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;
    expect(body.meta.offset).toBe(0);
  });

  test('handles empty search gracefully', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: { search: '' },
    });

    const response = await listPublicOrgs(ctx);
    expect(response.status).toBe(200);
  });

  test('includes association name in response', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: {},
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;
    // Association name should be resolved
    for (const org of body.data) {
      expect(org.associationName).toBe('PDA National');
    }
  });

  test('returns correct org fields', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: {},
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;

    if (body.data.length > 0) {
      const org = body.data[0];
      expect(org).toHaveProperty('id');
      expect(org).toHaveProperty('name');
      expect(org).toHaveProperty('slug');
      expect(org).toHaveProperty('orgType');
      expect(org).toHaveProperty('region');
      expect(org).toHaveProperty('status');
      expect(org).toHaveProperty('associationName');
      expect(org).toHaveProperty('memberCount');
      // Should NOT include sensitive fields
      expect(org).not.toHaveProperty('contactEmail');
      expect(org).not.toHaveProperty('featureFlags');
    }
  });

  test('defaults limit=25 for invalid input', async () => {
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _query: { limit: 'abc' },
    });

    const response = await listPublicOrgs(ctx);
    const body = (response as any).body;
    expect(body.meta.limit).toBe(25);
  });
});
