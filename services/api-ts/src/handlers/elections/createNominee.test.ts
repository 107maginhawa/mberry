/**
 * Tests for createNominee handler — BR-34 nomination eligibility enforcement
 *
 * Covers:
 * - Happy path: eligible nominee → 201
 * - BR-34 Condition 1: not an active member → NOMINEE_NOT_ACTIVE
 * - BR-34 Condition 2: less than 6 months tenure → NOMINEE_INSUFFICIENT_TENURE
 * - BR-34 Condition 3: suspended in another org → NOMINEE_SUSPENDED
 * - Election state guards (not found, nominations not open)
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createNominee } from './createNominee';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOMINEE_ID = '00000000-0000-4000-8000-000000000099';
const POSITION_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID = 'org-1';
const ELECTION_ID = 'election-1';

/** Returns a Date that is `months` months in the past from today */
function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

const fakeElection = {
  id: ELECTION_ID,
  organizationId: ORG_ID,
  title: '2026 Board Election',
  status: 'nominationsOpen',
};

const fakeNominee = {
  id: 'nominee-1',
  electionId: ELECTION_ID,
  positionId: POSITION_ID,
  personId: NOMINEE_ID,
  organizationId: ORG_ID,
  nominatedBy: 'user-1',
  status: 'nominated',
};

/** Active membership joined 8 months ago (qualifies) */
const activeMembership = {
  personId: NOMINEE_ID,
  organizationId: ORG_ID,
  status: 'active',
  joinedAt: monthsAgo(8),
};

/** Active membership joined only 3 months ago (fails tenure) */
const recentMembership = {
  personId: NOMINEE_ID,
  organizationId: ORG_ID,
  status: 'active',
  joinedAt: monthsAgo(3),
};

/** Suspended record in another org */
const suspendedRecord = {
  personId: NOMINEE_ID,
  organizationId: 'org-other',
  status: 'suspended',
  joinedAt: monthsAgo(24),
};

// ─── Helper: build a mock db that returns specific rows ─────────────────────

function makeDb({
  membershipRows = [] as object[],
  suspendedRows = [] as object[],
}: {
  membershipRows?: object[];
  suspendedRows?: object[];
}) {
  // Track which .where() call we're on (first = active check, second = suspended check)
  let selectCallCount = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount++;
            // First .limit() call = active membership query
            if (selectCallCount === 1) return membershipRows;
            // Second .limit() call = suspended check
            return suspendedRows;
          },
        }),
      }),
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('[BR-34] createNominee — nomination eligibility', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  test('creates nominee when all BR-34 conditions are met', async () => {
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
    expect(response.body.data.personId).toBe(NOMINEE_ID);
  });

  // ── BR-34 Condition 1: active membership ────────────────────────────────

  test('[BR-34] throws NOMINEE_NOT_ACTIVE when member is not active in the org', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      // No active membership row → first select returns []
      database: makeDb({ membershipRows: [], suspendedRows: [] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_NOT_ACTIVE');
    expect(err.message).toContain('active member');
  });

  test('[BR-34] throws NOMINEE_NOT_ACTIVE when member has grace status (not active)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    // grace-status member won't match status='active' → row not returned
    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [], suspendedRows: [] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_NOT_ACTIVE');
  });

  // ── BR-34 Condition 2: minimum tenure ───────────────────────────────────

  test('[BR-34] throws NOMINEE_INSUFFICIENT_TENURE when member joined < 6 months ago', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [recentMembership], suspendedRows: [] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_INSUFFICIENT_TENURE');
    expect(err.message).toContain('6 months');
  });

  test('[BR-34] passes tenure check when member joined exactly 6 months ago', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });

    const sixMonthsAgoMembership = {
      ...activeMembership,
      joinedAt: monthsAgo(6),
    };

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [sixMonthsAgoMembership], suspendedRows: [] }),
    });

    const response = await createNominee(ctx);
    expect(response.status).toBe(201);
  });

  // ── BR-34 Condition 3: no suspension in any org ─────────────────────────

  test('[BR-34] throws NOMINEE_SUSPENDED when member is suspended in another org', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      // Active in target org, but suspended record exists in another org
      database: makeDb({ membershipRows: [activeMembership], suspendedRows: [suspendedRecord] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_SUSPENDED');
    expect(err.message).toContain('suspended');
  });

  test('[BR-34] active member in target org suspended in different org → NOMINEE_SUSPENDED', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const anotherOrgSuspension = { personId: NOMINEE_ID, organizationId: 'org-99', status: 'suspended', joinedAt: monthsAgo(12) };

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
      database: makeDb({ membershipRows: [activeMembership], suspendedRows: [anotherOrgSuspension] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_SUSPENDED');
  });

  // ── Election state guards ────────────────────────────────────────────────

  test('throws NotFoundError when election does not exist', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-election' },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('throws ConflictError when nominations are not open', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'votingOpen' }),
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID },
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.message).toContain('Nominations are not open');
  });

  // ── Configurable minimum tenure ─────────────────────────────────────────

  test('respects custom minMembershipMonths override', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => { throw new Error('should not reach'); },
    });

    // Member has 8 months — enough for default 6 but not for required 12
    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: NOMINEE_ID, minMembershipMonths: 12 },
      database: makeDb({ membershipRows: [activeMembership], suspendedRows: [] }),
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_INSUFFICIENT_TENURE');
    expect(err.message).toContain('12 months');
  });
});
