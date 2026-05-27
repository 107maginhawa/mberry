# File Enforcement: Elections & Governance (M12)

> **Generated:** 2026-05-27 | **Auditor:** oli-enforce-file | **Spec Version:** MODULE_SPEC v2.0, API_CONTRACTS v1.0
> **Scope:** `services/api-ts/src/handlers/elections/` (6 handlers, 1 repo, 1 schema) + election-related handlers in `association:member/` (14 handlers)

## Architecture Note: Dual Handler Sets

This module has **two parallel handler sets** for the same domain:

1. **`elections/`** — 6 hand-wired handlers (castVote, certifyElection, createElection, createNominee, getElection, listElections, updateElectionStatus) using raw `hono.Context`
2. **`association:member/`** — 14 TypeSpec-generated handlers (castBallot, certifyElection, createElection, createCandidate, deleteElection, deleteCandidate, getCandidate, getElection, listBallots, listCandidates, listElections, openElectionNominations, openElectionVoting, updateCandidate, updateElection) using `ValidatedContext`

Both sets import the same `ElectionsRepository`. The assoc:member handlers are newer, TypeSpec-aligned, use `auditAction`, and follow codebase conventions. The elections/ handlers are legacy, lack audit trails, and use different patterns.

## File Inventory

### elections/ (hand-wired)

| File | Role | Lines |
|------|------|-------|
| `castVote.ts` | Handler: cast vote with BR-33 eligibility | 77 |
| `certifyElection.ts` | Handler: certify + officer transition | 122 |
| `createElection.ts` | Handler: create election (officer-gated) | 40 |
| `createNominee.ts` | Handler: nominate with BR-34 eligibility | 115 |
| `getElection.ts` | Handler: election detail + nominees + tallies | 44 |
| `listElections.ts` | Handler: paginated election list | 19 |
| `updateElectionStatus.ts` | Handler: state machine transitions | 68 |
| `repos/elections.repo.ts` | Repository: CRUD + vote tallies | ~120 |
| `repos/elections.schema.ts` | Schema: election, election_nominee, election_vote | 65 |

### association:member/ (TypeSpec-generated, election-related)

| File | Role |
|------|------|
| `castBallot.ts` | Handler: cast ballot (TypeSpec-generated) |
| `certifyElection.ts` | Handler: certify election |
| `createElection.ts` | Handler: create election |
| `createCandidate.ts` | Handler: nominate candidate (BR-34) |
| `deleteElection.ts` | Handler: delete election |
| `deleteCandidate.ts` | Handler: remove candidate |
| `getCandidate.ts` | Handler: get candidate detail |
| `getElection.ts` | Handler: election detail |
| `listBallots.ts` | Handler: list ballots |
| `listCandidates.ts` | Handler: list candidates |
| `listElections.ts` | Handler: list elections |
| `openElectionNominations.ts` | Handler: transition to nominations |
| `openElectionVoting.ts` | Handler: transition to voting |
| `updateCandidate.ts` | Handler: update candidate status |
| `updateElection.ts` | Handler: update election |
| `election-role-enforcement.test.ts` | Test: sweep for officer guards |

### Test Files (elections/)

| File | Coverage |
|------|----------|
| `ac-m12.elections.test.ts` | Acceptance criteria |
| `auth-enforcement.test.ts` | Auth gate tests |
| `br-33.election-integrity.test.ts` | BR-33 business rule |
| `br-34.nomination-eligibility.test.ts` | BR-34 business rule |
| `castVote.test.ts` | castVote handler |
| `certifyElection.test.ts` | certifyElection handler |
| `createElection.test.ts` | Gutted — single existence check |
| `createNominee.test.ts` | BR-34 conditions |
| `elections-lifecycle.test.ts` | Full lifecycle flow |
| `elections-schema.test.ts` | Schema validation |
| `flow-04.election-vote-tally.test.ts` | Vote tally flow |
| `getElection.test.ts` | getElection handler |
| `listElections.test.ts` | listElections handler |
| `nomination-eligibility-e2e.test.ts` | E2E nomination flow |
| `updateElectionStatus.test.ts` | State transitions |
| `repos/elections.repo.test.ts` | Repository CRUD |
| `repos/elections.repo.nominees.test.ts` | Nominee/vote repo methods |

## Findings

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M12-7943c8bb | P1 | naming | Duplicate election handler sets: `elections/` has 6 hand-wired + `assoc:member` has 14 TypeSpec-generated handlers for same domain. Two implementations of castVote/castBallot, createElection, certifyElection, getElection, listElections. Risk of behavioral drift. | elections/ + association:member/ | Architecture single ownership | 95% |
| EF-M12-762fdce4 | P1 | domain-terms | `createElection.ts` does not emit `ElectionCreated` domain event. Spec S10b requires event with `{electionId, orgId, type, positions}` payload for Notification and Audit consumers. | elections/createElection.ts:ALL | MODULE_SPEC S10b Published Events | 95% |
| EF-M12-c6ce27d3 | P1 | domain-terms | `certifyElection.ts` does not emit `ElectionPublished` domain event. Performs officer transition inline but spec requires the event for Notification module to announce results and for M04 to consume. | elections/certifyElection.ts:ALL | MODULE_SPEC S10b Published Events | 90% |
| EF-M12-5e2f7b1f | P1 | data-shape | No in-person vote handler for hybrid elections. Spec declares `POST .../vote/in-person` with witness verification for hybrid voting mode. Schema supports `hybrid` votingMode but no handler exists. | MISSING | API_CONTRACTS 2.5 POST | 95% |
| EF-M12-e3e25b90 | P2 | error-taxonomy | `getElection.ts` has no session/auth check. No `ctx.get('session')` validation. Unauthenticated users can access election details, nominees, voter counts, and vote tallies. Spec requires GA auth for all election viewing. | elections/getElection.ts:ALL | MODULE_SPEC S6 Permissions | 95% |
| EF-M12-6936c6c9 | P2 | error-taxonomy | `listElections.ts` has no session/auth check. Same issue — no session validation. Unauthenticated listing of org elections. | elections/listElections.ts:ALL | MODULE_SPEC S6 Permissions | 95% |
| EF-M12-94431d6f | P2 | error-taxonomy | `castVote.ts:28` throws `ConflictError` (HTTP 409) for "Voting is not open" but spec says 400 Bad Request for invalid state. | elections/castVote.ts:28 | MODULE_SPEC S15 Error Handling | 90% |
| EF-M12-68b042a8 | P2 | error-taxonomy | `castVote.ts:49` non-active voter throws `BusinessLogicError` (HTTP 400) but spec says 403 Forbidden for "Only active members can vote." | elections/castVote.ts:49 | MODULE_SPEC S15 Error Handling | 85% |
| EF-M12-67d32f46 | P2 | domain-terms | `castVote.ts` has no `auditAction` call. Vote cast is not logged to audit trail. All assoc:member election handlers call `auditAction`. | elections/castVote.ts:ALL | MODULE_SPEC S17 Observability | 90% |
| EF-M12-87a17906 | P2 | error-taxonomy | `createElection.ts:18` allows any active officer to create elections. Spec requires president-only with 2FA (`GA+HG auth`). | elections/createElection.ts:18 | MODULE_SPEC S6 Permissions | 85% |
| EF-M12-de9d7722 | P2 | domain-terms | `createElection.ts` has no `auditAction` call. Election creation not logged to audit trail. | elections/createElection.ts:ALL | MODULE_SPEC S17 Observability | 90% |
| EF-M12-f293bf7a | P2 | error-taxonomy | `certifyElection.ts:47` allows any officer to certify. Spec implies president authority for certification/publish. | elections/certifyElection.ts:47 | MODULE_SPEC S6 Permissions | 75% |
| EF-M12-7eadd7e2 | P2 | domain-terms | `certifyElection.ts` has no `auditAction` call. Certification and officer transition not logged. | elections/certifyElection.ts:ALL | MODULE_SPEC S17 Observability | 90% |
| EF-M12-4f5bbf44 | P2 | domain-terms | `createNominee.ts` has no `auditAction` call. Nomination not logged to audit trail. | elections/createNominee.ts:ALL | MODULE_SPEC S17 Observability | 90% |
| EF-M12-17f3ceaa | P2 | data-shape | `elections.schema.ts:10` nominee_status enum has `['nominated', 'accepted', 'declined', 'elected']` but spec defines `['nominated', 'accepted', 'declined', 'withdrawn']`. Missing `withdrawn` state; `elected` is a result not a nominee lifecycle status. | elections/repos/elections.schema.ts:10 | MODULE_SPEC S8 Nominee Status, API_CONTRACTS S5 | 90% |
| EF-M12-577e5c87 | P2 | data-shape | No `elections.tsp` TypeSpec file found in `specs/api/src/modules/` despite MODULE_SPEC S20 saying "TypeSpec first." Election TypeSpec definitions live in `association-member.tsp` instead. | specs/api/src/modules/ | MODULE_SPEC S20 AI Instructions | 90% |
| EF-M12-df0c5779 | P2 | data-shape | `castVote.ts` does not differentiate bylaw vs officer votes. Bylaw elections need yes/no voting with `passageThreshold` evaluation, not nominee selection. | elections/castVote.ts:ALL | MODULE_SPEC WF-078, API_CONTRACTS 2.4 | 85% |
| EF-M12-ed387a01 | P2 | data-shape | `election_vote` table missing `witnessPersonId` field required by API_CONTRACTS 2.5 for hybrid (in-person) voting. | elections/repos/elections.schema.ts:48-60 | API_CONTRACTS 2.5 | 85% |
| EF-M12-c7bb85c6 | P2 | domain-terms | No handler for consumed `MembershipStatusChanged` event to recalculate voter eligibility for active elections per spec S10b. | elections/ | MODULE_SPEC S10b Consumed Events | 85% |
| EF-M12-b4a89f60 | P2 | error-taxonomy | No handler enforces `votingOpenAt`/`votingCloseAt` timestamps. Spec error "Voting period closed" and "Nominations closed" are not implemented anywhere. | elections/castVote.ts:ALL | MODULE_SPEC S15 Error Handling | 85% |
| EF-M12-8c21dfe7 | P2 | data-shape | `createElection.test.ts` gutted to single existence check after raw SQL rewrite. Only verifies `typeof createElection === 'function'`. No unit test coverage for creation logic. | elections/createElection.test.ts | Test coverage | 95% |
| EF-M12-4b5f8a39 | P3 | import-boundary | `castVote.ts:5-6` imports `MembershipRepository` and `computeMembershipStatus` directly from `association:member`. Cross-bounded-context dependency. | elections/castVote.ts:5-6 | Architecture bounded context | 80% |
| EF-M12-7e03b178 | P3 | import-boundary | `certifyElection.ts:19` imports `OfficerTermRepository` + `TransitionChecklistRepository` from `association:member/repos/governance.repo`. | elections/certifyElection.ts:19 | Architecture bounded context | 80% |
| EF-M12-ca2b9ced | P3 | import-boundary | `createElection.ts:4` imports `OfficerTermRepository` from `association:member`. | elections/createElection.ts:4 | Architecture bounded context | 80% |
| EF-M12-a3c6e87d | P3 | import-boundary | `createNominee.ts:15` imports `memberships` schema table directly from `association:member`, bypassing repository boundary. | elections/createNominee.ts:15 | Architecture bounded context | 80% |
| EF-M12-f34e2ac6 | P3 | naming | All 6 `elections/` handlers use raw `hono.Context` type. All 14 `assoc:member` election handlers use `ValidatedContext`. Inconsistent typing pattern. | elections/*.ts:ALL | Codebase naming convention | 85% |
| EF-M12-22f889fe | P3 | domain-terms | Spec domain term "Ballot" (S2) but code uses "Vote" throughout — `election_vote` table, `castVote` handler. Assoc:member correctly uses `castBallot`, `listBallots`. | elections/ | MODULE_SPEC S2 Domain Terms | 70% |

## Summary

| Severity | Count |
|----------|-------|
| P1 | 4 |
| P2 | 17 |
| P3 | 6 |
| **Total** | **27** |

### By Check Category

| Check | Count |
|-------|-------|
| error-taxonomy | 7 |
| domain-terms | 8 |
| data-shape | 6 |
| import-boundary | 4 |
| naming | 2 |

### Compliant Areas (No Finding)

| Area | Evidence |
|------|----------|
| BR-33 vote uniqueness | `castVote.ts` enforces one-vote-per-position with `hasVoted()` check + DB unique index + race condition handling via `23505` catch |
| BR-34 nomination eligibility | `createNominee.ts` enforces 3 conditions: active membership, 6-month tenure, no suspensions. Configurable `minMembershipMonths`. |
| State machine transitions | `updateElectionStatus.ts` correctly implements `VALID_TRANSITIONS` map matching spec S8. BR-33 minimum 2-candidate guard on `nominationsOpen → votingOpen`. |
| Cascade deletes | Schema correctly configures `onDelete: 'cascade'` on `election_nominee.electionId` and `election_vote.electionId`. |
| Unique vote constraint | `election_vote_unique` index on `(electionId, voterId, positionId)` matches spec AC-M12-001. |
| Date ordering checks | Schema has 3 `CHECK` constraints enforcing nominations before voting date ordering. |
| Officer transition | `certifyElection.ts` correctly ends outgoing terms, creates new terms, generates transition checklists. |
| updateElectionStatus audit | Only elections/ handler with `auditAction` call. Logs status transitions with event subtypes. |

### Recommended Actions

1. **Consolidate handler sets (P1):** Deprecate `elections/` hand-wired handlers in favor of `assoc:member` TypeSpec-generated handlers. The assoc:member set is more complete (14 vs 6), follows conventions (ValidatedContext, auditAction), and aligns with TypeSpec-first architecture.

2. **Add domain events (P1):** Emit `ElectionCreated` and `ElectionPublished` events from whichever handler set is canonical. Required for notification consumers and cross-module transitions.

3. **Fix auth gaps (P2):** Add session validation to `getElection.ts` and `listElections.ts` in the elections/ set (or deprecate them in favor of assoc:member equivalents which have auth).

4. **Add audit trails (P2):** Add `auditAction` calls to castVote, createElection, certifyElection, createNominee in elections/ (or deprecate in favor of assoc:member which already has them).

5. **Fix nominee status enum (P2):** Add `withdrawn` to `nomineeStatusEnum`, evaluate whether `elected` should remain or be replaced.

6. **Implement bylaw voting (P2):** Differentiate officer vs bylaw vote handling with yes/no tallying and passage threshold evaluation.
