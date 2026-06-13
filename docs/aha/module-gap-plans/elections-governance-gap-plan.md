# AHA Module/Group Gap Plan: Elections & Governance

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Elections & Governance |
| Module slug | elections-governance |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/elections-governance-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m12-elections-governance/MODULE_SPEC.md` + `docs/product/modules/m12-elections-governance.md` |
| Supporting PRDs/specs used | `docs/product/MODULE_SPEC.member.governance.md`, `docs/quality/R5_ELECTIONS_SCOPE.md`, `docs/quality/R2_GOVERNANCE_SCOPE.md`, `docs/quality/R5_OFFICERS_SCOPE.md`, `docs/product/modules/m12-elections-governance/NAVIGATION_MAP.md`, `docs/quality/HAND_WIRED_ROUTES.yaml`, `services/api-ts/src/utils/status-transitions.ts` |
| PRD/spec coverage quality | Strong (m12 spec is detailed: workflows, BRs, ACs, state machine, screens) |
| Paths inspected | `services/api-ts/src/handlers/member/governance/` (34 files), `services/api-ts/src/handlers/elections/` (20 files), `services/api-ts/src/handlers/association:member/` (transitionOfficerTerm, governance repos/schema), `specs/api/src/association/member/governance.tsp`, `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts`, `services/api-ts/src/core/domain-event-consumers.ts`, `services/api-ts/src/seed/layer-3-modules.ts`, `layer-5-gap-fill.ts`, `layer-6-states.ts`, `services/api-ts/src/generated/migrations/` (0012, 0019, 0026, 0028, 0031), `apps/memberry/src/features/elections/` (14 components), `apps/memberry/src/routes/_authenticated/org/$orgSlug/{elections,governance,officer}/`, `specs/api/tests/contract/*.hurl` (8 election/governance files), `apps/memberry/tests/e2e/` (6 election specs) |
| PRDs/specs inspected | m12 MODULE_SPEC (sections 1–22), m12 overview (BR-33/34, M12-R1), MODULE_SPEC.member.governance (sections 1–10), R2/R5 scope docs |
| KG used | Yes (status notes only — `docs/aha/kg/knowledge-graph-status.md`; per its guidance, direct code inspection was primary; KG not queried directly) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes only — product docs richer per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No — static review sufficient; browser tooling skipped for batch run |
| Playwright/E2E inspected | Yes (inspected only; not executed) |
| Existing tests inspected | 8 unit test files in `member/governance/`, 14 test files in legacy `handlers/elections/`, 6 E2E specs, 8 Hurl files |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | Static review sufficient; browser tooling skipped for batch run. No tests executed; runtime FK failures inferred from migrations + handler code (marked `[NEEDS CONFIRMATION]` where appropriate). br-registry.json election entries not parsed (jq filter returned empty); coverage pointers taken from m12 spec §5 instead. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| m12 Module Spec | `docs/product/modules/m12-elections-governance/MODULE_SPEC.md` | PRD/module spec | Current | Primary: workflows WF-076–079, BRs (BR-33/34/67, M12-R1–R6, BR-44, BR-50), ACs AC-M12-001–006, entities, state machine, screens, test expectations |
| m12 Overview | `docs/product/modules/m12-elections-governance.md` | PRD | Current | BR rationale + examples (BR-33 Grace/Lapsed visibility, M12-R1 finality), UX states table |
| Handler-level spec | `docs/product/MODULE_SPEC.member.governance.md` | module spec | Partially stale | Bounded context, 26 operationIds, seams. §5 wrongly claims `governance.schema` holds `elections`, `candidates`, `ballots` tables (they live in `handlers/elections/repos/elections.schema.ts` as `election`, `election_nominee`, `election_vote`) |
| R5 Elections scope | `docs/quality/R5_ELECTIONS_SCOPE.md` | implementation note | Current | Confirms legacy `handlers/elections/*.ts` handlers orphaned; repos/schema live |
| R2 Governance scope | `docs/quality/R2_GOVERNANCE_SCOPE.md` | implementation note | Current | Contract surface (26 ops), consumer map, 7 orphan TypeSpec interfaces |
| R5 Officers scope | `docs/quality/R5_OFFICERS_SCOPE.md` | implementation note | Current | transitionOfficerTerm deliberately hand-wired; listOfficerTermsSummary owned by credits |
| Navigation map | `docs/product/modules/m12-elections-governance/NAVIGATION_MAP.md` | UI map | Current | 7 memberry routes; all exist |
| State machine util | `services/api-ts/src/utils/status-transitions.ts:103-109` | code reference | Current but unused | `ELECTION_VALID_TRANSITIONS` defined; not imported by any election handler |
| Hand-wired allowlist | `docs/quality/HAND_WIRED_ROUTES.yaml:80-81` | API contract | Current | Officer transition route documented; flags app.ts:481 comment as stale |

## 3. Expected vs Actual

**Expected (m12 spec):** Officer/President creates an election (draft) → opens nominations → members nominated (BR-34: active + minimum tenure) → nominations close → voting opens (≥2 accepted candidates/position, M12-R6) → active members cast one secret ballot per position (BR-33, BR-67) → voting closes → President reviews tallies → publishes/certifies (M12-R1/M12-R2 immutable) → winners auto-assigned officer terms with transition checklists (BR-44, WF-079) → members notified. Cancellation at any pre-published stage voids votes and notifies members (M12-R3). Bylaw elections ratify amendments with Yes/No/Abstain and passage threshold (WF-078).

**Actual:** The live surface is the 26 TypeSpec-generated operations under `/association/member/{positions,officer-terms,elections,candidates,ballots}` (handlers in `services/api-ts/src/handlers/member/governance/`), persisting to the **legacy** `handlers/elections/repos/elections.schema.ts` tables plus governance tables (`position`, `officer_term`, `transition_checklist`). Create→open-nominations→nominate→open-voting→vote→certify→officer-term-cascade is implemented in code, **but the state machine has a dead end (no operation moves `votingOpen → awaitingConfirmation`, which `certifyElection` requires) and the election's position identity is broken (jsonb position slots with random UUIDs vs `position` table FK on nominees/votes)** — so the full officer-run lifecycle cannot complete through the product. Cancellation exists only in an orphaned legacy handler with no live route. Ballot privacy and member status-based visibility are weaker than spec. Officer terms + transition checklist + hand-wired `transitionOfficerTerm` (President-only) are solid. The four legacy handlers in `handlers/elections/` (`castVote`, `createNominee`, `updateElectionStatus`, `updateNomineeStatus`) are dead code with live tests, confirmed orphaned by R5_ELECTIONS_SCOPE §A.4.

Bylaw ratification is approximated (nominee-vote + `passageThreshold` % of voter count in `certifyElection.ts`) rather than the spec's Yes/No/Abstain model `[NEEDS PRODUCT DECISION]`. BR-34 minimum tenure is not implemented (active-status check only) `[NEEDS PRODUCT DECISION]`.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-076 Create & Run Election (P0) | Full lifecycle draft → published | createElection/openElectionNominations/openElectionVoting/certifyElection exist, but no op for votingOpen→awaitingConfirmation; min-candidate check keyed on jsonb ids never matches nominee position ids | `election-detail.tsx:145,206-230` "Close Voting" button calls certify | `member/governance/certifyElection.ts:49` requires `awaitingConfirmation`; no handler sets it; `validators.ts` `ElectionCreateRequestUpdateSchema` has no `status` | `election` table status enum has the state | `certifyElection.test.ts:120` proves 422 in votingOpen; seeds bypass via raw SQL (`layer-6-states.ts:100`) | Partially Implemented | Yes — P0 |
| WF-077 Member Votes (P0) | Secret ballot, one vote/position, active members only | `castBallot.ts` enforces BR-33 (computed status), duplicate check + DB unique index | `voting-ballot.tsx`, `vote.tsx` | `routes.ts:756` castBallot | `election_vote_unique` (migration 0026) | `castBallot.test.ts` (9 tests), legacy `castVote.test.ts` | Implemented (backend); ballot secrecy + "already voted" UX gaps (see §10 G3) | Yes — P1 |
| WF-078 Bylaw Ratification (P1) | Yes/No/Abstain vote, threshold, pass/fail | Bylaw = nominee election with `passageThreshold` % of voterCount (`certifyElection.ts` winner loop); no Yes/No/Abstain ballots | `election-form.tsx:164` bylaw type + threshold input; no abstain UI | `governance.tsp` ElectionType.bylaw | `election.passage_threshold` | none for bylaw path | Partially Implemented | Yes — P2 `[NEEDS PRODUCT DECISION]` |
| WF-079 Election→Officer Transition (P1) | Winners auto-assigned; old terms ended; checklists | `election.published` consumer (`core/domain-event-consumers.ts:967-1026`): ends outgoing term, creates checklists, creates new active term, emits officer.transitioned/assigned | officers page reads terms | `certifyElection.ts:96` emits event | `officer_term`, `transition_checklist` | `journeys/election-officer-transition.spec.ts` (view-level) | Implemented (fire-and-forget, non-transactional) | Minor — P2 |
| BR-33 Voting eligibility (Active, real-time) | Grace/Lapsed/Suspended cannot vote; Grace sees details, Lapsed only published results | castBallot computes status at vote time (`withComputedStatus`). Visibility tiers NOT enforced server-side: `listElections.ts` returns all statuses incl. draft to members; member filter is client-side (`member-election-list.tsx:57`); `getElection.ts` has no membership/status check | `member-election-detail.tsx` ineligible messaging exists | `castBallot.ts:70-79` | — | `castBallot.test.ts`; e2e `election-integrity.spec.ts:74` | Partially Implemented | Yes — P1/P2 |
| BR-34 Nomination eligibility (Active + min tenure, per-org config) | Tenure + active checks during window | `createCandidate.ts` checks window + active status; no tenure, no org config | nominee/self-nomination dialogs | `createCandidate.ts:31-60` | — | `createCandidate.test.ts` (10), legacy br-34 tests | Partially Implemented | Yes — P2 `[NEEDS PRODUCT DECISION]` |
| BR-67 / M12-R1 / AC-M12-001 One vote per voter/position/election | ConflictError on duplicate + unique constraint | `castBallot.ts:107-110` hasVoted check; `election_vote_unique` index | already-voted check broken (see G3) | `routes.ts:756` | migration 0026 | `castBallot.test.ts`; **no contract test casts a ballot** | Implemented but Untested (contract) | Yes — P1 `[TEST GAP]` |
| M12-R2 / AC-M12-003 Result immutability | Published election unmodifiable | `updateElection.ts` has NO status guard — PATCH title/dates/positions allowed on published election; certify is the only status path and re-certify blocked | edit route exists `officer/elections/$electionId/edit.tsx` | `updateElection.ts:34-44` (no state check) | — | none | Missing | Yes — P1 |
| AC-M12-004 State machine enforcement | Invalid transitions rejected | Enforced per-op (draft-only open-nominations, nominationsOpen-only open-voting, awaitingConfirmation-only certify). `ELECTION_VALID_TRANSITIONS` util exists but unused; updateElection bypass not possible only because `status` absent from update schema | — | `openElectionNominations.ts`, `openElectionVoting.ts`, `certifyElection.ts:49`; `utils/status-transitions.ts:103-109` | status enum | `elections-lifecycle.test.ts` (legacy), certify tests | Partially Implemented | Yes — part of P0 G1 |
| M12-R3 / AC-M12-006 Cancellation cascade | Cancel → votes voided, members notified, ElectionCancelled event | No live cancel operation. `governance.tsp` has no cancel op; update schema can't set status; frontend has no cancel control (`election-detail.tsx:206` only hides actions when already cancelled). Cascade exists only in orphaned `handlers/elections/updateElectionStatus.ts` | none | no route | status enum has `cancelled` | `cancellation-cascade.test.ts` covers ORPHANED handler only | Missing (live surface) | Yes — P1 |
| M12-R4 Nomination cutoff | No nominees after close | `createCandidate.ts:34-38` window check | dialogs gated by status | same | — | tests exist | Implemented | No |
| M12-R5 Hybrid voting unified tally | Online + in-person counted | `votingMode` stored only; no in-person vote recording op | form offers mode | `createElection.ts` | `voting_mode` enum | none | Missing | Yes — V2 `[NEEDS PRODUCT DECISION]` |
| M12-R6 / AC-M12-005 Minimum candidates guard | Block transition when a position has <2 accepted nominees | Implemented at open-voting (not close-voting per AC); counts keyed on `election.positions` jsonb ids which never match nominee `positionId` (governance `position` table FK) → guard malfunctions; counts include declined nominees | — | `openElectionVoting.ts` (jsonb keying) | FK `election_nominee_position_id_position_id_fk` (migration 0031) | `openElectionVoting.test.ts` (6, with mocked repos using matching fake ids) | Partially Implemented (defective) | Yes — part of P0 G2 |
| BR-44 Certification cross-module effects | End terms, new terms, checklists, role propagation | Implemented via `election.published` consumer; permissions propagate because officer checks read `officer_term` live | — | `domain-event-consumers.ts:967-1026` | governance tables | `certifyElection.test.ts` (10); spec cites nonexistent `handlers/elections/certifyElection.test.ts` | Implemented (reliability caveat) | Minor — P2/P3 |
| BR-50 Date ordering | nominationsClose > open; votingClose > open; votingOpen ≥ nominationsClose, wire-level 400 | DB CHECK constraints exist (`elections.schema.ts:28-31`); contract test is an auth-only stub | form validates | schema checks | migrations | `br-50-election-date-ordering.hurl` (37 lines, **zero election requests**) | Implemented but Untested (contract) | Yes — P1 `[TEST GAP]` |
| Spec §6 Permissions (President-only create/certify; officers manage; members vote) | Per-role gates | createElection + certify + transitionOfficerTerm require President (`requirePosition`); open/update/delete require any officer (`requireOfficerTerm`); castBallot member | — | handlers cited above; `routes.ts:1390` role gate `association:admin` on create | — | `election-role-enforcement.test.ts` (19), certify role tests | Implemented | No |
| Spec §9 Results visibility (officers only until published) | Members see "awaiting confirmation", not tallies | `getElection.ts:28` returns tallies to ANY authenticated caller when status ∈ {awaitingConfirmation, published}; no officer check, no org-membership check | member detail renders what API returns | `getElection.ts:24-40` | — | none | Partially Implemented | Yes — P2 |
| Spec §10b Domain events | election.created/status.changed/published(+cancelled) | created/status.changed/published/deleted emitted; cancelled never (no cancel op) | — | handlers + `domain-events.registry.ts:339` | — | — | Partially Implemented | tied to G4 |
| Spec §12 Test expectations (contract: POST /elections validation, PATCH /status invalid transitions, POST /vote duplicate) | Real contract coverage | `elections-flow.hurl` covers create/list/get only; `assoc-{elections,ballots,officer-terms}-flow.hurl` are auth-only stubs | — | — | — | 8 hurl files inspected | Missing | Yes — P1 `[TEST GAP]` |
| Officer terms CRUD + transitions | Term lifecycle with valid transitions | 10 generated handlers; `updateOfficerTerm.ts` uses `isValidTermTransition` | `officer/officers.tsx` | `routes.ts:1669-1700` | `officer_term` + date-order check | `createOfficerTerm.test.ts` (13), `updateOfficerTerm.test.ts` (8), `governance-flow.hurl` (real) | Implemented | No |
| M4-R3 transitionOfficerTerm (checklist handover) | President-only handover + checklist | Hand-wired route `app.ts:559`; handler complete | no UI found for invoking transition/checklists `[NEEDS CONFIRMATION]` | `transitionOfficerTerm.ts` | `transition_checklist` | `route-protection-handwired.test.ts` | Implemented (API); checklist has no read/complete endpoint | Yes — P2 |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| WF-076 / AC-M12-004 | No API path votingOpen → awaitingConfirmation; "Close Voting" button calls certify and gets 422 | P0 | `V1 REQUIRED` | `election-status.ts:STATUS_TRANSITIONS` votingOpen→awaitingConfirmation; `election-detail.tsx:100-110` else-branch → certifyMut; `certifyElection.ts:49`; `ElectionCreateRequestUpdateSchema` (validators.ts ~11460) has no status | Add `closeElectionVoting` op to `governance.tsp` (POST /elections/{id}/close-voting, officer-gated, uses ELECTION_VALID_TRANSITIONS), regenerate, wire frontend |
| M12-R6 / data model | Election position identity broken: jsonb slots (random UUIDs / seed strings) vs `position` table FK on `election_nominee.position_id` and `election_vote.position_id` | P0 | `V1 REQUIRED` | `createElection.ts:36-40` randomUUID jsonb; migrations 0028/0031 FKs; `openElectionVoting.ts` counts by jsonb id; `seed/layer-3-modules.ts:84` `'["President","Treasurer","Secretary"]'::jsonb` (strings, wrong shape); `nominee-picker-dialog.tsx`/`self-nomination-dialog.tsx` send jsonb slot id as positionId | Decide single source of position identity (recommend: reference governance `position` rows in election positions; or drop the FK and treat slots as module-local) `[NEEDS PRODUCT DECISION on which]`; then align createElection/updateElection, min-candidate check, seeds, frontend |
| M12-R3 / AC-M12-006 | No live cancellation operation; cascade logic stranded in orphaned `handlers/elections/updateElectionStatus.ts` | P1 | `V1 REQUIRED` | `governance.tsp` 26 ops (R2 doc table) — no cancel; `election-detail.tsx` no cancel button; `cancellation-cascade.test.ts` covers dead code | Add `cancelElection` op with vote-void + notification cascade + `election.cancelled` event; port logic/tests from legacy handler |
| M12-R2 / AC-M12-003 | updateElection allows mutating published elections (title/dates/positions); positions regeneration orphans nominee slot references mid-election | P1 | `V1 REQUIRED` | `updateElection.ts:34-47` no state guard; random new UUIDs for positions | Guard: editable only in `draft` (or draft+nominationsOpen minus positions); reject edits on published/cancelled |
| WF-077 secret ballot / spec §9 | `listBallots` exposes raw voterId→nomineeId rows; role-gated `association:admin` yet consumed by member UI for "already voted" → 403, check silently broken | P1 | `V1 REQUIRED` | `listBallots.ts` (returns full rows, no org scope, no voter filter); `routes.ts:764-768` admin-only; `voting-ballot.tsx:70-72`, `member-election-detail.tsx:69-72` raw `api.get('/api/association/member/ballots?...')` | Split: member-callable "my ballots" (filter `voterId = session.user.id`, return existence only) + restrict full listing to aggregate tallies; never expose voter→choice mapping |
| Spec §12 contract tests | `assoc-elections-flow.hurl`, `assoc-ballots-flow.hurl`, `assoc-officer-terms-flow.hurl`, `br-50-election-date-ordering.hurl` are auth-preamble stubs with zero module requests | P1 | `V1 REQUIRED` `[TEST GAP]` | wc -l: 25/24/24/37 lines; grep of HTTP verbs shows only `/csrf-token` + `/auth/sign-up`; file headers describe flows that don't exist | Implement the described flows: lifecycle transitions incl. invalid-transition 422s, duplicate-vote 409/422, BR-50 PATCH 400 |
| BR-33 visibility tiers | Draft elections returned to members; Grace/Lapsed visibility enforced only client-side | P2 | `V1 RECOMMENDED` | `listElections.ts` (no status-based role filter); `member-election-list.tsx:57` client filter; `getElection.ts` no membership check | Server-side filter: non-officers get MEMBER_VISIBLE statuses only; getElection scoped to org members |
| Spec §9 results visibility | Tallies visible to all members during awaitingConfirmation | P2 | `V1 RECOMMENDED` | `getElection.ts:28` | Gate tallies on officer term until published |
| BR-34 tenure | Minimum-tenure + per-org config not implemented | P2 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | `createCandidate.ts` active-only | Defer until org-config infra defined |
| WF-078 | Yes/No/Abstain bylaw ballots + turnout display absent | P2 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | `certifyElection.ts` nominee-threshold approximation | Product decision on bylaw model first |
| M12-R5 | Hybrid/in-person vote recording absent | P2 | `V2 DEFERRED` | `votingMode` stored only | Defer |
| Spec §13 edge cases (tie) | Tie = silent first-max winner in certify | P2 | `V1 RECOMMENDED` `[NEEDS PRODUCT DECISION]` | `certifyElection.ts` `t.count > current.count` | Surface ties to President instead of silently picking |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| 7 orphan TypeSpec interfaces in `governance.tsp` (Committee*, Motion*, MeetingMinutes*, BoardMeeting*, BoardResolution*) | R2_GOVERNANCE_SCOPE "orphan defs with zero registered routes and zero handler files" | m19 committees live elsewhere (`association:operations`) | Contract-surface confusion | Keep but clarify; do not expand `[DO NOT OVERBUILD]` |
| Legacy handlers `handlers/elections/{castVote,createNominee,updateElectionStatus,updateNomineeStatus}.ts` + 12 co-located test files | R5_ELECTIONS_SCOPE §A.3/§A.4: zero live imports | Explicitly deferred dead code | False BR coverage confidence (m12 spec §5 cites `castVote.test.ts` for BR-67) | Consider removal later (after porting cancellation-cascade tests); re-point BR coverage to live tests |
| `election.deleted` domain event | `deleteElection.ts:840` emits; not in spec §10b | Not in PRD | Low | Keep |
| `updateCandidate`, `deleteCandidate`, `deletePosition`, `deleteOfficerTerm` CRUD | generated handlers | Generic CRUD beyond spec | Low | Keep; do not expand |
| `positions`/`officer-terms` full CRUD at national/regional/chapter levels | `governance.schema.ts` positionLevelEnum | Spec mentions positions implicitly | Low | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-076 Create & run election | President/Officer | Election season | create → open nominations → close nominations → open voting → close voting → certify | Broken at "close voting" (no op) and at nomination/vote position identity | Yes (P0×2) | §5 G1, G2 |
| WF-077 Member votes | Active member | Voting open | view ballot → select per position → submit → confirmation | Backend solid; "already voted" check 403s; ballot privacy weak | Yes (P1) | §5 G5 |
| WF-078 Bylaw ratification | Officer/Member | Bylaw proposal | propose → vote yes/no/abstain → threshold check | Approximated via nominee election | Yes (P2, deferred) | §5 |
| WF-079 Election→officer transition | System | election.published | end old terms → checklists → new terms → notify | Implemented as event consumer; fire-and-forget, non-transactional | Minor (P2) | `domain-event-consumers.ts:967-1026` |
| M4-R3 manual officer handover | President | Term end/resignation | transition with checklist items | Implemented (hand-wired); checklist items write-only (no read/complete API) | Yes (P2) | `transitionOfficerTerm.ts`; `governance.repo.ts:122-140` (repo has finders; no handler uses them) |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Create election (President) | Draft with positions, dates, type | Implemented | `createElection.ts` (requirePosition President; BR-50 DB checks) | `V1 REQUIRED` | Position jsonb identity defect (G2) taints downstream |
| Open nominations | draft→nominationsOpen, officer | Implemented | `openElectionNominations.ts` (requireOfficerTerm, draft-only) | `V1 REQUIRED` | — |
| Nominate (self/other) | Active member, window-gated | Partially Implemented | `createCandidate.ts`; FK `election_nominee_position_id_position_id_fk` vs jsonb slot id → insert fails for UI-created elections `[NEEDS CONFIRMATION at runtime]` | `V1 REQUIRED` | E2E never submits the dialog (`election-nominations.spec.ts:159-180` opens then cancels) |
| Accept/decline nomination | Nominee or officer; transition matrix | Implemented | `updateCandidateStatus.ts` VALID_NOMINEE_TRANSITIONS | `V1 REQUIRED` | DB `nominee_status` enum = {nominated, accepted, declined, elected}; TypeSpec CandidateStatus also has `withdrawn`, `notElected` → DB enum violation if those transitions allowed `[NEEDS CONFIRMATION]` |
| Open voting (≥2 candidates/position) | nominationsOpen→votingOpen | Partially Implemented (defective) | `openElectionVoting.ts` jsonb-keyed count; counts non-accepted nominees | `V1 REQUIRED` | Part of G2 |
| Cast ballot | Active member, one per position | Implemented | `castBallot.ts` + unique index | `V1 REQUIRED` | No `votingCloseAt` time check (status only); no nominee-status=accepted check |
| Close voting | votingOpen→awaitingConfirmation | Missing | no handler; no job; update schema lacks status | `V1 REQUIRED` | P0 G1 |
| Certify/publish | President, tallies, winners | Implemented | `certifyElection.ts` | `V1 REQUIRED` | Tie handling silent; losers never marked notElected |
| Officer-term cascade | End terms, checklists, new terms | Implemented | consumer :967-1026 | `V1 REQUIRED` | Non-transactional; failure logged only |
| Cancel election | Void votes, notify | Missing (live) | orphaned `updateElectionStatus.ts` only | `V1 REQUIRED` | P1 G4 |
| View results | Aggregate tallies post-publish; officers earlier | Partially Implemented | `getElection.ts:28` no officer gate pre-publish | `V1 RECOMMENDED` | — |
| Manual term transition + checklist completion | President handover; track items | Partially Implemented | create-only; no list/complete checklist endpoint or UI | `V1 RECOMMENDED` | Checklist data is write-only |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Run a complete officer election end-to-end | President | All steps succeed via UI | Missing (blocked at close-voting + nomination FK) | Yes | `V1 REQUIRED` | §5 G1/G2 |
| Vote once, see "already voted" | Member | Ballot blocked after vote, friendly state | Partially Implemented (backend yes; UI check 403s) | Yes | `V1 REQUIRED` | `routes.ts:764` vs `voting-ballot.tsx:72` |
| Ineligible member messaging (Grace/Lapsed) | Member | See spec-defined banners, no ballot | Partially Implemented (client renders; server over-shares) | Yes | `V1 RECOMMENDED` | `member-election-detail.tsx`; `listElections.ts` |
| Cancel a mistaken election | Officer/President | Cancel with cascade | Missing | Yes | `V1 REQUIRED` | §5 G4 |
| Delete draft/cancelled election | Officer | Allowed; others blocked | Implemented | No | — | `deleteElection.ts:828-833` |
| View published results with winners | All eligible | Tallies + winners | Implemented | No | — | `getElection.ts`, `election-detail.tsx:152` |
| Manage positions & officer terms | Officer | CRUD + valid transitions | Implemented | No | — | 10 handlers + tests |
| Handover officer role with checklist | President | Transition + track checklist | Partially Implemented (no checklist read/complete) | Yes | `V1 RECOMMENDED` | `governance.repo.ts:122-140` unused finders |
| Audit trail of election actions | Compliance | x-audit on mutations | Implemented | No | — | `routes.ts:1392,758,773` per-route audit middleware |
| Bylaw ratification | Officer/Member | Yes/No/Abstain + threshold | Partially Implemented | Yes | `V2 DEFERRED` | §5 |
| In-person/hybrid vote capture | Officer | Record offline votes | Missing | Yes | `V2 DEFERRED` | §5 |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| **G1: State-machine dead end — nothing transitions votingOpen → awaitingConfirmation** | backend + frontend | **P0** | `V1 REQUIRED` | `certifyElection.ts:49` requires awaitingConfirmation; only setters of election.status are openElectionNominations/openElectionVoting/certifyElection/deleteElection; `ElectionCreateRequestUpdateSchema` has no `status`; no job reads `votingCloseAt`; frontend "Close Voting" (`election-status.ts` STATUS_TRANSITIONS) routes to `certifyMut` (`election-detail.tsx:106-110`) → 422 per `certifyElection.test.ts:120`; seeds inject the state via raw SQL (`layer-6-states.ts:100`) which is how tests/E2E see it | A real election run through the product can never be certified — the module's trust-critical core workflow cannot complete | New `closeElectionVoting` op (officer-gated, votingOpen-only, applies ELECTION_VALID_TRANSITIONS); optionally a scheduled job honoring `votingCloseAt`; fix frontend mapping |
| **G2: Dual position identity — election jsonb slots vs governance `position` table FKs** | schema + backend + frontend + seed | **P0** | `V1 REQUIRED` | `createElection.ts:36-40` random-UUID jsonb slots; migration 0031 `election_nominee_position_id_position_id_fk` → `position(id)`; migration 0028 same for `election_vote`; UI sends slot id as `positionId` (`election-detail.tsx:306` → `nominee-picker-dialog.tsx:55`; `member-election-detail.tsx:368`); `openElectionVoting.ts` min-candidate count keyed by slot ids; seed `layer-3-modules.ts:84` stores `["President","Treasurer","Secretary"]` (strings — wrong shape); seed `layer-5-gap-fill.ts:154-157` creates nominees with REAL position-table ids that don't match slot ids | Nomination/vote inserts for UI-created elections violate the FK (5xx); min-candidate guard can never pass; nominee/tally grouping by position misrenders for seeded data. Untested because unit tests mock repos with self-consistent fake ids and E2E never submits | Pick one identity: (a) require electing against real `position` rows (replace jsonb slot creation with position refs) or (b) drop FKs and keep slots module-local. Then align openElectionVoting keying, seeds, and dialogs. Add a real-DB integration test for create→nominate→vote |
| G3: Ballot privacy + broken "already voted" check | API + frontend | P1 | `V1 REQUIRED` | `listBallots.ts` returns raw `election_vote` rows (voterId, nomineeId), no org scoping, no voter filter, limit 100 no pagination; route `routes.ts:764-768` admin-only; member UI calls it (`voting-ballot.tsx:70-72`, `member-election-detail.tsx:69-72` — comment "SDK type gap") | Secret-ballot violation (WF-077): admins can read who voted for whom; member-facing already-voted state silently fails (403) so members resubmit and hit raw DUPLICATE_VOTE errors | "My ballots" member endpoint (voter-scoped, choice-free) + restrict/aggregate the admin listing; fix SDK typing so raw `api.get` isn't needed |
| G4: No live cancellation; cascade stranded in dead code | API + frontend | P1 | `V1 REQUIRED` | no cancel op in governance.tsp 26-op table (R2 doc); `cancellation-cascade.test.ts` exercises orphaned `handlers/elections/updateElectionStatus.ts`; deleteElection requires draft/cancelled → in-flight elections immortal | M12-R3/AC-M12-006 are P0-priority spec rules; an election with a mistake mid-voting cannot be stopped | `cancelElection` op + vote-void + notification + `election.cancelled` event; port legacy tests |
| G5: updateElection lacks state/immutability guards; regenerates position ids | API | P1 | `V1 REQUIRED` | `updateElection.ts:34-47` | Violates M12-R2 result finality; editing positions mid-election orphans nominee references (compounds G2) | Allow edits only in draft; freeze positions once nominations open |
| G6: Contract-test stubs masquerading as coverage | tests | P1 | `V1 REQUIRED` `[TEST GAP]` | `assoc-elections-flow.hurl` (25 ln), `assoc-ballots-flow.hurl` (24 ln), `assoc-officer-terms-flow.hurl` (24 ln), `br-50-election-date-ordering.hurl` (37 ln) — auth-only despite headers describing full CRUD/ballot/BR-50 flows | Spec §12 contract expectations unmet; CONTRACT_COVERAGE may count these as present; G1/G2 would have been caught by a real lifecycle hurl | Implement the described flows before/with fixes (RED first) |
| G7: Server over-shares election data (draft to members; tallies pre-publish; cross-org getElection) | API | P2 | `V1 RECOMMENDED` | `listElections.ts` no role-based status filter; `getElection.ts` no org-membership check, tallies at awaitingConfirmation | BR-33 visibility tiers + spec §9 are trust requirements; current enforcement is client-side only | Server-side visibility filter + org scoping |
| G8: election.published consumer non-transactional, fire-and-forget | backend | P2 | `V1 RECOMMENDED` | `domain-event-consumers.ts:971-1026` single try/catch, error logged only; election already `published` | Partial failure = published election with stale officer roster and no retry | Wrap winner loop in a transaction; consider retry/alert path |
| G9: castBallot ignores nominee status + voting window time | backend | P2 | `V1 RECOMMENDED` | `castBallot.ts` (no `status==='accepted'` check, no `votingCloseAt` check) | Votes for declined nominees count; voting continues past close date until manual transition (which currently can't happen — see G1) | Add accepted-status + time checks alongside G1 fix |
| G10: Candidate status enum drift DB vs contract | schema | P2 | `V1 RECOMMENDED` `[NEEDS CONFIRMATION]` | `elections.schema.ts` `nominee_status` = {nominated,accepted,declined,elected}; `governance.tsp` CandidateStatus adds `withdrawn`,`notElected` | API accepts statuses the DB enum rejects → 500 on transition to withdrawn | Align enum (migration) or constrain contract |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Officer clicks "Close Voting" on `/org/$orgSlug/officer/elections/$electionId` | Election moves to Awaiting Confirmation | POST /elections/{id}/certify → 422 INVALID_STATUS_TRANSITION → error toast; election stuck in votingOpen forever | `election-detail.tsx:106-110,228-230`; `certifyElection.test.ts:120` | P0 | E2E: full lifecycle create→…→certify against real API (no seeded state injection) |
| Officer nominates member via "Add" dialog on UI-created election | Nominee created | createCandidate insert hits `election_nominee_position_id_position_id_fk` violation → 5xx `[NEEDS CONFIRMATION at runtime]` | `nominee-picker-dialog.tsx:55` slot id; migration 0031 | P0 | Integration test: createElection (API) → createCandidate (API) on real DB |
| Member returns to ballot after voting | "You have already voted" + timestamp | GET /ballots → 403 (admin-only role gate) → check silently fails → ballot rendered → submit → DUPLICATE_VOTE error | `routes.ts:764-768`; `voting-ballot.tsx:70-72` | P1 | Component/E2E: voted member revisits vote page |
| Officer wants to cancel a live election | Cancel with confirmation, votes voided, members notified | No cancel control anywhere; API has no cancel op | `election-detail.tsx` (no cancel UI); governance.tsp op table | P1 | Contract + E2E once cancelElection exists |
| Officer opens voting with 2+ nominees per position | Transition succeeds | INSUFFICIENT_CANDIDATES (counts keyed on jsonb slot ids that never match nominee positionIds) `[NEEDS CONFIRMATION at runtime]` | `openElectionVoting.ts` count loop; seed shapes | P0 (same root as G2) | Integration test with real rows |
| Member browses elections list | Only nominationsOpen/votingOpen/awaitingConfirmation/published visible | API returns drafts too; hidden only by client filter | `listElections.ts`; `member-election-list.tsx:57` | P2 | Backend test: member role sees no drafts |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `handlers/elections/{castVote,createNominee,updateElectionStatus,updateNomineeStatus}.ts` | dead handlers | R5_ELECTIONS_SCOPE §A.4: zero live imports | False confidence: 12 test files exercise unreachable code; BR coverage pointers cite them | Remove after porting cancellation tests; re-anchor BR-33/34/67 coverage to live tests |
| `ELECTION_VALID_TRANSITIONS` in `utils/status-transitions.ts:103-109` | unused util | grep: no election handler imports it (dues/booking/marketplace use their tables) | State matrix exists but isn't enforced centrally | Use it in the G1/G4 fixes |
| `TransitionChecklistRepository.findByTerm/findPending` | unused repo methods | `governance.repo.ts:131-140`; no handler/route reads checklists | Checklist data write-only — feature half-shipped | Add list/complete endpoints (V1 RECOMMENDED) or descope |
| 7 orphan governance.tsp interfaces (Committee/Motion/Minutes/Board*) | unwired contract | R2_GOVERNANCE_SCOPE | Contract bloat | Keep, do not expand `[DO NOT OVERBUILD]` |
| `CandidateStatus.notElected` | dead enum value | certifyElection only sets `elected`; DB enum lacks it | Losers stay `accepted` forever | Set notElected at certification (with G10 enum alignment) |
| `assoc-*.hurl` + `br-50` stubs | dead tests | §10 G6 | Fake coverage | Implement or delete |
| app.ts:481 comment "m12 elections/: entirely hand-wired" | stale comment | `HAND_WIRED_ROUTES.yaml:14-19` calls it out | Misleads future readers | Fix comment in a doc-sync batch |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Election/candidate/ballot data lives in legacy module's schema (`handlers/elections/repos/elections.schema.ts`) while handlers live in `member/governance/` — cross-module repo import is the norm (`@/handlers/elections/repos/elections.repo` in 10+ governance handlers) | schema/model | castBallot.ts:37 etc.; R5 doc "repos LIVE" | P3 (by design, documented) | Keep until mega-module re-scope; fix MODULE_SPEC.member.governance §5 doc |
| `election.positions` jsonb dual identity vs `position` table FK (G2) | schema/model | migrations 0028/0031; createElection.ts | P0 | §10 G2 |
| Seed shape drift: layer-3 stores `string[]` in positions jsonb, schema types it `{id,title,sortOrder}[]` | seed data | `layer-3-modules.ts:84` vs `elections.schema.ts` $type | P2 | Align seeds with chosen identity model |
| `nominee_status` DB enum missing `withdrawn`/`notElected` present in contract | schema/migration | `elections.schema.ts:9` vs governance.tsp CandidateStatus | P2 `[NEEDS CONFIRMATION]` | Migration to align |
| `UpdateElectionBody` cannot carry status — accidentally prevents state-machine bypass but also blocks any close/cancel workaround | API | validators.ts `ElectionCreateRequestUpdateSchema` | Info (root of G1/G4) | Solve via explicit transition ops, not by adding status to PATCH |
| listBallots: no pagination envelope, hard limit 100, no org scoping | API | `listBallots.ts` | P2 | Part of G3 fix |
| getElection responds with DB+alias double fields (nominationsOpenAt and nominationStart) | API | `getElection.ts:31-38` | P3 | Normalize in SDK transformer pass |
| `election_vote` rows persist after cancellation would occur via future cancel op; FK `ON DELETE cascade` only on electionId | schema | migration 0019:855 | Info | Design vote-void semantics in G4 (soft-void vs delete) |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Ballot secrecy: voter→choice mapping readable by `association:admin` via listBallots | vote privacy | `listBallots.ts`; routes.ts:764 | P1 | §10 G3 |
| listBallots role gate breaks member self-check (403) | role mismatch | routes.ts:764 vs voting-ballot.tsx:72 | P1 | §10 G3 |
| getElection: no org-membership check — any authenticated user with an election UUID reads nominees + tallies cross-org | tenant isolation | `getElection.ts` (session check only) | P2 | Org-scope the read; e2e `election-integrity.spec.ts:120` covers list-level only |
| Draft elections visible to members via API | visibility tiers | `listElections.ts` | P2 | Server-side filter |
| President-only guards on create/certify/transition implemented via inline `requirePosition` instead of `x-require-position` extension (CLAUDE.md P1.5 says prefer extensions for static cases) | enforcement pattern drift | `createElection.ts:23`, `certifyElection.ts:34-45`, `transitionOfficerTerm.ts` | P3 | Migrate to extensions when touching these handlers; certify's dynamic org-from-resource lookup is a legitimate inline case |
| Positive: per-route audit middleware present on all election mutations | audit | routes.ts:1392, 758, 773 | — | Keep |
| Positive: castBallot recomputes membership status at vote time (BR-33 real-time rule) | eligibility | `castBallot.ts:70-79` | — | Keep |

## 15. Record Safety / Audit History Findings

Module handles governance-legitimacy records (votes, results, officer terms) — record-sensitive.

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Published election rows remain mutable via PATCH (title/dates/positions) — official record can be silently altered | result finality | `updateElection.ts` no state guard | P1 | §10 G5 |
| deleteElection hard-deletes the row; FK cascade removes nominees (and votes via election FK) — for cancelled elections this destroys the vote record the spec says deletion should preserve ("must be cancelled first (preserves the audit/vote record)" then delete erases it) | vote record retention | `deleteElection.ts:835` `db.delete(elections)`; migrations cascade | P2 `[NEEDS PRODUCT DECISION]` | Decide retention policy for cancelled-election votes before enabling cancel+delete path |
| Audit events: certify sets auditDetails {voterCount, tallies, winners} — good official record | audit trail | `certifyElection.ts:312-314` | — | Keep |
| voterId stored raw in election_vote; spec observability says hash voterId in logs — verify log fields `[NEEDS CONFIRMATION]` | PII in logs | m12 spec §17 | P3 | Check pino serializers during fix phase |

## 16. Knowledge Graph Findings

KG used as background only (status file guidance: rely on direct inspection; KG 5 days stale). Wiring below verified by code, consistent with KG module boundaries.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Governance handlers depend on legacy elections repo (cross-module seam) | 10+ imports of `@/handlers/elections/repos/elections.repo` | Any schema relocation (mega-module split) hits this module first | `[CROSS-MODULE RISK]` — note for split re-scope |
| `core/auth/officer-checks.ts` + `core/domain-event-consumers.ts` + `core/ports` + seeds all import governance repos/schema | R2_GOVERNANCE_SCOPE consumer map (verified by grep) | Blast radius of governance schema changes is platform-wide | `[SHARED DEPENDENCY]` — keep repos at `association:member/repos/` per R2 decision |
| `listOfficerTermsSummary` (GET /officer-terms/:orgId) is credits-owned, not governance | `credits.tsp:139`; `officer-terms-summary-flow.hurl` | Don't double-audit | Out of scope here |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Election legitimacy is the module's core value (M12-R1 "Finality is the foundation of governance legitimacy") | m12 overview BR section | G1/G2/G5 directly attack legitimacy: lifecycle can't complete and records are mutable | Prioritize G1/G2/G5/G3 as one trust bundle |
| BR-33 ties eligibility to real-time dues status (cross-module: membership/dues) | m12 overview BR-33 examples | castBallot correctly recomputes; visibility tiers don't | `[CROSS-MODULE RISK]` — visibility fix must reuse `withComputedStatus` |
| Officer-role propagation is event-driven into RBAC (officer checks read `officer_term` live) | consumer + officer-checks | Certify cascade failure = stale permissions | G8 transactionality matters more than it looks |
| PH dental association context: elections are annual, low-volume — no scale concerns; correctness over throughput | MASTER_PRD personas (audit index) | Performance work would be overbuild | `[DO NOT OVERBUILD]` |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; existing Playwright specs inspected statically only.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| E2E election suite never drives a state transition or submits a nomination/ballot — all specs assert visibility of seeded states; president-tally spec self-describes as "minimal smoke" | Playwright (inspected) | `tests/e2e/officer/election-nominations.spec.ts:159-180` (opens dialog, cancels); `cross-persona/president-election-tally.spec.ts:8-29` | P0s G1/G2 invisible to E2E; depth gap on a trust-critical module | Add one full-lifecycle E2E (fresh org fixture noted at spec:25) after fixes |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `member/governance/castBallot.test.ts` (9) | backend/unit | BR-33 eligibility, duplicate vote, nominee/election/position match | High (mocked repos) |
| `member/governance/certifyElection.test.ts` (10) | backend/unit | President-only, state guards (422 from votingOpen/nominationsOpen/draft), publish + publishedAt | High |
| `member/governance/createCandidate.test.ts` (10) | backend/unit | window + eligibility | High |
| `member/governance/openElectionVoting.test.ts` (6) | backend/unit | min-candidate guard — but fake ids are self-consistent, masking G2 | Medium |
| `member/governance/election-role-enforcement.test.ts` (19) | permission/RBAC | role/officer/President gates | High |
| `member/governance/governance.test.ts` (16), `createOfficerTerm.test.ts` (13), `updateOfficerTerm.test.ts` (8) | backend/unit | positions + officer terms CRUD/transitions | High |
| `handlers/elections/*` 12 test files (incl. `cancellation-cascade.test.ts`, `br-33`, `br-34`, `flow-04.election-vote-tally`, `elections-schema.test.ts`) | backend/unit + schema | legacy orphaned handlers + live schema constraints | Low for handler tests (dead code); High for `elections-schema.test.ts` |
| `elections-flow.hurl`, `governance-flow.hurl`, `security-officer-auth.hurl`, `officer-terms-summary-flow.hurl` | contract | create/list/get election; officer-terms list; officer-gate 403s | Medium (shallow) |
| `assoc-elections-flow.hurl`, `assoc-ballots-flow.hurl`, `assoc-officer-terms-flow.hurl`, `br-50-election-date-ordering.hurl` | contract | NOTHING (auth-only stubs) | — (fake) |
| 6 E2E specs (`officer/elections`, `officer/election-integrity`, `officer/election-nominations`, `journeys/election-officer-transition`, `cross-persona/president-election-tally`, `actions/comms-elections-actions`) | E2E | visibility of seeded states, forms, dialogs, role gates | Low-Medium (no mutations) |
| Frontend component tests: `election-detail.test.tsx`, `election-form.test.tsx`, `election-list.test.tsx`, `voting-ballot-confirm.test.tsx` | frontend/component | rendering + form steps | Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Real-DB integration: createElection → createCandidate → openVoting → castBallot (no mocks) | integration | Would have caught G2 FK break and G1 dead end | **Before** (RED) |
| closeElectionVoting op tests (valid from votingOpen; invalid elsewhere) | backend/unit | G1 fix safety | During (TDD) |
| cancelElection cascade (votes voided, event, notify) — port from legacy `cancellation-cascade.test.ts` | backend/unit | G4 fix safety | During |
| updateElection immutability (PATCH published → 422) | backend/unit | G5 | Before |
| listBallots: member my-ballot scoping; admin cannot read voter→choice; cross-org denied | permission/RBAC | G3 | Before |
| Contract: full lifecycle hurl (replace `assoc-elections-flow.hurl` stub), duplicate-vote rejection, BR-50 PATCH 400 (replace stub), invalid transition 422 | contract | Spec §12; G6 | Before/During |
| Server-side member visibility (no drafts; no pre-publish tallies for non-officers) | backend/unit | G7 | During |
| Enum alignment regression (withdrawn/notElected transitions) | data/schema | G10 | During |
| Full-lifecycle E2E with fresh org (create→nominate→vote→close→certify→officer roster updated) | E2E/Playwright | only journey-level proof of WF-076–079 | After backend fixes |
| election.published consumer failure handling (partial winner loop) | backend/unit | G8 | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `governance.repo/schema` consumed by core/auth officer-checks, domain-event consumers, ports, seeds, person, dues, invite, association:operations | shared/platform | R2_GOVERNANCE_SCOPE consumer map | Schema changes ripple platform-wide | `[SHARED DEPENDENCY]` — keep repo location; additive changes only |
| `elections.schema.ts` (legacy dir) consumed by member/governance handlers, seeds, preload-pristine, schema-registry | cross-module | imports verified | G2 fix touches this schema → migration + seed + frontend in one batch | `[CROSS-MODULE RISK]` |
| `position` table FK from election_nominee/election_vote | database/schema | migrations 0028/0031 | Core of G2; dropping vs honoring FK is the design fork | `[NEEDS PRODUCT DECISION]` (identity model) |
| Membership status computation (`withComputedStatus`, `computeMembershipStatus`) | cross-module | castBallot/createCandidate imports from member/membership | BR-33/34 correctness rides on membership module | `[CROSS-MODULE RISK]` — don't fork logic |
| `election.published` consumer ↔ M04 org-admin roles | cross-module | domain-event-consumers.ts:967 | BR-44 propagation | Keep event contract stable (R2: "MUST NOT change event names or payload shapes") |
| TypeSpec → generate pipeline for new ops (close/cancel) | environment/tooling | CLAUDE.md API-first workflow | G1/G4 fixes start in `governance.tsp`, then `bun run build` + `bun run generate` | Follow API-first sequence |
| listOfficerTermsSummary (credits.tsp) | cross-module | R5_OFFICERS_SCOPE §A.1 | Not governance-owned | `[SHARED DEPENDENCY]` — leave to credits audit |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Add `closeElectionVoting` op (TypeSpec → generate → handler using ELECTION_VALID_TRANSITIONS) + frontend mapping | G1 | P0 | `V1 REQUIRED` | unit + contract + E2E | Smallest fix unblocking certification |
| Resolve position identity: elections reference real `position` rows (recommended) OR drop FKs to keep slots local; align createElection/updateElection, openElectionVoting keying, seeds (layer-3 shape), nominee/ballot dialogs | G2 | P0 | `V1 REQUIRED` | real-DB integration test FIRST | Requires product/tech decision; touches schema+seed+frontend `[CROSS-MODULE RISK]` |
| Member-safe "my ballots" + choice-free admin listing; fix SDK type gap | G3 | P1 | `V1 REQUIRED` | RBAC tests | Ballot secrecy |
| `cancelElection` op with cascade ported from legacy handler + tests | G4 | P1 | `V1 REQUIRED` | port cancellation-cascade tests | Then legacy handler can be deleted |
| updateElection state guard (draft-only edits; freeze positions post-draft) | G5 | P1 | `V1 REQUIRED` | unit | Pairs with G2 |
| Replace 4 stub hurl files with real flows | G6 | P1 | `V1 REQUIRED` | contract | RED-first per VERTICAL_TDD |
| Server-side visibility filters (drafts, pre-publish tallies, org scoping on getElection) | G7 | P2 | `V1 RECOMMENDED` | unit | |
| Transactional election.published consumer | G8 | P2 | `V1 RECOMMENDED` | unit | |
| castBallot: accepted-nominee + votingCloseAt checks | G9 | P2 | `V1 RECOMMENDED` | unit | |
| Align nominee_status enum with CandidateStatus (add withdrawn/notElected) + set notElected at certify | G10 | P2 | `V1 RECOMMENDED` | schema test | Confirm runtime behavior first |
| Checklist list/complete endpoints + minimal officer UI | §8 | P2 | `V1 RECOMMENDED` | unit | Or explicitly descope checklist tracking |
| Delete orphaned legacy handlers + re-anchor BR coverage pointers | §12 | P2 | `V1 RECOMMENDED` | — | After G4 port |
| Doc sync: MODULE_SPEC.member.governance §5 tables; m12 §5 BR-44 test path; app.ts:481 comment | docs | P3 | `V1 RECOMMENDED` | — | Cheap, prevents future confusion |
| Tie-handling decision in certify (block or President chooses) | §5 | P2 | `V1 RECOMMENDED` `[NEEDS PRODUCT DECISION]` | unit | |
| Auto-close job honoring votingCloseAt | G1 adjunct | P3 | `V2 DEFERRED` | — | Manual close acceptable for V1 |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Yes/No/Abstain bylaw ballot model + turnout threshold UX | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Current nominee-threshold approximation exists; redesign needs product call on WF-078 semantics |
| Hybrid/in-person vote recording (M12-R5) | `V2 DEFERRED` | No op, no UI, no demand signal; PH pilot is online-first |
| BR-34 per-org minimum-tenure configuration | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Org-config infrastructure for this rule undefined |
| Committee/Motion/Minutes/Board interfaces in governance.tsp | `DO NOT ADD` `[DO NOT OVERBUILD]` | Committees live in m19/association:operations; wiring these would duplicate |
| Election analytics/turnout dashboards, metrics counters from spec §17 | `V2 DEFERRED` | Observability nice-to-have; logs + audit details suffice for V1 |
| Generic election state-machine framework abstraction | `DO NOT ADD` `[DO NOT OVERBUILD]` | `ELECTION_VALID_TRANSITIONS` table + per-op guards are enough |
| Voter-anonymization rearchitecture (hash voterId at rest) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Unique-vote constraint requires voter identity; G3 access fix addresses the practical leak |
| Auto-close scheduled job for votingCloseAt | `V2 DEFERRED` | Manual close-voting op suffices for annual elections |

## 24. Audit Decision

**FAIL**

The module is rich in code and unit tests, but two P0 defects block the core trust-critical workflow end-to-end: (G1) no operation transitions an election from `votingOpen` to `awaitingConfirmation`, so no real election can ever be certified through the product (the frontend "Close Voting" button calls certify and receives the 422 its own unit test documents); and (G2) the election position identity is split between random-UUID jsonb slots and the governance `position` table that nominee/vote FKs require, so UI-driven nomination/min-candidate/voting flows are structurally inconsistent. Both are invisible to the current test suite because unit tests mock repos, contract tests for these flows are auth-only stubs, and E2E only views seeded states. Add P1 gaps (no cancellation, mutable published results, ballot-secrecy/listBallots role break, stub contract files) and reliable V1 use is blocked.

Officer terms, positions, role enforcement, audit middleware, and the certify→officer-term event cascade are in materially good shape — the fix surface is concentrated and tractable.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Which position identity should elections use — governance `position` rows or module-local slots (drop FKs)? | `[NEEDS PRODUCT DECISION]` | Determines the entire G2 fix shape (schema vs handler/frontend) | Product + eng |
| Does nomination via UI actually 5xx on FK violation in a running environment (vs some untested path)? | `[NEEDS CONFIRMATION]` | Confirms G2 severity empirically; static evidence is strong but runtime unverified | Eng (one integration test) |
| Tie in vote tally: block certification, or President picks? | `[NEEDS PRODUCT DECISION]` | certify currently silently crowns first-max | Product |
| Retention of votes for cancelled elections (deleteElection hard-deletes after cancel) | `[NEEDS PRODUCT DECISION]` | M12-R1 record-keeping vs data minimization | Product/compliance |
| Are `withdrawn`/`notElected` candidate transitions reachable today (DB enum lacks them)? | `[NEEDS CONFIRMATION]` | G10 could be latent 500 | Eng |
| Bylaw ratification model: keep nominee-threshold approximation or build Yes/No/Abstain? | `[NEEDS PRODUCT DECISION]` | WF-078 is spec P1 | Product |
| BR-34 minimum-tenure values and per-org config mechanism | `[BLOCKED BY MISSING SPEC]` | Cannot implement tenure check without parameters | Product |
| Do br-registry.json BR-33/34/67 entries point at legacy (dead) test files? | `[NEEDS CONFIRMATION]` | BR coverage gate may be green on dead code | Eng (br-coverage run) |

## 26. Notes for Gap Plan Organizer

- **True V1 blockers (fix order seed):** G1 (close-voting op) and G2 (position identity) are one delivery story — the full lifecycle integration test (RED) should be written first and drives both. G2 needs the identity decision *before* coding; G1 does not and can start immediately.
- **P1 batch:** G3 (listBallots privacy + my-ballot), G4 (cancelElection — port legacy cascade + tests), G5 (updateElection guards), G6 (replace 4 stub hurl files). G4+G5 pair naturally (both are state-machine integrity); G6 should land RED-first alongside each fix.
- **Selected P2s worth pulling into V1 completeness:** G7 server-side visibility, G9 castBallot accepted/time checks (tiny), G10 enum alignment (confirm first), checklist read/complete endpoints (or explicit descope).
- **Tests to write first:** real-DB lifecycle integration test (create→nominate→open-voting→vote→close→certify); updateElection-immutability unit; listBallots RBAC tests; lifecycle hurl.
- **Do not implement yet:** bylaw Yes/No/Abstain redesign, hybrid voting, tenure config, voter-hash rearchitecture, anything touching the 7 orphan TypeSpec interfaces.
- **Product decisions that block fixing:** position identity model (blocks G2), tie handling, cancelled-vote retention, bylaw model.
- **Shared-dependency cautions:** elections.schema changes ripple to seeds/preload-pristine/schema-registry; never change `election.published` payload shape (M04 consumer contract); follow API-first regen pipeline for any new TypeSpec op.
- **Implemented-but-not-in-PRD to leave alone:** orphan committee/board interfaces, extra CRUD ops. Legacy `handlers/elections/` handler files should be deleted only after the cancellation cascade is ported (they are the only living spec of that behavior).
- **Doc-sync cheap wins:** MODULE_SPEC.member.governance §5 table list, m12 §5 BR-44 coverage path, app.ts:481 stale comment.

---

Next recommended step:
Module/group: Elections & Governance
Module slug: elections-governance
Primary PRD/spec: docs/product/modules/m12-elections-governance/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/elections-governance-gap-plan.md
