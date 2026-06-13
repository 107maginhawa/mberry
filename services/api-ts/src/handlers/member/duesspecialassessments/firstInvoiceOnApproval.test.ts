/**
 * [FIX-009 / Q-PD7] First-invoice-on-approval helper.
 *
 * A newly approved member lands `pendingPayment`. The batch generator only picks
 * up `status='active'`, so without this they never get a payable invoice. The
 * `membership.created` domain-event consumer calls `mintFirstDuesInvoice` to mint
 * exactly one open invoice from the org's active dues config — idempotent per
 * (membership, period), scoped strictly to the membership's own org.
 */

import { describe, test, expect, mock } from 'bun:test';
import {
  mintFirstDuesInvoice,
  computeDuesPeriod,
} from './firstInvoiceOnApproval';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { duesConfigs, duesInvoices } from '@/handlers/association:member/repos/dues.schema';

// Mock-Classification: APPROPRIATE — pure cross-table glue; no real-DB harness exists.

type Rows = { memberships?: any[]; configs?: any[]; invoices?: any[] };

function makeDb(rows: Rows) {
  const inserts: Array<{ table: any; values: any }> = [];
  const updates: Array<{ table: any }> = [];

  function rowsFor(table: any): any[] {
    if (table === memberships) return rows.memberships ?? [];
    if (table === duesConfigs) return rows.configs ?? [];
    if (table === duesInvoices) return rows.invoices ?? [];
    return [];
  }

  const db = {
    select: () => ({
      from: (table: any) => ({
        where: (_cond: any) => {
          const result = rowsFor(table);
          const thenable: any = Promise.resolve(result);
          thenable.limit = () => Promise.resolve(result);
          return thenable;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        inserts.push({ table, values });
        return {
          returning: () => Promise.resolve([{ id: 'inv-new', ...values }]),
        };
      },
    }),
    update: (table: any) => {
      updates.push({ table });
      return { set: () => ({ where: () => Promise.resolve() }) };
    },
  } as any;

  return { db, inserts, updates };
}

const ORG_A = 'org-aaaaaaaa-0000-0000-0000-000000000001';
const ORG_B = 'org-bbbbbbbb-0000-0000-0000-000000000002';

const membershipA = {
  id: 'mem-1',
  organizationId: ORG_A,
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'pendingPayment',
};

const configA = {
  id: 'cfg-1',
  organizationId: ORG_A,
  tierId: 'tier-1',
  annualAmount: 200000, // ₱2,000.00 in centavos
  currency: 'PHP',
  cycleStartMonth: 1,
  fundAllocations: [
    { fundName: 'General', percentage: 60, isLast: false },
    { fundName: 'Building', percentage: 40, isLast: true },
  ],
  status: 'active',
};

const payloadA = { membershipId: 'mem-1', personId: 'person-1', organizationId: ORG_A };
const FIXED_NOW = new Date('2026-06-13T00:00:00.000Z');

describe('computeDuesPeriod', () => {
  test('returns the current annual cycle from cycleStartMonth=1', () => {
    const { periodStart, periodEnd } = computeDuesPeriod(1, FIXED_NOW);
    expect(periodStart).toBe('2026-01-01');
    expect(periodEnd).toBe('2026-12-31');
  });

  test('when today precedes the cycle start month, the active cycle began last year', () => {
    // cycleStartMonth = 9 (Sept); today is June 2026 → active cycle is 2025-09..2026-08
    const { periodStart, periodEnd } = computeDuesPeriod(9, FIXED_NOW);
    expect(periodStart).toBe('2025-09-01');
    expect(periodEnd).toBe('2026-08-31');
  });
});

describe('mintFirstDuesInvoice', () => {
  test('mints exactly one invoice using the org dues config amount + fund split', async () => {
    const { db, inserts } = makeDb({ memberships: [membershipA], configs: [configA], invoices: [] });

    const result = await mintFirstDuesInvoice(db, payloadA, undefined, FIXED_NOW);

    expect(result.created).toBe(true);
    expect(result.invoiceId).toBe('inv-new');
    expect(result.amount).toBe(200000);

    const invoiceInserts = inserts.filter((i) => i.table === duesInvoices);
    expect(invoiceInserts).toHaveLength(1);
    const v = invoiceInserts[0]!.values;
    expect(v.membershipId).toBe('mem-1');
    expect(v.personId).toBe('person-1');
    expect(v.organizationId).toBe(ORG_A);
    expect(v.totalAmount).toBe(200000);
    expect(v.status).toBe('generated');
    expect(v.periodStart).toBe('2026-01-01');
    expect(v.periodEnd).toBe('2026-12-31');
    expect(v.fundAllocations).toEqual([
      { fundName: 'General', amount: 120000 },
      { fundName: 'Building', amount: 80000 },
    ]);
  });

  test('idempotent: existing invoice for the same period → no second invoice', async () => {
    const existing = { id: 'inv-existing', membershipId: 'mem-1', periodStart: '2026-01-01', periodEnd: '2026-12-31' };
    const { db, inserts } = makeDb({ memberships: [membershipA], configs: [configA], invoices: [existing] });

    const result = await mintFirstDuesInvoice(db, payloadA, undefined, FIXED_NOW);

    expect(result.created).toBe(false);
    expect(result.reason).toBe('already-invoiced');
    expect(inserts.filter((i) => i.table === duesInvoices)).toHaveLength(0);
  });

  test('cross-org guard: payload org ≠ membership org → never mints (org isolation)', async () => {
    const { db, inserts } = makeDb({ memberships: [membershipA], configs: [configA], invoices: [] });

    // org-B approval event carrying org-A's membership id must not mint anything.
    const result = await mintFirstDuesInvoice(
      db,
      { membershipId: 'mem-1', personId: 'person-1', organizationId: ORG_B },
      undefined,
      FIXED_NOW,
    );

    expect(result.created).toBe(false);
    expect(result.reason).toBe('org-mismatch');
    expect(inserts.filter((i) => i.table === duesInvoices)).toHaveLength(0);
  });

  test('no active dues config for the org → skip (no invoice)', async () => {
    const { db, inserts } = makeDb({ memberships: [membershipA], configs: [], invoices: [] });

    const result = await mintFirstDuesInvoice(db, payloadA, undefined, FIXED_NOW);

    expect(result.created).toBe(false);
    expect(result.reason).toBe('no-config');
    expect(inserts.filter((i) => i.table === duesInvoices)).toHaveLength(0);
  });

  test('missing membership → skip', async () => {
    const { db, inserts } = makeDb({ memberships: [], configs: [configA], invoices: [] });

    const result = await mintFirstDuesInvoice(db, payloadA, undefined, FIXED_NOW);

    expect(result.created).toBe(false);
    expect(result.reason).toBe('no-membership');
    expect(inserts.filter((i) => i.table === duesInvoices)).toHaveLength(0);
  });

  test('prefers the tier-matched config when several active configs exist', async () => {
    const otherTier = { ...configA, id: 'cfg-other', tierId: 'tier-OTHER', annualAmount: 999999 };
    const { db, inserts } = makeDb({
      memberships: [membershipA],
      configs: [otherTier, configA],
      invoices: [],
    });

    const result = await mintFirstDuesInvoice(db, payloadA, undefined, FIXED_NOW);

    expect(result.created).toBe(true);
    const v = inserts.find((i) => i.table === duesInvoices)!.values;
    expect(v.totalAmount).toBe(200000); // tier-1 config, not the 999999 other-tier one
  });

  test('does not mutate membership status (no status regression)', async () => {
    const { db, updates } = makeDb({ memberships: [membershipA], configs: [configA], invoices: [] });

    await mintFirstDuesInvoice(db, payloadA, undefined, FIXED_NOW);

    // The helper only inserts an invoice — it never touches the memberships table.
    expect(updates.filter((u) => u.table === memberships)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Consumer wiring: prove the membership.created event actually mints the invoice
// through the registered domain-event consumer (not just the helper in isolation).
// ---------------------------------------------------------------------------

/** Combined db mock supporting every membership.created consumer (welcome notif,
 *  comms auto-join, first-invoice). select branches by table; insert is awaitable
 *  AND exposes .returning()/.onConflictDoNothing(). */
function makeWiringDb(rows: Rows) {
  const inserts: Array<{ table: any; values: any }> = [];
  const updates: Array<{ table: any }> = [];

  function rowsFor(table: any): any[] {
    if (table === memberships) return rows.memberships ?? [];
    if (table === duesConfigs) return rows.configs ?? [];
    if (table === duesInvoices) return rows.invoices ?? [];
    return [];
  }

  const db = {
    select: (_cols?: any) => ({
      from: (table: any) => ({
        where: (_cond: any) => {
          const result = rowsFor(table);
          const thenable: any = Promise.resolve(result);
          thenable.limit = () => Promise.resolve(result);
          return thenable;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        inserts.push({ table, values });
        const p: any = Promise.resolve([{ id: 'inv-new', ...values }]);
        p.returning = () => Promise.resolve([{ id: 'inv-new', ...values }]);
        p.onConflictDoNothing = () => Promise.resolve();
        return p;
      },
    }),
    update: (table: any) => {
      updates.push({ table });
      return { set: () => ({ where: () => Promise.resolve() }) };
    },
  } as any;

  return { db, inserts, updates };
}

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    child: mock(function (this: any) { return this; }),
  } as any;
}

describe('membership.created → first dues invoice (consumer wiring)', () => {
  test('emitting membership.created mints exactly one invoice and never touches membership status', async () => {
    domainEvents.reset();
    const { db, inserts, updates } = makeWiringDb({
      memberships: [membershipA],
      configs: [configA],
      invoices: [],
    });
    const membershipRepo = {
      findByPersonAndOrg: mock(async () => null),
      updateOneById: mock(async () => ({})),
    };

    registerDomainEventConsumers({ membershipRepo: membershipRepo as any, db }, makeLogger());

    await domainEvents.emit('membership.created', {
      membershipId: 'mem-1',
      personId: 'person-1',
      organizationId: ORG_A,
      source: 'application',
    } as any);
    // let the nested fire-and-forget dues.invoice.generated emit settle
    await new Promise((r) => setTimeout(r, 0));

    const invoiceInserts = inserts.filter((i) => i.table === duesInvoices);
    expect(invoiceInserts).toHaveLength(1);
    expect(invoiceInserts[0]!.values.membershipId).toBe('mem-1');
    // no status regression: the consumer path never updates the memberships table
    expect(updates.filter((u) => u.table === memberships)).toHaveLength(0);

    domainEvents.reset();
  });

  test('membership.created in a foreign org mints nothing (org isolation through the bus)', async () => {
    domainEvents.reset();
    const { db, inserts } = makeWiringDb({
      memberships: [membershipA], // belongs to ORG_A
      configs: [configA],
      invoices: [],
    });
    const membershipRepo = {
      findByPersonAndOrg: mock(async () => null),
      updateOneById: mock(async () => ({})),
    };

    registerDomainEventConsumers({ membershipRepo: membershipRepo as any, db }, makeLogger());

    await domainEvents.emit('membership.created', {
      membershipId: 'mem-1',
      personId: 'person-1',
      organizationId: ORG_B, // mismatched org
      source: 'application',
    } as any);
    await new Promise((r) => setTimeout(r, 0));

    expect(inserts.filter((i) => i.table === duesInvoices)).toHaveLength(0);

    domainEvents.reset();
  });
});
