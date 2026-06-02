# Module Specification: Elections & Governance (M12)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Manage elections and governance processes for healthcare associations — officer elections, bylaw ratification, nominations, secret ballot voting, and result publication. Integrates with M04 (Org Admin) for officer role assignment after election results are published.

### Users
- **Member** — views elections, nominates candidates, casts votes, views results
- **Officer (President)** — creates elections, manages lifecycle, publishes results
- **Officer (Secretary)** — assists with election administration
- **Platform Administrator** — oversight and support

### Related Modules
- **M04 (Org Admin)** — downstream: election winners auto-assigned officer roles via officer transition
- **M05 (Membership)** — upstream: active membership required for voting eligibility
- **M07 (Communications)** — downstream: election announcements and voting notifications
- **M02 (Member Profile)** — person data for nominee/voter identity

### In Scope
- Election creation (officer elections + bylaw ratification)
- Nomination management (open/close, self-nominate, accept/decline)
- Voting (online, in-person, hybrid), ballot integrity (one vote per member per position)
- Results computation and publication, officer term management
- Election state machine (draft → nominations → voting → confirmation → published)
- Secret ballot (votes not traceable to individual voters after cast)

### Out of Scope
- Officer role management (M04)
- Membership status management (M05)
- Committee elections (M19 — Committee Management)
- Board meeting minutes or governance documentation (future module)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|------------|
| **Election** | A formal voting process. Two types: officer (elect people to positions) and bylaw (vote on rule changes). |
| **Nomination** | A candidate's entry into an election for a specific position. Can be self-nominated or nominated by another member. |
| **Ballot** | The act of voting. Secret ballot means votes cannot be traced to individual voters after submission. |
| **Position** | A governance role within an org (e.g., President, Treasurer, Secretary). Defined in M04. |
| **Officer** | A member assigned an administrative role within an organization. |
| **Active** | Membership status: dues are current, full access. Required for voting eligibility. |
| **Bylaw Ratification** | A vote on proposed changes to organizational rules or bylaws. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-076: Create & Run Election | President/Officer | Full lifecycle: draft → nominations → voting → results | P0 |
| WF-077: Member Votes | Member | Cast secret ballot, one vote per position | P0 |
| WF-078: Bylaw Ratification | Officer/Member | Propose and vote on bylaw changes | P1 |
| WF-079: Election-to-Officer Transition | System | Winners auto-assigned officer roles (touches M04) | P1 |

## 4. Workflow Details

### Workflow: Create & Run Election (WF-076)

**Actor:** President or authorized officer
**Preconditions:** Authenticated, President or authorized officer role, org exists
**Steps:**
1. Creates election: type (officer/bylaw), positions to elect, nomination dates, voting dates, voting mode (online/inPerson/hybrid).
2. Transitions election to `nominationsOpen`. Members can self-nominate or be nominated.
3. Nominees accept or decline nominations.
4. Officer transitions to `votingOpen` (nominations close). Guard: at least 2 candidates per position. BR-33 guard fires at this transition (nominationsOpen → votingOpen), not at voting close. Positions with <2 candidates are flagged; officer must re-open nominations or remove position before proceeding.
5. Active members cast votes (one per position). Secret ballot.
6. Voting period ends. Election transitions to `awaitingConfirmation`. Results computed.
7. President reviews results and transitions to `published`.
8. Results published to all members.
9. Officer terms updated based on results (triggers M04 officer transition via ElectionPublished event).
**Alternate Flows:** President cancels election at any non-terminal state — all votes voided, members notified.
**Exception Flows:** Fewer than 2 candidates for a position when voting closes — `BusinessLogicError('INSUFFICIENT_CANDIDATES')`.
**Postconditions:** Election in published or cancelled state. If published, officer transitions triggered.

### Workflow: Member Votes (WF-077)

**Actor:** Active member
**Preconditions:** Authenticated, active membership in org, election in `votingOpen` state
**Steps:**
1. Receives voting notification (via M07).
2. Opens election detail (`/org/[id]/elections/[id]/vote`).
3. Views candidates per position with their nominee details.
4. Casts vote (one per position). Secret ballot — vote record stores voterId for uniqueness enforcement but results display only aggregated counts.
5. Confirmation: "Your vote has been recorded."
**Alternate Flows:** Member tries to vote twice for same position — blocked by unique constraint.
**Exception Flows:** Non-active member attempts to vote — 403 Forbidden. Election not in votingOpen — 400 Bad Request.
**Postconditions:** ElectionVote record created. Cannot be changed after submission.

### Workflow: Bylaw Ratification (WF-078)

**Actor:** Officer (proposes), Member (votes)
**Preconditions:** Authenticated, officer role for proposal, active member for voting
**Steps:**
1. Officer creates election with type=bylaw.
2. Defines the bylaw change proposal (text description).
3. Opens voting (no nomination phase for bylaws).
4. Members vote yes/no on the proposal.
5. Results published with pass/fail based on threshold (e.g., majority or supermajority). [VERIFY: threshold configurable?]
**Postconditions:** Bylaw vote results published. No automatic officer transition.

### Workflow: Election-to-Officer Transition (WF-079)

**Actor:** System (automated)
**Preconditions:** Election status = published, winners determined
**Steps:**
1. ElectionPublished event emitted with winnerId, positionId, orgId per position.
2. M04 (Org Admin) consumes event and assigns officer roles.
3. Notification sent to new officers.
4. M05 permissions updated for new role.
**Postconditions:** Winner assigned officer role. Previous officer's term ended.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-33 | IF voter THEN must be Active member of org | Voting eligibility | Grace/Lapsed/Suspended excluded |
| BR-34 | IF nominee THEN must be Active member with minimum tenure | Nomination eligibility | Per-org configurable |
| BR-67 | IF vote cast THEN one per voter per position per election | Ballot integrity (M12-R1 canonical ID) | Unique constraint on (electionId, positionId, voterId); ConflictError on duplicate. Renamed from BR-42 per TR-P1-004 (BR-42 ID overload split — canonical BR-42 = M09 training-type per WORKFLOW_MAP §4). Skipped BR-52..BR-66 (reserved for m20-booking/m21-billing/m22-email spec-ID blocks). Coverage: `handlers/elections/castVote.test.ts`, `specs/api/tests/contract/elections-flow.hurl`, `tests/e2e/officer/election-integrity.spec.ts`. |
| M12-R1 | (aliased to BR-67 above) IF vote cast THEN one per voter per position per election | Ballot integrity | Module-local alias of BR-67. Retained for backward-reference; new code/tests should anchor on BR-67. |
| M12-R2 | IF results published THEN immutable, cannot be changed | Result finality | No role can modify published results |
| M12-R3 | IF election cancelled THEN all votes voided, members notified | Cancellation | Clean rollback, ElectionCancelled event |
| M12-R4 | IF nominations close THEN no new nominees accepted | Nomination window | Strict cutoff enforced by state machine |
| M12-R5 | IF voting mode = hybrid THEN both online and in-person votes counted | Voting | Unified tally |
| M12-R6 | IF voting closes with < 2 candidates for a position THEN block transition | Minimum candidates | BusinessLogicError('INSUFFICIENT_CANDIDATES') |
| BR-44 | IF election certified THEN end outgoing officer terms, create new terms for winners, generate transition checklists, propagate role permissions in M04/M05 | Election certification cross-module effects | Wave 4 discovery. Coverage: `handlers/elections/certifyElection.test.ts`, `tests/e2e/officer/election-integrity.spec.ts`. Annotation: contract test gap — backend unit + E2E primary |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View elections | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member | user | GA auth |
| Cast vote | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member | user | GA auth; must be Active member (BR-33) |
| Nominate | super, admin, president, VP, secretary, treasurer, board-member, officer, staff, member | user, support | GA auth |
| Create election | super, admin, president (2FA) | All others | GA+HG auth |
| Delete election | super, admin, president (2FA), VP, secretary (2FA), treasurer (2FA), board-member, officer | member, user, staff, support | GA+HG auth |

## 7. Data Requirements

### Entity: Election

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| organizationId | Yes | Org FK | References organization |
| type | Yes | Election type | Enum: officer, bylaw |
| status | Yes | Current state | Enum: draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled |
| title | Yes | Election title | Non-empty string |
| description | No | Details/context | Text |
| votingMode | Yes | How votes are cast | Enum: online, inPerson, hybrid |
| nominationsOpenAt | Yes | Start nominations | Timestamp |
| nominationsCloseAt | Yes | End nominations | > nominationsOpenAt |
| votingOpenAt | Yes | Start voting | >= nominationsCloseAt |
| votingCloseAt | Yes | End voting | > votingOpenAt |
| createdBy | Yes | Officer who created | References person |
| createdAt | Yes | Timestamp | Auto-generated |
| updatedAt | Yes | Last modified | Auto-updated |

### Entity: ElectionNominee

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| electionId | Yes | Election FK | References election (cascade delete) |
| positionId | Yes | Position FK | References position |
| personId | Yes | Nominee FK | References person |
| nominatedBy | Yes | Who nominated | References person (self or other) |
| status | Yes | Nominee status | Enum: nominated, accepted, declined, withdrawn |
| createdAt | Yes | Timestamp | Auto-generated |

### Entity: ElectionVote

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| electionId | Yes | Election FK | References election (cascade delete) |
| positionId | Yes | Position FK | References position |
| nomineeId | Yes | Chosen nominee FK | References election_nominee |
| voterId | Yes | Who voted | References person; used for uniqueness only |
| createdAt | Yes | Timestamp | Auto-generated |

**Unique constraint:** (electionId, positionId, voterId) — enforces one vote per voter per position.

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Election | ElectionNominee, ElectionVote | — | One vote per voter per position. nominationsCloseAt < votingOpenAt < votingCloseAt. Status transitions follow state machine. |

## 8. State Transitions

### Election Status

**Entity:** `election`
**Enum:** `election_status`
**Source:** `elections/updateElectionStatus.ts`

```
draft ──► nominationsOpen ──► votingOpen ──► awaitingConfirmation ──► published (terminal)
  │              │                 │                   │
  └──► cancelled └──► cancelled    └──► cancelled      └──► cancelled (terminal)
```

| From | Allowed Targets | Guard |
|------|----------------|-------|
| `draft` | `nominationsOpen`, `cancelled` | None |
| `nominationsOpen` | `votingOpen`, `cancelled` | None |
| `votingOpen` | `awaitingConfirmation`, `cancelled` | BR-33: Minimum 2 candidates per position |
| `awaitingConfirmation` | `published`, `cancelled` | None |
| `published` | _(none — terminal)_ | — |
| `cancelled` | _(none — terminal)_ | — |

**Errors:**
- `BusinessLogicError('INVALID_ELECTION_TRANSITION')` on disallowed transition
- `BusinessLogicError('INSUFFICIENT_CANDIDATES')` when minimum candidates guard fails

### Nominee Status

```
nominated ──► accepted
    │              │
    └──► declined  └──► withdrawn
```

| From | Allowed Targets | Guard |
|------|----------------|-------|
| nominated | accepted, declined | Nominee action only |
| accepted | withdrawn | Nominee action, before votingOpen |
| declined | _(none — terminal)_ | — |
| withdrawn | _(none — terminal)_ | — |

## 9. UI/UX Requirements

### Screen: Elections List (/org/[id]/elections)

**Purpose:** View all elections for an organization
**Users:** Member, Officer
**Components:** Election list (title, type, status, dates), "Create Election" button (officers only), status badges
**States:**
- Loading: Skeleton list
- Empty: "No elections yet."
- Success: Election list sorted by date
- PermissionError: "You must be a member to view elections."
- UnexpectedError: "Unable to load elections."

### Screen: Election Detail (/org/[id]/elections/[id])

**Purpose:** View election details, nominees, and (if applicable) results
**Users:** Member, Officer
**Components:** Election header (title, type, status, dates), nominee list per position, voting section (if votingOpen), results section (if published), admin controls (officers)
**States:**
- Loading: Skeleton
- Success (nominations): Nominee list with accept/decline for own nominations
- Success (voting): Ballot form with one selection per position
- Success (results): Vote counts per nominee per position, winners highlighted
- PermissionError: Varies by action

### Screen: Vote Ballot (/org/[id]/elections/[id]/vote)

**Purpose:** Cast votes in an active election
**Users:** Active member
**Components:** Position-by-position ballot (radio buttons per nominee), submit button, confirmation dialog
**States:**
- Loading: Skeleton ballot
- Success: Ballot form ready
- Success (already voted): "You have already cast your vote in this election."
- ValidationError: "Please select a candidate for each position."
- PermissionError: "Only active members can vote." (BR-33)
- UnexpectedError: "Unable to submit your vote. Please try again."

### Screen: Election Results (/org/[id]/elections/[id]/results)

**Purpose:** View published election results
**Users:** All org members
**Components:** Results table (position, nominee, vote count, winner badge), total voter turnout
**States:**
- Loading: Skeleton
- Success: Results table with winner highlighted
- NotPublished: "Results will be published after the voting period ends."
- UnexpectedError: "Unable to load results."

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /orgs/{id}/elections | List elections | orgId, filters | Election[] | 401, 403 |
| POST /orgs/{id}/elections | Create election | type, title, dates, positions, votingMode | Election | 400, 401, 403 |
| GET /orgs/{id}/elections/{id} | Election detail | electionId | Election + nominees + results | 401, 403, 404 |
| PATCH /orgs/{id}/elections/{id}/status | Transition status | newStatus | Election | 400, 401, 403 |
| POST /orgs/{id}/elections/{id}/nominate | Nominate candidate | positionId, personId | ElectionNominee | 400, 401, 403 |
| PATCH /orgs/{id}/elections/{id}/nominees/{id} | Accept/decline/withdraw | status | ElectionNominee | 400, 401, 403 |
| POST /orgs/{id}/elections/{id}/vote | Cast vote | votes: [{positionId, nomineeId}] | Confirmation | 400, 401, 403 |
| DELETE /orgs/{id}/elections/{id} | Delete election | electionId | — | 401, 403, 404 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| ElectionOpened | Nominations or voting opened | electionId, orgId, status | M07 (announcements) |
| ElectionPublished | Results published | electionId, orgId, winners: [{positionId, winnerId}] | M04 (officer transitions) |
| ElectionCancelled | Election cancelled at any stage | electionId, orgId | M07 (notification) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 (Membership) | Update voter eligibility | Recalculate eligible voters for active elections |

## 11. Acceptance Criteria

### AC-M12-001: One Vote Per Position
**Given** a member has already voted for Position P1 in Election E1
**When** the member attempts to vote again for Position P1
**Then** the vote is rejected with a 409 Conflict error.

### AC-M12-002: Voting Eligibility
**Given** a member's status is Grace, Lapsed, or Suspended
**When** the member attempts to cast a vote
**Then** the vote is rejected with 403 Forbidden and message "Only active members can vote."

### AC-M12-003: Result Immutability
**Given** an election's results have been published
**When** any user (including super admin) attempts to modify results
**Then** the modification is rejected. Published results cannot be changed.

### AC-M12-004: State Machine Enforcement
**Given** an election in `draft` status
**When** an officer attempts to transition directly to `votingOpen`
**Then** the transition is rejected with `INVALID_ELECTION_TRANSITION` error.

### AC-M12-005: Minimum Candidates Guard
**Given** a position has fewer than 2 accepted nominees
**When** an officer attempts to close voting
**Then** the transition is rejected with `INSUFFICIENT_CANDIDATES` error.

### AC-M12-006: Cancellation Cascade
**Given** an election in `votingOpen` with 50 votes cast
**When** the president cancels the election
**Then** all votes are voided, election status = cancelled, ElectionCancelled event emitted, and members notified.

## 12. Test Expectations

Required test categories:
- **Unit:** State machine transitions (valid + invalid), vote uniqueness constraint, date validation (nominationsCloseAt < votingOpenAt < votingCloseAt), result computation
- **Integration:** Full election lifecycle (draft → published), cancellation cascade, officer transition event emission, voting eligibility check against membership status
- **Contract:** POST /elections validation, PATCH /status invalid transitions, POST /vote duplicate rejection
- **E2E:** Officer creates election, members nominate and vote, results published, officer roles updated

## 13. Edge Cases

- Election with only 1 candidate per position — cannot transition to awaitingConfirmation (BR-33 guard)
- Member's status changes to Lapsed mid-voting — already-cast votes remain, but member cannot cast additional votes
- All nominees decline for a position — officer can cancel the position in that election OR re-open nominations for that position. Does not auto-cancel the entire election.
- Tie between candidates — runoff election for tied candidates only. Officer triggers runoff manually. Original votes for non-tied candidates stand.
- Large election (1000+ voters) — result computation performance
- Voting mode = hybrid — officer manually enters in-person votes with witness attestation (second officer confirms entry). Each in-person vote recorded with witnessPersonId.
- Election dates in the past when creating — validation should prevent
- Nominee withdraws after voting starts — votes already cast for withdrawn candidate remain counted. Candidate marked as `withdrawn`. If withdrawn candidate wins by vote count, position goes to runner-up.

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin) — position definitions, officer role assignment on ElectionPublished
- M05 (Membership) — active membership check for voting eligibility
- M07 (Communications) — election announcements and voting notifications
- M02 (Member Profile) — nominee/voter identity

### External Dependencies
- None (no external services required)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|----------------|-------------------|---------------------|
| Invalid state transition | 400 Bad Request | "Cannot transition election from {current} to {target}." |
| Insufficient candidates | 400 Bad Request | "Each position must have at least 2 candidates before voting can begin." |
| Duplicate vote | 409 Conflict | "You have already voted for this position." |
| Non-active voter | 403 Forbidden | "Only active members can vote in elections." |
| Election not found | 404 Not Found | "Election not found." |
| Voting period closed | 400 Bad Request | "The voting period for this election has ended." |
| Nominations closed | 400 Bad Request | "The nomination period for this election has ended." |

## 16. Performance Expectations

- **Data volume:** ~5 elections per org per year, ~20 nominees per election, ~500 votes per election
- **Concurrent users:** Up to 200 voters casting simultaneously during deadline rush
- **Response times:** Vote submission <200ms, result computation <500ms for 1000-voter election
- **Caching:** Election list cacheable; vote counts cached and invalidated on new vote

## 17. Observability Hooks

**Log Events:**

| Event | Level | Fields |
|-------|-------|--------|
| election.created | info | electionId, orgId, type, createdBy |
| election.status.changed | info | electionId, from, to, changedBy |
| election.vote.cast | info | electionId, voterId (hashed for privacy) |
| election.vote.duplicate | warn | electionId, positionId, voterId |
| election.results.published | info | electionId, orgId, winnerCount |
| election.cancelled | info | electionId, orgId, cancelledBy, votesVoided |

**Metrics:**

| Metric | Type | Labels |
|--------|------|--------|
| elections_created_total | counter | type (officer/bylaw), orgId |
| votes_cast_total | counter | electionId, orgId |
| election_turnout_ratio | gauge | electionId |
| election_status_transitions_total | counter | from, to |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|-------------|
| elections_enabled | per-org | true | Enable/disable elections per org | — (permanent) |
| bylaw_ratification | per-org | false | Enable bylaw voting feature | After M12 GA |
| hybrid_voting | per-org | false | Enable hybrid (online + in-person) voting mode | After M12 GA |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M12-S1 | Create Election | Create election with positions, dates, voting mode | M04 (positions) | P0 |
| M12-S2 | Nomination Flow | Open nominations, self-nominate, accept/decline | M12-S1 | P0 |
| M12-S3 | Cast Vote | Secret ballot, one per position, eligibility check | M12-S2, M05 | P0 |
| M12-S4 | Publish Results | Compute + publish results, immutability enforcement | M12-S3 | P0 |
| M12-S5 | Officer Transition | ElectionPublished event → M04 officer assignment | M12-S4, M04 | P1 |
| M12-S6 | Election Cancellation | Cancel at any state, void votes, notify members | M12-S1, M07 | P1 |
| M12-S7 | Bylaw Ratification | Type=bylaw election flow (no nominations phase) | M12-S1 | P1 |

## 20. AI Instructions

- **Schema location:** `services/api-ts/src/handlers/elections/repos/elections.schema.ts` — tables: election, election_nominee, election_vote
- **Handler location:** `services/api-ts/src/handlers/elections/` (6 existing handlers, TypeSpec)
- **State machine:** Existing `VALID_TRANSITIONS` map in `elections/updateElectionStatus.ts` — use it, don't reinvent
- **Bounded context:** Governance Context — owns election, election_nominee, election_vote. Position is owned by Membership context (cross-context FK).
- **Secret ballot:** Store voterId on ElectionVote for uniqueness enforcement, but never expose individual vote choices in API responses. Results return only aggregate counts.
- **Cascade deletes:** election_nominee and election_vote cascade on election delete (FK configured)
- **TypeSpec first:** Define API in `specs/api/src/modules/elections.tsp` before implementing handlers
- **Vertical TDD:** Follow VERTICAL_TDD.md — write failing tests first for each slice

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | — |
| 3. Workflows | COMPLETE | |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | |
| 6. Permissions | COMPLETE | Matches ROLE_PERMISSION_MATRIX |
| 7. Data Requirements | COMPLETE | — |
| 7b. Aggregate Boundaries | COMPLETE | — |
| 8. State Transitions | COMPLETE | From DOMAIN_MODEL.md section 13d |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | COMPLETE | — |
| 11. Acceptance Criteria | COMPLETE | — |
| 12. Test Expectations | COMPLETE | — |
| 13. Edge Cases | PARTIAL | Tie-breaking, nominee withdrawal after voting, hybrid vote recording need [VERIFY] |
| 14. Dependencies | COMPLETE | — |
| 15. Error Handling | COMPLETE | — |
| 16. Performance | COMPLETE | — |
| 17. Observability | COMPLETE | — |
| 18. Feature Flags | COMPLETE | — |
| 19. Vertical Slice Plan | COMPLETE | — |
| 20. AI Instructions | COMPLETE | — |

## 22. Downstream Impact

- **M04 (Org Admin):** ElectionPublished event contract must include winnerId and positionId per position; changes affect officer assignment flow
- **M07 (Communications):** ElectionOpened and ElectionCancelled events drive notifications; payload changes affect announcement content
- **M05 (Membership):** Voting eligibility depends on MembershipStatusChanged event; if status transitions change, eligibility logic needs review
