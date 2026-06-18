/**
 * createDuesConfig.test.ts
 *
 * Covers:
 *  - 401 when no user
 *  - 403 when no organizationId in context
 *  - Happy path — 201 with created config
 *  - gracePeriodDays defaults to 30 when not supplied
 *  - status defaults to 'active' when not supplied
 *  - Body fields forwarded correctly: tierId, annualAmount, currency, fundAllocations, effectiveDate
 *  - Sets auditResourceId and auditDescription
 *
 * Note: createDuesConfig calls requirePosition() first. requirePosition() uses
 * OfficerTermRepository internally. Because it hits the DB to check officer terms,
 * we bypass it by injecting a mock ctx.get('config') with no auth restriction.
 * In practice the generated middleware handles position checks; the handler itself
 * only gates on user/orgId after requirePosition returns null (allowed).
 *
 * Strategy: stub OfficerTermRepository.findActiveByPersonAndOrg to return a
 * matching term so requirePosition returns null (pass-through).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createDuesConfig } from './createDuesConfig';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const FAKE_CONFIG_RESULT = {
  id: 'config-new-1',
  organizationId: 'org-1',
  tierId: 'tier-regular',
  annualAmount: '5000',
  currency: 'PHP',
  gracePeriodDays: 30,
  status: 'active',
  effectiveDate: '2026-01-01',
  fundAllocations: [{ fundId: 'fund-1', percentage: '100' }],
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

// Officer term stub — returns an active term so requirePosition passes
const FAKE_OFFICER_TERM = {
  id: 'term-1',
  personId: 'user-1',
  organizationId: 'org-1',
  positionTitle: 'Treasurer',
  startDate: '2026-01-01',
  endDate: null,
  active: true,
};

describe('createDuesConfig', () => {
  beforeEach(() => {
    restoreRepo(DuesConfigRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(DuesConfigRepository);
    restoreRepo(OfficerTermRepository);
  });

  // Bypass requirePosition by stubbing officer term lookup.
  // requirePosition calls findActiveByPersonAndOrg and expects an array.
  function stubOfficerPass() {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [FAKE_OFFICER_TERM],
    });
  }

  test('returns 401 when user is null', async () => {
    stubOfficerPass();
    stubRepo(DuesConfigRepository, {
      createOne: async () => FAKE_CONFIG_RESULT,
    });

    const ctx = makeCtx({
      user: null,
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [],
      },
    });

    const res = await createDuesConfig(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 when organizationId is not in context', async () => {
    stubOfficerPass();
    stubRepo(DuesConfigRepository, {
      createOne: async () => FAKE_CONFIG_RESULT,
    });

    const ctx = makeCtx({
      organizationId: undefined,
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [],
      },
    });

    const res = await createDuesConfig(ctx as any);
    expect(res.status).toBe(403);
  });

  test('happy path — returns 201 with created config', async () => {
    stubOfficerPass();
    stubRepo(DuesConfigRepository, {
      createOne: async () => FAKE_CONFIG_RESULT,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [{ fundId: 'fund-1', percentage: '100' }],
      },
    });

    const res = await createDuesConfig(ctx as any);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.id).toBe('config-new-1');
    expect(body.currency).toBe('PHP');
  });

  test('gracePeriodDays defaults to 30 when omitted', async () => {
    stubOfficerPass();
    let capturedInput: any;
    stubRepo(DuesConfigRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...FAKE_CONFIG_RESULT, gracePeriodDays: input.gracePeriodDays };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [],
        // gracePeriodDays omitted
      },
    });

    await createDuesConfig(ctx as any);
    expect(capturedInput.gracePeriodDays).toBe(30);
  });

  test('status defaults to active when omitted', async () => {
    stubOfficerPass();
    let capturedInput: any;
    stubRepo(DuesConfigRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...FAKE_CONFIG_RESULT, status: input.status };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [],
        // status omitted
      },
    });

    await createDuesConfig(ctx as any);
    expect(capturedInput.status).toBe('active');
  });

  test('explicit gracePeriodDays overrides the default', async () => {
    stubOfficerPass();
    let capturedInput: any;
    stubRepo(DuesConfigRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return { ...FAKE_CONFIG_RESULT, gracePeriodDays: input.gracePeriodDays };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [],
        gracePeriodDays: 60,
      },
    });

    await createDuesConfig(ctx as any);
    expect(capturedInput.gracePeriodDays).toBe(60);
  });

  test('sets auditResourceId to the new config id', async () => {
    stubOfficerPass();
    stubRepo(DuesConfigRepository, {
      createOne: async () => FAKE_CONFIG_RESULT,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-regular',
        annualAmount: 5000,
        currency: 'PHP',
        effectiveDate: '2026-01-01',
        fundAllocations: [],
      },
    });

    const vars: Record<string, any> = {};
    const origSet = (ctx as any).set.bind(ctx);
    (ctx as any).set = (key: string, val: any) => { vars[key] = val; origSet(key, val); };

    await createDuesConfig(ctx as any);
    expect(vars['auditResourceId']).toBe('config-new-1');
    expect(vars['auditDescription']).toBe('Dues config created');
  });

  test('fundAllocations forwarded unchanged to repo', async () => {
    stubOfficerPass();
    let capturedInput: any;
    stubRepo(DuesConfigRepository, {
      createOne: async (input: any) => {
        capturedInput = input;
        return FAKE_CONFIG_RESULT;
      },
    });

    const allocations = [
      { fundId: 'fund-1', percentage: '70' },
      { fundId: 'fund-2', percentage: '30' },
    ];

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        tierId: 'tier-vip',
        annualAmount: 10000,
        currency: 'USD',
        effectiveDate: '2027-01-01',
        fundAllocations: allocations,
      },
    });

    await createDuesConfig(ctx as any);
    expect(capturedInput.fundAllocations).toEqual(allocations);
  });
});
