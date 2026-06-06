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
| apps/memberry E2E specs | 144 | `apps/memberry/tests/e2e/**/*.spec.ts` |
| apps/admin E2E specs | 8 | `apps/admin/**/*.spec.ts` |

## Contradictions vs prior audits

- **TypeSpec count**: Prior audits cited conflicting values (one said 20, another said 0, reviewer recount said 32). **Actual ground truth: 59 .tsp files** — all prior figures were wrong. The count has grown substantially through Phase 35 TypeSpec migration.
- **Hurl scenarios**: CLAUDE.md states "97 .hurl files". **Actual: 99** — 2 additional scenarios added since docs were written.
- **E2E specs**: Prior audit claimed "130+ tests passing" (see memory: e2e-audit-status). **Actual: 144 *.spec.ts files in apps/memberry/tests/e2e/, 8 in apps/admin/**. Memory `project_e2e_audit.md` claim of "130+ passing" is consistent with the 144 spec files found at `apps/memberry/tests/e2e/`. The original recon ran `find apps/memberry -name '*.spec.ts'` from wrong CWD and reported 0 — corrected.
- **Handler count**: CLAUDE.md mentions ~26 handler directories. **Actual: 27 directories** (including `__tests__/` pseudo-dir). Real module dirs: 26 (excluding `__tests__`).
- **elections.tsp**: CLAUDE.md notes elections as "hand-wired, not yet migrated to TypeSpec." **Confirmed: no elections*.tsp file found in specs/api/src.** W6.3 backfill is needed.

## Knowledge graph freshness

- analyzedAt: 2026-06-06T00:00:46.068Z
- gitCommitHash: 0178b7cadc050c45ac7dd32cb15c125af1ed138d
- Distance from HEAD: **59 commits stale** — KG was snapshotted at the same calendar date but 59 commits behind current HEAD. Do NOT rely on KG for current handler/module counts.

## FE consumer matrix highlights

> **⚠️ MATRIX LIMITATION (read before using):** This matrix matches handler
> directory names case-insensitively against app source code. It does NOT
> trace generated SDK hook names (e.g. `useGetPerson`, `useListMemberships`),
> which is how apps actually consume the API. Zero hits ≠ zero consumption.
> For Wave 3.5 module-delete decisions, this matrix is a SCREENING tool only.
> Any module flagged for deletion MUST be verified via:
> 1. Grep apps for the module's specific generated SDK hook exports
> 2. Trace handler-internal imports (handlers may import other handlers)
> 3. Check `services/api-ts/src/app.ts` for explicit registration

- **Modules with name-string hits in BOTH apps/memberry/src AND apps/admin/src** (touch-both, high-risk for Wave 3.5):
  `booking`, `person`, `comms`, `default`, `storage`, `notifs`, `invite`, `surveys`, `events`, `email`, `billing`, `reviews`, `audit` (1 memberry, 35 admin), `certificates`

- **Modules with name-string hits ONLY in apps/memberry/src**:
  `dues`, `association:member` (1 hit, likely incidental), `documents`, `communication`, `onboarding`, `membership`, `elections`

- **Modules with ZERO name-string hits — REQUIRES manual SDK trace before any delete decision**:
  `marketplace`, `association:operations`, `advertising`, `jobs`, `platformadmin`

- Full per-module matrix: `docs/quality/RECON_BASELINE.fe-matrix.json` (regenerated with case-insensitive regex fix — `gi` flag)

## Bun coverage mechanism

- Bun version: 1.2.21
- `bunfig.toml` exists but contains **no `[test.coverage]` section**
- CLI flags available: `--coverage`, `--coverage-reporter`, `--coverage-dir`
- **No native threshold enforcement** in Bun 1.2.21 — `bun test --coverage` reports coverage but does NOT fail on threshold violations; no `--coverage-threshold` flag exists
- Recommended Wave 3 approach: **wrapper script** — parse `bun test --coverage` text output, extract line/branch/function percentages, exit non-zero if below thresholds

## Wave dependencies surfaced

- **Wave 3.5 must verify against admin matrix before deleting**: `audit` (1 memberry, 35 admin — both apps post-fix), `booking`, `person`, `comms`, `default`, `storage`, `notifs`, `invite`, `surveys`, `events`, `email`, `billing`, `reviews`, `certificates` (both apps)
- **Wave 6.3 (TypeSpec elections backfill)**: elections.tsp does NOT exist yet — W6.3 must create from scratch, not patch
- **Wave 3.0 (coverage threshold spike)**: Use wrapper script (no native bunfig threshold key in Bun 1.2.21)
- **Wave 2 (E2E depth)**: 144 *.spec.ts files confirmed in apps/memberry/tests/e2e/, 8 in apps/admin. Prior "130+ passing" memory claim is consistent. Wave 2 scope: deepen coverage quality, not bootstrap from zero.
- **KG staleness**: 59 commits — re-index before any Wave 5 map work (`/oli-check` or equivalent)
