// Business Rules: [BR-39]
/**
 * [BR-39] Committee Dissolution
 *
 * BR-39: "When a committee term ends or the committee is dissolved by the
 * President, the committee status changes to Completed. All committee data —
 * meetings, minutes, tasks, and reports — is retained indefinitely for audit
 * purposes. Members lose access to the committee workspace, but officers and
 * platform admins can still view the full historical record."
 *
 * Edge case: "Dissolving a committee does not affect the membership status of
 * its members. Members who served on the committee retain their org membership
 * and all associated history. Only committee-specific access is removed."
 */

import { describe, test, expect } from 'bun:test';

// ─── Pure rule functions (will be extracted to module when M19 is built) ───

type CommitteeStatus = 'active' | 'completed';
type DissolutionReason = 'term_ended' | 'president_dissolved';
type ViewerRole = 'member' | 'officer' | 'platform_admin';

interface Committee {
  id: string;
  organizationId: string;
  name: string;
  status: CommitteeStatus;
  memberIds: string[];
  data: {
    meetings: object[];
    minutes: object[];
    tasks: object[];
    reports: object[];
  };
}

interface OrgMembership {
  personId: string;
  organizationId: string;
  status: 'active' | 'lapsed' | 'suspended';
  committeeHistory: string[];
}

function dissolveCommittee(
  committee: Committee,
  reason: DissolutionReason,
): Committee {
  return {
    ...committee,
    status: 'completed',
    // All data retained — no deletions
  };
}

function canAccessCommitteeWorkspace(
  committee: Committee,
  personId: string,
): boolean {
  // Only active committees have workspace access
  if (committee.status !== 'active') return false;
  return committee.memberIds.includes(personId);
}

function canViewHistoricalRecord(
  committee: Committee,
  role: ViewerRole,
): boolean {
  if (role === 'platform_admin') return true;
  if (role === 'officer') return true;
  // Regular members cannot view dissolved committee records
  return false;
}

function membershipAfterDissolution(
  membership: OrgMembership,
  committeeId: string,
): OrgMembership {
  // Dissolution does NOT change org membership status
  return {
    ...membership,
    committeeHistory: [...membership.committeeHistory, committeeId],
  };
}

describe('[BR-39] Committee Dissolution', () => {
  const activeCommittee: Committee = {
    id: 'comm-1',
    organizationId: 'org-1',
    name: 'Ethics Committee',
    status: 'active',
    memberIds: ['person-1', 'person-2', 'person-3'],
    data: {
      meetings: [{ id: 'mtg-1', date: '2026-01-15' }],
      minutes: [{ id: 'min-1', meetingId: 'mtg-1' }],
      tasks: [{ id: 'task-1', title: 'Review policy' }],
      reports: [{ id: 'rpt-1', title: 'Q1 Report' }],
    },
  };

  // ─── Status Transition ────────────────────────────────────

  test('term end changes status to Completed', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');
    expect(dissolved.status).toBe('completed');
  });

  test('president dissolution changes status to Completed', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'president_dissolved');
    expect(dissolved.status).toBe('completed');
  });

  // ─── Data Retention ───────────────────────────────────────

  test('all committee data retained after dissolution', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');

    expect(dissolved.data.meetings).toHaveLength(1);
    expect(dissolved.data.minutes).toHaveLength(1);
    expect(dissolved.data.tasks).toHaveLength(1);
    expect(dissolved.data.reports).toHaveLength(1);
  });

  test('committee identity preserved (name, org, members list)', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');

    expect(dissolved.name).toBe('Ethics Committee');
    expect(dissolved.organizationId).toBe('org-1');
    expect(dissolved.memberIds).toHaveLength(3);
  });

  // ─── Access Control After Dissolution ─────────────────────

  test('members lose workspace access after dissolution', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');
    expect(canAccessCommitteeWorkspace(dissolved, 'person-1')).toBe(false);
  });

  test('members have workspace access while committee is active', () => {
    expect(canAccessCommitteeWorkspace(activeCommittee, 'person-1')).toBe(true);
  });

  test('non-members cannot access active committee workspace', () => {
    expect(canAccessCommitteeWorkspace(activeCommittee, 'person-99')).toBe(false);
  });

  // ─── Historical View Access ───────────────────────────────

  test('officers can view historical record of dissolved committee', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');
    expect(canViewHistoricalRecord(dissolved, 'officer')).toBe(true);
  });

  test('platform admins can view historical record', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');
    expect(canViewHistoricalRecord(dissolved, 'platform_admin')).toBe(true);
  });

  test('regular members cannot view dissolved committee records', () => {
    const dissolved = dissolveCommittee(activeCommittee, 'term_ended');
    expect(canViewHistoricalRecord(dissolved, 'member')).toBe(false);
  });

  // ─── Edge Case: Org Membership Unaffected ─────────────────

  test('dissolution does not affect member org membership status', () => {
    const membership: OrgMembership = {
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'active',
      committeeHistory: [],
    };

    const afterDissolution = membershipAfterDissolution(membership, 'comm-1');

    // Status unchanged
    expect(afterDissolution.status).toBe('active');
    expect(afterDissolution.organizationId).toBe('org-1');
    // Committee added to history
    expect(afterDissolution.committeeHistory).toContain('comm-1');
  });

  test('dissolution of committee preserves all member history', () => {
    const membership: OrgMembership = {
      personId: 'person-2',
      organizationId: 'org-1',
      status: 'active',
      committeeHistory: ['comm-old-1', 'comm-old-2'],
    };

    const afterDissolution = membershipAfterDissolution(membership, 'comm-1');

    // Existing history preserved + new entry
    expect(afterDissolution.committeeHistory).toHaveLength(3);
    expect(afterDissolution.committeeHistory).toContain('comm-old-1');
    expect(afterDissolution.committeeHistory).toContain('comm-1');
  });
});
