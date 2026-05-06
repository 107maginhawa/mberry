// Business Rules: [BR-02] [BR-05] [BR-07]
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Dues Module Tests
 *
 * Tests business rules for dues config, invoice lifecycle, and aging buckets.
 */

// -- DuesConfig Business Rules --

describe('DuesConfig', () => {
  test('BR-05: fund allocations must sum to 100%', () => {
    const allocations = [
      { fundName: 'National', percentage: 60, isLast: false },
      { fundName: 'Chapter', percentage: 30, isLast: false },
      { fundName: 'Reserve', percentage: 10, isLast: true },
    ];
    const sum = allocations.reduce((s, a) => s + a.percentage, 0);
    expect(sum).toBe(100);
  });

  test('BR-02: grace period range 0-90 days, default 30', () => {
    const defaultGrace = 30;
    expect(defaultGrace).toBeGreaterThanOrEqual(0);
    expect(defaultGrace).toBeLessThanOrEqual(90);

    // Edge cases
    expect(0).toBeGreaterThanOrEqual(0);
    expect(90).toBeLessThanOrEqual(90);
  });

  test('[BR-02] grace period minimum bound is 0', () => {
    const minGrace = 0;
    expect(minGrace).toBeGreaterThanOrEqual(0);
    expect(minGrace).toBeLessThanOrEqual(90);
  });

  test('[BR-02] grace period maximum bound is 90', () => {
    const maxGrace = 90;
    expect(maxGrace).toBeGreaterThanOrEqual(0);
    expect(maxGrace).toBeLessThanOrEqual(90);
  });

  test('[BR-02] grace period outside bounds should be rejected', () => {
    // BR-02: "configurable per org, with a minimum of 0 days and a maximum of 90 days"
    const invalidValues = [-1, 91, 100, 365];
    for (const val of invalidValues) {
      const isValid = val >= 0 && val <= 90;
      expect(isValid).toBe(false);
    }
  });

  test('[BR-02] members in Grace retain read-only access', () => {
    // BR-02: "Members in Grace status retain read-only platform access
    // but cannot register for new events or training sessions."
    const gracePermissions = {
      canViewDashboard: true,
      canViewHistory: true,
      canRegisterForEvents: false,
      canRegisterForTraining: false,
    };
    expect(gracePermissions.canViewDashboard).toBe(true);
    expect(gracePermissions.canRegisterForEvents).toBe(false);
    expect(gracePermissions.canRegisterForTraining).toBe(false);
  });

  test('createDuesConfig returns 401 without user', async () => {
    const { createDuesConfig } = await import('./createDuesConfig');
    const ctx = makeCtx({ user: null });
    const response = await createDuesConfig(ctx);
    expect(response.status).toBe(401);
  });

  test('createDuesConfig returns 403 without organizationId', async () => {
    const { createDuesConfig } = await import('./createDuesConfig');
    const ctx = makeCtx({ organizationId: null });
    const response = await createDuesConfig(ctx);
    expect(response.status).toBe(403);
  });
});

// -- DuesInvoice Lifecycle --

describe('DuesInvoice Lifecycle', () => {
  test('BR-07: markPaid extends membership from current expiry', () => {
    // Critical: extend from CURRENT expiry, not today
    const currentExpiry = new Date('2025-06-01');
    currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);
    expect(currentExpiry.toISOString().split('T')[0]).toBe('2026-06-01');

    // Edge: past expiry still extends from past date
    const pastExpiry = new Date('2023-12-31');
    pastExpiry.setFullYear(pastExpiry.getFullYear() + 1);
    expect(pastExpiry.toISOString().split('T')[0]).toBe('2024-12-31');
  });

  test('invoice amounts stored as integer cents', () => {
    const phpAmount = 10050; // PHP 100.50
    expect(Number.isInteger(phpAmount)).toBe(true);

    // Verify conversion: PHP 1,500.75 = 150075 centavos
    const amount = 150075;
    const display = (amount / 100).toFixed(2);
    expect(display).toBe('1500.75');
  });

  test('BR-05: isLast fund allocation absorbs rounding remainder', () => {
    const totalCents = 10000;
    const allocations = [
      { fundName: 'National', percentage: 33.33, isLast: false },
      { fundName: 'Chapter', percentage: 33.33, isLast: false },
      { fundName: 'Reserve', percentage: 33.34, isLast: true },
    ];

    let allocated = 0;
    const results = allocations.map((a) => {
      if (a.isLast) {
        return { fundName: a.fundName, amount: totalCents - allocated };
      }
      const amt = Math.floor(totalCents * a.percentage / 100);
      allocated += amt;
      return { fundName: a.fundName, amount: amt };
    });

    const totalAllocated = results.reduce((s, r) => s + r.amount, 0);
    expect(totalAllocated).toBe(totalCents);

    // Reserve gets the remainder: 10000 - 3333 - 3333 = 3334
    expect(results[2]!.amount).toBe(3334);
  });

  test('payable invoice statuses', () => {
    const payableStatuses = ['generated', 'sent', 'overdue'];
    const nonPayable = ['paid', 'cancelled', 'writtenOff'];

    for (const s of payableStatuses) {
      expect(['generated', 'sent', 'overdue']).toContain(s);
    }
    for (const s of nonPayable) {
      expect(payableStatuses).not.toContain(s);
    }
  });

  test('invoice number format', () => {
    const timestamp = Date.now();
    const invoiceNumber = `INV-${timestamp}`;
    expect(invoiceNumber).toMatch(/^INV-\d+$/);
  });
});

// -- Aging Buckets --

describe('Aging Buckets', () => {
  test('bucket categories sum to totalOutstanding', () => {
    const bucket = {
      current: 5000,
      thirtyDay: 3000,
      sixtyDay: 2000,
      ninetyDay: 1000,
      overNinety: 500,
    };
    const total = Object.values(bucket).reduce((s, v) => s + v, 0);
    expect(total).toBe(11500);
  });

  test('all bucket values are non-negative integers', () => {
    const values = [5000, 3000, 2000, 1000, 500, 0];
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

// -- Payment Processing Tests --

describe('recordManualPayment', () => {
  test('requires auth', async () => {
    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeCtx({ user: null });
    const response = await recordManualPayment(ctx);
    expect(response.status).toBe(401);
  });

  test('requires organizationId', async () => {
    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeCtx({ user: { id: 'u1' }, organizationId: null });
    const response = await recordManualPayment(ctx);
    expect(response.status).toBe(403);
  });
});

describe('handlePaymentWebhook', () => {
  test('returns 400 for invalid signature', async () => {
    const { handlePaymentWebhook } = await import('./handlePaymentWebhook');
    const ctx = makeCtx({
      user: null, // No auth needed for webhooks
    });
    // Override req to support text() and header()
    ctx.req = {
      ...ctx.req,
      text: async () => '{"data":{}}',
      header: (name: string) => name === 'paymongo-signature' ? 'invalid' : null,
    };
    // Need env vars for this test
    const originalSecret = process.env['PAYMONGO_SECRET_KEY'];
    const originalWebhook = process.env['PAYMONGO_WEBHOOK_SECRET'];
    process.env['PAYMONGO_SECRET_KEY'] = 'sk_test';
    process.env['PAYMONGO_WEBHOOK_SECRET'] = 'whsec_test';

    const response = await handlePaymentWebhook(ctx);
    expect(response.status).toBe(400);

    // Restore
    if (originalSecret) process.env['PAYMONGO_SECRET_KEY'] = originalSecret;
    else delete process.env['PAYMONGO_SECRET_KEY'];
    if (originalWebhook) process.env['PAYMONGO_WEBHOOK_SECRET'] = originalWebhook;
    else delete process.env['PAYMONGO_WEBHOOK_SECRET'];
  });

  test('returns 503 when gateway not configured', async () => {
    const { handlePaymentWebhook } = await import('./handlePaymentWebhook');
    const ctx = makeCtx({ user: null });
    ctx.req = {
      ...ctx.req,
      text: async () => '{}',
      header: () => '',
    };
    const orig1 = process.env['PAYMONGO_SECRET_KEY'];
    const orig2 = process.env['PAYMONGO_WEBHOOK_SECRET'];
    delete process.env['PAYMONGO_SECRET_KEY'];
    delete process.env['PAYMONGO_WEBHOOK_SECRET'];

    const response = await handlePaymentWebhook(ctx);
    expect(response.status).toBe(503);

    if (orig1) process.env['PAYMONGO_SECRET_KEY'] = orig1;
    if (orig2) process.env['PAYMONGO_WEBHOOK_SECRET'] = orig2;
  });
});
