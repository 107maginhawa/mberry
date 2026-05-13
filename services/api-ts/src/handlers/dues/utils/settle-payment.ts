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
import { computeNewExpiry } from './expiry-extension';

export interface SettlePaymentInput {
  db: DatabaseInstance;
  orgId: string;
  personId: string;
  paymentId: string;
  amount: number;
}

export interface SettlePaymentResult {
  fundAllocations: { fundName: string; amount: number }[];
  membershipExtendedFrom: string | null;
  membershipExtendedTo: string | null;
}

export async function settlePayment(input: SettlePaymentInput): Promise<SettlePaymentResult> {
  const { db, orgId, personId, paymentId, amount } = input;
  const repo = new DuesRepository(db);

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

  // --- Membership Expiry Extension ---
  const membershipRepo = new MembershipRepository(db);
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
      billingCycle: 'annual', // default — no billingCycle column yet
    });
    membershipExtendedTo = newExpiry.toISOString().split('T')[0]!;

    await membershipRepo.updateOneById(membership.id, {
      duesExpiryDate: membershipExtendedTo,
      status: 'active',
    } as any);
  }

  return { fundAllocations, membershipExtendedFrom, membershipExtendedTo };
}
