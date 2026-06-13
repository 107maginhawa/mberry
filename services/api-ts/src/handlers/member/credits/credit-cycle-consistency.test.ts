/**
 * FIX-004 (G2) + FIX-014 regression net — single cycle authority.
 *
 * Proves that the FOUR credit-write paths that previously each computed
 * cycle boundaries a different way now agree: given the SAME org_cpd_config
 * and the SAME activity/anchor date, all four persist an IDENTICAL
 * [cycleStart, cycleEnd) window.
 *
 * Paths under test:
 *   1. Training completion  → awardTrainingCredit (association:operations util)
 *   2. Officer manual award → awardManualCredit (member/credits handler)
 *   3. Background job        → processCreditIssue (association:member job)
 *   4. Member self-service   → CreditService.createEntry (person createMyCreditEntry)
 *
 * Before FIX-004:
 *   - awardTrainingCredit used getCycleForDate(activityDate, activityDate, 2)
 *     → degenerate window anchored at the activity, hardcoded 2-year period,
 *       config ignored entirely.
 *   - awardManualCredit / processCreditIssue used 2020-epoch inline math.
 *   - CreditService.createEntry used getCycleForDate(activityDate, activityDate,
 *     cyclePeriodYears ?? 2) — the FIFTH path missed by the original FIX-004
 *     pass; same degenerate 2-year activityDate window, config ignored.
 *   These produced different windows for the same input.
 */

import { describe, test, expect, mock } from 'bun:test';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { CreditService } from './services/credit.service';
import { restoreRepo } from '@/test-utils/make-ctx';

// Shared org cycle config (Jan-start, 3-year — org_cpd_config defaults).
const ORG_CONFIG = { cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60, sdlCapPercent: 40 };

// One anchor date used by every path so the windows MUST line up.
const ANCHOR = new Date('2024-09-15');

// Expected canonical window for ANCHOR under ORG_CONFIG:
// (2024-2020)=4; floor(4/3)=1; aligned start year = 2020 + 1*3 = 2023.
const EXPECTED_START = new Date(2023, 0, 1);
const EXPECTED_END = new Date(2026, 0, 1);

function cycleEq(got: { cycleStart: any; cycleEnd: any }) {
  return {
    start: new Date(got.cycleStart).getTime(),
    end: new Date(got.cycleEnd).getTime(),
  };
}

describe('[FIX-004] single cycle authority — cross-path consistency', () => {
  test('training completion path stamps the config-driven window (reads org_cpd_config, not a hardcoded 2-year cycle)', async () => {
    restoreRepo(CreditEntryRepository);
    // Capture what awardTrainingCredit persists.
    let inserted: any = null;
    const origCreate = CreditEntryRepository.prototype.createOne;
    const origFind = CreditEntryRepository.prototype.findByTrainingAndPerson;
    CreditEntryRepository.prototype.findByTrainingAndPerson = async () => null;
    CreditEntryRepository.prototype.createOne = async (data: any) => { inserted = data; return data; };

    // db.select(...).from(orgCpdConfig).where(...).limit(1) → ORG_CONFIG row
    const db: any = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [ORG_CONFIG] }) }) }),
    };

    try {
      const { awardTrainingCredit } = await import('@/handlers/association:operations/utils/award-training-credit');
      const training = {
        id: 'train-1',
        organizationId: 'org-1',
        title: 'Implants Workshop',
        creditAmount: 10,
        creditBearing: true,
        endDate: ANCHOR,
      };
      const result = await awardTrainingCredit(db, null, training as any, 'person-1');
      expect(result.creditAwarded).toBe(10);
      expect(inserted).not.toBeNull();
      const got = cycleEq(inserted);
      expect(got.start).toBe(EXPECTED_START.getTime());
      expect(got.end).toBe(EXPECTED_END.getTime());
    } finally {
      CreditEntryRepository.prototype.createOne = origCreate;
      CreditEntryRepository.prototype.findByTrainingAndPerson = origFind;
    }
  });

  test('manual award path stamps the same config-driven window for the same activity date', async () => {
    let inserted: any = null;
    // Sequenced selects: [0]=officer term (requirePosition), [1]=org config (cycle).
    // category is 'General' (not Self-Directed) so there is no extra SDL select.
    const selectResponses: any[][] = [[{ positionTitle: 'President' }], [ORG_CONFIG]];
    let selectIdx = 0;
    const db: any = {
      select: () => ({
        from: () => {
          const idx = selectIdx++;
          const result = idx < selectResponses.length ? selectResponses[idx] : [];
          const chain = { limit: async () => result, then: (r: any, j?: any) => Promise.resolve(result).then(r, j) };
          const whereChain = { where: () => chain, limit: async () => result, then: (r: any, j?: any) => Promise.resolve(result).then(r, j) };
          return { ...whereChain, innerJoin: () => whereChain, leftJoin: () => whereChain };
        },
      }),
      insert: () => ({ values: (v: any) => { inserted = v; return { returning: () => Promise.resolve([{ id: 'ce-1', ...v }]) }; } }),
      execute: async () => undefined,
    };

    const { awardManualCredit } = await import('./awardManualCredit');
    const ctx = makeManualCtx(db, {
      personId: 'person-1',
      activityName: 'External CPD Seminar',
      activityDate: ANCHOR.toISOString(),
      creditAmount: 5,
      category: 'General',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });
    const res = await awardManualCredit(ctx);
    expect(res.status).toBe(201);
    expect(inserted).not.toBeNull();
    const got = cycleEq(inserted);
    expect(got.start).toBe(EXPECTED_START.getTime());
    expect(got.end).toBe(EXPECTED_END.getTime());
  });

  test('background job path stamps the same config-driven window for the same anchor date', async () => {
    let inserted: any = null;
    let selectIdx = 0;
    const db: any = {
      select: () => ({
        from: () => {
          const idx = selectIdx++;
          // 1st select = org config; 2nd select = sum total
          const result = idx === 0 ? [ORG_CONFIG] : [{ total: 5 }];
          const chain = { limit: async () => result, then: (r: any, j?: any) => Promise.resolve(result).then(r, j) };
          return { where: () => chain, limit: async () => result, then: (r: any, j?: any) => Promise.resolve(result).then(r, j) };
        },
      }),
      insert: () => ({ values: (v: any) => { inserted = v; return Promise.resolve(); } }),
      execute: async () => undefined,
    };
    const { processCreditIssue } = await import('@/handlers/association:member/jobs/creditIssue');
    const logger = { info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}), debug: mock(() => {}) };
    await processCreditIssue({
      db, logger, jobId: 'j-1', jobName: 'credit.issue',
      // The job anchors on the activity date when present.
      data: {
        sourceType: 'training_completion',
        sourceId: '660e8400-e29b-41d4-a716-446655440001',
        personId: 'person-1',
        organizationId: 'org-1',
        creditAmount: 5,
        activityDate: ANCHOR.toISOString(),
      },
    } as any);
    expect(inserted).not.toBeNull();
    const got = cycleEq(inserted);
    expect(got.start).toBe(EXPECTED_START.getTime());
    expect(got.end).toBe(EXPECTED_END.getTime());
  });

  test('member self-service path (CreditService.createEntry) stamps the same config-driven window for the same activity date', async () => {
    restoreRepo(CreditEntryRepository);
    // Capture what CreditService persists via the repo.
    let inserted: any = null;
    const origCreate = CreditEntryRepository.prototype.createOne;
    CreditEntryRepository.prototype.createOne = async (data: any) => { inserted = data; return { id: 'ce-self-1', ...data }; };

    // db.select(...).from(orgCpdConfig).where(...).limit(1) → ORG_CONFIG row
    const db: any = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [ORG_CONFIG] }) }) }),
    };

    try {
      const service = new CreditService(db, null as any);
      const entry = await service.createEntry({
        organizationId: 'org-1',
        personId: 'person-1',
        type: 'manual',
        activityName: 'Self-logged CPD',
        activityDate: ANCHOR,
        creditAmount: 5,
        // Validator strips these for the self-service route, so the handler
        // passes undefined; the legacy 2-year activityDate window must NOT win.
        registrationDate: undefined,
        cyclePeriodYears: undefined,
      });
      expect(entry).not.toBeNull();
      expect(inserted).not.toBeNull();
      const got = cycleEq(inserted);
      expect(got.start).toBe(EXPECTED_START.getTime());
      expect(got.end).toBe(EXPECTED_END.getTime());
    } finally {
      CreditEntryRepository.prototype.createOne = origCreate;
    }
  });
});

// Minimal ctx for awardManualCredit (President position, 2FA on).
function makeManualCtx(db: any, body: any) {
  const vars: Record<string, any> = {
    session: { id: 's-1', userId: 'officer-1', user: { id: 'officer-1' } },
    user: { id: 'officer-1', twoFactorEnabled: true },
    organizationId: 'org-1',
    database: db,
    logger: null,
  };
  // requirePosition reads an OfficerTermRepository off the db; stub it to grant President.
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      json: () => Promise.resolve(body),
      param: () => '',
      query: () => null,
      valid: () => body,
    },
    json: (data: any, status?: number) => new Response(JSON.stringify(data), { status: status ?? 200, headers: { 'content-type': 'application/json' } }),
  } as any;
}
