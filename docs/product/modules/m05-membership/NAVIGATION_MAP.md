---
name: navigation-map
module: m05-membership
route-count: 4
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.716Z
status: INFERRED — needs human review
---

# Navigation Map — m05-membership

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (4)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/members/$personId` | `/members/$personId` | MemberDetailPage | admin | — | personId | — |
| `/members/` | `/members/` | MembersPage | admin | — | — | — |
| `/invite/$token` | `/invite/$token` | InvitePage | memberry | — | token | — |
| `/_authenticated/org/$orgSlug/members` | `/org/$orgSlug/members` | MembersDirectoryPage | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
