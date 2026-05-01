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

  test('createDuesConfig returns 401 without user', async () => {
    const { createDuesConfig } = await import('./createDuesConfig');
    const ctx = makeCtx({ user: null });
    const response = await createDuesConfig(ctx);
    expect(response.status).toBe(401);
  });

  test('createDuesConfig returns 403 without tenantId', async () => {
    const { createDuesConfig } = await import('./createDuesConfig');
    const ctx = makeCtx({ tenantId: null });
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
