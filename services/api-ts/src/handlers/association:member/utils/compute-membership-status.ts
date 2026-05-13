/**
 * BR-01: Membership status computed at query time from dues_expiry_date.
 * Never stored as mutable field. Pure function, no DB dependency.
 */

export type ComputedMembershipStatus =
  | 'pendingPayment'
  | 'active'
  | 'gracePeriod'
  | 'lapsed'
  | 'suspended'
  | 'terminated';

export interface MembershipStatusInput {
  duesExpiryDate: string | null;
  gracePeriodDays: number;
  suspendedAt: Date | null;
  terminatedAt: Date | null;
  /** True when membership was just created and no payment exists yet */
  isPendingPayment?: boolean;
}

/**
 * Compute membership status from expiry date and flags.
 *
 * Priority order:
 * 1. terminated (highest — irreversible officer action)
 * 2. suspended (officer action, reversible)
 * 3. pendingPayment (initial state, no payment yet)
 * 4. active (null expiry = life/honorary, or expiry >= today)
 * 5. gracePeriod (within grace window after expiry)
 * 6. lapsed (grace window also expired)
 */
export function computeMembershipStatus(
  input: MembershipStatusInput,
  now: Date = new Date(),
): ComputedMembershipStatus {
  // Officer overrides take precedence
  if (input.terminatedAt) return 'terminated';
  if (input.suspendedAt) return 'suspended';

  // Pending payment — just created, no payment yet
  if (input.isPendingPayment) return 'pendingPayment';

  // Null expiry = life/honorary member → always active
  if (input.duesExpiryDate === null) return 'active';

  // Compare dates (date-only, no time component)
  const expiry = new Date(input.duesExpiryDate + 'T00:00:00');
  const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00');

  if (expiry >= today) return 'active';

  // Past expiry — check grace period
  const graceEnd = new Date(expiry);
  graceEnd.setDate(graceEnd.getDate() + input.gracePeriodDays);

  if (today <= graceEnd) return 'gracePeriod';

  return 'lapsed';
}
