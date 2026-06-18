# Continuation prompt — CONTINUE-58 (finish e2e backlog + LAND the stranded branch)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-58-prompt.md`.
CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode.

---

## ⚠️ STATE CORRECTION (CONTINUE-57, 2026-06-14) — RESOLVED

**PR #8 was already MERGED** (squash at `cf8202e9`), not open as CONTINUE-55/56/57 assumed.
Branch `aha/continue-49-subscription-billing` carries 7 commits NOT in main (`ace5b82c, 9a02dff3,
fc09141b` CONTINUE-52/53 + `8a470bcb` Phase 0, `3ff85e20` Phase 1, `2a74cbe8` Phase 3a/3b,
`2e1af72f` Phase 5). Pushing triggered no CI (`on.push.branches:[main]` + PR closed).

**RESOLVED:** **PR #10** (`aha/continue-49-subscription-billing → main`) is now OPEN — the new
sharded CI runs against this work. Watch with `gh pr checks 10`. Confirmed live: shards
`e2e-memberry (1..6)` + `e2e-admin` spin up; **`coverage-gate` passes independently (14s)** — the
decouple works. **e2e WILL be red** until the 101-failure backlog below is cleared. STOP before
merge until e2e green. Do NOT touch PR #8 (merged/closed).

## What LANDED on the branch this session (CONTINUE-57, verified locally on fresh DB)

- **`2a74cbe8` Phase 3a/3b** — three real root causes for the guard/perm/journey clusters:
  1. `requireOrgOfficer` (apps/memberry/src/utils/guards.ts) booted ANY user navigating
     `/org/<UUID>/officer/*` because `/public/org/:slug` 404s for a UUID (post slug-migration);
     resolution was query-cache-dependent → racy boots. Now accepts a UUID `$orgSlug` directly
     on the slug-404 path. Non-officers still booted at the officer-role check (enforcement intact).
  2. Seed BR-44 election certification (services/api-ts/src/seed/layer-5-gap-fill.ts) unseated
     the persona Chapter Treasurer (Juan Cruz) by electing a member to his seat → his term
     `completed` → treasurer-journey had no active officer term. Now re-elects the incumbent
     (challenger nominee still demos the election). Verified: Juan has an active Treasurer term.
  3. Guard/permission redirects are async (~2-3s, two sequential round-trips); specs asserted the
     post-redirect URL immediately / after a fixed 2s wait → flaky. Replaced with `waitForURL`
     settles (guard-enforcement, states perm-error ×4, navigation, security, officer-dashboard
     fake-org). security spec now targets the real `/dashboard` (`/my/dashboard` doesn't exist).
  4. playwright chromium project re-states `**/stubs/**` in testIgnore (project testIgnore shadows
     the global one) → 10 stub specs stop running+failing.
  Verified fresh-DB: journeys treasurer/secretary/society/election + guard + states perm-error →
  30/31 (1 flaky officers-page sub-step). typecheck clean.
- **`2e1af72f` Phase 5** — CI: split monolithic `e2e` into matrix `e2e-memberry` (shards [1..6],
  fail-fast:false, own pg+minio+API+app each, workers=2, SESSION_LIMIT=100000, `--shard=N/6`) +
  `e2e-admin` (workers=1) + aggregator job **named `e2e`** (`if:always`, needs both). coverage-gate
  decoupled → `needs:[lint-typecheck]`. YAML validated; ci-gate/coverage-gate still read `needs.e2e`.

## TRUE remaining e2e backlog (full memberry suite, fresh DB, workers=2, 2026-06-14)

**510 passed / 101 failed / 25 skipped (15.8 min).** Down from CONTINUE-56's 118.
Log: `/tmp/full-remeasure.log` (line reporter; `test-results.json` is STALE — `--reporter=line`
overrode the json reporter). Categorized (by first assertion in each failure block):

| Category | Count | Nature |
|---|---|---|
| `toBeTruthy` (data-presence `getByText(...).isVisible()`) | 49 | selector drift OR data-presence/contamination |
| `toBeVisible` (heading/control) | 16 | selector drift |
| "other" (action/fill/click timeout) | 17 | element missing/selector |
| strict-mode dup-text (counted under "violation") | ~6 | **easy**: `getByText` resolves to 2 (breadcrumb+heading): "Log Manual Credit", "Your Organizations", "Profile", "Schedule", /training/ → add `.first()` / scope |
| real axe-a11y (`expectNoA11yViolations`) | ~4 | credits-states:102, events-states:74, org-home-states:70, training-states:78 — genuine, fix component |
| `toHaveScreenshot` | 1 | `_visual.spec.ts:68` member-dashboard baseline — update if intended |
| Mailpit 404 | 1 | `auth/password-reset.spec.ts:64` — LOCAL-only (CI has mailpit), not real |
| `toBeNull` | 1 | `auth.spec.ts:91` sign-in POST body null — diagnose (matched response shape) |

Top specs by fail count: training-lifecycle(6), events-states(5), election-officer-transition(4),
training-to-credit(4), grace-period-access(4), dues-states(4), org-home-states(4), communication-
delivery(3), document-lifecycle(3), dues-lifecycle(3), member/dues(3), onboarding(3),
election-integrity(3), profile(3). 51 specs total.

**Contamination signal:** election-officer-transition passed 30/31 in ISOLATION but fails 4 in the
full parallel run → sibling specs mutate the shared seeded org. A chunk of the 49 `toBeTruthy`
data-presence fails are likely the same. This is the **Phase 4 (G10 `/test/isolated-fixture`,
already built — `handlers/test-isolation.ts` + `helpers/isolated-fixture.ts`) signal**: adopt
`withIsolatedFixture(test,…)` per offending data-presence spec; if data simply isn't rendered,
it's a render/selector fix instead. Distinguish by re-running the spec ALONE — pass-in-isolation
⇒ contamination ⇒ isolate; fail-in-isolation ⇒ real drift ⇒ fix selector/seed.

## Todolist (after clear) — CONTINUE-58

1. **Triage split (do FIRST, drives everything).** For each of the 51 failing specs, re-run it ALONE
   on a fresh DB. Pass-in-isolation ⇒ **contamination** (sibling mutated shared org → Phase 4 isolate).
   Fail-in-isolation ⇒ **real drift** (selector/seed/render → fix in place). Bucket the 101 accordingly.
2. **Cheap wins.** ~6 strict-mode dup-text → `.first()`/scope (breadcrumb+heading both match:
   "Log Manual Credit", "Your Organizations", "Profile", "Schedule", /training/). `_visual.spec:68`
   member-dashboard baseline → update if the new render is intended. `auth/password-reset.spec:64`
   Mailpit → skip/guard locally (CI has mailpit; not a real fail). `auth.spec:91` toBeNull → diagnose
   which `/auth/sign-in*` response is captured (body null = non-JSON/wrong match).
3. **Real axe-a11y ×4** (TDD): credits-states:102, events-states:74, org-home-states:70,
   training-states:78 — read the axe rule from `expectNoA11yViolations` output, fix the component.
4. **Real selector/data-presence drift** (the fail-in-isolation bucket of the ~82): update selectors to
   current DOM / reconcile seed. Fan-out-able (mechanical). Re-verify each batch on fresh DB.
5. **Phase 4 — contamination bucket only.** Adopt `withIsolatedFixture(test,…)` per offending
   data-presence spec (endpoint `/test/isolated-fixture` + `helpers/isolated-fixture.ts` ALREADY built).
   Migration **0073** only if schema touched (hand-write, idempotent+journal, NO `db:generate`). Then
   `playwright.config.ts workers` can exceed 2.
6. **Verify + STOP.** Re-measure full suite fresh-DB; watch `gh pr checks 10` until `e2e` aggregator +
   `coverage-gate` green and suite < 30min. Append dated note to **PR #10** (not #8). **STOP before merge.**

## Untouched (need USER / out of e2e scope)
- `Deploy` ghcr push perms (org→Packages toggle, infra not code).
- G2 elections position-identity model (FK vs jsonb); Q1 documents card-verify token format — P0
  product decisions, independent of e2e. List as blockers; do not implement.

## Stack state
- API 7213 booted `SESSION_LIMIT=100000` (fresh DB monobase dropped+migrated+seeded this session).
- App 3004 running. Probe officer `test@memberry.ph` / `TestPass123!`.
- Fresh re-measure: `psql DROP DATABASE monobase WITH(FORCE); CREATE` → reboot API → `bun run db:seed`.
- Ground rules unchanged (CONTINUE-52/56): branch only, TDD on handler changes, no fake-green,
  re-verify on fresh DB, migrations hand-written next 0073, pre-commit passes w/o --no-verify,
  preserve untracked docs/aha/outputs/*.md, no heavy bash during a timing run.
