---
name: navigation-map
module: m10-credit-tracking
route-count: 2
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m10-credit-tracking

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (2)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/_authenticated/my/credits/` | `/my/credits/` | MyCredits | memberry | yes | — | — |
| `/_authenticated/my/credits/log` | `/my/credits/log` | CreditLog | memberry | yes | — | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
