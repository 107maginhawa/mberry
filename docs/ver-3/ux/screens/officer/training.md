# Training Dashboard (Officer)

- **Route:** `/org/[id]/officer/training`
- **Module:** M09 Training
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the Secretary a complete view of all org training programs — upcoming, past, drafts, and pending network approval — with filters, stats, and quick actions per program.

## Layout

### Desktop
Sidebar navigation visible. Main content opens with a stats summary row (total trainings this quarter, total credits issued, total enrollments, average completion rate), then a filter toolbar, then the training list in card view. "New Training" primary button anchors the top-right header.

### Mobile
Stats summary collapses into a scrollable strip. Filter bar shows status tabs and a filter icon for the rest. Training cards are full-width. "New Training" is a sticky bottom button.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Stats summary row | Stat cards (4-up) | Total trainings this quarter, total credits issued (sum of credit_value x completions), total enrollments, average completion rate (%). |
| Status tabs | Tab strip | Upcoming / Past / Drafts / Pending Approval. Default: Upcoming. Pending Approval tab shows a count badge when trainings await network review. |
| Type filter | Dropdown | All / plus the 5 platform-defined training types (Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training). |
| Date range filter | Date range picker | Narrows results to trainings with start dates in the selected range. |
| Search | Text input | Searches by training title. 300ms debounce. |
| Training card | Card | Cover image thumbnail (or type-icon placeholder), title, type badge, date(s), credit value badge (prominent, e.g., "5 CPD"), approval status badge (PRC Approved=green / Pending Approval=yellow / N/A=gray), enrollment count ("35/50"), visibility badge (Network=blue / Internal=gray), status badge (Published / Draft / Cancelled / Pending Approval). Quick actions: Edit, Cancel (with confirmation), View Attendance, Duplicate. |
| New Training button | Primary button | Links to `/org/[id]/officer/training/new`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on stat cards and training cards |
| Empty | No training programs | Illustration + "No training programs yet. Create your first training to help members earn CPD credits and advance their professional development." + "New Training" button |
| Filtered - no results | Filter or search yields nothing | "No training programs match your filters." with "Clear filters" link |
| Pending approval | Trainings awaiting network review | Yellow "Pending Approval" badge on cards; "Awaiting network approval" subtitle; Pending Approval tab has count badge |
| Populated | Trainings exist | Paginated cards, 20 per page |
| Error | API failure | "Failed to load training programs. Retry." with retry button |
| Cancel confirmation | Cancel quick action clicked | Confirmation dialog: "Cancel this training? All N enrolled members will be notified. Credits already awarded will not be revoked." Cancel / Confirm. |
| After cancel | Training cancelled | Card status changes to Cancelled; toast: "Training cancelled. Members have been notified." |

## Interactions

- Clicking "New Training" navigates to `/org/[id]/officer/training/new`. No confirmation required.
- Status tabs (Upcoming / Past / Drafts / Pending Approval) filter immediately on tap — no page reload. The Pending Approval tab shows a count badge when trainings await network review; tapping it filters to only those trainings.
- Type filter dropdown and date range picker apply on selection without a separate "Apply" button. Search triggers after 300ms debounce. All active filters compound — e.g., type = Seminar AND date range narrows the list simultaneously.
- Clicking a training card (anywhere outside the quick actions) navigates to `/org/[id]/officer/training/[id]`.
- "Edit" quick action navigates to the training edit form pre-populated with current data. If the training's credit value is locked (attendance already confirmed for any member), the credit value field appears with a lock icon in the edit form.
- "Cancel" quick action opens a confirmation dialog that includes the enrolled member count and a note about already-awarded credits: "Cancel this training? All N enrolled members will be notified. Credits already awarded will not be revoked." Confirm updates the card inline to Cancelled status with a toast. The dialog's Cancel button returns to the list without action.
- "View Attendance" quick action navigates to `/org/[id]/officer/training/[id]/attendance`. Available for published trainings on or after their start date.
- "Duplicate" creates a draft copy pre-filled with all training fields except credit-value lock status. Redirects to the create-training form. No confirmation dialog.
- Pagination: "Load more" or page controls appear when more than 20 trainings exist in the active filter state. "Clear filters" resets all filters and search to defaults in one tap.
