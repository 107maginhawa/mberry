# Continuation prompt — CONTINUE-59 (clear residual e2e backlog + LAND PR #10)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-59-prompt.md`.
CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode.

---

## What LANDED this session (CONTINUE-58) — verified, committed, pushed to PR #10

**Keystone product fix — `d2a97a7d` `fix(org): resolve orgId from UUID route param`.**
Root cause (found via direct in-page network probe, not trace-guessing):
`apps/memberry/src/providers/OrgProvider.tsx` resolved `orgId` ONLY via
`GET /public/org/:slug`, which **404s for a UUID**. Post slug-migration the
`/org/:orgSlug` URLs carry the org **UUID** directly (same back-compat path the
Phase 3a guard fix added to `utils/guards.ts`). So `orgId` was **empty** on every
`/org/<UUID>/*` page → child API calls fired with `organizationId=` empty →
events `GET /association/events?organizationId=` **403**, announcements
`GET /communications/announcements/` (empty path param) **404** → members saw
"Failed to load" across org home / events / dues / training. Fix: when the route
param matches `ORG_UUID_RE`, use it as `orgId` directly (skip the slug lookup).
Probe after fix: events 200, announcements 200, cards render. This is the
frontend twin of the Phase 3a guard fix — it unblocks ALL member-facing
`/org/<id>/*` data loading.

**`d2a97a7d` also realigned `states/*` e2e** (events/org-home/credits/dashboard/
dues/training) + strict-dup selectors (form-validation/training-lifecycle/
member-dashboard/data-export/profile):
- org-home/events captures **`captureAnyApiSuccess`** (endpoint-agnostic) instead
  of the retired `/event-lifecycle` constant (the page now uses `searchEvents`
  `GET /association/events` + `listAnnouncements`). The in-page events 403 was a
  red herring (orgId-empty); endpoint+role are correct (member role IS
  `association:member`, verified via probe + DB).
- perm-error/fake-org tests: settle async guard redirect with `waitForURL`;
  assert graceful shell render; detect event cards by detail-link not title text.

**`c0c21853` `fix(e2e): realign settings-states`** — `/officer/settings/{dues,funds}`
redirect to `/officer/finances/*`; real titles "Dues Schedule"/"Funds"; fund
names are read-view **text** (not `[value="…"]` inputs — React controlled inputs
don't set the value attribute); seeded org allocation is **General 50% / Building
30% / Emergency 20%** (test had asserted a non-existent "Education Fund").

**Result (local full memberry suite, workers=2, app on hot-reloaded fix):**
**541 passed / 85 failed / 23 skipped** (was CONTINUE-56/58 baseline 510/101/25).
After the settings commit: **~83 failed**. states/ is **60/60 green in isolation**.
⚠️ This run was on a DB already mutated by the run itself — the contamination
bucket below is understated/overstated per-run; re-measure on FRESH DB.

## TRUE remaining backlog (~83, post-keystone) — bucketed from `/tmp/fail2.json`

| Bucket | Count | Nature / next action |
|---|---|---|
| **contamination_or_drift** | ~62 | journey + officer specs on the shared seeded org. **Triage per prompt:** re-run each ALONE on FRESH DB. pass-in-isolation ⇒ contamination ⇒ adopt `withIsolatedFixture` (G10, already built: `handlers/test-isolation.ts` + `helpers/isolated-fixture.ts`). fail-in-isolation ⇒ real drift ⇒ fix selector/seed. |
| **training_data** | 15 | training-lifecycle / training-to-credit / training-browse / officer-training all look for `getByText(/advanced endodontics/i)` — **NOT seeded**; the training *journey* CREATES "Advanced Endodontics" in an earlier `test()` and downstream `test()`s depend on it persisting + running after. Cross-worker/ordering fragility. Fix: make each training spec self-seed its training (or use isolated-fixture), don't depend on a sibling test's creation. |
| **a11y** | 2 | credits-states:104, dashboard-states:109 — `color-contrast (serious)`. **FLAKY** (passed in a later isolated run). When real: one shared design-token contrast fix likely clears both. Also seen intermittently: roster button-name/aria-valid-attr, settings label/button-name. |
| **screenshot** | 1 (×2 retries) | `_visual.spec.ts:68` member-dashboard baseline (height 1191→1279). Update baseline if the new render is intended (`--update-snapshots` for that spec). Darwin baseline only — CI generates its own. |
| **cheap/diagnostic** | 2 | `auth/password-reset.spec.ts:64` Mailpit 404 = **LOCAL-only** (CI has mailpit; guard to skip when `MAILPIT_API` unreachable). `auth.spec.ts:91` — sign-in POST 200 but `.json()` → null at line 115; matched response body not JSON. Diagnose which `/auth/sign-in*` POST is captured (tighten matcher to `/auth/sign-in/email`). Not a product bug. |

Full per-test list with categories: `/tmp/fail2.json` (regenerate: re-run full suite
`--reporter=line` → parse `N) spec:line` blocks; `test-results.json` is STALE).

## Todolist — CONTINUE-59

1. **FRESH DB.** `psql DROP DATABASE monobase WITH(FORCE); CREATE` → restart API
   `SESSION_LIMIT=100000` → `bun run db:seed`. (Triage is meaningless on a mutated DB.)
2. **Isolation triage** the ~62 contamination_or_drift specs: re-run each ALONE.
   Bucket pass-in-isolation (contamination) vs fail-in-isolation (real drift).
3. **Contamination** → adopt `withIsolatedFixture(test, …)` (endpoint + helper
   ALREADY built). Migration **0073** only if schema touched (hand-write,
   idempotent+journal, NO `db:generate`). Then `playwright.config.ts workers` can exceed 2.
4. **training_data (15)** → self-seed the training per spec instead of cross-test dependency.
5. **Real drift** → fix selectors/seed to current DOM (the keystone already repaired
   the `/org/<id>/*` data-loading class — many `toBeTruthy` data-presence fails may
   now be pure contamination; confirm in isolation first).
6. **a11y** → if reproducible on fresh DB, fix the color-contrast token + add
   aria-labels to icon-only buttons (roster/settings).
7. **cheap** → guard mailpit-local; tighten auth.spec:91 matcher.
8. **Verify + LAND.** Full suite fresh-DB < 30min, then `gh pr checks 10` until
   `e2e` aggregator + `coverage-gate` green. Append dated note to **PR #10**. **STOP before merge.**

## Separate issue surfaced this session (NOT memberry e2e)
- **`e2e-admin` shard FAILS on PR #10** (admin app, ~4m). Different app; the
  OrgProvider fix was memberry-only. Triage admin e2e separately — may be its own
  slug/UUID drift or pre-existing. Does NOT block memberry shards but DOES block
  the `e2e` aggregator (needs both). Investigate before merge.

## Untouched (need USER / out of e2e scope) — unchanged from CONTINUE-58
- `Deploy` ghcr push perms (org→Packages toggle, infra not code).
- G2 elections position-identity model (FK vs jsonb); Q1 documents card-verify
  token format — P0 product decisions, independent of e2e. Blockers, do not implement.

## Stack state
- API 7213 + app 3004 running (hot-reloaded the OrgProvider fix). DB mutated by
  this session's runs — **reset to fresh before any timing/triage run**.
- Ground rules unchanged: branch only, TDD on handler changes, no fake-green,
  re-verify on fresh DB, migrations hand-written next **0073**, pre-commit passes
  w/o `--no-verify`, preserve untracked `docs/aha/outputs/*.md`, no heavy bash
  during a timing run.
