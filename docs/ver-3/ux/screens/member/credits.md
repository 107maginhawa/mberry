# My Credits

- **Route:** `/my/credits`
- **Module:** M10 Credit Tracking
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show the member their CPD credit progress for the current cycle across all organizations, and let them add manual credit entries for external activities.

## Layout

### Desktop
Single-column, max-width 720px, centered within the authenticated shell (left sidebar visible). Top section: current cycle summary card showing cycle period dates, required credits, earned credits, and a horizontal progress bar with compliance status label. Below that: two tabs — "Credit Log" and "Transcript". Credit Log tab shows a chronological list of all credit entries (AUTO and MANUAL) with filters for org, type, and date range. An "Add Credit" button appears in the top-right of the tab panel. Transcript tab shows the download control.

### Mobile
Bottom nav visible with Credits tab active. Cycle summary card is full-width at the top with a circular progress ring instead of a horizontal bar (more compact). Tabs collapse into a pill segmented control. Credit log entries are card-style rows stacked vertically. The "Add Credit" button is a floating action button at bottom-right.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Cycle summary card | card | Shows: "Current Cycle: [start date] — [end date]", required credits (from association config), earned credits (sum of all CreditEntry values in current cycle including carryover), progress bar/ring, compliance status badge (On Track=green / At Risk=amber / Non-Compliant=red). |
| Deficit/surplus indicator | text | Below the progress bar: if surplus: "You have [N] credits above the requirement." (green). If deficit: "[N] credits needed by [date]." (amber). |
| Carryover line item | list item | If the member carried over credits from the previous cycle, a "Carryover from previous cycle: [N] credits" entry appears at the top of the Credit Log as a distinct line item. |
| Credit log entry row | list | Each entry shows: activity name, date, credit value (e.g., "+5"), type badge (AUTO=blue/MANUAL=gray), source org name. AUTO entries show a link to the training record. MANUAL entries show a document icon if a supporting file was uploaded. |
| Credit log filters | filter | Filter bar above the list: dropdown for org (all orgs or specific), pill chips for type (All / AUTO / MANUAL), date range picker. |
| "Add Credit" button | button | Primary. Opens the manual credit entry form (navigates to `/my/credits/log`). |
| "Download Transcript" button | button | Secondary. In the Transcript tab. Opens a scope selector (current cycle / previous cycle / all cycles) before generating the PDF. |
| Org credit breakdown | section | Expandable section within Credit Log showing subtotals per org: "From [Org A]: [X] credits, From [Org B]: [Y] credits." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for cycle summary card and list rows; shimmer. |
| No credit-tracking orgs | Member belongs to no orgs with credit tracking enabled | Full-page message: "Credit tracking is not enabled for any of your organizations. Contact your society or national body to enable CPD tracking." No progress ring or log shown. |
| Empty log | Member has no credit entries yet | Credit log shows: "No credit entries yet. Attend a training to earn credits automatically, or add a manual entry for external activities." with an "Add Credit" link. |
| On Track | Earned credits >= prorated target for current date within the cycle | Compliance badge shows green "On Track". |
| At Risk | Earned credits are below prorated target (less than proportional progress) | Badge shows amber "At Risk". Subtitle: "You need [N] more credits to stay on pace for [cycle end date]." |
| Non-Compliant | Cycle has ended with insufficient credits | Badge shows red "Non-Compliant". No automatic penalty applied; officer can view in admin overview. |
| Surplus | Total credits exceed requirement | Badge shows green "Complete — [N] credit surplus". Surplus value is displayed as the carryover amount for next cycle. |
| Error | Data fetch fails | Toast: "Could not load your credit data. Please try again." Retry button. |

## Interactions

- Tapping a credit log entry expands it inline to show full detail: provider/organizer (for MANUAL), attendance confirmation date (for AUTO), training detail link (for AUTO), and a download icon for any uploaded supporting document (for MANUAL).
- MANUAL entries show an "Edit" link when tapped (edit is allowed until the cycle closes). AUTO entries are read-only.
- The org breakdown section is collapsed by default and expands on tap.
- "Download Transcript" opens a bottom sheet (mobile) or dropdown (desktop) with scope options: "Current Cycle", "Previous Cycle", "All Cycles". Selecting a scope triggers async PDF generation; member is notified when ready if generation takes more than a few seconds.
- Cycle dates are per-member, based on their registration date, not a calendar year — the UI must display the member's specific start/end dates (M10, BR-11).
- Credit log respects the org credit-tracking toggle (M10-R1): if an org has credit tracking disabled, its entries are excluded from the log and the summary total.
