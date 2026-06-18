/**
 * refund-fund-reversal.test.ts — processRefund fund-reversal rounding.
 *
 * Regression: reversals were rounded per-fund independently, so the sum of
 * reversal amounts could drift from the refund total by a cent (ledger
 * mis-sum). The residual-carrying distribution makes the last fund absorb
 * the rounding residual, so reversals reconcile exactly with
 * round(totalAllocated * refundRatio).
 *
 * Uses a partial refund (isFullRefund=false, no membershipExtendedFrom) so
 * the expiry/membership branch is skipped and only the fund-reversal path
 * is exercised — no DB needed.
 */
import { describe, test, expect } from 'bun:test';
import { createMembershipLifecycle, type PaymentPort } from './membership-lifecycle';
// Factory N/A: exercises a service method with a captured fake PaymentPort.

function fakePort(
  allocations: Array<{ fundId: string; amount: number; isReversal: boolean }>,
  sink: { captured: Array<{ fundId: string; amount: number; isReversal: boolean; paymentId: string; organizationId: string }> },
): PaymentPort {
  return {
    listFunds: async () => [],
    getConfig: async () => undefined,
    getFundAllocations: async () => allocations,
    createFundAllocations: async (rev) => { sink.captured = rev; },
  };
}

describe('processRefund fund-reversal rounding', () => {
  test('reversals sum exactly to -round(totalAllocated * refundRatio) (no cent drift)', async () => {
    // 3334/3333/3333 = 10000 total; 50% refund. Independent per-fund rounding
    // gives round(3334*.5)+round(3333*.5)+round(3333*.5) = 1667+1667+1667 = 5001,
    // which mis-sums vs the 5000 target. Residual carry must yield exactly 5000.
    const allocations = [
      { fundId: 'f1', amount: 3334, isReversal: false },
      { fundId: 'f2', amount: 3333, isReversal: false },
      { fundId: 'f3', amount: 3333, isReversal: false },
    ];
    const sink = { captured: [] as any[] };
    const lifecycle = createMembershipLifecycle(fakePort(allocations, sink));

    await lifecycle.processRefund({} as any, {
      paymentId: 'pay-1',
      payment: { amount: 10000, organizationId: 'org-1', personId: 'p-1' },
      refundAmount: 5000,
      isFullRefund: false,
    });

    const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
    const refundRatio = 5000 / 10000;
    const expectedSum = -Math.round(totalAllocated * refundRatio); // -5000

    const sum = sink.captured.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(expectedSum);
    // Guard: the naive per-fund rounding would have summed to -5001.
    expect(sum).not.toBe(-5001);
    // All reversals are negative and flagged.
    expect(sink.captured.every(r => r.amount < 0 && r.isReversal)).toBe(true);
    expect(sink.captured).toHaveLength(3);
  });

  test('reversals reconcile across many adversarial amounts and ratios', async () => {
    const allocations = [
      { fundId: 'a', amount: 1429, isReversal: false },
      { fundId: 'b', amount: 1428, isReversal: false },
      { fundId: 'c', amount: 1428, isReversal: false },
      { fundId: 'd', amount: 1429, isReversal: false },
      { fundId: 'e', amount: 1428, isReversal: false },
      { fundId: 'f', amount: 1429, isReversal: false },
      { fundId: 'g', amount: 1429, isReversal: false },
    ];
    const total = allocations.reduce((s, a) => s + a.amount, 0); // 10000
    for (const refundAmount of [1, 2, 3, 3333, 5000, 7777, 9999, 10000]) {
      const sink = { captured: [] as any[] };
      const lifecycle = createMembershipLifecycle(fakePort(allocations, sink));
      await lifecycle.processRefund({} as any, {
        paymentId: 'pay-x',
        payment: { amount: total, organizationId: 'org-1', personId: 'p-1' },
        refundAmount,
        isFullRefund: false,
      });
      const sum = sink.captured.reduce((s, r) => s + r.amount, 0);
      const expected = -Math.round(total * (refundAmount / total));
      expect(sum).toBe(expected);
    }
  });
});
