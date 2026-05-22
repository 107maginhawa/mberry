# My Training

- **Route:** `/my/training`
- **Module:** M09 Training, M10 Credit Tracking
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member track all their training enrollments, view credits earned from each program, access their check-in QR on training day, and download certificates for completed trainings.

## Layout

### Desktop
Single-column, max-width 720px, centered within the authenticated shell (left sidebar visible). A credit summary banner at the top ("You've earned [X] credits from [N] trainings — View full credit dashboard →" linked to `/my/credits`). Below that, three labeled sections: "Upcoming Enrollments," "Completed," and "All History." Each section contains training cards. A "Browse Trainings" link appears at the top-right.

### Mobile
Full-width. Credit summary banner is a slim bar at top (compact — just the credit total and a link arrow). Three sections stack in a single column; empty sections are hidden. "Browse Trainings" is accessible via the top-right menu or at the bottom of the page. Bottom nav is visible with Training tab active (or nearest equivalent tab).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Credit summary banner | banner | Shows total credits earned from trainings (AUTO type only). Text: "You've earned [X] credits from [N] completed trainings." Tapping navigates to `/my/credits`. |
| Upcoming enrollment card | card | Shows: training title, type badge (Seminar / Workshop / Convention / Online Course / Skills Training), date(s), hosting org, credit value badge (e.g., "5 CPD"), approval status badge (PRC Approved / Pending / N/A), enrollment status (Enrolled=green / Pending Approval=blue / Pending Payment=amber / Waitlisted=gray). |
| "Show QR" button | button | Primary. Appears on enrollment cards for in-person trainings when the training date is today. Opens the full-screen QR overlay (same component as Events — rotating every 60 seconds with countdown timer per M8-R3). |
| Waitlisted card | card | Same as enrollment card plus waitlist position ("You are #2 on the waitlist"). For paid promotions: "A spot opened! Complete payment within 24 hours." CTA. |
| Completed training card | card | Shows: title, date(s), hosting org, credits awarded badge, certificate status ("Certificate Available" with download button, or "Not Yet — available after training date and attendance confirmation," or "N/A — no certificate"). |
| "Download Certificate" button | button | Secondary. Appears on completed training cards where attendance is confirmed AND the training date has passed (BR-20). Opens `/my/certificates/[id]` or triggers direct PDF download. |
| Certificate unavailable notice | text | If training date has not yet passed: "Certificate available after [date]." If attendance not confirmed: "Certificate not available. Contact your training organizer." |
| "Browse Trainings" link | link | Top-right. Navigates to the network activity feed filtered to show available training programs. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards for each section; shimmer animation. |
| Empty — no enrollments | Member has never enrolled in a training | Full-page illustrated state: "You haven't enrolled in any trainings. Browse available CPD opportunities to start earning credits." with a "Browse Trainings" link. All sections are hidden. |
| Upcoming section empty | No future enrollments | Section shows: "No upcoming trainings enrolled. Discover trainings in your activity feed." |
| Completed section empty | No completed trainings | Section is hidden entirely. |
| Training day — QR available | An upcoming training's date is today and it is in-person | "Show QR" button appears on the enrollment card. |
| Pending approval | Member requested enrollment in an approval-required training | Card shows blue "Pending Approval" badge. No QR button. No certificate. |
| Invitation-only — invited | Member received an invitation for an invitation-only training | Card shows a "You've been invited — Accept" CTA with an accept/decline action. |
| Attendance confirmed — certificate available | Training date passed + officer confirmed attendance | Completed card shows "Certificate Available" with a green download button. Credits are reflected in the credit summary banner. |
| Attendance not confirmed | Training date passed but attendance has not been confirmed by officer | Completed card shows "Certificate not available. Attendance has not been confirmed. Contact your training organizer." No credit entry for that training. |
| Training cancelled | A training the member was enrolled in is cancelled | Card moves to All History with a "Cancelled" red badge. No credits awarded. If credits were already awarded prior to cancellation (edge case per M9-R3), credits remain and a note says "Credits previously awarded — contact organizer for corrections." |
| Error | Data fetch fails | Toast: "Could not load your training history. Please try again." Retry button. |

## Interactions

- "Show QR" on training day opens the same full-screen rotating QR overlay as Events. QR is client-side TOTP-based and works offline. Clock skew tolerance is 30 seconds (M8-R3).
- "Download Certificate" navigates to `/my/certificates/[id]` where the member can preview the certificate and download the PDF. Alternatively, if the platform supports direct download from this page, clicking triggers the download directly.
- Credit value badges on training cards are tappable and navigate to the specific credit entry in `/my/credits`.
- The credit summary banner total reflects only AUTO credits earned from trainings (does not include MANUAL entries). MANUAL credits are visible in the full credit dashboard.
- Completion status is set by the officer (via QR check-in or completion marking) — the member cannot self-report completion for platform trainings. Only external activities can be added manually via `/my/credits/log`.
- Multi-session trainings (Convention / Online Course type) show a date range (e.g., "May 5–7, 2026") and display an end-of-program completion mark rather than a per-session QR.
