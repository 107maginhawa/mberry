/**
 * E2E-style integration test for BR-34: Nomination Eligibility
 *
 * Tests the full API flow:
 *   create election → open nominations → nominate eligible member → verify success
 *   create election → open nominations → nominate ineligible member → verify rejection
 *
 * Uses handler-level mocking (same as createNominee.test.ts) to exercise
 * the full nomination eligibility pipeline without a running server.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createNominee } from './createNominee';
import { updateElectionStatus } from './updateElectionStatus';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Constants ──────────────────────────────────────────────────────────────

const ELECTION_ID = 'e2e-election-1';
const ORG_ID = 'org-1';
const POSITION_ID = '00000000-0000-4000-8000-000000000001';
const ELIGIBLE_PERSON_ID = '00000000-0000-4000-8000-000000000010';
const INELIGIBLE_PERSON_ID = '00000000-0000-4000-8000-000000000020';
const SUSPENDED_PERSON_ID = '00000000-0000-4000-8000-000000000030';

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// ─── Shared state (simulates DB across handler calls) ───────────────────────

const electionState = {
  id: ELECTION_ID,
  organizationId: ORG_ID,
  title: 'E2E Board Election',
  status: 'draft' as string,
};

const nominees: any[] = [];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('[BR-34] Nomination Eligibility E2E Flow', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    electionState.status = 'draft';
    nominees.length = 0;
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  // ── Full lifecycle: create election → open nominations → nominate eligible member

  test('eligible member can be nominated after opening nominations', async () => {
    // Step 1: Open nominations (draft → nominationsOpen)
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...electionState }),
      update: async (_id: string, data: any) => {
        electionState.status = data.status;
        return { ...electionState };
      },
    });

    const openCtx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { status: 'nominationsOpen' },
    });

    const openRes = await updateElectionStatus(openCtx);
    expect(openRes.status).toBe(200);
    expect(openRes.body.data.status).toBe('nominationsOpen');

    // Step 2: Nominate eligible member (active, 8-month tenure, no suspension)
    const eligibleMembership = {
      personId: ELIGIBLE_PERSON_ID,
      organizationId: ORG_ID,
      status: 'active',
      joinedAt: monthsAgo(8),
    };

    const fakeNominee = {
      id: 'nominee-1',
      electionId: ELECTION_ID,
      positionId: POSITION_ID,
      personId: ELIGIBLE_PERSON_ID,
      organizationId: ORG_ID,
      nominatedBy: 'user-1',
      status: 'nominated',
    };

    let selectCallCount = 0;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...electionState }),
      addNominee: async () => fakeNominee,
    });

    const nomCtx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: ELIGIBLE_PERSON_ID },
      database: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                selectCallCount++;
                if (selectCallCount === 1) return [eligibleMembership];
                return []; // no suspensions
              },
            }),
          }),
        }),
      },
    });

    const nomRes = await createNominee(nomCtx);
    expect(nomRes.status).toBe(201);
    expect(nomRes.body.data.personId).toBe(ELIGIBLE_PERSON_ID);
    expect(nomRes.body.data.status).toBe('nominated');
  });

  // ── Ineligible: not active member → rejection

  test('non-active member is rejected with NOMINEE_NOT_ACTIVE', async () => {
    electionState.status = 'nominationsOpen';

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...electionState }),
      addNominee: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: INELIGIBLE_PERSON_ID },
      database: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => [], // no active membership
            }),
          }),
        }),
      },
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_NOT_ACTIVE');
  });

  // ── Ineligible: insufficient tenure → rejection

  test('member with < 6 months tenure is rejected with NOMINEE_INSUFFICIENT_TENURE', async () => {
    electionState.status = 'nominationsOpen';

    const recentMembership = {
      personId: INELIGIBLE_PERSON_ID,
      organizationId: ORG_ID,
      status: 'active',
      joinedAt: monthsAgo(2), // only 2 months
    };

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...electionState }),
      addNominee: async () => { throw new Error('should not reach'); },
    });

    let selectCallCount = 0;
    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: INELIGIBLE_PERSON_ID },
      database: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                selectCallCount++;
                if (selectCallCount === 1) return [recentMembership];
                return [];
              },
            }),
          }),
        }),
      },
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_INSUFFICIENT_TENURE');
    expect(err.message).toContain('6 months');
  });

  // ── Ineligible: suspended in another org → rejection

  test('member suspended in another org is rejected with NOMINEE_SUSPENDED', async () => {
    electionState.status = 'nominationsOpen';

    const activeMembership = {
      personId: SUSPENDED_PERSON_ID,
      organizationId: ORG_ID,
      status: 'active',
      joinedAt: monthsAgo(12),
    };

    const suspensionRecord = {
      personId: SUSPENDED_PERSON_ID,
      organizationId: 'org-other',
      status: 'suspended',
      joinedAt: monthsAgo(24),
    };

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...electionState }),
      addNominee: async () => { throw new Error('should not reach'); },
    });

    let selectCallCount = 0;
    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: SUSPENDED_PERSON_ID },
      database: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                selectCallCount++;
                if (selectCallCount === 1) return [activeMembership];
                return [suspensionRecord];
              },
            }),
          }),
        }),
      },
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.code).toBe('NOMINEE_SUSPENDED');
    expect(err.message).toContain('suspended');
  });

  // ── Guard: cannot nominate when nominations are not open

  test('nomination rejected when election is still in draft', async () => {
    electionState.status = 'draft';

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...electionState }),
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_ID, personId: ELIGIBLE_PERSON_ID },
    });

    const err = await createNominee(ctx).catch((e: any) => e);
    expect(err.message).toContain('Nominations are not open');
  });
});
