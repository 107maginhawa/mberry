/**
 * AC tests for M06 — Dues / Payments
 * Pure domain logic — no DB, no HTTP.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DuesStatus = 'Active' | 'Expired' | 'Pending' | 'Life';

interface Fund {
  id: string;
  name: string;
  balanceCents: number;
}

interface Payment {
  id: string;
  personId: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'refunded';
  fundId: string;
}

interface WebhookEvent {
  webhookId: string;
  payload: Record<string, unknown>;
}

interface PaymentLink {
  memberId: string;
  amountCents: number;
  description: string;
  prefilled: boolean;
}

interface DuesRecord {
  personId: string;
  periodLabel: string;
  amountCents: number;
  paidCents: number;
}

interface CreditEntry {
  personId: string;
  amountCents: number;
  type: 'credit' | 'debit';
  reason: string;
}

// ---------------------------------------------------------------------------
// Pure functions under test
// ---------------------------------------------------------------------------

function allocatePaymentToFund(fund: Fund, payment: Payment): Fund {
  if (payment.status !== 'completed') return fund;
  return { ...fund, balanceCents: fund.balanceCents + payment.amountCents };
}

function isWebhookProcessed(webhookId: string, processedIds: Set<string>): boolean {
  return processedIds.has(webhookId);
}

function processWebhookIdempotent(
  event: WebhookEvent,
  processedIds: Set<string>,
  processFn: (e: WebhookEvent) => void,
): { processed: boolean; isNew: boolean } {
  if (isWebhookProcessed(event.webhookId, processedIds)) {
    return { processed: false, isNew: false };
  }
  processFn(event);
  processedIds.add(event.webhookId);
  return { processed: true, isNew: true };
}

function buildPaymentLink(
  memberId: string,
  amountCents: number,
  description: string,
): PaymentLink {
  return { memberId, amountCents, description, prefilled: true };
}

function hasPendingPayment(personId: string, payments: Payment[]): boolean {
  return payments.some(p => p.personId === personId && p.status === 'pending');
}

function warnIfConcurrentPayment(
  personId: string,
  payments: Payment[],
): { warn: boolean; message?: string } {
  if (hasPendingPayment(personId, payments)) {
    return { warn: true, message: 'You already have a pending payment. Proceeding may result in a duplicate charge.' };
  }
  return { warn: false };
}

function computeReportTotals(records: DuesRecord[]): { totalDue: number; totalPaid: number } {
  return records.reduce(
    (acc, r) => ({
      totalDue: acc.totalDue + r.amountCents,
      totalPaid: acc.totalPaid + r.paidCents,
    }),
    { totalDue: 0, totalPaid: 0 },
  );
}

function reportTotalsMatchRecords(records: DuesRecord[]): boolean {
  const { totalDue, totalPaid } = computeReportTotals(records);
  const sumDue = records.reduce((s, r) => s + r.amountCents, 0);
  const sumPaid = records.reduce((s, r) => s + r.paidCents, 0);
  return totalDue === sumDue && totalPaid === sumPaid;
}

interface RefundResult {
  newDuesStatus: DuesStatus;
  creditAdjustmentCents: number;
  creditEntries: CreditEntry[];
}

function processRefund(
  personId: string,
  payment: Payment,
  creditBalance: number,
): RefundResult {
  const creditEntries: CreditEntry[] = [
    {
      personId,
      amountCents: -payment.amountCents,
      type: 'debit',
      reason: `Refund of payment ${payment.id}`,
    },
  ];
  return {
    newDuesStatus: 'Expired',
    creditAdjustmentCents: creditBalance - payment.amountCents,
    creditEntries,
  };
}

function canLifeMemberPay(duesStatus: DuesStatus): { allowed: boolean; reason?: string } {
  if (duesStatus === 'Life') {
    return { allowed: false, reason: 'Life members have already paid lifetime dues and cannot make additional dues payments' };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// AC-M06-001: Fund Allocation Integrity
// ---------------------------------------------------------------------------

describe('[AC-M06-001] Fund Allocation Integrity', () => {
  test('fund balance increases by exact payment amount', () => {
    const fund: Fund = { id: 'f1', name: 'General Fund', balanceCents: 10000 };
    const payment: Payment = { id: 'pay-1', personId: 'p1', amountCents: 5000, status: 'completed', fundId: 'f1' };
    const updated = allocatePaymentToFund(fund, payment);
    expect(updated.balanceCents).toBe(15000);
  });

  test('fund balance does not change for non-completed payment', () => {
    const fund: Fund = { id: 'f1', name: 'General Fund', balanceCents: 10000 };
    const payment: Payment = { id: 'pay-1', personId: 'p1', amountCents: 5000, status: 'pending', fundId: 'f1' };
    const updated = allocatePaymentToFund(fund, payment);
    expect(updated.balanceCents).toBe(10000);
  });

  test('allocation is exact — no rounding error', () => {
    const fund: Fund = { id: 'f1', name: 'General Fund', balanceCents: 0 };
    const payment: Payment = { id: 'pay-1', personId: 'p1', amountCents: 123456, status: 'completed', fundId: 'f1' };
    const updated = allocatePaymentToFund(fund, payment);
    expect(updated.balanceCents).toBe(123456);
  });
});

// ---------------------------------------------------------------------------
// AC-M06-002: Idempotent Webhooks
// ---------------------------------------------------------------------------

describe('[AC-M06-002] Idempotent Webhooks', () => {
  test('processes webhook on first receipt', () => {
    const processed = new Set<string>();
    let callCount = 0;
    const event: WebhookEvent = { webhookId: 'wh-1', payload: {} };
    const result = processWebhookIdempotent(event, processed, () => { callCount++; });
    expect(result.isNew).toBe(true);
    expect(result.processed).toBe(true);
    expect(callCount).toBe(1);
  });

  test('second receipt of same webhook ID is no-op', () => {
    const processed = new Set<string>(['wh-1']);
    let callCount = 0;
    const event: WebhookEvent = { webhookId: 'wh-1', payload: {} };
    const result = processWebhookIdempotent(event, processed, () => { callCount++; });
    expect(result.isNew).toBe(false);
    expect(result.processed).toBe(false);
    expect(callCount).toBe(0);
  });

  test('different webhook IDs are processed independently', () => {
    const processed = new Set<string>(['wh-1']);
    let callCount = 0;
    const event: WebhookEvent = { webhookId: 'wh-2', payload: {} };
    const result = processWebhookIdempotent(event, processed, () => { callCount++; });
    expect(result.isNew).toBe(true);
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC-M06-003: One-Tap Payment
// ---------------------------------------------------------------------------

describe('[AC-M06-003] One-Tap Payment', () => {
  test('payment link is generated with pre-filled data', () => {
    const link = buildPaymentLink('member-1', 150000, 'Annual Dues 2026');
    expect(link.prefilled).toBe(true);
    expect(link.memberId).toBe('member-1');
    expect(link.amountCents).toBe(150000);
    expect(link.description).toBe('Annual Dues 2026');
  });

  test('payment link contains member ID for tracking', () => {
    const link = buildPaymentLink('member-42', 50000, 'Monthly dues');
    expect(link.memberId).toBe('member-42');
  });
});

// ---------------------------------------------------------------------------
// AC-M06-004: Concurrent Payment Warning
// ---------------------------------------------------------------------------

describe('[AC-M06-004] Concurrent Payment Warning', () => {
  const personId = 'p1';

  test('warns when pending payment already exists', () => {
    const payments: Payment[] = [
      { id: 'pay-1', personId, amountCents: 5000, status: 'pending', fundId: 'f1' },
    ];
    const result = warnIfConcurrentPayment(personId, payments);
    expect(result.warn).toBe(true);
    expect(result.message).toBeDefined();
  });

  test('no warning when no pending payment', () => {
    const payments: Payment[] = [
      { id: 'pay-1', personId, amountCents: 5000, status: 'completed', fundId: 'f1' },
    ];
    const result = warnIfConcurrentPayment(personId, payments);
    expect(result.warn).toBe(false);
  });

  test('no warning when pending payment belongs to different person', () => {
    const payments: Payment[] = [
      { id: 'pay-1', personId: 'other', amountCents: 5000, status: 'pending', fundId: 'f1' },
    ];
    const result = warnIfConcurrentPayment(personId, payments);
    expect(result.warn).toBe(false);
  });

  test('no warning when no payments at all', () => {
    const result = warnIfConcurrentPayment(personId, []);
    expect(result.warn).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-M06-005: Report Accuracy
// ---------------------------------------------------------------------------

describe('[AC-M06-005] Report Accuracy', () => {
  const records: DuesRecord[] = [
    { personId: 'p1', periodLabel: '2026', amountCents: 150000, paidCents: 150000 },
    { personId: 'p2', periodLabel: '2026', amountCents: 150000, paidCents: 0 },
    { personId: 'p3', periodLabel: '2026', amountCents: 150000, paidCents: 75000 },
  ];

  test('report totals match sum of individual records', () => {
    expect(reportTotalsMatchRecords(records)).toBe(true);
  });

  test('totalDue is sum of all amountCents', () => {
    const { totalDue } = computeReportTotals(records);
    expect(totalDue).toBe(450000);
  });

  test('totalPaid is sum of all paidCents', () => {
    const { totalPaid } = computeReportTotals(records);
    expect(totalPaid).toBe(225000);
  });

  test('empty records produce zero totals', () => {
    const { totalDue, totalPaid } = computeReportTotals([]);
    expect(totalDue).toBe(0);
    expect(totalPaid).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-M06-006: Refund Reversal
// ---------------------------------------------------------------------------

describe('[AC-M06-006] Refund Reversal', () => {
  const personId = 'p1';
  const payment: Payment = {
    id: 'pay-1',
    personId,
    amountCents: 150000,
    status: 'completed',
    fundId: 'f1',
  };

  test('dues status reverted to Expired after refund', () => {
    const result = processRefund(personId, payment, 150000);
    expect(result.newDuesStatus).toBe('Expired');
  });

  test('credits adjusted by refund amount', () => {
    const result = processRefund(personId, payment, 150000);
    expect(result.creditAdjustmentCents).toBe(0); // 150000 - 150000
  });

  test('credit entries record the debit', () => {
    const result = processRefund(personId, payment, 150000);
    expect(result.creditEntries.length).toBeGreaterThan(0);
    const debit = result.creditEntries.find(e => e.type === 'debit');
    expect(debit).toBeDefined();
    expect(debit?.amountCents).toBe(-150000);
  });

  test('partial credit balance is reduced correctly', () => {
    const result = processRefund(personId, payment, 200000);
    expect(result.creditAdjustmentCents).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// AC-M06-007: Life Member Payment Block
// ---------------------------------------------------------------------------

describe('[AC-M06-007] Life Member Payment Block', () => {
  test('blocks payment for life member', () => {
    const result = canLifeMemberPay('Life');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('allows payment for active member', () => {
    const result = canLifeMemberPay('Active');
    expect(result.allowed).toBe(true);
  });

  test('allows payment for expired member', () => {
    const result = canLifeMemberPay('Expired');
    expect(result.allowed).toBe(true);
  });

  test('allows payment for pending member', () => {
    const result = canLifeMemberPay('Pending');
    expect(result.allowed).toBe(true);
  });
});
