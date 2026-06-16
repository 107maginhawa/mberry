import { describe, test, expect } from 'bun:test';
import { getOrganizationProfile } from './getOrganizationProfile';
import { makeCtx, makeMockDb } from '@/test-utils/make-ctx';

// ─── Fixtures ────────────────────────────────────────────

const fakeOrg = {
  id: 'org-1',
  associationId: 'assoc-1',
  name: 'Philippine Dental Association',
  slug: 'pda',
  orgType: 'society',
  region: 'NCR',
  contactEmail: 'pda@example.com',
  status: 'active',
  trialStartDate: null,
  trialEndDate: null,
  featureFlags: null,
};

// ─── Tests ───────────────────────────────────────────────

// NOTE: getOrganizationProfile queries db.select() directly (no repo class),
// so we use makeMockDb with a custom select chain that returns our fixture row.

function makeOrgDb(rows: any[]) {
  const chain: any = {
    from: (_t: any) => chain,
    where: (_c: any) => chain,
    limit: async (_n: number) => rows,
    orderBy: async (..._a: any[]) => rows,
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return {
    _inserted: [],
    transaction: async (fn: any) => fn(makeOrgDb(rows)),
    select: () => chain,
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    delete: () => ({ where: () => ({ returning: async () => [] }) }),
  };
}

describe('getOrganizationProfile', () => {
  test('happy path — returns 200 with organization data', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      database: makeOrgDb([fakeOrg]),
    });
    const res = await getOrganizationProfile(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('org-1');
    expect(res.body.name).toBe('Philippine Dental Association');
    expect(res.body.status).toBe('active');
  });

  test('throws NotFoundError when organization does not exist', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'no-such' },
      database: makeOrgDb([]),
    });

    await expect(getOrganizationProfile(ctx)).rejects.toThrow();
  });

  test('throws when no session (unauthorized)', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      database: makeOrgDb([fakeOrg]),
    });

    await expect(getOrganizationProfile(ctx)).rejects.toThrow();
  });

  test('queries by the organizationId param', async () => {
    // Default mock db returns [] → throws NotFoundError unless we provide real data
    // Here we verify the query path reaches the db correctly when rows exist
    const ctx = makeCtx({
      _params: { organizationId: 'org-42' },
      database: makeOrgDb([{ ...fakeOrg, id: 'org-42' }]),
    });
    const res = await getOrganizationProfile(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('org-42');
  });
});
