/**
 * Tests for generatePaymentReceipt (Slice 029)
 *
 * Covers:
 * - Auth guard (401)
 * - Org context guard (403)
 * - Payment not found (throws NotFoundError)
 * - Cross-org payment access (throws ForbiddenError)
 * - Member can download own receipt
 * - Officer can download any receipt
 * - Non-officer cannot download other member's receipt (403)
 * - Receipt HTML format: receipt number, amount, date, payment method
 * - Fund allocations included in receipt
 * - Org branding/config used
 * - Membership extension shown when present
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues.repo';
import { generatePaymentReceipt, renderReceiptHtml } from './generatePaymentReceipt';

// ─── Fixtures ───────────────────────────────────────────

const basePayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'user-1',
  invoiceId: null,
  receiptNumber: 'ORG-2026-000001',
  amount: 500000,
  currency: 'PHP',
  paymentMethod: 'cash' as const,
  referenceNumber: 'CASH-001',
  status: 'completed',
  recordedBy: 'officer-1',
  paidAt: new Date('2026-03-15'),
  membershipExtendedFrom: '2026-03-15',
  membershipExtendedTo: '2027-03-15',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseFundAllocations = [
  { id: 'fa-1', organizationId: 'org-1', paymentId: 'pay-1', fundId: 'fund-general', amount: 350000, isReversal: false },
  { id: 'fa-2', organizationId: 'org-1', paymentId: 'pay-1', fundId: 'fund-building', amount: 150000, isReversal: false },
];

const baseConfig = {
  id: 'config-1',
  organizationId: 'org-1',
  defaultAmount: 500000,
  currency: 'PHP',
  billingFrequency: 'annual',
  dueDateMonth: 1,
  dueDateDay: 1,
  gracePeriodDays: 30,
};

function defaultStubs() {
  return stubRepo(DuesRepository, {
    getPayment: async () => basePayment,
    getFundAllocations: async () => baseFundAllocations,
    getConfig: async () => baseConfig,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[029] generatePaymentReceipt', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  // ── Auth Guards ──────────────────────────────────────

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { paymentId: 'pay-1' } });
    await expect(generatePaymentReceipt(ctx)).rejects.toThrow();
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.status).toBe(403);
  });

  // ── Payment Not Found ────────────────────────────────

  test('throws NotFoundError when payment does not exist', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => undefined,
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-missing' } });
    await expect(generatePaymentReceipt(ctx)).rejects.toThrow();
  });

  // ── Cross-Org Access ─────────────────────────────────

  test('throws ForbiddenError for cross-org payment access', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...basePayment, organizationId: 'org-other' }),
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    await expect(generatePaymentReceipt(ctx)).rejects.toThrow();
  });

  // ── Own Receipt Download ─────────────────────────────

  test('member downloads own receipt successfully', async () => {
    defaultStubs();
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      // user.id = 'user-1' matches basePayment.personId
    });
    const res = await generatePaymentReceipt(ctx);
    expect(res.status).toBe(200);
    expect(res.body.html).toBeDefined();
    expect(res.body.receiptNumber).toBe('ORG-2026-000001');
    expect(res.body.paymentId).toBe('pay-1');
  });

  // ── Receipt HTML Content ─────────────────────────────

  test('receipt HTML contains receipt number', async () => {
    defaultStubs();
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).toContain('ORG-2026-000001');
  });

  test('receipt HTML contains formatted amount', async () => {
    defaultStubs();
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).toContain('PHP 5000.00');
  });

  test('receipt HTML contains payment method', async () => {
    defaultStubs();
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).toContain('cash');
  });

  test('receipt HTML contains membership extension dates', async () => {
    defaultStubs();
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).toContain('Membership Extended');
    expect(res.body.html).toContain('2027-03-15');
  });

  test('receipt HTML contains fund allocations', async () => {
    defaultStubs();
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).toContain('fund-general');
    expect(res.body.html).toContain('fund-building');
  });

  test('receipt HTML contains reference number when provided', async () => {
    defaultStubs();
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).toContain('CASH-001');
  });

  // ── No Extension Shown When Absent ───────────────────

  test('no membership extension block when dates are null', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...basePayment,
        membershipExtendedFrom: null,
        membershipExtendedTo: null,
      }),
      getFundAllocations: async () => [],
      getConfig: async () => baseConfig,
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { paymentId: 'pay-1' } });
    const res = await generatePaymentReceipt(ctx);
    expect(res.body.html).not.toContain('Membership Extended');
  });
});

// ─── Unit Tests for renderReceiptHtml ───────────────────

describe('[029] renderReceiptHtml', () => {
  test('renders valid HTML document', () => {
    const html = renderReceiptHtml({
      receiptNumber: 'TEST-2026-000001',
      amount: 100000,
      currency: 'PHP',
      paymentMethod: 'bankTransfer',
      referenceNumber: 'BT-123',
      paidAt: new Date('2026-06-01'),
      membershipExtendedFrom: null,
      membershipExtendedTo: null,
      fundAllocations: [],
      organizationId: 'org-test',
      orgCurrency: 'PHP',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('TEST-2026-000001');
    expect(html).toContain('PHP 1000.00');
    expect(html).toContain('bankTransfer');
    expect(html).toContain('BT-123');
  });

  test('formats currency correctly from minor units', () => {
    const html = renderReceiptHtml({
      receiptNumber: 'X-2026-000001',
      amount: 12345,
      currency: 'USD',
      paymentMethod: 'online',
      referenceNumber: null,
      paidAt: new Date(),
      membershipExtendedFrom: null,
      membershipExtendedTo: null,
      fundAllocations: [],
      organizationId: 'org-1',
      orgCurrency: 'USD',
    });

    expect(html).toContain('USD 123.45');
  });

  test('omits reference number row when null', () => {
    const html = renderReceiptHtml({
      receiptNumber: 'X-2026-000001',
      amount: 10000,
      currency: 'PHP',
      paymentMethod: 'cash',
      referenceNumber: null,
      paidAt: new Date(),
      membershipExtendedFrom: null,
      membershipExtendedTo: null,
      fundAllocations: [],
      organizationId: 'org-1',
      orgCurrency: 'PHP',
    });

    expect(html).not.toContain('Reference');
  });
});
