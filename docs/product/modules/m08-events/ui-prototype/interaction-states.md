<!-- oli:ui-blueprint v2.0 | generated 2026-05-23 | source: MODULE_SPEC.md, Wave 2a design doc -->

# UI Blueprint — Interaction States: Events (M08) — Wave 2a

> 9 canonical states per screen. Completeness scored per screen.

---

## State Definitions

| # | State | Description |
|---|-------|-------------|
| 1 | Empty | No data exists yet |
| 2 | Loading | Data being fetched |
| 3 | Loaded | Data displayed normally |
| 4 | Error | Fetch or action failed |
| 5 | Partial | Some data loaded, some failed |
| 6 | Submitting | Form or action in progress |
| 7 | Success | Action completed successfully |
| 8 | Stale | Data may be outdated |
| 9 | Offline | No network connection |

---

## Screen 1: Events Dashboard (Officer)

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Empty | No events in org | EmptyState: "No events yet" + "Create your first event" CTA | Create button |
| Loading | Initial fetch | 4-6 skeleton cards in grid | Auto |
| Loaded | Data returned | Event cards in StaggerGrid | — |
| Error | API failure | EmptyState: "Failed to load events" | Retry button |
| Submitting | Publishing/cancelling | Action button shows Loader2 spinner | — |
| Success | Action completed | sonner toast + list refresh | — |

**Completeness: 6/9** (partial, stale, offline not explicitly handled)

---

## Screen 2: Create/Edit Event

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Empty | New event form | All fields empty, defaults applied | — |
| Loading | Edit mode fetch | Skeleton form | Auto |
| Loaded | Edit mode data | Form populated with existing values | — |
| Error | Save failed | Red alert banner with error message | Fix + retry |
| Submitting | Save/publish clicked | Button text → "Saving..." / "Publishing...", disabled | — |
| Success | Save completed | sonner: "Draft saved" / "Event published", redirect | — |

**Completeness: 6/9**

### Validation States

| Field | Validation | Timing | Display |
|-------|-----------|--------|---------|
| Title | Required, 1-200 chars | onBlur | Red text below field |
| Start/End date | Required | onBlur | Red text below picker |
| Credit hours | 0.5 increments, max 40 | onBlur | Red text: "Must be in 0.5 increments" / "Max 40 hours" |
| Registration fee | >= 0 | onBlur | Red text: "Cannot be negative" |
| Publish guard | Paid event + no Stripe | onPublish | BusinessLogicError: "Set up billing to charge for events" |

---

## Screen 3: Event Check-In (Officer)

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Empty | No attendees | EmptyState: "No registrations yet" | — |
| Loading | Fetch attendees | Skeleton table | Auto |
| Loaded | Data returned | Attendee table + attendance counter | — |
| Error | API failure | EmptyState: "Failed to load" | Retry |
| Submitting | Check-in in progress | Button shows spinner | — |
| Success | Check-in confirmed | Green flash animation: "[Name] ✓" (2s) | — |

### Check-In Error States

| Error | Display | Duration |
|-------|---------|----------|
| Already checked in | ConflictError → "Already checked in at [time]" | 3s flash |
| Not registered | NotFoundError → "Not registered for this event" | Persistent toast |
| Event completed | BusinessLogicError → banner: "Event completed — check-in locked" | Permanent |
| Camera permission denied | "Camera access required for QR scanning" + manual fallback | Until dismissed |

**Completeness: 7/9**

---

## Screen 4: Event Detail (Member)

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Empty | N/A (event always exists if routed) | — | — |
| Loading | Fetch event | Skeleton: title bar, detail card, button | Auto |
| Loaded | Data returned | Full event detail with cover image | — |
| Error | Event not found | EmptyState: "Failed to load event" | Back to events list |
| Submitting | Register/cancel in progress | Button shows Loader2 spinner | — |
| Success (register) | Registration confirmed | sonner: "Registered!" + show calendar button | — |
| Success (waitlist) | Waitlisted | sonner: "Added to waitlist" + status card | — |
| Success (cancel) | Cancelled | sonner: "Cancelled" + show register button | — |

### Payment Flow States

| State | Trigger | Display |
|-------|---------|---------|
| Pre-payment | Click "Register and Pay" | Button shows spinner, redirects to Stripe |
| Payment success | Return with `?payment=success` | sonner: "Payment confirmed!" |
| Payment cancelled | Return with `?payment=cancelled` | sonner: "Payment not completed. Try again." |
| Payment error | Stripe error | sonner error toast |

**Completeness: 8/9**

---

## Screen 5: Public Event Page (Unauthenticated)

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Loading | Fetch by slug | Skeleton | Auto |
| Loaded | Published event | Full details + "Join to register" CTA | — |
| Not found | Draft/cancelled/invalid slug | 404 page | — |
| Completed | Event status = completed | Read-only + "This event has ended" banner | — |

**Completeness: 4/9** (not yet implemented)

---

## Screen 6: My Events

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Empty | No registrations | EmptyState: "No upcoming events" / "No events found" | Browse events link |
| Loading | Fetch | 4 skeleton cards in grid | Auto |
| Loaded | Data returned | EventRegistrationCard grid in StaggerGrid | — |
| Error | API failure | EmptyState: "Failed to load events" | Retry |
| Submitting | Cancel in progress | Cancel button shows Loader2 | — |
| Success | Cancelled | sonner: "Registration cancelled", list refreshes | — |

**Completeness: 6/9**

---

## Screen 7: Discover Events (Public)

| State | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Empty | No matching events | EmptyState: "No public events found" | Clear filters |
| Loading | Fetch | 6 skeleton cards in grid | Auto |
| Loaded | Data returned | PublicEventCard grid | — |
| Error | API failure | EmptyState: "Failed to load events" | Retry |

**Completeness: 4/9** (minimal — public read-only page)

---

## Overall Completeness

| Screen | Score | Notes |
|--------|-------|-------|
| Events Dashboard | 6/9 | Missing: partial, stale, offline |
| Create/Edit Event | 6/9 | Missing: partial, stale, offline |
| Event Check-In | 7/9 | Missing: stale, offline |
| Event Detail (Member) | 8/9 | Missing: offline |
| Public Event Page | 4/9 | Not yet implemented |
| My Events | 6/9 | Missing: partial, stale, offline |
| Discover Events | 4/9 | Minimal for public page |

**Average: 5.9/9** — Good for alpha. Offline/stale handling is a post-v1 concern (TanStack Query handles stale-while-revalidate automatically).
