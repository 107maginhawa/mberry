import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { associations, organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { getMyCreditSummary } from './getMyCreditSummary';

/**
 * A table-keyed db mock. Each db.select().from(table) is served the rows mapped
 * to that table object, so the test does not depend on the handler's internal
 * query ORDER. This lets the same test fixture exercise both the pre-FIX-006
 * handler (memberships → organizations → associations) and the post-FIX-006
 * handler (memberships → org_cpd_config), making the RED genuine: associations
 * is deliberately set to a WRONG required-credits value so a handler reading it
 * fails, while org_cpd_config carries the correct value.
 */
function tableDb(rowsByTable: Map<any, any[]>) {
  const makeChain = (table: any): any => {
    const rows = rowsByTable.get(table) ?? [];
    const chain: any = {
      from: (t: any) => makeChain(t),
      where: () => chain,
      limit: async () => rows,
      orderBy: async () => rows,
      then: (r: any, j?: any) => Promise.resolve(rows).then(r, j),
    };
    return chain;
  };
  // select() may be called with field projections; the table arrives via .from()
  return { select: () => makeChain(undefined) } as any;
}

describe('getMyCreditSummary', () => {
  beforeEach(() => { restoreRepo(CreditEntryRepository); });
  afterEach(() => { restoreRepo(CreditEntryRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyCreditSummary(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    const mockDb = tableDb(new Map([[memberships, []]]));
    stubRepo(CreditEntryRepository, {
      sumCreditsByOrg: async () => [],
    });
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyCreditSummary(ctx);
    expect(res.status).toBe(200);
  });

  describe('[FIX-006] single required-credits source of truth', () => {
    test('resolves requiredCredits from org_cpd_config, IGNORING associations + client override', async () => {
      // org_cpd_config (the single authority) says 60. The legacy associations
      // table says 45 — a handler reading associations would return 45 and FAIL.
      const mockDb = tableDb(new Map<any, any[]>([
        [memberships, [{ startDate: '2024-01-01', organizationId: 'org-1' }]],
        [organizations, [{ associationId: 'assoc-1' }]],
        [associations, [{ requiredCreditsPerCycle: 45 }]],
        [orgCpdConfig, [{ requiredCredits: 60, cycleLengthYears: 3, cycleStartMonth: 1 }]],
      ]));
      stubRepo(CreditEntryRepository, {
        sumCreditsByOrg: async () => [{ organizationId: 'org-1', total: 40 }],
      });
      // Attacker supplies requiredCredits=1 to self-certify compliance.
      const ctx = makeCtx({
        database: mockDb,
        _query: { requiredCredits: '1' },
      });
      const res = (await getMyCreditSummary(ctx)) as any;
      const body = res.body;
      expect(res.status).toBe(200);
      // Required must reflect org_cpd_config (60) — NOT associations (45) and
      // NOT the client's 1.
      expect(body.requiredCredits).toBe(60);
      expect(body.totalEarned).toBe(40);
      // 40 earned against 60 required → 20 remaining (client tried to force 0).
      expect(body.remaining).toBe(20);
    });

    test('IGNORES client-supplied cycle window params (registrationDate/cyclePeriodYears/targetDate)', async () => {
      // org_cpd_config: 3-year cycle anchored on month 7 (July).
      const mockDb = tableDb(new Map<any, any[]>([
        [memberships, [{ startDate: '2024-01-01', organizationId: 'org-1' }]],
        [organizations, [{ associationId: 'assoc-1' }]],
        [associations, [{ requiredCreditsPerCycle: 45 }]],
        [orgCpdConfig, [{ requiredCredits: 60, cycleLengthYears: 3, cycleStartMonth: 7 }]],
      ]));
      // Capture the cycle window the repo aggregate is asked for.
      let askedStart: Date | null = null;
      let askedEnd: Date | null = null;
      stubRepo(CreditEntryRepository, {
        sumCreditsByOrg: async (_p: string, start: Date, end: Date) => {
          askedStart = start;
          askedEnd = end;
          return [];
        },
      });
      // Attacker supplies a fabricated favorable window.
      const ctx = makeCtx({
        database: mockDb,
        _query: {
          registrationDate: '2010-03-15',
          cyclePeriodYears: '1',
          targetDate: '2099-12-31',
        },
      });
      const res = (await getMyCreditSummary(ctx)) as any;
      expect(res.status).toBe(200);
      // The window must come from resolveCycle(config, now) — NOT the client
      // 2010 registration / 1-year period / 2099 target. resolveCycle anchors
      // on July (month 7) and aligns 3-year cycles to the 2020 epoch.
      expect(askedStart).not.toBeNull();
      expect(askedEnd).not.toBeNull();
      // A July-anchored, 3-year, 2020-epoch-aligned cycle always starts on the
      // 1st of July of an epoch-aligned year (2020/2023/2026...). The client's
      // March-15 / 1-year params can never produce a July-1 start.
      expect(askedStart!.getMonth()).toBe(6); // July (0-indexed)
      expect(askedStart!.getDate()).toBe(1);
      expect((askedEnd!.getFullYear() - askedStart!.getFullYear())).toBe(3); // 3-year length, not the client's 1
    });

    test('falls back to platform default (60/3) when the member has no org config row', async () => {
      // membership row present but org_cpd_config lookup returns nothing.
      const mockDb = tableDb(new Map<any, any[]>([
        [memberships, [{ startDate: '2024-01-01', organizationId: 'org-1' }]],
        [organizations, [{ associationId: 'assoc-1' }]],
        [associations, [{ requiredCreditsPerCycle: 45 }]],
        [orgCpdConfig, []],
      ]));
      stubRepo(CreditEntryRepository, {
        sumCreditsByOrg: async () => [{ organizationId: 'org-1', total: 10 }],
      });
      const ctx = makeCtx({ database: mockDb, _query: { requiredCredits: '999' } });
      const res = (await getMyCreditSummary(ctx)) as any;
      const body = res.body;
      expect(res.status).toBe(200);
      // Default 60 (existing org_cpd_config default), not associations (45) and
      // not the client's 999.
      expect(body.requiredCredits).toBe(60);
      expect(body.remaining).toBe(50);
    });
  });
});
