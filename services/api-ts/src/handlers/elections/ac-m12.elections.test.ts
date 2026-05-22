/**
 * AC-M12: Elections Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M12-001: One Vote Per Position — duplicate vote rejected
 *   AC-M12-002: Voting Eligibility — Grace/Lapsed/Suspended cannot vote
 *   AC-M12-003: Result Immutability — certified election blocks modifications
 *   AC-M12-004: State Machine Enforcement — draft cannot skip to votingOpen
 *   AC-M12-005: Minimum Candidates Guard — 0 candidates blocks opening voting
 *   AC-M12-006: Cancellation Cascade — cancelled election voids all votes
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type MemberStatus = 'active' | 'grace' | 'lapsed' | 'suspended' | 'inactive';

type ElectionState =
  | 'draft'
  | 'nominations'
  | 'votingOpen'
  | 'votingClosed'
  | 'certified'
  | 'cancelled';

interface Vote {
  electionId: string;
  positionId: string;
  voterId: string;
  candidateId: string;
  castAt: Date;
  voided: boolean;
}

interface Candidate {
  id: string;
  positionId: string;
  personId: string;
}

interface Position {
  id: string;
  electionId: string;
  title: string;
  candidates: Candidate[];
}

interface Election {
  id: string;
  state: ElectionState;
  positions: Position[];
  votes: Vote[];
  cancelledAt: Date | null;
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M12-001: Detect duplicate vote for the same position by the same voter.
 */
function hasAlreadyVotedForPosition(
  votes: Vote[],
  voterId: string,
  positionId: string,
): boolean {
  return votes.some(
    (v) => v.voterId === voterId && v.positionId === positionId && !v.voided,
  );
}

function castVote(
  election: Election,
  voterId: string,
  positionId: string,
  candidateId: string,
  now: Date,
): { ok: true; vote: Vote } | { ok: false; error: string } {
  if (hasAlreadyVotedForPosition(election.votes, voterId, positionId)) {
    return { ok: false, error: 'Already voted for this position.' };
  }
  const vote: Vote = {
    electionId: election.id,
    positionId,
    voterId,
    candidateId,
    castAt: now,
    voided: false,
  };
  return { ok: true, vote };
}

/**
 * AC-M12-002: Check whether a member status allows voting.
 */
function canMemberVote(status: MemberStatus): boolean {
  return status === 'active';
}

function assertVotingEligibility(
  status: MemberStatus,
): { ok: true } | { ok: false; error: string } {
  if (!canMemberVote(status)) {
    return {
      ok: false,
      error: `Member status "${status}" is not eligible to vote.`,
    };
  }
  return { ok: true };
}

/**
 * AC-M12-003: Certified elections are immutable — any modification rejected.
 */
function assertElectionMutable(
  election: Election,
): { ok: true } | { ok: false; error: string } {
  if (election.state === 'certified') {
    return { ok: false, error: 'Election results are certified and immutable.' };
  }
  if (election.state === 'cancelled') {
    return { ok: false, error: 'Cancelled elections cannot be modified.' };
  }
  return { ok: true };
}

/**
 * AC-M12-004: Enforce state machine — only valid transitions allowed.
 */
const VALID_TRANSITIONS: Record<ElectionState, ElectionState[]> = {
  draft: ['nominations'],
  nominations: ['votingOpen'],
  votingOpen: ['votingClosed', 'cancelled'],
  votingClosed: ['certified', 'cancelled'],
  certified: [],
  cancelled: [],
};

function transitionElection(
  election: Election,
  targetState: ElectionState,
): { ok: true; newState: ElectionState } | { ok: false; error: string } {
  const allowed = VALID_TRANSITIONS[election.state];
  if (!allowed.includes(targetState)) {
    return {
      ok: false,
      error: `Cannot transition from "${election.state}" to "${targetState}". Valid next states: ${allowed.join(', ') || 'none'}.`,
    };
  }
  return { ok: true, newState: targetState };
}

/**
 * AC-M12-005: All positions must have at least 1 candidate before opening voting.
 */
function assertMinimumCandidates(
  positions: Position[],
): { ok: true } | { ok: false; error: string; positionId: string } {
  for (const pos of positions) {
    if (pos.candidates.length === 0) {
      return {
        ok: false,
        error: `Position "${pos.title}" has no candidates. Cannot open voting.`,
        positionId: pos.id,
      };
    }
  }
  return { ok: true };
}

/**
 * AC-M12-006: Cancellation voids all non-voided votes and records cancelled timestamp.
 */
interface CancellationResult {
  cancelledAt: Date;
  voidedVotes: Vote[];
  voterIds: string[];
}

function cancelElection(election: Election, now: Date): CancellationResult {
  const voidedVotes = election.votes
    .filter((v) => !v.voided)
    .map((v) => ({ ...v, voided: true }));

  const voterIds = [...new Set(voidedVotes.map((v) => v.voterId))];

  return { cancelledAt: now, voidedVotes, voterIds };
}

// ─── Helpers ──────────────────────────────────────────────

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-1',
    electionId: 'election-1',
    title: 'President',
    candidates: [{ id: 'cand-1', positionId: 'pos-1', personId: 'person-1' }],
    ...overrides,
  };
}

function makeElection(
  state: ElectionState = 'votingOpen',
  overrides: Partial<Election> = {},
): Election {
  return {
    id: 'election-1',
    state,
    positions: [makePosition()],
    votes: [],
    cancelledAt: null,
    ...overrides,
  };
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
  return {
    electionId: 'election-1',
    positionId: 'pos-1',
    voterId: 'voter-1',
    candidateId: 'cand-1',
    castAt: new Date(),
    voided: false,
    ...overrides,
  };
}

// ─── AC-M12-001: One Vote Per Position ────────────────────

describe('[AC-M12-001] One Vote Per Position', () => {
  test('rejects duplicate vote for same position', () => {
    // Given: member already voted for position pos-1
    const election = makeElection('votingOpen', {
      votes: [makeVote({ voterId: 'voter-1', positionId: 'pos-1' })],
    });
    // When: voting again for the same position
    const result = castVote(election, 'voter-1', 'pos-1', 'cand-2', new Date());
    // Then: rejected
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Already voted');
    }
  });

  test('allows voting for a different position', () => {
    // Given: member voted for pos-1 but not pos-2
    const election = makeElection('votingOpen', {
      votes: [makeVote({ voterId: 'voter-1', positionId: 'pos-1' })],
    });
    // When: voting for pos-2
    const result = castVote(election, 'voter-1', 'pos-2', 'cand-3', new Date());
    // Then: allowed
    expect(result.ok).toBe(true);
  });

  test('voided prior vote does not count as existing vote', () => {
    // Given: prior vote for pos-1 is voided (election cancelled and re-run)
    const election = makeElection('votingOpen', {
      votes: [makeVote({ voterId: 'voter-1', positionId: 'pos-1', voided: true })],
    });
    // When: voting again for pos-1
    const result = castVote(election, 'voter-1', 'pos-1', 'cand-1', new Date());
    // Then: allowed (voided vote doesn't count)
    expect(result.ok).toBe(true);
  });

  test('different voter for same position is allowed', () => {
    // Given: voter-1 voted for pos-1
    const election = makeElection('votingOpen', {
      votes: [makeVote({ voterId: 'voter-1', positionId: 'pos-1' })],
    });
    // When: voter-2 votes for same position
    const result = castVote(election, 'voter-2', 'pos-1', 'cand-1', new Date());
    // Then: allowed (different voter)
    expect(result.ok).toBe(true);
  });
});

// ─── AC-M12-002: Voting Eligibility ──────────────────────

describe('[AC-M12-002] Voting Eligibility', () => {
  test('active member can vote', () => {
    const result = assertVotingEligibility('active');
    expect(result.ok).toBe(true);
  });

  test('grace member cannot vote', () => {
    const result = assertVotingEligibility('grace');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('grace');
    }
  });

  test('lapsed member cannot vote', () => {
    const result = assertVotingEligibility('lapsed');
    expect(result.ok).toBe(false);
  });

  test('suspended member cannot vote', () => {
    const result = assertVotingEligibility('suspended');
    expect(result.ok).toBe(false);
  });
});

// ─── AC-M12-003: Result Immutability ─────────────────────

describe('[AC-M12-003] Result Immutability — certified election', () => {
  test('certified election blocks any modification', () => {
    const election = makeElection('certified');
    const result = assertElectionMutable(election);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('certified');
    }
  });

  test('cancelled election also blocks modification', () => {
    const election = makeElection('cancelled');
    const result = assertElectionMutable(election);
    expect(result.ok).toBe(false);
  });

  test('open election allows modification', () => {
    const election = makeElection('votingOpen');
    const result = assertElectionMutable(election);
    expect(result.ok).toBe(true);
  });

  test('draft election allows modification', () => {
    const election = makeElection('draft');
    const result = assertElectionMutable(election);
    expect(result.ok).toBe(true);
  });
});

// ─── AC-M12-004: State Machine Enforcement ────────────────

describe('[AC-M12-004] State Machine Enforcement', () => {
  test('draft cannot transition directly to votingOpen', () => {
    const election = makeElection('draft');
    const result = transitionElection(election, 'votingOpen');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('draft');
    }
  });

  test('draft can transition to nominations', () => {
    const election = makeElection('draft');
    const result = transitionElection(election, 'nominations');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newState).toBe('nominations');
    }
  });

  test('nominations can transition to votingOpen', () => {
    const election = makeElection('nominations');
    const result = transitionElection(election, 'votingOpen');
    expect(result.ok).toBe(true);
  });

  test('certified election has no valid transitions', () => {
    const election = makeElection('certified');
    const toNominations = transitionElection(election, 'nominations');
    const toVoting = transitionElection(election, 'votingOpen');
    expect(toNominations.ok).toBe(false);
    expect(toVoting.ok).toBe(false);
  });

  test('votingOpen can be cancelled', () => {
    const election = makeElection('votingOpen');
    const result = transitionElection(election, 'cancelled');
    expect(result.ok).toBe(true);
  });
});

// ─── AC-M12-005: Minimum Candidates Guard ─────────────────

describe('[AC-M12-005] Minimum Candidates Guard', () => {
  test('position with 0 candidates blocks opening voting', () => {
    const positions: Position[] = [
      makePosition({ id: 'pos-1', title: 'President', candidates: [] }),
    ];
    const result = assertMinimumCandidates(positions);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('no candidates');
      expect(result.positionId).toBe('pos-1');
    }
  });

  test('all positions with at least 1 candidate allows opening voting', () => {
    const positions: Position[] = [
      makePosition({ id: 'pos-1', title: 'President', candidates: [{ id: 'c1', positionId: 'pos-1', personId: 'p1' }] }),
      makePosition({ id: 'pos-2', title: 'Secretary', candidates: [{ id: 'c2', positionId: 'pos-2', personId: 'p2' }] }),
    ];
    const result = assertMinimumCandidates(positions);
    expect(result.ok).toBe(true);
  });

  test('second position empty still fails even if first has candidates', () => {
    const positions: Position[] = [
      makePosition({ id: 'pos-1', title: 'President', candidates: [{ id: 'c1', positionId: 'pos-1', personId: 'p1' }] }),
      makePosition({ id: 'pos-2', title: 'Treasurer', candidates: [] }),
    ];
    const result = assertMinimumCandidates(positions);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.positionId).toBe('pos-2');
    }
  });
});

// ─── AC-M12-006: Cancellation Cascade ────────────────────

describe('[AC-M12-006] Cancellation Cascade', () => {
  test('all active votes are voided on cancellation', () => {
    const now = new Date();
    const election = makeElection('votingOpen', {
      votes: [
        makeVote({ voterId: 'voter-1', positionId: 'pos-1' }),
        makeVote({ voterId: 'voter-2', positionId: 'pos-1' }),
        makeVote({ voterId: 'voter-3', positionId: 'pos-2' }),
      ],
    });
    // When: election cancelled
    const result = cancelElection(election, now);
    // Then: all 3 votes voided
    expect(result.voidedVotes).toHaveLength(3);
    expect(result.voidedVotes.every((v) => v.voided)).toBe(true);
  });

  test('50 votes all voided on cancellation', () => {
    const votes: Vote[] = Array.from({ length: 50 }, (_, i) =>
      makeVote({ voterId: `voter-${i}`, positionId: 'pos-1' }),
    );
    const election = makeElection('votingOpen', { votes });
    const result = cancelElection(election, new Date());
    expect(result.voidedVotes).toHaveLength(50);
    expect(result.voterIds).toHaveLength(50);
  });

  test('unique voter IDs collected for notification', () => {
    // Given: 3 votes but voter-1 voted for two different positions
    const election = makeElection('votingOpen', {
      votes: [
        makeVote({ voterId: 'voter-1', positionId: 'pos-1' }),
        makeVote({ voterId: 'voter-1', positionId: 'pos-2' }),
        makeVote({ voterId: 'voter-2', positionId: 'pos-1' }),
      ],
    });
    const result = cancelElection(election, new Date());
    // Then: voterIds are unique (voter-1 appears once)
    expect(result.voterIds).toHaveLength(2);
    expect(result.voterIds).toContain('voter-1');
    expect(result.voterIds).toContain('voter-2');
  });

  test('already voided votes are not re-voided', () => {
    // Given: one already-voided vote, one active vote
    const election = makeElection('votingOpen', {
      votes: [
        makeVote({ voterId: 'voter-1', voided: true }),
        makeVote({ voterId: 'voter-2', voided: false }),
      ],
    });
    const result = cancelElection(election, new Date());
    // Then: only the non-voided vote counted as newly voided
    expect(result.voidedVotes).toHaveLength(1);
    expect(result.voidedVotes[0].voterId).toBe('voter-2');
  });

  test('cancellation timestamp recorded', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const election = makeElection('votingOpen', { votes: [makeVote()] });
    const result = cancelElection(election, now);
    expect(result.cancelledAt).toEqual(now);
  });
});
