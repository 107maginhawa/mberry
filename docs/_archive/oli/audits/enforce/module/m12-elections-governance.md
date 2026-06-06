# Module Enforcement: Elections & Governance (M12)

**Score:** 6/10 — PARTIALLY COMPLIANT
**Date:** 2026-05-28
**Auditor:** oli-enforce-module (re-audit v2)
**Prior Audit:** 2026-05-27 (score 7.5/10 — downgraded after deeper route analysis)
**Source:** `services/api-ts/src/handlers/elections/` (9 handler files, shared repo+schema) + `services/api-ts/src/handlers/association:member/*Election*.ts` (8 TypeSpec-generated live handlers)

## Architecture Note

Election handlers exist in TWO locations:
1. **`association:member/`** — TypeSpec-generated handlers (8 files). These are the **LIVE** handlers registered via `generated/openapi/routes.ts` at `/association/member/elections/*`.
2. **`elections/`** — Original hand-wired handlers (9 files). Most are **dead code** for route serving. Only `updateNomineeStatus` is route-registered (hand-wired in `app.ts` line 466).

Both sets import from `elections/repos/elections.repo.ts` and `elections/repos/elections.schema.ts`. The repo/schema layer is shared.

**Critical:** `castVote.ts` and `createNominee.ts` (in `elections/`) contain the only implementations of BR-33 voting eligibility and BR-34 nomination eligibility checks, but have **NO route registration**. These core workflows are unreachable via HTTP.

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 5/10 | 0 | 3 | 1 | 0 |
| 2. Workflow Implementation | 5/10 | 0 | 2 | 2 | 1 |
| 3. Domain Term Consistency | 7/10 | 0 | 1 | 1 | 0 |
| 4. State Machine Enforcement | 9/10 | 0 | 0 | 0 | 1 |
| 5. Event Publishing | 3/10 | 0 | 2 | 1 | 0 |
| 6. Auth/Permission Enforcement | 7/10 | 0 | 0 | 2 | 1 |

**Average:** 6.0 | **Capped (P1 present):** 6

## Findings

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M12-3f8a1b2c | P1 | API | **castVote handler unreachable.** `elections/castVote.ts` implements BR-33 (active membership check), one-vote-per-position, and race condition handling. But it is NOT registered in `generated/openapi/routes.ts` NOR in `app.ts`. No `/vote` endpoint exists. Members cannot vote. | elections/castVote.ts | 99% |
| EM-M12-7d4e5f6a | P1 | API | **createNominee handler unreachable.** `elections/createNominee.ts` implements BR-34 (nomination eligibility: active membership, 6-month tenure, no suspensions). Not route-registered anywhere. No `/nominate` endpoint exists. Members cannot be nominated. | elections/createNominee.ts | 99% |
| EM-M12-8e9f0a1b | P1 | API | **updateNomineeStatus partially wired.** Hand-wired in `app.ts:466` at `PATCH /association/member/elections/:electionId/nominees/:nomineeId`. Route exists but missing from OpenAPI spec, so SDK consumers cannot discover it. Implements nominee accept/decline state machine. | elections/updateNomineeStatus.ts, app.ts:466 | 95% |
| EM-M12-b9c0d1e2 | P2 | API | **deleteElection allows draft only.** Both `elections/deleteElection.ts` and `association:member/deleteElection.ts` guard `status !== 'draft'`. Spec allows deleting both draft AND cancelled elections. Cancelled election deletion blocked. | association:member/deleteElection.ts:37 | 90% |
| EM-M12-6e7f8a9b | P1 | Workflow | **WF-076/WF-077 broken: voting and nomination flows unreachable.** The two most critical user workflows (nominating candidates and casting votes) have handler implementations but no HTTP endpoints. The entire election lifecycle is limited to create/configure/transition — the core democratic functions are inaccessible. | N/A (missing routes) | 99% |
| EM-M12-a1b2c3d4 | P1 | Workflow | **WF-078 Bylaw Ratification incomplete.** `passageThreshold` stored on election schema but never evaluated. `certifyElection` (both versions) publishes results regardless of threshold. Bylaw elections follow officer election flow with no differentiation. | association:member/certifyElection.ts | 90% |
| EM-M12-c0d1e2f3 | P2 | Workflow | **WF-079 simplified in live handler.** Legacy `elections/certifyElection.ts` has full officer transition (create new terms, end outgoing, generate checklists). Live `association:member/certifyElection.ts` just publishes with tallies — no cross-module officer transition. | association:member/certifyElection.ts | 95% |
| EM-M12-y5z6a7b8 | P3 | Workflow | **No automated voting period close.** `votingCloseAt` stored but no scheduled job transitions status when deadline passes. Manual transition only. | N/A | 85% |
| EM-M12-d2e3f4a5 | P1 | Domain Terms | **electionType enum mismatch.** DB schema: `['officer', 'bylaw']`. TypeSpec validators: `["general", "special", "byElection"]`. Generated routes validate against TypeSpec types, so frontend sends `general` but DB expects `officer`. Runtime insert will fail or store wrong value. `createElection` spreads `body` into `repo.create()` without mapping. | elections/repos/elections.schema.ts:7, generated validators | 95% |
| EM-M12-8e9f0a1c | P2 | Domain Terms | **Nominee `withdrawn` state missing from DB enum.** Spec 8. State Transitions defines `accepted -> withdrawn`. Schema has `['nominated', 'accepted', 'declined', 'elected']`. Code uses `declined` as withdrawal proxy. Semantic loss: declined (refusal) vs withdrawn (voluntary exit). | elections/repos/elections.schema.ts:10 | 90% |
| EM-M12-6b7c8d9e | P3 | State Machine | **Election state machine correct.** `ELECTION_VALID_TRANSITIONS` in `utils/status-transitions.ts` exactly matches spec. Terminal states enforced. Dedicated `openElectionNominations` and `openElectionVoting` handlers provide granular transitions with proper guards. Minor: bylaw elections should skip nominations phase — not enforced. | utils/status-transitions.ts | 95% |
| EM-M12-a0b1c2d3 | P1 | Events | **Zero of three spec domain events emitted by live handlers.** Live `association:member/` handlers use `auditAction()` only — no `domainEvents.emit()` calls. Legacy `elections/` handlers do emit events (`election.status.changed`, `election.created`, `election.deleted`, `nomination.submitted`) but are dead code. M07 announcements and M04 officer transitions cannot react. | association:member/*.ts | 95% |
| EM-M12-e4f5a6b7 | P1 | Events | **`ElectionPublished` event never emitted.** Spec requires payload `{electionId, orgId, winners: [{positionId, winnerId}]}` consumed by M04 for officer transitions. Live `certifyElection` publishes election but emits no event. Even legacy version emits generic `election.status.changed` without winners payload. | association:member/certifyElection.ts | 95% |
| EM-M12-8c9d0e1f | P2 | Events | **Audit trail good, but audit != domain events.** `auditAction()` called in all 8 live handlers — solid audit coverage. But audit logging is not a substitute for domain event publishing. No consumer can subscribe to election lifecycle events. | multiple | 85% |
| EM-M12-2a3b4c5e | P2 | Auth | **createElection restricts to PRESIDENT only.** Spec says "super, admin, president (2FA)". Admin and super roles not checked. `requirePosition()` only verifies officer position title. | association:member/createElection.ts | 85% |
| EM-M12-f6a7b8c9 | P2 | Auth | **listElections/getElection: no role exclusion.** Both check `session` exists. Spec excludes `user` role. Any authenticated user (including non-members) can view elections. | association:member/listElections.ts, getElection.ts | 80% |
| EM-M12-0d1e2f3a | P3 | Auth | **No 2FA enforcement.** Spec requires 2FA for president on create, and for president/secretary/treasurer on delete. No 2FA check in any handler. Platform-wide gap. | multiple | 70% |

## Dimension Details

### 1. Public API Completeness (5/10)

**Spec Section 10 declares 8 endpoints. OpenAPI has 8 registered paths (different shape). 2 core endpoints completely missing from routes.**

| Spec Endpoint | OpenAPI / Route Status | Handler Location |
|---|---|---|
| GET /orgs/{id}/elections | LIVE: `GET /association/member/elections` | association:member/listElections.ts |
| POST /orgs/{id}/elections | LIVE: `POST /association/member/elections` | association:member/createElection.ts |
| GET /orgs/{id}/elections/{id} | LIVE: `GET /association/member/elections/:electionId` | association:member/getElection.ts |
| PATCH /orgs/{id}/elections/{id}/status | LIVE: `PATCH /association/member/elections/:electionId` (general update) | association:member/updateElection.ts |
| POST /orgs/{id}/elections/{id}/nominate | **DEAD CODE** — handler exists, no route | elections/createNominee.ts |
| PATCH /orgs/{id}/elections/{id}/nominees/{id} | HAND-WIRED in app.ts:466 (not in OpenAPI) | elections/updateNomineeStatus.ts |
| POST /orgs/{id}/elections/{id}/vote | **DEAD CODE** — handler exists, no route | elections/castVote.ts |
| DELETE /orgs/{id}/elections/{id} | LIVE: `DELETE /association/member/elections/:electionId` | association:member/deleteElection.ts |

**Extra TypeSpec endpoints (not in spec Section 10):**
- `POST /association/member/elections/:electionId/certify` — implements WF-079
- `POST /association/member/elections/:electionId/open-nominations` — status shortcut
- `POST /association/member/elections/:electionId/open-voting` — status shortcut

**Score rationale:** Core CRUD + lifecycle transitions work. But the two defining features of an elections module (nominate + vote) are unreachable. Score 5 not lower because infrastructure (repo, schema, handler logic) exists and is high quality.

### 2. Workflow Implementation (5/10)

| Workflow | Status | Notes |
|----------|--------|-------|
| WF-076: Create & Run Election | BROKEN | Create, configure, transition lifecycle all work. But cannot add nominees (createNominee dead) or collect votes (castVote dead). Election lifecycle is an empty shell. |
| WF-077: Member Votes | BROKEN | Handler exists with full BR-33 checks but no route. |
| WF-078: Bylaw Ratification | PARTIAL | Schema supports `type=bylaw` + `passageThreshold`. No threshold evaluation at certification. |
| WF-079: Election-to-Officer Transition | REGRESSED | Legacy handler has full officer transition. Live handler just publishes — no cross-module term management. |

### 3. Domain Term Consistency (7/10)

- Election, ElectionNominee, ElectionVote entities match spec names
- Election status enum matches spec exactly: `draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled`
- **Breaking:** `electionType` enum mismatch: DB `['officer', 'bylaw']` vs TypeSpec `["general", "special", "byElection"]`. Live `createElection` will fail to persist correct type because validated body uses TypeSpec values but repo writes to DB with DB enum.
- Nominee status missing `withdrawn` (has `elected` instead — different lifecycle concern)

### 4. State Machine Enforcement (9/10)

- `ELECTION_VALID_TRANSITIONS` in shared utils matches spec exactly
- Live handlers use dedicated endpoints (`openElectionNominations`, `openElectionVoting`) with proper state guards
- BR-33 minimum 2 candidates guard present in `openElectionVoting`
- Terminal states (published, cancelled) enforced
- Nominee state machine in `updateNomineeStatus.ts` implements transitions with guard logic
- Minor: bylaw elections forced through nominations pipeline (should skip)

### 5. Event Publishing (3/10)

**Zero spec domain events emitted by live handlers:**

| Spec Event | Required By | Implementation |
|---|---|---|
| ElectionOpened | M07 (announcements) | NOT EMITTED — live handlers use `auditAction()` only |
| ElectionPublished | M04 (officer transitions) | NOT EMITTED — certify publishes but no event |
| ElectionCancelled | M07 (notification) | NOT EMITTED — no cancel handler in live set |

**Legacy handlers DO emit events** (`election.status.changed`, `election.created`, `election.deleted`, `nomination.submitted`) — but these are dead code, and event names don't match spec anyway.

`MembershipStatusChanged` consumed event: NOT IMPLEMENTED. Voter eligibility only checked at vote-time (which is itself unreachable).

### 6. Auth/Permission Enforcement (7/10)

| Handler | Auth Pattern | Spec Compliance |
|---|---|---|
| createElection | `requirePosition([PRESIDENT])` | Partial — missing admin/super roles |
| updateElection | `requireOfficerTerm()` | OK — officer required |
| deleteElection | `requireOfficerTerm()` | OK — officer required |
| certifyElection | President check via `OfficerTermRepository` | OK — president guard |
| openElectionNominations | `requireOfficerTerm()` | OK |
| openElectionVoting | `requireOfficerTerm()` | OK |
| listElections | Session only | Missing role exclusion for `user` |
| getElection | Session only | Missing role exclusion for `user` |
| updateNomineeStatus (hand-wired) | `authMiddleware()` + self-or-officer check | OK |
| castVote (dead) | Session + BR-33 active membership | Would be correct if reachable |
| createNominee (dead) | Session + BR-34 three-condition check | Would be correct if reachable |

## Summary

M12 has a solid foundation — the schema, repo layer, state machine, and domain logic are well-engineered. DB constraints (unique vote index, date ordering checks, FK cascades) demonstrate careful design. BR-33/BR-34 business rule implementations are thorough.

**However, the module is functionally incomplete for its core purpose.** The two defining capabilities of an elections module — nominating candidates and casting votes — have handler implementations that are dead code with no HTTP route. This is the most severe finding.

**Regression from prior audit:** The live `association:member/certifyElection.ts` is simpler than the legacy `elections/certifyElection.ts` — it publishes results but does not perform the cross-module officer transition (create new terms, end outgoing, generate checklists). WF-079 regressed during TypeSpec migration.

### Priority Remediation

**P1 — Must fix (blocks core functionality):**
1. Register `castVote` and `createNominee` as routes (TypeSpec or hand-wire)
2. Fix `electionType` enum mismatch (DB vs TypeSpec validators)
3. Emit domain events from live handlers (at minimum `ElectionPublished` for M04)
4. Add `updateNomineeStatus` to TypeSpec/OpenAPI for SDK discoverability

**P2 — Should fix:**
5. Restore officer transition logic in live `certifyElection` (WF-079)
6. Add `withdrawn` to `nomineeStatusEnum`
7. Evaluate `passageThreshold` for bylaw elections in certify flow
8. Expand `createElection` auth to include admin/super roles
9. Add role-based filtering to list/get endpoints

**P3 — Nice to have:**
10. Automated voting period close (scheduled job on `votingCloseAt`)
11. 2FA enforcement (platform-wide gap)
12. Duplicate nomination prevention (DB unique constraint)


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
