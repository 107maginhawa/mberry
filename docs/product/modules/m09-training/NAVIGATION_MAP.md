---
name: navigation-map
module: m09-training
route-count: 8
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m09-training

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (8)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/training/` | `/training/` | — | admin | — | — | — |
| `/_authenticated/my/training` | `/my/training` | MyTraining | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/training/$trainingId` | `/org/$orgSlug/training/$trainingId` | TrainingDetail | memberry | yes | orgSlug, trainingId | — |
| `/_authenticated/org/$orgSlug/training/` | `/org/$orgSlug/training/` | OrgTraining | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/training/$trainingId` | `/org/$orgSlug/officer/training/$trainingId` | TrainingDetail | memberry | yes | orgSlug, trainingId | — |
| `/_authenticated/org/$orgSlug/officer/training/` | `/org/$orgSlug/officer/training/` | OfficerTraining | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/training/new` | `/org/$orgSlug/officer/training/new` | NewTraining | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance` | `/org/$orgSlug/officer/training/$trainingId/attendance` | TrainingAttendance | memberry | yes | orgSlug, trainingId | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
