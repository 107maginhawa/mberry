# Recon Baseline — Wave 0

Generated: 2026-06-06T00:00:00Z
HEAD: d24d98ba5aab0f47487a5fe38bade91ce768e48e

## Inventory counts

| Artifact | Count | Search root |
|---|---|---|
| TypeSpec sources (.tsp) | 59 | `specs/api/src` |
| OpenAPI endpoint paths | 312 | `specs/api/dist/openapi/openapi.json` |
| Hurl contract scenarios | 99 | `specs/api/tests/contract` |
| Handler files (excl. repos/, jobs/, *.test.ts) | 589 | `services/api-ts/src/handlers` |
| Handler test files | 475 | `services/api-ts/src/handlers` |
| Handler:test ratio | 80.6% | (475/589) |
| apps/memberry E2E specs | 0 | `apps/memberry/**/*.spec.ts` |
| apps/admin E2E specs | 0 | `apps/admin/**/*.spec.ts` |

## Contradictions vs prior audits

- **TypeSpec count**: Prior audits cited conflicting values (one said 20, another said 0, reviewer recount said 32). **Actual ground truth: 59 .tsp files** — all prior figures were wrong. The count has grown substantially through Phase 35 TypeSpec migration.
- **Hurl scenarios**: CLAUDE.md states "97 .hurl files". **Actual: 99** — 2 additional scenarios added since docs were written.
- **E2E specs**: Prior audit claimed "130+ tests passing" (see memory: e2e-audit-status). **Actual: 0 *.spec.ts files found** in either app. E2E tests may have been in a different format or removed. CRITICAL — Wave 2 must investigate.
- **Handler count**: CLAUDE.md mentions ~26 handler directories. **Actual: 27 directories** (including `__tests__/` pseudo-dir). Real module dirs: 26 (excluding `__tests__`).
- **elections.tsp**: CLAUDE.md notes elections as "hand-wired, not yet migrated to TypeSpec." **Confirmed: no elections*.tsp file found in specs/api/src.** W6.3 backfill is needed.

## Knowledge graph freshness

- analyzedAt: 2026-06-06T00:00:46.068Z
- gitCommitHash: 0178b7cadc050c45ac7dd32cb15c125af1ed138d
- Distance from HEAD: **59 commits stale** — KG was snapshotted at the same calendar date but 59 commits behind current HEAD. Do NOT rely on KG for current handler/module counts.

## FE consumer matrix highlights

- **Modules with hits in BOTH apps/memberry/src AND apps/admin/src** (touch-both, high-risk for Wave 3.5):
  `booking`, `person`, `comms`, `default`, `storage`, `notifs`, `invite`, `surveys`, `events`, `email`, `billing`, `reviews`

- **Modules with hits ONLY in apps/admin/src** (previously thought "no FE" — CRITICAL for Wave 3.5 delete decisions):
  `audit` (27 hits admin, 0 memberry) — **must NOT be pruned without admin impact analysis**

- **Modules with hits ONLY in apps/memberry/src**:
  `dues`, `certificates`, `association:member` (1 hit, likely incidental), `documents`, `communication`, `onboarding`, `membership`, `elections`

- **Modules with ZERO hits in both apps** (true delete candidates for Wave 3.5):
  `marketplace`, `association:operations`, `advertising`, `jobs`, `platformadmin`
  Note: zero hits = no string references matching module name in FE source; does not guarantee no API usage via SDK hooks (verify SDK imports separately).

- Full per-module matrix: `docs/quality/RECON_BASELINE.fe-matrix.json`

## Bun coverage mechanism

- Bun version: 1.2.21
- `bunfig.toml` exists but contains **no `[test.coverage]` section**
- CLI flags available: `--coverage`, `--coverage-reporter`, `--coverage-dir`
- **No native threshold enforcement** in Bun 1.2.21 — `bun test --coverage` reports coverage but does NOT fail on threshold violations; no `--coverage-threshold` flag exists
- Recommended Wave 3 approach: **wrapper script** — parse `bun test --coverage` text output, extract line/branch/function percentages, exit non-zero if below thresholds

## Wave dependencies surfaced

- **Wave 3.5 must verify against admin matrix before deleting**: `audit` (admin-only), `booking`, `person`, `comms`, `default`, `storage`, `notifs`, `invite`, `surveys`, `events`, `email`, `billing`, `reviews` (both apps)
- **Wave 6.3 (TypeSpec elections backfill)**: elections.tsp does NOT exist yet — W6.3 must create from scratch, not patch
- **Wave 3.0 (coverage threshold spike)**: Use wrapper script (no native bunfig threshold key in Bun 1.2.21)
- **Wave 2 (E2E depth)**: URGENT — 0 *.spec.ts files found in both apps; prior "130+ passing" claim needs investigation before Wave 2 scope is written
- **KG staleness**: 59 commits — re-index before any Wave 5 map work (`/oli-check` or equivalent)
