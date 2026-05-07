// FLOW-06: Dues Config → Invoice Generation
// Tests that upsertDuesConfig saves config + category overrides + reminder schedules,
// and that fund allocation percentages affect payment splits.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { upsertDuesConfig } from './upsertDuesConfig';
import { recordPayment } from './recordPayment';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-06';

const fakeConfig = {
  id: 'config-1',
  organizationId: ORG,
  defaultAmount: 150000,
  currency: 'PHP',
  billingFrequency: 'annual',
  dueDateDay: 1,
  gracePeriodDays: 30,
};

function configStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(DuesRepository, {
    upsertConfig: async (_orgId: string, data: any) => ({ ...fakeConfig, ...data }),
    replaceCategoryOverrides: async () => {},
    replaceReminderSchedules: async () => {},
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-06] Dues Config → Invoice Amounts', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('config saved with all dues parameters', async () => {
    let capturedConfig: any = null;

    mocks = configStubs({
      upsertConfig: async (_orgId: string, data: any) => {
        capturedConfig = data;
        return { ...fakeConfig, ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        defaultAmount: 200000,
        currency: 'PHP',
        billingFrequency: 'annual',
        dueDateMonth: 1,
        dueDateDay: 15,
        gracePeriodDays: 60,
      },
      _params: { orgId: ORG },
    });
    const response = await upsertDuesConfig(ctx);

    expect(response.status).toBe(200);
    expect(capturedConfig.defaultAmount).toBe(200000);
    expect(capturedConfig.billingFrequency).toBe('annual');
    expect(capturedConfig.gracePeriodDays).toBe(60);
  });

  test('category overrides saved when provided', async () => {
    let capturedOverrides: any = null;

    mocks = configStubs({
      replaceCategoryOverrides: async (_configId: string, overrides: any) => {
        capturedOverrides = overrides;
      },
    });

    const ctx = makeCtx({
      _body: {
        defaultAmount: 150000,
        categoryOverrides: [
          { categoryId: 'cat-senior', overrideAmount: 100000 },
          { categoryId: 'cat-student', overrideAmount: 50000 },
        ],
      },
      _params: { orgId: ORG },
    });
    await upsertDuesConfig(ctx);

    expect(capturedOverrides).toHaveLength(2);
    expect(capturedOverrides[0].categoryId).toBe('cat-senior');
    expect(capturedOverrides[0].overrideAmount).toBe(100000);
  });

  test('reminder schedules saved when provided', async () => {
    let remindersSaved = false;

    mocks = configStubs({
      replaceReminderSchedules: async () => { remindersSaved = true; },
    });

    const ctx = makeCtx({
      _body: {
        defaultAmount: 150000,
        reminderSchedules: [
          { daysBefore: 30, channel: 'email' },
          { daysBefore: 7, channel: 'push' },
        ],
      },
      _params: { orgId: ORG },
    });
    await upsertDuesConfig(ctx);

    expect(remindersSaved).toBe(true);
  });

  test('no category overrides when not provided', async () => {
    let overridesCalled = false;

    mocks = configStubs({
      replaceCategoryOverrides: async () => { overridesCalled = true; },
    });

    const ctx = makeCtx({
      _body: { defaultAmount: 150000 },
      _params: { orgId: ORG },
    });
    await upsertDuesConfig(ctx);

    expect(overridesCalled).toBe(false);
  });

  test('currency defaults to PHP', async () => {
    let capturedConfig: any = null;

    mocks = configStubs({
      upsertConfig: async (_orgId: string, data: any) => {
        capturedConfig = data;
        return { ...fakeConfig, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { defaultAmount: 150000 },
      _params: { orgId: ORG },
    });
    await upsertDuesConfig(ctx);

    expect(capturedConfig.currency).toBe('PHP');
  });

  // ── Cross-module: fund allocation affects payment splits ──

  test('payment splits follow fund percentages from config', async () => {
    restoreRepo(DuesRepository);
    let capturedAllocations: any[] = [];

    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({
        id: 'pay-1', ...data, status: 'completed', receiptNumber: 'PDA-2026-000001',
      }),
      listFunds: async () => [
        { id: 'fund-national', organizationId: ORG, name: 'National Fund', percentage: '60', sortOrder: 1, active: true },
        { id: 'fund-chapter', organizationId: ORG, name: 'Chapter Fund', percentage: '40', sortOrder: 2, active: true },
      ],
      createFundAllocations: async (allocs: any) => { capturedAllocations = allocs; },
      getMembershipForExpiry: async () => undefined,
      updateDuesExpiry: async () => {},
    });

    const ctx = makeCtx({
      _body: {
        organizationId: ORG,
        personId: 'person-1',
        amount: 100000, // 1000.00 PHP
        paymentMethod: 'cash',
        orgCode: 'PDA',
      },
    });
    await recordPayment(ctx);

    expect(capturedAllocations).toHaveLength(2);
    expect(capturedAllocations[0].fundId).toBe('fund-national');
    expect(capturedAllocations[0].amount).toBe(60000); // 60%
    expect(capturedAllocations[1].fundId).toBe('fund-chapter');
    expect(capturedAllocations[1].amount).toBe(40000); // 40%
  });
});
