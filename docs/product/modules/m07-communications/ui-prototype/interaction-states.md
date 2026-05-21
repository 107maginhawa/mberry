<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Interaction States: Communications (M07)

> Module-wide interaction state patterns. Each screen implements all 9 states.

---

## State 1: Loading

**Trigger:** Initial fetch, announcement list, template list, preferences.

| Aspect | Implementation |
|--------|---------------|
| Visual | Skeleton UI matching layout. Metrics: skeleton cards. Table: row skeletons. Editor: placeholder shimmer. |
| Duration | 200-500ms typical. 100ms delay before skeleton appears. |
| ARIA | `aria-busy="true"`. `aria-live="polite"` announces "Loading communications..." |
| Interaction | Controls disabled. Navigation functional. |
| Fallback | > 3s: "Loading..." text beside skeleton. |

**Per-screen variants:**
- Dashboard: 3 metric skeleton cards + 5-row announcement skeleton table
- Compose: skeleton editor toolbar + body area + audience controls
- Preferences: 5-row skeleton topic list with toggle placeholders

---

## State 2: Empty

**Trigger:** Zero records for current view.

| Aspect | Implementation |
|--------|---------------|
| Visual | Centered illustration + heading + CTA. |
| ARIA | `role="status"` |
| Interaction | CTA functional. |

**Per-screen messages:**
- Dashboard: "No announcements yet. Send your first one." CTA: Compose Announcement
- Templates: "No templates created yet. Create a template to speed up future announcements." CTA: Create Template
- Preferences: "No notification topics configured for your organizations."

---

## State 3: Success

**Trigger:** Data loaded or mutation completed.

| Aspect | Implementation |
|--------|---------------|
| Visual | Populated UI. Status badges colored per state. |
| ARIA | `aria-busy="false"`. |
| Interaction | All controls enabled. |

**Mutation feedback (via sonner):**
- Announcement published: "Announcement sent to N members." (green, 5s)
- Announcement scheduled: "Announcement scheduled for [date]." (blue, 5s)
- Draft saved: "Draft saved." (gray, 3s, auto-dismiss)
- Template created: "Template created." (green, 3s)
- Preferences updated: "Preferences updated." (green, 2s)

---

## State 4: Validation Error

**Trigger:** Invalid form input.

| Aspect | Implementation |
|--------|---------------|
| Visual | Red border + error text below field. |
| ARIA | `aria-invalid="true"`. `aria-describedby` to error. |
| Interaction | Submit enabled. Focus on first error. |

**Per-screen errors:**
- Compose: "Title is required." "Message body is required." "No recipients match your selection." (M07-003). "Scheduled time must be in the future." (M07-004). "Recipient list exceeds maximum (10,000)." (M07-006).
- Templates: "Template name already exists for this organization." (M07-001). "Invalid Handlebars syntax." (VALIDATION-001).
- Preferences: "In-app notifications cannot be disabled for announcements." (M7-R1). Toggle auto-reverts.

---

## State 5: Permission Error

**Trigger:** Insufficient role.

| Aspect | Implementation |
|--------|---------------|
| Visual | 403 page or disabled controls with tooltip. |
| ARIA | Page: `role="alert"`. Action: `aria-disabled="true"`. |
| Interaction | Back button or link to permitted area. |

**Per-screen messages:**
- Dashboard (non-officer): redirect to `/my/notifications` or member area
- Compose (non-secretary/president): "Only the President or Secretary can compose announcements."
- Subscription Topics (non-admin): "Managing subscription topics requires President or Admin role."
- Preferences: N/A (available to all authenticated users)

---

## State 6: Unexpected Error

**Trigger:** API failure, network error.

| Aspect | Implementation |
|--------|---------------|
| Visual | Error boundary with retry. Page chrome preserved. |
| ARIA | `role="alert"`. |
| Interaction | Retry button. |

**Per-screen messages:**
- Dashboard: "Couldn't load announcements. Please try again."
- Compose: "Couldn't save announcement. Your draft is preserved locally." (local storage backup)
- Preferences: "Couldn't update preferences. Please try again."
- Email service errors: "Some emails may be delayed." (non-blocking, in-app still delivered)

---

## State 7: Conflict/Duplicate

**Trigger:** Business rule conflict on mutation.

| Aspect | Implementation |
|--------|---------------|
| Visual | Inline alert or dialog. |
| ARIA | `role="alert"`. |
| Interaction | Action blocked or requires alternative. |

**Scenarios:**
- Edit published announcement: "Cannot edit published announcement. Create a new one instead." (M07-005)
- Duplicate template name: "Template name already exists for this organization." (M07-001)
- Officer role removed between compose and publish: 403 at publish time

---

## State 8: Confirmation/Warning

**Trigger:** Irreversible or significant actions.

| Aspect | Implementation |
|--------|---------------|
| Visual | Alert dialog. |
| ARIA | `role="alertdialog"`. Focus trapped. |
| Interaction | Cancel/Confirm. Escape = cancel. |

**Confirmations:**
- Publish: "Send this announcement to N members via [channels]? This cannot be undone." [Cancel] [Publish]
- Schedule: "Schedule this announcement for [date]? It will be sent automatically." [Cancel] [Schedule]
- Delete draft: "Delete this draft? This cannot be undone." [Cancel] [Delete] (red)
- Leave compose with unsaved changes: "You have unsaved changes. Leave anyway?" [Stay] [Leave]
- Archive: "Archive this announcement? It will be hidden from the list." [Cancel] [Archive]

---

## State 9: Offline/Sync

**Trigger:** Network lost.

| Aspect | Implementation |
|--------|---------------|
| Visual | Amber banner. |
| ARIA | `role="status"`. |
| Interaction | Read from cache. Writes disabled. |

**Per-screen behavior:**
- Dashboard: Cached announcement list shown. "You're offline." Compose disabled.
- Compose: "Composing requires an internet connection." Save disabled. Local draft preserved in browser storage.
- Preferences: Cached preferences shown. Changes queued. "Preferences will sync when back online."

**Recovery:** Banner clears on reconnect. Cached queries invalidated. Queued changes (preferences) auto-submitted.

**Email queue note:** Backend email queue (pg-boss) operates independently. Offline frontend does not affect backend delivery pipeline.
