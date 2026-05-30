/**
 * MembershipPort — minimal slice of membership lookup consumed by
 * core/middleware/org-context.ts.
 *
 * org-context formerly issued raw `db.select().from(memberships)` queries.
 * This port keeps the SQL co-located with the membership module while
 * giving middleware a stable contract to depend on.
 *
 * Resolves S-C4-014 (audit IC-01) for middleware/org-context.ts.
 */

export interface ActiveMembership {
  membershipId: string;
  personId: string;
  organizationId: string;
  status: string;
}

export interface MembershipPort {
  /**
   * Returns the membership row for (personId, orgId), excluding statuses
   * that represent permanent removal (removed/expelled/deceased). Returns
   * undefined if no eligible membership exists.
   */
  findActiveMembershipByPersonAndOrg(
    personId: string,
    orgId: string,
  ): Promise<ActiveMembership | undefined>;
}
