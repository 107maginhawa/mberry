---
name: navigation-map
module: m14-national-dashboard
route-count: 5
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m14-national-dashboard

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (5)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/national-dashboard/` | `/national-dashboard/` | — | admin | — | — | — |
| `/_authenticated/dashboard` | `/dashboard` | DashboardPage | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/officer/dashboard` | `/org/$orgSlug/officer/dashboard` | OfficerDashboardPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/reports/credits` | `/org/$orgSlug/officer/reports/credits` | CreditReport | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/reports/financial` | `/org/$orgSlug/officer/reports/financial` | FinancialReportsPage | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
