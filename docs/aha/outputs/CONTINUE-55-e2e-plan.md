# CONTINUE-55 — e2e green-gate plan (root-cause settled, sized to verdict)

**Status:** PLAN-ONLY. No code touched, nothing pushed. Root-cause gate cleared with
real HTTP evidence. GO/NO-GO at the bottom — STOP for user approval before any execution.

**Date:** 2026-06-14 · **Branch context:** `aha/continue-49-subscription-billing` (HEAD `fc09141b`)

---

## 1. Step-1 ROOT-CAUSE VERDICT

**Verdict: MIXED — but the fix is harness-side (B), NOT a product auth bug (A).**
The mid-run failure is caused by **V-15 concurrent-session-limit (default 5)**, a *correct*
security feature, interacting with an e2e harness that relies on **one long-lived
`storageState` session for the entire 46-min run**. The product is not broken. No TDD
auth/session fix is required. CONTINUE-52's "session/auth degrading across the run"
hypothesis was **directionally right**; its "**403**" label was **wrong** — the real
status is **401**.

### The mechanism (proven, not theorized)

`services/api-ts/src/core/session-limit.ts` (V-15): on every new session create, if a user
has > `SESSION_LIMIT` (default **5**) sessions, the **oldest** session row is **hard-deleted**.
Wired unconditionally in `core/auth.ts:299-300` (`config.auth.sessionLimit ?? DEFAULT_SESSION_LIMIT`)
— **fires in CI**, no NODE_ENV guard.

The e2e harness captures each persona's auth **once** in `auth.setup.ts` → `.auth/<role>.json`
`storageState`, then reuses it for the whole run. That session is the **oldest**. During a
run, **30+ specs sign in again as the same seeded personas** (officer/society/treasurer) —
each mints a new session. Once 5 newer officer sessions accumulate, V-15 **deletes the
storageState session**. From that point every spec reusing it is **unauthenticated → 401**,
pages can't fetch data → render empty → `toBeVisible` timeouts cascade.

This explains **every** CONTINUE-52 symptom:
- "officer API calls fail deep into a long run" → 401 once storageState is revoked.
- "every feature passes in isolation" → < 5 officer sign-ins in isolation, cap never hit.
- "officer/ serial still fails 73/151" → serial accumulation still crosses 5.
- "fresh clean DB fails 259/721 ≈ polluted 257" → it was never dirty data; it's the
  session-revoke cascade (run-length-correlated, DB-state-independent).

### Captured HTTP evidence (direct request capture, not UI traces)

**A. Live poller during a serial `officer/` run** (fixed valid cookie hit
`GET /accredited-providers/:org` every 5 s):
```
09:05:58  200                          ← healthy for ~115 s
09:06:03  NON200 401 :: {"message":"Authentication required","code":"UNAUTHORIZED", ...}
...        401 for all 40 subsequent polls — never recovers
```

**B. Controlled isolation (pure curl, NO specs) — V-15 reproduced deterministically:**
```
wipe officer sessions; sign in #1 (J1 = oldest); probe -> 200
after signin#2: sessions=2, J1 -> 200
after signin#3: sessions=3, J1 -> 200
after signin#4: sessions=4, J1 -> 200
after signin#5: sessions=5, J1 -> 200
after signin#6: sessions=5, J1 -> 401   ← 6th sign-in hard-deletes the oldest (J1)
```
401 body verbatim: `{"message":"Authentication required","code":"UNAUTHORIZED",...}`.

### Ruled out (with evidence)
- **403 / officer-term / position** (`officer-checks.ts:42/98`): officer terms stayed
  **2 active** through the entire repro — never mutated. 403 path not the driver.
- **2FA gate** (`officer-checks.ts:53`): skipped when `NODE_ENV !== production` (`isDev`).
- **Session time-expiry**: better-auth `expiresIn` = 24 h; captured token valid until
  2026-06-20 — cannot expire in a 46-min run. (401 here is *revocation*, not expiry.)
- **Account-lockout ban** (`account-lockout.ts`): 6 wrong-password attempts on the officer
  did **not** ban (banned=`f`, probe stayed 200) — lockout inert in dev.
- **Dirty seed data**: officer terms intact; reset-mutated runs clean.

### One genuine, *separate* pre-existing issue (small, not the driver)
Early in the serial run (before any session revoke) a handful of officer pages logged
`Failed to load resource: 403 (Forbidden)` console errors — the seeded **President** persona
hitting a few endpoints gated to a different position/role. Low volume, consistent
(run-length-independent). Track in triage (§4.2), not part of the cascade.

---

## 2. Is a product (A) TDD fix required? **No.**

V-15 is working as designed (a security control; production keeps `SESSION_LIMIT=5`). There
is no auth/session defect to fix in the app. The remediation is entirely in the **e2e
harness + CI**. Skipping straight to harness work per the prompt's "If B" branch.

---

## 3. THE ACTUAL ROOT-CAUSE FIX (new Phase 0 — cheap, highest ROI)

The env var `SESSION_LIMIT` (`config.ts:156` → `:347` → `auth.ts:299`) is **not set** in CI
or the e2e webServer env → defaults to 5. Raising it in the **test environment only**
removes V-15's revocation of the storageState session.

**Phase 0 — `SESSION_LIMIT` test-env override.** Effort: **~0.5 h code + 1 measurement run.**
- Set `SESSION_LIMIT=100000` (effectively unlimited) in:
  - `.github/workflows/ci.yml` → the `e2e` job `env:` block (the API boot step).
  - the e2e webServer that boots `bun dev` (`apps/memberry/playwright.config.ts` webServer
    `command`, or a `.env` the API reads when launched by Playwright).
- Production is untouched (keeps 5). Risk: ~nil (test-env scope, additive).
- **This is expected to clear the bulk of the 259 cascade failures** by keeping every
  persona's storageState session alive for the whole run.

> Phase 0 must land **before** triage, because the 259 count is **inflated by the cascade** —
> measuring the real backlog before this fix wastes effort on phantom failures.

---

## 4. The three CONTINUE-52 sub-problems (re-sized to the verdict)

### 4.1 — Per-spec auth refresh + per-test seed isolation (G10)  ·  **re-scoped DOWN**
Original framing assumed the driver was a long-run auth rot needing per-spec re-auth. With
Phase 0, the rot is gone, so this collapses to two smaller pieces:
- **(a) Belt-and-suspenders auth durability** (~0.5–1 day, optional): make personas that get
  re-signed-in mid-run not evict the storageState — either keep `SESSION_LIMIT` high (Phase 0,
  done) OR re-capture `storageState` per spec-file via a fixture. Phase 0 alone likely
  suffices; do this only if a residual 401 appears post-Phase-0.
- **(b) `/test/seed-isolated` per-test data isolation** (G10) (**~1–2 days**): a test-only
  endpoint that provisions a throwaway org + officer per test so specs stop asserting against
  the shared seeded org. This is real backend work (route + migration **0073** + fixture +
  guard so it's disabled in prod). **DEFER until §4.2 re-measure proves data-presence
  failures remain** after Phase 0. May shrink to "a few mutating specs opt into isolation"
  rather than a suite-wide rebuild.

### 4.2 — Triage the pre-existing backlog  ·  **MUST re-measure after Phase 0**
The "259/721" is **not** 259 independent bugs — an unknown majority is the V-15 cascade.
Sequence:
1. Land Phase 0. Run the **full memberry suite on a fresh DB** once. Capture the **new**
   failure count + per-spec list (this is the real backlog).
2. Calibrate the residual on a sample (each in isolation, `--workers=1`):
   - **UI-selector drift** (mechanical, ~10–20 min/spec): known offenders
     `officer/communications.spec.ts:55/72/135` (status-badge class match, create→detail→
     publish, "Back to Communications" text), `journeys/communication-delivery.spec.ts`
     seeded-title `getByText`. Static analysis estimated ~47% of pre-Phase-0 failures —
     expect this share to *rise* as the cascade is removed.
   - **Data-presence** (depends on §4.1b): specs asserting seeded rows visible.
   - **Genuine bugs** incl. the early-run 403 authz mismatch (§1) — estimated ~10%.
3. Fix UI-drift + genuine bugs (TDD on any handler touched). Effort **sized after
   re-measure** — honest range **1–3 days** depending on residual count.

### 4.3 — Shard < 30 min + decouple coverage-gate  ·  **only after green**
CI today (`.github/workflows/ci.yml`): one monolithic **`e2e`** job (L42, `timeout:30`) runs
**both** memberry (L144 `bun run test:e2e`) **and** admin (L166) sequentially → 30-min
timeout. `coverage-gate` (L407, `needs:[lint-typecheck,e2e]`) and `ci-gate` (L516,
`needs:[...,e2e,...]` with verbatim `needs.e2e.result` checks at ~L545) depend on the job
**named `e2e`**.
- **Decouple coverage-gate now** (~15 min): change L410 `needs:[lint-typecheck,e2e]` →
  `needs:[lint-typecheck]`. Its checks (BR-coverage, CSRF drift) don't depend on e2e and are
  currently skipped whenever e2e times out. Low risk, do early.
- **Shard** (~0.5–1 day, after green): split into `e2e-memberry` matrix `shard:[1..6]`
  (`bunx playwright test --shard=N/6`, each its own postgres+minio+API+app, `fail-fast:false`,
  workers=2 per shard) + `e2e-admin` (workers=1). Add an aggregator job **named `e2e`**
  (`if:always()`, `needs:[e2e-memberry-*, e2e-admin]`, fails unless all pass) so `ci-gate` /
  `coverage-gate` keep working **without renaming `e2e`**. Tradeoff: ~6–7× CI minutes/run
  (already accepted). **Cross-app note:** memberry + admin share one DB and seeded personas;
  separate-service shards also remove the cross-app session-accumulation aggravator.

---

## 5. Sequencing + total effort (honest, multi-session)

| # | Step | Effort | Gate |
|---|------|--------|------|
| 0 | `SESSION_LIMIT` test-env override | 0.5 h + 1 run | **do first** |
| 1 | Decouple `coverage-gate` from `e2e` | 0.25 h | parallel, low-risk |
| 2 | Re-measure full suite on fresh DB | 1 run (~46 min) | **decision point** |
| 3 | Triage + fix UI-drift + genuine bugs (incl. early 403) | 1–3 days | sized at step 2 |
| 4 | G10 `/test/seed-isolated` (mig 0073) — **only if** residual data-presence | 1–2 days | conditional |
| 5 | Shard matrix + `e2e` aggregator | 0.5–1 day | after green |

**Honest total: ~2–4 days if Phase 0 clears most; ~4–6 days if a deep genuine backlog
remains.** Multi-session regardless. The big swing is step 4 (G10), which Phase 0 may make
unnecessary or much smaller — **don't commit to it until step 2 re-measures**.

---

## 6. GO / NO-GO

**Recommendation: GO on Phase 0 + step 1 + re-measure (≈ 1 hour of work + 2 CI/local runs),
then RE-DECIDE the rest at the step-2 decision point. NO-GO (defer) on the heavy G10 +
sharding work until re-measure proves it's needed.**

Rationale:
- The root cause turned out to be a **one-line config override**, not a multi-day rebuild.
  Spending ~1 h to potentially clear ~200 cascade failures is unambiguously worth it and
  **de-risks every downstream estimate**. Doing the big isolation/sharding work *before*
  this measurement would be planning against a phantom number.
- **Not release-blocking:** `e2e` is non-required (branch protection unavailable on this
  plan) and the relevant PRs already merged. So there's no urgency forcing the full
  multi-day push now — but Phase 0 is cheap enough to do regardless.
- **Independent of the open AHA P0 product decisions** (G2 elections, Q1 documents) — this
  work neither needs them nor unblocks them. They remain user-owned blockers (§8).

If the user wants a single call: **approve Phase 0 + coverage-gate decouple + re-measure as
one small slice; hold sharding/G10 for a follow-up sized by the re-measured backlog.**

---

## 7. Parallel non-code TODO (out of scope here, flagged)
- **`Deploy` job red = ghcr.io push perms** — GitHub **org → Packages** settings toggle
  (grant Actions `packages: write` / allow org-package create). One-time settings change,
  **not code**. Owner: repo admin.

## 8. Blockers needing a USER decision (not engineering)
- **G2 elections** — position-identity model (FK vs jsonb). Product decision.
- **Q1 documents** — card-verify token format. Product decision.
  Both are independent of this e2e work; listed for milestone tracking only.

---

## 9. Execution ground rules (if GO — from CONTINUE-52)
Branch off the current branch (PR #8 lineage) — **do not push to `main`**. TDD on any
handler touched; no fake-green. Migrations hand-written, next **0073**, idempotent + journal
(**no `db:generate`**). Never edit `generated/**` except migrations. Preserve the dirty
tree; pre-commit passes **without** `--no-verify`. End commits with
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Re-verify each batch on a fresh DB.

## Appendix — repro artifacts (this session, local)
- Probe endpoint: `GET /accredited-providers/ed8e3a96-8126-4341-be42-e6eb7940c562` (President-gated).
- Officer persona: `test@memberry.ph` / `TestPass123!` (person id `aacbd559-…-84bf1cbd`).
- Poller log: `/tmp/c55-poll.log` (200→401 transition at poll #23→24).
- V-15 isolation: `SESSION_LIMIT=5`, 6th sign-in deletes oldest session → 401.
- Evidence files: `officer-checks.ts:42`, `session-limit.ts:18/53-66`, `auth.ts:299-300`,
  `config.ts:156/347`, `reset-mutated.ts` (restores only org+association), `ci.yml` L42/L407/L516.
