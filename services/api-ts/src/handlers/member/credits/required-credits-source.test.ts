/**
 * FIX-006 (G4) — single required-credits source of truth.
 *
 * Before FIX-006 there were four competing sources for "required credits":
 *   - org_cpd_config (60/3)
 *   - getCreditCompliance query defaults (40/2)
 *   - the officer report FE hardcode (45/3)
 *   - client-supplied transcript query params (registrationDate /
 *     cyclePeriodYears / requiredCredits)
 * The last one let a member self-certify compliance on the regulator-facing
 * transcript PDF.
 *
 * After FIX-006 the server resolves required credits + cycle length from
 * org_cpd_config and IGNORES any client-supplied requiredCredits /
 * cyclePeriodYears / cycleStart* overrides.
 *
 * These are handler-level tests using repo stubs + a config-returning mock db.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';

// A config-returning mock db: every db.select().from(...).where(...).limit(1)
// resolves to the org_cpd_config row. (The handlers under test only do raw
// selects for org_cpd_config; member/credit fetches go through stubbed repos.)
function configDb(config: Record<string, unknown>) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => [config],
    then: (r: any, j?: any) => Promise.resolve([config]).then(r, j),
  };
  return { select: () => chain } as any;
}

function makeComplianceCtx(opts: { query?: Record<string, string>; db: any; params?: Record<string, string> }) {
  const vars: Record<string, any> = {
    session: { id: 's-1', userId: 'officer-1', user: { id: 'officer-1' } },
    user: { id: 'officer-1', twoFactorEnabled: true },
    organizationId: undefined,
    database: opts.db,
    logger: null,
  };
  const params = opts.params ?? { organizationId: 'org-1' };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      valid: (t: string) => (t === 'param' ? params : {}),
      param: (k: string) => params[k] ?? '',
      query: (k: string) => opts.query?.[k] ?? null,
      json: () => Promise.resolve({}),
    },
    json: (data: any, status?: number) => ({ status: status ?? 200, body: data }) as any,
  } as any;
}

function makeTranscriptCtx(opts: { query: Record<string, string>; db: any }) {
  const vars: Record<string, any> = {
    user: { id: 'member-1', name: 'Dr. Member' },
    session: { id: 's-1', userId: 'member-1', user: { id: 'member-1' } },
    organizationId: 'org-1',
    database: opts.db,
    logger: null,
  };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      valid: (t: string) => (t === 'query' ? opts.query : {}),
      param: () => '',
      query: (k: string) => opts.query[k] ?? null,
      json: () => Promise.resolve({}),
    },
    json: (data: any, status?: number) => ({ status: status ?? 200, body: data }) as any,
  } as any;
}

describe('[FIX-006] getCreditCompliance resolves required credits from org_cpd_config', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(CreditEntryRepository);
  });

  test('ignores client requiredCredits=1 override; uses org_cpd_config requiredCredits=60', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipRepository, {
      listMembers: async () => ({
        data: [{ person: { id: 'p1', firstName: 'A', lastName: 'B' }, membership: { memberNumber: 'M1' } }],
        total: 1,
      }),
    });
    stubRepo(CreditEntryRepository, {
      sumCreditsByCategoryBatch: async () => new Map(),
      // member earned 50 — below the real 60 requirement, but >= a bogus 1.
      sumCreditsForCycle: async () => 50,
    });

    const { getCreditCompliance } = await import('./getCreditCompliance');
    const ctx = makeComplianceCtx({
      db: configDb({ requiredCredits: 60, cycleLengthYears: 3, cycleStartMonth: 1, sdlCapPercent: 40 }),
      query: { requiredCredits: '1', cyclePeriodYears: '1' }, // attacker-supplied, must be ignored
    });
    const res = await getCreditCompliance(ctx);
    expect(res.status).toBe(200);
    // Required must reflect config (60), not the client's 1.
    expect(res.body.summary.requiredCredits).toBe(60);
    // 50 earned against 60 required → at_risk (>= 50% of 60), NOT compliant.
    expect(res.body.data[0].required).toBe(60);
    expect(res.body.data[0].compliance_status).toBe('at_risk');
  });
});

describe('[FIX-014] getCreditCompliance RBAC — officer of one org cannot read another org', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(CreditEntryRepository);
  });

  test('officer with NO active term in the requested org is denied (403)', async () => {
    // requirePosition reads the term for (user, ctx.organizationId). The handler
    // sets ctx.organizationId from the PATH param BEFORE the check — so an
    // officer querying an org where they hold no term gets zero terms → 403.
    let queriedOrg: string | null = null;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async (_personId: string, orgId: string) => {
        queriedOrg = orgId;
        // No term in org-OTHER.
        return orgId === 'org-mine' ? [{ positionTitle: 'President' }] : [];
      },
    });

    const { getCreditCompliance } = await import('./getCreditCompliance');
    const ctx = makeComplianceCtx({
      db: configDb({ requiredCredits: 60, cycleLengthYears: 3, cycleStartMonth: 1 }),
      params: { organizationId: 'org-OTHER' },
    });
    const res = await getCreditCompliance(ctx);
    expect(res.status).toBe(403);
    // Prove the term check was scoped to the requested (path) org, not the caller's.
    expect(queriedOrg).toBe('org-OTHER');
  });
});

describe('[FIX-006] getCreditTranscript ignores client-supplied compliance params', () => {
  afterEach(() => {
    restoreRepo(CreditEntryRepository);
  });

  test('uses org_cpd_config requiredCredits, ignoring client requiredCredits override', async () => {
    stubRepo(CreditEntryRepository, {
      sumCreditsByOrg: async () => [{ organizationId: 'org-1', total: 40 }],
    });
    const { getCreditTranscript } = await import('./getCreditTranscript');
    const ctx = makeTranscriptCtx({
      db: configDb({ requiredCredits: 60, cycleLengthYears: 3, cycleStartMonth: 1 }),
      // Attacker tries to lower the bar to 1 (and force compliant=true).
      query: { registrationDate: '2024-01-01', requiredCredits: '1', cyclePeriodYears: '1', carryoverEnabled: 'false' },
    });
    const res = await getCreditTranscript(ctx);
    expect(res.status).toBe(200);
    // required resolved from config (60), not the client's 1.
    expect(res.body.required).toBe(60);
    // 40 earned < 60 required → NOT compliant (client tried to flip this to true).
    expect(res.body.compliant).toBe(false);
    expect(res.body.remaining).toBe(20);
  });
});

describe('[FIX-006] getCreditTranscriptPdf ignores client-supplied compliance params', () => {
  afterEach(() => {
    restoreRepo(CreditEntryRepository);
  });

  test('uses org_cpd_config requiredCredits on the regulator PDF, ignoring client override', async () => {
    stubRepo(CreditEntryRepository, {
      sumCreditsByOrg: async () => [{ organizationId: 'org-1', organizationName: 'Org', total: 40 }],
      listForPerson: async () => [],
    });
    const { getCreditTranscriptPdf } = await import('./getCreditTranscriptPdf');
    const ctx = makeTranscriptCtx({
      db: configDb({ requiredCredits: 60, cycleLengthYears: 3, cycleStartMonth: 1 }),
      query: { registrationDate: '2024-01-01', requiredCredits: '1', cyclePeriodYears: '1', carryoverEnabled: 'false' },
    });
    const res = await getCreditTranscriptPdf(ctx);
    expect(res.status).toBe(200);
    expect(res.body.summary.required).toBe(60);
    expect(res.body.summary.compliant).toBe(false);
  });
});
