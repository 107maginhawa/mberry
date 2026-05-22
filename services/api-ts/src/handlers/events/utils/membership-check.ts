/**
 * Membership check utility for the events module.
 *
 * Wraps the cross-context MembershipRepository import so that
 * registerForEvent (and future event handlers) depend on a local
 * seam instead of reaching directly into association:member internals.
 *
 * V-18: Decouples events from association:member bounded context.
 */

import type { DatabaseInstance } from '@/core/database';
import { MembershipRepository } from '../../association:member/repos/membership.repo';

/**
 * Check whether a person holds an active membership in the given org.
 *
 * @returns `true` if the person has a membership with status `'active'`,
 *          `false` otherwise (no membership, lapsed, grace-period, etc.).
 */
export async function checkActiveMembership(
  db: DatabaseInstance,
  personId: string,
  orgId: string,
): Promise<boolean> {
  const repo = new MembershipRepository(db);
  const membership = await repo.findByPersonAndOrg(personId, orgId);
  return membership?.status === 'active';
}
