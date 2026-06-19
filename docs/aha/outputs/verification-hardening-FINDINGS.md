# Verification Hardening — Phase 0 Findings (Memberry)

Date: 2026-06-18 · HEAD `c47af2c9` · branch `fix/audit-remediation-2026-06`

Phase 0 of the verification-hardening prompt is **already complete** — captured
here from live-repo inspection so the executing agent skips rediscovery.

## Stack (discovered)

| Axis | Reality |
|---|---|
| Test runner | Bun test (API unit), Playwright (E2E) |
| E2E framework | Playwright — ~144 specs `apps/memberry/tests/e2e` + `apps/admin/tests/e2e` |
| App boot | `bun dev` (API :7213 + app :3004); Vite proxy strips `/api` |
| Services | Postgres 16 + MinIO (S3) |
| API style | REST (Hono + TypeSpec-generated routes), OpenAPI source of truth |
| Frontend | Vite + TanStack Router + TanStack Query, Better-Auth |
| CI | 7 workflows: ci, contract, deploy, e2e-flake-tracking, migration-checklist, monitor, quality-gates |

## Thesis evidence — firewall is ~70% ALREADY BUILT

| Prompt assumption | Reality |
|---|---|
| E2E may be absent | ✅ 144 specs incl. real flows (`cross-persona/`, `billing`, `auth/`, `cross-org-isolation`) |
| E2E SKIPs when stack down | ✅ blocked — `lint:no-skips` (`scripts/lint-no-skips.ts`), ci.yml step "No silent test skips" |
| No real-stack CI gate | ✅ ci.yml boots postgres + minio + `bun dev`, runs Playwright 6-shard |
| Coverage = mention not execution | ⚠️ partial — `scripts/audit-e2e-depth.ts` classifies real-flow vs selector-only |
| Flows multi-step | ✅ cross-persona journeys orchestrate 2+ calls |
| No architecture/domain map | ⚠️ EXISTS but stale (see below) |

## Real gaps (the actual targets)

- **G1 — DoD coverage ~1.25 / 4.** `audit-e2e-depth.ts` covers clause 2 (goal-state,
  heuristic `dataAssertions >= 2`) + weakly clause 3 (`.status()` count). **Clause 1
  (silent error surface: console.error / pageerror / unhandled 4xx-5xx on happy path)
  and clause 4 (independent-session read) are enforced NOWHERE.** Highest value.
- **G2 — depth heuristic gameable.** Two matching `expect()` calls pass a spec that
  asserts nothing meaningful. Regex-only, no semantic check.
- **G3 — suite stability: HEALTHY.** PRs #10 + #11 squash-merged green to main
  2026-06-18; older "~79 contamination" theory was stale. `withIsolatedFixture`
  adoption may be partial — verify, don't block.
- **G4 — KG stale + uncommitted.** `.understand-anything/` (gitignored line 269):
  `knowledge-graph.json` 3,474 nodes / 8,259 edges / 11 layers; `domain-graph.json`
  185 nodes / 200 edges / 54 domainMeta / 43 entryPoints. Generated commit `0178b7c`
  = **341 commits behind HEAD**. Whole-repo blob, not per-domain.

## Must-never-break journeys (candidates from existing specs)

Pick 3–8; confirm against business priority:
1. Treasurer records dues → member sees receipt (`cross-persona/treasurer-records-dues-member-sees-receipt.spec.ts`)
2. Billing / Stripe Connect (`billing.spec.ts`)
3. Auth: registration + OTP + password reset (`auth/`)
4. Cross-org isolation (`cross-org-isolation.spec.ts`) — security-critical
5. Directory onboarding (`directory-onboarding.spec.ts`)

## Recommendation

Hardening **warranted but narrow** — the firewall exists; close clauses 1 & 4 + the
gameable heuristic. KG = refresh + commit, lower priority. Suite is green, so
RED→GREEN proof is straightforward. See PLAN.
