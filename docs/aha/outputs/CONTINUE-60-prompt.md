# Continuation prompt — CONTINUE-60 (kill memberry contamination → LAND PR #10)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-60-prompt.md`.
CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode.

---

## What LANDED this session (CONTINUE-59) — committed + pushed to PR #10

Branch `aha/continue-49-subscription-billing`, PR #10 OPEN. Two commits pushed:

**`5938fc91` `fix(e2e): seed endodontics training + repair auth/events specs + skip CI visual`**
- **seed**: added published "Advanced Endodontics" training to
  `services/api-ts/src/seed/layer-3-modules.ts` (only Implant/Photography/
  InfectionControl existed; officer/training + training-lifecycle + training-
  to-credit + training-browse assert it as SEEDED). Additive + idempotent.
- **auth.spec:91**: `signInResponse.json()` flakily null — the post-login
  redirect tears down the in-flight **proxied** response before Playwright
  reads it (root-caused via direct bun-fetch: API returns full body, the
  3004 proxy body is unreadable mid-redirect). Replaced brittle body-parse
  with an authed in-page `get-session` fetch (real data assertion). Verified
  pass.
- **member/events.spec:37,55**: tests asserted `/my/events` buttons/cards
  **without ever navigating there** (no goto, no beforeEach) — added
  `page.goto('/my/events')`. Verified pass.
- **ci.yml**: `SKIP_VISUAL=1` on e2e-memberry. `_visual.spec` baselines are
  committed only for **darwin**; Linux CI has no `-linux.png` → every
  `toHaveScreenshot` failed with "snapshot doesn't exist, writing actual"
  (12 fails). The spec already supports `SKIP_VISUAL`. Re-enable once linux
  baselines are generated in-container.

**`dc359c64` `fix(e2e): admin CSRF headers + selector drift (unblock e2e-admin shard)`**
- **ROOT CAUSE (admin shard was 100% red): CSRF.** Every state-changing
  admin-API call via the raw `APIRequestContext` 403'd with
  `CSRF_TOKEN_MISSING`. Backend enforces double-submit CSRF
  (`services/api-ts/src/middleware/csrf-token.ts`: GET `/csrf-token` sets
  `csrf_token` cookie + returns `{token}`; mutations need matching
  `x-csrf-token` header). A real page gets this via the SDK; raw request
  context does not. Added `csrfHeaders(context)` to
  `apps/admin/tests/e2e/helpers/auth.ts`, wired into
  associations/organizations/audit/members mutations.
- **selector drift**: audit filter waited for native `<select>` (it's a Radix
  combobox → `getByRole('combobox')`); wave7-routes committees/dashboard
  `getByText` collided with row badges + nav links (exact+first);
  association-detail asserted "Chapter Health"/"Full dashboard" which are
  **only code comments, never rendered** (assert KPI "Members" label + "View
  National Dashboard" link); members "All organizations" collided with the
  page subtitle (combobox role), dropped a non-existent "Actions" columnheader.
- **`wave7-role-gate` (3 tests)**: fail LOCAL-only, **pass in CI** (absent from
  the CI failure log). Local dev-server doesn't enforce the unauth route-gate
  the same way. Untouched — not a regression. Leave it.

**CI result (run 27491292296, dc359c64):**
- **`e2e-admin`: SUCCESS** ✅ (was fully red — now green).
- **`e2e-memberry`: still RED** — 6 shards fail.
- memberry CI failures: **93 → 79** (−14: all visual gone, training-lifecycle
  6→2, officer/training fixed, events/auth fixed).

`coverage-gate`, `contract`, `unit-tests`, `lint-typecheck`, `build-*`,
`gates`, `new-code-gate` all GREEN. The **`e2e` aggregator** = `e2e-memberry`
AND `e2e-admin`; admin is green so the aggregator is now blocked **only** by
memberry contamination.

## THE remaining blocker — memberry contamination (79 fails)

**Proven root cause (do not re-litigate):** on a FRESH DB every page renders
correctly with full data. Confirmed via in-app probe — `/org/<UUID>/officer/
training` shows "3 Published", `/my/events` shows "Upcoming 2/Past 2",
`/org/<slug>/home` shows announcements. The 79 fails are **DB contamination**:
~34 specs WRITE/DELETE on the **single shared seeded org**; under `workers=2`
within a CI shard (and across files in one shard's DB), a writer clobbers data
a reader expects. Error signatures: `toBeTruthy() false` (data absent),
`toBeVisible failed` (element gone), serial-journey cascades.

NOT contamination, already handled: missing-goto (events ✓), visual (skip ✓),
auth-proxy (✓), training-seed (✓). The remaining 79 are genuinely shared-state.

### DECISION (LOCKED — user-confirmed 2026-06-14): DO NOT delete/archive them
These 79 cover **core product journeys** (training→credit, dues, elections,
registration→payment, member/officer flows) and the features WORK (probe-proven
on fresh DB). Deleting/archiving = **fake-green** that hides future real
regressions — rejected. Fix them via the `withIsolatedFixture` migration below.
`test.skip` is allowed ONLY as a per-spec interim WITH a tracked un-skip note —
never as the way to land the PR.

### TODOLIST — CONTINUE-60 (execute in order)
1. **Verify/reseed FRESH DB** (`df -h /` first; drop+create monobase → restart
   API `SESSION_LIMIT=100000` → `bun run db:seed`). `rm -rf */test-results/*`.
2. **Enhance the fixture for member specs:** add `memberEmail` option to
   `services/api-ts/src/handlers/.../test-isolation.ts` (+ `helpers/isolated-
   fixture.ts`) that gives the seeded `member@memberry.ph` an ACTIVE membership
   on the fresh org — mirror the existing `officerEmail`/president path. TDD it.
   (Migration **0073** only if a schema column is touched — hand-write, no
   `db:generate`.)
3. **Migrate OFFICER specs** (≈25, work now): swap hardcoded `ORG_ID` →
   `withIsolatedFixture`. Verify each passes BOTH alone and in a contaminated
   `--max-failures=0` run before moving on.
4. **Migrate MEMBER specs** (using #2's `memberEmail`). Same verify-both rule.
5. **Triage non-journey 1-offs** (states/profile/settings/discover-events/
   form-validation/_click-through): re-run ALONE on fresh DB. pass-alone ⇒
   migrate/contamination; fail-alone ⇒ REAL drift ⇒ fix selector/seed (not skip).
6. **Bump `playwright.config.ts` workers** past 2 once isolation lands.
7. **Verify + LAND:** full fresh-DB suite green locally, push, `gh pr checks 10`
   until `e2e` aggregator + `coverage-gate` green. Append dated PR #10 note.
   **STOP before merge.**

### Full remaining 79 (CI run 27491292296, fresh-DB-per-shard, regenerate via
`gh run view --job <id> --log -R eladventures/memberry` then grep `[chromium] ›`):

```
 5 journeys/training-to-credit        4 member/grace-period-access
 4 journeys/election-officer-transition 4 journeys/communication-delivery
 3 officer/election-integrity         3 member/onboarding
 3 journeys/registration-to-payment   3 journeys/dues-lifecycle
 3 journeys/document-lifecycle        2 public/discover-events
 2 profile  2 officer/role-assignment 2 officer/enrollment-management
 2 member/training-browse  2 member/event-capacity  2 member/dues
 2 journeys/training-lifecycle  2 journeys/event-registration-payment
 2 journeys/event-lifecycle  2 journeys/booking-flow  2 actions/form-validation-tests
 2 _click-through  + 1×: states/dues-states, states/credits-states, settings,
 officer/{settings-e2e,payment-reconciliation,event-checkin,dashboard,application-review},
 member/{training,pay-token,gateway-error,documents,directory,digital-id-card,
 data-export,credit-validation,account-deletion}, journeys/booking-host-actions,
 error-boundaries, directory-onboarding, auth/otp-registration
```

### The fix (the prompt's standing plan — execute it)

Infra ALREADY built: `withIsolatedFixture(test, {...})` in
`apps/memberry/tests/e2e/helpers/isolated-fixture.ts` → backed by
`POST /test/isolated-fixture` (`services/api-ts/src/handlers/.../test-isolation.ts`,
NODE_ENV-guarded). Gives a fresh org + tier + N members; makes the seeded
president (`test@memberry.ph`) an officer on the new org
(`officerEmail` default), returns `{orgId, slug, tierId, personIds,
officerPersonId, positionId}`.

1. **OFFICER specs migrate cleanly NOW** (they already sign in as the seeded
   president + hardcode `ORG_ID`): swap `const ORG_ID='ed8e3a96…'` for
   `const fx = withIsolatedFixture(test, {memberCount:3})` and use
   `fx().orgId`. Targets: training-to-credit, election-officer-transition,
   election-integrity, role-assignment, enrollment-management,
   training-lifecycle, officer/* (≈25 of 79).
2. **MEMBER specs need a fixture enhancement first**: the helper seeds
   anonymous members, but member specs sign in as `member@memberry.ph` who is
   NOT on the new org. Add a `memberEmail` option to `test-isolation.ts`
   handler + helper that ALSO adds the seeded member (active membership) to the
   new org — mirror the existing `officerEmail` path. Then member specs use
   `fx().orgId` + sign in as member. (grace-period-access, member/dues,
   event-capacity, training-browse, etc.)
3. After migration, **bump `playwright.config.ts` workers** past 2 (isolation
   removes the shared-state ceiling).
4. **Triage protocol** (per prior prompts): re-run each suspect ALONE on a
   FRESH DB — pass-in-isolation ⇒ contamination ⇒ migrate; fail-in-isolation
   ⇒ real drift ⇒ fix selector/seed. A few (e.g. training-to-credit:12 looks
   for generic `/training|workshop/i`) are pure contamination — migration alone
   fixes them.

### ⚠️ DISK — bit me hard this session
`/` had only ~3.5Gi free; the full local e2e run filled it with traces/videos,
which **crashed the app on :3004 mid-run** and produced spurious failures
(empty proxied bodies, infra errors). **Before any local full run:**
`rm -rf apps/memberry/test-results/* apps/admin/test-results/*`, run targeted
specs with `--trace=off`, and `df -h /` first. The memberry local
`maxFailures` is **1** — use `--max-failures=0` for a full fail list. Both
apps started via `bun dev` (API needs `SESSION_LIMIT=100000`).

## Stack state
- API :7213 (`SESSION_LIMIT=100000`) + app :3004 both UP, FRESH seeded DB
  (includes new endo training). DB clean as of session end — but verify/reseed
  before triage.
- Branch only, TDD on handler changes, no fake-green, re-verify fresh DB,
  migrations hand-written next **0073** (only if `test-isolation` schema
  touched), pre-commit passes w/o `--no-verify`, preserve untracked
  `docs/aha/outputs/*.md`. **STOP before merge** — get `e2e` aggregator +
  `coverage-gate` green, append dated PR #10 note, then halt.

## Untouched (USER / out of e2e scope) — unchanged
- `Deploy` ghcr push perms (org→Packages, infra not code).
- G2 elections position-identity (FK vs jsonb); Q1 documents card-verify token
  — P0 product decisions, independent of e2e. Blockers, do not implement.
