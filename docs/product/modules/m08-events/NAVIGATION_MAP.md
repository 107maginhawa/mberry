---
name: navigation-map
module: m08-events
route-count: 10
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m08-events

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (10)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/events/` | `/events/` | — | admin | — | — | — |
| `/discover/events` | `/discover/events` | DiscoverEvents | memberry | — | — | — |
| `/events/$eventSlug` | `/events/$eventSlug` | PublicEventPage | memberry | — | eventSlug | — |
| `/_authenticated/my/events` | `/my/events` | MyEvents | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/events/$eventId` | `/org/$orgSlug/events/$eventId` | EventDetail | memberry | yes | orgSlug, eventId | — |
| `/_authenticated/org/$orgSlug/events/` | `/org/$orgSlug/events/` | OrgEvents | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/events/$eventId` | `/org/$orgSlug/officer/events/$eventId` | EventDetail | memberry | yes | orgSlug, eventId | — |
| `/_authenticated/org/$orgSlug/officer/events/` | `/org/$orgSlug/officer/events/` | OfficerEvents | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/events/new` | `/org/$orgSlug/officer/events/new` | NewEvent | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/events/$eventId/attendance` | `/org/$orgSlug/officer/events/$eventId/attendance` | EventAttendance | memberry | yes | orgSlug, eventId | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
