# Module Specification: Elections & Governance (M12)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Run democratic elections and governance processes for healthcare associations — nominations, voting, ballot integrity, results publication, and bylaw ratification.

### Users
- President, Officers, Member

### Related Modules
- M04 (Org Admin — officer role updates post-election), M05 (Membership — voting eligibility)
- M07 (Communications — election announcements)

### In Scope
- Election creation (officer elections + bylaw ratification)
- Nomination management (open/close, self-nominate, accept/decline)
- Voting (online, in-person, hybrid), ballot integrity (one vote per member per position)
- Results computation and publication, officer term management
- Election state machine (draft → nominations → voting → confirmation → published)

### Out of Scope
- Officer role assignment (M04), member status computation (M05)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Election | Governance event for officer selection or bylaw ratification. |
| Nomination | Candidate proposed for a position. Can be self-nominated or nominated by another. |
| Ballot | Member's vote in an election. One per position per voter. |
| Officer Term | Time-bounded officer assignment resulting from election. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Create & Run Election | President/Officer | Full election lifecycle | P0 |
| Member Votes | Member | Cast ballot online or in-person | P0 |
| Bylaw Ratification | President | Propose and vote on bylaw changes | P0 |

## 4. Workflow Details

### Workflow: Create & Run Election (Journey 12A)

Actor: President or authorized officer
Steps:
1. Creates election: type (officer/bylaw), positions, nomination dates, voting dates, voting mode.
2. Opens nominations. Members can self-nominate or be nominated.
3. Nominees accept/decline nominations.
4. Nominations close. Voting opens.
5. Active members cast votes (one per position). Secret ballot.
6. Voting closes. Results computed.
7. President reviews and confirms results.
8. Results published to all members.
9. Officer terms updated based on results (triggers M04 officer transition).

### Workflow: Member Votes (Journey 12B)

Actor: Active member
Steps:
1. Receives voting notification.
2. Opens election detail (/org/[id]/elections/[id]/vote).
3. Views candidates per position.
4. Casts vote (one per position). Secret ballot.
5. Confirmation: "Your vote has been recorded."

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-33 | IF voter THEN must be Active member of org | Voting eligibility | Grace/Lapsed/Suspended excluded |
| BR-34 | IF nominee THEN must be Active member with minimum tenure [INFERRED] | Nomination eligibility | Per-org configurable |
| M12-R1 | IF vote cast THEN one per voter per position per election | Ballot integrity | Unique constraint enforced |
| M12-R2 | IF results published THEN immutable, cannot be changed | Result finality | Audit-logged |
| M12-R3 | IF election cancelled THEN all votes voided, members notified | Cancellation | Clean rollback |
| M12-R4 | IF nominations close THEN no new nominees accepted | Nomination window | Strict cutoff |
| M12-R5 | IF voting mode = hybrid THEN both online and in-person votes counted | Voting | Unified tally |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View elections | All org members | non-members | GA |
| Cast vote | Active members | Grace, Lapsed, Suspended | GA |
| Nominate | All org members (officers + members) | — | GA |
| Create election | president (2FA) | All others | GA+HG |
| Delete election | president (2FA), VP, secretary (2FA), treasurer (2FA), board-member, officer | member | GA+HG |

## 7. Data Requirements

### Entity: Election

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| type | Yes | officer/bylaw | Enum |
| status | Yes | draft/nominationsOpen/votingOpen/awaitingConfirmation/published/cancelled | Enum |
| votingMode | Yes | online/inPerson/hybrid | Enum |
| nominationsOpenAt | Yes | Start nominations | — |
| nominationsCloseAt | Yes | End nominations | > nominationsOpenAt |
| votingOpenAt | Yes | Start voting | >= nominationsCloseAt |
| votingCloseAt | Yes | End voting | > votingOpenAt |

### Entity: ElectionNominee

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| electionId | Yes | Election FK | — |
| positionId | Yes | Position FK | — |
| personId | Yes | Nominee | — |
| status | Yes | nominated/accepted/declined/elected | Enum |

### Entity: ElectionVote

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| electionId | Yes | Election FK | — |
| positionId | Yes | Position FK | — |
| nomineeId | Yes | Selected nominee | — |
| voterId | Yes | Voter | Unique with electionId + positionId |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Election | ElectionNominee, ElectionVote | — | One vote per voter per position. nominationsCloseAt < votingOpenAt < votingCloseAt. |

## 8. State Transitions

### Election Status
```txt
Draft → NominationsOpen → VotingOpen → AwaitingConfirmation → Published
Draft → Cancelled
NominationsOpen → Cancelled
VotingOpen → Cancelled
```

### Nominee Status
```txt
Nominated → Accepted → Elected
Nominated → Declined
```

## 9. UI / UX Requirements

### Screen: Elections List (/org/[id]/officer/elections)
Purpose: Manage elections
Components: Election list with status, create button, active election highlight

### Screen: Vote Ballot (/org/[id]/elections/[id]/vote)
Purpose: Member casts ballot
Components: Position list, candidate cards, vote button per position, confirmation

### Screen: Election Results
Purpose: View results after publication
Components: Position-by-position results, vote counts, winner indication

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/elections | Create election | Election data | electionId | 403 |
| POST /org/:id/elections/:id/vote | Cast vote | positionId, nomineeId | voteId | 409 already voted, 403 ineligible |
| PUT /org/:id/elections/:id/status | Transition status | newStatus | Updated election | 400 invalid transition |
| GET /org/:id/elections/:id/results | Get results | — | Position results | 403 not published |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| ElectionOpened | Nominations or voting opened | electionId, orgId | M07 (announcements) |
| ElectionPublished | Results published | electionId, orgId, winners | M04 (officer transitions) |
| ElectionCancelled | Election cancelled | electionId, orgId | M07 (notification) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Update voter eligibility | Recalculate eligible voters |

## 11. Acceptance Criteria

### AC-M12-001: One Vote Per Position
Given a member has already voted for a position, When they attempt to vote again, Then the system rejects with "Already voted."

### AC-M12-002: Voting Eligibility
Only Active members can vote. Grace, Lapsed, Suspended members are excluded.

### AC-M12-003: Result Immutability
Published results cannot be modified by any role.

## 12. Test Expectations

Required tests:
- Election state machine: all valid transitions, invalid transitions rejected
- Ballot integrity: one vote per voter per position (unique constraint)
- Voting eligibility: Active only, non-Active rejected
- Nomination: self-nominate, accept, decline, nomination window enforcement
- Results: correct computation, immutability after publication
- Cancellation: votes voided, members notified

## 13. Edge Cases

- Tied election: [VERIFY] — tiebreaker rule not specified in PRD.
- Election with 0 nominees for a position: position goes unfilled.
- Member status changes to Lapsed during voting window: vote already cast remains valid [INFERRED].
- All nominees decline: position has no candidates.

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin — officer transitions), M05 (Membership — eligibility), M07 (Communications)

### External Dependencies
- None

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate vote | Reject | "You have already voted for this position." |
| Ineligible voter | 403 | "Only active members can vote." |
| Invalid status transition | 400 | "Cannot transition from [current] to [target]." |

## 16. Performance Expectations

- Expected data volume: 2-4 elections per org per year, 200+ voters
- Acceptable response times: Vote casting < 1s, results computation < 5s

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| election.created | INFO | Election created | electionId, orgId, type | No |
| election.vote.cast | INFO | Vote recorded | electionId, positionId | No (voterId not logged) |
| election.published | INFO | Results published | electionId, orgId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| election_votes_total | counter | electionId | Total votes cast |
| election_participation_rate | gauge | electionId | Voters / eligible |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| elections_online_voting | release | true | Online voting | — |
| elections_bylaw_ratification | release | false | Bylaw voting feature | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M12-S1 | Election CRUD | Create, configure elections | M04 | P0 |
| M12-S2 | Nominations | Open/close nominations, accept/decline | M12-S1, M05 | P0 |
| M12-S3 | Online Voting | Cast ballots with integrity | M12-S2 | P0 |
| M12-S4 | Results & Publication | Compute and publish results | M12-S3 | P0 |
| M12-S5 | Officer Term Updates | Update roles from results | M12-S4, M04 | P0 |
| M12-S6 | Bylaw Ratification | Bylaw-type elections | M12-S3 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
