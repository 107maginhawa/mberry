/**
 * [BR-07] Dues Expiry Extension on Payment
 *
 * When a payment is recorded, dues_expiry_date extends by one billing cycle
 * from the CURRENT expiry date — not from today. This ensures early-paying
 * members don't lose remaining time.
 *
 * Exception: if current expiry is MORE THAN one billing cycle in the past
 * (severely lapsed), new expiry = today + one billing cycle.
 *
 * The "severely lapsed" threshold is exactly one billing cycle. If the expiry
 * is exactly one billing cycle ago to the day, the standard extension
 * (from current expiry) still applies.
 */
import { addMonths, subMonths } from 'date-fns';

export type BillingCycle = 'annual' | 'quarterly' | 'semi-annual' | 'custom';

export interface ExpiryExtensionInput {
  currentExpiry: Date | null;
  billingCycle: BillingCycle;
  customMonths?: number;
  today?: Date; // injectable for testing
}

function getCycleMonths(cycle: BillingCycle, customMonths?: number): number {
  switch (cycle) {
    case 'annual': return 12;
    case 'semi-annual': return 6;
    case 'quarterly': return 3;
    case 'custom': return customMonths ?? 12;
  }
}

export function computeNewExpiry(input: ExpiryExtensionInput): Date {
  const today = input.today ?? new Date();
  const cycleMonths = getCycleMonths(input.billingCycle, input.customMonths);

  // No existing expiry (e.g. first payment) → today + one cycle
  if (!input.currentExpiry) {
    return addMonths(today, cycleMonths);
  }

  // Check if severely lapsed: expiry is MORE THAN one billing cycle in the past
  // "Exactly one billing cycle ago to the day" still uses standard extension
  const severeLapseThreshold = subMonths(today, cycleMonths);

  if (input.currentExpiry < severeLapseThreshold) {
    // Severely lapsed → reset from today
    return addMonths(today, cycleMonths);
  }

  // Standard: extend from current expiry
  return addMonths(input.currentExpiry, cycleMonths);
}
