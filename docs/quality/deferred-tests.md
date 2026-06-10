# Deferred Tests Roadmap — services/api-ts

**Status:** 113 deferred (93 skip + 20 todo). Baseline: `bun test` → 6008 pass / 0 fail / 93 skip / 20 todo.
**Owner:** API team.
**Last updated:** 2026-06-02.

---

## 1. TL;DR <a id="tldr"></a>

113 backend tests deferred. Three workstreams:

| WS | Title | Tests | Effort | Unblocks | ROI |
|----|-------|------:|-------:|----------|----:|
| **WS-1** | CI unlock for `API_AVAILABLE` skips | **93** | **1–2 days** | RBAC / IDOR / audit / email security regressions | **★★★★★** |
| **WS-2** | Better-Auth-blocked todos (OTP / sessions) | **~11** | 1 day | OTP rate-limit + session BR coverage | ★★★ |
| **WS-3** | Membership feature todos (`br-p2-gap.test.ts`) | **9** | 0.5–4 days (split) | BR-16 visibility, BR-23 dedup, BR-28 dedup, BR-32 retention | ★★ |

**Recommended sequencing:** WS-1 first (highest ROI — unlocks 93 security tests for the cost of one CI job), then WS-3 wireable bucket (BR-23 normalization, 1 test, ~1 hr), then WS-2 (Better-Auth integration tests), then the remaining WS-3 feature-gated todos as their owning modules ship.

E2E inactive (78 = 20 skip + 55 fixme + 3 admin) is tracked in §5 — no action this cycle.

---

## 2. WS-1: CI unlock for API_AVAILABLE skips (93 tests) <a id="ws1"></a>

### 2.1 The predicate

`services/api-ts/src/tests/helpers/api-available.ts` does a synchronous `curl ${API_URL}/auth/ok` (max 2 s) at module load:

```ts
const API_URL = process.env['API_URL'] || 'http://localhost:7213';
function checkApi(): boolean {
  const res = Bun.spawnSync(['curl','-s','-o','/dev/null','-w','%{http_code}','--max-time','2', `${API_URL}/auth/ok`]);
  return res.exitCode === 0;
}
export const API_AVAILABLE = checkApi();
```

Each consumer does `const d = API_AVAILABLE ? describe : describe.skip;` so a dead port produces a silent global skip. There is **no `API_AVAILABLE=true` env override** — flag is computed, not declared.

### 2.2 Skipped files + intent

| File | Count | Domain | STRIDE coverage |
|------|------:|--------|-----------------|
| `tests/position-rbac.test.ts` | 31 | Position-restricted RBAC (Treasurer/Secretary/Society-Officer/President) on `/association/member/*`, `/association/events/*`, `/association/training/*` | Elevation of Privilege |
| `tests/route-protection-association.test.ts` | 19 | Officer-only mutations on generated `/association/*` routes — members must get 403 (POST membership, PATCH membership, officer-terms, announcements, events, training, elections, check-ins) | Tampering / EoP — Pitfall 2 (orgContextMiddleware always sets role=member) |
| `tests/email-integration.test.ts` | 12 | `/email/templates` CRUD + queue listing; admin allowed, member blocked; input validation (1 todo: `create template with valid data — blocked: /email/* routes lack org-context middleware`) | Information Disclosure |
| `tests/route-protection-idor.test.ts` | 11 | Cross-org isolation: `treasurer@…` (org A: pda-metro-manila) vs `idor-officer@…` (org B: pda-cebu); GET membership/members, GET dues/dashboard, GET membership/applications blocked cross-org | Information Disclosure (T-12-10..13) |
| `tests/audit-integration.test.ts` | 8 | `/audit/logs` admin-only; HIPAA fields (id/eventType/category/action/outcome/user/createdAt/integrityHash); filtering | Repudiation |
| `tests/seed-users.test.ts` | 6 | Seed fixture validity (President + Treasurer + Secretary + Society Officer + member + idor-officer exist with expected roles) | — (fixture invariant) |
| `tests/api-as.test.ts` (under `helpers/`) | 5 | `apiAs(email)` helper actually mints a Better-Auth session | — (infra) |
| `tests/smoke.test.ts` | 3 | `GET /livez`, `GET /readyz?verbose`, response shape | — (boot) |

### 2.3 Sample skipped tests (cited)

**position-rbac (3 of 31):**

- `Treasurer allowed: POST /association/member/dues-payments (Treasurer domain)` — Treasurer can write dues, asserts `status !== 403`.
- `Secretary allowed: POST /association/member/roster (Secretary domain)` — Secretary can write roster.
- `Society Officer blocked: create position (POST /association/member/positions) returns 403` — Society Officer cannot mint positions (President-only).

**IDOR (2 of 11):**

- `GET /membership/members/:organizationId blocked cross-org` — org-A officer cannot read org-B member roster (T-12-10).
- `GET /dues/dashboard/:organizationId blocked cross-org` — org-A officer cannot read org-B dues dashboard (T-12-11).

### 2.4 What blocks them today

`ci.yml` `unit-tests` job runs `cd services/api-ts && bun test` against a postgres service container **but never boots the API process** — `${API_URL}/auth/ok` returns nothing → `API_AVAILABLE=false` → all 93 skip silently. The E2E job (lines 104+) boots `bun dev` for the app, not for `services/api-ts` test consumption. The `contract.yml` workflow already has the exact recipe we need (lines 65–95): boot api-ts, wait-for `/livez`, then run the suite.

### 2.5 Concrete CI change

Add a new `integration-tests` job to `.github/workflows/ci.yml` (or extend `contract:` in `contract.yml`) that reuses the contract-yml boot pattern:

```yaml
integration-tests:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  services:
    postgres: { image: postgres:16-alpine, env: {...}, ports: ['5432:5432'], options: --health-cmd "pg_isready ..." ... }
  env:
    DATABASE_URL: postgresql://postgres:password@localhost:5432/monobase_integration
    PORT: 7213
    API_URL: http://localhost:7213
    AUTH_SECRET: integration-test-secret-do-not-use-in-prod
    # ... minio env (same as contract.yml)
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with: { bun-version: 1.2.21 }
    - run: bun install --frozen-lockfile
    - run: bun --filter @monobase/api-spec run build
    - run: bun --filter @monobase/api-ts run generate
    - name: Boot API
      run: cd services/api-ts && bun dev > /tmp/api.log 2>&1 & echo $! > /tmp/api.pid
    - name: Wait for /livez
      run: |
        for i in {1..60}; do curl -fsS "$API_URL/livez" && exit 0; sleep 1; done
        tail -200 /tmp/api.log; exit 1
    - name: Seed integration DB
      run: cd services/api-ts && bun run db:seed
    - name: Run integration tests
      run: cd services/api-ts && bun run test:integration
    - if: always()
      run: kill "$(cat /tmp/api.pid)" || true
```

`services/api-ts/package.json` already exposes `test:integration` → `bun test src/tests/`, so no script changes needed.

### 2.6 Effort

| Step | Effort |
|------|-------:|
| Add `integration-tests` job (copy-paste from contract.yml) | 1 hr |
| First failure triage (auth headers, seed drift, port collisions) | 2–4 hr |
| Stabilize against shared seed | 2–4 hr |
| Documentation (CONTRIBUTING.md update) | 30 min |
| **Total** | **~1 day (8 hr)**, worst-case 2 days |

### 2.7 Risk

- **Flake against shared DB.** These tests write through the live API (POST membership, dues, announcements, etc.). Re-runs can collide with prior seed state.
  - **Mitigation:** ephemeral DB per CI run — the CI job uses a service container that's torn down at job end (already the pattern in `contract.yml`). For local: use a separate `DATABASE_URL` pointing at `monobase_integration` so dev DB isn't polluted.
- **Better-Auth session minting against ephemeral DB.** `apiAs()` mints sessions for seed users; if seed didn't run or seed schema drifted, every test fails uniformly.
  - **Mitigation:** integration job runs `bun run db:seed` after migrations; `seed-users.test.ts` runs first and fails loud if fixtures missing.
- **`/email/*` routes still lack org-context middleware** (per the 1 `email-integration` todo). Booting the API doesn't fix that — the test is correctly `.todo()`. Will stay todo until middleware is wired.

### 2.8 Coverage unlocked (security-critical breakdown)

| Domain | Tests | Why it matters |
|--------|------:|----------------|
| Position-restricted RBAC | 31 | Prevents Treasurer-only / Secretary-only / President-only privilege grants from drifting silently |
| Officer-vs-member route protection | 19 | Catches regressions in handler-level officer checks — `requireOrgRole()` alone returns `role=member` for everyone (Pitfall 2) |
| Cross-org IDOR | 11 | Single highest-impact security class — prevents one chapter reading another chapter's data |
| Compliance audit log shape | 8 | HIPAA field presence, admin-only access |
| Email template access control | 11 (12 minus 1 perma-todo) | Admin can CRUD templates, members blocked |
| Boot/health/seed/auth-helper | 14 | Trip-wires for fundamental wiring breakage |
| **Total** | **94** | (matches 93 once you exclude the perma-todo) |

### 2.9 Suggested PR sequence

1. **PR #1** — Add `integration-tests` job to `ci.yml` with `continue-on-error: true`. Lands the boot recipe; surfaces real failures without blocking main.
2. **PR #2** — Fix first failure batch (typical: seed user emails out of sync, `/auth/ok` path, header injection). Land any tests that pass green.
3. **PR #3** — Flip `continue-on-error: false`. Add `lint:no-skips` rule (already exists in CI per `Existing report tail`) to forbid new `API_AVAILABLE`-gated skips without explicit waiver.
4. **PR #4** — Move smoke + seed-users tests to run **before** the rest so failures are diagnostic.

---

## 3. WS-2: Better-Auth-blocked todos (~11 tests) <a id="ws2"></a>

Better-Auth owns OTP delivery / rate-limit / session lifecycle. These todos are split:

| Source | Test ID | Better-Auth surface | Self-serve? |
|--------|---------|---------------------|-------------|
| `handlers/__tests__/br-edge-cases.test.ts:293` | `[BR-25] returns 429 after 3 failed OTP requests within 1 hour` | `rateLimit: { enabled, window, max }` in `auth.ts` | YES — integration test against booted auth server |
| `handlers/__tests__/br-edge-cases.test.ts:294` | `[BR-25] rate limit resets after 1 hour window expires` | same | YES — but slow (1-hour window or time-mock) |
| `handlers/membership/br-p2-gap.test.ts` BR-25 (4 todos) | OTP 6 digits / 10-min validity / 3-attempt invalidation / 3-per-hour rate limit | `emailOTP` plugin config | YES — config snapshot tests |
| `handlers/membership/br-p2-gap.test.ts` BR-26 (4 todos) | 3 concurrent sessions / 8-hr inactivity expiry / password-change session revoke / oldest-session eviction | `session: { expiresIn, freshAge, maxConcurrent }` | YES — config snapshot + integration |
| `tests/email-integration.test.ts:85` (1 todo) | `create template with valid data returns 201 — blocked: /email/* routes lack org-context middleware` | n/a (it's a middleware gap, mislabeled) | Self-serve: wire `orgContextMiddleware` on `/email/*` |

### 3.1 Concrete unblock

- **Config-snapshot tests (8 total — BR-25/BR-26 in `br-p2-gap`):** call `import { auth } from '@/lib/auth'` and assert `auth.options.emailOTP.otpLength === 6`, `auth.options.session.expiresIn === 28800`, etc. Pure unit, no boot needed. ~30 min each.
- **Rate-limit integration (2 in `br-edge-cases`):** booted-API integration tests under WS-1 — `for (i=0;i<4;i++) POST /auth/email-otp { email }` → assert 4th returns 429. Requires WS-1 done first.
- **Email middleware todo (1):** unrelated to Better-Auth — actually a backend gap. Add `app.use('/email/*', orgContextMiddleware)` in router, flip todo to test. ~1 hr.

### 3.2 Effort

| Item | Effort |
|------|-------:|
| 8 config-snapshot tests | 4 hr |
| 2 rate-limit integration tests (depends on WS-1) | 2 hr |
| Wire `/email/*` org-context middleware + flip 1 todo | 1 hr |
| **Total** | **~1 day** |

### 3.3 Cross-team coordination

None — Better-Auth is a dependency, not a team. All work is self-serve config + tests.

---

## 4. WS-3: Membership feature todos (17 — `br-p2-gap.test.ts`) <a id="ws3"></a>

Re-bucketed by actual blocker (the original "17 todos" splits cleanly):

| Bucket | Count | Tests | Blocker |
|--------|------:|-------|---------|
| **Wireable now** (handler exists, just write test) | 1 | `[BR-23] license number normalization for duplicate matching (lowercase, strip spaces/dashes)` | None — `addMember` handler exists; normalization helper needs writing |
| **Feature-gated** (handler doesn't exist) | 3 | `[BR-16]` events visibility default to internal / training default to network-wide / officer override | Events + Training handlers don't enforce visibility defaults yet |
| **Better-Auth owned** (moves to WS-2) | 4 | `[BR-25]` OTP config (6 digits / 10-min / 3 attempts / 3-per-hour) | Better-Auth config — see WS-2 |
| **Better-Auth owned** (moves to WS-2) | 4 | `[BR-26]` sessions (3 concurrent / 8-hr / password-change revoke / oldest eviction) | Better-Auth config — see WS-2 |
| **Job-owned** (background processor) | 2 | `[BR-28]` multi-org dedup / different-type non-dedup | Communication processor isn't directly callable with `makeCtx` — needs integration harness |
| **Job-owned** (background processor) | 3 | `[BR-32]` 7-yr retention / anonymized deleted member payments / fund breakdown preserved post-anonymization | Deletion processor + anonymization job (Phase 19) not testable as handlers |
| **Total** | **17** | | |

(BR-25 + BR-26 = 8 are claimed by WS-2; the 17 here are the full body of `br-p2-gap.test.ts`. The 9 remaining are WS-3-native: BR-16×3, BR-23×1, BR-28×2, BR-32×3.)

### 4.1 Wireable bucket — what to write today

**BR-23 license normalization (1 test):**
- Add `normalizeLicense(s: string)` helper in `handlers/membership/utils/license.ts` → lowercase + strip ` ` and `-`.
- Call from `addMember` before duplicate check.
- Test: `expect(normalizeLicense('PRC-12345')).toBe('prc12345')` + `expect(normalizeLicense('PRC 12345')).toBe('prc12345')` — 30 min total.

### 4.2 Feature-gated bucket

**BR-16 (3 tests):** Add `visibility: 'internal' | 'network-wide' | 'public'` column to events + training schemas (or a default in the create handler). Tests then call `createEvent` / `createTraining` and assert default. Estimated 4 hr per side (schema + migration + handler default + test). Treat as feature work, schedule with the next events / training cycle.

### 4.3 Job-owned bucket (BR-28 + BR-32 = 5 tests)

These require a job-harness, not unit tests. **Recommendation:** convert from `test.todo` to an integration test in `tests/` (under WS-1's booted-API job). Test sequence:
- BR-28: POST 2 announcements with same type to same multi-org member → wait for `notifs.processScheduled` cycle → assert single notification row.
- BR-32: hard-delete a member with payment history → assert payment rows still exist with anonymized `personId` and `amount` preserved.

Schedule with the next dedup / retention milestone — not blocking.

### 4.4 Effort

| Item | Effort |
|------|-------:|
| BR-23 normalization (1 test) | 1 hr |
| BR-16 visibility defaults (3 tests + handler change) | ~1 day |
| BR-28 dedup integration (2 tests) | ~0.5 day |
| BR-32 retention integration (3 tests) | ~1 day |
| **Total** | **~3 days** (spread across feature work) |

---

## 5. E2E inactive — 78 (20 skip + 55 fixme + 3 admin) <a id="e2e"></a>

Tracked, not actioned in this roadmap. These are frontend Playwright tests.

### 5.1 Active skips (20 in apps/memberry, 3 in apps/admin) — reasons

| File | Count | Skip reason |
|------|------:|-------------|
| `tests/e2e/auth/otp-registration.spec.ts:37` | 1 | "Mailpit not running — email verification requires Mailpit" |
| `tests/e2e/auth/password-reset.spec.ts:41,65` | 2 | "Mailpit not running — start with: bun infra:up" |
| `tests/e2e/member/transfer.spec.ts:15,24,36,50,68` | 5 | "No active membership found in seed data" |
| `tests/e2e/member/event-cancel-registration.spec.ts:39,72,107,140` | 4 | unconditional `test.skip()` — likely feature not yet shipped |
| `tests/e2e/member/training-browse.spec.ts:43` | 1 | "No published trainings in seed data — seed training data first" |
| `tests/e2e/public/discover-events.spec.ts:101` | 1 | "No events seeded for card structure test" |
| `tests/e2e/journeys/document-lifecycle.spec.ts:103,126` | 2 | "No documents seeded for detail metadata test" / "No search input found on documents page" |
| `tests/e2e/journeys/training-lifecycle.spec.ts:196,227` | 2 | unconditional `test.skip()` |
| `tests/e2e/directory-onboarding.spec.ts:172,284` | 2 | "Person creation failed — cannot add member" / "Could not retrieve person ID" |
| `apps/admin/tests/e2e/organizations.spec.ts:15,61,86` | 3 | "No associations in seed data — run db:seed first" |

**Pattern:** ~16 of 23 are seed-conditional. Fixing the integration seed (WS-1 prerequisite) unlocks most. The unconditional ~7 are feature stubs.

### 5.2 Fixme (55) — future-scope modules

55 `test.fixme` calls all under `apps/memberry/tests/e2e/stubs/` — predominantly:
- `marketplace-referral.spec.ts` — BR-38, future module m17
- `national-dashboard.spec.ts` — BR-36, future module m13
- Other stub files for m15/m16/m18

These are deliberate placeholders for future-scope modules. Track in roadmap, **do not action** in this cycle.

---

## 6. Tracking + acceptance <a id="tracking"></a>

### Progress meters

| Workstream | Done when | Measurement |
|------------|-----------|-------------|
| WS-1 | `bun test` skip count drops from 93 → 0 in CI | GitHub Actions `integration-tests` job output |
| WS-2 | OTP/session todo count drops from 11 → 0 | `grep -c 'test\.todo' br-edge-cases.test.ts br-p2-gap.test.ts` |
| WS-3 | BR-23 wireable done; BR-16 / BR-28 / BR-32 tracked against feature milestones | `br-registry.json` updates |
| E2E | (not actioned) | Snapshot at end of cycle |

### Where to track

- **Code anchor:** this file (`docs/quality/deferred-tests.md`).
- **CI anchor:** `.github/workflows/ci.yml` `integration-tests` job presence + green run on main.
- **BR anchor:** `br-registry.json` flips P2-deferred → covered for BR-16/23/25/26/28/32.

### Acceptance gates

- WS-1 complete: 0 `describe.skip` blocks in `services/api-ts/src/tests/` (verified by `lint:no-skips`).
- WS-2 complete: 0 `test.todo` mentioning Better-Auth in `services/api-ts/src/handlers/`.
- WS-3 complete: BR-23 wireable shipped; rest tracked against owning feature milestone.

---

## 7. Risks + open questions <a id="risks"></a>

### Risks

1. **Seed drift.** Tests hardcode `treasurer@memberry.ph`, `idor-officer@memberry.ph`, `ORG_ID='ed8e3a96-…'`. If seed schema changes without test update, entire integration suite goes red — but at least it goes red instead of silent-skipping. **Mitigation:** seed-users.test.ts is the canary; run it first.
2. **Test runtime.** 93 integration tests against a booted API + DB will add 3–8 min to CI. **Mitigation:** parallelize with `unit-tests` job (separate runner), since they don't share resources.
3. **Pitfall 2 regressions.** `orgContextMiddleware` always sets `role=member`. If a handler-level officer check is missed during refactor, `route-protection-association` tests will fail correctly — but only if they actually run. **WS-1 is the safety net.**
4. **`/email/*` middleware gap.** One test stays `.todo` until `orgContextMiddleware` is wired on `/email/*` routes. Track separately; small (~1 hr fix).

### Open questions

- **Q1:** Should WS-1 integration tests be part of `unit-tests` job or a separate `integration-tests` job? Recommendation: separate, parallel job (different env, slower, distinct failure mode).
- **Q2:** Should we tear down + re-seed DB between test files for isolation? Current `bun:test` runs serially in one process. If WS-1 turns up cross-file pollution, escalate to `--bail` + per-file DB transaction wrapping.
- **Q3:** WS-3 BR-16 (visibility) — is the spec final? Events default = `internal`, Training default = `network-wide`. Confirm with product before adding schema column.
- **Q4:** WS-3 BR-32 (7-yr retention) — does the deletion processor (Phase 19) actually exist? If not, blocked until that phase ships.

---

### Appendix A — File index <a id="files"></a>

| Concern | Path |
|---------|------|
| `API_AVAILABLE` predicate | `services/api-ts/src/tests/helpers/api-available.ts` |
| Position RBAC tests (31 skip) | `services/api-ts/src/tests/position-rbac.test.ts` |
| Association route-protection (19 skip) | `services/api-ts/src/tests/route-protection-association.test.ts` |
| Email integration (12 skip) | `services/api-ts/src/tests/email-integration.test.ts` |
| IDOR cross-org (11 skip) | `services/api-ts/src/tests/route-protection-idor.test.ts` |
| Audit integration (8 skip) | `services/api-ts/src/tests/audit-integration.test.ts` |
| Seed users (6 skip) | `services/api-ts/src/tests/seed-users.test.ts` |
| api-as helper (5 skip) | `services/api-ts/src/tests/helpers/api-as.test.ts` |
| Smoke (3 skip) | `services/api-ts/src/tests/smoke.test.ts` |
| Membership BR-P2 gap (17 todo) | `services/api-ts/src/handlers/membership/br-p2-gap.test.ts` |
| Auth BR edge cases (2 todo) | `services/api-ts/src/handlers/__tests__/br-edge-cases.test.ts` |
| CI workflow (target for change) | `.github/workflows/ci.yml` |
| Reference boot pattern | `.github/workflows/contract.yml` (lines 65–95) |
| Dev stack | `docker-compose.yml` (postgres:16-alpine + minio + mailpit) |
| Test scripts | `services/api-ts/package.json` (`test`, `test:unit`, `test:integration`) |
