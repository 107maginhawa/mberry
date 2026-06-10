---
name: navigation-map
module: m12-elections-governance
route-count: 7
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m12-elections-governance

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (7)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/_authenticated/org/$orgSlug/elections/` | `/org/$orgSlug/elections/` | MemberElectionsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/elections/$electionId/` | `/org/$orgSlug/elections/$electionId/` | MemberElectionDetailPage | memberry | yes | orgSlug, electionId | — |
| `/_authenticated/org/$orgSlug/elections/$electionId/vote` | `/org/$orgSlug/elections/$electionId/vote` | VotePage | memberry | yes | orgSlug, electionId | — |
| `/_authenticated/org/$orgSlug/officer/elections/$electionId` | `/org/$orgSlug/officer/elections/$electionId` | ElectionDetailLayout | memberry | yes | orgSlug, electionId | — |
| `/_authenticated/org/$orgSlug/officer/elections/` | `/org/$orgSlug/officer/elections/` | OfficerElections | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/elections/new` | `/org/$orgSlug/officer/elections/new` | NewElection | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/elections/$electionId/edit` | `/org/$orgSlug/officer/elections/$electionId/edit` | EditElection | memberry | yes | orgSlug, electionId | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
