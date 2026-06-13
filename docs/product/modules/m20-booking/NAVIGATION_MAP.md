---
name: navigation-map
module: m20-booking
route-count: 6
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m20-booking

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (6)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/_authenticated/my/calendar` | `/my/calendar` | MyCalendar | memberry | yes | — | — |
| `/_authenticated/my/schedule` | `/my/schedule` | SchedulePage | memberry | yes | — | — |
| `/_authenticated/my/bookings/$bookingId` | `/my/bookings/$bookingId` | BookingDetailPage | memberry | yes | bookingId | — |
| `/_authenticated/my/bookings/host/$personId/$slotId` | `/my/bookings/host/$personId/$slotId` | ConfirmPage | memberry | yes | personId, slotId | — |
| `/_authenticated/my/bookings/host/$personId` | `/my/bookings/host/$personId` | HostPage | memberry | yes | personId | — |
| `/_authenticated/my/bookings/` | `/my/bookings/` | BookingsPage | memberry | yes | — | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
