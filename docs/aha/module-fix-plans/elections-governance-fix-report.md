# AHA Module/Group Fix Report: Elections & Governance

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Elections & Governance |
| Module slug | elections-governance |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/elections-governance-gap-plan.md` (context only) |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/elections-governance-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — **FIX-001 only**, driven by Batch D test **FIX-007** (RED-first) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation) |
| Working tree status checked | Yes (`git status --short` at start) |
| Fix scope | P0 (FIX-001) + the single highest-value P1 `[TEST GAP]` driver (FIX-007) |
| Out of scope | FIX-002 (P0, `[NEEDS PRODUCT DECISION]`), Batch B (FIX-003/004/005), Batch C (FIX-008/009/010/011), Batch F, full FIX-006 stub rewrites, all §10 Deferred + §11 Do Not Build |
| Shared files touched | Yes — generated OpenAPI registry/routes/validators + generated SDK (via regen pipeline, not hand-edited) |
| Schema/migration touched | No |
| Limitations | Frontend component unit test `election-detail.test.tsx` has a **pre-existing** vitest-4 hoisting failure (`__vi_import_1__ before initialization` in its `vi.mock('./nominee-picker-dialog')` block) that prevents the whole suite from loading (0 tests collected); this is unrelated to my change (test file untouched) and frontend correctness was instead verified by a clean `tsc --noEmit`. The lifecycle integration test required a reachable Postgres (available on localhost:5432; it env-skips cleanly otherwise). |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1: state-machine dead end — no op moves `votingOpen → awaitingConfirmation`; "Close Voting" called `certifyElection` and got 422 | P0 | V1 REQUIRED | A | Election could never be certified through the product; needs no product decision | **Fixed** |
| FIX-007 | Real-DB lifecycle integration test (no mocks) proving the close-voting transition persists and nominee/vote FK survives | P1 `[TEST GAP]` | V1 REQUIRED | D | Highest-value RED test; drives FIX-001 and probes G2 severity at runtime | **Fixed** |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test closeElectionVoting.test.ts` | **RED** — `Cannot find module './closeElectionVoting'` | FIX-001 | Confirmed test fails for the right reason: handler did not exist |
| `bun test election-lifecycle.integration.test.ts` | **RED** — `Cannot find module './closeElectionVoting'` | FIX-007 | Same root cause; no live op for the transition |
| `certifyElection.test.ts:120` (existing) | Already-green proof that `votingOpen` → certify yields 422 | FIX-001 | The dead end the new op removes |
| `ELECTION_VALID_TRANSITIONS` (`utils/status-transitions.ts:102-109`) | Present but unused for close-voting | FIX-001 | `votingOpen: ['awaitingConfirmation','cancelled']` already defined; reused, not redefined |

Baseline RED was confirmed by running each new test before implementing the handler (output: `0 pass / 1 fail / 1 error`, missing-module error).

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Added `closeElectionVoting` TypeSpec op (`POST /association/member/elections/{electionId}/close-voting`), regenerated OpenAPI + routes/validators/registry + SDK, implemented handler enforcing the single `votingOpen → awaitingConfirmation` transition via `ELECTION_VALID_TRANSITIONS`, wired the frontend "Close Voting" action to it | `specs/api/src/association/member/governance.tsp`; `services/api-ts/src/handlers/member/governance/closeElectionVoting.ts`; generated `registry.ts`/`routes.ts`/`validators.ts`; SDK `sdk.gen.ts`/`types.gen.ts`/`@tanstack/react-query.gen.ts`/`transformers.gen.ts`/`index.ts`/`__test-stub__react-query.ts`; `specs/api/dist/openapi/*` + `dist/typescript-types/*`; `apps/memberry/src/features/elections/components/election-detail.tsx` | `[SHARED DEPENDENCY]` (generated artifacts only, via regen — never hand-edited) | Handler mirrors `openElectionVoting` pattern: officer guard via `requireOfficerTerm`, `BusinessLogicError`/422 with `INVALID_STATUS_TRANSITION` on any non-`votingOpen` state, sets `votingCloseAt`, emits existing `election.status.changed` event (no new/changed event payload — M04 RBAC contract preserved). Frontend `handleStatusAdvance` now routes `nextStatus === 'awaitingConfirmation'` to `closeElectionVotingMutation` instead of `certifyMut`. |
| FIX-007 | Real-DB lifecycle integration test: scratch schema mirroring real `election`/`election_nominee`/`election_vote`/`position`/`person` columns (incl. `baseEntityFields` version/created_by/updated_by + the real FK `election_nominee → position`), drives an election through `votingOpen`, runs the real handler, asserts the row moves to `awaitingConfirmation` and a `draft` election is rejected without mutation | `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` | No (test-only) | Env-skips cleanly if Postgres unreachable. The nominee+vote inserts using real `position` UUIDs succeeded against the live FK — confirming the dead end is specifically G1 (FIX-001), independent of the G2 identity fork in this path. |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/member/governance/closeElectionVoting.test.ts` | backend/unit + domain workflow | Valid only from `votingOpen` → `awaitingConfirmation` (200, sets `votingCloseAt`); 422 from draft/nominationsOpen/awaitingConfirmation/published/cancelled; `INVALID_STATUS_TRANSITION` code; 401 no session; 404 not found | FIX-001 |
| `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` | integration / data-schema / domain workflow | Against real Postgres: close-voting persists `awaitingConfirmation` + `voting_close_at` on the real `election` row; nominee/vote inserts survive the real `position` FK; an invalid `draft` source state is rejected and leaves the row unchanged | FIX-007 (drives FIX-001) |

No assertions were weakened. No existing tests were deleted. RED-before-GREEN was confirmed for both.

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/member/governance/closeElectionVoting.test.ts` (pre-impl) | **Failed (expected RED)** | Missing-module error — correct reason |
| `bun test src/handlers/member/governance/election-lifecycle.integration.test.ts` (pre-impl) | **Failed (expected RED)** | Missing-module error — correct reason |
| `bun test src/handlers/member/governance/closeElectionVoting.test.ts` (post-impl) | **Passed** | 10 pass / 0 fail / 11 expect() |
| `bun test src/handlers/member/governance/election-lifecycle.integration.test.ts` (post-impl) | **Passed** | 2 pass / 0 fail / 5 expect() (real Postgres) |
| `bun test src/handlers/member/governance/` (whole dir) | **Passed** | 103 pass / 0 fail across 10 files — no regressions |
| `cd specs/api && bun run build` | **Passed** | OpenAPI + types regenerated; only pre-existing `implicitOptionality` deprecation warnings |
| `cd services/api-ts && bun run generate` | **Passed** | 1 new handler stub (closeElectionVoting), 454 existing skipped |
| `cd packages/sdk-ts && bun run generate` | **Passed** | SDK regenerated; only pre-existing expandable-field transformer warnings |
| `services/api-ts` `tsc --noEmit` | **Passed** | 0 errors total |
| `apps/memberry` `tsc --noEmit` | **Passed** | 0 errors total (confirms frontend wiring type-correct against regenerated SDK) |
| `apps/memberry` `vitest run election-detail.test.tsx` | **Failed (pre-existing, unrelated)** | Suite fails to load: `__vi_import_1__ before initialization` in the file's own `vi.mock` block (test file untouched by this pass; 0 tests collected) |

## 7. Validation Summary

- **Passed:** the two new tests (RED→GREEN), the full governance test directory (103/103), the TypeSpec/OpenAPI build, the api-ts code-gen, the SDK regen, and both workspace typechecks (api-ts and memberry, 0 errors each).
- **Failed:** none attributable to this fix. The only failing command is the pre-existing `election-detail.test.tsx` vitest-suite-load error (`__vi_import_1__ before initialization`), which is a vitest-4 hoisting defect in that test file's `vi.mock` setup and references a non-existent `test-setup-root.ts` global stub. The test file is **untouched** by this pass; frontend correctness was instead proven by a clean `tsc --noEmit` over the whole memberry app.
- **Not run:** the whole-repo suite (per the focused-validation instruction) and Hurl contract tests (FIX-006 hurl rewrites are out of scope for this narrow Batch A pass).
- **Pre-existing/unrelated:** the `election-detail.test.tsx` failure; the pg-pool `search_path` `DeprecationWarning` emitted by the integration harness (same benign warning the existing membership integration test produces).

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Generated OpenAPI artifacts | `services/api-ts/src/generated/openapi/{registry,routes,validators}.ts` | Hono route table; every API consumer | Governance dir 103/103; api-ts typecheck 0 errors | `[SHARED DEPENDENCY]` — additive only (+2 registry, +8 routes, +8 validators), all for `closeElectionVoting`. Produced by the regen pipeline; not hand-edited. Diff verified to contain only close-voting symbols (plus a pre-existing prior-module `personId` validator line already in the working tree). |
| Generated SDK | `packages/sdk-ts/src/generated/*` | both apps (memberry, admin) | memberry typecheck 0 errors | `[SHARED DEPENDENCY]` — additive `closeElectionVoting`/`closeElectionVotingMutation`/`CloseElectionVotingData`. Verified prior-module ops (training/dues/billing mutations) still present after regen; net delta small/additive. |
| Domain event bus | `election.status.changed` (existing event) | governance status consumers | covered by handler tests | No new event added and **no existing event payload/name changed** — the M04 org-admin RBAC consumer contract (`election.published`) is untouched, satisfying the §7 R2 constraint. |
| `ELECTION_VALID_TRANSITIONS` | `services/api-ts/src/utils/status-transitions.ts` | reused, not modified | unit test exercises every source state | The table already defined `votingOpen → awaitingConfirmation`; the handler is the first real consumer for that edge. |

No database schema or migration was touched. The `elections.schema.ts` / `position` FK (FIX-002 / Batch F territory) was deliberately left untouched.

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Dual position identity (jsonb slots vs `position` FK) | FIX-002 / G2 (P0) | Coding gated on the position-identity product/tech decision (§8) | Make the identity decision, then run a dedicated `04` pass for Batch A FIX-002 + Batch F |
| Ballot secrecy + member "my ballots" + 403 self-check | FIX-003 / G3 (P1) | Batch B — out of this pass | Run Batch B `04` pass |
| Live `cancelElection` cascade (porting dead `updateElectionStatus.ts`) | FIX-004 / G4 (P1) | Batch B — out of this pass | Run Batch B `04` pass |
| `updateElection` immutability/state guard | FIX-005 / G5 (P1) | Batch B — out of this pass | Run Batch B `04` pass |
| Real contract `.hurl` flows replacing the 4 auth-only stubs | FIX-006 / G6 (P1 `[TEST GAP]`) | Batch D remainder — out of this narrow pass (only the lifecycle subset was in Batch A scope, and no hurl subset was strictly required to land FIX-001) | Land alongside Batch B fixes |
| Server-side visibility filters; castBallot accepted-nominee/time checks; checklist read/complete; transactional published consumer | FIX-008/009/010/011 (P2) | Batch C — out of this pass | Run Batch C `04` pass after A and B |
| Frontend `election-detail.test.tsx` suite cannot load (pre-existing vitest hoisting bug) | (not an AHA gap item) | Pre-existing, unrelated to FIX-001 | Fix the `vi.mock` hoisting / restore the missing global SDK stub in a frontend-test maintenance pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-002 coding (position identity) | `[NEEDS PRODUCT DECISION]` | Fix shape depends on whether the `position` FK is honored or dropped for module-local jsonb slots | Product/tech decision on the identity model (recommend referencing real `position` rows) |
| FIX-002 runtime FK-violation severity | `[NEEDS CONFIRMATION]` | Static evidence of a 5xx on UI nomination not reproduced | FIX-007 (now landed) showed nominee/vote inserts succeed when real `position` UUIDs are used; a UI-path repro using random-UUID jsonb slots is still needed to confirm the 5xx |
| Tie-handling in certify | `[NEEDS PRODUCT DECISION]` | Block vs President-chooses unresolved | Product decision (deferred) |
| Cancelled-election vote retention | `[NEEDS PRODUCT DECISION]` | Feeds FIX-004 vote-void semantics | Compliance/product retention decision |
| BR-34 minimum-tenure config | `[BLOCKED BY MISSING SPEC]` | Tenure params + per-org config infra undefined | Product defines parameters |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Auto-close scheduled job honoring `votingCloseAt` | `V2 DEFERRED` | Manual `closeElectionVoting` op suffices for annual, low-volume PH elections |
| WF-078 Yes/No/Abstain bylaw model + turnout UX | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Approximation exists; redesign needs product call |
| M12-R5 hybrid/in-person vote recording | `V2 DEFERRED` | No op/UI/demand; PH pilot is online-first |
| Voter-anonymization rearchitecture (hash voterId at rest) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Unique-vote constraint needs voter identity |
| G10 nominee_status enum alignment (withdrawn/notElected) | `V1 RECOMMENDED` `[NEEDS CONFIRMATION]` | Deferred; needs runtime confirmation transitions are reachable |
| Expand the 7 orphan TypeSpec committee/board interfaces | `DO NOT ADD` `[DO NOT OVERBUILD]` | Committees live in m19/association:operations; expanding duplicates existing behavior |
| Generic election state-machine framework | `DO NOT ADD` `[DO NOT OVERBUILD]` | `ELECTION_VALID_TRANSITIONS` + per-op guards are sufficient |
| Add `status` to `UpdateElection` PATCH to enable close/cancel | `DO NOT ADD` | Wrong approach — solved via the explicit `closeElectionVoting` transition op |
| Delete orphaned legacy `handlers/elections/*` + re-anchor BR pointers | `V1 RECOMMENDED` (deferred) | Must wait until FIX-004 ports the cancellation cascade |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `specs/api/src/association/member/governance.tsp` | Added `closeElectionVoting` op (POST `/elections/{electionId}/close-voting`, association:admin role, x-audit update/election) | FIX-001 |
| `services/api-ts/src/handlers/member/governance/closeElectionVoting.ts` | **New** handler — replaced generated stub with real `votingOpen → awaitingConfirmation` logic | FIX-001 |
| `services/api-ts/src/handlers/member/governance/closeElectionVoting.test.ts` | **New** state-guard unit test | FIX-001 |
| `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` | **New** real-DB lifecycle integration test | FIX-007 |
| `services/api-ts/src/generated/openapi/{registry,routes,validators}.ts` | Regenerated — additive close-voting wiring | FIX-001 (`[SHARED DEPENDENCY]`) |
| `packages/sdk-ts/src/generated/*` | Regenerated — additive close-voting SDK fn/mutation/types | FIX-001 (`[SHARED DEPENDENCY]`) |
| `specs/api/dist/openapi/*`, `specs/api/dist/typescript-types/*` | Regenerated OpenAPI doc + TS types | FIX-001 |
| `apps/memberry/src/features/elections/components/election-detail.tsx` | Wired "Close Voting" to `closeElectionVotingMutation` (was incorrectly calling `certifyMut`); added pending-state tracking | FIX-001 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline output (missing-module error, both tests) | This report §3/§6 (test output captured during the pass) | FIX-001, FIX-007 |
| GREEN unit test (10 pass / 0 fail) | This report §6 | FIX-001 |
| GREEN integration test against real Postgres (2 pass / 0 fail) | This report §6 | FIX-007 |
| Full governance dir 103/103 pass | This report §6 | FIX-001 |
| Scoped generated diff (registry +2, routes +8, validators +8, all close-voting) | This report §8 | FIX-001 |
| api-ts + memberry typecheck 0 errors | This report §6/§7 | FIX-001 |

No screenshots or Webwright/Playwright artifacts were produced — backend + typecheck evidence is sufficient for this narrow, server-driven fix, and the one core E2E journey is explicitly reserved by the fix-ready plan for after backend fixes land.

## 14. Completion Decision

**COMPLETE**

Batch A (FIX-001, driven by FIX-007) is fully implemented and validated. The election state-machine dead end is removed: a real `votingOpen` election now transitions to `awaitingConfirmation` through a dedicated, RBAC-guarded, audited operation, proven both by a state-guard unit test (every invalid source state → 422) and by a real-Postgres lifecycle integration test (the transition persists; an invalid source state is rejected without mutation). The frontend "Close Voting" action is correctly routed to the new op instead of the certify path. The TypeSpec→OpenAPI→routes/validators→SDK regen pipeline was followed (no generated files hand-edited), the generated diff is tightly scoped to the new op, both workspaces typecheck clean, and all 103 governance tests pass with no regressions. All prior-module AHA changes in the working tree were preserved; nothing was committed. The only failing command (frontend `election-detail.test.tsx`) is a pre-existing, unrelated vitest hoisting defect in an untouched test file.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Elections & Governance, Batch B** (FIX-003 / FIX-004 / FIX-005 — ballot secrecy, live `cancelElection`, `updateElection` immutability), now that Batch A FIX-001 has landed.

- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Module slug: `elections-governance`
- Input fix-ready plan: `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md`
- Selected batch: **Batch B** (run FIX-003 first as it is independent; pair FIX-004 + FIX-005).

Before scheduling **FIX-002 / Batch F**, obtain the position-identity product decision (`[NEEDS PRODUCT DECISION]`, §10) — request product decision. Separately, a frontend-test maintenance task should repair the pre-existing `election-detail.test.tsx` vitest hoisting failure (out of AHA scope).

---

# Batch B — P1 trust / record-integrity (decision-free subset, 2026-06-12)

> Appended pass. Executed **Batch B, decision-free subset only: FIX-003 (ballot secrecy + member self-read) + FIX-005 (`updateElection` immutability guard)**. FIX-002 (P0, position-identity `[NEEDS PRODUCT DECISION]`) and FIX-004 (live `cancelElection` — its cancelled-election vote-retention sub-question is `[NEEDS PRODUCT DECISION]`) were **excluded as gated**. Prior Batch A sections above are unchanged.

## B.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Elections & Governance |
| Module slug | elections-governance |
| Raw gap plan used | `docs/aha/module-gap-plans/elections-governance-gap-plan.md` (context only) |
| Fix-ready plan used | `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/elections-governance-fix-report.md` |
| Fix date | 2026-06-12 |
| Batch executed | **Batch B — FIX-003 + FIX-005 only** (decision-free subset; FIX-004 deferred as gated) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked; RED→GREEN per fix) |
| Working tree status checked | Yes (`git status --short` = 237 dirty files from prior AHA passes; preserved. Only `governance.tsp` among target files was pre-dirty — from Batch A's `closeElectionVoting` op — and was appended-to, not rewritten) |
| Fix scope | P1 (FIX-003 secrecy/permission, FIX-005 record finality) |
| Out of scope | FIX-002 (P0 `[NEEDS PRODUCT DECISION]`), FIX-004 (`[NEEDS PRODUCT DECISION]` vote-retention), Batch C (FIX-008/009/010/011), FIX-006 hurl rewrites, all §10 Deferred + §11 Do Not Build |
| Shared files touched | Yes — generated OpenAPI registry/routes/validators + generated SDK (via regen pipeline, **never hand-edited**; verified idempotent) |
| Schema/migration touched | No |
| Limitations | Anonymisation of the admin `listBallots` is enforced at the repo projection layer (`listAnonymizedVotes` selects no `voterId`/`createdBy`/`updatedBy`); the unit suite proves the handler routes through that projection + the officer/cross-org gate, while the column-level guarantee is a static projection (no real-DB integration test added this pass — none required for a server-side read/guard). Hurl not re-run (FIX-006 stubs are auth-only and unaffected; their real-flow rewrite is Batch D, out of scope). |

## B.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-003 | G3: `listBallots` exposed raw `voter→nominee` rows (secret-ballot violation WF-077) with no org scope; admin-only gate 403'd members' own "already voted?" self-check → silent DUPLICATE_VOTE resubmits | P1 | V1 REQUIRED | B | Trust/permission gap on a live voting surface; decision-free | **Fixed** |
| FIX-005 | G5: `updateElection` had no state/immutability guard — PATCH of title/dates/positions allowed on PUBLISHED elections (M12-R2 / AC-M12-003 finality violation) and regenerated position ids mid-election (orphans nominee/vote refs) | P1 | V1 REQUIRED | B | Record-finality integrity; decision-free | **Fixed** |
| FIX-002 | G2: dual position identity (jsonb slots vs `position` FK) | P0 | V1 REQUIRED | A/F | — | **Blocked** (`[NEEDS PRODUCT DECISION]`) — not attempted this pass |
| FIX-004 | G4: live `cancelElection` cascade | P1 | V1 REQUIRED | B | — | **Blocked** — cancelled-election vote-retention is `[NEEDS PRODUCT DECISION]`; deferred per the continuation prompt (prefer FIX-003+FIX-005) |

## B.3 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `updateElection.test.ts` (new) | **RED** — 5 pass / 7 fail | FIX-005 | Guard tests (published/cancelled reject, positions-locked) resolved instead of rejecting — no guard existed. Auth/404/draft-happy-path already green. |
| `listBallots.test.ts` (new) | **RED** — 1 pass / 3 fail | FIX-003 | Officer view returned `voterId` (leak); cross-org caller got 200 not 403 (no officer check); omitted-electionId returned the raw row (unscoped dump). 401 already green. |
| `myBallots.test.ts` (new) | **RED** — `Cannot find module './myBallots'` | FIX-003 | Member self-read op did not exist. |
| Full `bun test` (api-ts) | **6059 pass / 1 fail / 4 todo** (env baseline) | — | The 1 fail is the pre-existing, unrelated `registerEmailJobs > registers email.processor as interval job` (30000 vs 1000). |

RED was confirmed by running each new test before implementing (output captured above).

## B.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-005 | Added a state/immutability guard to `updateElection`: published/cancelled elections (`IMMUTABLE_ELECTION_STATES`) reject **all** mutation with `422 ELECTION_IMMUTABLE`; a `positions` change is rejected with `422 ELECTION_POSITIONS_LOCKED` once the election leaves `draft` (prevents mid-election position-id regeneration that orphans nominee/vote refs). Mutable fields still update in draft/nominationsOpen/votingOpen/awaitingConfirmation. | `services/api-ts/src/handlers/member/governance/updateElection.ts` | No | Guard runs after the officer check, before building `updateData`. Reuses `BusinessLogicError` (→422). No repo/schema change. |
| FIX-003 | (a) Hardened `listBallots` into an admin-only **anonymised, org-scoped** search: refuses an unscoped dump (no `electionId` → `{data:[]}`), loads the election, requires the caller to hold an active officer term in that election's org (`requireOfficerTerm` → 403 on cross-org / non-officer), and returns the repo's anonymised projection. (b) Added a new member-scoped **`myBallots`** op (`GET /association/member/ballots/mine`) returning ONLY the caller's own ballots, voter-filtered by the **session** user id. (c) Added repo methods `listVotesForVoter` + `listAnonymizedVotes` (the latter omits `voterId`/`createdBy`/`updatedBy`). (d) Repointed the two frontend "my-ballots" queries to `/ballots/mine`. | `services/api-ts/src/handlers/member/governance/listBallots.ts`; **new** `services/api-ts/src/handlers/member/governance/myBallots.ts`; `services/api-ts/src/handlers/elections/repos/elections.repo.ts`; `specs/api/src/association/member/governance.tsp` (new `myBallots` op); regenerated `generated/openapi/{registry,routes,validators}.ts` + SDK; `apps/memberry/src/features/elections/components/{voting-ballot,member-election-detail}.tsx` | `[SHARED DEPENDENCY]` (generated OpenAPI + SDK via regen — additive `myBallots`; verified idempotent) | Followed API-first pipeline (`specs/api bun run build` → `services/api-ts bun run generate` → `packages/sdk-ts bun run generate`). `myBallots` handler hand-written before regen so the stub generator skipped it (0 new stubs / 456 skipped). No event payload changed. |

## B.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/member/governance/updateElection.test.ts` (new, 12 tests) | backend/unit + domain workflow | Published/cancelled → 422 `ELECTION_IMMUTABLE` with **no repo mutation**; positions change in nominationsOpen/votingOpen/awaitingConfirmation → 422 `ELECTION_POSITIONS_LOCKED`; title/positions still editable in `draft`; 401/404 guards | FIX-005 |
| `services/api-ts/src/handlers/member/governance/listBallots.test.ts` (new, 4 tests) | permission/RBAC + domain workflow | Officer view never exposes `voterId` (no voter→nominee linkage); non-officer/cross-org caller → 403; omitted `electionId` → no unscoped dump; 401 guard | FIX-003 |
| `services/api-ts/src/handlers/member/governance/myBallots.test.ts` (new, 3 tests) | permission/RBAC | Returns only the caller's own ballots, voter-filtered by the **session** id (a member cannot read another voter's ballots); empty when `electionId` omitted; 401 guard | FIX-003 |

No assertions weakened; no existing tests deleted; RED-before-GREEN confirmed for every new test.

## B.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test updateElection.test.ts` (pre-impl) | **Failed (expected RED)** | 5 pass / 7 fail — guard missing |
| `bun test listBallots.test.ts` (pre-impl) | **Failed (expected RED)** | 1 pass / 3 fail — voterId leak / no 403 / unscoped dump |
| `bun test myBallots.test.ts` (pre-impl) | **Failed (expected RED)** | missing-module error |
| `bun test updateElection.test.ts` (post-impl) | **Passed** | 12 pass / 0 fail |
| `bun test listBallots.test.ts` (post-impl) | **Passed** | 4 pass / 0 fail |
| `bun test myBallots.test.ts` (post-impl) | **Passed** | 3 pass / 0 fail |
| `cd specs/api && bun run build` | **Passed** | OpenAPI + types regenerated (pre-existing implicitOptionality deprecation warnings only) |
| `cd services/api-ts && bun run generate` | **Passed** | 0 new stubs / 456 skipped — `myBallots` handler preserved; registry/routes/validators wired |
| `cd packages/sdk-ts && bun run generate` | **Passed** | SDK regenerated (pre-existing expandable-transformer warnings only); `myBallots` additive |
| Regen idempotency (re-ran pipeline, hashed generated diff) | **Passed** | Generated diff stable across runs — deterministic pipeline output, not hand-edited churn |
| `bun test src/handlers/member/governance/` (whole dir) | **Passed** | 122 pass / 0 fail across 13 files — no regressions |
| Full `bun test` (api-ts) | **Partially Passed** | **6078 pass / 1 fail / 4 todo** — the only fail is the pre-existing, unrelated `registerEmailJobs` interval test (30000 vs 1000). +19 vs baseline (the 19 new tests), zero new failures. |
| `bun run --filter '*' typecheck` (whole monorepo) | **Passed** | exit 0, **0** `error TS` — api-ts + memberry + sdk all clean |

## B.7 Validation Summary

- **Passed:** all three new test files (RED→GREEN), the governance directory (122/122), the TypeSpec/OpenAPI build, api-ts code-gen, SDK regen, regen idempotency, and the whole-monorepo typecheck (0 errors).
- **Failed:** none attributable to this pass. The single failing command is the pre-existing, unrelated `registerEmailJobs` interval test (documented in the env baseline).
- **Not run:** Hurl contract suite (the 4 `assoc-*`/`br-50` ballot/election `.hurl` files are auth-only stubs unaffected by these handler/guard changes; their real-flow rewrite is FIX-006 / Batch D, explicitly out of this batch). E2E (reserved by the fix-ready plan for after the full lifecycle lands).
- **Pre-existing/unrelated:** the `registerEmailJobs` failure; the integration harness's benign pg `search_path` deprecation trace.

## B.8 Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Generated OpenAPI artifacts | `services/api-ts/src/generated/openapi/{registry,routes,validators}.ts` | Hono route table | governance dir 122/122; api-ts typecheck 0 errors | `[SHARED DEPENDENCY]` — additive `myBallots` (`GET /association/member/ballots/mine`); produced by regen, not hand-edited; idempotent. |
| Generated SDK | `packages/sdk-ts/src/generated/*` | both apps (memberry, admin) | memberry typecheck 0 errors | `[SHARED DEPENDENCY]` — additive `myBallots` fn/mutation/types. Frozen `check:sdk-compat` baseline `docs/quality/SDK_BASELINE_OPS.json` left **untouched** (not `--update`d — per milestone Step 6 rule). |
| `election.published` / `election.status.changed` events | domain event bus | governance consumers, M04 org-admin RBAC | n/a | **No event payload/name changed** — FIX-003/005 are read/guard-only. |
| `election_vote` table | (read-only) | — | — | No schema/migration change. New repo reads only; anonymised projection omits voter-identifying columns. |

## B.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Dual position identity (jsonb slots vs `position` FK) | FIX-002 / G2 (P0) | `[NEEDS PRODUCT DECISION]` (position-identity model) | Make the decision, then run the gated FIX-002 + Batch F pass |
| Live `cancelElection` cascade | FIX-004 / G4 (P1) | Cancelled-election **vote-retention** is `[NEEDS PRODUCT DECISION]`; deferred per continuation prompt | Resolve vote-void semantics (soft-void vs delete), then a gated FIX-004 pass — or build only the retention-agnostic cascade if it can be isolated |
| Real contract `.hurl` flows (4 auth-only stubs) | FIX-006 / G6 (P1 `[TEST GAP]`) | Batch D — out of this batch | Land alongside remaining governance fixes |
| Server visibility filters; castBallot accepted/time checks; checklist read/complete; transactional published consumer | FIX-008/009/010/011 (P2) | Batch C — out of this batch | Run Batch C after the gated P0/P1 land |

## B.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-002 coding (position identity) | `[NEEDS PRODUCT DECISION]` | Fix shape depends on FK-honored vs jsonb-slots | Product/tech decision on the identity model |
| FIX-004 cancelled-election vote retention | `[NEEDS PRODUCT DECISION]` | `deleteElection` hard-deletes votes after cancel; retention vs minimisation unresolved (feeds vote-void semantics) | Compliance/product retention decision |

## B.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-004 live `cancelElection` | (gated) | Coupled to the cancelled-election vote-retention `[NEEDS PRODUCT DECISION]`; continuation prompt directs preferring FIX-003+FIX-005 and treating FIX-004 as gated |
| Batch C (FIX-008/009/010/011), FIX-006 hurl rewrites | out of batch | Later batches |
| Tie-handling, WF-078 bylaw redesign, voter-anonymisation rearchitecture, BR-34 tenure | `V2 DEFERRED` / `[NEEDS PRODUCT DECISION]` | Per §10/§11 of the fix-ready plan |

## B.12 Files Changed (Batch B)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/governance/updateElection.ts` | Added immutability/state guard (`ELECTION_IMMUTABLE`, `ELECTION_POSITIONS_LOCKED`) | FIX-005 |
| `services/api-ts/src/handlers/member/governance/updateElection.test.ts` | **New** guard unit test (12) | FIX-005 |
| `services/api-ts/src/handlers/member/governance/listBallots.ts` | Anonymised + org-scoped admin search (no voterId; officer gate; no unscoped dump) | FIX-003 |
| `services/api-ts/src/handlers/member/governance/listBallots.test.ts` | **New** secrecy/RBAC unit test (4) | FIX-003 |
| `services/api-ts/src/handlers/member/governance/myBallots.ts` | **New** member self-read handler (session-scoped) | FIX-003 |
| `services/api-ts/src/handlers/member/governance/myBallots.test.ts` | **New** self-read RBAC unit test (3) | FIX-003 |
| `services/api-ts/src/handlers/elections/repos/elections.repo.ts` | **+** `listVotesForVoter`, **+** `listAnonymizedVotes` (voter-id-omitting projection) | FIX-003 |
| `specs/api/src/association/member/governance.tsp` | **+** `myBallots` op (`GET /ballots/mine`, association:admin+member) | FIX-003 |
| `services/api-ts/src/generated/openapi/{registry,routes,validators}.ts` | Regenerated — additive `myBallots` wiring | FIX-003 (`[SHARED DEPENDENCY]`) |
| `packages/sdk-ts/src/generated/*`, `specs/api/dist/*` | Regenerated — additive `myBallots` SDK fn/types + OpenAPI doc | FIX-003 (`[SHARED DEPENDENCY]`) |
| `apps/memberry/src/features/elections/components/voting-ballot.tsx` | Repointed my-ballots query → `/ballots/mine` | FIX-003 |
| `apps/memberry/src/features/elections/components/member-election-detail.tsx` | Repointed my-ballots query → `/ballots/mine` | FIX-003 |

## B.13 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baselines (7-fail / 3-fail / missing-module) | This report §B.3/§B.6 | FIX-005, FIX-003 |
| GREEN unit tests (12 / 4 / 3) | This report §B.6 | FIX-005, FIX-003 |
| Governance dir 122/122; full api-ts 6078/1/4; monorepo typecheck 0 errors | This report §B.6 | FIX-003, FIX-005 |
| Regen idempotency (stable generated-diff hash across re-runs) | This report §B.6 | FIX-003 |

## B.14 Completion Decision

**COMPLETE** (for the selected decision-free Batch B subset).

FIX-003 and FIX-005 are fully implemented and validated RED→GREEN. Ballot secrecy is enforced server-side: `listBallots` is now an admin-only, org-scoped, anonymised search (no `voterId` linkage, no cross-org reads, no unscoped dump), and members read their own ballots through the new session-scoped `myBallots` op — closing the silent 403/DUPLICATE_VOTE self-check failure. `updateElection` now enforces result finality (published/cancelled immutable) and freezes positions once nominations open. The API-first regen pipeline was followed (no generated files hand-edited; output proven idempotent), the frozen SDK baseline was left untouched, all governance tests pass, the full api-ts suite shows zero new failures (only the pre-existing `registerEmailJobs` baseline fail), and the whole monorepo typechecks clean. FIX-002 (P0) and FIX-004 remain **Blocked** on product decisions and were correctly not attempted. Working tree from prior AHA passes preserved; nothing committed.

## B.15 Recommended Next Step

Per the continuation todolist, the elections-governance gated work (FIX-002 position-identity, FIX-004 vote-retention) sits behind product decisions in **Track B**. Proceed to the next **Track A decision-free** pass:

- **A3. Auth/RBAC — Batch E** (FIX-010 `INVITE_TOKEN_SECRET`) + Batch B cleanup.
  - Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
  - Module slug: `auth-rbac`
  - Input fix-ready plan: `docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md`

For the remaining gated elections work: **request product decisions** for FIX-002 (position-identity model) and FIX-004 (cancelled-election vote retention), then run dedicated gated `04` passes (FIX-002 + Batch F; FIX-004). Selected P2 completeness (Batch C: FIX-008/009/010/011) follows once the gated P0/P1 land.

---

# AHA Module/Group Fix Report: Elections & Governance — Batch F (FIX-002 / G2 position identity)

> Added by AHA Step 29 (2026-06-12) after the §13 product decision landed.
> **Decision (Step 29):** honor the canonical governance `position` FK as the single
> position identity (recorded in `elections-governance-fix-ready-plan.md` §"Decisions — Step 29").

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Elections & Governance |
| Module slug | elections-governance |
| Raw gap plan used | `docs/aha/module-gap-plans/elections-governance-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` (§3 FIX-002, Batch F; §"Decisions — Step 29") |
| Output fix report | `docs/aha/module-fix-plans/elections-governance-fix-report.md` (this section) |
| Fix date | 2026-06-12 |
| Batch executed | **Batch F — FIX-002 (G2) position identity** |
| Superpowers used | No (disciplined TDD followed manually; RED→GREEN proven) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 incident); only FIX-002 lines touched, no destructive git |
| Fix scope | P0 / V1 REQUIRED |
| Out of scope | Batch B/C (FIX-003/004/005/008/009/010/011), FIX-006/007 (already landed), all §10/§11 deferred + do-not-build |
| Shared files touched | Yes — `test-utils/make-ctx.ts` (additive mock-db `.returning()`); no production shared logic changed |
| Schema/migration touched | **No** — the `position` FK already exists; honoring it (Step 29 decision) is handler/seed/FE-side, so NO migration is required (a migration was only needed for the rejected drop-the-FK fork) |
| Limitations | Pre-existing seeded election rows retain the old string[] `positions` until a fresh re-seed/reset; no production data exists pre-pilot, so acceptable. FE required no change. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-002 | G2 — dual position identity: `election.positions` jsonb slots minted random UUIDs while `election_nominee`/`election_vote.position_id` FK the canonical `position` table → every UI nomination/vote insert violated `election_nominee_position_id_position_id_fk` | P0 | V1 REQUIRED | F | Standing P0; unblocked by Step 29 decision (honor the `position` FK) | **Fixed** |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| NEW `position-identity.integration.test.ts` (real-DB) | **Failed (RED)** | FIX-002 | `createElection` slot ids were random UUIDs absent from `position` (0 rows found); nominee insert threw the FK violation — the P0 reproduced at runtime |
| api-ts `bun test` | 6030 pass / 1 fail (pre-existing email interval) | — | Baseline per roadmap §14 |
| `tsc` (api-ts) | 0 errors | — | Baseline |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-002 | New resolver maps election position **titles → real `position` rows** (find-or-create per org, case-insensitive); slots now carry the real id | NEW `handlers/member/governance/resolve-election-positions.ts` | No | Canonical identity; same org+title reuses one position row |
| FIX-002 | `createElection` uses the resolver instead of `crypto.randomUUID()` slot ids | `handlers/member/governance/createElection.ts` | No | The live P0 path |
| FIX-002 | `updateElection` (draft-only positions edit) uses the resolver instead of random UUIDs | `handlers/member/governance/updateElection.ts` | No | Prevents re-introducing orphaned FKs on draft edits |
| FIX-002 | `seedElections` embeds real `position` ids into the jsonb slots (was bare `["President",...]` strings) | `seed/layer-3-modules.ts` | No (seed) | FK-consistent seed; BR-33 min-candidate counting now groups correctly |
| FIX-002 (test infra) | `makeMockDb` insert chain now supports the standard `insert().values().returning()` | `test-utils/make-ctx.ts` | `[SHARED DEPENDENCY]` | Additive only — `await insert().values()` still resolves to undefined; enables repos that read back the inserted row under unit mocks |

**FE:** verified **no change required** — `election-detail.tsx` / `member-election-detail.tsx` / `voting-ballot.tsx` and the nominate dialogs already key off `election.positions[].id`; once that id is a real `position` row (this fix), nominate/vote payloads satisfy the FK automatically.

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| NEW `handlers/member/governance/position-identity.integration.test.ts` | integration / data-schema (real-DB scratch schema) | (1) `createElection` slot ids resolve to real `position` rows; (2) a nominee insert keyed by a slot id survives the real `position` FK; (3) same title in same org reuses one canonical position | FIX-002 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/member/governance/position-identity.integration.test.ts` | **Passed** (2 pass / 9 expect) | RED before fix → GREEN after |
| `bun test src/handlers/member/governance/ src/handlers/elections/` | **Passed** (282 pass / 0 fail) | No governance/elections regression |
| `bun test` (full api-ts) | **Partially Passed** (6173 pass / 1 fail / 3 todo) | The 1 fail is the **pre-existing** `registerEmailJobs` interval test (30000 vs 1000), documented in roadmap §14 — not introduced here |
| `bunx tsc --noEmit` (api-ts) | **Passed** (0 errors) | Baseline held |

## 7. Validation Summary

- **Passed:** the RED→GREEN FIX-002 integration proof; all 282 governance/elections tests; api-ts typecheck (0 errors); full suite held at the known baseline.
- **Failed:** only the pre-existing email-interval test (unrelated, documented).
- **Not run:** live re-seed (would only refresh dev data; seed code typechecks and the runtime model is proven by the integration test). Full Playwright lifecycle E2E (env-fragile signup `beforeAll` per roadmap §14).
- **Pre-existing/unrelated:** the 1 `bun test` failure.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Test util | `test-utils/make-ctx.ts` `makeMockDb` | every unit test using the mock db | full api-ts suite green (minus pre-existing) | `[SHARED DEPENDENCY]` — additive `.returning()`; back-compat preserved |
| Governance positions | `PositionRepository.findByOrg`/`create` | createElection, updateElection, seed | integration + unit | No schema change; reuses existing repo methods |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Pre-existing seeded elections keep old string[] `positions` | FIX-002 seed | `seedElections` skips rows that already exist by title; only fresh seeds get aligned slots | Re-seed/reset dev DB at convenience (no prod data pre-pilot) |
| FIX-004 cancelled-election vote retention | G4 | Separate product decision (vote-void semantics) | Resolve → Batch B `04` |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-004 vote retention | `[NEEDS PRODUCT DECISION]` | soft-void vs delete unresolved | Compliance/product retention call |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| `election.positions` jsonb → join-table normalization | `[DO NOT OVERBUILD]` | Slots-carry-real-id satisfies the FK for V1; a join-table rewrite is unjustified now |
| Migration / `position`-FK drop | `DO NOT ADD` | Step 29 chose to honor the FK; no schema change needed |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/governance/resolve-election-positions.ts` | NEW canonical-identity resolver (title → real position id, find-or-create) | FIX-002 |
| `services/api-ts/src/handlers/member/governance/createElection.ts` | Use resolver instead of random-UUID slots | FIX-002 |
| `services/api-ts/src/handlers/member/governance/updateElection.ts` | Use resolver for draft position edits | FIX-002 |
| `services/api-ts/src/seed/layer-3-modules.ts` | Embed real position ids in seeded election slots | FIX-002 |
| `services/api-ts/src/test-utils/make-ctx.ts` | Mock-db insert `.returning()` support (additive) | FIX-002 (test infra) |
| `services/api-ts/src/handlers/member/governance/position-identity.integration.test.ts` | NEW real-DB RED→GREEN proof | FIX-002 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED run (0 position rows; nominee FK violation) | test output captured this session | FIX-002 |
| GREEN run (2 pass / 9 expect) | `position-identity.integration.test.ts` | FIX-002 |

## 14. Completion Decision

**COMPLETE** — Batch F (FIX-002 / G2) is fixed and validated. The canonical `position`-FK identity is honored end-to-end: `createElection`/`updateElection` store real position ids, the seed is FK-consistent, the FE needs no change, and a real-DB RED→GREEN integration test proves nominee inserts survive the FK. No migration was required (the Step-29 decision selected the no-schema-change fork). Full suite held at the known baseline (only the pre-existing email-interval failure remains).

## 15. Recommended Next Step

Run the next gated `04` pass per consolidated roadmap §8 order:
**documents-credentials — Batch A verify-chain (Q1)** (decision recorded Step 29: reuse the existing credential token; do NOT invent a new `/verify/:token`).

```txt
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Module/group: Documents & Credentials
Module slug: documents-credentials
Batch: Batch A verify-chain (Q1)
```

Do NOT auto-chain — STOP here for user direction (per Step 29 stop condition).

---

# AHA Module/Group Fix Report: Elections & Governance — Step 35 (FIX-002 / Batch F reconciliation + lifecycle regression coverage)

> Added by AHA Step 35 (2026-06-13). The Step 35 continuation prompt was scoped to
> "implement FIX-002 / Batch F (honor the `position` FK) + schema/migration/seed
> alignment + openElectionVoting grouping + 3 FE dialogs." **On investigation that
> work was already shipped and verified in the Step 29 Batch F pass above.** This
> section records the reconciliation and the one genuinely-missing, non-redundant
> deliverable that was added: end-to-end regression coverage of the voting-phase
> transition handlers under the canonical identity.
>
> **Position-identity decision (carried over, flagged ratification-pending per the
> prompt's Track-B pattern):** election nominee/vote rows reference real governance
> `position(id)` rows (the FK is honored); module-local random-UUID jsonb "slots" are
> dropped as an identity source. This remains an engineering-default decision taken
> under the user's defer-to-Claude standing instruction — **pending user ratification.**

## S35.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Elections & Governance |
| Module slug | elections-governance |
| Raw gap plan used | `docs/aha/module-gap-plans/elections-governance-gap-plan.md` (context only) |
| Fix-ready plan used | `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` (§3 FIX-002/FIX-007, Batch F; §"Decisions — Step 29") |
| Output fix report | `docs/aha/module-fix-plans/elections-governance-fix-report.md` (this section) |
| Fix date | 2026-06-13 |
| Batch executed | **FIX-002 / Batch F (reconciliation) + FIX-007 lifecycle regression coverage** |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked before any change) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + AHA Steps 31–34); preserved, no destructive git |
| Fix scope | P0 (FIX-002, verified already complete) + P1 `[TEST GAP]` (FIX-007 lifecycle coverage extension) |
| Out of scope | Migration / schema change (Step 29 rationale: FK already exists — none needed), openElectionVoting/createElection/updateElection/FE changes (already correct), `certifyElection` published-cascade (Batch C / FIX-011), FIX-004 vote-retention, all §10/§11 deferred + do-not-build |
| Shared files touched | **No** |
| Schema/migration touched | **No** — explicitly NOT added; the `position` FK already exists and is honored handler/seed-side (Step 29) |
| Limitations | The new lifecycle regression test is **GREEN on already-correct code** (Step 29 shipped the fix), so it is regression/characterization coverage, **not** a RED→GREEN fix. The RED proof for FIX-002 already lives in `position-identity.integration.test.ts` (RED before Step 29). The path stops before `certifyElection` (cascade out of scope). |

## S35.2 Reconciliation — Step 35 prompt vs actual codebase

The Step 35 prompt assumed FIX-002 was un-coded. A code investigation (resolver, handlers, schema, seeds, FE, tests) found it **already implemented end-to-end**:

| Step 35 assumed-needed change | Actual state (evidence) | Action |
| --- | --- | --- |
| Add NEW migration + alter `elections.schema.ts` | FK `election_nominee/vote.position_id → position(id)` already exists (`elections.schema.ts:38,52`); `positions` jsonb carries real ids. Step 29 chose the no-schema-change fork. | **Not done** (would be net-new blast radius for no benefit) |
| `createElection` stop minting random UUID slots | Already uses `resolveElectionPositionSlots` → real `position` ids (`createElection.ts:37-40,54`) | Already correct |
| `openElectionVoting` count/group by real position id | Already groups by `pos.id` / `nom.positionId`, both canonical (`openElectionVoting.ts:44-66`) | Already correct |
| `updateElection` no UUID re-mint | Already uses the resolver for draft position edits (`updateElection.ts:60-71`) | Already correct |
| Seeds `layer-3-modules.ts` / `layer-5-gap-fill.ts` real refs | Both already resolve/fetch real `position` ids | Already correct |
| 3 FE dialogs send real `positionId` | `nominee-picker-dialog`, `self-nomination-dialog`, `voting-ballot`, `member-election-detail` already read `election.positions[].id` (now a real id) | Already correct |

**Genuine gap found:** no real-DB test drives the REAL `openElectionVoting` / `castBallot` handlers — `election-lifecycle.integration.test.ts` stopped at `closeElectionVoting`, and `position-identity.integration.test.ts` stopped at the nominee insert. The voting-phase handlers' use of canonical identity was therefore unproven end-to-end. **That gap is what this pass closes.**

## S35.3 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-002 | G2 dual position identity | P0 | V1 REQUIRED | F | Re-verify the Step 29 fix still holds at runtime | **Already Fixed (verified)** |
| FIX-007 | Real-DB lifecycle test through the voting-phase handlers | P1 `[TEST GAP]` | V1 REQUIRED | D | The one non-redundant deliverable — proves canonical identity through `openElectionVoting` + `castBallot` | **Fixed (coverage added)** |

## S35.4 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `position-identity.integration.test.ts` + `election-lifecycle.integration.test.ts` | **2 pass / 2 pass** (4 pass total, real Postgres) | FIX-002 | Confirms the Step 29 fix still holds before any change this pass |
| Voting-phase handlers (`openElectionVoting`, `castBallot`) at real-DB level | **No coverage** | FIX-007 | The gap this pass closes |
| api-ts `bun test` | 6217-ish pass / pre-existing `registerEmailJobs` interval flake | — | Documented env baseline |

## S35.5 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-007 | Extended `election-lifecycle.integration.test.ts` with: (1) a full voting-path test driving the REAL `createElection → openElectionVoting → castBallot → closeElectionVoting` handlers against real Postgres under canonical position identity (slot id resolves to a real `position` row; vote insert survives the `election_vote → position` FK; transitions persist), and (2) a negative test proving `openElectionVoting` rejects a position with `< 2` canonical-id nominees (BR-33 min-candidate guard groups by the real position id). Added `description`/`max_terms` columns to the scratch `position` table so the real `createElection` path runs. | `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` | No (test-only) | `MembershipRepository.findByPersonAndOrg` stubbed active for `castBallot`; `OfficerTermRepository` stubbed President. No production code touched. Stops before `certifyElection` (cascade = Batch C). |

**No production code, schema, migration, seed, or frontend file was changed this pass.**

## S35.6 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` (extended, +2 tests) | integration / data-schema / domain workflow | The REAL `openElectionVoting`/`castBallot` handlers operate on canonical `position` ids end-to-end: vote insert survives the FK; transitions persist (`nominationsOpen → votingOpen → awaitingConfirmation`); min-candidate guard rejects `< 2` nominees and does not mutate the row | FIX-007 (covers FIX-002) |

No assertions weakened; no existing tests deleted.

## S35.7 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test position-identity.integration.test.ts election-lifecycle.integration.test.ts` (pre-change verify) | **Passed** | 4 pass — Step 29 fix confirmed still holding |
| `bun test election-lifecycle.integration.test.ts` (post-change) | **Passed** | 4 pass / 16 expect (2 existing + 2 new) |
| `bun test src/handlers/member/governance/ src/handlers/elections/` | **Passed** | 284 pass / 0 fail across 28 files — no regressions |
| `bunx tsc --noEmit` (api-ts) | **Passed** | 0 errors |
| `bun test` (full api-ts) | **Partially Passed** | **6220 pass / 1 fail / 93 skip / 3 todo** — the 1 fail is the pre-existing `registerEmailJobs` interval flake (30000 vs 1000); zero new failures |
| `bun run --filter '*' typecheck` (monorepo) | **Passed** | all 5 workspaces (api-ts, memberry, admin, sdk-ts, ui) exit 0 |

## S35.8 Validation Summary

- **Passed:** the pre-change verification of the Step 29 fix (4/4 integration), the 2 new lifecycle tests, the full governance+elections directory (284/284), api-ts typecheck (0 errors), and the whole-monorepo typecheck (5/5 workspaces clean).
- **Failed:** none attributable to this pass. The only failing command is the pre-existing, unrelated `registerEmailJobs` interval flake.
- **Not run:** the memberry frontend test suite (no FE/SDK file was touched, so it is unaffected — running it would be unwarranted churn); `certifyElection` cascade coverage (out of scope, Batch C). No regen pipeline was run (no TypeSpec change).
- **Pre-existing/unrelated:** the `registerEmailJobs` failure; the benign pg `search_path` deprecation trace from the integration harness.

## S35.9 Shared / Cross-Module / Database Impact

None. No production, shared, schema, migration, seed, generated, or frontend file changed this pass — only one api-ts integration test file was extended.

## S35.10 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Position-identity decision is engineering-default, not user-ratified | FIX-002 | Track-B pattern — implemented under defer-to-Claude, pending explicit user sign-off | Surface for user ratification |
| `certifyElection` published winner → officer-roster cascade not covered by real-DB lifecycle test | FIX-007 extension / FIX-011 | Cascade is Batch C territory; out of this scope | Cover when Batch C (FIX-011) is run |
| FIX-004 live `cancelElection` + cancelled-election vote retention | G4 | `[NEEDS PRODUCT DECISION]` | Resolve vote-void semantics → gated FIX-004 pass |

## S35.11 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Position-identity decision finalization | `[NEEDS PRODUCT DECISION]` (ratification) | Implemented as engineering-default; not yet user-ratified | User ratifies honor-the-FK decision |
| FIX-004 cancelled-election vote retention | `[NEEDS PRODUCT DECISION]` | soft-void vs hard-delete unresolved | Compliance/product retention call |

## S35.12 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| New migration / `elections.schema.ts` alter | `DO NOT ADD` | Step 29 decision honors the existing FK with no schema change; a migration would be net-new blast radius for zero behavioral benefit |
| `createElection`/`openElectionVoting`/`updateElection`/seed/FE changes | `[DO NOT OVERBUILD]` | Already correct (Step 29) — re-doing them is redundant churn |
| `certifyElection` cascade coverage | (Batch C) | Out of FIX-002/Batch F scope |

## S35.13 Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` | +2 real-handler lifecycle/regression tests (full voting path + BR-33 min-candidate negative); +`description`/`max_terms` scratch `position` columns; +imports for `createElection`/`openElectionVoting`/`castBallot`/`MembershipRepository`/membership factory | FIX-007 (covers FIX-002) |

## S35.14 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Pre-change verify of Step 29 fix (4 pass) | This section §S35.7 | FIX-002 |
| New lifecycle tests GREEN (4 pass / 16 expect) | This section §S35.7 | FIX-007 |
| Governance+elections 284/284; full api-ts 6220/1; monorepo typecheck 5/5 clean | This section §S35.7 | FIX-002, FIX-007 |

## S35.15 Completion Decision

**COMPLETE** (FIX-002 / Batch F verified already shipped; FIX-007 regression coverage added).

The Step 35 prompt's premise — that FIX-002 was un-coded and needed a migration + handler + FE changes — was found incorrect: the "honor the `position` FK" fix shipped and was verified in Step 29 and still holds at runtime (4/4 integration). Per the AHA smallest-correct-change / no-overbuild rules, **no migration, schema, handler, seed, or frontend change was made** — re-doing already-correct work, and adding an unnecessary migration, were explicitly declined and documented. The one genuine, non-redundant gap — no real-DB coverage of the voting-phase transition handlers under canonical identity — was closed by extending the lifecycle integration test to drive the real `createElection → openElectionVoting → castBallot → closeElectionVoting` path (plus a BR-33 min-candidate negative). All validation passes with zero new failures and a clean monorepo typecheck. The position-identity decision remains an engineering-default **pending user ratification**.

## S35.16 Recommended Next Step

Position-identity (FIX-002) is implemented, verified, and now regression-covered through the voting handlers, but the decision is **ratification-pending** — surface it for user sign-off.

Then resume the gated-batch order. Candidates (do NOT auto-chain — STOP for user direction):
- **documents — Q1 card-verify token contract (P0)** — `docs/aha/prompts/04-module-or-group-fix-tdd.md`, module slug `documents-credentials`, Batch A verify-chain.
- **elections FIX-004** cancel-cascade — blocked on the cancelled-election vote-retention `[NEEDS PRODUCT DECISION]`.
- **realtime DM PD-2**.

---

# Fix Report — Step 47 re-verification (FIX-002 / G2 position identity) — 2026-06-13

## S47.1 Scope

This pass was dispatched on the premise that FIX-002 (G2 position-identity P0) and its
isolated schema/migration leg were **un-coded**. Per the AHA shared rules, the real code
was investigated before any edit. **The premise was incorrect: FIX-002 is already
implemented end-to-end** (shipped Step 29, regression-covered Step 35). This pass
re-verified the fix holds at the current working-tree HEAD and made **no production,
schema, migration, seed, or frontend change** — re-doing already-correct work and adding
an unnecessary migration were declined per the smallest-correct-change / no-overbuild rule.

## S47.2 Decision Applied

**Reference real governance `position(id)` rows** (Step 29 / Step 47 prompt, identical).
Election `positions` jsonb slots carry the real `position` row id; `election_nominee` /
`election_vote` rows FK to `position(id)` (migrations 0028/0031). The random-UUID jsonb
"slot" model is gone. No FK was dropped.

## S47.3 Code State Verified (at HEAD)

| Concern | File / evidence | State |
| --- | --- | --- |
| No random-UUID slot minting | `createElection.ts:37-40` uses `resolveElectionPositionSlots` → real `position` ids | Correct |
| Title→real-position resolver | `resolve-election-positions.ts` — find-or-create org position (case-insensitive, dedup), returns `{ id: position.id, ... }` | Correct |
| Draft position edits | `updateElection.ts:66` uses the same resolver | Correct |
| Tally / min-candidate guard | `openElectionVoting.ts` groups by `pos.id` / `nom.positionId` (both canonical); BR-33 `>= 2` guard counts by real id | Correct |
| Seeds (layer 3) | `seed/layer-3-modules.ts:66-101` resolves real `position` ids into the jsonb slots | Correct |
| Seeds (layer 5) | `seed/layer-5-gap-fill.ts:154-200` fetches real `position` rows for nominee/vote inserts | Correct |
| Frontend dialogs | `nominee-picker-dialog.tsx:24,55`, `self-nomination-dialog.tsx`, `voting-ballot.tsx`, `member-election-detail.tsx` / `election-detail.tsx` read `election.positions[].id` (now a real id) | Correct |

## S47.4 Migration

**None added.** Latest applied = `0071_training_payment_proof`; next free = `0072` (unused).
The position FK already exists (migrations 0028/0031); Step 29 chose the no-schema-change
fork. A migration here would be net-new platform blast radius for zero benefit — explicitly
declined (matches §11 `DO NOT ADD`).

## S47.5 TypeSpec / Regen

**Not run.** No TypeSpec changed — no new operations. No `specs/api` build, no `generate`.

## S47.6 Tests + RED→GREEN Evidence

RED proof is historical and lives in `position-identity.integration.test.ts` (its header
documents the pre-fix random-UUID FK violation; the FK insert succeeds only because slot
ids are now real `position` rows). This pass re-ran the nets GREEN against a reachable local
Postgres (`monobase`):

| Command (cwd) | Result |
| --- | --- |
| `bun test position-identity.integration.test.ts election-lifecycle.integration.test.ts` (`services/api-ts`) | **6 pass / 0 fail, 25 expect()** — DB reachable, not skipped |
| `bun test src/handlers/member/governance/` (`services/api-ts`) | **126 pass / 0 fail, 179 expect()**, 14 files |
| `bun test apps/memberry/src/features/elections/` (repo root) | **5 pass / 0 fail, 16 expect()**, 4 files |
| `bunx tsc --noEmit` (`services/api-ts`) | **exit 0, 0 errors** |

The two integration suites drive the REAL handlers against real Postgres rows:
`createElection → openElectionVoting → castBallot → closeElectionVoting` under canonical
identity — the vote insert survives the `election_vote → position` FK and tallies group by
the real position id. (Benign `pg` DeprecationWarning noise in output; not a failure.)

## S47.7 Remaining Gaps / Blocked

- **E2E**: `[BLOCKED BY ENVIRONMENT]` — `:3004` redirects to `/auth/sign-in`, no seeded auth.
  Proven via handler/repo/integration/component nets instead.
- **Decision ratification**: the position-identity model is an engineering default; this pass
  re-applies the same decision the prompt mandates (reference real positions), so it is no
  longer "pending" for FIX-002 purposes.
- Out of scope (untouched, by instruction): G1 close-voting (already shipped), FIX-004
  cascade, FIX-005 immutability, all §10 Deferred / §11 Do-Not-Build.

## S47.8 Completion Decision

**COMPLETE.** FIX-002 / G2 position-identity is implemented, decision-aligned (reference real
`position(id)`), and verified GREEN at HEAD across 137 tests (6 + 126 + 5) with a clean
typecheck. No migration needed (FK pre-exists). No production code changed — the deliverable
was already in the tree and is now re-confirmed correct end-to-end.
