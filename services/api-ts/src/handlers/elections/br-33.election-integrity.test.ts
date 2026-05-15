/**
 * [BR-33] Election Integrity — Handler-Level Gap Tests
 *
 * Tests scenarios from BR-33 that are NOT already covered by castVote.test.ts
 * or updateElectionStatus.test.ts. Those files cover: double-vote prevention,
 * status transition guards, and publishedAt timestamp. This file covers the
 * remaining BR-33 rules at the handler level.
 *
 * BR-33: "An election requires a minimum of 2 candidates per position to be
 * considered valid. Officers can manually close nominations if the minimum is
 * not met. Online votes use one-time tokens issued per eligible member — double
 * voting is prevented at the token level, not merely at the UI level. Election
 * results are not displayed to any member until the election is officially closed
 * by the President."
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { castVote } from './castVote';
import { updateElectionStatus } from './updateElectionStatus';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: '2026 Board Election',
  status: 'votingOpen',
};

const fakeVote = {
  id: 'vote-1',
  electionId: 'election-1',
  positionId: '00000000-0000-4000-8000-000000000001',
  nomineeId: '00000000-0000-4000-8000-000000000002',
  voterId: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-33] Election Integrity — Handler-Level Gaps', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  // ─── Manual Close Nominations ───────────────────────────

  test('officer can close nominations via status transition (nominationsOpen → votingOpen)', async () => {
    // BR-33: "Officers can manually close nominations if the minimum is not met."
    // The updateElectionStatus handler allows nominationsOpen → votingOpen regardless of
    // candidate count — this is the "manual override" mechanism.
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      update: async (_id: string, data: any) => ({ ...fakeElection, status: 'nominationsOpen', ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('votingOpen');
  });

  // ─── Results Hidden Until Published ─────────────────────

  test('results not visible: votingOpen → awaitingConfirmation does not set publishedAt', async () => {
    // BR-33: results hidden during votingOpen and awaitingConfirmation
    let capturedData: any;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'votingOpen' }),
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'awaitingConfirmation' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(capturedData.publishedAt).toBeUndefined();
  });

  test('results become visible only at published status (publishedAt set)', async () => {
    // BR-33: "Election results are not displayed to any member until the election
    // is officially closed by the President."
    let capturedData: any;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'awaitingConfirmation' }),
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'published' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(capturedData.publishedAt).toBeInstanceOf(Date);
  });

  test('all non-published statuses do not set publishedAt (results stay hidden)', async () => {
    // BR-33: results hidden during draft, nominationsOpen, votingOpen, awaitingConfirmation
    const transitions: Array<{ from: string; to: string }> = [
      { from: 'draft', to: 'nominationsOpen' },
      { from: 'nominationsOpen', to: 'votingOpen' },
      { from: 'votingOpen', to: 'awaitingConfirmation' },
    ];

    for (const { from, to } of transitions) {
      restoreRepo(ElectionsRepository);
      let capturedData: any;
      stubRepo(ElectionsRepository, {
        get: async () => ({ ...fakeElection, status: from }),
        update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
      });

      const ctx = makeCtx({
        _params: { id: 'election-1' },
        _body: { status: to },
      });

      const response = await updateElectionStatus(ctx);
      expect(response.status).toBe(200);
      expect(capturedData.publishedAt).toBeUndefined();
    }
  });

  // ─── Double Vote Prevention (handler-level) ─────────────

  test('castVote throws ConflictError when same user votes twice for same position', async () => {
    // BR-33: "double voting is prevented at the token level, not merely at the UI level"
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => true,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Already voted for this position');
  });

  // ─── Not Yet Implemented (tracked for future phases) ────

  test.todo('[BR-33] minimum 2 candidates per position validation before voting opens');
  test.todo('[BR-33] ineligible candidate after nominations close triggers admin notification');
  test.todo('[BR-33] votes for removed candidate are voided');
});
