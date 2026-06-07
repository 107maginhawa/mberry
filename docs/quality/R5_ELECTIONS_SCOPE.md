# R5 — Elections Scope (SKIP CASE)

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `b34c2a21` (post-R4 directory cutover)
**Conclusion:** **R5 = SKIP.** The R2 governance cutover already absorbed the entire typespec-generated elections surface. There is nothing left to migrate.

---

## TL;DR

- All three typespec-generated election interfaces (`AssocElectionManagement`, `AssocCandidateManagement`, `AssocBallotManagement`) were retagged `@tag("Member/Governance")` in **R2** and live under `services/api-ts/src/handlers/member/governance/`.
- The legacy `services/api-ts/src/handlers/elections/` directory holds **only hand-wired, pre-typespec code** that was explicitly deferred per CLAUDE.md §"What's Intentionally Absent" and `app.ts:498`.
- No route in `app.ts` imports from `handlers/elections/*.ts`. The legacy handler `.ts` files (`castVote.ts`, `createNominee.ts`, `updateElectionStatus.ts`, `updateNomineeStatus.ts`) are orphaned and not reachable from the running router.
- The `handlers/elections/repos/` and `handlers/elections/elections.schema.ts` files are still **live** — they are consumed by the new governance handlers, `core/domain-event-consumers.ts`, `seed/layer-5-gap-fill.ts`, and `test-utils/preload-pristine.ts`. They are **out of R5 scope** (schema relocation belongs to a future mega-module-split phase, not the directory rename pattern).

**Action:** No tsp retag, no wipe, no regenerate, no Hurl, no tag cutover. Proceed to next sub-domain (was R6 officers, now promoted to R5 in sequence).

---

## §A — WHAT EXISTS (full inventory)

### A.1 TypeSpec interfaces (already migrated in R2)

`specs/api/src/main.tsp` lines 373–388:

```tsp
// Association Domain — Governance (Elections, Candidates & Ballots)

@tag("Member/Governance")
@route("/association/member/elections")
interface AssocElectionManagement extends Association.Member.Governance.ElectionManagement {}

@tag("Member/Governance")
@route("/association/member/candidates")
interface AssocCandidateManagement extends Association.Member.Governance.CandidateManagement {}

@tag("Member/Governance")
@route("/association/member/ballots")
interface AssocBallotManagement extends Association.Member.Governance.BallotManagement {}
```

Source: `specs/api/src/association/member/governance.tsp` (Election, Candidate, Ballot, ElectionStatus, ElectionType, VotingMode, CandidateStatus, ElectionPositionSlot models).

### A.2 Generated handlers (already in `handlers/member/governance/`)

Migrated by R2 governance cutover — present at baseline `b34c2a21`:

- `castBallot.ts` + `.test.ts`
- `certifyElection.ts` + `.test.ts`
- `createCandidate.ts` + `.test.ts`
- `createElection.ts`
- `deleteCandidate.ts`
- `deleteElection.ts`
- `getCandidate.ts`
- `getElection.ts`
- `listBallots.ts`
- `listCandidates.ts`
- `listElections.ts`
- `openElectionNominations.ts`
- `openElectionVoting.ts` + `.test.ts`
- `updateCandidate.ts`
- `updateCandidateStatus.ts`
- `updateElection.ts`

(16 generated election handlers — already cut over.)

### A.3 Legacy hand-wired dir `handlers/elections/`

Handlers (orphaned `.ts` files, no live route):
- `castVote.ts` — superseded by `member/governance/castBallot.ts`
- `createNominee.ts` — superseded by `member/governance/createCandidate.ts`
- `updateElectionStatus.ts` — superseded by `openElectionNominations` / `openElectionVoting`
- `updateNomineeStatus.ts` — superseded by `member/governance/updateCandidateStatus.ts` (confirmed by `app.ts:524`)

Tests in same dir:
- `ac-m12.elections.test.ts`, `br-33.election-integrity.test.ts`, `br-34.nomination-eligibility.test.ts`, `cancellation-cascade.test.ts`, `castVote.test.ts`, `createNominee.test.ts`, `elections-lifecycle.test.ts`, `elections-schema.test.ts`, `flow-04.election-vote-tally.test.ts`, `nomination-eligibility-e2e.test.ts`, `updateElectionStatus.test.ts`, `updateNomineeStatus.test.ts`

Repos (LIVE — consumed by new code):
- `repos/elections.repo.ts`
- `repos/elections.schema.ts`
- `repos/elections.repo.test.ts`, `repos/elections.repo.nominees.test.ts`

### A.4 `app.ts` route wiring

Zero active `from '.*handlers/elections'` imports. Comments at lines 81–82, 524–529 document the migration as already complete:

```
// Elections: deleteElection — MIGRATED to generated routes (Phase 35,
// /association/member/elections/{electionId}).
...
//   m12 elections/: entirely hand-wired. TypeSpec migration deferred.
...
// updateNomineeStatus — MIGRATED to TypeSpec as updateCandidateStatus
// (POST /association/member/candidates/{candidateId}/status). Wave 12.
// deleteElection — MIGRATED to TypeSpec
// (DELETE /association/member/elections/{electionId}).
```

The "TypeSpec migration deferred" comment refers to the orphaned `.ts` legacy files, not any unmigrated route.

### A.5 Cross-module consumers of the elections schema

These imports keep `handlers/elections/repos/` LIVE — they are out of R5 scope and stay where they are:

- `core/domain-event-consumers.ts:35` — `import { electionNominees, electionVotes } from '@/handlers/elections/repos/elections.schema'` (used by 4 consumer blocks: `election.status.changed`, `election.created`, `election.published` → M04 officer transition, `person.deleted` cascade)
- `core/domain-event-consumers.test.ts`
- `seed/layer-5-gap-fill.ts`
- `test-utils/preload-pristine.ts`

Generated governance handlers also consume the repo (legitimate, in-scope-of-R2):
- `member/governance/castBallot.ts` (`repo.castVote(...)`)
- `member/governance/certifyElection.ts` (`repo.updateNomineeStatus(...)`)
- `member/governance/updateCandidateStatus.ts` (`repo.updateNomineeStatus(...)`)
- `member/governance/updateCandidate.ts` (`repo.updateNomineeStatus(...)`)

---

## §B — WHAT MOVES IN R5

**Nothing.** No handler relocation, no tsp retag, no regenerate, no wipe.

---

## §C — WHAT STAYS DEFERRED

### C.1 Legacy `.ts` handler files (`castVote.ts` et al.)

Status: orphaned but not deleted by R5. Removal belongs to a dedicated dead-code-cleanup phase, not the directory-rename pattern.

Risk if left: zero — no runtime path reaches them. Tests still pass (they cover orphaned code paths, not regressions).

Recommended future action (out of R5 scope): a separate cleanup commit after the full R1–R9 sweep finishes, gated on:
- `grep -rn 'handlers/elections/(castVote|createNominee|updateElectionStatus|updateNomineeStatus)' src/` returns empty
- Co-located tests either moved to `member/governance/` or deleted as redundant with the post-R2 test suite

### C.2 Repos + schema (`handlers/elections/repos/`)

Status: live, 4 cross-module consumers + 4 in-governance consumers.

Future relocation belongs to the mega-module-split work tracked in `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`. Not an R-series concern. Touching them now would force a wide rewrite of `domain-event-consumers.ts` and `seed/` for zero gate movement.

---

## §D — Order sequence after R5 skip

R-series sequence updated:

| Step | Sub-domain | Status |
| --- | --- | --- |
| R1 | chapters | ✅ cut over |
| R2 | governance (incl. elections, candidates, ballots) | ✅ cut over |
| R3 | credentials | ✅ cut over |
| R4 | directory | ✅ cut over |
| ~~R5 (originally elections)~~ | (skipped — absorbed by R2) | — |
| **R5 (was R6)** | **officers / officer-management** | **next up** |
| R6 (was R7) | credits | pending |
| R7 (was R8) | dues | pending |
| R8 (was R9) | membership | pending |

Net: 4 sub-domains complete, 4 remain. R5 = officers next.

**R5 (officers) boundary note:** governance.tsp already includes `Position` + `OfficerTerm` models. R2 handled candidates/ballots/elections but the file inventory shows `createOfficerTerm.ts`, `listOfficerTerms.ts`, `createPosition.ts`, `getPosition.ts`, etc. **also already in `handlers/member/governance/`** at baseline `b34c2a21`. R5 (officers) may itself be a partial-skip — R5.0-officers will need an analogous scope-inventory step before any wipe.

---

## §E — Verification commands run

```sh
# A.1 confirm tsp interfaces tagged Member/Governance
grep -B1 -A2 'Election\|Candidate\|Ballot' specs/api/src/main.tsp | grep -B1 '@tag'

# A.2 confirm generated handlers in place
ls services/api-ts/src/handlers/member/governance/ | grep -iE 'election|ballot|candidate'

# A.3 confirm legacy dir contents
ls services/api-ts/src/handlers/elections/

# A.4 confirm zero live route imports
grep -n 'from .*elections' services/api-ts/src/app.ts        # → no output
grep -rn 'from.*handlers/elections' services/api-ts/src/ | grep -v handlers/elections/  # → no output

# A.5 confirm cross-module consumers of schema
grep -rln 'handlers/elections/repos\|handlers/elections/elections.schema' services/api-ts/src/
```

All verifications match the conclusions above.

---

## §F — Gate posture

No gates need to run for R5 (no code change). R4 gates remain the floor for R5 (officers):

| Gate | R4 floor | R5 target |
| --- | --- | --- |
| typecheck | 5/5 | ≥ 5/5 |
| unit | 6027 pass (1 pre-existing fail) | ≥ 6027 |
| contract | 130/132 (2 pre-existing email flake) | ≥ 130 + new |
| SDK drift | 0/454 | 0/454 |
| observability | 94 % | ≥ 94 % |
| contract coverage | 81 % | ≥ 81 % |

---

## §G — Decision required

**Confirm:** proceed to R5 = officers (formerly R6) with the same R5.0 scope-inventory-first pattern.

Awaiting user checkpoint.
