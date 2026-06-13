# AHA Fix-Ready Plan: Elections & Governance

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Elections & Governance |
| Module slug | elections-governance |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/elections-governance-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` |
| Audit decision | FAIL |
| Superpowers used | No (organizer ran statically; gap plan already evidence-rich. Superpowers/`/using-superpowers` recommended for the `04` fix pass) |
| Organizer decision | PARTIALLY READY |
| Reason | Two P0 trust-critical blockers (G1 close-voting dead end, G2 dual position identity) plus four P1 integrity gaps are well-evidenced and fix-ready. However, the entire G2 fix shape is gated on a product/tech decision (position identity model), and several P1/P2 items need confirmation or a product call. G1 and the test-hardening (G6) work can start immediately; G2 cannot begin coding until the identity decision lands. |
| Limitations | No source edited, no tests created, no audit redone. Runtime FK-violation severity for G2 is `[NEEDS CONFIRMATION]` (static evidence strong, not run). br-registry BR-33/34/67 coverage-pointer staleness `[NEEDS CONFIRMATION]`. Candidate-status enum drift (G10) `[NEEDS CONFIRMATION]` at runtime. Files referenced in the gap plan were spot-checked (governance handlers, `governance.tsp`, `ELECTION_VALID_TRANSITIONS` util all exist); no contradictions found with the raw gap plan. |

## 2. Fix Strategy Summary

**Fix first (Batch A, P0):** The module's trust-critical lifecycle physically cannot complete through the product. Start with **G1 (add `closeElectionVoting` op)** — it needs no product decision and unblocks certification. **G2 (position identity)** is the second P0 but is blocked on a product/tech decision (reference governance `position` rows vs drop the FK and keep module-local jsonb slots); it must not start coding until that decision is made. Both P0s are one delivery story validated by a single **real-DB lifecycle integration test written RED first**.

**Fix next (Batch B, P1):** G3 (ballot secrecy + member "my ballots" + fix the 403 self-check), G4 (`cancelElection` op porting the cascade stranded in dead legacy code), G5 (`updateElection` immutability guard). These are state-machine/record-integrity gaps that directly attack election legitimacy.

**Test hardening (Batch D, P1):** G6 — replace the four auth-only stub `.hurl` files with real lifecycle/duplicate-vote/BR-50 contract flows. Land RED-first alongside the fixes they protect.

**Selected P2 V1-completeness (Batch C):** G7 (server-side visibility filters), G9 (castBallot accepted-nominee + votingCloseAt checks — tiny, pairs with G1), checklist read/complete endpoints (or explicit descope). G8 (transactional published-consumer) and G10 (enum alignment, confirm first) are lower-priority P2s.

**What NOT to fix:** Yes/No/Abstain bylaw redesign, hybrid/in-person voting, BR-34 tenure config, voter-hash rearchitecture, the 7 orphan TypeSpec committee/board interfaces, an auto-close scheduled job, a generic state-machine framework. These are V2 DEFERRED or DO NOT ADD.

**Major risks:** (1) G2 touches schema + migration + seeds + frontend + the cross-module `elections.schema.ts` consumed by seeds/preload-pristine/schema-registry — high blast radius, must be isolated. (2) The `election.published` event payload/name must not change (M04 org-admin RBAC consumer contract). (3) New ops (`closeElectionVoting`, `cancelElection`) must follow the API-first regen pipeline (TypeSpec → `bun run build` → `bun run generate`).

**One pass or multiple:** Multiple batches. G1 + G6-for-lifecycle can run in the first `04` pass. G2 must be a separate pass gated on the product decision. P1 (B) and the rest of D follow. C is last.

## 3. Active Fix Scope

Only P0 / P1 / selected P2 / V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1: State-machine dead end — no op moves `votingOpen → awaitingConfirmation`; "Close Voting" calls certify and gets 422 | P0 | V1 REQUIRED | A | Election can never be certified through the product; core trust workflow cannot complete | `certifyElection.ts:49` requires awaitingConfirmation; no setter exists; `election-detail.tsx:106-110` routes Close Voting → certifyMut; `certifyElection.test.ts:120` proves 422; `ELECTION_VALID_TRANSITIONS` (`utils/status-transitions.ts:102-109`) defined but unused |
| FIX-002 | G2: Dual position identity — election jsonb slots (random UUID/strings) vs governance `position` table FK on nominee/vote rows | P0 | V1 REQUIRED | A (coding gated on product decision; isolated DB/schema work in F) | UI-created nomination/vote inserts violate FK (likely 5xx); min-candidate guard can never pass; tallies misgroup | `createElection.ts:36-40` randomUUID jsonb; migrations 0028/0031 FKs → `position(id)`; `openElectionVoting.ts` counts by slot id; seed `layer-3-modules.ts:84` string[] wrong shape; `layer-5-gap-fill.ts:154-157` real position ids that don't match slots; dialogs send slot id as positionId |
| FIX-003 | G3: Ballot privacy + broken "already voted" check — `listBallots` exposes raw voter→nominee rows; admin-only gate 403s member self-check | P1 | V1 REQUIRED | B | Secret-ballot violation (WF-077); member already-voted UX silently fails → resubmits into DUPLICATE_VOTE | `listBallots.ts` returns raw `election_vote` rows, no org scope/voter filter; `routes.ts:764-768` admin-only; member UI calls it (`voting-ballot.tsx:70-72`, `member-election-detail.tsx:69-72`) |
| FIX-004 | G4: No live cancellation; M12-R3/AC-M12-006 cascade stranded in orphaned `handlers/elections/updateElectionStatus.ts` | P1 | V1 REQUIRED | B | A mistaken in-flight election cannot be stopped; in-flight elections are immortal (deleteElection needs draft/cancelled) | `governance.tsp` 26-op table has no cancel; `cancellation-cascade.test.ts` exercises dead code; `deleteElection.ts:828-833` |
| FIX-005 | G5: `updateElection` lacks state/immutability guard — PATCH title/dates/positions allowed on published elections; regenerates position ids | P1 | V1 REQUIRED | B | Violates M12-R2 result finality; mid-election position regeneration orphans nominee refs (compounds G2) | `updateElection.ts:34-47` no state check / new random UUIDs |
| FIX-006 | G6: Contract-test stubs masquerading as coverage — `assoc-elections`, `assoc-ballots`, `assoc-officer-terms`, `br-50-election-date-ordering` are auth-only | P1 | V1 REQUIRED `[TEST GAP]` | D | Spec §12 unmet; real lifecycle hurl would have caught G1/G2; CONTRACT_COVERAGE may count stubs as present | wc -l 25/24/24/37; HTTP verbs only `/csrf-token` + `/auth/sign-up`; headers describe nonexistent flows |
| FIX-007 | Real-DB lifecycle integration test: createElection → createCandidate → openVoting → castBallot → closeVoting → certify (no mocks) | P1 | V1 REQUIRED `[TEST GAP]` | D | The single highest-value RED test; proves both P0s and the full WF-076–079 path; no current test runs against real rows | gap plan §20 (first row); §18 (E2E never submits a transition); `openElectionVoting.test.ts` masks G2 with self-consistent fake ids |
| FIX-008 | G7: Server over-shares — drafts returned to members, tallies pre-publish, no org-membership check on getElection | P2 | V1 RECOMMENDED | C | BR-33 visibility tiers + spec §9 are trust requirements; enforcement is client-side only | `listElections.ts` no role/status filter; `getElection.ts:28` returns tallies to any authed caller, no org scope; `member-election-list.tsx:57` client filter |
| FIX-009 | G9: castBallot ignores nominee status + voting-window time | P2 | V1 RECOMMENDED | C | Votes for declined nominees count; voting continues past close until manual transition (which G1 currently blocks) | `castBallot.ts` (no `status==='accepted'` check, no `votingCloseAt` check) |
| FIX-010 | Officer-term transition checklist has no read/complete endpoint — write-only data | P2 | V1 RECOMMENDED | C | M4-R3 handover half-shipped; `TransitionChecklistRepository.findByTerm/findPending` unused | `governance.repo.ts:122-140` unused finders; no handler/route reads checklists; `transitionOfficerTerm.ts` create-only |
| FIX-011 | G8: `election.published` consumer non-transactional, fire-and-forget — partial winner-loop failure leaves stale roster | P2 | V1 RECOMMENDED | C | Certify cascade failure = published election with stale officer roster, no retry; officer RBAC reads `officer_term` live | `domain-event-consumers.ts:971-1026` single try/catch, error logged only |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A | P0 core-workflow blockers (lifecycle can complete) | FIX-001, FIX-002 | High | FIX-001 run in current `04` pass (no product decision needed). FIX-002 coding requires position-identity product decision first — split into its own pass; its DB/migration/seed portion is isolated as Batch F. |
| B | P1 reliability / trust / permission / record-integrity gaps | FIX-003, FIX-004, FIX-005 | Medium-High | Run later, after Batch A FIX-001 lands. FIX-004 + FIX-005 pair (both state-machine integrity). FIX-003 is independent and can lead. |
| C | Selected P2 V1-completeness gaps | FIX-008, FIX-009, FIX-010, FIX-011 | Low-Medium | Run later, after Batches A and B. FIX-009 may piggyback on the FIX-001 pass (tiny). FIX-011 should not change the event payload/name. |
| D | Test hardening / regression coverage | FIX-006, FIX-007 | Low (test-only, but reveals P0s) | Run now, RED-first. FIX-007 (lifecycle integration) is written first and drives Batch A. FIX-006 (real hurl flows) lands alongside the fixes it protects. |
| E | Shared/platform dependency fix | (none isolated) | — | No standalone shared/platform code change required. Cross-module *cautions* (event payload stability, membership-status reuse) are constraints on Batches A–C, documented in §7 — do not bury or expand them. |
| F | Database/schema dependency fix | FIX-002 (schema/migration/seed portion only) | High (platform blast radius) | Only after position-identity product decision. Isolated migration + seed-shape alignment; touches `elections.schema.ts` consumed by seeds/preload-pristine/schema-registry. Additive/aligning changes only. Do not co-mingle with FIX-001. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-007 | Real-DB lifecycle: createElection → createCandidate → openElectionVoting → castBallot → closeElectionVoting → certifyElection, no repo mocks | integration / domain workflow | Full WF-076–079 path completes against real rows; surfaces G1 dead end and G2 FK break | NEW: `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` (real DB harness per VERTICAL_TDD) |
| FIX-001 | `closeElectionVoting` op: valid from `votingOpen`; rejected (422) from draft/nominationsOpen/awaitingConfirmation/published/cancelled | backend/unit | New op applies `ELECTION_VALID_TRANSITIONS` and is the only path to awaitingConfirmation | NEW: `member/governance/closeElectionVoting.test.ts` (mirror `certifyElection.test.ts` state-guard style) |
| FIX-002 | Position-identity integration: nominate + open-voting + vote succeed under the chosen identity model (FK honored or slots local) | integration / data/schema | Nominee/vote inserts no longer violate `election_nominee_position_id_position_id_fk`; min-candidate guard counts correctly | Extend FIX-007 lifecycle test + NEW schema-alignment regression in `member/governance/openElectionVoting.test.ts` (replace self-consistent fake ids with realistic ids) |
| FIX-003 | "My ballots" member-scoped (returns existence only, voter-filtered); admin listing cannot read voter→choice; cross-org denied | permission/RBAC | Ballot secrecy enforced; member self-check returns 200 not 403; no voter→nominee leak | NEW: `member/governance/listBallots.test.ts` (or `myBallots.test.ts` if a new op is added) |
| FIX-004 | `cancelElection` cascade: votes voided, `election.cancelled` event emitted, members notified; invalid from published/cancelled | backend/unit | Cancellation cascade works on the live surface | NEW: `member/governance/cancelElection.test.ts` — PORT assertions from `handlers/elections/cancellation-cascade.test.ts` |
| FIX-005 | `updateElection` immutability: PATCH on published → 422; positions frozen once nominations open | backend/unit | Result finality enforced (M12-R2); positions not regenerated mid-election | Extend `member/governance/updateElection`-area tests (add `updateElection.test.ts` if absent) |
| FIX-006 | Replace 4 stub `.hurl` files with real flows: lifecycle transitions + invalid-transition 422, duplicate-vote 409/422, BR-50 PATCH 400 | contract | Spec §12 contract expectations met; stubs no longer fake coverage | `specs/api/tests/contract/assoc-elections-flow.hurl`, `assoc-ballots-flow.hurl`, `assoc-officer-terms-flow.hurl`, `br-50-election-date-ordering.hurl` (rewrite in place) |
| FIX-008 | Member role: list returns no drafts; non-officer gets no pre-publish tallies; getElection denies cross-org | backend/unit + permission/RBAC | Server-side visibility enforced, not just client filter | Extend `member/governance/governance.test.ts` or NEW `listElections.test.ts` + `getElection.test.ts` |
| FIX-009 | castBallot rejects vote for non-accepted nominee; rejects after `votingCloseAt` | backend/unit | Accepted-status + time gating | Extend `member/governance/castBallot.test.ts` |
| FIX-010 | List checklist items for a term; mark item complete; permission-gated to President/officer | backend/unit | Checklist becomes readable/completable, not write-only | NEW: `member/governance/listTransitionChecklist.test.ts` + `completeChecklistItem.test.ts` |
| FIX-011 | `election.published` consumer: partial winner-loop failure is contained/retried; transaction wraps roster mutation | backend/unit | Cascade failure does not leave a stale officer roster silently | Extend `core/domain-event-consumers.test.ts` (or NEW consumer-failure test) |

Use E2E/Playwright only for the one core journey AFTER backend fixes land: a full-lifecycle spec (create → nominate → vote → close → certify → officer roster updated) on a fresh org fixture (fixture noted at `cross-persona/president-election-tally.spec.ts:25`). Do not add E2E for minor issues.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `specs/api/src/association/member/governance.tsp` (new op), regenerated `generated/openapi/{routes,validators,registry}.ts`, NEW `member/governance/closeElectionVoting.ts`, `utils/status-transitions.ts` (use existing `ELECTION_VALID_TRANSITIONS`), `apps/memberry/src/features/elections/*` (map "Close Voting" → new op; `election-detail.tsx:106-110`, `election-status.ts`) | module-local (+ regen pipeline) | Small; one new op + frontend mapping |
| FIX-002 | `member/governance/createElection.ts`, `updateElection.ts`, `openElectionVoting.ts`; `handlers/elections/repos/elections.schema.ts`; NEW migration; seeds `layer-3-modules.ts`, `layer-5-gap-fill.ts`; dialogs `nominee-picker-dialog.tsx`, `self-nomination-dialog.tsx`, `member-election-detail.tsx` | database/schema + cross-module | High — schema consumed by seeds/preload-pristine/schema-registry; FK design fork |
| FIX-003 | `member/governance/listBallots.ts` (+ possibly NEW `myBallots.ts` op in `governance.tsp` + regen), `routes.ts` role gate, SDK type gap, `voting-ballot.tsx`, `member-election-detail.tsx` | module-local (+ shared SDK type) | Medium; SDK typing touch |
| FIX-004 | `governance.tsp` (new `cancelElection` op) + regen, NEW `member/governance/cancelElection.ts`, `domain-events.registry.ts` (`election.cancelled`), `core/domain-event-consumers.ts` (cancel consumer if needed), later delete orphaned `handlers/elections/updateElectionStatus.ts` | module-local (+ event registry) | Medium; event additive only |
| FIX-005 | `member/governance/updateElection.ts` | module-local | Small |
| FIX-006 | `specs/api/tests/contract/{assoc-elections-flow,assoc-ballots-flow,assoc-officer-terms-flow,br-50-election-date-ordering}.hurl` | module-local (tests) | Small (test-only) |
| FIX-007 | NEW `member/governance/election-lifecycle.integration.test.ts`, real-DB test harness | module-local (tests) | Small (test-only) |
| FIX-008 | `member/governance/listElections.ts`, `getElection.ts`; reuse `withComputedStatus` from member/membership | module-local (cross-module read) | Small-Medium |
| FIX-009 | `member/governance/castBallot.ts` | module-local | Small |
| FIX-010 | `governance.tsp` (checklist list/complete ops) + regen, NEW handlers, `governance.repo.ts` (existing finders), minimal officer UI | module-local | Small-Medium |
| FIX-011 | `core/domain-event-consumers.ts:971-1026` | shared/platform | Medium — shared consumer file; keep event contract stable |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-002 | database/schema | `position` table FK from `election_nominee`/`election_vote` (migrations 0028/0031) | Core of the identity fork: honor the FK vs drop it. Determines whether the fix is schema-heavy or handler/frontend-heavy | Yes — product/tech decision required before coding |
| FIX-002 | cross-module | `elections.schema.ts` (legacy dir) consumed by seeds, preload-pristine, schema-registry | A schema change ripples to seed + preload + registry in one batch | Yes — plan migration + seed alignment together |
| FIX-001, FIX-004, FIX-010, FIX-003 | environment/tooling | TypeSpec → `bun run build` → `bun run generate` regen pipeline | New ops start in `governance.tsp`; generated files must NOT be hand-edited | Yes — follow API-first sequence |
| FIX-004, FIX-011 | cross-module | `election.published` (and new `election.cancelled`) event contract ↔ M04 org-admin RBAC consumer | R2 rule: MUST NOT change event names or payload shapes; officer RBAC reads `officer_term` live | Constraint during fix (do not change existing payloads; add new event additively) |
| FIX-008, FIX-009 | cross-module | `withComputedStatus` / `computeMembershipStatus` from member/membership (BR-33/34) | Visibility + eligibility correctness rides on membership module; do not fork the logic | Reuse, do not duplicate |
| FIX-002 (governance repos) | shared/platform | `governance.repo`/`schema` consumed by core/auth officer-checks, domain-event consumers, ports, seeds, person, dues, invite, association:operations | Schema changes ripple platform-wide | Additive/aligning changes only; keep repo location per R2 |
| (out of scope) | cross-module | `listOfficerTermsSummary` is credits-owned (`credits.tsp`), not governance | Avoid double-auditing/fixing | Leave to credits audit |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Position identity model: elections reference governance `position` rows, or drop FKs and keep module-local jsonb slots | ✅ **DECIDED 2026-06-13** | FIX-002 | Determines entire G2 fix shape (schema-heavy vs handler/frontend-heavy) | **Reference real governance `position(id)` rows** (drop random-UUID jsonb slots). FK integrity restored; isolated schema/migration in Batch F. Ready for FIX-002 `04`. |
| Does UI nomination actually 5xx on FK violation in a running env? | ✅ **CONFIRMED + FIXED 2026-06-13** | FIX-002 | Confirms G2 severity empirically; static evidence strong, runtime unverified | `position-identity.integration.test.ts` reproduces the FK violation (RED proof in header) and proves the canonical-id insert now succeeds (GREEN). FIX-002 SHIPPED. |
| Are `withdrawn`/`notElected` candidate transitions reachable today (DB enum lacks them)? | `[NEEDS CONFIRMATION]` | (G10 — deferred from active scope) | Could be a latent 500; informs whether enum alignment is urgent | Confirm via a quick transition test before scheduling G10 |
| Do br-registry.json BR-33/34/67 entries point at legacy (dead) test files? | `[NEEDS CONFIRMATION]` | FIX-004 follow-up (re-anchor coverage), FIX-006 | BR coverage gate may be green on dead code | Run br-coverage; re-anchor pointers after FIX-004 ports the cascade |
| Tie in vote tally: block certification or let President choose? | `[NEEDS PRODUCT DECISION]` | (deferred) | certifyElection silently crowns first-max; not in active scope until decided | Product decision; then add to a later pass |
| Retention of votes for cancelled elections (deleteElection hard-deletes after cancel) | `[NEEDS PRODUCT DECISION]` | FIX-004 (vote-void semantics: soft-void vs delete) | M12-R1 record-keeping vs data minimization | Decide vote-void semantics as part of FIX-004 design |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-002 coding (position identity) | ✅ **DONE 2026-06-13** | Decision landed (reference real `position(id)`); shipped Step 29, regression-covered Step 35, re-verified Step 47 (6+126+5 tests GREEN, tsc clean). No migration needed — FK pre-exists (0028/0031). | — (unblocked, complete) |
| BR-34 minimum-tenure check + per-org config | `[BLOCKED BY MISSING SPEC]` | Tenure values and per-org config mechanism undefined | Product defines tenure parameters + org-config infra |
| WF-078 Yes/No/Abstain bylaw ballot redesign | `[NEEDS PRODUCT DECISION]` | Current nominee-threshold approximation works; redesign needs WF-078 semantics call | Product decision on bylaw model |
| Cancelled-election vote retention policy | `[NEEDS PRODUCT DECISION]` | deleteElection hard-deletes votes after cancel; retention vs minimization unresolved | Compliance/product retention decision (feeds FIX-004 vote-void design) |
| FIX-002 runtime severity confirmation | ✅ **CONFIRMED 2026-06-13** | FK-violation reproduced + fixed in `position-identity.integration.test.ts` against real Postgres | Done (integration tests executed GREEN) |

## 10. Deferred Items

Items not in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| G10: Align `nominee_status` DB enum with `CandidateStatus` (add withdrawn/notElected) + set notElected at certify | §13, §22, G10 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | Needs runtime confirmation that transitions are reachable; latent, not blocking. Pull into a later pass once confirmed |
| Delete orphaned legacy `handlers/elections/*` + re-anchor BR coverage pointers | §12, §22 | V1 RECOMMENDED | Must wait until FIX-004 ports the cancellation cascade (legacy handler is the only living spec of that behavior) |
| Doc sync: MODULE_SPEC.member.governance §5 tables, m12 §5 BR-44 test path, `app.ts:481` stale comment | §12, §22 | V1 RECOMMENDED (P3, cheap) | Cosmetic/doc-only; bundle into any pass that touches these files |
| Tie-handling in certify (block or President chooses) | §5, §22 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | Blocked on product decision |
| Auto-close scheduled job honoring `votingCloseAt` | G1 adjunct, §22 | V2 DEFERRED | Manual `closeElectionVoting` op (FIX-001) suffices for annual, low-volume PH elections |
| WF-078 Yes/No/Abstain bylaw model + turnout UX | §5, §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Approximation exists; redesign needs product call |
| M12-R5 hybrid/in-person vote recording | §5, §23 | V2 DEFERRED | No op/UI/demand; PH pilot is online-first |
| BR-34 per-org minimum-tenure config | §5, §23 | V2 DEFERRED `[BLOCKED BY MISSING SPEC]` | Org-config infra undefined |
| Voter-anonymization rearchitecture (hash voterId at rest) | §15, §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Unique-vote constraint needs voter identity; FIX-003 access fix addresses the practical leak |
| Election analytics/turnout dashboards, spec §17 metrics counters | §23 | V2 DEFERRED | Logs + audit details suffice for V1 |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Expand the 7 orphan TypeSpec interfaces in `governance.tsp` (Committee*, Motion*, MeetingMinutes*, BoardMeeting*, BoardResolution*) | §6, §12 | `[DO NOT OVERBUILD]` — committees live in m19/association:operations; wiring these duplicates existing behavior. Keep but do not expand |
| Generic election state-machine framework abstraction | §23 | `[DO NOT OVERBUILD]` — the `ELECTION_VALID_TRANSITIONS` table + per-op guards are sufficient |
| Performance/throughput work for elections | §17 | `[DO NOT OVERBUILD]` — PH dental elections are annual, low-volume; correctness over throughput |
| Add `status` to the `UpdateElection` PATCH body to enable close/cancel | §13 | Wrong approach — solve via explicit transition ops (FIX-001/FIX-004), not by reintroducing a state-machine bypass |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Missing state transition op; the state exists in the enum and util but no handler sets `awaitingConfirmation`. Adding the op is the true fix, not patching the frontend |
| FIX-002 | Root cause | Two competing position-identity models in the schema/code/seeds. Fixing requires picking one source of truth — root-cause, not a patch. `[NEEDS CONFIRMATION]` on runtime 5xx severity |
| FIX-003 | Root cause | `listBallots` was designed as an admin-only raw dump; member UI misuses it. Root fix = a member-scoped, choice-free endpoint + restrict the admin listing. Fixing only the SDK 403 would be a symptom patch and leave the secrecy leak |
| FIX-004 | Root cause | No live cancel op exists; cascade logic lives only in dead code. Porting it to a live op is the root fix |
| FIX-005 | Root cause | `updateElection` has no state guard. Adding the guard fixes the finality violation at the source |
| FIX-006 | Root cause | Contract files are stubs; rewriting them with real requests fixes the fake-coverage root cause |
| FIX-007 | Root cause (test) | The whole suite mocks repos / views seeded state, so structural defects are invisible. A real-DB lifecycle test is the structural fix to the test gap |
| FIX-008 | Root cause | Visibility enforced client-side only; server must filter by role/status/org. Root-cause server enforcement |
| FIX-009 | Root cause | Missing accepted-status + time checks in castBallot — straightforward additive guards |
| FIX-010 | Root cause | Checklist write path exists, read/complete path never built — half-shipped feature; build the missing half (or explicitly descope) |
| FIX-011 | Symptom-vs-root: addresses reliability | Fire-and-forget consumer is a reliability gap, not a correctness bug; wrapping in a transaction is the root-cause reliability fix. Must not change the event payload/name |

## 13. Recommended First Fix Batch

**Batch name:** Batch A (P0 core-workflow) — start with FIX-001, driven by Batch D test FIX-007.

**Included Fix IDs:** FIX-001 (close-voting op) + FIX-007 (real-DB lifecycle integration test, RED-first). FIX-002 is the second P0 but is **gated on the position-identity product decision** — do not begin FIX-002 coding in this first pass; run it as a separate `04` pass once the decision lands.

**Why this batch comes first:** The module is FAIL because the trust-critical lifecycle cannot complete end-to-end. FIX-001 removes the hard dead end (no path to `awaitingConfirmation`) and needs no product decision, so it can ship immediately. FIX-007 written RED first proves the dead end (and exposes the G2 FK break), then turns green as FIX-001 lands — giving the first concrete proof a real election can be certified through the product.

**Tests to write first (RED):**
1. `member/governance/election-lifecycle.integration.test.ts` (FIX-007) — real-DB create → nominate → open-voting → vote → close → certify.
2. `member/governance/closeElectionVoting.test.ts` (FIX-001) — valid only from `votingOpen`; 422 elsewhere.

**Explicit out-of-scope for this first batch:**
- FIX-002 coding (blocked on position-identity decision; confirm severity via FIX-007 first).
- All of Batch B (FIX-003/004/005), Batch C (FIX-008/009/010/011), and FIX-006 contract rewrites except where a lifecycle hurl directly supports FIX-001.
- Everything in §10 Deferred and §11 Do Not Build (bylaw redesign, hybrid voting, tenure config, voter-hash, orphan interfaces, auto-close job, enum alignment G10, legacy handler deletion, doc sync).

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Elections & Governance
- **Exact module slug:** `elections-governance`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md`
- **Source gap plan (context only):** `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/elections-governance-gap-plan.md`
- **Exact batch to execute first:** Batch A, scoped to **FIX-001** only, driven by **FIX-007** (Batch D). Do NOT start FIX-002 coding in this pass — it is blocked on the position-identity product decision; use FIX-007 to confirm G2 severity at runtime.
- **Tests to prioritize (write RED first):**
  1. `member/governance/election-lifecycle.integration.test.ts` (real-DB full lifecycle, FIX-007).
  2. `member/governance/closeElectionVoting.test.ts` (state guards, FIX-001).
  - Then a lifecycle/transition `.hurl` (subset of FIX-006) covering the new `closeElectionVoting` transition + invalid-transition 422.
- **Files likely to touch (FIX-001):** `specs/api/src/association/member/governance.tsp` (add `closeElectionVoting`); regenerate via `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` (NEVER hand-edit generated files); NEW `services/api-ts/src/handlers/member/governance/closeElectionVoting.ts`; reuse `ELECTION_VALID_TRANSITIONS` in `services/api-ts/src/utils/status-transitions.ts:102-109`; frontend mapping in `apps/memberry/src/features/elections/` (`election-detail.tsx:106-110`, `election-status.ts`). Restart the API server after new route registration.
- **Shared/database cautions:**
  - Follow the API-first regen pipeline for the new op; do not hand-edit `generated/openapi/*`.
  - Do NOT change the `election.published` event name or payload shape (M04 org-admin RBAC consumer contract).
  - FIX-001 is module-local; do NOT touch the `elections.schema.ts` / `position` FK in this pass (that is FIX-002 / Batch F, gated).
  - Reuse `withComputedStatus`/membership-status logic; do not fork it.
- **Items NOT to implement in this pass:** FIX-002 (blocked — product decision), all of Batch B (FIX-003/004/005), all of Batch C (FIX-008/009/010/011), the full FIX-006 stub rewrites beyond the lifecycle subset, and everything in §10 Deferred and §11 Do Not Build (bylaw Yes/No/Abstain, hybrid voting, BR-34 tenure config, voter-hash rearchitecture, the 7 orphan TypeSpec interfaces, auto-close scheduled job, enum alignment G10, deleting legacy `handlers/elections/*`, doc sync). Use `/using-superpowers` for disciplined TDD sequencing and to prevent scope creep.

Next recommended step:
Module/group: Elections & Governance
Module slug: elections-governance
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md
Recommended batch: Batch A (FIX-001 only, driven by FIX-007); FIX-002 deferred to a separate pass pending the position-identity product decision

---

## Decisions — Step 29 (2026-06-12) — G2 / FIX-002 position identity RESOLVED

User delegated to engineering judgment ("your call whats best").

**Decision: adopt the governance `position` FK as the canonical position identity.**
Election nominations/votes reference real `position` rows via the
`election_nominee_position_id_position_id_fk` foreign key. Module-local jsonb
position "slots" are the bug source (every UI nomination/vote insert violates the
FK) and are **dropped** as an identity mechanism.

- Rationale: a single canonical position table + FK enforces referential integrity;
  jsonb slots gave two competing identities and produced the runtime FK violation.
- Shape (Batch F): schema/migration to back election positions with `position` FK +
  seed real positions + FE position selector reads the canonical positions.
- Precondition before code: confirm the runtime 5xx via FIX-007 (`[NC]`) so the RED
  test reproduces the FK violation first.

**Unblocks Batch F (FIX-002).** Next: `04` pass — elections Batch F.
