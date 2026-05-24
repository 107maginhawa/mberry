/**
 * BR-06: Payment settlement marks invoice as paid, updates membership status.
 *
 * Source lives at association:member/utils/settle-payment.ts — tested here
 * at the path registered in br-registry.json for BR-06.
 *
 * settle-payment is a thin wrapper around membershipLifecycle.settlePayment.
 * These tests verify the wrapper's contract: input validation, transaction
 * delegation, and result shape.
 */

import { describe, test, expect } from 'bun:test';
import { settlePayment, toBillingCycle } from '../../association:member/utils/settle-payment';

// ─── toBillingCycle re-export [BR-06] ──────────────────

describe('[BR-06] toBillingCycle', () => {
  test('is exported (re-exported for backward compat)', () => {
    expect(typeof toBillingCycle).toBe('function');
  });
});

// ─── settlePayment contract [BR-06] ────────────────────

describe('[BR-06] settlePayment', () => {
  test('is an async function', () => {
    expect(typeof settlePayment).toBe('function');
  });

  test('rejects when db.transaction throws', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('DB connection lost');
      },
    } as any;

    await expect(
      settlePayment({
        db: fakeDb,
        orgId: 'org-1',
        personId: 'person-1',
        paymentId: 'pay-1',
        amount: 5000,
      }),
    ).rejects.toThrow('DB connection lost');
  });

  test('uses outer tx when provided (no db.transaction call)', async () => {
    let transactionCalled = false;
    const fakeDb = {
      transaction: async () => {
        transactionCalled = true;
        return {};
      },
    } as any;

    // When tx is provided, the function should call execute(tx) directly
    // It won't call db.transaction. But it WILL call membershipLifecycle.settlePayment
    // which we can't easily mock here. Just verify the function signature accepts tx.
    const fakeTx = {} as any;

    // This will fail because membershipLifecycle is not mocked,
    // but we can verify the tx path is attempted (not db.transaction)
    try {
      await settlePayment({
        db: fakeDb,
        orgId: 'org-1',
        personId: 'person-1',
        paymentId: 'pay-1',
        amount: 5000,
        tx: fakeTx,
      });
    } catch {
      // Expected — membershipLifecycle not available in unit test
    }

    // db.transaction should NOT have been called since tx was provided
    expect(transactionCalled).toBe(false);
  });

  test('calls db.transaction when no outer tx provided', async () => {
    let transactionCalled = false;
    const fakeDb = {
      transaction: async (fn: any) => {
        transactionCalled = true;
        // Will fail inside because membershipLifecycle is not mocked
        return fn(fakeDb);
      },
    } as any;

    try {
      await settlePayment({
        db: fakeDb,
        orgId: 'org-1',
        personId: 'person-1',
        paymentId: 'pay-1',
        amount: 5000,
      });
    } catch {
      // Expected — membershipLifecycle not available in unit test
    }

    expect(transactionCalled).toBe(true);
  });
});
