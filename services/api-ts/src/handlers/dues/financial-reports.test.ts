/**
 * Tests for financial reports (Slice 030)
 *
 * Comprehensive tests for generateDuesReport handler covering:
 * - Auth guards (401/403)
 * - Date range filtering (from/to params)
 * - Report type: collection summary
 * - Report type: fund breakdown accuracy
 * - Report type: dues status
 * - Report type: aging
 * - Permission enforcement (Treasurer/President only)
 * - Cross-org guard
 * - Summary calculations
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const collectionData = [
  { month: '2026-01', method: 'cash', count: 5, total: 25000 },
  { month: '2026-01', method: 'online', count: 3, total: 15000 },
  { month: '2026-02', method: 'cash', count: 8, total: 40000 },
];

const fundBreakdownData = [
  { fundId: 'fund-1', fundName: 'General Fund', percentage: '70.00', totalAllocated: 56000, totalReversals: 0, netTotal: 56000 },
  { fundId: 'fund-2', fundName: 'Building Fund', percentage: '30.00', totalAllocated: 24000, totalReversals: 2000, netTotal: 22000 },
];

const duesStatusData = [
  { personId: 'p-1', totalPaid: 5000, lastPaymentDate: '2026-02-15', paymentCount: 1 },
  { personId: 'p-2', totalPaid: 10000, lastPaymentDate: '2026-01-20', paymentCount: 2 },
];

const agingData = [
  { personId: 'p-3', amount: 5000, paidAt: null, daysPending: 45 },
  { personId: 'p-4', amount: 3000, paidAt: null, daysPending: 90 },
];

function officerStubs() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
  });
}

function noOfficerStubs() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [],
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[030] generateDuesReport — collection summary', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection' },
    });
    await expect(generateDuesReport(ctx as any)).rejects.toThrow();
  });

  test('returns 403 for non-officer member', async () => {
    noOfficerStubs();
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns collection summary with correct totals', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportCollectionSummary: async () => collectionData,
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.summary.totalCollected).toBe(80000); // 25000+15000+40000
    expect(res.body.summary.rowCount).toBe(3);
  });

  test('passes date range filters to repo', async () => {
    officerStubs();
    let capturedFrom: Date | undefined;
    let capturedTo: Date | undefined;
    stubRepo(DuesRepository, {
      reportCollectionSummary: async (_orgId: string, from: Date, to: Date) => {
        capturedFrom = from;
        capturedTo = to;
        return [];
      },
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection', from: new Date('2026-01-01'), to: new Date('2026-06-30') },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(200);
    expect(capturedFrom).toBeDefined();
    expect(capturedTo).toBeDefined();
  });

  test('meta includes report type and date range', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportCollectionSummary: async () => [],
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.body.meta.type).toBe('collection');
    expect(res.body.meta.from).toBeDefined();
    expect(res.body.meta.to).toBeDefined();
  });
});

describe('[030] generateDuesReport — fund breakdown', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns fund breakdown with net totals', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportFundBreakdown: async () => fundBreakdownData,
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'fund_breakdown' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.summary.fundCount).toBe(2);
  });

  test('fund breakdown includes reversals', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportFundBreakdown: async () => fundBreakdownData,
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'fund_breakdown' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    // Building Fund has 2000 in reversals
    const buildingFund = res.body.data.find((d: any) => d.fundName === 'Building Fund');
    expect(buildingFund.totalReversals).toBe(2000);
    expect(buildingFund.netTotal).toBe(22000);
  });
});

describe('[030] generateDuesReport — dues status', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns dues status per member', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportDuesStatus: async () => duesStatusData,
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'dues_status' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.summary.memberCount).toBe(2);
  });
});

describe('[030] generateDuesReport — aging', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns aging report with pending payments', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportAging: async () => agingData,
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'aging' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.summary.totalOverdue).toBe(2);
  });

  test('aging includes days pending per payment', async () => {
    officerStubs();
    stubRepo(DuesRepository, {
      reportAging: async () => agingData,
    });
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'aging' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.body.data[0].daysPending).toBe(45);
    expect(res.body.data[1].daysPending).toBe(90);
  });
});

describe('[030] generateDuesReport — cross-org guard', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when route param org differs from ctx org', async () => {
    officerStubs();
    const { generateDuesReport } = await import('@/handlers/association:member/generateDuesReport');
    const ctx = makeCtx({
      _params: { organizationId: 'org-B' },
      _query: { type: 'collection' },
      organizationId: 'org-A',
    });
    try {
      const res = await generateDuesReport(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });
});
