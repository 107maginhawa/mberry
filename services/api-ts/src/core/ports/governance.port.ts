/**
 * GovernancePort — minimal slice of governance behavior consumed by core/middleware.
 *
 * Resolves S-C4-014 (audit IC-01): middleware/officer-auth.ts previously
 * imported `OfficerTermRepository` from `@/handlers/association:member/repos`.
 * The interface lives here; the adapter is exported as `governanceRepoPort`
 * from the same repo file so callers in `app.ts` can wire concretely while
 * `core/` only sees this contract.
 */

/** Shape of an active officer term as middleware needs it. */
export interface ActiveOfficerTerm {
  id: string;
  positionTitle?: string;
  // The repo exposes more fields; the port narrows to what officer-auth uses.
}

export interface GovernancePort {
  /**
   * Returns the active officer terms for a person within an org, joined
   * with their position metadata. Used to make access + 2FA decisions.
   */
  findActiveOfficerTermsByPersonAndOrg(
    personId: string,
    orgId: string,
  ): Promise<ActiveOfficerTerm[]>;
}
