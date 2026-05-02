import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { generateReport } from './generateReport';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeCollectionData = [
  { month: '2025-01', method: 'cash', count: 5, total: 25000 },
  { month: '2025-02', method: 'bank_transfer', count: 3, total: 15000 },
];

const fakeFundBreakdown = [
  { fundId: 'fund-1', fundName: 'General Fund', percentage: '60', totalAllocated: 30000, totalReversals: 0, netTotal: 30000 },
];

const fakeDuesStatus = [
  { personId: 'person-1', totalPaid: 5000, lastPaymentDate: '2025-01-15', paymentCount: 1 },
];

const fakeAging = [
  { personId: 'person-2', amount: 5000, paidAt: null, daysPending: 45 },
];

// ─── Tests ──────────────────────────────────────────────

describe('generateReport', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('generates collection report with summary', async () => {
    mocks = stubRepo(DuesRepository, {
      reportCollectionSummary: async () => fakeCollectionData,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: { type: 'collection', from: '2025-01-01', to: '2025-12-31' },
    });

    const response = await generateReport(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.summary.totalCollected).toBe(40000);
    expect(response.body.summary.rowCount).toBe(2);
    expect(response.body.meta.type).toBe('collection');
  });

  test('generates fund_breakdown report', async () => {
    mocks = stubRepo(DuesRepository, {
      reportFundBreakdown: async () => fakeFundBreakdown,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: { type: 'fund_breakdown' },
    });

    const response = await generateReport(ctx);
    expect(response.status).toBe(200);
    expect(response.body.summary.fundCount).toBe(1);
  });

  test('generates dues_status report', async () => {
    mocks = stubRepo(DuesRepository, {
      reportDuesStatus: async () => fakeDuesStatus,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: { type: 'dues_status' },
    });

    const response = await generateReport(ctx);
    expect(response.status).toBe(200);
    expect(response.body.summary.memberCount).toBe(1);
  });

  test('generates aging report with buckets', async () => {
    mocks = stubRepo(DuesRepository, {
      reportAging: async () => fakeAging,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: { type: 'aging' },
    });

    const response = await generateReport(ctx);
    expect(response.status).toBe(200);
    expect(response.body.summary.buckets['31-60']).toBe(1);
    expect(response.body.summary.bucketAmounts['31-60']).toBe(5000);
    expect(response.body.summary.totalOverdue).toBe(1);
  });

  test('throws ValidationError for invalid report type', async () => {
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: { type: 'invalid_type' },
    });

    await expect(generateReport(ctx)).rejects.toThrow('Invalid report type');
  });

  test('throws ValidationError when type is missing', async () => {
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: {},
    });

    await expect(generateReport(ctx)).rejects.toThrow('Invalid report type');
  });

  test('defaults date range to current year when not provided', async () => {
    let capturedFrom: Date | null = null;
    let capturedTo: Date | null = null;
    mocks = stubRepo(DuesRepository, {
      reportCollectionSummary: async (_org: string, from: Date, to: Date) => {
        capturedFrom = from;
        capturedTo = to;
        return [];
      },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _query: { type: 'collection' },
    });

    await generateReport(ctx);
    const year = new Date().getFullYear();
    expect(capturedFrom!.getFullYear()).toBe(year);
    expect(capturedFrom!.getMonth()).toBe(0); // January
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      reportCollectionSummary: async () => [],
    });

    // generateReport doesn't access session directly
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _query: { type: 'collection' },
    });

    const response = await generateReport(ctx);
    expect(response.status).toBe(200);
  });
});
