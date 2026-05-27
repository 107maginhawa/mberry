# Module Enforcement: Elections & Governance (M12)
**Score:** 7.5/10 — MOSTLY COMPLIANT
**Date:** 2026-05-27
**Auditor:** oli-enforce-module (re-audit)
**Source:** `services/api-ts/src/handlers/elections/` (schema+repo+7 legacy handlers) + `services/api-ts/src/handlers/association:member/*Election*.ts` (8 TypeSpec-generated live handlers)

## Architecture Note

Election handlers exist in TWO locations:
1. **`elections/`** — Original hand-wired handlers (createElection, getElection, listElections, castVote, createNominee, certifyElection, updateElectionStatus). These share the repo and schema but are NOT registered in generated routes. Dead code for route serving.
2. **`association:member/`** — TypeSpec-generated handlers (createElection, getElection, listElections, updateElection, deleteElection, certifyElection, openElectionNominations, openElectionVoting). These are the LIVE handlers registered via `generated/openapi/routes.ts` at `/association/member/elections/*`.

Both sets import from `elections/repos/elections.repo.ts` and `elections/repos/elections.schema.ts`. The repo/schema layer is shared and canonical.

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 7/10 | 0 | 2 | 2 | 0 |
| 2. Workflow Implementation | 7/10 | 0 | 1 | 2 | 0 |
| 3. Domain Term Consistency | 8/10 | 0 | 0 | 2 | 0 |
| 4. State Machine Enforcement | 9/10 | 0 | 0 | 1 | 0 |
| 5. Event Publishing | 3/10 | 0 | 2 | 1 | 0 |
| 6. Auth/Permission Enforcement | 8/10 | 0 | 0 | 2 | 1 |

**Average:** 7.0 | **Capped (P1 present):** 7.5

## Findings

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M12-3f8a1b2c | P1 | API | `PATCH .../nominees/:nomineeId` (accept/decline/withdraw) missing. Spec API_CONTRACTS 2.2 declares it. Repo has `updateNomineeStatus()` and `getNominee()` but no HTTP handler exists in either handler set. Nominee acceptance flow is unreachable. | N/A (missing) | 95% |
| EM-M12-7d4e5f6a | P1 | API | `POST .../vote/in-person` endpoint missing. Spec API_CONTRACTS 2.5 declares in-person vote entry for hybrid elections with witnessPersonId. No handler in either set. Feature flag `hybrid_voting` exists in spec but cannot be exercised. | N/A (missing) | 95% |
| EM-M12-b9c0d1e2 | P2 | API | Bylaw voting (spec 2.4) uses same `/vote` endpoint with `type=bylaw` body. castVote handler (both versions) does not differentiate — no `passageThreshold` check at certification time. Schema has `passageThreshold` column but certifyElection ignores it. | elections/castVote.ts, association:member/certifyElection.ts | 85% |
| EM-M12-2a3b4c5d | P2 | API | `deleteElection` in association:member only allows deletion of `draft` elections. Spec says "draft or cancelled only" — missing `cancelled` state check. | association:member/deleteElection.ts:37 | 90% |
| EM-M12-6e7f8a9b | P1 | Workflow | WF-078 (Bylaw Ratification) partially implemented. Election can be `type: 'bylaw'` with `passageThreshold`. But: (a) bylaw elections should skip nominations phase — not enforced in state machine, (b) certification does not compute pass/fail against threshold, (c) no quorum validation. | updateElectionStatus.ts, certifyElection.ts | 85% |
| EM-M12-c0d1e2f3 | P2 | Workflow | WF-079 (Election-to-Officer Transition) well-implemented inline in `certifyElection.ts` — creates new terms, ends outgoing, generates checklists. But does not emit `ElectionPublished` event for decoupled consumers (M07 notifications). Tight coupling, not event-driven. | association:member/certifyElection.ts | 85% |
| EM-M12-4a5b6c7d | P2 | Workflow | castVote (both versions) — WF-077 well-implemented. Secret ballot: voterId stored for uniqueness but not exposed in tallies (getVoteTallies returns aggregate counts only). One-vote-per-position: DB unique constraint + hasVoted pre-check + 23505 race condition catch. BR-33 active membership verified via computeMembershipStatus. Solid. | elections/castVote.ts | 95% |
| EM-M12-8e9f0a1b | P2 | Domain Terms | Nominee status enum `['nominated', 'accepted', 'declined', 'elected']` missing `withdrawn` state. Spec 8. State Transitions defines `accepted -> withdrawn` (before votingOpen). Edge case: spec says withdrawn candidate's votes go to runner-up. Neither the enum nor any handler supports this flow. | elections/repos/elections.schema.ts:10 | 90% |
| EM-M12-d2e3f4a5 | P2 | Domain Terms | `electionType` enum mismatch. DB schema: `['officer', 'bylaw']`. TypeSpec-generated validators: `["general", "special", "byElection"]`. The generated routes validate against TypeSpec types, but DB stores different values. SDK/frontend will send `general` but repo expects `officer`. | elections/repos/elections.schema.ts:7, generated/openapi/validators.ts:5177 | 90% |
| EM-M12-6b7c8d9e | P3 | State Machine | Election status transitions correct. `VALID_TRANSITIONS` map in `updateElectionStatus.ts` exactly matches spec: draft -> nominationsOpen/cancelled, nominationsOpen -> votingOpen/cancelled, votingOpen -> awaitingConfirmation/cancelled, awaitingConfirmation -> published/cancelled. Terminal states enforced. BR-33 min-2-candidates guard at nominationsOpen->votingOpen present. | elections/updateElectionStatus.ts | 95% |
| EM-M12-a0b1c2d3 | P1 | Events | `ElectionOpened` event not emitted. Spec 10b declares it on nominations or voting opened. openElectionNominations and openElectionVoting handlers update status and audit but never emit domain event. M07 (announcements) cannot react. | association:member/openElectionNominations.ts, openElectionVoting.ts | 95% |
| EM-M12-e4f5a6b7 | P1 | Events | `ElectionPublished` event not emitted. Spec declares payload `{electionId, orgId, winners: [{positionId, winnerId}]}` consumed by M04. certifyElection does inline officer transition (good fallback) but no event for other consumers. `ElectionCancelled` also not emitted anywhere. Zero of three spec events implemented. | association:member/certifyElection.ts | 95% |
| EM-M12-8c9d0e1f | P2 | Events | `auditAction()` called in updateElectionStatus, deleteElection, openElectionNominations, openElectionVoting, createElection, updateElection, certifyElection — good audit trail coverage. But audit logging != domain events. Domain event bus not wired for elections module. | multiple files | 85% |
| EM-M12-2a3b4c5d | P2 | Auth | `createElection` (association:member) correctly restricts to PRESIDENT via `requirePosition()`. However, spec says "super, admin, president (2FA)" — admin and super roles not checked. Also no 2FA enforcement anywhere. | association:member/createElection.ts | 85% |
| EM-M12-f6a7b8c9 | P2 | Auth | getElection and listElections (association:member versions) both check `session` exists — basic auth present. But no role-based restriction. Spec says all roles except `user` can view elections. The `user` role exclusion is not enforced. | association:member/getElection.ts, listElections.ts | 80% |
| EM-M12-0d1e2f3a | P3 | Auth | Legacy `elections/getElection.ts` and `elections/listElections.ts` have NO auth checks. These are dead code (not registered in routes) but represent a risk if accidentally imported. | elections/getElection.ts, elections/listElections.ts | 70% |

## Dimension Details

### 1. Public API Completeness (7/10)

**Spec declares 10 endpoints (API_CONTRACTS.md).** Implementation status:

| Endpoint | Status | Handler Location |
|----------|--------|-----------------|
| GET `/elections` | LIVE | association:member/listElections.ts |
| POST `/elections` | LIVE | association:member/createElection.ts |
| GET `/elections/:electionId` | LIVE | association:member/getElection.ts |
| PATCH `/elections/:electionId` | LIVE | association:member/updateElection.ts |
| DELETE `/elections/:electionId` | LIVE | association:member/deleteElection.ts |
| POST `/elections/:electionId/certify` | LIVE | association:member/certifyElection.ts |
| POST `/elections/:electionId/open-nominations` | LIVE | association:member/openElectionNominations.ts |
| POST `/elections/:electionId/open-voting` | LIVE | association:member/openElectionVoting.ts |
| PATCH `/elections/:electionId/nominees/:nomineeId` | MISSING | No handler |
| POST `/elections/:electionId/vote/in-person` | MISSING | No handler |

Additionally: `castVote` and `createNominee` exist in `elections/` but are NOT TypeSpec-registered. They may be hand-wired elsewhere or dead.

**Score rationale:** 8 of 10 endpoints implemented. 2 missing (nominee status update, in-person vote). deleteElection has a minor status check gap.

### 2. Workflow Implementation (7/10)

| Workflow | Status | Notes |
|----------|--------|-------|
| WF-076: Create & Run Election | IMPLEMENTED | Full lifecycle via TypeSpec handlers. Status transitions via dedicated open-nominations and open-voting endpoints. |
| WF-077: Member Votes | IMPLEMENTED | Secret ballot, one-vote-per-position, BR-33 membership check. Solid. |
| WF-078: Bylaw Ratification | PARTIAL | Schema supports it (type=bylaw, passageThreshold). No differentiated flow — bylaw elections forced through same nominations pipeline. No threshold enforcement at certification. |
| WF-079: Election-to-Officer Transition | IMPLEMENTED | Inline in certifyElection. No event decoupling. |

### 3. Domain Term Consistency (8/10)

- Election, ElectionNominee, ElectionVote entities match spec names
- Status enums mostly match: `draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled`
- Nominee status missing `withdrawn` (has `elected` instead — different concern)
- Election type enum mismatch between DB (`officer/bylaw`) and TypeSpec-generated validators (`general/special/byElection`) — could cause runtime validation failures

### 4. State Machine Enforcement (9/10)

- `VALID_TRANSITIONS` map in `updateElectionStatus.ts` exactly matches spec
- BR-33 minimum 2 candidates guard present at nominationsOpen -> votingOpen
- Terminal states (published, cancelled) enforced with empty allowed arrays
- Dedicated `openElectionNominations` and `openElectionVoting` handlers duplicate some state logic but are more granular
- Minor: bylaw elections should skip nominations -> votingOpen transition (not enforced)

### 5. Event Publishing (3/10)

**Zero of three spec-declared domain events are emitted:**
- `ElectionOpened` — not emitted (spec: M07 announcements consumer)
- `ElectionPublished` — not emitted (spec: M04 officer transitions consumer)
- `ElectionCancelled` — not emitted (spec: M07 notification consumer)

`auditAction()` is called appropriately for audit trail but is NOT a substitute for domain events. The module is self-contained but breaks the event-driven architecture contract.

### 6. Auth/Permission Enforcement (8/10)

- createElection: PRESIDENT-only via `requirePosition()` — correct but doesn't include admin/super per spec
- deleteElection: officer term required — correct
- updateElection: officer term required — correct
- certifyElection: officer term required — correct
- openElectionNominations/Voting: officer term required — correct
- getElection/listElections: session required only — no role-based exclusion of `user` role
- No 2FA enforcement anywhere (spec requires it for president/secretary/treasurer on sensitive ops)
- castVote (legacy): full BR-33 active membership check — excellent
- createNominee (legacy): full BR-34 three-condition check — excellent

## Summary

M12 improved since initial audit due to TypeSpec migration adding `deleteElection`, `updateElection`, `openElectionNominations`, and `openElectionVoting` handlers. The state machine is solid and BR-33/BR-34 business rules are well-implemented in the legacy vote/nominate handlers.

**Critical gaps remaining:**
1. **Nominee status update handler** — spec declares it, repo supports it, no HTTP endpoint
2. **In-person vote handler** — hybrid voting mode has no endpoint
3. **Domain events** — 0/3 spec events emitted, breaking event-driven contracts
4. **Election type enum mismatch** — DB vs TypeSpec validators will cause runtime issues
5. **Bylaw ratification** — passageThreshold stored but never evaluated

**Architectural concern:** Handler duplication across `elections/` and `association:member/` creates confusion. Legacy `elections/` handlers (castVote, createNominee, updateElectionStatus) contain BR-33/BR-34 logic not present in TypeSpec-generated handlers. Need to verify these are actually reachable via routes or consolidate.
