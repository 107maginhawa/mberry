### 5.12 elections

## elections module — Wave-2 (cluster B4, realtime-admin) TDD slice plan

Floor **70** (current `.coverage-thresholds.json`: `"src/handlers/elections": { "line": 70, "function": 0 }`). Effort M. Method (locked, from `2026-06-21-test-gap-ledger.md`): characterize existing code → TDD new behavior; where a MISSING BR is a real bug, red-test then fix. **DoD priority** (§6): (1) real-PG harness that RUNS in CI → (2) MISSING BRs get real tests → (3) MISSING workflows get real-flow data assertions → (4) inter-module contracts proven against a real bus + persisted rows → (5) ratchet/HOLD floor at the real measured number → (6) fix registry drift.

**B4 framing (§2/§7):** elections is the **odd member** of the realtime-admin cluster. Unlike storage/comms/platformadmin (which already ship GENUINE real-PG harnesses and only need CI-gating + extension), elections has **ZERO integration tests** — both repo test files declare "no real Postgres needed" / "hand-crafted DB stub". This is the **only NEW real-PG harness in B4**. Per §2/§4 it must **REUSE `member/governance`'s real-PG fixture table-set and seed idioms** (`election-lifecycle.integration.test.ts`, `election-officer-term-cascade.integration.test.ts`), NOT the realtime-admin DDL — those govern unrelated comms/storage/platformadmin schemas. We keep elections in B4 for handler/ownership reasons; only its *harness source* is borrowed.

**Source facts verified (against source + live Postgres catalog `monobase`):**
- **Single repo:** `src/handlers/elections/repos/elections.repo.ts` — the one `ElectionsRepository` (§7 "integ 4→1"). It is the **live shared repo**: imported by 16 wired handlers under `member/governance/` (`castBallot`, `openElectionVoting`, `closeElectionVoting`, `certifyElection`, `createCandidate`, `listCandidates`, `myBallots`, `deleteElection`, …) AND by the dead `elections/` orphans. So the repo is production-critical even though `handlers/elections/*.ts` is not.
- **Both repo test files are the illusion:** `repos/elections.repo.test.ts` ("All database calls are intercepted by a hand-crafted db stub so no real Postgres connection is needed") and `repos/elections.repo.nominees.test.ts` ("All tests use hand-crafted DB stubs — no real Postgres needed"). Their `makeDb()` returns a chainable stub that resolves to whatever rows the test hands it — `castVote` 23505, `getVoteTallies` GROUP BY, `getVoterCount` `count(DISTINCT voter_id)`, `withdrawAllNominees` `NOT IN` filter, `voidVotesForNominee` delete, and the `listAnonymizedVotes` secret-ballot projection are **never exercised against real SQL**.
- **`handlers/elections/` is entirely UNWIRED legacy.** `app.ts:472` ("m12 elections/: entirely hand-wired. TypeSpec migration deferred") is stale — verified: NO `elections/` handler is referenced by `src/generated/openapi/routes.ts` or registered in `app.ts`. `app.ts:497` confirms `updateNomineeStatus → MIGRATED to updateCandidateStatus`; `app.ts:499` confirms `deleteElection → MIGRATED` to `member/governance/deleteElection`. The 9 `elections` matches in `routes.ts` are the **governance-wired** ops (`castBallot`, `updateCandidateStatus`, `deleteElection` at routes.ts:1025/1086/1724). So `castVote.ts`, `createNominee.ts`, `updateNomineeStatus.ts`, AND `updateElectionStatus.ts` are all dead orphans whose wired successors live in `member/governance/`.
- **`updateElectionStatus.ts` self-documents as ORPHAN** (file header lines 1–19): "implemented + tested, NOT wired (no TypeSpec operation, not in app.ts). HTTP clients cannot reach this code path." Verified: zero refs in `app.ts` / `routes.ts` / `specs/api/src`. Carries **BR-33** (min-2-candidates gate at line 48-57 + `withdrawAllNominees` cancel cascade at line 65-67 + `election.status.changed` emit at line 69-75). Its `votingOpen`/`published` branches have wired successors (`openElectionVoting`/`certifyElection` in governance); the **`cancelled` branch's `withdrawAllNominees` cascade has NO wired successor** (header lines 10-12).
- **Live catalog — tables `election` / `election_nominee` / `election_vote`:**
  - `election`: `organization_id uuid NOT NULL`, `title NOT NULL`, `type election_type NOT NULL DEFAULT 'officer'`, `status election_status NOT NULL DEFAULT 'draft'`, `voting_mode voting_mode NOT NULL DEFAULT 'online'`, `positions jsonb` (nullable). 3 CHECK constraints: `election_nominations_date_order`, `election_voting_date_order`, `election_nominations_before_voting`. `created_by`/`updated_by` **nullable**.
  - `election_status` enum: `draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled`. `nominee_status` enum: `nominated, accepted, declined, elected`.
  - `election_nominee`: `organization_id NOT NULL`, `election_id NOT NULL`, `position_id NOT NULL`, `person_id NOT NULL`, `status nominee_status NOT NULL DEFAULT 'nominated'`.
  - `election_vote`: `organization_id NOT NULL`, `election_id NOT NULL`, `position_id NOT NULL`, `nominee_id NOT NULL`, `voter_id NOT NULL`. **THE DOUBLE-VOTE BACKSTOP:** `CREATE UNIQUE INDEX election_vote_unique ON public.election_vote (election_id, voter_id, position_id)` — a voter may cast at most ONE vote per (election, position); a second raises SQLSTATE **23505**.
  - **NO anonymization column exists.** Secret-ballot (WF-077) is a **projection-level** guarantee, not a stored column: `listAnonymizedVotes` (repo lines 92-103) deliberately OMITS `voterId`/`createdBy`/`updatedBy` from its SELECT, aliasing `createdAt → castAt`. The voter IS persisted (`voter_id NOT NULL` + `vote_voter_idx`); anonymity holds only if the admin path NEVER selects `voter_id`. That projection contract is what the harness must lock.
- **Harness pattern to adopt:** `src/test-utils/pg-scratch.ts → createScratch([...])` (isolated `it_<ts>` schema, `LIKE public.<t> INCLUDING ALL` copies columns/defaults/CHECKs/**partial+unique indexes** but drops FKs, `dbReachable` skip-guard, `teardown()`). The governance fixtures predate `createScratch` and use the OLD raw-`new Pool` + hand-written DDL + `aha_fix007_<ts>` schema pattern; **borrow their SEED IDIOMS** (insert `person DEFAULT VALUES RETURNING id`; insert `position (organization_id, title) VALUES (gen_random_uuid(), 'President')`; `repo.create({status:'votingOpen', positions:[{id:positionId,...}]})`; `repo.addNominee`; `repo.castVote`) but stand the tables up via `createScratch(['election','election_nominee','election_vote','person','position'])` so the partial/unique `election_vote_unique` index is copied verbatim (the stub + the old hand-DDL fixtures both LACK it — which is exactly why the 23505 backstop is unproven).

---

### Slice 1 — NEW ElectionsRepository real-PG harness via createScratch (borrowing member/governance seed idioms) — HIGHEST LEVERAGE, DoD #1
- **axis:** integ
- **files to CREATE:** `src/handlers/elections/repos/elections.repo.integration.test.ts`
- **harness:** `createScratch(['election','election_nominee','election_vote','person','position'])` from `@/test-utils/pg-scratch` (NOT raw `new Pool`, NOT hand-written DDL). `person` + `position` are needed as `listNominees` leftJoins `person` and the seed idiom inserts a real `position` row. Guard EVERY test `if (!H.dbReachable) return;`; `afterAll(() => H?.teardown())`. Seed helpers local to the file (mirroring `election-lifecycle.integration.test.ts:199-231`): `seedPerson()` → `INSERT INTO person DEFAULT VALUES RETURNING id`; `seedPosition(orgId)` → `INSERT INTO position (organization_id,title) VALUES ($1,'President') RETURNING id`; then drive the **real** `ElectionsRepository` (`new ElectionsRepository(H.db as any)`).
- **asserts (real outcomes against Postgres):**
  - `create({organizationId, title, type:'officer', status:'draft', votingMode:'online'})` persists a row read back via `H.scopedPool` with `status='draft'`, `type='officer'`, `voting_mode='online'`, defaults applied; `get(id)` returns it; `get('<random uuid>')` returns `undefined`.
  - `list(orgId, {status:'votingOpen'})` returns ONLY rows of that org+status ordered `created_at DESC`; a second org's election (different `organization_id`) is NEVER returned — proves the `eq(organizationId)` scope binds on real SQL (org isolation).
  - CHECK enforcement: `create({..., votingOpenAt: t1, votingCloseAt: t0})` with `t0 < t1` raises Postgres `code === '23514'` from `election_voting_date_order`; `create({..., nominationsOpenAt: t1, nominationsCloseAt: t0})` → `23514` from `election_nominations_date_order`.
  - `addNominee({electionId, positionId, personId, nominatedBy, organizationId})` persists with `status='nominated'` (default); `getNominee(id)` round-trips; `updateNomineeStatus(id,'accepted')` flips the stored `status` to `accepted` and bumps `updated_at`.
- **est commits:** 2 (1 harness + create/get/list/CHECK; 1 nominee CRUD round-trip)

### Slice 2 — Secret-ballot anonymization projection: voter identity NOT linkable to choice (WF-077) — real-PG
- **axis:** BR
- **files to CREATE:** extend `src/handlers/elections/repos/elections.repo.integration.test.ts` (same `createScratch`).
- **asserts (the load-bearing privacy contract — repo lines 81-103):**
  - Seed an election + position + nominee; cast 3 votes for 3 distinct seeded voters via `castVote`. Read the stored rows directly via `H.scopedPool.query('SELECT voter_id FROM election_vote …')` → `voter_id` IS persisted and NOT NULL (proves anonymity is projection-only, not storage-level — documents the real model).
  - `listAnonymizedVotes(electionId)` (admin path) returns 3 rows; assert each returned object **has no `voterId`, no `createdBy`, no `updatedBy` key** (`Object.keys(row)` excludes them) and DOES carry `castAt` (aliased `created_at`), `nomineeId`, `positionId`, `organizationId`. This is the secret-ballot guarantee: an admin tally row can never be linked back to a voter.
  - `listAnonymizedVotes(electionId, positionId)` filters to the one position; a second position's votes are excluded.
  - Contrast (self-read is allowed): `listVotesForVoter(electionId, voterId)` returns the FULL rows for the caller's OWN voter_id including `voterId` (repo lines 81-85 — the "already voted?" self-check), and returns ONLY that voter's rows, never another voter's. Proves the deliberate asymmetry between the self-read and admin-search projections.
- **est commits:** 1

### Slice 3 — Vote tally GROUP BY + distinct voter count against real aggregation — real-PG
- **axis:** BR
- **files to CREATE:** extend the integration suite.
- **asserts (the stub returns scripted counts; this proves the real `count(*)::int` / `count(DISTINCT)` SQL):**
  - Seed 1 election, 1 position, 2 nominees (A, B). Cast 5 votes for A and 3 for B across 8 distinct seeded voters. `getVoteTallies(electionId)` returns exactly 2 grouped rows `{positionId, nomineeId, count}` with A→`count=5`, B→`count=3` (assert the integers, not just length). Proves `groupBy(positionId, nomineeId)` + `count(*)::int` (repo lines 105-111) bind on real PG.
  - `getVoterCount(electionId)` returns `8` (`count(DISTINCT voter_id)::int`, repo line 114). Then cast a SECOND vote by an already-counted voter for a DIFFERENT position (allowed — unique is per-position) → `getVoterCount` STILL returns `8` (distinct), while `getVoteTallies` row count grows. Proves DISTINCT actually dedups at SQL.
  - `getVoteTallies('<empty election uuid>')` returns `[]`; `getVoterCount('<empty>')` returns `0` (the `?? 0` guard, line 115).
- **est commits:** 1

### Slice 4 — 23505 double-vote prevention proven against the real unique index — real-PG (the backstop neither stub nor old fixture can prove)
- **axis:** integ
- **files to CREATE:** extend the integration suite.
- **asserts (the `election_vote_unique` index is copied by `createScratch`'s `INCLUDING ALL` — verify it exists then prove it fires):**
  - Pre-assert the index is present in the scratch schema: `SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname='election_vote_unique'` against `H.schema` → 1 row (guards against a future `LIKE` regression silently dropping it).
  - Cast a vote for (election, voterX, positionP). A SECOND `castVote` for the SAME (election, voterX, positionP) — different `nomineeId` — raises a Postgres error with `code === '23505'` (assert the raw `.code`/SQLSTATE off the thrown error, not a stubbed throw). This is the race-condition backstop `castVote.ts:68-74` catches and re-throws as `ConflictError`.
  - Same voter, same election, DIFFERENT position → SUCCEEDS (a second row persists) — proves the unique key is per-position, not per-election (matches `hasVoted(electionId, voterId, positionId)` semantics, repo lines 71-74).
  - DIFFERENT voter, same (election, position) → SUCCEEDS — proves the key is per-voter.
  - `hasVoted` characterization: after the first insert, `hasVoted(election, voterX, positionP)` returns `true`; `hasVoted(election, voterY, positionP)` returns `false`.
- **est commits:** 1

### Slice 5 — Cancel cascade: withdrawAllNominees + voidVotesForNominee against real rows (BR-33) — real-PG
- **axis:** integ (covers the cancel-branch cascade that has NO wired successor)
- **files to CREATE:** extend the integration suite.
- **asserts (the cascade SQL the stub can't run — repo lines 138-161):**
  - `withdrawAllNominees(electionId)`: seed 4 nominees with statuses `nominated`, `accepted`, `declined`, `elected`. Call it → returns count `2` (only the two non-terminal: `nominated`,`accepted`); read back → those two are now `status='declined'`, while the pre-existing `declined` and `elected` rows are UNCHANGED (proves the `NOT IN ('declined','elected')` filter binds at SQL, line 145).
  - `countNomineesByPosition(electionId)` (BR-33 min-candidate input, repo lines 119-131): seed 2 `nominated` + 1 `declined` nominee on positionP → returns `[{positionId:P, count:2}]` (counts ONLY `status='nominated'`, line 128). A second position with 1 nominated → its own row. Proves the GROUP BY + status filter.
  - `voidVotesForNominee(electionId, nomineeId)` (BR-33 removed-candidate vote voiding, lines 152-161): seed 3 votes for nomineeA + 2 for nomineeB. Call for nomineeA → returns `3`; read back → 0 rows remain for nomineeA, 2 still remain for nomineeB (proves the scoped DELETE, not a blanket wipe).
- **est commits:** 1

### Slice 6 — election.status.changed emit + cancel-cascade workflow (BR-33) — characterize the orphan's live BR logic via the wired path
- **axis:** inter-module
- **files to CREATE:** `src/handlers/elections/election-status-cascade.integration.test.ts` (real bus + real PG).
- **rationale:** `updateElectionStatus.ts` is the ORPHAN (Slice 7 product decision), but its BR-33 logic (min-2-candidates gate, cancel→withdraw cascade, `election.status.changed` emit) is exercised by sibling tests (24 refs per the file header). The WIRED equivalents live in `member/governance` (`openElectionVoting` covers the votingOpen min-candidate gate; `closeElectionVoting`/`certifyElection` cover other transitions). To avoid testing dead code, this slice proves the **repo-level cascade + the domain-event contract** through the real bus and real PG, and explicitly cross-references the governance integration tests for the wired transition coverage.
- **asserts:**
  - Real bus contract: capture `domainEvents.on('election.status.changed', …)` and drive the cancel cascade at the repo layer (`withdrawAllNominees`) plus an explicit emit assertion mirroring `updateElectionStatus.ts:69-75` — assert the payload shape `{electionId, organizationId, oldStatus, newStatus, changedBy}` exactly once. (If a wired `member/governance` handler emits the same event, prefer driving THAT and assert the payload; document which path is wired vs orphan in the test header.)
  - Negative/guard: `withdrawAllNominees` on an election with only terminal nominees returns `0` and emits/changes nothing (idempotent cancel).
  - Cross-reference comment: BR-33 votingOpen min-candidate gate is proven by `member/governance/election-lifecycle.integration.test.ts` ("openElectionVoting rejects a position with < 2 canonical-id nominees"); do NOT duplicate — link it.
- **est commits:** 1

### Slice 7 — PRODUCT DECISION: updateElectionStatus orphan (BR-33) — surface, do NOT silently change
- **axis:** inter-module (decision surfacing — no code change in this slice)
- **files to CREATE:** none (a documented finding folded into the B4 finalize commit + a one-line note in `ROADMAP.md` "Carry-forwards" if product chooses defer).
- **finding (verified):** `handlers/elections/updateElectionStatus.ts` is an unwired orphan (no TypeSpec op, not in `app.ts`/`routes.ts`) carrying BR-33. Its `votingOpen` min-candidate gate and `published` transition have WIRED successors in `member/governance` (`openElectionVoting`, `certifyElection`); its `cancelled`→`withdrawAllNominees` cascade has **NO wired successor**. Risk: **divergent/dead BR logic** — a future BR-33 change to the governance path won't propagate to this orphan, and the cancel cascade is only reachable via the (untested-in-prod) orphan.
- **decision required (3 options, surfaced not chosen):**
  - **(a) LEAVE** — keep as documented orphan + sibling-test anchor (status quo; the file header already argues this). Lowest effort; carries dead-code + divergence risk.
  - **(b) WIRE** — add a real `cancelElection` TypeSpec op in `member/governance` that reuses `withdrawAllNominees` (the cancel branch is the only un-wired transition), then retire this file + its dependent tests in one pass.
  - **(c) REMOVE** — delete `updateElectionStatus.ts` + dependent orphan tests; migrate the BR-33 cancel-cascade coverage onto a governance handler. Requires the ~24-ref scalpel the file header warns about.
- **recommendation:** (a) LEAVE for B4 (out of test-gap scope to wire a new endpoint), but **record the divergence risk** so a future governance change to BR-33 audits this orphan. Wave-2 makes the *repo-level* cascade REAL (Slices 5-6) so coverage is no longer mock-only regardless of the wiring decision.
- **est commits:** 0 (decision note folded into finalize)

### Slice 8 — Delete fake-db illusion tests + HOLD/ratchet floor 70 + registry drift (DoD #5/#6) — folded into B4 finalize
- **axis:** integ/BR (housekeeping)
- **files to EDIT:** delete (or gut to import-only) `repos/elections.repo.test.ts` + `repos/elections.repo.nominees.test.ts` once Slices 1-5 supersede every method they stubbed (`list`/`get`/`create`/`update`/`castVote`/`hasVoted`/`getVoteTallies`/`getVoterCount`/`listNominees`/`addNominee`/`getNominee`/`updateNomineeStatus`/`countNomineesByPosition`/`voidVotesForNominee`). Update `.coverage-thresholds.json` + `br-registry.json` + coverage-matrix.
- **asserts / actions:**
  - **HOLD floor at 70** if the new real-PG coverage supports it; measure module-min after Slices 1-6 land and set the HONEST number — do NOT lower below the real measurement, do NOT chase a higher number. If real coverage dips below 70 (e.g. the dead `elections/` orphan handlers drag the module average down once the fake-db files that incidentally covered them are deleted), set the floor to the real measured number and note WHY (orphan handlers are uncovered-by-design pending the Slice-7 decision).
  - `bun test` (api) green incl. the new CI-running `elections.repo.integration.test.ts`; `bun run typecheck` green; coverage gate green at the held/new floor.
  - `br-registry.json`: BR-33 (min-candidates + cancel cascade + vote voiding) + WF-077 (secret ballot) rows flipped from MISSING/SHALLOW (fake-db) → REAL (real-PG); no stale rows for the touched repo methods.
- **est commits:** 1 (folded into the single B4 finalize commit per the B4 plan — list here, land once)

---

**Totals:** 8 slices, ~8 commits (Slice 7 = 0 code; Slice 8 folds into B4 finalize). **Harness-first** (Slice 1) is the single highest-leverage move: it is the ONLY new real-PG harness in B4, replacing the two "no real Postgres needed" illusions, and it reuses `member/governance`'s seed idioms via `createScratch` (NOT a B4 realtime-admin rig, NOT the old hand-DDL pattern). Secret-ballot projection (Slice 2), tally GROUP BY (Slice 3), and cancel/void cascades (Slice 5) are **characterization** of correct-but-unproven SQL. The 23505 double-vote backstop (Slice 4) is the sharpest previously-unprovable invariant — the stub AND the old governance fixtures both lack the `election_vote_unique` index, so it has never fired in a test. One product decision surfaced (Slice 7): the `updateElectionStatus` orphan + its cancel-cascade BR-33 with no wired successor.
