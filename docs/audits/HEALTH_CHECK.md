# HEALTH_CHECK.md — Test Suite Baseline

**Captured:** 2026-06-04
**Plan:** docs/audits/TEST_REMEDIATION_PLAN.md (Phase 1.1 → 1.2)
**Raw logs:** `.audits/*.log` (gitignored)

## Suite Status Summary

| Suite | Status | Pass | Fail | Skip | Todo | Notes |
|---|---|---|---|---|---|---|
| `bun run typecheck` (5 workspaces) | ✅ GREEN | 5/5 | 0 | — | — | ui, admin, sdk-ts, api-ts, memberry all exit 0 |
| BE unit (api-ts) | ✅ GREEN | 6057 | 0 | 93 | 20 | 549 files, 12501 expects, 19s |
| BE integration (api-ts) | ✅ GREEN | 23 | 0 | 93 | 1 | 11 files, but 93 skipped under API_AVAILABLE guard |
| FE memberry unit | ✅ GREEN | 633 | 0 | 0 | 0 | 97 files via isolated polluter runner, 20s |
| FE admin unit | ✅ GREEN | 57 | 0 | 0 | 0 | 12 files, 418ms |
| `bun run lint:no-skips` | ❌ RED | — | 14 | — | — | Silent skips not approved |
| `bun run lint:shallow` | ❌ RED | — | 1 | — | — | meaningless-true assertion |
| `bun run test:br` | ⚠️ PARTIAL | 42 | — | — | — | 21 INCOMPLETE, 8 UNTESTED, 6 DEFERRED (of 77 BRs) |
| Hurl contract suite | ❌ RED | 6 | 93 | — | — | 93/99 files fail. **CATASTROPHIC**. |
| E2E memberry | ❌ RED (timeout) | partial | partial | — | — | 662 tests planned, killed at ~57. First fails at #17. |
| E2E admin | ⏸ NOT RUN | — | — | — | — | Will run after memberry stabilized |

## Hard Failures (P0 — must fix)

### F1. Contract suite 94% failure rate
**Symptom:** 93/99 `.hurl` files fail. Most assertions reduce to one of three patterns:
- `POST /persons` returns **403** when spec expects **201 / 400**
- `POST /auth/sign-in/email` returns **401** when spec expects **200**
- `POST /read-all` returns **403** when spec expects **401**

**Root-cause hypothesis (single):** The contract runner's `ensureAdminSession()` preflight is succeeding (token captured) but per-scenario requests don't propagate the admin cookie, OR a new auth middleware rejects `POST /persons` regardless of admin role. Fixture users for `auth/sign-in/email` scenarios were never seeded into the running DB.

**Evidence:** All 401 failures are at sign-in step (line 13-18 of multi-step flows). All 403 failures are at POST /persons (line ~20-30). Pattern is structurally identical across modules, indicating one upstream change broke the cohort.

**Required investigation order:**
1. `git log --oneline -- services/api-ts/src/middleware specs/api/tests/contract` last 30 days
2. Confirm `AUTH_ADMIN_EMAILS` includes `admin@contract-tests.local` in current env
3. Manually exercise `POST /persons` with admin cookie via curl — does it 201?
4. Inspect contract runner's `--variable` injection — is `admin_token` actually being attached?

**Additional contract issues (separate):**
- `security-officer-auth.hurl:11` — undefined `{{timestamp}}` variable (never declared in runner). Add to runner OR replace with `{{suffix}}`.
- `auth-verification.hurl` — Mailpit search returns empty for `to:verify-{{suffix}}@example.org`. Either app doesn't enqueue the mail or Mailpit clock is stale. 15s wasted per run.

### F2. E2E memberry — pervasive 403 + heading mismatches
**Symptom:** Of the first 57 of 662 executed tests:
- Console capture flags `[3 console errors] Failed to load resource: 403 (Forbidden)` on multiple fresh-signup flows (e.g., `cross-role-tests.spec.ts:10`, `comms-elections-actions.spec.ts:73`)
- `officers-admin-actions.spec.ts:23` fails on `getByText(/Officer Dashboard/i)` — UI label probably renamed OR navigation gating changed (member redirected away before page renders)
- Many "cleanup" tests at end of file fail because preceding tests left no fixtures to clean

**Root-cause hypothesis:** Same auth-middleware change as F1 propagates to UI. Members get 403 on data fetches that previously returned 200, so dashboards render empty / redirect, breaking heading assertions.

**Evidence:** Same module (`officers-admin-actions`) shows full failure cascade — test #17 to #57 all failing identically.

**Note:** Test #57 reached the boundary. Run was killed at ~9 min. Full E2E count is 662 (chromium + mobile projects combined), not 42 spec files — playwright lists each `test()` block.

### F3. `lint:shallow` — 1 finding
- `services/api-ts/src/core/domain-events.test.ts:88` — `expect(true).toBe(true)` (meaningless-true)
- **Fix:** Replace with real invariant or `test.todo()` with reason.

### F4. `lint:no-skips` — 14 findings
Two categories:

**Category A — Conditional describe.skip on API_AVAILABLE (8 occurrences, BE):**
- `services/api-ts/src/tests/{audit-integration,smoke,email-integration,seed-users,position-rbac,route-protection-association,route-protection-idor,helpers/api-as}.test.ts`
- Pattern: `const d = API_AVAILABLE ? describe : describe.skip`
- **Why exist:** Integration tests need a live API. They silently skip when API isn't on `localhost:7213`.
- **Fix:** Replace with explicit `describe.skip(condition, "API_AVAILABLE=false — start api-ts dev server before running")` or move behind a separate `test:integration:live` script and treat failure as expected when API down. Whichever is decided, lint must approve.

**Category B — Unconditional test.skip (6 occurrences, E2E):**
- `apps/memberry/tests/e2e/journeys/training-lifecycle.spec.ts:196, :227`
- `apps/memberry/tests/e2e/member/event-cancel-registration.spec.ts:39, :72, :107, :140`
- **Fix:** Either restore as `test.todo("BR-NN — reason")` referencing the BR they cover, or delete + replace with a working assertion. No silent skip permitted.

## Partial / Warnings (P1)

### W1. BR coverage gaps (per `bun run test:br`)
77 BRs total. Phase 1 (39): 35 COMPLETE, 4 INCOMPLETE (BR-42 Training Type, BR-47, BR-48, BR-51). Phase 2 (35): 7 COMPLETE, 17 INCOMPLETE, 3 DEFERRED, 8 UNTESTED. Phase 3 (3): all DEFERRED.

**UNTESTED (P2 Phase 2)** — BR-52, BR-53, BR-54, BR-55, BR-56, BR-57, BR-58, BR-59 — all email-suppression / template-validation / queue-cancellation. Likely intentional (email subsystem not wired) but should be marked DEFERRED or backfilled. Decide in Phase 2.3.

**INCOMPLETE P0 (data/security):** BR-42, BR-47, BR-51, BR-60, BR-61, BR-62, BR-63, BR-64, BR-65, BR-66, BR-68, BR-69, BR-72, BR-73 — all booking/billing/auth security rules. Each must either become COMPLETE or be explicitly justified as DEFERRED with story.

### W2. 20 BE unit `test.todo` markers
Concentrated on:
- BR-25 OTP (Better-Auth owns, may be permanently DEFERRED — make explicit)
- BR-26 Session mgmt (same)
- BR-16 Activity visibility (3 cases pending)
- BR-23 License normalization
- BR-28 Communication dedup (2 cases)
- BR-32 Financial retention (3 cases)
- 1 pitfall doc test

**Action:** triage in Phase 2 — convert to real tests or rewrite as DEFERRED rows in br-registry.json.

### W3. 93 BE unit + 93 integration skips
Same source — `API_AVAILABLE ? describe : describe.skip` (see F4 Category A). Not double-counted; same 11 integration files. Counts are the same set viewed from two runs.

## Green / No Action (informational)

- Workspace typecheck — 5/5 pass. No drift.
- FE memberry/admin Vitest — 690 total pass, no fails. The "regressed modules m04/m06/m07/m08/m11" from `CONFIDENCE_REPORT.md` are NOT failing tests — they are graded regressed by the report's heuristics (coverage breadth, not pass/fail). Component backfill in P3.4 still warranted by plan, but no acute red.
- React act() warnings in admin output — noise, not failure.

## Trajectory

```
total problems found = 93 contract fails + ~600 estimated E2E fails + 14 lint skips + 1 shallow + 21 incomplete BR + 8 untested BR
                     ≈ 700+ symptoms
likely root causes   ≈ 3–5 (auth middleware regression, fixture seed drift, UI label renames)
```

## Next Step (P1.3 plan)

Order by leverage:
1. **Root-cause F1 first** — one auth fix could green 50-80 contract files at once
2. Re-run contract → confirm cascade fix
3. Re-run E2E memberry — same root cause should clear most 403s
4. Triage residual E2E (heading renames, fixture seed) module-by-module
5. Fix F3 (1 line), F4 Category B (6 lines) — trivial cleanup
6. Decide F4 Category A policy with user
7. Sweep W1/W2 in Phase 2

Begin investigation: `git log` on `services/api-ts/src/middleware/` last 30 days + curl-test `POST /persons` with admin session.
