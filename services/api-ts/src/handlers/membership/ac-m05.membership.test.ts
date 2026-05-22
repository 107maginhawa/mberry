/**
 * AC tests for M05 — Membership
 * Pure domain logic — no DB, no HTTP.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberStatus = 'Active' | 'Expired' | 'Pending' | 'Suspended' | 'Transferred';

interface MemberRecord {
  personId: string;
  orgId: string;
  email: string;
  duesExpiryDate: Date | null;
  status: MemberStatus;
  joinedAt: Date;
}

interface OrgHistoryEntry {
  personId: string;
  orgId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

interface Application {
  id: string;
  personId: string;
  orgId: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ---------------------------------------------------------------------------
// Pure functions under test
// ---------------------------------------------------------------------------

function isEmailTaken(email: string, existing: { email: string }[]): boolean {
  return existing.some(r => r.email.toLowerCase() === email.toLowerCase());
}

function canRegister(
  email: string,
  existing: { email: string }[],
): { allowed: boolean; reason?: string } {
  if (isEmailTaken(email, existing)) {
    return { allowed: false, reason: 'An account with this email already exists' };
  }
  return { allowed: true };
}

function computeMemberStatus(member: { duesExpiryDate: Date | null }, now: Date): MemberStatus {
  if (!member.duesExpiryDate) return 'Pending';
  return member.duesExpiryDate > now ? 'Active' : 'Expired';
}

function recordTransfer(
  personId: string,
  fromOrgId: string,
  toOrgId: string,
  now: Date,
  history: OrgHistoryEntry[],
): OrgHistoryEntry[] {
  // Close the current membership
  const updated = history.map(h =>
    h.personId === personId && h.orgId === fromOrgId && h.leftAt === null
      ? { ...h, leftAt: now }
      : h,
  );
  // Add new membership
  return [...updated, { personId, orgId: toOrgId, joinedAt: now, leftAt: null }];
}

function previousOrgHistoryPreserved(
  personId: string,
  orgId: string,
  history: OrgHistoryEntry[],
): boolean {
  return history.some(h => h.personId === personId && h.orgId === orgId);
}

function bulkApproveApplications(
  applications: Application[],
  officerOrgId: string,
  applicationIds: string[],
): { approved: Application[]; skipped: Application[] } {
  const approved: Application[] = [];
  const skipped: Application[] = [];

  for (const app of applications) {
    if (!applicationIds.includes(app.id)) continue;
    if (app.orgId !== officerOrgId) {
      skipped.push(app);
      continue;
    }
    if (app.status !== 'pending') {
      skipped.push(app);
      continue;
    }
    approved.push({ ...app, status: 'approved' });
  }

  return { approved, skipped };
}

// ---------------------------------------------------------------------------
// AC-M05-001: No Duplicate Accounts
// ---------------------------------------------------------------------------

describe('[AC-M05-001] No Duplicate Accounts', () => {
  const existing = [
    { email: 'alice@example.com' },
    { email: 'bob@example.com' },
  ];

  test('rejects registration with existing email', () => {
    const result = canRegister('alice@example.com', existing);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('rejects registration with existing email (case-insensitive)', () => {
    const result = canRegister('ALICE@EXAMPLE.COM', existing);
    expect(result.allowed).toBe(false);
  });

  test('allows registration with new email', () => {
    const result = canRegister('carol@example.com', existing);
    expect(result.allowed).toBe(true);
  });

  test('empty roster allows any email', () => {
    const result = canRegister('anyone@example.com', []);
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M05-002: Status Computation
// ---------------------------------------------------------------------------

describe('[AC-M05-002] Status Computation', () => {
  const now = new Date('2026-01-15T00:00:00Z');

  test('status is Active when duesExpiryDate is in the future', () => {
    const member = { duesExpiryDate: new Date('2026-12-31') };
    expect(computeMemberStatus(member, now)).toBe('Active');
  });

  test('status is Expired when duesExpiryDate is in the past', () => {
    const member = { duesExpiryDate: new Date('2025-12-31') };
    expect(computeMemberStatus(member, now)).toBe('Expired');
  });

  test('status is Pending when duesExpiryDate is null', () => {
    const member = { duesExpiryDate: null };
    expect(computeMemberStatus(member, now)).toBe('Pending');
  });

  test('status is Expired on the exact expiry date (not strictly future)', () => {
    const expiry = new Date('2026-01-15T00:00:00Z');
    const member = { duesExpiryDate: expiry };
    // expiry is NOT > now, so Expired
    expect(computeMemberStatus(member, now)).toBe('Expired');
  });
});

// ---------------------------------------------------------------------------
// AC-M05-006: Transfer Preserves History
// ---------------------------------------------------------------------------

describe('[AC-M05-006] Transfer Preserves History', () => {
  const now = new Date();
  const personId = 'p1';
  const fromOrg = 'org-1';
  const toOrg = 'org-2';

  const initialHistory: OrgHistoryEntry[] = [
    { personId, orgId: fromOrg, joinedAt: new Date('2022-01-01'), leftAt: null },
  ];

  test('previous org history entry is preserved after transfer', () => {
    const updated = recordTransfer(personId, fromOrg, toOrg, now, initialHistory);
    expect(previousOrgHistoryPreserved(personId, fromOrg, updated)).toBe(true);
  });

  test('previous org entry gets leftAt set', () => {
    const updated = recordTransfer(personId, fromOrg, toOrg, now, initialHistory);
    const prev = updated.find(h => h.orgId === fromOrg);
    expect(prev?.leftAt).toEqual(now);
  });

  test('new org entry is added with null leftAt', () => {
    const updated = recordTransfer(personId, fromOrg, toOrg, now, initialHistory);
    const newEntry = updated.find(h => h.orgId === toOrg);
    expect(newEntry).toBeDefined();
    expect(newEntry?.leftAt).toBeNull();
  });

  test('multi-org history all preserved after multiple transfers', () => {
    const h1 = recordTransfer(personId, fromOrg, toOrg, now, initialHistory);
    const h2 = recordTransfer(personId, toOrg, 'org-3', new Date(), h1);
    expect(previousOrgHistoryPreserved(personId, fromOrg, h2)).toBe(true);
    expect(previousOrgHistoryPreserved(personId, toOrg, h2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M05-007: Bulk Approve with Org Scope
// ---------------------------------------------------------------------------

describe('[AC-M05-007] Bulk Approve with Org Scope', () => {
  const officerOrgId = 'org-1';

  const applications: Application[] = [
    { id: 'a1', personId: 'p1', orgId: 'org-1', status: 'pending' },
    { id: 'a2', personId: 'p2', orgId: 'org-1', status: 'pending' },
    { id: 'a3', personId: 'p3', orgId: 'org-2', status: 'pending' }, // different org
    { id: 'a4', personId: 'p4', orgId: 'org-1', status: 'approved' }, // already approved
  ];

  test('approves only applications from the officer\'s own org', () => {
    const { approved, skipped } = bulkApproveApplications(
      applications,
      officerOrgId,
      ['a1', 'a2', 'a3'],
    );
    expect(approved.map(a => a.id)).toEqual(expect.arrayContaining(['a1', 'a2']));
    expect(skipped.map(a => a.id)).toContain('a3');
  });

  test('skips already-approved applications', () => {
    const { approved, skipped } = bulkApproveApplications(
      applications,
      officerOrgId,
      ['a1', 'a4'],
    );
    expect(approved.map(a => a.id)).toContain('a1');
    expect(skipped.map(a => a.id)).toContain('a4');
  });

  test('approved applications get status=approved', () => {
    const { approved } = bulkApproveApplications(applications, officerOrgId, ['a1']);
    expect(approved[0].status).toBe('approved');
  });

  test('empty selection produces no approvals', () => {
    const { approved, skipped } = bulkApproveApplications(applications, officerOrgId, []);
    expect(approved).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });
});
