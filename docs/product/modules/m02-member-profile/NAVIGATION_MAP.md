---
name: navigation-map
module: m02-member-profile
route-count: 7
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.716Z
status: INFERRED — needs human review
---

# Navigation Map — m02-member-profile

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (7)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/_authenticated/my/data-export` | `/my/data-export` | DataExportPage | memberry | yes | — | — |
| `/_authenticated/my/id-card` | `/my/id-card` | MyIdCard | memberry | yes | — | — |
| `/_authenticated/my/organizations` | `/my/organizations` | MyOrganizationsPage | memberry | yes | — | — |
| `/_authenticated/my/profile` | `/my/profile` | MyProfilePage | memberry | yes | — | — |
| `/_authenticated/my/settings` | `/my/settings` | MySettingsPage | memberry | yes | — | — |
| `/_authenticated/settings/account` | `/settings/account` | AccountSettingsPage | memberry | yes | — | — |
| `/_authenticated/settings/security` | `/settings/security` | SecuritySettingsPage | memberry | yes | — | requireAuth, requirePerson |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
