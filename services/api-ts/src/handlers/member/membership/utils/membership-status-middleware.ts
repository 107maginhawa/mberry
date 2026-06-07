/**
 * Membership Status Middleware (BR-01 Compliance)
 *
 * Status is NEVER stored as a mutable field — it is always computed
 * from flag fields (duesExpiryDate, suspendedAt, removedAt, etc.).
 * The DB column is kept as a denormalized cache for SQL WHERE clauses.
 *
 * Two functions:
 * - withComputedStatus(): wraps a read result with computed status
 * - persistWithComputedStatus(): writes updates + recomputed status cache
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { memberships, type Membership } from '@/handlers/association:member/repos/membership.schema';
import {
  computeMembershipStatus,
  type ComputedMembershipStatus,
} from './compute-membership-status';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape required to compute membership status from a row. */
export interface MembershipStatusFields {
  duesExpiryDate: string | null;
  gracePeriodDays: number;
  suspendedAt: Date | null;
  removedAt: Date | null;
  dateOfDeath?: string | null;
  // LIF-04 fields — not yet in schema; undefined = not set
  expelledAt?: Date | null;
  resignedAt?: Date | null;
  isPendingPayment?: boolean;
  isExpired?: boolean;
}

// ---------------------------------------------------------------------------
// Function 1: withComputedStatus (pure, no DB)
// ---------------------------------------------------------------------------

/**
 * Returns a shallow copy of `row` with `status` replaced by the value
 * computed from its flag fields. Pure function — no DB access.
 *
 * @param row     Any object that contains the membership flag fields.
 * @param gracePeriodDays  Override for grace period; falls back to
 *                         row.gracePeriodDays then defaults to 30.
 */
export function withComputedStatus<T extends MembershipStatusFields>(
  row: T,
  gracePeriodDays?: number,
): T & { status: ComputedMembershipStatus } {
  const grace =
    gracePeriodDays ?? row.gracePeriodDays ?? 30;

  const computed = computeMembershipStatus({
    duesExpiryDate: row.duesExpiryDate,
    gracePeriodDays: grace,
    suspendedAt: row.suspendedAt,
    removedAt: row.removedAt,
    dateOfDeath: row.dateOfDeath ?? null,
    expelledAt: row.expelledAt ?? null,
    resignedAt: row.resignedAt ?? null,
    isPendingPayment: row.isPendingPayment,
    isExpired: row.isExpired,
  });

  return { ...row, status: computed };
}

// ---------------------------------------------------------------------------
// Function 2: persistWithComputedStatus (writes to DB)
// ---------------------------------------------------------------------------

/**
 * Merges `currentRow` + `updates`, computes the resulting status, then
 * writes both the field updates and the computed status to the DB in a
 * single UPDATE. Returns the updated membership row.
 *
 * Must be called inside an existing transaction when atomicity is needed.
 *
 * @param db             Database instance (or transaction).
 * @param membershipId   PK of the membership to update.
 * @param currentRow     The current DB row (used as base for merge).
 * @param updates        Partial fields being changed.
 * @param gracePeriodDays  Override for grace period computation; falls back
 *                         to currentRow.gracePeriodDays then 30.
 */
export async function persistWithComputedStatus(
  db: DatabaseInstance,
  membershipId: string,
  currentRow: MembershipStatusFields,
  updates: Partial<MembershipStatusFields>,
  gracePeriodDays?: number,
): Promise<Membership> {
  // Merge current state with the incoming updates
  const merged: MembershipStatusFields = { ...currentRow, ...updates };

  // Compute status from the merged state
  const { status } = withComputedStatus(merged, gracePeriodDays);

  // Write updates + computed status in one round-trip
  const [updated] = await db
    .update(memberships)
    .set({ ...(updates as Partial<Membership>), status })
    .where(eq(memberships.id, membershipId))
    .returning();

  if (!updated) {
    throw new Error(`persistWithComputedStatus: membership ${membershipId} not found`);
  }

  return updated;
}
