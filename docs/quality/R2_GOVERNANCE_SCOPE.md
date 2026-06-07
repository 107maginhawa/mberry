# R2 Governance — Scope Pass (R2.1)

Branch: `feature/member-rebuild` @ `fe7f822b`
Generated: 2026-06-07

## Contract surface — `specs/api/src/association/member/governance.tsp`

26 operationIds across 5 wired interfaces (all preserved verbatim per `SDK_BASELINE_OPS.json` freeze).

`governance.tsp` defines 12 interfaces but only 5 are extended in `main.tsp`. The remaining 7 (`CommitteeManagement`, `CommitteeSeatManagement`, `CommitteeMeetingManagement`, `MotionManagement`, `MeetingMinutesManagement`, `BoardMeetingManagement`, `BoardResolutionManagement`) are orphan defs with zero registered routes and zero handler files — out of R2 scope, leave as-is.

| Interface | OperationId | HTTP |
|---|---|---|
| PositionManagement | createPosition | POST /association/member/positions |
| PositionManagement | getPosition | GET /association/member/positions/:positionId |
| PositionManagement | listPositions | GET /association/member/positions |
| PositionManagement | updatePosition | PATCH /association/member/positions/:positionId |
| PositionManagement | deletePosition | DELETE /association/member/positions/:positionId |
| OfficerTermManagement | createOfficerTerm | POST /association/member/officer-terms |
| OfficerTermManagement | getOfficerTerm | GET /association/member/officer-terms/:termId |
| OfficerTermManagement | listOfficerTerms | GET /association/member/officer-terms |
| OfficerTermManagement | updateOfficerTerm | PATCH /association/member/officer-terms/:termId |
| OfficerTermManagement | deleteOfficerTerm | DELETE /association/member/officer-terms/:termId |
| ElectionManagement | createElection | POST /association/member/elections |
| ElectionManagement | getElection | GET /association/member/elections/:electionId |
| ElectionManagement | listElections | GET /association/member/elections |
| ElectionManagement | updateElection | PATCH /association/member/elections/:electionId |
| ElectionManagement | deleteElection | DELETE /association/member/elections/:electionId |
| ElectionManagement | openElectionNominations | POST /association/member/elections/:electionId/open-nominations |
| ElectionManagement | openElectionVoting | POST /association/member/elections/:electionId/open-voting |
| ElectionManagement | certifyElection | POST /association/member/elections/:electionId/certify |
| CandidateManagement | createCandidate | POST /association/member/candidates |
| CandidateManagement | getCandidate | GET /association/member/candidates/:candidateId |
| CandidateManagement | listCandidates | GET /association/member/candidates |
| CandidateManagement | updateCandidate | PATCH /association/member/candidates/:candidateId |
| CandidateManagement | deleteCandidate | DELETE /association/member/candidates/:candidateId |
| CandidateManagement | updateCandidateStatus | POST /association/member/candidates/:candidateId/status |
| BallotManagement | castBallot | POST /association/member/ballots |
| BallotManagement | listBallots | GET /association/member/ballots |

## Wipe-set (handler .ts to delete in R2.3)

26 handler files under `services/api-ts/src/handlers/association:member/`:

```
createPosition.ts, getPosition.ts, listPositions.ts, updatePosition.ts, deletePosition.ts
createOfficerTerm.ts, getOfficerTerm.ts, listOfficerTerms.ts, updateOfficerTerm.ts, deleteOfficerTerm.ts
createElection.ts, getElection.ts, listElections.ts, updateElection.ts, deleteElection.ts
openElectionNominations.ts, openElectionVoting.ts, certifyElection.ts
createCandidate.ts, getCandidate.ts, listCandidates.ts, updateCandidate.ts, deleteCandidate.ts, updateCandidateStatus.ts
castBallot.ts, listBallots.ts
```

## Test files to move colocated in R2.5

8 `.test.ts` files keep next to their handlers (move to `handlers/member/governance/`):

```
castBallot.test.ts
certifyElection.test.ts
createCandidate.test.ts
createOfficerTerm.test.ts
election-role-enforcement.test.ts
governance.test.ts
openElectionVoting.test.ts
updateOfficerTerm.test.ts
```

## Keep-set (do NOT delete; do NOT move)

- `repos/governance.repo.ts` + `repos/governance.schema.ts` — stable path. 30+ inbound importers (consumers, ports, seed, officer-checks, dues/, person/, invite/, association:operations/, middleware, tests). Path stability is the load-bearing invariant.
- All other `association:member/` handlers (chapters were moved in R1; directory/officers/credits/credentials/dues/membership still here).
- `jobs/`, `utils/` — none governance-specific in scope.

## Out-of-scope (live in association:member/ but NOT R2)

```
services/api-ts/src/handlers/association:member/transitionOfficerTerm.ts
services/api-ts/src/handlers/association:member/listOfficerTermsSummary.ts
```

- `transitionOfficerTerm.ts` — HAND-WIRED in `app.ts:578` at `POST /association/member/org/:organizationId/officers/:termId/transition`. Not in any TypeSpec interface. Per CLAUDE.md, "complex governance flows like deleteElection" carved out — this is one of them. Belongs to R5 officers sub-domain when migrated.
- `listOfficerTermsSummary.ts` — operationId defined in `credits.tsp:141`, NOT `governance.tsp`. Lives in handler dir for legacy reasons. Belongs to R6 credits sub-domain.

## Out-of-scope (different module — leave alone)

```
services/api-ts/src/handlers/elections/        # m12 legacy hand-wired (castVote, createNominee, updateNomineeStatus, updateElectionStatus)
services/api-ts/src/handlers/elections/repos/elections.schema.ts
services/api-ts/src/handlers/elections/repos/elections.repo.ts
```

The standalone `elections/` module is a separate hand-wired m12 lifecycle layer (nominees + raw vote tally). Its TypeSpec migration is explicitly deferred per CLAUDE.md §"Deferred Work". Different schema, different repo. R2 must not touch it.

`createCandidate` in governance writes to `electionNominees` via `ElectionsRepository` (cross-module read) — that's a known inbound consumer of the elections module's schema. Preserve as-is.

## Consumers of governance code (post-move audit checklist)

Files importing `@/handlers/association:member/repos/governance.*` or `@/handlers/association:member/{Position|OfficerTerm|Election|Candidate|Ballot}*`:

- `core/auth/officer-checks.ts` + test — `OfficerTermRepository` for `requireOfficerTerm`.
- `core/domain-event-consumers.ts` — `positions`, `OfficerTermRepository`, `officerTerms`. Consumers `officer.assigned`, `officer.removed`, `officer.transitioned`, `election.status.changed`, `election.created` listeners. **MUST NOT change event names or payload shapes.**
- `core/schema-registry.ts` — re-exports governance schema tables.
- `core/ports/index.ts` + test — port wiring for `OfficerTermRepository`.
- `middleware/officer-auth.test.ts` — auth middleware test.
- `tests/route-protection-handwired.test.ts` — covers transitionOfficerTerm hand-wired route.
- `test-utils/preload-pristine.ts` — DB pristine snapshot truncates governance tables.
- `seed/layer-2-users.ts`, `seed/layer-5-gap-fill.ts`, `seed/layer-7-member.ts` — seed governance fixtures.
- `handlers/person/getMyOfficerRole.ts` + test — reads officer term for self.
- `handlers/person/requestMyAccountDeletion.ts` — cleanup cascade.
- `handlers/dues/*.test.ts`, `handlers/dues/downloadReceipt.ts` — dues calculations rely on officer state.
- `handlers/invite/bulkImportMembers.ts` + test — imports member records that may include officer mapping.
- `handlers/__tests__/br-edge-cases.test.ts`, `handlers/test-isolation.ts` — cross-cutting test fixtures.
- `handlers/association:operations/{events,check-in,cancelEvent,financial-lifecycle,org-accredited-providers}.test.ts` — operations module reads officer assignments.
- `handlers/elections/repos/elections.schema.ts` — used together with governance schema for cross-table queries (createCandidate writes electionNominees).

Repos stay at `association:member/repos/` so none of these importers change. New handlers at `handlers/member/governance/<x>.ts` must use absolute import path `@/handlers/association:member/repos/governance.repo` (and `.schema`), not relative `./repos/...`.

## Retag targets in main.tsp

5 lines change `@tag("Association:Member")` → `@tag("Member/Governance")`:

| Line | Interface alias | Source interface |
|---|---|---|
| 367 | `AssocPositionManagement` | `Governance.PositionManagement` |
| 371 | `AssocOfficerTermManagement` | `Governance.OfficerTermManagement` |
| 379 | `AssocElectionManagement` | `Governance.ElectionManagement` |
| 383 | `AssocCandidateManagement` | `Governance.CandidateManagement` |
| 387 | `AssocBallotManagement` | `Governance.BallotManagement` |

Plus add `@tagMetadata("Member/Governance", #{ ... })` next to the existing `Member/Chapters` metadata.

## New module target

```
services/api-ts/src/handlers/member/governance/
  createPosition.ts (+25 more)
  *.test.ts (8 moved)
```

## Risks / unknowns

- `createCandidate` reads/writes `electionNominees` from the standalone `elections/` module — cross-module dependency. Verify post-move imports resolve.
- `election-role-enforcement.test.ts` imports from `../elections/repos/elections.repo` (relative from association:member). After move to `member/governance/`, that path resolves differently — must rewrite to absolute `@/handlers/elections/repos/elections.repo`.
- `governance.test.ts` content unknown — read before move to confirm no path-relative imports that break under new location.

## Estimated handler count vs plan

Plan §R2 estimated "10 files, ~4 days". Actual scope is **26 handlers + 8 tests** (the 5-interface bundle). Plan estimate was for one of {positions, officer-terms, elections, candidates, ballots} only. Treating governance.tsp as one logical unit per user prompt's instruction to enumerate "all main.tsp interfaces that extend Association.Member.Governance.*". ~6–8 days realistic.
