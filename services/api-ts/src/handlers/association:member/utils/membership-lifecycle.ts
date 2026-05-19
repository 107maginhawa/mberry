/**
 * Membership Lifecycle Service
 *
 * Centralizes payment→membership orchestration:
 * - settlePayment: allocate funds, extend expiry, update membership status
 * - processRefund: create reversal entries, reset expiry, recompute status
 * - recomputeStatus: shared status recomputation from membership state
 *
 * All methods accept a transaction handle (txDb) so callers control
 * the transaction boundary.
 */

import type { DatabaseInstance } from '@/core/database';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { allocateFunds } from '@/handlers/dues/utils/fund-math';
import { computeNewExpiry, type BillingCycle } from '@/handlers/dues/utils/expiry-extension';
import { computeMembershipStatus, type ComputedMembershipStatus } from './compute-membership-status';

// ── Types ────────────────────────────────────────────────────────────

export interface SettlePaymentParams {
  orgId: string;
  personId: string;
  paymentId: string;
  amount: number;
}

export interface SettlementResult {
  fundAllocations: { fundName: string; amount: number }[];
  membershipExtendedFrom: string | null;
  membershipExtendedTo: string | null;
}

export interface ProcessRefundParams {
  paymentId: string;
  payment: {
    amount: number;
    organizationId: string;
    personId: string;
    membershipExtendedFrom?: string | null;
  };
  refundAmount: number;
  isFullRefund: boolean;
}

export interface RefundResult {
  newStatus: string;
  newRefundedAmount: number;
  refundedAmount: number;
}

// ── Shared constants ─────────────────────────────────────────────────

/** Statuses from which a payment can reactivate a membership (BR-03). */
const PAYMENT_REACTIVATABLE_STATUSES = ['pendingPayment', 'active', 'gracePeriod', 'lapsed'];

/** Default grace period in days for status recomputation. */
const DEFAULT_GRACE_PERIOD_DAYS = 30;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Map a billingFrequency value from the dues config to a BillingCycle.
 * Defaults to 'annual' for unknown/missing values.
 */
export function toBillingCycle(frequency: string | null | undefined): BillingCycle {
  switch (frequency) {
    case 'quarterly': return 'quarterly';
    case 'semi-annual': return 'semi-annual';
    case 'annual': return 'annual';
    default: return 'annual';
  }
}

// ── Lifecycle service ────────────────────────────────────────────────

export const membershipLifecycle = {
  /**
   * Settle a payment: allocate funds across org funds, extend membership
   * expiry via computeNewExpiry, and update membership status.
   *
   * Must be called inside a transaction (txDb).
   */
  async settlePayment(
    txDb: DatabaseInstance,
    params: SettlePaymentParams,
  ): Promise<SettlementResult> {
    const { orgId, personId, paymentId, amount } = params;
    const repo = new DuesRepository(txDb);

    // --- Fund Allocation ---
    const funds = await repo.listFunds(orgId);
    let fundAllocations: { fundName: string; amount: number }[] = [];

    if (funds.length > 0) {
      const splits = allocateFunds(amount, funds.map((f) => ({
        fundId: f.id,
        percentage: parseFloat(f.percentage),
      })));

      await repo.createFundAllocations(
        splits.map((s) => ({
          paymentId,
          fundId: s.fundId,
          amount: s.amount,
          isReversal: false,
          organizationId: orgId,
        }))
      );

      fundAllocations = splits.map((s) => ({
        fundName: funds.find((f) => f.id === s.fundId)?.name ?? s.fundId,
        amount: s.amount,
      }));
    }

    // --- Lookup billing frequency from org dues config ---
    const duesConfig = await repo.getConfig(orgId);
    const billingCycle = toBillingCycle(duesConfig?.billingFrequency);

    // --- Membership Expiry Extension ---
    const membershipRepo = new MembershipRepository(txDb);
    const membershipResults = await membershipRepo.findMany({
      organizationId: orgId,
      personId,
    });
    const membership = membershipResults[0];

    let membershipExtendedFrom: string | null = null;
    let membershipExtendedTo: string | null = null;

    if (membership) {
      const currentExpiry = membership.duesExpiryDate
        ? new Date(membership.duesExpiryDate)
        : null;

      membershipExtendedFrom = membership.duesExpiryDate ?? null;

      const newExpiry = computeNewExpiry({
        currentExpiry,
        billingCycle,
      });
      membershipExtendedTo = newExpiry.toISOString().split('T')[0]!;

      // [BR-03] Only reactivate if current status allows payment-driven transition.
      const newStatus = PAYMENT_REACTIVATABLE_STATUSES.includes(membership.status)
        ? 'active'
        : membership.status;

      await membershipRepo.updateOneById(membership.id, {
        duesExpiryDate: membershipExtendedTo,
        status: newStatus,
      } as any);
    }

    return { fundAllocations, membershipExtendedFrom, membershipExtendedTo };
  },

  /**
   * Process a refund: reverse fund allocations, update payment status,
   * reset membership expiry on full refund, and recompute membership status.
   *
   * Must be called inside a transaction (txDb).
   */
  async processRefund(
    txDb: DatabaseInstance,
    params: ProcessRefundParams,
  ): Promise<RefundResult> {
    const { paymentId, payment, refundAmount, isFullRefund } = params;
    const txRepo = new DuesRepository(txDb);
    const membershipRepo = new MembershipRepository(txDb);

    // --- Reverse fund allocations ---
    const allocations = await txRepo.getFundAllocations(paymentId);
    const originalAllocations = allocations.filter((a: any) => !a.isReversal);

    if (originalAllocations.length > 0) {
      const refundRatio = refundAmount / payment.amount;
      const reversals = originalAllocations.map((a: any) => ({
        paymentId,
        fundId: a.fundId,
        amount: -Math.round(a.amount * refundRatio),
        isReversal: true,
        organizationId: payment.organizationId,
      }));
      await txRepo.createFundAllocations(reversals);
    }

    // --- Update payment status ---
    const newRefundedAmount = refundAmount; // caller may accumulate externally
    const newStatus = isFullRefund ? 'refunded' : 'partiallyRefunded';

    // --- Reset membership expiry + recompute status on full refund ---
    if (isFullRefund && payment.membershipExtendedFrom !== undefined) {
      const memberships = await membershipRepo.findMany({
        organizationId: payment.organizationId,
        personId: payment.personId,
      });
      const membership = memberships[0];

      if (membership) {
        const restoredExpiry = payment.membershipExtendedFrom ?? null;
        const recomputedStatus = await membershipLifecycle.recomputeStatus(
          txDb,
          membership,
          restoredExpiry,
        );

        await membershipRepo.updateOneById(membership.id, {
          duesExpiryDate: restoredExpiry,
          status: recomputedStatus,
        } as any);
      }
    }

    return {
      newStatus,
      newRefundedAmount,
      refundedAmount: newRefundedAmount,
    };
  },

  /**
   * Extend a membership's expiry by one billing cycle and update status.
   * Used by markDuesInvoicePaid which doesn't do fund allocation.
   *
   * Must be called inside a transaction (txDb).
   */
  async extendMembershipExpiry(
    txDb: DatabaseInstance,
    params: { membershipId: string; orgId: string },
  ): Promise<{ extendedTo: string | null }> {
    const repo = new DuesRepository(txDb);
    const membershipRepo = new MembershipRepository(txDb);

    const duesConfig = await repo.getConfig(params.orgId);
    const billingCycle = toBillingCycle(duesConfig?.billingFrequency);

    const membership = await membershipRepo.findOneById(params.membershipId);
    if (!membership) return { extendedTo: null };

    const currentExpiry = membership.duesExpiryDate
      ? new Date(membership.duesExpiryDate)
      : null;
    const newExpiry = computeNewExpiry({ currentExpiry, billingCycle });
    const newExpiryDate = newExpiry.toISOString().split('T')[0]!;

    // [BR-03] Only reactivate if current status allows payment-driven transition.
    const newStatus = PAYMENT_REACTIVATABLE_STATUSES.includes(membership.status)
      ? 'active'
      : membership.status;

    await membershipRepo.updateOneById(params.membershipId, {
      duesExpiryDate: newExpiryDate,
      status: newStatus,
    } as any);

    return { extendedTo: newExpiryDate };
  },

  /**
   * Recompute membership status from expiry date and membership flags.
   * Delegates to the pure computeMembershipStatus function.
   */
  async recomputeStatus(
    _txDb: DatabaseInstance,
    membership: { suspendedAt?: Date | null; removedAt?: Date | null },
    duesExpiryDate: string | null,
  ): Promise<ComputedMembershipStatus> {
    return computeMembershipStatus({
      duesExpiryDate,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      suspendedAt: (membership as any).suspendedAt ?? null,
      removedAt: (membership as any).removedAt ?? null,
    });
  },
};
