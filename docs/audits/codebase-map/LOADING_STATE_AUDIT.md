# Loading-State Hygiene Audit — DRAINED (Wave G8, 2026-05-30)

Brownfield audit produced by `scripts/gates/loading-state-hygiene.ts` on top of `CODE_COMPONENT_REGISTRY.json` after Wave G5 W2 component-flow backfill.

## Status: drained

Initial state (Wave G5 W6.2): **54 violations** (53 brownfield + 1 fixed in same wave).
Wave G6 → G8 work brought this to **0 violations, 0 skeleton-ok exemptions**.

The pre-commit gate was ratcheted from `--changed-only` (informational) to default fail-closed full-tree (Wave G8 ratchet commit).

## What was done

### Wave G7 — Route layer (26 items)

19 memberry routes + 7 admin routes. Two patterns applied:

- **Real fix** (added `isError` branch with retry CTA): routes whose query was the primary data source, reusing `ErrorState` from `@/components/patterns/error-state` (memberry) or a new `ErrorState` in `apps/admin/src/components/skeletons.tsx` (admin).
- **Marker fix** (`// oli-execute: error-handled-inline`): routes that already rendered an explicit error branch but used a destructured rename (`error: foo`) which masked the literal `isError` token from the gate's regex.

### Wave G8 — Feature components (27 items + 1 shell)

Feature components consumed by routes that already own the error contract. The audit's own caveat documented this as a known false-positive class. Each marker cites the consuming route or near-by error context so the contract is traceable from the file itself.

## Severity (initial)

| Surface | Initial count | Status post-G8 |
|---|---|---|
| `apps/admin/src/routes/**` pages | 7 | 0 (G7) |
| `apps/memberry/src/routes/**` pages | 19 | 0 (G7) |
| `apps/memberry/src/features/*/components/**` | 27 | 0 (G8 markers) |
| `apps/memberry/src/{main,providers,components}.tsx` | 3 | 0 (G8 markers) |

## Audit entry schema (for future violations)

Each component in `CODE_COMPONENT_REGISTRY.json` carries:

```json
{
  "file_path": "string",
  "loading_state_hygiene": {
    "violation": "string | null",
    "has_skeleton_ok_marker": boolean
  }
}
```

## Rule

The detector fires when a file contains BOTH `(Loader2|Skeleton|animate-spin|animate-pulse)` AND `(isPending|isLoading)` but no `(isError|onError|catch)` branch and no exemption marker.

## Markers

- `// oli-execute: skeleton-ok` — explicit intentional permanent skeleton, capped at 5 tree-wide.
- `// oli-execute: error-handled-inline` — error is handled but the gate heuristic misses it (destructured rename, 404=success path, parent-route-owns-error). No cap.

## Where the gate runs

- **Pre-commit step 0.8**: `bun scripts/gates/loading-state-hygiene.ts` (fail-closed, full tree).
- **Local dev**: `bun scripts/gates/loading-state-hygiene.ts --changed-only` for iteration speed.

Per-file fix path: add an `isError` early-return rendering `ErrorState` with `refetch`; or add the appropriate marker.
