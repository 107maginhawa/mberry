/**
 * BR-01: Membership status computed at query time from dues_expiry_date.
 * Never stored as mutable field. Pure function, no DB dependency.
 */

export type ComputedMembershipStatus =
  | 'pendingPayment'
  | 'active'
  | 'gracePeriod'
  | 'lapsed'
  | 'expired'
  | 'suspended'
  | 'removed'
  | 'resigned'
  | 'deceased'
  | 'expelled';

export interface MembershipStatusInput {
  duesExpiryDate: string | null;
  gracePeriodDays: number;
  suspendedAt: Date | null;
  removedAt: Date | null;
  /** True when membership was just created and no payment exists yet */
  isPendingPayment?: boolean;
  /** LIF-04: date of death recorded on the membership record */
  dateOfDeath?: string | null;
  /** LIF-04: member was expelled via disciplinary process */
  expelledAt?: Date | null;
  /** LIF-04: member voluntarily resigned */
  resignedAt?: Date | null;
  /**
   * True when the membership term has definitively ended with no renewal path.
   * Distinct from lapsed: expired = term closed, lapsed = within-grace or post-grace
   * on an otherwise renewable membership.
   */
  isExpired?: boolean;
}

/**
 * Compute membership status from expiry date and flags.
 *
 * Priority order (P0 terminals first — irreversible):
 * 1. deceased   (P0 — dateOfDeath set)
 * 2. expelled   (P0 — disciplinary removal)
 * 3. resigned   (P0 — voluntary departure)
 * 4. removed    (P0 — officer-initiated removal)
 * 5. suspended  (P1 — reversible officer action)
 * 6. expired    (P0 — membership term definitively closed)
 * 7. pendingPayment (initial state, no payment yet)
 * 8. active     (null expiry = life/honorary, or expiry >= today)
 * 9. gracePeriod (within grace window after expiry)
 * 10. lapsed    (grace window also expired)
 */
export function computeMembershipStatus(
  input: MembershipStatusInput,
  now: Date = new Date(),
): ComputedMembershipStatus {
  // P0 terminal states — irreversible, highest priority
  if (input.dateOfDeath) return 'deceased';
  if (input.expelledAt) return 'expelled';
  if (input.resignedAt) return 'resigned';
  if (input.removedAt) return 'removed';

  // P1 reversible officer action
  if (input.suspendedAt) return 'suspended';

  // P0 terminal — membership term definitively closed
  if (input.isExpired) return 'expired';

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
