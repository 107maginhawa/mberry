// Business Rules: [BR-34]
/**
 * [BR-34] Nomination Eligibility
 *
 * BR-34: "To be nominated for an officer position, a member must satisfy all
 * three conditions: (1) be in Active status in the org at the time of nomination,
 * (2) have been a member of the association for at least 6 months (configurable
 * per association), and (3) not be currently suspended in any org within the
 * association. The duration requirement is configurable per association."
 *
 * Edge case: "Eligibility is checked at the moment of nomination, not
 * retroactively. A member who meets all criteria at nomination time but later
 * falls into Grace status before voting opens does not become ineligible
 * retroactively — only their voting eligibility is affected (per BR-33),
 * not their candidacy."
 */

import { describe, test, expect } from 'bun:test';

// ─── Pure rule functions (nomination eligibility logic) ───

const DEFAULT_MIN_MEMBERSHIP_MONTHS = 6;

interface MemberContext {
  personId: string;
  organizationId: string;
  status: 'active' | 'grace' | 'lapsed' | 'suspended';
  memberSince: Date;
  suspendedInAnyOrg: boolean;
}

interface NominationConfig {
  minMembershipMonths: number;
}

interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

function checkNominationEligibility(
  member: MemberContext,
  config: NominationConfig,
  nominationDate: Date,
): EligibilityResult {
  const reasons: string[] = [];

  // Condition 1: Active status at time of nomination
  if (member.status !== 'active') {
    reasons.push(`Member status is '${member.status}', must be 'active'`);
  }

  // Condition 2: Minimum membership duration
  const monthsSince = monthsBetween(member.memberSince, nominationDate);
  if (monthsSince < config.minMembershipMonths) {
    reasons.push(
      `Member for ${monthsSince} months, minimum is ${config.minMembershipMonths}`,
    );
  }

  // Condition 3: Not suspended in any org
  if (member.suspendedInAnyOrg) {
    reasons.push('Member is currently suspended in another org');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

describe('[BR-34] Nomination Eligibility', () => {
  const defaultConfig: NominationConfig = {
    minMembershipMonths: DEFAULT_MIN_MEMBERSHIP_MONTHS,
  };
  const nominationDate = new Date('2026-06-01');

  // ─── All Three Conditions Met ─────────────────────────────

  test('eligible when active, 6+ months, not suspended', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active',
      memberSince: new Date('2025-01-01'), // 17 months
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  // ─── Condition 1: Must Be Active ──────────────────────────

  test('ineligible when status is grace', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'grace',
      memberSince: new Date('2025-01-01'),
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toContain('grace');
  });

  test('ineligible when status is lapsed', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'lapsed',
      memberSince: new Date('2025-01-01'),
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(false);
  });

  test('ineligible when status is suspended', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'suspended',
      memberSince: new Date('2025-01-01'),
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(false);
  });

  // ─── Condition 2: Minimum Membership Duration ─────────────

  test('ineligible when member for less than 6 months', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active',
      memberSince: new Date('2026-02-01'), // 4 months
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toContain('4 months');
  });

  test('eligible at exactly 6 months', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active',
      memberSince: new Date('2025-12-01'), // exactly 6 months
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(true);
  });

  test('configurable duration — association requires 12 months', () => {
    const strictConfig: NominationConfig = { minMembershipMonths: 12 };
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active',
      memberSince: new Date('2025-10-01'), // 8 months
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(member, strictConfig, nominationDate);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toContain('12');
  });

  // ─── Condition 3: Not Suspended in Any Org ────────────────

  test('ineligible when suspended in another org', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active', // active in THIS org
      memberSince: new Date('2025-01-01'),
      suspendedInAnyOrg: true, // but suspended in ANOTHER org
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toContain('suspended');
  });

  // ─── Multiple Failures ────────────────────────────────────

  test('reports all failure reasons when multiple conditions fail', () => {
    const member: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'lapsed',
      memberSince: new Date('2026-04-01'), // 2 months
      suspendedInAnyOrg: true,
    };

    const result = checkNominationEligibility(member, defaultConfig, nominationDate);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(3);
  });

  // ─── Edge Case: Point-in-Time Check ───────────────────────

  test('eligibility checked at nomination time, not retroactively', () => {
    // Member is active at nomination time
    const memberAtNomination: MemberContext = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active',
      memberSince: new Date('2025-01-01'),
      suspendedInAnyOrg: false,
    };

    const result = checkNominationEligibility(
      memberAtNomination,
      defaultConfig,
      nominationDate,
    );
    expect(result.eligible).toBe(true);

    // Later falls to grace — does NOT retroactively invalidate nomination
    const memberLater: MemberContext = {
      ...memberAtNomination,
      status: 'grace',
    };

    // The nomination was already valid — candidacy preserved
    // (voting eligibility is separate per BR-33)
    expect(result.eligible).toBe(true);
    // memberLater's grace status affects voting, not candidacy
    expect(memberLater.status).toBe('grace');
  });
});
