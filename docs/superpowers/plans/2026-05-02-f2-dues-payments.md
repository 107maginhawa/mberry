# F2: Dues & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dues & Payments module — officer dues configuration, fund allocation, manual payment recording, financial dashboard, payment detail with refund, member payment history, and E2E tests.

**Architecture:** New `dues` handler module wraps the generic billing infrastructure with association-specific domain logic (fund splits, receipt numbering, membership extension). Frontend uses feature-based structure at `apps/memberry/src/features/dues/`.

**Tech Stack:** Drizzle ORM (Postgres), Hono handlers, TanStack Query + Router, shadcn/ui, Playwright E2E

---

## File Map

### Backend (services/api-ts/src/handlers/dues/)

| File | Responsibility |
|------|---------------|
| `repos/dues.schema.ts` | All dues tables (config, funds, payments, fund_allocations, reminders, gateway) |
| `repos/dues.repo.ts` | DuesRepository class — queries for config, funds, payments |
| `getDuesConfig.ts` | GET /api/dues/config/:orgId |
| `upsertDuesConfig.ts` | PUT /api/dues/config/:orgId |
| `listFunds.ts` | GET /api/dues/funds/:orgId |
| `upsertFunds.ts` | PUT /api/dues/funds/:orgId |
| `recordPayment.ts` | POST /api/dues/payments |
| `listPayments.ts` | GET /api/dues/payments |
| `getPayment.ts` | GET /api/dues/payments/:id |
| `refundPayment.ts` | POST /api/dues/payments/:id/refund |
| `getFinancialDashboard.ts` | GET /api/dues/dashboard/:orgId |
| `utils/fund-math.ts` | Last-fund rounding algorithm (M6-R1) |
| `utils/receipt-number.ts` | Receipt number generation (M6-R6) |

### Frontend (apps/memberry/src/features/dues/)

| File | Responsibility |
|------|---------------|
| `lib/fund-math.ts` | Client-side fund split preview (mirrors backend) |
| `lib/fund-math.test.ts` | Unit tests for fund math |
| `components/dues-config-form.tsx` | Rewrite — frequency, grace, category overrides, reminders |
| `components/fund-allocation-editor.tsx` | Drag-reorder funds, live 100% total |
| `components/record-payment-form.tsx` | Member search + amount + live fund preview |
| `components/fund-allocation-preview.tsx` | Read-only fund split display |
| `components/financial-dashboard.tsx` | 4 stat cards + action cards |
| `components/payment-history-table.tsx` | Shared filterable table |
| `components/payment-detail-panel.tsx` | Fund breakdown + refund form |
| `components/refund-form.tsx` | Amount + reason + confirmation |
| `components/payment-filters.tsx` | Filter bar (org/date/status/method) |

### Routes

| File | Screen |
|------|--------|
| `apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/dues.tsx` | Rewrite |
| `apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/funds.tsx` | New |
| `apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments.tsx` | Rewrite |
| `apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/$paymentId.tsx` | New |
| `apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/new.tsx` | New |
| `apps/memberry/src/routes/_authenticated/my/payments.tsx` | Rewrite |

---

## Task 1: Database Schema + Migration

**Files:**
- Create: `services/api-ts/src/handlers/dues/repos/dues.schema.ts`
- Run: migration generation

- [ ] **Step 1: Create dues schema file**

```typescript
// services/api-ts/src/handlers/dues/repos/dues.schema.ts
import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
  text,
  boolean,
  numeric,
  pgEnum,
  index,
  unique,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

// Enums
export const billingFrequencyEnum = pgEnum('billing_frequency', ['annual', 'quarterly']);

export const duesPaymentMethodEnum = pgEnum('dues_payment_method', [
  'online', 'cash', 'check', 'bank_transfer', 'gcash', 'other'
]);

export const duesPaymentStatusEnum = pgEnum('dues_payment_status', [
  'pending', 'completed', 'failed', 'refunded', 'partially_refunded', 'expired'
]);

export const gatewayProviderEnum = pgEnum('gateway_provider', ['paymongo', 'stripe']);

// Tables
export const duesConfigs = pgTable('dues_config', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  defaultAmount: integer('default_amount').notNull(), // cents
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  billingFrequency: billingFrequencyEnum('billing_frequency').notNull().default('annual'),
  dueDateMonth: integer('due_date_month'), // 1-12, annual only
  dueDateDay: integer('due_date_day').notNull().default(1), // 1-31
  gracePeriodDays: integer('grace_period_days').notNull().default(30),
}, (table) => ({
  orgIdx: index('dues_config_org_idx').on(table.organizationId),
  uniqueOrg: unique('dues_config_org_unique').on(table.organizationId),
}));

export const duesCategoryOverrides = pgTable('dues_category_override', {
  ...baseEntityFields,
  duesConfigId: uuid('dues_config_id').notNull().references(() => duesConfigs.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull(),
  overrideAmount: integer('override_amount').notNull(), // cents
}, (table) => ({
  configIdx: index('dues_cat_override_config_idx').on(table.duesConfigId),
  uniqueCatConfig: unique('dues_cat_override_unique').on(table.duesConfigId, table.categoryId),
}));

export const duesFunds = pgTable('dues_fund', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  orgIdx: index('dues_fund_org_idx').on(table.organizationId),
  orgSortIdx: index('dues_fund_org_sort_idx').on(table.organizationId, table.sortOrder),
}));

export const duesPayments = pgTable('dues_payment', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id'), // nullable — links to billing invoice for online payments
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
  amount: integer('amount').notNull(), // cents
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  paymentMethod: duesPaymentMethodEnum('payment_method').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  status: duesPaymentStatusEnum('status').notNull().default('pending'),
  recordedBy: uuid('recorded_by').references(() => persons.id),
  membershipExtendedFrom: date('membership_extended_from'),
  membershipExtendedTo: date('membership_extended_to'),
  paidAt: timestamp('paid_at'),
  expiredAt: timestamp('expired_at'),
  refundedAmount: integer('refunded_amount').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (table) => ({
  orgIdx: index('dues_payment_org_idx').on(table.organizationId),
  personIdx: index('dues_payment_person_idx').on(table.personId),
  statusIdx: index('dues_payment_status_idx').on(table.status),
  orgPersonIdx: index('dues_payment_org_person_idx').on(table.organizationId, table.personId),
  receiptUnique: unique('dues_payment_receipt_unique').on(table.receiptNumber),
}));

export const duesFundAllocations = pgTable('dues_fund_allocation', {
  ...baseEntityFields,
  paymentId: uuid('payment_id').notNull().references(() => duesPayments.id, { onDelete: 'cascade' }),
  fundId: uuid('fund_id').notNull().references(() => duesFunds.id),
  amount: integer('amount').notNull(), // cents (negative for reversals)
  isReversal: boolean('is_reversal').notNull().default(false),
}, (table) => ({
  paymentIdx: index('dues_fund_alloc_payment_idx').on(table.paymentId),
  fundIdx: index('dues_fund_alloc_fund_idx').on(table.fundId),
}));

export const duesReminderSchedules = pgTable('dues_reminder_schedule', {
  ...baseEntityFields,
  duesConfigId: uuid('dues_config_id').notNull().references(() => duesConfigs.id, { onDelete: 'cascade' }),
  daysOffset: integer('days_offset').notNull(), // negative = before expiry
  enabled: boolean('enabled').notNull().default(true),
  channelInapp: boolean('channel_inapp').notNull().default(true),
  channelPush: boolean('channel_push').notNull().default(true),
  channelEmail: boolean('channel_email').notNull().default(true),
  isCustom: boolean('is_custom').notNull().default(false),
}, (table) => ({
  configIdx: index('dues_reminder_config_idx').on(table.duesConfigId),
}));

export const duesGatewayConfigs = pgTable('dues_gateway_config', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  provider: gatewayProviderEnum('provider').notNull(),
  publicKey: varchar('public_key', { length: 255 }).notNull(),
  encryptedSecret: text('encrypted_secret').notNull(),
  connected: boolean('connected').notNull().default(false),
  lastTestAt: timestamp('last_test_at'),
}, (table) => ({
  orgIdx: index('dues_gateway_org_idx').on(table.organizationId),
  uniqueOrg: unique('dues_gateway_org_unique').on(table.organizationId),
}));

// Type exports
export type DuesConfig = typeof duesConfigs.$inferSelect;
export type NewDuesConfig = typeof duesConfigs.$inferInsert;
export type DuesFund = typeof duesFunds.$inferSelect;
export type NewDuesFund = typeof duesFunds.$inferInsert;
export type DuesPayment = typeof duesPayments.$inferSelect;
export type NewDuesPayment = typeof duesPayments.$inferInsert;
export type DuesFundAllocation = typeof duesFundAllocations.$inferSelect;
export type NewDuesFundAllocation = typeof duesFundAllocations.$inferInsert;
export type DuesReminderSchedule = typeof duesReminderSchedules.$inferSelect;
export type DuesGatewayConfig = typeof duesGatewayConfigs.$inferSelect;
```

- [ ] **Step 2: Generate migration**

Run: `cd services/api-ts && bun run db:generate`
Expected: New migration file in `src/generated/migrations/`

- [ ] **Step 3: Verify migration looks correct**

Run: `ls -la services/api-ts/src/generated/migrations/ | tail -3`
Expected: New SQL file with dues tables

- [ ] **Step 4: Commit**

```bash
git add services/api-ts/src/handlers/dues/repos/dues.schema.ts services/api-ts/src/generated/migrations/
git commit -m "feat(f2): add dues module database schema and migration"
```

---

## Task 2: Fund Math Utility (Shared)

**Files:**
- Create: `services/api-ts/src/handlers/dues/utils/fund-math.ts`
- Create: `services/api-ts/src/handlers/dues/utils/fund-math.test.ts`
- Create: `apps/memberry/src/features/dues/lib/fund-math.ts`
- Create: `apps/memberry/src/features/dues/lib/fund-math.test.ts`

- [ ] **Step 1: Write backend fund-math test**

```typescript
// services/api-ts/src/handlers/dues/utils/fund-math.test.ts
import { describe, test, expect } from 'bun:test';
import { allocateFunds, type FundSplit } from './fund-math';

describe('allocateFunds', () => {
  test('splits evenly when divisible', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(1000, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 500 },
      { fundId: 'b', amount: 500 },
    ]);
  });

  test('last fund absorbs remainder (M6-R1)', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(1500, funds);
    // a: floor(1500 * 0.33) = 495
    // b: floor(1500 * 0.33) = 495
    // c: 1500 - 495 - 495 = 510
    expect(result).toEqual([
      { fundId: 'a', amount: 495 },
      { fundId: 'b', amount: 495 },
      { fundId: 'c', amount: 510 },
    ]);
  });

  test('single fund gets full amount', () => {
    const funds: FundSplit[] = [{ fundId: 'a', percentage: 100 }];
    const result = allocateFunds(9999, funds);
    expect(result).toEqual([{ fundId: 'a', amount: 9999 }]);
  });

  test('handles 1 cent total', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(1, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 0 },
      { fundId: 'b', amount: 1 },
    ]);
  });

  test('handles zero amount', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(0, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 0 },
      { fundId: 'b', amount: 0 },
    ]);
  });

  test('many funds with odd percentages', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 10 },
      { fundId: 'b', percentage: 15 },
      { fundId: 'c', percentage: 25 },
      { fundId: 'd', percentage: 50 },
    ];
    const result = allocateFunds(333, funds);
    // a: floor(333 * 0.10) = 33
    // b: floor(333 * 0.15) = 49
    // c: floor(333 * 0.25) = 83
    // d: 333 - 33 - 49 - 83 = 168
    expect(result).toEqual([
      { fundId: 'a', amount: 33 },
      { fundId: 'b', amount: 49 },
      { fundId: 'c', amount: 83 },
      { fundId: 'd', amount: 168 },
    ]);
    // Verify sum equals input
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(333);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/dues/utils/fund-math.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement fund-math**

```typescript
// services/api-ts/src/handlers/dues/utils/fund-math.ts
export interface FundSplit {
  fundId: string;
  percentage: number;
}

export interface FundAllocationResult {
  fundId: string;
  amount: number; // cents
}

/**
 * Allocate a payment amount across funds using last-fund rounding (M6-R1).
 * The last fund in the array absorbs any rounding remainder so the sum
 * always equals the input amount exactly.
 */
export function allocateFunds(amountCents: number, funds: FundSplit[]): FundAllocationResult[] {
  if (funds.length === 0) return [];
  if (funds.length === 1) {
    return [{ fundId: funds[0]!.fundId, amount: amountCents }];
  }

  const results: FundAllocationResult[] = [];
  let allocated = 0;

  for (let i = 0; i < funds.length - 1; i++) {
    const fund = funds[i]!;
    const amount = Math.floor(amountCents * (fund.percentage / 100));
    results.push({ fundId: fund.fundId, amount });
    allocated += amount;
  }

  // Last fund absorbs remainder
  const lastFund = funds[funds.length - 1]!;
  results.push({ fundId: lastFund.fundId, amount: amountCents - allocated });

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/dues/utils/fund-math.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Copy to frontend (identical logic)**

```typescript
// apps/memberry/src/features/dues/lib/fund-math.ts
export interface FundSplit {
  fundId: string;
  percentage: number;
}

export interface FundAllocationResult {
  fundId: string;
  amount: number;
}

/**
 * Allocate a payment amount across funds using last-fund rounding (M6-R1).
 * The last fund absorbs any rounding remainder.
 */
export function allocateFunds(amountCents: number, funds: FundSplit[]): FundAllocationResult[] {
  if (funds.length === 0) return [];
  if (funds.length === 1) {
    return [{ fundId: funds[0]!.fundId, amount: amountCents }];
  }

  const results: FundAllocationResult[] = [];
  let allocated = 0;

  for (let i = 0; i < funds.length - 1; i++) {
    const fund = funds[i]!;
    const amount = Math.floor(amountCents * (fund.percentage / 100));
    results.push({ fundId: fund.fundId, amount });
    allocated += amount;
  }

  const lastFund = funds[funds.length - 1]!;
  results.push({ fundId: lastFund.fundId, amount: amountCents - allocated });

  return results;
}
```

- [ ] **Step 6: Write frontend fund-math test**

```typescript
// apps/memberry/src/features/dues/lib/fund-math.test.ts
import { describe, test, expect } from 'vitest';
import { allocateFunds } from './fund-math';

describe('allocateFunds', () => {
  test('last fund absorbs remainder', () => {
    const result = allocateFunds(1500, [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ]);
    expect(result).toEqual([
      { fundId: 'a', amount: 495 },
      { fundId: 'b', amount: 495 },
      { fundId: 'c', amount: 510 },
    ]);
  });

  test('sum always equals input', () => {
    const result = allocateFunds(999, [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(999);
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add services/api-ts/src/handlers/dues/utils/ apps/memberry/src/features/dues/lib/fund-math.ts apps/memberry/src/features/dues/lib/fund-math.test.ts
git commit -m "feat(f2): add fund allocation math with last-fund rounding (M6-R1)"
```

---

## Task 3: Receipt Number Utility

**Files:**
- Create: `services/api-ts/src/handlers/dues/utils/receipt-number.ts`
- Create: `services/api-ts/src/handlers/dues/utils/receipt-number.test.ts`

- [ ] **Step 1: Write receipt number test**

```typescript
// services/api-ts/src/handlers/dues/utils/receipt-number.test.ts
import { describe, test, expect } from 'bun:test';
import { formatReceiptNumber, parseReceiptNumber } from './receipt-number';

describe('formatReceiptNumber', () => {
  test('formats with zero-padded sequence', () => {
    expect(formatReceiptNumber('PDA', 2026, 1)).toBe('PDA-2026-000001');
    expect(formatReceiptNumber('PDA', 2026, 42)).toBe('PDA-2026-000042');
    expect(formatReceiptNumber('PDA', 2026, 999999)).toBe('PDA-2026-999999');
  });
});

describe('parseReceiptNumber', () => {
  test('parses valid receipt number', () => {
    expect(parseReceiptNumber('PDA-2026-000042')).toEqual({
      orgCode: 'PDA',
      year: 2026,
      sequence: 42,
    });
  });

  test('returns null for invalid format', () => {
    expect(parseReceiptNumber('invalid')).toBeNull();
    expect(parseReceiptNumber('PDA-2026')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/dues/utils/receipt-number.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement receipt-number**

```typescript
// services/api-ts/src/handlers/dues/utils/receipt-number.ts

/**
 * Receipt number format: ORG_CODE-YEAR-NNNNNN (M6-R6)
 */
export function formatReceiptNumber(orgCode: string, year: number, sequence: number): string {
  return `${orgCode}-${year}-${sequence.toString().padStart(6, '0')}`;
}

export function parseReceiptNumber(receipt: string): { orgCode: string; year: number; sequence: number } | null {
  const match = receipt.match(/^([A-Z]+)-(\d{4})-(\d{6})$/);
  if (!match) return null;
  return {
    orgCode: match[1]!,
    year: parseInt(match[2]!, 10),
    sequence: parseInt(match[3]!, 10),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/dues/utils/receipt-number.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/dues/utils/receipt-number.ts services/api-ts/src/handlers/dues/utils/receipt-number.test.ts
git commit -m "feat(f2): add receipt number formatting (M6-R6)"
```

---

## Task 4: Dues Repository

**Files:**
- Create: `services/api-ts/src/handlers/dues/repos/dues.repo.ts`

- [ ] **Step 1: Implement DuesRepository**

```typescript
// services/api-ts/src/handlers/dues/repos/dues.repo.ts
import { eq, and, desc, sql, gte, lte, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  duesConfigs,
  duesCategoryOverrides,
  duesFunds,
  duesPayments,
  duesFundAllocations,
  duesReminderSchedules,
  duesGatewayConfigs,
  type DuesConfig,
  type NewDuesConfig,
  type DuesFund,
  type NewDuesFund,
  type DuesPayment,
  type NewDuesPayment,
  type NewDuesFundAllocation,
  type DuesReminderSchedule,
  type DuesGatewayConfig,
} from './dues.schema';

export class DuesRepository {
  constructor(private db: DatabaseInstance) {}

  // ─── Config ───────────────────────────────────────────

  async getConfig(organizationId: string): Promise<DuesConfig | undefined> {
    const [config] = await this.db
      .select()
      .from(duesConfigs)
      .where(eq(duesConfigs.organizationId, organizationId))
      .limit(1);
    return config;
  }

  async upsertConfig(organizationId: string, data: Omit<NewDuesConfig, 'organizationId'>): Promise<DuesConfig> {
    const [result] = await this.db
      .insert(duesConfigs)
      .values({ ...data, organizationId })
      .onConflictDoUpdate({
        target: [duesConfigs.organizationId],
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return result!;
  }

  async getCategoryOverrides(duesConfigId: string) {
    return this.db
      .select()
      .from(duesCategoryOverrides)
      .where(eq(duesCategoryOverrides.duesConfigId, duesConfigId));
  }

  async replaceCategoryOverrides(duesConfigId: string, overrides: { categoryId: string; overrideAmount: number }[]) {
    await this.db.delete(duesCategoryOverrides).where(eq(duesCategoryOverrides.duesConfigId, duesConfigId));
    if (overrides.length > 0) {
      await this.db.insert(duesCategoryOverrides).values(
        overrides.map((o) => ({ duesConfigId, ...o }))
      );
    }
  }

  // ─── Funds ────────────────────────────────────────────

  async listFunds(organizationId: string): Promise<DuesFund[]> {
    return this.db
      .select()
      .from(duesFunds)
      .where(and(eq(duesFunds.organizationId, organizationId), eq(duesFunds.active, true)))
      .orderBy(duesFunds.sortOrder);
  }

  async replaceFunds(organizationId: string, funds: { name: string; percentage: string; sortOrder: number }[]) {
    // Deactivate all existing
    await this.db
      .update(duesFunds)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(duesFunds.organizationId, organizationId));

    if (funds.length > 0) {
      await this.db.insert(duesFunds).values(
        funds.map((f) => ({ organizationId, name: f.name, percentage: f.percentage, sortOrder: f.sortOrder, active: true }))
      );
    }
  }

  // ─── Payments ─────────────────────────────────────────

  async listPayments(filters: {
    organizationId?: string;
    personId?: string;
    status?: string;
    method?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: DuesPayment[]; total: number }> {
    const conditions: SQL<unknown>[] = [];

    if (filters.organizationId) conditions.push(eq(duesPayments.organizationId, filters.organizationId));
    if (filters.personId) conditions.push(eq(duesPayments.personId, filters.personId));
    if (filters.status) conditions.push(eq(duesPayments.status, filters.status as any));
    if (filters.method) conditions.push(eq(duesPayments.paymentMethod, filters.method as any));
    if (filters.fromDate) conditions.push(gte(duesPayments.paidAt, filters.fromDate));
    if (filters.toDate) conditions.push(lte(duesPayments.paidAt, filters.toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(duesPayments)
        .where(where)
        .orderBy(desc(duesPayments.paidAt))
        .limit(filters.limit ?? 25)
        .offset(filters.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(duesPayments)
        .where(where),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async getPayment(id: string): Promise<DuesPayment | undefined> {
    const [payment] = await this.db
      .select()
      .from(duesPayments)
      .where(eq(duesPayments.id, id))
      .limit(1);
    return payment;
  }

  async createPayment(data: NewDuesPayment): Promise<DuesPayment> {
    const [result] = await this.db.insert(duesPayments).values(data).returning();
    return result!;
  }

  async updatePaymentStatus(id: string, status: string, extra?: Partial<DuesPayment>): Promise<DuesPayment> {
    const [result] = await this.db
      .update(duesPayments)
      .set({ status: status as any, ...extra, updatedAt: new Date() })
      .where(eq(duesPayments.id, id))
      .returning();
    return result!;
  }

  async createFundAllocations(allocations: NewDuesFundAllocation[]) {
    if (allocations.length > 0) {
      await this.db.insert(duesFundAllocations).values(allocations);
    }
  }

  async getFundAllocations(paymentId: string) {
    return this.db
      .select()
      .from(duesFundAllocations)
      .where(eq(duesFundAllocations.paymentId, paymentId));
  }

  // Concurrent payment detection (M6-R4)
  async findRecentPaymentForPerson(organizationId: string, personId: string, withinMinutes: number = 5): Promise<DuesPayment | undefined> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
    const [recent] = await this.db
      .select()
      .from(duesPayments)
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        eq(duesPayments.personId, personId),
        gte(duesPayments.createdAt, cutoff),
      ))
      .orderBy(desc(duesPayments.createdAt))
      .limit(1);
    return recent;
  }

  // Receipt number: get next sequence for org+year
  async getNextReceiptSequence(organizationId: string, year: number): Promise<number> {
    const pattern = `%-${year}-%`;
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(duesPayments)
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        sql`${duesPayments.receiptNumber} LIKE ${pattern}`,
      ));
    return (result?.count ?? 0) + 1;
  }

  // ─── Dashboard Stats ──────────────────────────────────

  async getDashboardStats(organizationId: string) {
    const [stats] = await this.db
      .select({
        totalCollected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int`,
        totalOutstanding: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::int`,
        pendingCount: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)::int`,
        completedCount: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)::int`,
        totalCount: sql<number>`COUNT(*)::int`,
      })
      .from(duesPayments)
      .where(eq(duesPayments.organizationId, organizationId));

    return {
      totalCollected: stats?.totalCollected ?? 0,
      totalOutstanding: stats?.totalOutstanding ?? 0,
      pendingCount: stats?.pendingCount ?? 0,
      completedCount: stats?.completedCount ?? 0,
      totalCount: stats?.totalCount ?? 0,
      collectionRate: stats?.totalCount
        ? Math.round(((stats?.completedCount ?? 0) / stats.totalCount) * 100)
        : 0,
    };
  }

  // ─── Reminders ────────────────────────────────────────

  async getReminderSchedules(duesConfigId: string): Promise<DuesReminderSchedule[]> {
    return this.db
      .select()
      .from(duesReminderSchedules)
      .where(eq(duesReminderSchedules.duesConfigId, duesConfigId))
      .orderBy(duesReminderSchedules.daysOffset);
  }

  async replaceReminderSchedules(duesConfigId: string, schedules: Omit<DuesReminderSchedule, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy' | 'updatedBy' | 'duesConfigId'>[]) {
    await this.db.delete(duesReminderSchedules).where(eq(duesReminderSchedules.duesConfigId, duesConfigId));
    if (schedules.length > 0) {
      await this.db.insert(duesReminderSchedules).values(
        schedules.map((s) => ({ ...s, duesConfigId }))
      );
    }
  }

  // ─── Gateway ──────────────────────────────────────────

  async getGatewayConfig(organizationId: string): Promise<DuesGatewayConfig | undefined> {
    const [config] = await this.db
      .select()
      .from(duesGatewayConfigs)
      .where(eq(duesGatewayConfigs.organizationId, organizationId))
      .limit(1);
    return config;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/api-ts/src/handlers/dues/repos/dues.repo.ts
git commit -m "feat(f2): add DuesRepository with config, funds, payments, dashboard queries"
```

---

## Task 5: Backend Handlers — Config + Funds

**Files:**
- Create: `services/api-ts/src/handlers/dues/getDuesConfig.ts`
- Create: `services/api-ts/src/handlers/dues/upsertDuesConfig.ts`
- Create: `services/api-ts/src/handlers/dues/listFunds.ts`
- Create: `services/api-ts/src/handlers/dues/upsertFunds.ts`

- [ ] **Step 1: Implement getDuesConfig handler**

```typescript
// services/api-ts/src/handlers/dues/getDuesConfig.ts
import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function getDuesConfig(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const repo = new DuesRepository(db);

  const config = await repo.getConfig(orgId);
  if (!config) {
    return ctx.json({ data: null }, 200);
  }

  const overrides = await repo.getCategoryOverrides(config.id);
  const reminders = await repo.getReminderSchedules(config.id);

  return ctx.json({
    data: {
      ...config,
      categoryOverrides: overrides,
      reminderSchedules: reminders,
    },
  }, 200);
}
```

- [ ] **Step 2: Implement upsertDuesConfig handler**

```typescript
// services/api-ts/src/handlers/dues/upsertDuesConfig.ts
import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import type { Session } from '@/types/auth';

export async function upsertDuesConfig(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const config = await repo.upsertConfig(orgId, {
    defaultAmount: body.defaultAmount,
    currency: body.currency ?? 'PHP',
    billingFrequency: body.billingFrequency ?? 'annual',
    dueDateMonth: body.dueDateMonth,
    dueDateDay: body.dueDateDay ?? 1,
    gracePeriodDays: body.gracePeriodDays ?? 30,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  // Replace category overrides
  if (body.categoryOverrides) {
    await repo.replaceCategoryOverrides(config.id, body.categoryOverrides);
  }

  // Replace reminder schedules
  if (body.reminderSchedules) {
    await repo.replaceReminderSchedules(config.id, body.reminderSchedules);
  }

  return ctx.json({ data: config }, 200);
}
```

- [ ] **Step 3: Implement listFunds handler**

```typescript
// services/api-ts/src/handlers/dues/listFunds.ts
import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function listFunds(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const repo = new DuesRepository(db);

  const funds = await repo.listFunds(orgId);
  return ctx.json({ data: funds }, 200);
}
```

- [ ] **Step 4: Implement upsertFunds handler**

```typescript
// services/api-ts/src/handlers/dues/upsertFunds.ts
import type { Context } from 'hono';
import { ValidationError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';

export async function upsertFunds(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const funds: { name: string; percentage: string; sortOrder: number }[] = body.funds;

  // Validate 100% total
  const total = funds.reduce((sum, f) => sum + parseFloat(f.percentage), 0);
  if (Math.abs(total - 100) > 0.001) {
    throw new ValidationError('Fund percentages must total exactly 100%');
  }

  await repo.replaceFunds(orgId, funds);

  const updated = await repo.listFunds(orgId);
  return ctx.json({ data: updated }, 200);
}
```

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/dues/getDuesConfig.ts services/api-ts/src/handlers/dues/upsertDuesConfig.ts services/api-ts/src/handlers/dues/listFunds.ts services/api-ts/src/handlers/dues/upsertFunds.ts
git commit -m "feat(f2): add dues config and funds handlers"
```

---

## Task 6: Backend Handlers — Payments

**Files:**
- Create: `services/api-ts/src/handlers/dues/recordPayment.ts`
- Create: `services/api-ts/src/handlers/dues/listPayments.ts`
- Create: `services/api-ts/src/handlers/dues/getPayment.ts`
- Create: `services/api-ts/src/handlers/dues/refundPayment.ts`
- Create: `services/api-ts/src/handlers/dues/getFinancialDashboard.ts`

- [ ] **Step 1: Implement recordPayment**

```typescript
// services/api-ts/src/handlers/dues/recordPayment.ts
import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import { allocateFunds } from './utils/fund-math';
import { formatReceiptNumber } from './utils/receipt-number';
import type { Session } from '@/types/auth';

export async function recordPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const { organizationId, personId, amount, currency, paymentMethod, referenceNumber, orgCode } = body;

  // Check concurrent payment (M6-R4)
  const recentPayment = await repo.findRecentPaymentForPerson(organizationId, personId);
  const hasConcurrentWarning = !!recentPayment;

  // Generate receipt number (M6-R6)
  const year = new Date().getFullYear();
  const sequence = await repo.getNextReceiptSequence(organizationId, year);
  const receiptNumber = formatReceiptNumber(orgCode || 'ORG', year, sequence);

  // Create payment
  const payment = await repo.createPayment({
    organizationId,
    personId,
    receiptNumber,
    amount,
    currency: currency ?? 'PHP',
    paymentMethod,
    referenceNumber,
    status: 'completed',
    recordedBy: session.user.id,
    paidAt: new Date(),
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  // Fund allocations
  const funds = await repo.listFunds(organizationId);
  if (funds.length > 0) {
    const splits = allocateFunds(amount, funds.map((f) => ({
      fundId: f.id,
      percentage: parseFloat(f.percentage),
    })));
    await repo.createFundAllocations(
      splits.map((s) => ({
        paymentId: payment.id,
        fundId: s.fundId,
        amount: s.amount,
        isReversal: false,
      }))
    );
  }

  return ctx.json({
    data: payment,
    meta: { concurrentWarning: hasConcurrentWarning, recentPayment },
  }, 201);
}
```

- [ ] **Step 2: Implement listPayments**

```typescript
// services/api-ts/src/handlers/dues/listPayments.ts
import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import type { Session } from '@/types/auth';

export async function listPayments(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new DuesRepository(db);

  const scope = ctx.req.query('scope'); // 'member' or 'org'
  const orgId = ctx.req.query('organizationId');
  const status = ctx.req.query('status');
  const method = ctx.req.query('method');
  const from = ctx.req.query('from');
  const to = ctx.req.query('to');
  const limit = parseInt(ctx.req.query('limit') ?? '25', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const filters: any = { limit, offset };

  if (scope === 'member') {
    filters.personId = session.user.id;
  } else if (orgId) {
    filters.organizationId = orgId;
  }

  if (status) filters.status = status;
  if (method) filters.method = method;
  if (from) filters.fromDate = new Date(from);
  if (to) filters.toDate = new Date(to);

  const result = await repo.listPayments(filters);

  return ctx.json({
    data: result.data,
    meta: { total: result.total, limit, offset },
  }, 200);
}
```

- [ ] **Step 3: Implement getPayment**

```typescript
// services/api-ts/src/handlers/dues/getPayment.ts
import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';

export async function getPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(id);
  if (!payment) throw new NotFoundError('Payment not found');

  const allocations = await repo.getFundAllocations(id);

  return ctx.json({
    data: { ...payment, fundAllocations: allocations },
  }, 200);
}
```

- [ ] **Step 4: Implement refundPayment**

```typescript
// services/api-ts/src/handlers/dues/refundPayment.ts
import type { Context } from 'hono';
import { NotFoundError, ValidationError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';
import type { Session } from '@/types/auth';

export async function refundPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(id);
  if (!payment) throw new NotFoundError('Payment not found');

  const refundAmount = body.amount ?? payment.amount;
  const maxRefundable = payment.amount - payment.refundedAmount;

  if (refundAmount > maxRefundable) {
    throw new ValidationError(`Refund cannot exceed ${maxRefundable} cents (remaining refundable amount)`);
  }

  // Create reversal fund allocations
  const allocations = await repo.getFundAllocations(id);
  const originalAllocations = allocations.filter((a) => !a.isReversal);

  if (originalAllocations.length > 0) {
    const refundRatio = refundAmount / payment.amount;
    const reversals = originalAllocations.map((a) => ({
      paymentId: id,
      fundId: a.fundId,
      amount: -Math.round(a.amount * refundRatio),
      isReversal: true,
    }));
    await repo.createFundAllocations(reversals);
  }

  // Update payment status
  const newRefundedAmount = payment.refundedAmount + refundAmount;
  const newStatus = newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';

  const updated = await repo.updatePaymentStatus(id, newStatus, {
    refundedAmount: newRefundedAmount,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
```

- [ ] **Step 5: Implement getFinancialDashboard**

```typescript
// services/api-ts/src/handlers/dues/getFinancialDashboard.ts
import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function getFinancialDashboard(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const repo = new DuesRepository(db);

  const stats = await repo.getDashboardStats(orgId);
  const gatewayConfig = await repo.getGatewayConfig(orgId);

  return ctx.json({
    data: {
      ...stats,
      gatewayConnected: gatewayConfig?.connected ?? false,
    },
  }, 200);
}
```

- [ ] **Step 6: Commit**

```bash
git add services/api-ts/src/handlers/dues/recordPayment.ts services/api-ts/src/handlers/dues/listPayments.ts services/api-ts/src/handlers/dues/getPayment.ts services/api-ts/src/handlers/dues/refundPayment.ts services/api-ts/src/handlers/dues/getFinancialDashboard.ts
git commit -m "feat(f2): add payment recording, listing, detail, refund, and dashboard handlers"
```

---

## Task 7: Register Dues Routes

**Files:**
- Create: `services/api-ts/src/handlers/dues/index.ts`
- Modify: `services/api-ts/src/index.ts` (add dues routes)

- [ ] **Step 1: Create dues router**

```typescript
// services/api-ts/src/handlers/dues/index.ts
import { Hono } from 'hono';
import { getDuesConfig } from './getDuesConfig';
import { upsertDuesConfig } from './upsertDuesConfig';
import { listFunds } from './listFunds';
import { upsertFunds } from './upsertFunds';
import { recordPayment } from './recordPayment';
import { listPayments } from './listPayments';
import { getPayment } from './getPayment';
import { refundPayment } from './refundPayment';
import { getFinancialDashboard } from './getFinancialDashboard';

const dues = new Hono();

// Config
dues.get('/config/:orgId', getDuesConfig);
dues.put('/config/:orgId', upsertDuesConfig);

// Funds
dues.get('/funds/:orgId', listFunds);
dues.put('/funds/:orgId', upsertFunds);

// Payments
dues.get('/payments', listPayments);
dues.get('/payments/:id', getPayment);
dues.post('/payments', recordPayment);
dues.post('/payments/:id/refund', refundPayment);

// Dashboard
dues.get('/dashboard/:orgId', getFinancialDashboard);

export { dues };
```

- [ ] **Step 2: Register in main app**

Add to the main Hono app file (find where other handler routes are registered and add):

```typescript
import { dues } from './handlers/dues';
// ... in route registration section:
app.route('/api/dues', dues);
```

- [ ] **Step 3: Verify server starts**

Run: `cd services/api-ts && bun run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add services/api-ts/src/handlers/dues/index.ts services/api-ts/src/index.ts
git commit -m "feat(f2): register dues API routes at /api/dues"
```

---

## Task 8: Frontend — Fund Allocation Editor Component

**Files:**
- Create: `apps/memberry/src/features/dues/components/fund-allocation-editor.tsx`

- [ ] **Step 1: Implement fund allocation editor**

```tsx
// apps/memberry/src/features/dues/components/fund-allocation-editor.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GripVertical, Trash2, Plus } from 'lucide-react'

interface Fund {
  id?: string
  name: string
  percentage: string
}

interface FundAllocationEditorProps {
  funds: Fund[]
  onChange: (funds: Fund[]) => void
  disabled?: boolean
}

export function FundAllocationEditor({ funds, onChange, disabled }: FundAllocationEditorProps) {
  const total = funds.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0)
  const isValid = Math.abs(total - 100) < 0.001

  const addFund = () => {
    onChange([...funds, { name: '', percentage: '' }])
  }

  const removeFund = (index: number) => {
    onChange(funds.filter((_, i) => i !== index))
  }

  const updateFund = (index: number, field: keyof Fund, value: string) => {
    const updated = [...funds]
    updated[index] = { ...updated[index]!, [field]: value }
    onChange(updated)
  }

  const moveFund = (from: number, to: number) => {
    const updated = [...funds]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved!)
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Fund Allocations</Label>
        <Button type="button" variant="outline" size="sm" onClick={addFund} disabled={disabled}>
          <Plus className="h-3 w-3 mr-1" /> Add Fund
        </Button>
      </div>

      {funds.map((fund, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => {
              // Simple swap on click — full drag-and-drop in future iteration
              if (i > 0) moveFund(i, i - 1)
            }}
            disabled={disabled}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Input
            value={fund.name}
            onChange={(e) => updateFund(i, 'name', e.target.value)}
            placeholder="Fund name"
            className="flex-1"
            disabled={disabled}
          />
          <div className="flex items-center gap-1 w-28">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={fund.percentage}
              onChange={(e) => updateFund(i, 'percentage', e.target.value)}
              className="w-20"
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          {funds.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeFund(i)}
              disabled={disabled}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {/* Last fund tooltip */}
      {funds.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Last fund absorbs rounding remainder to ensure exact totals.
        </p>
      )}

      {/* Total indicator */}
      <div className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-destructive'}`}>
        Total: {total.toFixed(2)}%
        {!isValid && <span className="ml-2 font-normal">Must equal exactly 100%</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/memberry/src/features/dues/components/fund-allocation-editor.tsx
git commit -m "feat(f2): add FundAllocationEditor component with live 100% validation"
```

---

## Task 9: Frontend — Dues Config Form (Rewrite)

**Files:**
- Modify: `apps/memberry/src/features/dues/components/dues-config-form.tsx`

- [ ] **Step 1: Rewrite dues-config-form to match spec**

```tsx
// apps/memberry/src/features/dues/components/dues-config-form.tsx
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { parseCentsInput, formatCents } from '../lib/money'

interface DuesConfigFormProps {
  orgId: string
}

interface ReminderRow {
  daysOffset: number
  enabled: boolean
  channelInapp: boolean
  channelPush: boolean
  channelEmail: boolean
  isCustom: boolean
}

const DEFAULT_REMINDERS: ReminderRow[] = [
  { daysOffset: -60, enabled: true, channelInapp: true, channelPush: true, channelEmail: true, isCustom: false },
  { daysOffset: -30, enabled: true, channelInapp: true, channelPush: true, channelEmail: true, isCustom: false },
  { daysOffset: -7, enabled: true, channelInapp: true, channelPush: true, channelEmail: true, isCustom: false },
  { daysOffset: 0, enabled: true, channelInapp: true, channelPush: true, channelEmail: false, isCustom: false },
  { daysOffset: 7, enabled: true, channelInapp: true, channelPush: false, channelEmail: true, isCustom: false },
  { daysOffset: 30, enabled: true, channelInapp: true, channelPush: false, channelEmail: true, isCustom: false },
]

export function DuesConfigForm({ orgId }: DuesConfigFormProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [defaultAmount, setDefaultAmount] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [billingFrequency, setBillingFrequency] = useState<'annual' | 'quarterly'>('annual')
  const [dueDateMonth, setDueDateMonth] = useState('1')
  const [dueDateDay, setDueDateDay] = useState('1')
  const [gracePeriodDays, setGracePeriodDays] = useState('30')
  const [reminders, setReminders] = useState<ReminderRow[]>(DEFAULT_REMINDERS)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ['dues-config', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/config/${orgId}`)
      const json = await res.json()
      return json.data
    },
  })

  // Populate form from existing config
  useEffect(() => {
    if (config) {
      setDefaultAmount((config.defaultAmount / 100).toFixed(2))
      setCurrency(config.currency)
      setBillingFrequency(config.billingFrequency)
      setDueDateMonth(String(config.dueDateMonth ?? 1))
      setDueDateDay(String(config.dueDateDay))
      setGracePeriodDays(String(config.gracePeriodDays))
      if (config.reminderSchedules?.length > 0) {
        setReminders(config.reminderSchedules)
      }
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dues/config/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultAmount: parseCentsInput(defaultAmount),
          currency,
          billingFrequency,
          dueDateMonth: billingFrequency === 'annual' ? parseInt(dueDateMonth) : null,
          dueDateDay: parseInt(dueDateDay),
          gracePeriodDays: parseInt(gracePeriodDays),
          reminderSchedules: reminders,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues-config', orgId] })
      toast({ title: 'Dues configuration updated', description: 'Applies to future billing cycles.' })
      setHasChanges(false)
    },
    onError: () => {
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' })
    },
  })

  const handleChange = () => setHasChanges(true)

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
  }

  const gracePeriodError = parseInt(gracePeriodDays) < 0 || parseInt(gracePeriodDays) > 365

  return (
    <div className="space-y-8 max-w-2xl">
      {!config && (
        <p className="text-sm text-muted-foreground">Set up your dues structure to start collecting membership dues.</p>
      )}

      {/* Section 1: Default Dues */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Default Dues</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Default Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={defaultAmount}
              onChange={(e) => { setDefaultAmount(e.target.value); handleChange() }}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => { setCurrency(v); handleChange() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHP">PHP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Billing Frequency</Label>
            <Select value={billingFrequency} onValueChange={(v) => { setBillingFrequency(v as any); handleChange() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due Date {billingFrequency === 'annual' ? '(Month + Day)' : '(Day of quarter)'}</Label>
            <div className="flex gap-2">
              {billingFrequency === 'annual' && (
                <Select value={dueDateMonth} onValueChange={(v) => { setDueDateMonth(v); handleChange() }}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                type="number"
                min="1"
                max="31"
                value={dueDateDay}
                onChange={(e) => { setDueDateDay(e.target.value); handleChange() }}
                className="w-20"
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Grace Period (days)</Label>
          <Input
            type="number"
            min="0"
            max="365"
            value={gracePeriodDays}
            onChange={(e) => { setGracePeriodDays(e.target.value); handleChange() }}
            className="w-32"
          />
          {gracePeriodError && (
            <p className="text-xs text-destructive mt-1">Grace period must be 0–365 days.</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Members have this many days after due date before status changes to Lapsed.</p>
        </div>
      </section>

      {/* Section 2: Reminder Schedule */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Reminder Schedule</h3>
        <div className="space-y-2">
          {reminders.map((r, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Switch
                checked={r.enabled}
                onCheckedChange={(checked) => {
                  const updated = [...reminders]
                  updated[i] = { ...updated[i]!, enabled: checked }
                  setReminders(updated)
                  handleChange()
                }}
              />
              <span className="w-40">
                {r.daysOffset < 0 ? `${Math.abs(r.daysOffset)} days before` : r.daysOffset === 0 ? 'Day of expiry' : `${r.daysOffset} days after`}
              </span>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={r.channelPush} onChange={(e) => {
                  const updated = [...reminders]; updated[i] = { ...updated[i]!, channelPush: e.target.checked }; setReminders(updated); handleChange()
                }} className="rounded" />
                Push
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={r.channelEmail} onChange={(e) => {
                  const updated = [...reminders]; updated[i] = { ...updated[i]!, channelEmail: e.target.checked }; setReminders(updated); handleChange()
                }} className="rounded" />
                Email
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || gracePeriodError || !defaultAmount}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        {hasChanges && (
          <span className="text-xs text-muted-foreground self-center">Unsaved changes</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/memberry/src/features/dues/components/dues-config-form.tsx
git commit -m "feat(f2): rewrite DuesConfigForm — frequency, grace period, reminders"
```

---

## Task 10: Frontend — Fund Settings Page

**Files:**
- Create: `apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/funds.tsx`

- [ ] **Step 1: Implement funds settings route**

```tsx
// apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/funds.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { FundAllocationEditor } from '@/features/dues/components/fund-allocation-editor'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/funds')({
  component: FundSettingsPage,
})

function FundSettingsPage() {
  const { orgId } = Route.useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [funds, setFunds] = useState<{ id?: string; name: string; percentage: string }[]>([
    { name: 'General Fund', percentage: '100' },
  ])
  const [hasChanges, setHasChanges] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dues-funds', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/funds/${orgId}`)
      return (await res.json()).data
    },
  })

  useEffect(() => {
    if (data && data.length > 0) {
      setFunds(data.map((f: any) => ({ id: f.id, name: f.name, percentage: f.percentage })))
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dues/funds/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funds: funds.map((f, i) => ({ name: f.name, percentage: f.percentage, sortOrder: i })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues-funds', orgId] })
      toast({ title: 'Fund allocation updated', description: 'New allocation applies to future payments.' })
      setHasChanges(false)
    },
    onError: (err) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' })
    },
  })

  const total = funds.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0)
  const isValid = Math.abs(total - 100) < 0.001

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-64 w-full max-w-2xl" /></div>
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fund Allocation</h1>
        {hasChanges && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
      </div>

      {data && data.length > 0 && (
        <Alert>
          <AlertDescription>
            Existing payment allocations will not be recalculated. Only future payments will use the new allocation.
          </AlertDescription>
        </Alert>
      )}

      <FundAllocationEditor
        funds={funds}
        onChange={(updated) => { setFunds(updated); setHasChanges(true) }}
        disabled={saveMutation.isPending}
      />

      <div className="flex gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!isValid || saveMutation.isPending || !hasChanges}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (data && data.length > 0) {
              setFunds(data.map((f: any) => ({ id: f.id, name: f.name, percentage: f.percentage })))
            }
            setHasChanges(false)
          }}
          disabled={!hasChanges}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/org/\$orgId/officer/settings/funds.tsx
git commit -m "feat(f2): add fund allocation settings page"
```

---

## Task 11: Frontend — Record Payment Form + Route

**Files:**
- Create: `apps/memberry/src/features/dues/components/fund-allocation-preview.tsx`
- Create: `apps/memberry/src/features/dues/components/record-payment-form.tsx`
- Create: `apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/new.tsx`

- [ ] **Step 1: Implement FundAllocationPreview**

```tsx
// apps/memberry/src/features/dues/components/fund-allocation-preview.tsx
import { formatCents } from '../lib/money'
import { allocateFunds, type FundSplit } from '../lib/fund-math'

interface FundAllocationPreviewProps {
  amountCents: number
  funds: FundSplit[]
  currency?: string
}

export function FundAllocationPreview({ amountCents, funds, currency = 'PHP' }: FundAllocationPreviewProps) {
  if (funds.length === 0) {
    return <p className="text-sm text-muted-foreground">All payments go to the General Fund.</p>
  }

  const allocations = allocateFunds(amountCents, funds)

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Fund Allocation Preview</h4>
      <div className="space-y-1">
        {allocations.map((alloc, i) => (
          <div key={alloc.fundId} className="flex justify-between text-sm">
            <span>{funds[i]?.fundId ?? `Fund ${i + 1}`}</span>
            <span className="font-mono">{formatCents(alloc.amount, currency)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-medium border-t pt-1">
        <span>Total</span>
        <span className="font-mono">{formatCents(amountCents, currency)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement RecordPaymentForm**

```tsx
// apps/memberry/src/features/dues/components/record-payment-form.tsx
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { parseCentsInput } from '../lib/money'
import { FundAllocationPreview } from './fund-allocation-preview'

interface RecordPaymentFormProps {
  orgId: string
}

export function RecordPaymentForm({ orgId }: RecordPaymentFormProps) {
  const { toast } = useToast()

  const [personId, setPersonId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [showConfirm, setShowConfirm] = useState(false)
  const [concurrentWarning, setConcurrentWarning] = useState<any>(null)

  // Fetch funds for preview
  const { data: fundsData } = useQuery({
    queryKey: ['dues-funds', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/funds/${orgId}`)
      return (await res.json()).data
    },
  })

  const funds = (fundsData ?? []).map((f: any) => ({
    fundId: f.name,
    percentage: parseFloat(f.percentage),
  }))

  const amountCents = parseCentsInput(amount)

  const recordMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/dues/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          personId,
          amount: amountCents,
          currency: 'PHP',
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to record payment')
      return res.json()
    },
    onSuccess: (data) => {
      setShowConfirm(false)
      toast({ title: 'Payment recorded', description: `Receipt sent to member.` })
      // Reset form
      setPersonId('')
      setMemberSearch('')
      setAmount('')
      setPaymentMethod('')
      setReferenceNumber('')
    },
    onError: () => {
      toast({ title: 'Failed to record payment', description: 'Please try again.', variant: 'destructive' })
    },
  })

  const canSubmit = personId && amountCents > 0 && paymentMethod

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowConfirm(true) }}>
        {/* Member search */}
        <div>
          <Label>Member</Label>
          <Input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search by name or license number..."
          />
          {/* TODO: Autocomplete results — for now, direct ID input */}
          <Input
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            placeholder="Person ID (temporary — autocomplete in next iteration)"
            className="mt-2 text-xs"
          />
        </div>

        {/* Amount */}
        <div>
          <Label>Amount (PHP)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {/* Payment date */}
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>

        {/* Method */}
        <div>
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="gcash">GCash</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reference number */}
        <div>
          <Label>Reference Number (optional)</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Check/bank/GCash reference"
          />
        </div>

        <Button type="submit" disabled={!canSubmit}>
          Record Payment
        </Button>
      </form>

      {/* Fund allocation preview (right panel) */}
      <div className="p-4 bg-muted/50 rounded-lg">
        {amountCents > 0 ? (
          <FundAllocationPreview amountCents={amountCents} funds={funds} />
        ) : (
          <p className="text-sm text-muted-foreground">Enter an amount to see fund allocation.</p>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Record payment of <span className="font-mono font-medium">₱{(amountCents / 100).toFixed(2)}</span> for this member?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending}>
              {recordMutation.isPending ? 'Recording...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Create the route file**

```tsx
// apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/new.tsx
import { createFileRoute } from '@tanstack/react-router'
import { RecordPaymentForm } from '@/features/dues/components/record-payment-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/new')({
  component: RecordPaymentPage,
})

function RecordPaymentPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Record Payment</h1>
      <RecordPaymentForm orgId={orgId} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/memberry/src/features/dues/components/fund-allocation-preview.tsx apps/memberry/src/features/dues/components/record-payment-form.tsx apps/memberry/src/routes/_authenticated/org/\$orgId/officer/payments/new.tsx
git commit -m "feat(f2): add record payment form with live fund allocation preview"
```

---

## Task 12: Frontend — Financial Dashboard + Payments Table

**Files:**
- Create: `apps/memberry/src/features/dues/components/financial-dashboard.tsx`
- Create: `apps/memberry/src/features/dues/components/payment-history-table.tsx`
- Modify: `apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments.tsx`

- [ ] **Step 1: Implement FinancialDashboard**

```tsx
// apps/memberry/src/features/dues/components/financial-dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCents } from '../lib/money'

interface FinancialDashboardProps {
  orgId: string
}

export function FinancialDashboard({ orgId }: FinancialDashboardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['dues-dashboard', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/dashboard/${orgId}`)
      return (await res.json()).data
    },
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const stats = [
    {
      label: 'Collection Rate',
      value: `${data?.collectionRate ?? 0}%`,
      color: (data?.collectionRate ?? 0) > 80 ? 'text-green-600' : (data?.collectionRate ?? 0) > 50 ? 'text-yellow-600' : 'text-red-600',
    },
    { label: 'Total Collected', value: formatCents(data?.totalCollected ?? 0), color: 'text-foreground' },
    { label: 'Outstanding', value: formatCents(data?.totalOutstanding ?? 0), color: 'text-foreground' },
    { label: 'Pending Payments', value: String(data?.pendingCount ?? 0), color: 'text-foreground' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement PaymentHistoryTable**

```tsx
// apps/memberry/src/features/dues/components/payment-history-table.tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatCents } from '../lib/money'

interface PaymentHistoryTableProps {
  orgId?: string
  scope: 'member' | 'org'
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
  partially_refunded: 'bg-gray-100 text-gray-600',
  expired: 'bg-orange-100 text-orange-800',
}

const METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  cash: 'Cash',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  gcash: 'GCash',
  other: 'Other',
}

export function PaymentHistoryTable({ orgId, scope }: PaymentHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const limit = 25

  const queryParams = new URLSearchParams({ scope, limit: String(limit), offset: String(offset) })
  if (orgId) queryParams.set('organizationId', orgId)
  if (statusFilter !== 'all') queryParams.set('status', statusFilter)
  if (methodFilter !== 'all') queryParams.set('method', methodFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['dues-payments', scope, orgId, statusFilter, methodFilter, offset],
    queryFn: async () => {
      const res = await fetch(`/api/dues/payments?${queryParams}`)
      return res.json()
    },
  })

  const payments = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setOffset(0) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="check">Check</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="gcash">GCash</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : payments.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No payments match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Receipt #</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-muted/50 cursor-pointer">
                  <td className="px-4 py-3">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.receiptNumber}</td>
                  <td className="px-4 py-3 font-mono">{formatCents(p.amount, p.currency)}</td>
                  <td className="px-4 py-3">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={STATUS_COLORS[p.status] ?? ''}>
                      {p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite officer payments route**

```tsx
// apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { FinancialDashboard } from '@/features/dues/components/financial-dashboard'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments')({
  component: OfficerPaymentsPage,
})

function OfficerPaymentsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dues & Payments</h1>
        <Link to="/org/$orgId/officer/payments/new" params={{ orgId }}>
          <Button><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
        </Link>
      </div>

      <FinancialDashboard orgId={orgId} />
      <PaymentHistoryTable orgId={orgId} scope="org" />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/memberry/src/features/dues/components/financial-dashboard.tsx apps/memberry/src/features/dues/components/payment-history-table.tsx apps/memberry/src/routes/_authenticated/org/\$orgId/officer/payments.tsx
git commit -m "feat(f2): add financial dashboard + payments table for officer view"
```

---

## Task 13: Frontend — Payment Detail + Refund

**Files:**
- Create: `apps/memberry/src/features/dues/components/refund-form.tsx`
- Create: `apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/$paymentId.tsx`

- [ ] **Step 1: Implement RefundForm**

```tsx
// apps/memberry/src/features/dues/components/refund-form.tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCents, parseCentsInput } from '../lib/money'

interface RefundFormProps {
  paymentId: string
  maxAmount: number // cents
  currency: string
}

export function RefundForm({ paymentId, maxAmount, currency }: RefundFormProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [expanded, setExpanded] = useState(false)
  const [amount, setAmount] = useState((maxAmount / 100).toFixed(2))
  const [reason, setReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const amountCents = parseCentsInput(amount)
  const amountError = amountCents > maxAmount
    ? `Refund cannot exceed ${formatCents(maxAmount, currency)}`
    : null

  const refundMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dues/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents, reason }),
      })
      if (!res.ok) throw new Error('Refund failed')
      return res.json()
    },
    onSuccess: () => {
      setShowConfirm(false)
      setExpanded(false)
      queryClient.invalidateQueries({ queryKey: ['dues-payment', paymentId] })
      toast({ title: `Refund of ${formatCents(amountCents, currency)} processed.` })
    },
    onError: () => {
      toast({ title: 'Refund failed', description: 'Please try again.', variant: 'destructive' })
    },
  })

  if (!expanded) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setExpanded(true)}>
        Refund
      </Button>
    )
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <h4 className="text-sm font-medium">Initiate Refund</h4>
      <div>
        <Label>Amount ({currency})</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
      </div>
      <div>
        <Label>Reason (required)</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for refund..."
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={!reason || amountCents <= 0 || !!amountError}
          onClick={() => setShowConfirm(true)}
        >
          Initiate Refund
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>Cancel</Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Refund</DialogTitle></DialogHeader>
          <p className="text-sm">
            Refund {formatCents(amountCents, currency)}? Fund allocations will be reversed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending}>
              {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Implement payment detail route**

```tsx
// apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/$paymentId.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCents } from '@/features/dues/lib/money'
import { RefundForm } from '@/features/dues/components/refund-form'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/$paymentId')({
  component: PaymentDetailPage,
})

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
  partially_refunded: 'bg-gray-100 text-gray-600',
  expired: 'bg-orange-100 text-orange-800',
}

function PaymentDetailPage() {
  const { orgId, paymentId } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dues-payment', paymentId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/payments/${paymentId}`)
      if (!res.ok) throw new Error('Not found')
      return (await res.json()).data
    },
  })

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>
  if (error || !data) return <div className="p-6 text-destructive">Payment not found.</div>

  const payment = data
  const allocations = payment.fundAllocations ?? []
  const origAllocations = allocations.filter((a: any) => !a.isReversal)
  const reversals = allocations.filter((a: any) => a.isReversal)
  const maxRefundable = payment.amount - payment.refundedAmount

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <Link to="/org/$orgId/officer/payments" params={{ orgId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to payments
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold font-mono">{payment.receiptNumber}</h1>
        <Badge className={STATUS_COLORS[payment.status] ?? ''}>{payment.status}</Badge>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-medium">{formatCents(payment.amount, payment.currency)}</span></div>
        <div><span className="text-muted-foreground">Method:</span> {payment.paymentMethod}</div>
        <div><span className="text-muted-foreground">Date:</span> {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}</div>
        <div><span className="text-muted-foreground">Reference:</span> {payment.referenceNumber || '—'}</div>
        {payment.recordedBy && <div><span className="text-muted-foreground">Recorded by:</span> {payment.recordedBy}</div>}
      </div>

      {/* Fund allocation breakdown */}
      {origAllocations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Fund Allocation</h3>
          <table className="w-full text-sm border">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left">Fund</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {origAllocations.map((a: any) => (
                <tr key={a.id} className="border-b">
                  <td className="px-3 py-2">{a.fundId}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCents(a.amount, payment.currency)}</td>
                </tr>
              ))}
              {reversals.map((a: any) => (
                <tr key={a.id} className="border-b text-red-600">
                  <td className="px-3 py-2">Refund reversal</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCents(a.amount, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Refund panel */}
      {(payment.status === 'completed' || payment.status === 'partially_refunded') && maxRefundable > 0 && (
        <RefundForm paymentId={paymentId} maxAmount={maxRefundable} currency={payment.currency} />
      )}
      {payment.status === 'refunded' && (
        <p className="text-sm text-muted-foreground">This payment has been fully refunded.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/memberry/src/features/dues/components/refund-form.tsx apps/memberry/src/routes/_authenticated/org/\$orgId/officer/payments/\$paymentId.tsx
git commit -m "feat(f2): add payment detail page with fund breakdown and refund flow"
```

---

## Task 14: Frontend — Member Payments View

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/my/payments.tsx`

- [ ] **Step 1: Rewrite member payments route**

```tsx
// apps/memberry/src/routes/_authenticated/my/payments.tsx
import { createFileRoute } from '@tanstack/react-router'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'

export const Route = createFileRoute('/_authenticated/my/payments')({
  component: MyPaymentsPage,
})

function MyPaymentsPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Payments</h1>
        <p className="text-muted-foreground">Your dues payments across all organizations.</p>
      </div>
      <PaymentHistoryTable scope="member" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/my/payments.tsx
git commit -m "feat(f2): rewrite member payments page with history table and filters"
```

---

## Task 15: E2E Tests

**Files:**
- Create: `apps/memberry/e2e/f2-dues-payments.spec.ts`

- [ ] **Step 1: Write E2E journey tests**

```typescript
// apps/memberry/e2e/f2-dues-payments.spec.ts
import { test, expect } from '@playwright/test'

const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASS = 'TestPass123!'
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('F2: Dues & Payments', () => {
  test.beforeEach(async ({ page }) => {
    // Login as officer
    await page.goto('/login')
    await page.getByLabel('Email').fill(OFFICER_EMAIL)
    await page.getByLabel('Password').fill(OFFICER_PASS)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/(dashboard|org)/)
  })

  test('officer can configure dues settings', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await expect(page.getByRole('heading', { name: /dues configuration/i })).toBeVisible()

    // Fill default amount
    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill('1500')

    // Select annual frequency
    await expect(page.getByText('Annual')).toBeVisible()

    // Set grace period
    const graceInput = page.locator('input[min="0"][max="365"]')
    await graceInput.fill('30')

    // Save
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/updated|saved/i)).toBeVisible()
  })

  test('officer can configure fund allocation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await expect(page.getByRole('heading', { name: /fund allocation/i })).toBeVisible()

    // Should show default General Fund at 100%
    await expect(page.getByDisplayValue('General Fund')).toBeVisible()
    await expect(page.getByDisplayValue('100')).toBeVisible()

    // Save should work with 100%
    await page.getByRole('button', { name: /save/i }).click({ force: true })
  })

  test('officer can access financial dashboard', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.getByRole('heading', { name: /dues & payments/i })).toBeVisible()

    // Stat cards visible
    await expect(page.getByText('Collection Rate')).toBeVisible()
    await expect(page.getByText('Total Collected')).toBeVisible()
    await expect(page.getByText('Outstanding')).toBeVisible()
    await expect(page.getByText('Pending Payments')).toBeVisible()

    // Record Payment button
    await expect(page.getByRole('button', { name: /record payment/i })).toBeVisible()
  })

  test('officer can navigate to record payment form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.getByRole('button', { name: /record payment/i }).click()
    await page.waitForURL(/\/payments\/new/)
    await expect(page.getByRole('heading', { name: /record payment/i })).toBeVisible()

    // Form elements visible
    await expect(page.getByText('Payment Method')).toBeVisible()
    await expect(page.getByText('Fund Allocation Preview')).toBeVisible()
  })

  test('member can view payment history', async ({ page }) => {
    await page.goto('/my/payments')
    await expect(page.getByRole('heading', { name: /my payments/i })).toBeVisible()

    // Filter controls present
    await expect(page.getByText('All Statuses')).toBeVisible()
    await expect(page.getByText('All Methods')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run E2E tests (verify they can be parsed)**

Run: `cd apps/memberry && bunx playwright test e2e/f2-dues-payments.spec.ts --reporter=list 2>&1 | head -30`
Expected: Tests either pass or fail on expected conditions (not syntax errors)

- [ ] **Step 3: Commit**

```bash
git add apps/memberry/e2e/f2-dues-payments.spec.ts
git commit -m "test(f2): add E2E journey tests for dues & payments flow"
```

---

## Task 16: Update Dues Settings Route

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/dues.tsx`

- [ ] **Step 1: Rewrite with updated import**

```tsx
// apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/dues.tsx
import { createFileRoute } from '@tanstack/react-router'
import { DuesConfigForm } from '@/features/dues/components/dues-config-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/dues')({
  component: DuesSettingsPage,
})

function DuesSettingsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dues Configuration</h1>
      <DuesConfigForm orgId={orgId} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/org/\$orgId/officer/settings/dues.tsx
git commit -m "fix(f2): update dues settings route to use rewritten config form"
```

---

## Summary

16 tasks covering:
- Database schema + migration (Task 1)
- Shared utilities: fund math, receipt numbers (Tasks 2-3)
- Backend repository + handlers (Tasks 4-7)
- Frontend components: fund editor, config form, record payment, dashboard, detail, refund (Tasks 8-14)
- E2E tests (Task 15)
- Route cleanup (Task 16)

After completing these tasks, the following is ready:
- Officer: configure dues, configure funds, record payments, view dashboard, view payment detail, process refunds
- Member: view payment history with filters

**Deferred to follow-up plan:**
- Gateway setup (Slice 6)
- Financial reports (Slice 7)
- Reminder scheduling jobs (Slice 8)
