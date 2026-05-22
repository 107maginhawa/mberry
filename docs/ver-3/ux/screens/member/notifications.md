# My Notifications

- **Route:** `/my/notifications`
- **Module:** M07 Communications
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member read all in-app notifications across all organizations in one place, with filtering by category and org, and actions to mark items as read.

## Layout

### Desktop
Single-column, max-width 680px, centered within the authenticated shell (left sidebar visible). A filter bar at the top with category chips and an org selector dropdown. "Mark all as read" button at top-right. Notification items are listed below in reverse-chronological order, grouped by date (Today, Yesterday, This Week, Earlier). Unread items have a distinct visual treatment (bolder text and a left border accent).

### Mobile
Full-width. Filter bar collapses to a horizontal scrollable chip row (category chips) plus an "All Orgs" dropdown. "Mark all as read" is accessible via a menu icon (three dots) at top-right. Notification rows are full-width with generous touch targets. Bottom nav shows a badge count on the bell icon (or whichever nav item represents notifications); the badge clears as items are read. Bottom nav is visible with Notifications tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Unread badge | badge | In the nav/header bell icon: shows unread count. Clears as notifications are marked read. Badge count is accurate across all devices within 5 seconds of a new notification (M7-R7). |
| Filter — category chips | filter | Chips for: All, Announcements, Payments, Dues Reminders, Events, Training, Credits, System. Selecting a chip filters the list to that category only. |
| Filter — org selector | select | Dropdown: "All Organizations" or a specific org. For single-org members, this filter is hidden. |
| Notification row — unread | list item | Bold title, full preview text, type icon (announcement=megaphone / payment=receipt / dues=calendar / event=calendar-check / training=graduation-cap / credit=star / system=bell), source org name in muted text, relative timestamp (e.g., "2 hours ago"). Left border accent (colored by type). |
| Notification row — read | list item | Same layout but muted text weight, no left border accent. |
| Date group header | section header | "Today", "Yesterday", "This Week", "Earlier" separating the list. |
| "Mark all as read" button | button | Secondary. Marks all currently visible notifications as read. If filters are active, only marks the filtered set as read. |
| Per-row "Mark as unread" toggle | action | Available on read notifications via a long-press (mobile) or hover menu (desktop). Allows a member to flag a notification for later. |
| Notification detail expansion | inline | Tapping a notification row expands it to show the full content (for announcements) or navigates to the relevant screen (payment navigates to `/my/payments`, event navigates to event detail, credit navigates to `/my/credits`, training navigates to training detail). Marks item as read on tap. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton rows with shimmer; each row placeholder matches the height of a real notification. |
| All read / empty — no filter | Member has read all notifications and no new ones | Centered illustrated state: "You're all caught up! No new notifications." |
| Empty — filtered | Active category or org filter matches no notifications | Inline message: "No notifications in this category." Filter chips remain accessible to switch. |
| Deep link target unavailable | Tapping a notification whose target has been deleted (e.g., event was cancelled and removed) | Toast: "This content is no longer available." Notification is marked as read. |
| New notification arrives | System pushes a new notification while member is on the screen | New item appears at top of "Today" group without full-page reload (real-time or near-real-time update). Unread badge increments. |
| Error | Notifications fail to load | "Unable to load notifications. Pull to refresh." (mobile) / "Retry" button (desktop). |

## Interactions

- Tapping an announcement-type notification expands the full rich-text announcement inline within the notification row rather than navigating away — the member reads the announcement in-context, then collapses it.
- Tapping a payment, dues reminder, event, training, or credit notification navigates to the specific related screen (deep link). After navigation, the notification is marked as read.
- Notification deduplication is enforced at the system level (M7-R1 / BR-28): a member who belongs to multiple orgs that share the same network-wide activity receives only ONE notification for that activity, not one per org.
- "Mark all as read" has no undo — a confirmation toast ("All notifications marked as read") appears but no undo option is provided.
- In-app notifications are always present and cannot be disabled (M7-R7 / M2-R8); the toggle for in-app is absent from notification preferences.
- Notification center loads within 1 second (M7, M-15 success criteria); unread badge updates across devices within 5 seconds of a new notification.
