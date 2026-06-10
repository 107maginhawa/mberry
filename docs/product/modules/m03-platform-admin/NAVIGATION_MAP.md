---
name: navigation-map
module: m03-platform-admin
route-count: 7
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.716Z
status: INFERRED — needs human review
---

# Navigation Map — m03-platform-admin

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (7)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/audit/` | `/audit/` | — | admin | — | — | — |
| `/compliance/` | `/compliance/` | CompliancePage | admin | — | — | — |
| `/feature-flags/` | `/feature-flags/` | — | admin | — | — | — |
| `/impersonate/` | `/impersonate/` | — | admin | — | — | — |
| `/operators/` | `/operators/` | — | admin | — | — | — |
| `/verifications/` | `/verifications/` | VerificationsPage | admin | — | — | — |
| `/_authenticated/org/$orgSlug/officer/compliance` | `/org/$orgSlug/officer/compliance` | OfficerCompliance | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
