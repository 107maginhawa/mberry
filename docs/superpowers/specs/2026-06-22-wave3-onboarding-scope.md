### onboarding

## onboarding module — Wave-3 (cluster peripheral) TDD slice plan

Floor currently **15** (`.coverage-thresholds.json:26` → `"src/handlers/onboarding": { "line": 15 }`). Target ratchet **toward 40** (peripheral tier). Effort **S** — 2 handlers, 1 repo (3 methods), 1 table. Method (locked, mirrors Wave-1/2 ledger): characterize existing code → TDD new behavior; where a MISSING BR is a real bug, red-test then fix the RIGHT layer. Asserts MUST be real DATA (persisted rows, SQLSTATE 23502/23505, emitted domain-event payloads), never `toBeDefined`/200-only. Guard every real-PG test with `if (!H.dbReachable) return;`. DoD priority: (1) real-PG harness on `createScratch` → (2) MISSING BRs real tests → (3) MISSING workflow real-flow → (4) inter-module contract → (5) ratchet floor → (6) fix registry drift.

**Source facts verified (against source + live catalog):**
- One table: `onboarding_state` (`repos/onboarding.schema.ts`). Live catalog (`\d onboarding_state`) confirms: `organization_id uuid NOT NULL` + **UNIQUE CONSTRAINT `onboarding_state_organization_id_unique`** (one state per org) + FK `onboarding_state_organization_id_organization_id_fk → organization(id) ON DELETE CASCADE`; `current_step integer NOT NULL DEFAULT 1`; `steps_completed jsonb NOT NULL DEFAULT '[]'::jsonb`; `completed_at timestamptz NULLABLE`; `version integer NOT NULL DEFAULT 1` (optimistic lock, never bumped by repo); `created_by`/`updated_by` uuid **NULLABLE**; index `idx_onboarding_organization_id`. **No Drizzle `.notNull()` vs live-NULLABLE drift** — schema (`onboarding.schema.ts:25-37`) exactly matches the live catalog (org_id notNull+unique, created_by/updated_by nullable via `baseEntityFields` at `core/database.schema.ts:24-25`). So the B4 drift class (a `.notNull()` the live DB doesn't enforce) does NOT apply here — no migration needed.
- Repo `OnboardingStateRepository` (`repos/onboarding.repo.ts`): 3 methods — `findByOrg(orgId)` (eq filter, limit 1), `create(NewOnboardingState)` (insert returning), `update(orgId, {currentStep,stepsCompleted,completedAt})` (set + bump `updatedAt:new Date()`, returning). No transaction, no FOR UPDATE, no version bump.
- Handler `getOnboardingState.ts` (GET /onboarding/state): inline officer check via `OfficerTermRepository.findActiveByPersonAndOrg(user.id, orgId)` → `ForbiddenError` if empty (lines 30-34); 404 `NotFoundError('OnboardingState')` when no state (line 38). Route (`generated/openapi/routes.ts:3395-3399`) has **only** `authMiddleware({roles:["user"]})` + query validator — **NO `requireOfficerMiddleware`**. The officer gate for GET lives ENTIRELY in the handler. (Contrast: PUT route DOES have middleware.)
- Handler `updateOnboardingStep.ts` (PUT /onboarding/step): BR M01-004 ordering — bootstrap requires `step===1` else `BusinessLogicError('M01-004')` (lines 36-40); reject `step > state.currentStep` (lines 52-57); advances `currentStep=step+1` only when `step===state.currentStep` and `step<TOTAL_STEPS=5`; final step sets `completedAt=new Date()` + clamps `currentStep=5`; dedups+sorts `stepsCompleted` (`new Set(...).sort`); emits `onboarding.completed` exactly once on the wasComplete→nowComplete transition (lines 86-91). Route (`routes.ts:3402-3408`) has `authMiddleware` + audit + json validator + `requireOfficerMiddleware({orgIdFrom:"body", bodyField:"orgId"})` — handler does NOT re-check officer (test comment lines 146-147 confirm middleware owns it).
- Existing unit test `onboarding.test.ts` (148 LOC, real `stubRepo`/`makeCtx`, NOT a fake-db illusion): covers GET officer/404/403/401 + PUT bootstrap/out-of-order/skip-ahead/final-emit/no-re-emit. These are GENUINE characterization (stub the repo, drive the real handler). Keep them. Gap: they assert handler logic only — never the real SQL, the UNIQUE/NOT-NULL constraints, the dedup/sort against persisted jsonb, or `updatedBy` threading.
- Existing integration test `repos/onboarding.repo.integration.test.ts` is **real-PG but TWO illusion smells**: (a) raw `new Pool` seeding the **shared `public` schema** (lines 35-47), NOT `createScratch` — the B4 LESSON hand-rolled pattern that masks live drift; (b) **CI-gated** via `if (process.env['CI']) { return; }` (line 34) — so it NEVER runs in CI. It covers only findByOrg miss/hit, create-defaults, update-partial, update-miss. It does NOT assert the UNIQUE constraint (23505), org_id NOT NULL (23502), the jsonb default round-trip, or FK cascade. Its own header comment (lines 30-33) flags it should migrate to the scratch-schema pattern.
- `onboarding.completed` domain event: declared in `core/domain-events.registry.ts:473-476` (`{organizationId, officerId}`) and emitted at `updateOnboardingStep.ts:87`, but **`grep` finds ZERO `domainEvents.on('onboarding.completed', ...)` consumer** anywhere in `src/` (not in `core/domain-event-consumers.ts`). The event is fired into the void today.

---

### Slice 1 — Migrate the repo integration test onto `createScratch` + un-gate from CI (DoD #1 harness)
- **axis:** integ (harness — converts "real but CI-skipped + shared-public + hand-seeded" → "real, isolated, runs in CI")
- **files to CREATE/REPLACE:** rewrite `src/handlers/onboarding/repos/onboarding.repo.integration.test.ts` in place.
- **change:** replace `new Pool` + `if (process.env['CI']) return` + manual `INSERT INTO organization` seeding with `H = await createScratch(['onboarding_state'])` from `@/test-utils/pg-scratch`. `LIKE public.onboarding_state INCLUDING ALL` copies the UNIQUE index + NOT NULL + jsonb default; **FKs are dropped by `LIKE`**, so no `organization` parent row is needed (the current test's whole org-seed dance disappears). Keep `if (!H.dbReachable) return;` per test; `afterAll(() => H?.teardown())`.
- **asserts (real persisted rows / real SQL — preserve existing green, now in CI):**
  - `findByOrg(missingOrg)` → `undefined` before any create.
  - `create({organizationId, currentStep:1, stepsCompleted:[1], createdBy, updatedBy})` persists; read-back via `H.scopedPool.query('SELECT * FROM onboarding_state WHERE organization_id=$1', [org])` confirms `current_step=1`, `steps_completed='[1]'::jsonb`, `version=1`, `created_by`/`updated_by` round-tripped.
  - `create({organizationId})` with NO currentStep/stepsCompleted → persists with **DB defaults** `current_step=1`, `steps_completed=[]` (proves the live `DEFAULT 1` / `DEFAULT '[]'::jsonb` actually fire — the current test always passes them).
  - `update(org, {currentStep:3, stepsCompleted:[1,2,3], completedAt})` returns the row with those values AND bumps `updated_at >= prior updated_at`; read-back confirms persistence (jsonb array equality).
  - `update(missingOrg, {currentStep:2})` → `undefined` (no row matched).
- **est commits:** 1

### Slice 2 — Per-org UNIQUE + org_id NOT NULL constraint proofs (BR: one state per org)
- **axis:** integ (covers BR: org-scoped singleton; M01 "one OnboardingState per organization")
- **files to CREATE:** extend `repos/onboarding.repo.integration.test.ts` (same `createScratch` suite).
- **asserts (real SQLSTATE against the live constraints):**
  - **23505 per-org uniqueness:** `create({organizationId: ORG})` then a SECOND `create({organizationId: ORG})` (different id) → loser raises Postgres `code === '23505'` from `onboarding_state_organization_id_unique`. Assert the raw error code, not a stubbed throw. (Proves the per-org singleton invariant the schema comment promises — currently untested.)
  - **23502 org_id NOT NULL:** `H.db.insert(onboardingStates).values({} as any)` / omit `organization_id` → `code === '23502'` on `organization_id`. (Confirms the live NOT NULL fires; characterization — schema already declares it, no drift.)
  - Positive: two DIFFERENT orgs each get their own state row (no false collision) — `findByOrg(orgA)` and `findByOrg(orgB)` return distinct ids.
- **est commits:** 1

### Slice 3 — `updateOnboardingStep` ordering + dedup/sort BRs against REAL repo+PG (M01-004 end-to-end)
- **axis:** BR
- **files to CREATE:** `src/handlers/onboarding/updateOnboardingStep.integration.test.ts` (thin handler-level test driving the REAL `OnboardingStateRepository` over `createScratch(['onboarding_state'])`, NOT `stubRepo`; stub ONLY `OfficerTermRepository`/auth via `makeCtx` — but note the PUT handler does not call officer inline, so just provide a `user` + `database=H.db`).
- **rationale:** the existing unit test proves the branch logic against a stub; this proves the SAME BRs land as real persisted rows (the `Set(...).sort` dedup against a real jsonb column, the currentStep advance actually written, completedAt actually stamped).
- **asserts (real persisted state, read back via `H.scopedPool`):**
  - Bootstrap: fresh org, `step:1` → row created with `current_step=2`, `steps_completed='[1]'`, `created_by=updated_by=user.id` (verify `createdBy`/`updatedBy` ARE threaded — handler passes them at `updateOnboardingStep.ts:46-47`; the current real-PG test never checks this).
  - Out-of-order bootstrap: fresh org, `step:3` → `BusinessLogicError` code `M01-004`, and **NO row persisted** (`SELECT count(*)` === 0 — proves the guard fires before any insert).
  - Skip-ahead: seed `currentStep=2`, save `step:4` → `M01-004`, row unchanged (`current_step` still 2).
  - Re-save an earlier completed step: seed `currentStep=3, stepsCompleted=[1,2]`, save `step:1` → `current_step` stays 3 (no advance, since `step !== currentStep`), `steps_completed` stays `[1,2]` deduped (1 already present, no duplicate), and the row is read back to confirm the jsonb has no `[1,1,...]` duplication.
  - Sort/dedup: seed `currentStep=3, stepsCompleted=[3,1]` (out of order in DB), save `step:3` → persisted `steps_completed=[1,3,3?]`→ assert it is `[1,3]` sorted+deduped (the `Array.from(new Set(...)).sort` at lines 61-63 produces a clean sorted array in the real column).
- **est commits:** 2

### Slice 4 — Final-step completion + `onboarding.completed` emit-once contract (real-PG + real bus)
- **axis:** workflow
- **files to CREATE:** extend `updateOnboardingStep.integration.test.ts` with a completion block driving the real repo + a real `domainEvents.on` listener (capture payload, then remove listener in `finally`).
- **asserts:**
  - Seed `currentStep=5, stepsCompleted=[1,2,3,4], completedAt=null`; save `step:5` → persisted row has `completed_at IS NOT NULL`, `current_step=5`, `steps_completed=[1,2,3,4,5]`; listener captured **exactly one** `onboarding.completed` with `{organizationId: ORG, officerId: user.id}` (assert the real payload shape against the registry type `domain-events.registry.ts:473`).
  - Idempotent completion: re-save `step:5` on the already-completed row → `completed_at` UNCHANGED (the `completedAt ?? new Date()` keeps the original, line 74) and listener captures **ZERO** new emits (the `nowComplete && !wasComplete` guard at line 86). Read back to confirm `completed_at` timestamp did not move.
- **est commits:** 1

### Slice 5 — `getOnboardingState` officer-gate + 404 against real repo (the GET route has NO officer middleware)
- **axis:** workflow / inter-module (the inline officer check is the ONLY gate for GET)
- **files to CREATE:** `src/handlers/onboarding/getOnboardingState.integration.test.ts` (real repo over `createScratch`; stub `OfficerTermRepository.findActiveByPersonAndOrg` to flip officer/non-officer).
- **rationale:** unlike PUT, the GET route (`routes.ts:3395-3399`) has **no `requireOfficerMiddleware`** — `getOnboardingState.ts:30-34` is the sole authorization. Worth proving end-to-end with a real persisted state, because a regression that drops the inline check would silently expose org onboarding progress.
- **asserts:**
  - Officer (stub returns `[{id, organizationId}]`) + a seeded state row → response body `{currentStep, stepsCompleted (real jsonb array), completedAt (ISO or null)}` matches the persisted row read back via `H.scopedPool`.
  - Officer + NO state row → `NotFoundError('OnboardingState')` (line 38).
  - Non-officer (stub returns `[]`) → `ForbiddenError` AND the handler never reads the state (the officer check precedes the repo call, lines 31-37) — assert the ForbiddenError fires even when a state row EXISTS for that org (proves the gate is not bypassable by a populated row).
  - Unauthenticated (`user:null`) → 401.
- **est commits:** 1

### Slice 6 — Inter-module: surface the orphan `onboarding.completed` event (contract gap, product decision)
- **axis:** inter-module
- **files to CREATE:** extend `updateOnboardingStep.integration.test.ts` with a one-test contract assertion.
- **asserts / finding:** there is currently **NO `domainEvents.on('onboarding.completed', ...)` consumer** in `core/domain-event-consumers.ts` or anywhere in `src/` — the event is emitted into the void. This is NOT a confirmed bug (M01 may intentionally have no downstream side-effect yet), so: assert the CURRENT behavior (emit fires, zero consumers act) and **flag in the commit as a product decision** — should completing onboarding trigger anything (e.g. a notification to the officer, a platform-admin "org activated" signal, analytics)? Do NOT silently add a consumer. Mirror the booking B1 Slice-7 precedent (missing `booking.created`/`booking.rejected` consumers raised, not fixed). One test documents "emit is currently unconsumed".
- **est commits:** 1

### Slice 7 — Ratchet floor + fix registry/coverage drift (DoD #5/#6) — FOLD INTO Wave-3 finalize
- **axis:** integ/BR (housekeeping)
- **edit:** `services/api-ts/.coverage-thresholds.json:26` — raise `src/handlers/onboarding` `line` from **15** toward **40** to the actual measured module-min line% after slices 1-6 land (set the real number, no number-chasing; module-min is likely dragged by `onboarding.schema.ts` — set just below it). Update `br-registry.json` / coverage-matrix entries for the onboarding BRs/workflows now backed by real tests (M01-004 ordering, per-org uniqueness, completion emit-once, GET officer gate, the un-gated repo integration suite). Drop any stale "MISSING/SHALLOW/CI-skipped" rows for these items.
- **asserts:** `bun test` (api) green incl. the now-CI-running integration suite; coverage gate passes at the new floor; registry has no stale "MISSING" rows for items this plan made REAL.
- **NOTE:** this slice is folded into the single Wave-3 finalize commit (shared with marketplace/advertising/audit/jobs) — list it, do not commit standalone.
- **est commits:** folded (0 standalone)

---

**Totals:** 6 working slices (+1 folded finalize), ~7 commits. **Harness-first** (Slice 1) is the highest-leverage move — it un-gates the only integration test from CI and migrates the hand-seeded shared-public pattern onto isolated `createScratch`, then Slices 2-6 add the missing constraint/BR/workflow/contract proofs the stub-only + CI-skipped tests can never give. **No real bug found in source** (no schema drift — schema matches live catalog exactly; both handlers' logic is SQL-correct and the officer gates are present). The sharpest gaps are test-fragility (CI-gated + hand-DDL/shared-public integration test) and characterization (untested UNIQUE/NOT-NULL constraints, dedup-against-real-jsonb, emit-once). One contract gap surfaced for product decision: `onboarding.completed` has zero consumers (Slice 6).
