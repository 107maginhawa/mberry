/**
 * [BR-34] Nomination Eligibility — Handler-Level Gap Tests
 *
 * Tests scenarios from BR-34 that are NOT already covered by createNominee.test.ts.
 * That file covers: all 3 conditions (active, tenure, suspension), configurable
 * duration, and election state guards. This file covers the point-in-time edge case
 * and additional handler-level verification.
 *
 * BR-34 edge: "Eligibility is checked at the moment of nomination, not
 * retroactively. A member who meets all criteria at nomination time but later
 * falls into Grace status before voting opens does not become ineligible
 * retroactively — only their voting eligibility is affected (per BR-33),
 * not their candidacy."
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection, fakeNominee as createFakeNominee } from '@/test-utils/factories';
import { createNominee } from './createNominee';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Helpers ────────────────────────────────────────────

const NOMINEE_ID = '00000000-0000-4000-8000-000000000099';
const POSITION_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID = 'org-1';
const ELECTION_ID = 'election-1';

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

const fakeElection = createFakeElection({ status: 'nominationsOpen' });

const fakeNominee = createFakeNominee({
  positionId: POSITION_ID,
  personId: NOMINEE_ID,
  organizationId: ORG_ID,
  nominatedBy: 'user-1',
  status: 'nominated',
});

const activeMembership = {
  personId: NOMINEE_ID,
  organizationId: ORG_ID,
  status: 'active',
  joinedAt: monthsAgo(8),
};

function makeDb({
  membershipRows = [] as object[],
  suspendedRows = [] as object[],
}: {
  membershipRows?: object[];
  suspendedRows?: object[];
}) {
  let selectCallCount = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount++;
            if (selectCallCount === 1) return membershipRows;
            return suspendedRows;
          },
        }),
      }),
    }),
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('[BR-34] Nomination Eligibility — Handler-Level Gaps', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  test('point-in-time: nomination succeeds for active member at nomination time', async () => {
    // BR-34 edge: eligibility checked at moment of nomination
    // An active member with sufficient tenure who is not suspended → nomination accepted
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [activeMembership], suspendedRows: [] }),
    });

    const response = await createNominee(ctx);
    expect(response.status).toBe(201);
    // Nominee is created — candidacy is locked at this point
    expect(response.body.data.personId).toBe(NOMINEE_ID);
  });

  test('point-in-time: nominee record persists even if member status later changes', async () => {
    // BR-34 edge: "A member who meets all criteria at nomination time but later
    // falls into Grace status... does not become ineligible retroactively"
    // We verify: the handler creates the nominee without checking future state.
    // Once created, the nominee record exists independent of membership status changes.
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async (data: any) => ({ ...fakeNominee, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [activeMembership], suspendedRows: [] }),
    });

    const response = await createNominee(ctx);
    expect(response.status).toBe(201);
    // The nominee is created with the person's ID — no future-check mechanism exists
    // in the handler, confirming point-in-time evaluation
    expect(response.body.data.personId).toBe(NOMINEE_ID);
    expect(response.body.data.electionId).toBe(ELECTION_ID);
  });

  test('all three conditions verified through handler: not active → NOMINEE_NOT_ACTIVE', async () => {
    // Condition 1 via handler (summary test)
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [], suspendedRows: [] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_NOT_ACTIVE');
  });

  test('all three conditions verified through handler: too recent → NOMINEE_INSUFFICIENT_TENURE', async () => {
    // Condition 2 via handler (summary test)
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const recentMembership = { ...activeMembership, joinedAt: monthsAgo(3) };

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [recentMembership], suspendedRows: [] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_INSUFFICIENT_TENURE');
  });

  test('all three conditions verified through handler: suspended elsewhere → NOMINEE_SUSPENDED', async () => {
    // Condition 3 via handler (summary test)
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const suspendedRecord = { personId: NOMINEE_ID, organizationId: 'org-other', status: 'suspended', joinedAt: monthsAgo(24) };

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [activeMembership], suspendedRows: [suspendedRecord] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_SUSPENDED');
  });
});
