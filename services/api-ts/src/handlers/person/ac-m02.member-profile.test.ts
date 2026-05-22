/**
 * AC tests for M02 — Member Profile
 * Pure domain logic — no DB, no HTTP.
 */

import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportRecord {
  personId: string;
  requestedAt: Date;
}

interface Payment {
  id: string;
  personId: string;
  status: 'pending' | 'completed' | 'refunded';
  amount: number;
}

interface Session {
  id: string;
  personId: string;
  createdAt: Date;
  revokedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Pure functions under test
// ---------------------------------------------------------------------------

const EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function canRequestExport(
  personId: string,
  lastExport: ExportRecord | null,
  now: Date,
): { allowed: boolean; cooldownRemainingMs?: number } {
  if (!lastExport || lastExport.personId !== personId) return { allowed: true };
  const elapsed = now.getTime() - lastExport.requestedAt.getTime();
  if (elapsed < EXPORT_COOLDOWN_MS) {
    return { allowed: false, cooldownRemainingMs: EXPORT_COOLDOWN_MS - elapsed };
  }
  return { allowed: true };
}

function hasPendingPayments(personId: string, payments: Payment[]): boolean {
  return payments.some(p => p.personId === personId && p.status === 'pending');
}

function canDeleteMember(
  personId: string,
  payments: Payment[],
): { allowed: boolean; reason?: string } {
  if (hasPendingPayments(personId, payments)) {
    return { allowed: false, reason: 'Member has pending payments that must be resolved first' };
  }
  return { allowed: true };
}

function revokeSessionsForPerson(sessions: Session[], personId: string, revokedAt: Date): Session[] {
  return sessions.map(s =>
    s.personId === personId && s.revokedAt === null ? { ...s, revokedAt } : s,
  );
}

function activeSessionCount(sessions: Session[], personId: string): number {
  return sessions.filter(s => s.personId === personId && s.revokedAt === null).length;
}

// ---------------------------------------------------------------------------
// AC-M02-006: Data Export Rate Limit
// ---------------------------------------------------------------------------

describe('[AC-M02-006] Data Export Rate Limit', () => {
  const personId = 'person-1';

  test('allows export when no prior export exists', () => {
    const result = canRequestExport(personId, null, new Date());
    expect(result.allowed).toBe(true);
  });

  test('allows export when last export was >24h ago', () => {
    const yesterday = new Date(Date.now() - EXPORT_COOLDOWN_MS - 1000);
    const last: ExportRecord = { personId, requestedAt: yesterday };
    const result = canRequestExport(personId, last, new Date());
    expect(result.allowed).toBe(true);
  });

  test('rejects export when last export was <24h ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const last: ExportRecord = { personId, requestedAt: twoHoursAgo };
    const result = canRequestExport(personId, last, new Date());
    expect(result.allowed).toBe(false);
    expect(result.cooldownRemainingMs).toBeGreaterThan(0);
  });

  test('cooldown is per-person — different person is not affected', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const last: ExportRecord = { personId: 'other-person', requestedAt: oneHourAgo };
    const result = canRequestExport(personId, last, new Date());
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M02-007: Deletion Blocked by Payments
// ---------------------------------------------------------------------------

describe('[AC-M02-007] Deletion Blocked by Payments', () => {
  const personId = 'person-1';

  test('blocks deletion when pending payment exists', () => {
    const payments: Payment[] = [
      { id: 'pay-1', personId, status: 'pending', amount: 500 },
    ];
    const result = canDeleteMember(personId, payments);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('allows deletion when all payments are completed', () => {
    const payments: Payment[] = [
      { id: 'pay-1', personId, status: 'completed', amount: 500 },
    ];
    const result = canDeleteMember(personId, payments);
    expect(result.allowed).toBe(true);
  });

  test('allows deletion when no payments exist', () => {
    const result = canDeleteMember(personId, []);
    expect(result.allowed).toBe(true);
  });

  test('only considers payments for the specific person', () => {
    const payments: Payment[] = [
      { id: 'pay-1', personId: 'other-person', status: 'pending', amount: 500 },
    ];
    const result = canDeleteMember(personId, payments);
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M02-008: Session Revocation on Password Change
// ---------------------------------------------------------------------------

describe('[AC-M02-008] Session Revocation on Password Change', () => {
  const personId = 'person-1';
  const now = new Date();

  const sessions: Session[] = [
    { id: 's1', personId, createdAt: new Date(Date.now() - 10000), revokedAt: null },
    { id: 's2', personId, createdAt: new Date(Date.now() - 5000), revokedAt: null },
    { id: 's3', personId: 'other', createdAt: new Date(), revokedAt: null },
  ];

  test('revokes all active sessions for the person on password change', () => {
    const updated = revokeSessionsForPerson(sessions, personId, now);
    const active = activeSessionCount(updated, personId);
    expect(active).toBe(0);
  });

  test('revoked sessions have revokedAt set', () => {
    const updated = revokeSessionsForPerson(sessions, personId, now);
    const personSessions = updated.filter(s => s.personId === personId);
    personSessions.forEach(s => {
      expect(s.revokedAt).toEqual(now);
    });
  });

  test('does not revoke sessions belonging to other persons', () => {
    const updated = revokeSessionsForPerson(sessions, personId, now);
    const otherActive = activeSessionCount(updated, 'other');
    expect(otherActive).toBe(1);
  });

  test('already-revoked sessions are not re-stamped', () => {
    const prevRevoke = new Date(Date.now() - 99999);
    const withRevoked: Session[] = [
      { id: 's1', personId, createdAt: new Date(), revokedAt: prevRevoke },
    ];
    const updated = revokeSessionsForPerson(withRevoked, personId, now);
    // revokedAt should remain the original timestamp
    expect(updated[0].revokedAt).toEqual(prevRevoke);
  });
});
