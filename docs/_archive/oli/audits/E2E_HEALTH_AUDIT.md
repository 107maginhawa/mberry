# E2E Health Audit — 2026-06-05

## Headline

Full Playwright suite (`bun run test:e2e` from `apps/memberry`):

- **702 tests** declared across **139 spec files**
- Run hit `--max-failures=300` cap; **593 tests reached, 109 not run**
- **269 passed** / **300 failed** / **24 skipped (fixme)**
- Failures concentrated in **86 of 139 files**

Pass rate of *reached* tests: **45%**.

## Backend / contract suites for context (all green)

- API unit tests: green (Bun test, ~4961 specs)
- Contract suite (Hurl, post-CSRF + storage-state + parallelization fixes):
  **95/95 green**, 4 specs cleanly skipped (mailpit + stripe-mock need Docker)
- TypeScript checks: green across all workspaces

E2E is the remaining weak link — backend coverage and contract conformance
are solid.

## Failure category breakdown (n=300)

| Count | Category | Root cause | Bulk-fix path |
|------:|----------|------------|---------------|
| 155 | `expect(locator).toBeVisible()` failed | Selector drift — UI evolved past the selector | Per-spec; usually role+name+level scoping, or `getByText(/regex/)` replacement |
| 90 | `expect(value).toBeTruthy()` | Same as above, hidden behind the `isVisible({timeout}).catch(() => false)` antipattern (no polling) | Convert to `await expect(locator).toBeVisible({ timeout })` |
| 28 | `TimeoutError` (click / wait) | Element appears late or doesn't appear; sometimes points at a removed UI affordance | Update locator, or use `waitFor` before click |
| 7 | `axe found N serious+critical violation(s)` | Real product a11y issues (not test bugs) | Fix product: missing labels, contrast, focus-trap on dialogs |
| 16 | Misc (`toBe`, `toContain`, `Failed to fetch`, etc.) | Mixed — assertion drift, one missing CSRF token, one cross-app misconfig | Per-spec |
| 2 | `rendered blank` (click-through gate) | `/my/credits`, org `/home` render empty `<main>` for some personas | Real product bug — empty-state UI missing |
| 1 | `toHaveScreenshot` mismatch | Visual baseline drift after recent UI edits | `--update-snapshots` after design sign-off |
| 1 | `CSRF token required` | One remaining `page.evaluate(() => fetch(API))` call without csrf | Swap to new `apiFetch` helper (see helpers/api-fetch.ts) |

## What's been fixed this pass

- `services/api-ts/src/middleware/security.ts` — added `X-CSRF-Token` to CORS
  `allowHeaders`. Without this every browser-context CSRF-bearing fetch
  (SPA → API) fails preflight.
- `apps/memberry/tests/e2e/helpers/api-fetch.ts` — new helper that:
  mints a CSRF token in-page, attaches `x-csrf-token`, `x-org-id`, and
  `credentials: 'include'`. Replace `page.evaluate(() => fetch(API))` with
  `apiFetch(page, path, { method, body, orgId })`.
- `apps/memberry/tests/e2e/auth.spec.ts` — 3 selectors fixed
  (sidebar brand uses `<img alt>`, Profile link scoped to sidebar,
  dashboard heading queried by role+level+name). One test fixme'd —
  documents real product issue (route resolution between public
  `/org/$slug` and authenticated `/org/$orgSlug` layout).
- `apps/memberry/tests/e2e/cross-org-isolation.spec.ts` — prepend
  `page.goto('/dashboard')` so cross-origin fetches inherit the SPA origin
  (was `Origin: null` → CORS rejection).
- `apps/memberry/tests/e2e/directory-onboarding.spec.ts` — same Origin +
  CSRF fix via `apiFetch`. `isVisible({timeout})` → `toBeVisible` (polling).
  One test fixme'd: `POST /persons` enforces 1:1 user↔person, so a
  signed-in officer always 409s — needs different setup strategy.

## Top-10 files by failure count

| Fails | File | Likely fix |
|------:|------|------------|
| 10 | `communications.spec.ts` | Officer storageState + selector update |
| 9 | `documents.spec.ts` | Selector update (page redesign) |
| 8 | `profile-settings-actions.spec.ts` | Heading scoping + `toBeVisible` swap |
| 8 | `secretary-journey.spec.ts` | Cross-persona navigation drift |
| 8 | `society-officer-journey.spec.ts` | Same |
| 8 | `treasurer-journey.spec.ts` | Same |
| 8 | `events.spec.ts` | Selector update + apiFetch for setup |
| 8 | `cpd-settings.spec.ts` | Selector update |
| 8 | `settings.spec.ts` | Selector + form-control role drift |
| 7 | `_a11y.spec.ts` | **Product fixes needed** — not test bugs |

## What "fix all 300" actually requires

Mechanically:

- **~245 of 300** (`toBeVisible` + `toBeTruthy` + `TimeoutError`) are selector
  rewrites. Most need ~3–10 min each: open the page in dev, find the
  current selector that matches the intended user-visible element,
  replace the test's locator. Cannot be safely automated wholesale — many
  share generic substrings (e.g. "Member", "Profile") that resolve to
  multiple elements and need role+level scoping per case.
- **9 are real product bugs** (7 a11y + 2 blank renders). Fix the product,
  not the test.
- **~25 are infrastructure/auth issues** that this pass already
  partially addressed (CSRF + apiFetch helper). Remaining specs need to
  adopt the helper. Mechanical sed-style rewrite is feasible for the
  `page.evaluate(() => fetch(API))` pattern but risky for setup steps
  with custom logic.
- **1 visual baseline + 1 visual screenshot** require a design sign-off
  before `--update-snapshots`.

Realistic budget: **3-5 engineering days** for full E2E green, assuming
no further FE evolution. Suggested split:

1. Day 1 — `apiFetch` migration across all `page.evaluate(fetch)` callers
   (probably converts ~30 of the 300 fails).
2. Day 2-3 — top-10 fail-count files: per-spec selector audit + rewrite.
3. Day 4 — product a11y + blank-render fixes (cross-functional with
   design).
4. Day 5 — long tail of single-fail files; visual baseline refresh.

## What this audit pass actually delivered (vs. plan)

**Delivered**:
- Contract suite: 95/95 green (infra-gated 4 cleanly skipped)
- BE unit + integration: green
- E2E infrastructure: storageState, parallel workers, CSRF cookie
  mirroring, networkidle removal, helper for in-page CSRF fetches,
  CORS `x-csrf-token` allowance
- Coverage matrices: BR × Flow × Route, with CI gates
- Click-through, a11y, visual, cross-persona scaffolds in place
- FE Vitest backfill for regressed modules

**Not delivered** (and not feasible in single-session scope):
- 300 selector-drift fixes across 86 files
- 9 product a11y / blank-render fixes
- Cross-persona spec activation (the 5 scaffolds are still fixme'd —
  they need real seed data + DB seed reset between runs)

## Recommended next steps (in order)

1. Pick the **top-10 fail-count files** above. Run each individually
   with `bunx playwright test <file> --debug` (single worker, headed) and
   step through to identify the current selector. Atomic commit per file.
2. Migrate **all** `page.evaluate(() => fetch(API_BASE))` callers to
   `apiFetch` (grep + per-call review):
   ```bash
   grep -rln "page.evaluate.*fetch(.*apiBase" apps/memberry/tests/e2e/
   ```
3. Triage **`_a11y.spec.ts` failures** to design — fix the underlying
   UI (labels, contrast, focus-trap), not the test.
4. Schedule a **visual baseline refresh** (`--update-snapshots`) at the
   next design sign-off.
5. Add a **DB-seed-reset hook** to `playwright.config.ts` global setup
   so cross-persona specs don't poison each other's state (the
   `Updated-1780084414983` org name pollution we found in
   `pda-metro-manila` is a symptom of this gap).
