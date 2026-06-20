# E2E Remediation — green PR #1 (design/ui-ux-audit → main)

Date: 2026-06-21
Branch: `design/ui-ux-audit` · PR #1 (107maginhawa/mberry#1) · base `main` (0 behind = FF-able)
Goal: green the e2e tail (+ the surprise unit-tests regression) so CI passes, then FF-merge to main.

## Starting CI state (HEAD 5936b00b, run 27877700307)
- GREEN: build-api, build-frontends, lint-typecheck, contract, coverage-gate, checklist, new-code-gate, artifact-smoke.
- BASELINE-RED (also red on main — discount): `gates`/Quality Gates (no-DB coverage test).
- RED (net-new vs main): `unit-tests` (frontend), `e2e-admin`, `e2e-memberry` shards 1/4/5/6 (2/3 already passed).

## Failures fixed (each reproduced live, classified, fixed at the right layer, re-verified live)

| # | Spec / job | Root cause | Class | Fix | Commit |
|---|---|---|---|---|---|
| 1 | unit-tests · compose-form.test.tsx (2) | mock returned old `{data:{id}}`; component reads flat `created?.id` (ISSUE-029) → chain aborts | test-fragility | flatten create-call mocks | `9c198077` |
| 2 | e2e-admin · members.spec:18 | `GET /organizations/{id}/members` → 405 (no GET route; admin lists via roster SDK); probe accepted only [200,404] | test-fragility | accept 405 | `d4d657f2` |
| 3 | e2e-memberry · communications:71,134 | **officer announcement detail + edit prefill read `data?.data`**; `getAnnouncement` returns flat resource (ISSUE-029) → detail blank, edit never prefills (silently dupes) | **REAL product bug** | read flat resource in both officer routes | `52e036d8` |
| 4 | e2e-memberry · settings:37 | toggle PATCHes `{preferences:[{category,…}]}` (handler reads `body.preferences[0]`); test asserted top-level `body.category` | test-fragility (FE↔BE verified aligned) | assert nested shape | `c1800df3` |
| 5 | e2e-memberry · settings-e2e:80 (categories) | table/empty check used instant `isVisible()` (no wait) → races data load → flakes under CI shard load | test-fragility (race) | waited web-first assertion | `c1800df3` |
| 6 | e2e-memberry · roster:24 | roster reflows table→cards below 960px **container**; officer content column capped ~720px (PageShell default) even at 1600px viewport → table never renders | test-fragility | assert card layout (member link + status badge) | `60cd9ae7` |
| 7 | e2e-memberry · roster-csv-import:26 | import now requires selecting a Membership Tier (button gated on `selectedTierId`); test never selected one. Also stale success text. | test-fragility | select tier + assert "Imported N" | `60cd9ae7` |
| 8 | e2e-memberry · documents:52 | detected docs by `heading level 3`; empty-state headline + NPS card both render `<h3>` → wrong (navigate) branch on a non-link heading | test-fragility | detect docs by card link | `b36fc3e1` |
| 9 | e2e-memberry · profile-settings-actions:8 | NPS auto-prompt (fixed bottom-right, NpsProvider) intercepts the Save Changes click | test-fragility (real UX edge) | dismiss NPS prompt before save | `b36fc3e1` |
| 10 | e2e-memberry · _click-through officer:102 | cascade — officer announcement detail rendered blank (#3) | resolved by #3 | n/a (passes after #3) |

Note: memory-listed `wave7-role-gate` (admin) and `member/credit-carryover` were NOT in the current CI failures — already green / stale notes.

## Real bugs found (would ship broken to production)
- **Officer announcement detail page rendered blank** ("Announcement not found") + **edit-draft never prefilled** (silently created a duplicate instead of updating). `getAnnouncement` was flattened by ISSUE-029; fix #5 fixed only the member route, missing both officer routes. Fixed.

## UX follow-ups flagged (NOT fixed — out of scope / product decisions)
- **Officer roster table layout is unreachable** at the default page width: the content container is capped ~720px (< the 960px CQ breakpoint) even at 1600px viewport, so officers always see the card layout, never the 9-column table. Consider widening the roster page (`maxWidth` on PageShell) if the table is intended.
- **NPS auto-prompt overlaps form Save buttons**: the fixed bottom-right NPS card can intercept clicks on bottom-right controls (e.g. profile Save). Consider repositioning / not showing on form pages.

## Verification (live, local stack)
- Every fixed spec re-run live and green. All 8 touched memberry spec files run together (workers=2, CI-parity): 76 passed / 0 failed / 2 `test.fixme` skipped.
- unit: compose-form.test.tsx 12/12. Pre-commit cross-workspace typecheck green on every commit.
- **Local admin caveat**: the full local admin e2e shows 17 extra failures across 6 files (admin-smoke/admin-routes/associations/audit/organizations/wave7-routes) — all UNCHANGED on this branch vs main and all PASSING in CI (CI admin failed ONLY members.spec). Root: local admin seed/data gap (admin API `resp` undefined). NOT branch regressions; CI is authoritative for admin. members.spec verified green locally.

## Merge plan
1. Push branch → re-run CI (e2e jobs ~6–9 min).
2. Confirm CI: unit-tests + e2e-admin + e2e-memberry shards green (gates/Quality-Gates stays baseline-red = discounted, matches main).
3. FF-merge PR #1 → main; push; verify.
