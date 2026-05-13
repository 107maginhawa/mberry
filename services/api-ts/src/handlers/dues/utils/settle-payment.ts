/**
 * settlePayment — shared fund allocation + membership expiry extension
 *
 * Extracted from recordDuesPayment (Slice 1) for reuse in confirmPaymentProof (Slice 2).
 * Performs two operations in sequence:
 *   1. Allocates payment across org funds (if configured)
 *   2. Extends membership duesExpiryDate via computeNewExpiry
 *
 * Returns the fund allocation results and the new expiry date for response enrichment.
 */

import type { DatabaseInstance } from '@/core/database';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { allocateFunds } from './fund-math';
import { computeNewExpiry, type BillingCycle } from './expiry-extension';

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

export interface SettlePaymentInput {
  db: DatabaseInstance;
  orgId: string;
  personId: string;
  paymentId: string;
  amount: number;
  /** Optional transaction handle — when provided, settlePayment runs inside this tx instead of opening its own. */
  tx?: DatabaseInstance;
}

export interface SettlePaymentResult {
  fundAllocations: { fundName: string; amount: number }[];
  membershipExtendedFrom: string | null;
  membershipExtendedTo: string | null;
}

export async function settlePayment(input: SettlePaymentInput): Promise<SettlePaymentResult> {
  const { db, orgId, personId, paymentId, amount, tx: outerTx } = input;

  // If an outer transaction is provided, run directly inside it; otherwise open a new one.
  const execute = async (tx: DatabaseInstance): Promise<SettlePaymentResult> => {
    const repo = new DuesRepository(tx);

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
    const membershipRepo = new MembershipRepository(tx);
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
      // Suspended/terminated members must NOT be reactivated by payment — officer action required.
      const paymentReactivatableStatuses = ['pendingPayment', 'active', 'gracePeriod', 'lapsed'];
      const newStatus = paymentReactivatableStatuses.includes(membership.status)
        ? 'active'
        : membership.status;

      await membershipRepo.updateOneById(membership.id, {
        duesExpiryDate: membershipExtendedTo,
        status: newStatus,
      } as any);
    }

    return { fundAllocations, membershipExtendedFrom, membershipExtendedTo };
  };

  return outerTx ? execute(outerTx) : db.transaction(execute);
}
