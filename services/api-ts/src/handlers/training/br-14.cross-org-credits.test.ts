// Business Rules: [BR-14]
/**
 * [BR-14] Cross-Organization Credit Aggregation — Pure Domain Logic Tests
 *
 * BR-14: Credits earned in one organization count toward the member's total
 * across all orgs within the same association. A member with memberships in
 * multiple chapters (same association) has a unified credit total.
 */

import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Domain types ────────────────────────────────────────────

interface CreditEntry {
  id: string;
  personId: string;
  organizationId: string;
  associationId: string;
  amount: number;
  cycleStart: Date;
  cycleEnd: Date;
  type: 'auto' | 'manual';
}

// ─── Domain helpers (pure, no DB, no HTTP) ──────────────────

/**
 * Aggregates credits for a person across all orgs in an association.
 * BR-14: returns total regardless of which org awarded the credit.
 */
function aggregateCreditsForAssociation(
  personId: string,
  associationId: string,
  entries: CreditEntry[],
  cycleStart: Date,
  cycleEnd: Date,
): number {
  return entries
    .filter(
      (e) =>
        e.personId === personId &&
        e.associationId === associationId &&
        e.cycleStart >= cycleStart &&
        e.cycleEnd <= cycleEnd,
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Aggregates credits scoped to a single org (for org-level display).
 */
function aggregateCreditsForOrg(
  personId: string,
  organizationId: string,
  entries: CreditEntry[],
): number {
  return entries
    .filter((e) => e.personId === personId && e.organizationId === organizationId)
    .reduce((sum, e) => sum + e.amount, 0);
}

// ─── [BR-14] Tests ──────────────────────────────────────────

describe('[BR-14] Cross-Org Credits Count Toward Association Total', () => {
  const PERSON_ID = 'person-0000-0000-0000-000000000001';
  const ASSOC_ID = 'assoc-0000-0000-0000-000000000001';
  const ORG_MANILA = 'org-manila-00000000000000000001';
  const ORG_CEBU = 'org-cebu-000000000000000000001';
  const OTHER_ASSOC = 'assoc-other-00000000000000000001';

  const CYCLE_START = new Date('2024-01-01');
  const CYCLE_END = new Date('2025-12-31');

  const entries: CreditEntry[] = [
    {
      id: 'credit-1',
      personId: PERSON_ID,
      organizationId: ORG_MANILA,
      associationId: ASSOC_ID,
      amount: 15,
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
      type: 'auto',
    },
    {
      id: 'credit-2',
      personId: PERSON_ID,
      organizationId: ORG_CEBU,
      associationId: ASSOC_ID,
      amount: 20,
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
      type: 'auto',
    },
    {
      id: 'credit-3',
      personId: PERSON_ID,
      organizationId: ORG_MANILA,
      associationId: OTHER_ASSOC,
      amount: 10,
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
      type: 'auto',
    },
  ];

  test('[BR-14] credits from two orgs in same association aggregate together', () => {
    const total = aggregateCreditsForAssociation(
      PERSON_ID,
      ASSOC_ID,
      entries,
      CYCLE_START,
      CYCLE_END,
    );
    expect(total).toBe(35); // 15 + 20
  });

  test('[BR-14] credits from other associations are excluded', () => {
    const total = aggregateCreditsForAssociation(
      PERSON_ID,
      ASSOC_ID,
      entries,
      CYCLE_START,
      CYCLE_END,
    );
    // Should not include the 10 credits from OTHER_ASSOC
    expect(total).toBe(35);
  });

  test('[BR-14] org-level view shows only that org\'s credits', () => {
    const manilaOnly = aggregateCreditsForOrg(PERSON_ID, ORG_MANILA, entries);
    const cebuOnly = aggregateCreditsForOrg(PERSON_ID, ORG_CEBU, entries);
    expect(manilaOnly).toBe(25); // 15 (ASSOC_ID) + 10 (OTHER_ASSOC)
    expect(cebuOnly).toBe(20);
  });

  test('[BR-14] member with single org still gets correct total', () => {
    const singleOrgEntries: CreditEntry[] = [
      {
        id: 'credit-s1',
        personId: PERSON_ID,
        organizationId: ORG_MANILA,
        associationId: ASSOC_ID,
        amount: 30,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        type: 'auto',
      },
    ];
    const total = aggregateCreditsForAssociation(
      PERSON_ID,
      ASSOC_ID,
      singleOrgEntries,
      CYCLE_START,
      CYCLE_END,
    );
    expect(total).toBe(30);
  });

  test('[BR-14] different person\'s credits are not included', () => {
    const OTHER_PERSON = 'person-other-0000-0000-000000000002';
    const total = aggregateCreditsForAssociation(
      OTHER_PERSON,
      ASSOC_ID,
      entries,
      CYCLE_START,
      CYCLE_END,
    );
    expect(total).toBe(0);
  });
});
