/**
 * settlePayment — thin wrapper around membershipLifecycle.settlePayment
 *
 * Kept for backward compatibility. Delegates to the centralized
 * membership lifecycle service for fund allocation + expiry extension.
 */

import type { DatabaseInstance } from '@/core/database';
import { domainEvents } from '@/core/domain-events';
import {
  membershipLifecycle,
  toBillingCycle,
  type SettlementResult,
} from './membership-lifecycle';

// Re-export toBillingCycle so existing consumers (markDuesInvoicePaid) don't break
export { toBillingCycle };

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

  const execute = async (tx: DatabaseInstance): Promise<SettlementResult> => {
    return membershipLifecycle.settlePayment(tx, { orgId, personId, paymentId, amount });
  };

  const result = outerTx ? await execute(outerTx) : await db.transaction(execute);

  // Emit domain event after successful settlement (fire-and-forget)
  domainEvents.emit('dues.payment.recorded', {
    paymentId,
    personId,
    organizationId: orgId,
    amount,
    newExpiryDate: result.membershipExtendedTo,
  }).catch(() => {}); // swallow — bus already logs errors

  return result;
}
