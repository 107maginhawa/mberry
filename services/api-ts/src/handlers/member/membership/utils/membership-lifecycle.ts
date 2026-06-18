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
 *
 * PaymentPort is injected to break the Financial↔Membership circular
 * dependency (BCI-01). Callers pass a concrete DuesRepository (or mock).
 */

import type { DatabaseInstance } from '@/core/database';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { allocateFunds } from './fund-math';
import { computeNewExpiry, type BillingCycle } from './expiry-extension';
import { computeMembershipStatus, type ComputedMembershipStatus } from './compute-membership-status';
import { persistWithComputedStatus } from './membership-status-middleware';
import type { Membership } from '@/handlers/association:member/repos/membership.schema';

// ── PaymentPort — interface over DuesRepository methods used here ─────────

/**
 * Minimal interface covering the DuesRepository methods consumed by
 * membershipLifecycle. Satisfied by DuesRepository at call sites.
 */
export interface PaymentPort {
  listFunds(organizationId: string): Promise<Array<{ id: string; name: string; percentage: string }>>;
  createFundAllocations(allocations: Array<{
    paymentId: string;
    fundId: string;
    amount: number;
    isReversal: boolean;
    organizationId: string;
  }>): Promise<void>;
  getConfig(organizationId: string): Promise<{ billingFrequency: string } | undefined>;
  getFundAllocations(paymentId: string): Promise<Array<{ fundId: string; amount: number; isReversal: boolean }>>;
}

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

// ── Lifecycle service factory ─────────────────────────────────────────

/**
 * Create a membershipLifecycle object with an injected paymentPort.
 * At call sites, pass `new DuesRepository(txDb)` as paymentPort.
 *
 * The standalone `membershipLifecycle` export below uses a factory that
 * accepts paymentPort at method-call time (via `port` parameter) so
 * existing callers that construct DuesRepository themselves are unaffected.
 */
export function createMembershipLifecycle(paymentPort: PaymentPort) {
  return {
    async settlePayment(
      txDb: DatabaseInstance,
      params: SettlePaymentParams,
    ): Promise<SettlementResult> {
      const { orgId, personId, paymentId, amount } = params;
      const repo = paymentPort;

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

        await persistWithComputedStatus(txDb, membership.id, membership, {
          duesExpiryDate: membershipExtendedTo,
        });
      }

      return { fundAllocations, membershipExtendedFrom, membershipExtendedTo };
    },

    async processRefund(
      txDb: DatabaseInstance,
      params: ProcessRefundParams,
    ): Promise<RefundResult> {
      const { paymentId, payment, refundAmount, isFullRefund } = params;
      const txRepo = paymentPort;
      const membershipRepo = new MembershipRepository(txDb);

      // --- Reverse fund allocations ---
      const allocations = await txRepo.getFundAllocations(paymentId);
      type FundAllocation = Awaited<ReturnType<typeof txRepo.getFundAllocations>>[number];
      const originalAllocations = allocations.filter((a: FundAllocation) => !a.isReversal);

      if (originalAllocations.length > 0) {
        const refundRatio = refundAmount / payment.amount;
        const totalAllocated = originalAllocations.reduce((sum, a) => sum + a.amount, 0);
        const targetTotal = Math.round(totalAllocated * refundRatio);

        let distributed = 0;
        const reversals = originalAllocations.map((a, i) => {
          const isLast = i === originalAllocations.length - 1;
          const share = isLast ? targetTotal - distributed : Math.round(a.amount * refundRatio);
          distributed += share;
          return {
            paymentId,
            fundId: a.fundId,
            amount: -share,
            isReversal: true,
            organizationId: payment.organizationId,
          };
        });
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

          await persistWithComputedStatus(txDb, membership.id, membership, {
            duesExpiryDate: restoredExpiry,
          });
        }
      }

      return {
        newStatus,
        newRefundedAmount,
        refundedAmount: newRefundedAmount,
      };
    },

    async extendMembershipExpiry(
      txDb: DatabaseInstance,
      params: { membershipId: string; orgId: string },
    ): Promise<{ extendedTo: string | null }> {
      const repo = paymentPort;
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

      await persistWithComputedStatus(txDb, params.membershipId, membership, {
        duesExpiryDate: newExpiryDate,
      });

      return { extendedTo: newExpiryDate };
    },

    async recomputeStatus(
      _txDb: DatabaseInstance,
      membership: {
        suspendedAt?: Date | null;
        removedAt?: Date | null;
        dateOfDeath?: string | null;
        expelledAt?: Date | null;
        resignedAt?: Date | null;
        isExpired?: boolean;
      },
      duesExpiryDate: string | null,
    ): Promise<ComputedMembershipStatus> {
      return computeMembershipStatus({
        duesExpiryDate,
        gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
        suspendedAt: membership.suspendedAt ?? null,
        removedAt: membership.removedAt ?? null,
        dateOfDeath: membership.dateOfDeath,
        expelledAt: membership.expelledAt,
        resignedAt: membership.resignedAt,
        isExpired: membership.isExpired,
      });
    },
  };
}

// ── Legacy singleton — constructs DuesRepository per-call (backward compat) ──

/**
 * Backward-compatible singleton. Callers that pass `txDb` expect us to
 * construct a DuesRepository internally. We do that here using a lazy
 * import (no static import of DuesRepository = no circular dep).
 *
 * Prefer `createMembershipLifecycle(paymentPort)` for new code.
 */
export const membershipLifecycle = {
  async settlePayment(
    txDb: DatabaseInstance,
    params: SettlePaymentParams,
  ): Promise<SettlementResult> {
    const { DuesRepository } = await import('@/handlers/dues/repos/dues-payments.repo');
    const lifecycle = createMembershipLifecycle(new DuesRepository(txDb));
    return lifecycle.settlePayment(txDb, params);
  },

  async processRefund(
    txDb: DatabaseInstance,
    params: ProcessRefundParams,
  ): Promise<RefundResult> {
    const { DuesRepository } = await import('@/handlers/dues/repos/dues-payments.repo');
    const lifecycle = createMembershipLifecycle(new DuesRepository(txDb));
    return lifecycle.processRefund(txDb, params);
  },

  async extendMembershipExpiry(
    txDb: DatabaseInstance,
    params: { membershipId: string; orgId: string },
  ): Promise<{ extendedTo: string | null }> {
    const { DuesRepository } = await import('@/handlers/dues/repos/dues-payments.repo');
    const lifecycle = createMembershipLifecycle(new DuesRepository(txDb));
    return lifecycle.extendMembershipExpiry(txDb, params);
  },

  async recomputeStatus(
    _txDb: DatabaseInstance,
    membership: {
      suspendedAt?: Date | null;
      removedAt?: Date | null;
      dateOfDeath?: string | null;
      expelledAt?: Date | null;
      resignedAt?: Date | null;
      isExpired?: boolean;
    },
    duesExpiryDate: string | null,
  ): Promise<ComputedMembershipStatus> {
    return computeMembershipStatus({
      duesExpiryDate,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      suspendedAt: membership.suspendedAt ?? null,
      removedAt: membership.removedAt ?? null,
      dateOfDeath: membership.dateOfDeath,
      expelledAt: membership.expelledAt,
      resignedAt: membership.resignedAt,
      isExpired: membership.isExpired,
    });
  },
};
