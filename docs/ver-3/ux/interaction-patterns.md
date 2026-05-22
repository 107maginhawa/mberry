# Interaction Patterns — Memberry Platform

**Version:** 3.0
**Last Updated:** 2026-04-21
**Layer:** UX / Interaction Patterns

---

## 1. Org-Switcher Pattern

### When It Appears

- Any screen showing org-specific data when the member belongs to **2+ organizations**
- Members with only 1 org see the org name displayed but it is not interactive

### Trigger

- Compact org pill in the page header
- Shows: current org name (abbreviated if long) + status badge dot (green = active, amber = grace, red = lapsed)
- Pill has a subtle chevron-down icon indicating interactivity

### Interaction

1. Tap/click the pill
2. Dropdown sheet appears (bottom sheet on mobile, dropdown on desktop)
3. Sheet lists all orgs the member belongs to:
   - Org name
   - Org type label (Chapter, Society)
   - Status badge (Active, Grace, Lapsed, Pending)
   - Last activity date
4. "View All Memberships" link at bottom of list (navigates to full membership management)

### Selecting an Org

- Tap an org in the list
- Sheet closes
- Current page refreshes its data in the context of the selected org
- Dashboard stats, dues info, credit counts, activity feeds all update to reflect the selected org
- URL does not change (org context is session state, not URL state)

### Persistence

- Selection persists across navigation within the session
- Stored in session/local storage
- On next login, defaults to the most recently active org

### Default Selection

- Most recently active org (by last login or last interaction timestamp)
- If arriving via an invite link or org-specific URL, that org is pre-selected
- If no activity history, alphabetical first org

---

## 2. Form Patterns

### Validation Timing

- **Inline validation on blur** (when the user leaves a field), not on submit
- Fields validate as soon as focus moves away
- Submit button triggers full-form validation as a safety net

### Error Messages

- Appear directly below the field, in `--error` (#B85454) color
- Font size: 13px
- Include specific fix instructions, not generic messages:
  - "Must be at least 8 characters" (not "Invalid input")
  - "Enter a valid email address (e.g., name@example.com)" (not "Invalid email")
  - "License number must match format XX-XXXX-XXXXX" (not "Invalid license")
- Error state: field border changes to `--error`, background tints to `--error-bg`

### Required Field Marking

- Use **inverse labeling**: mark fields with an asterisk (`*`) only if **most fields on the form are optional**
- If most fields are required, mark optional fields with "(optional)" instead
- Never leave the user guessing which fields are mandatory

### Button Placement

- **Save / Submit**: primary button, right-aligned
- **Cancel**: ghost/text button, positioned to the left of save
- **Delete / Destructive**: danger button, separated from save/cancel (left side or in a separate section)
- Button row has top margin of 24px from last form field

### Unsaved Changes

- If the user has modified any field and attempts to navigate away (back button, sidebar link, browser back), show a confirmation dialog:
  - "You have unsaved changes. Discard changes?"
  - Buttons: "Keep Editing" (primary), "Discard" (ghost)
- Implemented via `beforeunload` event and router navigation guards

---

## 3. Empty States

### Principle

Every list, table, and dashboard widget has a designed empty state. Empty states are not errors; they are onboarding moments.

### Pattern

```
+------------------------------------------+
|                                          |
|            [Relevant Icon]               |
|                                          |
|        Warm, human headline              |
|     Supporting text with context         |
|     and a clear next step.               |
|                                          |
|          [ Primary CTA Button ]          |
|                                          |
+------------------------------------------+
```

- Icon: 48px, `--muted` color, relevant to the content type
- Headline: 18px, `--text`, font-weight 600
- Supporting text: 14px, `--text-secondary`, max-width 400px, centered
- CTA: primary button style

### Examples

| Context | Headline | Supporting Text | CTA |
|---------|----------|-----------------|-----|
| Member roster (no members) | Your roster is empty | Start by importing members from a CSV file or adding them one by one. | Import Members |
| Events list (no events) | No events scheduled | Create your first event to start engaging your chapter members. | Create Event |
| Payment records (no payments) | No payments recorded | Set up your dues configuration to start collecting membership payments. | Configure Dues |
| Credit dashboard (no credits) | No credits earned yet | Attend a training or log credits manually to start tracking your progress. | Browse Trainings |
| Announcements (none sent) | No announcements yet | Keep your members informed by composing your first announcement. | Compose Announcement |
| Applications (none pending) | No pending applications | Share your org's public page to invite new members to apply. | Copy Public Link |
| Notifications (none) | You're all caught up | No new notifications. Check back later. | (no CTA) |

---

## 4. Loading States

### Lists and Tables

- **Skeleton shimmer rows**: 3-5 rows of animated placeholder blocks
- Rows match the expected content height and column layout
- Shimmer animation: left-to-right gradient sweep, 1.5s duration, infinite loop
- Background: `--border-light` with lighter shimmer highlight

### Stats and Numbers

- **Skeleton shimmer rectangles**: match the size of the stat card content
- Number placeholder: rounded rectangle, 60px wide, 28px tall
- Label placeholder: rounded rectangle, 80px wide, 14px tall

### Page Load

- **Top progress bar**: thin line (3px height) at the very top of the viewport
- Color: `--primary`
- Animated: indeterminate progress (grows from left, accelerates, then completes on data load)
- Appears on route transitions

### Action Buttons

- When an action is processing, the button enters a loading state:
  - Spinner icon replaces the button text/icon
  - Button becomes disabled (no double-clicks)
  - Button width does not change (prevents layout shift)
  - Text changes to present participle: "Saving...", "Sending...", "Processing..."

### Payment Processing

- Full-page overlay with semi-transparent backdrop
- Centered card showing progress steps:
  1. Connecting to payment provider...
  2. Processing payment...
  3. Confirming transaction...
- Each step shows a checkmark when complete, spinner on current step
- Estimated time: "This usually takes a few seconds"
- Do not allow the user to navigate away during payment processing

---

## 5. Confirmation Patterns

### Destructive Actions

Actions: delete record, remove member from org, suspend member, void payment.

- **Confirmation modal** with:
  - Headline: plain-language description of what will happen
  - Body: specific consequences ("Dr. Santos will lose access to Metro Manila Chapter. Payment history will be preserved.")
  - Buttons: "Cancel" (ghost, left) + "[Action Verb]" (danger button, right)
  - Example: "Cancel" + "Remove Member"

### High-Consequence Actions

Actions: send announcement to all members, issue refund, batch dues reminder.

- **Confirmation modal** with impact count:
  - "This will send a notification to **247 members** of Metro Manila Chapter."
  - "This will issue a refund of **PHP 2,500.00** to Dr. Santos via GCash."
  - Buttons: "Cancel" + "Send to 247 Members" (primary button with count)

### Irreversible Actions

Actions: delete organization, permanently delete account, purge audit logs.

- **Type-to-confirm modal**:
  - Headline: "This action cannot be undone"
  - Body: explicit description of what will be permanently lost
  - Input field: "Type **Metro Manila Chapter** to confirm"
  - Confirm button disabled until the typed text matches exactly
  - Buttons: "Cancel" + "Permanently Delete" (danger, disabled until confirmed)

---

## 6. Bulk Actions

### Selection

- Table rows have a checkbox column
- Checkbox appears on hover over any row (always visible on mobile)
- Header row has a "select all on this page" checkbox
- Selecting any row reveals the bulk action bar

### Bulk Action Bar

- Appears above the table, pushes table content down (not an overlay)
- Background: `--primary-subtle`, border: `--primary-lighter`
- Content: "[N] selected" label + action buttons + "Cancel" (deselect all)

```
+----------------------------------------------------------+
| 12 selected   [Send Reminder] [Export] [Change Category] |
|                                            [Cancel]      |
+----------------------------------------------------------+
```

### Available Bulk Actions by Context

| Table | Bulk Actions |
|-------|-------------|
| Member roster | Send Reminder, Export CSV, Change Category, Remove from Org |
| Payment records | Export CSV, Mark as Reconciled |
| Event registrations | Check In, Export CSV, Send Message |
| Training enrollments | Mark Completed, Send Reminder, Export CSV |
| Applications | Approve, Reject |
| Notifications (admin) | Mark as Read, Delete |

### Constraints

- Maximum selection: current page only (no cross-page selection)
- If a bulk action fails for some items, show a result summary: "8 of 12 reminders sent. 4 failed (no email on file)."

---

## 7. Status Badge Pattern

Membership status is always displayed as a pill badge with color and text.

| Status | Background | Text Color | Usage |
|--------|------------|------------|-------|
| **Active** | `--success-bg` (#EDF5F0) | `--success` (#5A8A6B) | Dues current, full access |
| **Grace** | `--warning-bg` (#FDF8E8) | `--warning` (#C4960A) | Dues expired, within grace period |
| **Lapsed** | `--error-bg` (#FDF0F0) | `--error` (#B85454) | Grace period expired, reduced access |
| **Pending** | `--info-bg` (#EDF2F8) | `--info` (#5B7EB5) | Application submitted, awaiting approval |
| **Suspended** | `#E8E5EA` | `#554B60` | Disciplinary suspension, restricted access |

### Badge Styling

- Padding: 4px 12px
- Border-radius: 100px (full pill)
- Font size: 12px
- Font weight: 600
- No border, background color carries the meaning
- Always include text label (not color-only, for accessibility)

### Where Badges Appear

- Member roster table (status column)
- Member detail page (next to name)
- Member card in org-switcher dropdown
- Dashboard stat cards (member count by status)
- Officer's member search results

---

## 8. Notification Patterns

### In-App Notifications

- Notification bell icon in the header (all views)
- Count badge: `--error` background, white text, shows unread count (max "99+")
- Tap opens notification panel (side panel on desktop, full-screen sheet on mobile)

### Notification List

- Grouped by date: **Today**, **Yesterday**, **This Week**, **Earlier**
- Each notification shows:
  - Icon (type-specific: payment, event, announcement, credit, system)
  - Title (bold, 14px)
  - Preview text (13px, `--text-secondary`, max 2 lines)
  - Timestamp ("2h ago", "Apr 18")
  - Unread indicator: blue dot on the left edge
- Tap a notification to navigate to the relevant page
- "Mark all as read" action at the top of the list

### Toast Notifications

- Appear in the **top-right** corner of the viewport
- Auto-dismiss after **5 seconds** (user can dismiss earlier by clicking X)
- Maximum **3 toasts visible** at once (older toasts pushed up and dismissed)
- Stack vertically with 8px gap

| Type | Left Border Color | Icon |
|------|------------------|------|
| **Success** | `--success` (#5A8A6B) | Checkmark circle |
| **Error** | `--error` (#B85454) | X circle |
| **Info** | `--info` (#5B7EB5) | Info circle |
| **Warning** | `--warning` (#C4960A) | Alert triangle |

### Toast Styling

- Background: `--surface`
- Border: 1px `--border-light`
- Left border: 4px, colored by type
- Width: 360px (desktop), full-width minus padding (mobile)
- Border-radius: `--radius-md` (12px)
- Shadow: subtle drop shadow for elevation

---

## 9. Search Patterns

### Global Search (Command Palette)

- Trigger: click search icon in header, or keyboard shortcut **Cmd+K** (Mac) / **Ctrl+K** (Windows)
- Opens a centered overlay modal with a large search input at the top
- Results grouped by type: Members, Events, Trainings, Payments, Settings
- Each result shows: icon + title + subtitle + type badge
- Keyboard navigation: arrow keys to move, Enter to select, Esc to close
- Recent searches shown when input is empty
- Available in officer and admin views only

### Table/List Search

- Inline filter bar positioned above the table
- Search input with magnifying glass icon (left)
- Placeholder: "Search by name, email, or license number..."
- Filter dropdowns alongside search: Status, Category, Date Range (context-dependent)
- Clear all filters button appears when any filter is active

### Search Behavior

- **Debounced**: 300ms delay after last keystroke before querying
- Minimum 2 characters before search executes
- Results update in-place (no page reload)
- "No results found" state with suggestion to adjust filters
- Search term highlighted in results

---

## 10. Pagination

### Table Pagination

- Server-side pagination for all data tables
- Default page size: **20 rows**
- Page size selector: **20 / 50 / 100** (dropdown)

### Pagination Controls

```
Showing 21-40 of 847 results    [First] [<] [1] [2] [3] ... [43] [>] [Last]
```

- "Showing X-Y of Z results" label (left-aligned)
- Page navigation buttons (right-aligned):
  - First (double chevron left)
  - Previous (single chevron left)
  - Page numbers: show current page, 1 page before, 1 page after, ellipsis for gaps, first and last page always visible
  - Next (single chevron right)
  - Last (double chevron right)
- Disabled state for First/Previous when on page 1, Next/Last when on last page
- Current page: `--primary` background, white text (pill style)

### Mobile Pagination

- Simplified: "Load More" button at the bottom of the list (infinite scroll alternative)
- Shows "Showing X of Z" above the button
- No page number navigation on mobile (too small for touch targets)

---

## 11. Date & Number Formatting

### Dates

- **Locale-aware** formatting. Philippines default: `"April 21, 2026"`
- No time shown unless the context requires it (event start times show time)
- Time format: 12-hour with AM/PM for PH locale (`"2:00 PM"`)
- Date + time: `"April 21, 2026 at 2:00 PM"`

### Relative Dates

- Used for recent and upcoming items within a ~2 week window:
  - "Just now" (< 1 minute)
  - "3 minutes ago" (< 1 hour)
  - "2 hours ago" (< 24 hours)
  - "Yesterday" (1 day ago)
  - "3 days ago" (2-14 days ago)
  - "in 2 hours" (future, < 24 hours)
  - "in 3 days" (future, 2-14 days)
  - "Tomorrow" (1 day from now)
- Beyond 2 weeks: use absolute date format

### Currency / Amounts

- Always include currency symbol
- Philippines: `"PHP 1,234.56"` -- currency code prefix, comma thousand separator, period decimal separator
- Right-aligned in table columns
- Font: tabular-nums variant for alignment (`font-variant-numeric: tabular-nums`)
- Negative amounts (refunds): `"- PHP 1,234.56"` in `--error` color

### Percentages

- One decimal place for fund allocations and precise metrics: `"12.5%"`
- Zero decimal places for dashboard stats and progress: `"78%"`
- Always include the `%` symbol, no space before it

---

## 12. Mobile-Specific Patterns

### Pull-to-Refresh

- Available on all list/feed screens (activity feed, notifications, roster, payment records)
- Pull down from the top of the scrollable area
- Visual indicator: spinner appears at top, pulls down with the gesture
- Releases and fetches fresh data
- Not available on form pages or detail pages

### Swipe Actions on List Items

- **Left swipe** reveals destructive/secondary actions (red zone): Delete, Archive, Remove
- **Right swipe** reveals primary quick action (green/primary zone): context-specific
  - Payment list: Mark as Reconciled
  - Member list: Send Reminder
  - Notification list: Mark as Read
- Swipe distance threshold: 80px to reveal, 160px to auto-trigger
- Items snap back if swipe is not completed

### Bottom Sheets

- Used instead of center modals on mobile for:
  - Date pickers
  - Select dropdowns with many options
  - Action menus (share, edit, delete)
  - Org-switcher
  - Filter panels
- Sheet rises from bottom with a drag handle at top
- Can be dismissed by swiping down or tapping the backdrop
- Maximum height: 85% of viewport (scrollable if content exceeds)

### Haptic Feedback

- Triggered on destructive action confirmation (delete, remove, suspend)
- Light haptic on successful actions (payment confirmed, check-in recorded)
- Uses the Web Vibration API where supported (`navigator.vibrate`)
- Degrades gracefully on unsupported platforms (no feedback, no error)

### Touch Targets

- Minimum touch target: 44x44px (Apple HIG / WCAG)
- Table rows: minimum height 48px
- Buttons: minimum height 44px
- Icon-only buttons: 44x44px hit area even if icon is smaller
- Spacing between adjacent touch targets: minimum 8px
