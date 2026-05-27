import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  generateAutoInvoices,
  getCycleBillingMonths,
  isBillingCycleDate,
  computeBillingPeriod,
  type AutoInvoiceResult,
} from './autoInvoiceGenerator';

// ---------------------------------------------------------------------------
// Mock helpers (same pattern as reminderProcessor.test.ts)
// ---------------------------------------------------------------------------

function createMockLogger() {
  return {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  };
}

/**
 * Build a sequenced mock DB. Each call to select().from() or insert().values()
 * returns the next item in the responses array.
 */
function buildSequencedDb(responses: any[], insertSpy?: (val: any) => void) {
  let callIdx = 0;
  return {
    select: (..._args: any[]) => ({
      from: (_table: any) => {
        const idx = callIdx++;
        const resp = idx < responses.length ? responses[idx] : [];
        if (Array.isArray(resp)) {
          const result = Promise.resolve(resp);
          (result as any).where = () => Promise.resolve(resp);
          (result as any).limit = () => Promise.resolve(resp);
          return result;
        }
        // Add limit chaining for whereResponse objects too
        const original = resp;
        if (original && typeof original.where === 'function') {
          original.limit = () => Promise.resolve([]);
        }
        return resp;
      },
    }),
    insert: () => ({
      values: (val: any) => {
        insertSpy?.(val);
        return Promise.resolve();
      },
    }),
  };
}

function whereResponse(data: any[]) {
  return {
    where: () => Promise.resolve(data),
  };
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeOrgConfig(overrides: Record<string, any> = {}) {
  return {
    id: 'config-1',
    organizationId: 'org-1',
    defaultAmount: 50000, // PHP 500.00 in cents
    currency: 'PHP',
    billingFrequency: 'annual',
    dueDateMonth: 1,
    dueDateDay: 15,
    gracePeriodDays: 30,
    ...overrides,
  };
}

function makeMember(overrides: Record<string, any> = {}) {
  return {
    id: 'mem-1',
    personId: 'person-1',
    organizationId: 'org-1',
    categoryId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests: billing cycle logic
// ---------------------------------------------------------------------------

describe('getCycleBillingMonths', () => {
  test('annual returns single month', () => {
    expect(getCycleBillingMonths('annual', 1)).toEqual([1]);
    expect(getCycleBillingMonths('annual', 6)).toEqual([6]);
  });

  test('semi-annual returns two months 6 apart', () => {
    expect(getCycleBillingMonths('semi-annual', 1)).toEqual([1, 7]);
    expect(getCycleBillingMonths('semi-annual', 4)).toEqual([4, 10]);
  });

  test('quarterly returns four months 3 apart', () => {
    expect(getCycleBillingMonths('quarterly', 1)).toEqual([1, 4, 7, 10]);
    expect(getCycleBillingMonths('quarterly', 3)).toEqual([3, 6, 9, 12]);
  });

  test('wraps months past December', () => {
    expect(getCycleBillingMonths('semi-annual', 8)).toEqual([8, 2]);
    expect(getCycleBillingMonths('quarterly', 11)).toEqual([11, 2, 5, 8]);
  });
});

describe('isBillingCycleDate', () => {
  test('returns true on exact cycle date (annual)', () => {
    const jan15 = new Date(2026, 0, 15); // Jan 15
    expect(isBillingCycleDate(jan15, 'annual', 1, 15)).toBe(true);
  });

  test('returns false on wrong day', () => {
    const jan16 = new Date(2026, 0, 16); // Jan 16
    expect(isBillingCycleDate(jan16, 'annual', 1, 15)).toBe(false);
  });

  test('returns false on wrong month', () => {
    const feb15 = new Date(2026, 1, 15); // Feb 15
    expect(isBillingCycleDate(feb15, 'annual', 1, 15)).toBe(false);
  });

  test('returns true on quarterly cycle dates', () => {
    // cycleStartMonth=1, dueDateDay=1 -> months 1, 4, 7, 10
    expect(isBillingCycleDate(new Date(2026, 0, 1), 'quarterly', 1, 1)).toBe(true);
    expect(isBillingCycleDate(new Date(2026, 3, 1), 'quarterly', 1, 1)).toBe(true);
    expect(isBillingCycleDate(new Date(2026, 6, 1), 'quarterly', 1, 1)).toBe(true);
    expect(isBillingCycleDate(new Date(2026, 9, 1), 'quarterly', 1, 1)).toBe(true);
  });

  test('returns false on non-quarterly months', () => {
    expect(isBillingCycleDate(new Date(2026, 1, 1), 'quarterly', 1, 1)).toBe(false);
    expect(isBillingCycleDate(new Date(2026, 4, 1), 'quarterly', 1, 1)).toBe(false);
  });

  test('returns true on semi-annual cycle dates', () => {
    // cycleStartMonth=3, dueDateDay=15 -> months 3, 9
    expect(isBillingCycleDate(new Date(2026, 2, 15), 'semi-annual', 3, 15)).toBe(true);
    expect(isBillingCycleDate(new Date(2026, 8, 15), 'semi-annual', 3, 15)).toBe(true);
  });
});

describe('computeBillingPeriod', () => {
  test('annual period spans 1 year', () => {
    const result = computeBillingPeriod(new Date(2026, 0, 15), 'annual', 1, 15);
    expect(result.periodStart).toBe('2026-01-15');
    expect(result.periodEnd).toBe('2027-01-15');
  });

  test('semi-annual period spans 6 months', () => {
    const result = computeBillingPeriod(new Date(2026, 0, 1), 'semi-annual', 1, 1);
    expect(result.periodStart).toBe('2026-01-01');
    expect(result.periodEnd).toBe('2026-07-01');
  });

  test('quarterly period spans 3 months', () => {
    const result = computeBillingPeriod(new Date(2026, 3, 1), 'quarterly', 1, 1);
    expect(result.periodStart).toBe('2026-04-01');
    expect(result.periodEnd).toBe('2026-07-01');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: generateAutoInvoices
// ---------------------------------------------------------------------------

describe('generateAutoInvoices', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('returns zero counts when no configs exist', async () => {
    const db = buildSequencedDb([
      [], // configs
    ]);

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('does nothing on non-cycle dates', async () => {
    // Config: annual, cycleStartMonth=1, dueDateDay=15
    // Today: Jan 16 (not cycle date)
    const db = buildSequencedDb([
      [makeOrgConfig()], // configs
    ]);

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 16), // Jan 16 — wrong day
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('generates invoices on correct annual cycle date', async () => {
    const insertedValues: any[] = [];
    // Call sequence:
    // 1. configs
    // 2. eligible members (filtered by notInArray)
    // 3. category overrides
    // 4. existing invoices (idempotency check)
    const db = buildSequencedDb([
      [makeOrgConfig()],                    // configs
      whereResponse([makeMember()]),         // eligible members
      whereResponse([]),                     // no category overrides
      whereResponse([]),                     // no existing invoices
    ], (val) => insertedValues.push(val));

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15), // Jan 15 — cycle date
    });

    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(insertedValues.length).toBe(1);
    expect(insertedValues[0].totalAmount).toBe(50000);
    expect(insertedValues[0].periodStart).toBe('2026-01-15');
    expect(insertedValues[0].periodEnd).toBe('2027-01-15');
    expect(insertedValues[0].status).toBe('generated');
    expect(insertedValues[0].personId).toBe('person-1');
  });

  test('generates invoices on quarterly cycle dates (4 per year)', async () => {
    const quarterlyConfig = makeOrgConfig({
      billingFrequency: 'quarterly',
      dueDateMonth: 1,
      dueDateDay: 1,
    });

    // Q1: Jan 1
    const insertedQ1: any[] = [];
    const dbQ1 = buildSequencedDb([
      [quarterlyConfig],
      whereResponse([makeMember()]),
      whereResponse([]),
      whereResponse([]),
    ], (val) => insertedQ1.push(val));

    const r1 = await generateAutoInvoices({
      db: dbQ1 as any, logger: mockLogger, now: new Date(2026, 0, 1),
    });
    expect(r1.generated).toBe(1);
    expect(insertedQ1[0].periodStart).toBe('2026-01-01');
    expect(insertedQ1[0].periodEnd).toBe('2026-04-01');

    // Q2: Apr 1
    const insertedQ2: any[] = [];
    const dbQ2 = buildSequencedDb([
      [quarterlyConfig],
      whereResponse([makeMember()]),
      whereResponse([]),
      whereResponse([]),
    ], (val) => insertedQ2.push(val));

    const r2 = await generateAutoInvoices({
      db: dbQ2 as any, logger: mockLogger, now: new Date(2026, 3, 1),
    });
    expect(r2.generated).toBe(1);

    // Non-cycle month: Feb 1 — should not generate
    const dbFeb = buildSequencedDb([[quarterlyConfig]]);
    const rFeb = await generateAutoInvoices({
      db: dbFeb as any, logger: mockLogger, now: new Date(2026, 1, 1),
    });
    expect(rFeb.generated).toBe(0);
  });

  test('generates invoices on semi-annual cycle dates (2 per year)', async () => {
    const semiConfig = makeOrgConfig({
      billingFrequency: 'semi-annual',
      dueDateMonth: 3,
      dueDateDay: 15,
    });

    // Mar 15 — first cycle
    const inserted1: any[] = [];
    const db1 = buildSequencedDb([
      [semiConfig],
      whereResponse([makeMember()]),
      whereResponse([]),
      whereResponse([]),
    ], (val) => inserted1.push(val));

    const r1 = await generateAutoInvoices({
      db: db1 as any, logger: mockLogger, now: new Date(2026, 2, 15),
    });
    expect(r1.generated).toBe(1);
    expect(inserted1[0].periodStart).toBe('2026-03-15');
    expect(inserted1[0].periodEnd).toBe('2026-09-15');

    // Sep 15 — second cycle
    const inserted2: any[] = [];
    const db2 = buildSequencedDb([
      [semiConfig],
      whereResponse([makeMember()]),
      whereResponse([]),
      whereResponse([]),
    ], (val) => inserted2.push(val));

    const r2 = await generateAutoInvoices({
      db: db2 as any, logger: mockLogger, now: new Date(2026, 8, 15),
    });
    expect(r2.generated).toBe(1);
  });

  test('skips members who already have invoice for this period (idempotent)', async () => {
    const db = buildSequencedDb([
      [makeOrgConfig()],
      whereResponse([makeMember()]),
      whereResponse([]),
      whereResponse([{ membershipId: 'mem-1' }]), // already invoiced
    ]);

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('skips life members (amount = 0)', async () => {
    const insertedValues: any[] = [];
    // Category override with amount = 0
    const db = buildSequencedDb([
      [makeOrgConfig()],
      whereResponse([makeMember({ categoryId: 'cat-life' })]),
      whereResponse([{ categoryId: 'cat-life', overrideAmount: 0 }]), // life member override
      whereResponse([]),
    ], (val) => insertedValues.push(val));

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(insertedValues.length).toBe(0);
  });

  test('uses category override amount when available', async () => {
    const insertedValues: any[] = [];
    const db = buildSequencedDb([
      [makeOrgConfig({ defaultAmount: 50000 })],
      whereResponse([makeMember({ categoryId: 'cat-senior' })]),
      whereResponse([{ categoryId: 'cat-senior', overrideAmount: 25000 }]),
      whereResponse([]),
    ], (val) => insertedValues.push(val));

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(1);
    expect(insertedValues[0].totalAmount).toBe(25000);
  });

  test('uses default amount when no category override', async () => {
    const insertedValues: any[] = [];
    const db = buildSequencedDb([
      [makeOrgConfig({ defaultAmount: 50000 })],
      whereResponse([makeMember({ categoryId: 'cat-regular' })]),
      whereResponse([]), // no overrides
      whereResponse([]),
    ], (val) => insertedValues.push(val));

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(1);
    expect(insertedValues[0].totalAmount).toBe(50000);
  });

  test('skips deceased/resigned/expelled members (DB-level notInArray filter)', async () => {
    // The notInArray guard in the SQL query filters out excluded statuses.
    // Simulate: DB returns empty because all members have excluded statuses.
    const db = buildSequencedDb([
      [makeOrgConfig()],
      whereResponse([]), // no eligible members (all deceased/resigned/etc)
    ]);

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  test('per-record error handling — one failure does not halt batch', async () => {
    let insertCount = 0;
    const db = buildSequencedDb([
      [makeOrgConfig()],
      whereResponse([
        makeMember({ id: 'mem-1', personId: 'person-1' }),
        makeMember({ id: 'mem-2', personId: 'person-2' }),
        makeMember({ id: 'mem-3', personId: 'person-3' }),
      ]),
      whereResponse([]),
      whereResponse([]),
    ]);

    // Override insert to fail on second member
    (db as any).insert = () => ({
      values: (val: any) => {
        insertCount++;
        if (val.personId === 'person-2') {
          throw new Error('simulated DB error for person-2');
        }
        return Promise.resolve();
      },
    });

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(2);
    expect(result.errors).toBe(1);
  });

  test('returns correct summary (generated + skipped + errors)', async () => {
    const db = buildSequencedDb([
      [makeOrgConfig()],
      whereResponse([
        makeMember({ id: 'mem-1', personId: 'person-1' }),
        makeMember({ id: 'mem-2', personId: 'person-2' }),
        makeMember({ id: 'mem-3', personId: 'person-3', categoryId: 'cat-life' }),
      ]),
      whereResponse([{ categoryId: 'cat-life', overrideAmount: 0 }]), // life member
      whereResponse([{ membershipId: 'mem-2' }]), // already invoiced
    ]);

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(result.generated).toBe(1);  // mem-1
    expect(result.skipped).toBe(2);    // mem-2 (already invoiced) + mem-3 (life member)
    expect(result.errors).toBe(0);
  });

  test('generates correct invoice number format', async () => {
    const insertedValues: any[] = [];
    const db = buildSequencedDb([
      [makeOrgConfig({ organizationId: 'abcdef12-3456-7890-abcd-ef1234567890' })],
      whereResponse([
        makeMember({ id: 'mem-1', personId: 'person-1', organizationId: 'abcdef12-3456-7890-abcd-ef1234567890' }),
      ]),
      whereResponse([]),
      whereResponse([]),
    ], (val) => insertedValues.push(val));

    await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15),
    });

    expect(insertedValues[0].invoiceNumber).toMatch(/^INV-abcdef12-20260115-0001$/);
  });

  test('handles multiple orgs independently', async () => {
    const insertedValues: any[] = [];
    // Two configs, only one has a billing cycle today
    const db = buildSequencedDb([
      [
        makeOrgConfig({ id: 'config-1', organizationId: 'org-1', dueDateMonth: 1, dueDateDay: 15 }),
        makeOrgConfig({ id: 'config-2', organizationId: 'org-2', dueDateMonth: 6, dueDateDay: 1 }),
      ],
      whereResponse([makeMember({ id: 'mem-1', organizationId: 'org-1' })]),
      whereResponse([]),
      whereResponse([]),
    ], (val) => insertedValues.push(val));

    const result = await generateAutoInvoices({
      db: db as any,
      logger: mockLogger,
      now: new Date(2026, 0, 15), // Only org-1 cycle matches
    });

    expect(result.generated).toBe(1);
    expect(insertedValues[0].organizationId).toBe('org-1');
  });
});
