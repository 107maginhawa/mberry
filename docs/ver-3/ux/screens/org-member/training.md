# Training List (Member View)

- **Route:** `/org/[id]/training`
- **Module:** M09 Training
- **Access:** Member (must be active member of this org)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let members browse available CPD training programs (from their org and network-wide) so they can find relevant opportunities to earn credits toward their regulatory cycle.

## Layout

### Desktop
Left sidebar carries the org navigation. Main content area has a filter bar at the top and a card grid below (2–3 columns depending on viewport). A credit summary banner just below the filter bar reminds the member of their current CPD cycle progress: "You've earned X of Y required credits this cycle." This is a persistent nudge to keep earning. Cards are 16:9 cover image with metadata below.

### Mobile
Credit summary banner appears collapsed by default (shows "X / Y credits" as a single line tap-to-expand). Filter options accessible via a bottom sheet triggered by a "Filters" button in the chip row. Single-column card list. Pull-to-refresh.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Credit Progress Banner | Info bar | "You've earned X of Y required CPD credits this cycle." Tapping links to the member's full credit dashboard (M10). Shown in amber if member is behind pace for their cycle end date. |
| Status Filter Chips | Chips (horizontal scroll) | Upcoming (default) / Past / My Enrollments. |
| Type Filter | Dropdown | Filter by one of the 5 platform-defined training types: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training. "All types" default. |
| Date Range Filter | Date picker pair | Optional narrowing by start/end date. |
| Credit Value Filter | Range input | Min/max CPD credits filter (e.g., "2 – 5 credits"). Helps members who need exactly N more credits. |
| Free/Paid Filter | Toggle chips | All / Free / Paid. |
| Org Source Filter | Dropdown (if multi-org member or network-wide trainings visible) | "My Org" / "All Associations". |
| Training Card | Card | Cover image thumbnail (16:9, or type-icon placeholder). Training type badge. **Credit value badge** (prominent, e.g., "5 CPD" in a contrasting color — this is the most important piece of information on the card). Title. Date(s). Location or "Online". Regulatory approval status badge: green "PRC Approved" / yellow "Pending Approval" / no badge if N/A. Enrollment status chip: Open / Full / Approval Required / Invitation Only. Fee badge if paid. Hosting org name if from another org. |
| Empty State | Illustration + text | Context-sensitive copy for no results. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | 6 skeleton cards. Credit progress banner shows a placeholder progress bar. |
| Empty — no trainings | Org has no published trainings | "No upcoming trainings. Your chapter or network will post CPD opportunities here." |
| Empty — filtered | Filters applied with no matches | "No trainings match your filters. Try widening your credit range or clearing the type filter." + "Clear filters" link. |
| Populated | Trainings exist | Card grid, paginated (20 per page). |
| My Enrollments empty | Member has no active enrollments | "You haven't enrolled in any trainings yet. Browse upcoming programs above." |
| Error | API failure | "Unable to load trainings. Pull down to retry." |

## Interactions

- Tapping a training card navigates to `/org/[id]/training/[id]`.
- The credit value badge is the visual anchor — it must be the largest, boldest piece of text on the card after the title.
- Network-wide trainings (from other orgs in the association) display the hosting org's logo at the bottom of the card. Members can enroll in these even if they are from a different org; all registration and payment goes through the hosting org.
- "My Enrollments" chip filters to show only trainings the member is currently enrolled in (any status: enrolled, pending approval, waitlisted, pending payment). Past completed trainings live under `/my/training`, not here.
- Cancelled trainings appear in the Past tab only, with a "Cancelled" badge. They are never shown in Upcoming.
- Lapsed members can browse the list but enrollment CTAs are disabled with a tooltip: "Renew your dues to enroll in training."
