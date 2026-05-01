# Campaign Detail

- **Route:** `/admin/advertising/campaigns/[id]`
- **Module:** M16 Advertising
- **Access:** Platform Admin (all roles)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete view of a single advertising campaign — its targeting, creative, review status, performance analytics, and campaign-level controls — and the ability to approve or reject the creative.

## Layout

Full-width campaign detail page. A header band shows campaign identity and high-level status. Below the header, four sections stack vertically: Targeting, Creative Review, Analytics, and Campaign Actions. A breadcrumb at the top links back to the campaigns list and advertiser detail. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | "Advertising > Campaigns > [Campaign Name]" |
| Header: campaign name | Display | Campaign name (large), advertiser name (linked to advertiser detail), association, format badge. |
| Date range | Display | Start date — End date. "N days remaining" or "Completed [date ago]" or "Starts in N days." |
| Status badge + log | Display | Current status badge (color-coded). Below: a compact timeline of status transitions with timestamps: "Pending Review (Apr 1) → Scheduled (Apr 3) → Live (May 1)." |
| Pricing summary | Display | Pricing model, rate, total budget, and spend to date. For CPM: impression cap + impressions delivered. For flat: booked date range + daily delivery pace. |
| Targeting section | Read-only display | Association(s) targeted, Specialties (list or "All specialties"), Membership categories (list or "All categories"), Geography (provinces and/or cities, or "All"), Estimated reach at booking (member count). Note: "Targeting uses structural membership attributes only. No behavioral data is used." |
| Creative section | Review panel | Preview of the ad exactly as members see it — including the mandatory "Sponsored" label rendered in the platform's style. Current creative status badge (Pending Review / Approved / Rejected / Revision Requested). Version number (e.g., "Version 2"). |
| Creative review history | Collapsible list | Each review action: reviewer admin name, date/time, outcome (Approved / Rejected / Revision Requested), rejection reason if applicable. |
| "Approve Creative" button | Primary button (visible when status = Pending Review) | Approves the current creative. On confirm: campaign status moves to Scheduled or Live depending on dates. Advertiser notified. |
| "Reject Creative" button | Destructive button (visible when status = Pending Review) | Opens a modal with a required rejection reason field. Reason is sent to the advertiser. Campaign status: "Pending Creative Revision." |
| "Request Revision" button | Secondary button (visible when status = Pending Review) | Similar to reject but tone is "please revise." Required reason field. Advertiser notified. |
| Analytics section | Charts + stats | Visible once campaign has delivered impressions. Impressions delivered (total number + daily line chart). Clicks: total and CTR (if ad has a link). Estimated unique reach (member count — no individual identities). Delivery pace: actual daily impressions vs. required pace to meet cap/end date. Note: "Analytics update within 15 minutes of delivery." |
| Campaign actions | Button group | "Pause Campaign" (stops delivery immediately; available when Live), "Resume Campaign" (restarts; available when Paused), "Cancel Campaign" (permanently terminates; requires confirmation dialog with reason field; available to Super Admins only). |
| Auto-pause notice | Conditional banner | Shown when status = Auto-Paused. Red banner: "This campaign has been automatically paused. [N] member reports were received for this creative within the past 7 days. Admin review required." Member report summary below the banner: number of reports, reason breakdown (Misleading, Inappropriate, Irrelevant), any member comments. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton per section. |
| Pending Review | Creative awaiting review | Creative section is prominent. Approve, Reject, and Request Revision buttons visible. Analytics section is hidden (no impressions yet). |
| Approved / Scheduled | Creative approved, start date in future | Status badge = Scheduled. Campaign actions show "Pause" button. Analytics section shows "No impressions yet — campaign starts [date]." |
| Live | Start date reached, creative approved | Status badge = Live (green). Analytics section shows growing impression counts. |
| Auto-Paused | 3 member reports within 7 days | Red banner with report summary. Creative section shows report details. Approve/Reject/Revision buttons re-enabled for re-review. |
| Paused (manual) | Admin or advertiser paused | Status = Paused. "Resume Campaign" button visible. |
| Completed | End date reached or impression cap hit | Status = Completed. All controls greyed out. Analytics section remains fully accessible. |
| Cancelled | Campaign cancelled | Status = Cancelled. Red muted badge. Cancellation reason displayed. No controls. |
| Error | Any section fetch fails | Inline error per section with retry. |

## Interactions

- "Approve Creative" requires no additional input; single click followed by a brief confirmation toast. Triggers an automated email to the advertiser.
- "Reject Creative" opens a required-reason modal. The reason text is sent verbatim to the advertiser in their notification.
- "Cancel Campaign" is a destructive, irreversible action. Confirmation dialog: "Cancel [Campaign Name]? This will permanently stop all delivery. This action cannot be undone." Reason field required. Super Admin only.
- Member report details in the auto-pause notice are aggregate — no individual member identities are shown to the admin in this view.
- Creative version number increments each time the advertiser uploads a revised asset; review history shows all versions.
- Analytics impression counts are read-only and cannot be manually adjusted.
