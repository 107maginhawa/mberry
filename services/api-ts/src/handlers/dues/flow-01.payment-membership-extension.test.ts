// FLOW-01: Payment → Membership Extension
// Tests that recordPayment triggers cross-module side effect:
// dues payment → getMembershipForExpiry → computeNewExpiry → updateDuesExpiry
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { recordPayment } from './recordPayment';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-01';
const PERSON = 'person-flow-01';
const USER = 'officer-1';

const fakePayment = {
  id: 'pay-1',
  organizationId: ORG,
  personId: PERSON,
  receiptNumber: 'PDA-2026-000001',
  amount: 150000,
  currency: 'PHP',
  paymentMethod: 'cash',
  status: 'completed',
  refundedAmount: 0,
  recordedBy: USER,
  createdBy: USER,
  updatedBy: USER,
};

const baseBody = {
  organizationId: ORG,
  personId: PERSON,
  amount: 150000,
  currency: 'PHP',
  paymentMethod: 'cash',
  orgCode: 'PDA',
};

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(DuesRepository, {
    findRecentPaymentForPerson: async () => undefined,
    getNextReceiptSequence: async () => 1,
    createPayment: async (data: any) => ({ ...fakePayment, ...data }),
    listFunds: async () => [],
    createFundAllocations: async () => {},
    getMembershipForExpiry: async () => undefined,
    updateDuesExpiry: async () => {},
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-01] Payment → Membership Extension', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('payment triggers expiry extension when membership exists', async () => {
    let expiryUpdated = false;
    let capturedExpiry: Date | null = null;

    mocks = defaultStubs({
      getMembershipForExpiry: async () => ({
        personId: PERSON,
        duesExpiryDate: new Date('2026-08-01'),
        billingCycle: 'annual',
      }),
      updateDuesExpiry: async (_orgId: string, _personId: string, newExpiry: Date) => {
        expiryUpdated = true;
        capturedExpiry = newExpiry;
      },
    });

    const ctx = makeCtx({ _body: baseBody });
    const response = await recordPayment(ctx);

    expect(response.status).toBe(201);
    expect(expiryUpdated).toBe(true);
    // Annual extension from 2026-08-01 → 2027-08-01
    expect(capturedExpiry).toEqual(new Date('2027-08-01'));
  });

  test('payment skips expiry extension when no membership found', async () => {
    let expiryUpdated = false;

    mocks = defaultStubs({
      getMembershipForExpiry: async () => undefined,
      updateDuesExpiry: async () => { expiryUpdated = true; },
    });

    const ctx = makeCtx({ _body: baseBody });
    const response = await recordPayment(ctx);

    expect(response.status).toBe(201);
    expect(expiryUpdated).toBe(false);
  });

  test('quarterly billing extends by 3 months', async () => {
    let capturedExpiry: Date | null = null;

    mocks = defaultStubs({
      getMembershipForExpiry: async () => ({
        personId: PERSON,
        duesExpiryDate: new Date('2026-09-01'),
        billingCycle: 'quarterly',
      }),
      updateDuesExpiry: async (_orgId: string, _personId: string, newExpiry: Date) => {
        capturedExpiry = newExpiry;
      },
    });

    const ctx = makeCtx({ _body: baseBody });
    await recordPayment(ctx);

    // Quarterly: 2026-09-01 + 3 months = 2026-12-01
    expect(capturedExpiry).toEqual(new Date('2026-12-01'));
  });

  test('payment creates record AND extends expiry in same call', async () => {
    let paymentCreated = false;
    let expiryUpdated = false;

    mocks = defaultStubs({
      createPayment: async (data: any) => {
        paymentCreated = true;
        return { ...fakePayment, ...data };
      },
      getMembershipForExpiry: async () => ({
        personId: PERSON,
        duesExpiryDate: new Date('2026-06-15'),
        billingCycle: 'annual',
      }),
      updateDuesExpiry: async () => { expiryUpdated = true; },
    });

    const ctx = makeCtx({ _body: baseBody });
    const response = await recordPayment(ctx);

    expect(response.status).toBe(201);
    expect(paymentCreated).toBe(true);
    expect(expiryUpdated).toBe(true);
  });

  test('fund allocations AND expiry extension both execute', async () => {
    let allocations: any[] = [];
    let capturedExpiry: Date | null = null;

    mocks = defaultStubs({
      listFunds: async () => [
        { id: 'fund-1', organizationId: ORG, name: 'National', percentage: '100', sortOrder: 1, active: true },
      ],
      createFundAllocations: async (allocs: any) => { allocations = allocs; },
      getMembershipForExpiry: async () => ({
        personId: PERSON,
        duesExpiryDate: new Date('2026-07-01'),
        billingCycle: 'annual',
      }),
      updateDuesExpiry: async (_o: string, _p: string, exp: Date) => { capturedExpiry = exp; },
    });

    const ctx = makeCtx({ _body: baseBody });
    await recordPayment(ctx);

    expect(allocations.length).toBeGreaterThan(0);
    expect(capturedExpiry).toEqual(new Date('2027-07-01'));
  });
});
