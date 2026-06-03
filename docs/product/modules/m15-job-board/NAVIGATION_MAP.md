---
name: navigation-map
module: m15-job-board
route-count: 0
derivation: heuristic-path-tokens-from-CODE_ROUTE_MAP
derived-from-head: bf8b8fdd
derived-from-map: 80312e6e
last-generated: 2026-06-03T01:03:31.717Z
last-generated-by: scripts/generate-navigation-map.ts (P2-14)
status: NO-UI (deferred or backend-only)
---

# Navigation Map — m15-job-board

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module, so `/oli-check --journeys` decomposes coverage per-module instead of inferring it heuristically every cycle.

## Status: no frontend routes

This module currently has zero routes mapped to it. Possible reasons:
- The module is **deferred to a future milestone** (see MASTER_PRD v3.0 descope list — m13/m15/m16/m17 are explicitly future-scope).
- The module is **backend-only** (m22-email's queue is API-only; no UI surface).
- Routes exist but the path-token heuristic in `scripts/generate-navigation-map.ts` failed to map them — review the unmapped block in the consolidated `docs/product/NAVIGATION_MAP.md` and add a regex.

Journeys dimension treats this as `⊘ no-ui` in the coverage matrix (not a gap).
