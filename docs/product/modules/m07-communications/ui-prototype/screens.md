<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Screens: Communications (M07)

> Tech: React 19, TanStack Router, TanStack Query, Radix UI (shadcn), Tailwind CSS, sonner toasts
> Apps: memberry (3004) for officer screens, account (3002) for member notification preferences

---

## Screen 1: Communications Dashboard

**Route:** `/org/[organizationId]/officer/communications`
**Purpose:** Announcement list, compose shortcut, delivery stats overview
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Communications" |
| Metrics | `region` | "Delivery metrics" |
| Announcement list | `table` | "Announcements" |
| Quick actions | `toolbar` | "Communication actions" |

### Focus Management

- Page load: focus on Compose button (primary CTA)
- After publishing: focus on sonner toast, then updated list
- Filter change: focus on first result row

### Fields

| Field | Type | Source | Display | Sortable | Filterable |
|-------|------|--------|---------|----------|------------|
| title | text | GET /org/:id/announcements | Linked title | No | Via search |
| status | enum | GET /org/:id/announcements | Status badge | No | Yes |
| visibility | enum | GET /org/:id/announcements | Badge (internal/network) | No | Yes |
| channels | array | GET /org/:id/announcements | Channel icons | No | No |
| authorName | text | GET /org/:id/announcements | Author name | No | No |
| sentAt / scheduledAt | date-time | GET /org/:id/announcements | Formatted date | Yes (default desc) | No |
| deliveryStats.sentCount | integer | GET /org/:id/announcements/:id/stats | Inline stat | No | No |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Compose new | Button click | Navigate to /org/:id/officer/communications/new | Secretary, President | Page transition |
| View announcement | Row click | Navigate to detail view | All officers | Page transition |
| View stats | Stats icon click | GET /org/:id/announcements/:id/stats | All officers | Stats popover or navigate |
| Filter by status | Dropdown | GET /org/:id/announcements?status= | All officers | List updates |
| Access templates | Button click | Navigate to /org/:id/officer/communications/templates | All officers | Page transition |

### Role-Variant Matrix

| Element | President | Secretary | VP | Officer | Staff | Member |
|---------|-----------|-----------|----|---------|----|--------|
| View list | Yes | Yes | Yes | Yes | Yes | Redirect to notifications |
| Compose button | Yes | Yes | -- | -- | -- | -- |
| View stats | Yes | Yes | Yes | Yes | -- | -- |
| Template access | Yes | Yes | Yes | Yes | -- | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Metrics row + full table | All columns, stats inline |
| 768-1023px (md) | Metrics above table, table scrolls | Channels column hidden |
| < 768px (sm) | Metric cards stacked, card list | Title + status + date per card |

### Interaction States

1. **Loading:** Skeleton metrics (3 cards) + skeleton table (5 rows). `aria-busy="true"`.
2. **Empty:** "No announcements yet. Send your first one." Illustration + Compose CTA.
3. **Success:** Populated list with status badges. Draft (gray), Scheduled (blue), Sent (green), Archived (muted).
4. **Validation Error:** N/A for list view.
5. **Permission Error:** Non-officer: redirect to member notifications. Staff: read-only (no compose).
6. **Unexpected Error:** "Couldn't load announcements." + Retry.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** N/A for list.
9. **Offline/Sync:** Cached list shown. "You're offline." Compose disabled.

---

## Screen 2: Compose Announcement

**Route:** `/org/[organizationId]/officer/communications/new`
**Purpose:** Create, preview, and send/schedule announcements
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Compose Announcement" |
| Editor | `form` | "Announcement editor" |
| Audience | `region` | "Audience selection" |
| Channels | `region` | "Delivery channels" |
| Preview | `region` | "Message preview" |
| Actions | `toolbar` | "Publish actions" |

### Focus Management

- Page load: focus on title input
- Template selected: focus on editor body (pre-populated)
- Preview mode: focus on preview panel heading
- After publish/schedule: redirect to dashboard with sonner toast

### Fields

| Field | Type | Source | Display | Validation |
|-------|------|--------|---------|------------|
| title | text | User input | Text input | Required, max 300 chars |
| body | rich text | User input | Tiptap/Quill editor with Handlebars toolbar | Required, max 50,000 chars |
| visibility | enum | User input | Toggle: internal / network | Default: internal (BR-16) |
| channels | array | User input | Checkbox group | in-app always checked + disabled (M7-R1) |
| audienceFilter.status | enum | User input | Multi-select | active / gracePeriod / lapsed |
| audienceFilter.tierId | uuid | User input | Dropdown (from M05 tiers) | Valid tier |
| priority | enum | User input | Toggle: normal / high | Default: normal |
| scheduledAt | date-time | User input | Date-time picker | Must be future if scheduling |
| templateId | uuid | User input | Template dropdown | Optional |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Save draft | Button click | POST /org/:id/announcements | Secretary, President | sonner: "Draft saved." |
| Preview | Toggle button | Local render | Secretary, President | Preview panel shows rendered message |
| Insert variable | Toolbar button | Local insert | Secretary, President | Variable placeholder inserted |
| Select template | Dropdown | GET /org/:id/templates/:id | Secretary, President | Body pre-populated |
| Publish now | Button click | POST /org/:id/announcements/:id/publish | Secretary, President | sonner: "Announcement sent to N members." |
| Schedule | Button click | POST /org/:id/announcements/:id/schedule | Secretary, President | sonner: "Announcement scheduled for [date]." |
| Cancel | Button click | Navigate back (with unsaved changes warning) | Secretary, President | Back to dashboard |

### Role-Variant Matrix

| Element | President | Secretary | All Others |
|---------|-----------|-----------|------------|
| Full editor | Yes | Yes | 403 redirect |
| Publish/Schedule | Yes | Yes | -- |
| High priority toggle | Yes | Yes | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Editor left (60%), preview right (40%) | Side-by-side |
| 768-1023px (md) | Full-width editor, preview toggle | Preview in sheet overlay |
| < 768px (sm) | Full-width, stacked sections | Audience/channels collapse to accordion |

### Interaction States

1. **Loading:** Skeleton editor + audience controls.
2. **Empty (Draft):** Clean editor with placeholder text. Template selector prominent.
3. **Success (Sent):** Redirect to dashboard. sonner: "Announcement sent to N members."
4. **Validation Error:** Title empty: "Title is required." Body empty: "Message body is required." No audience: "No recipients match your selection." (M07-003). Schedule in past: "Scheduled time must be in the future." (M07-004).
5. **Permission Error:** "Only the President or Secretary can compose announcements."
6. **Unexpected Error:** "Couldn't save announcement. Your draft is preserved locally."
7. **Conflict/Duplicate:** Published announcement edit attempt: "Cannot edit published announcement." (M07-005)
8. **Confirmation/Warning:** Publish: "Send this announcement to N members via [channels]?" [Cancel] [Publish]. Leave with unsaved: "You have unsaved changes. Leave anyway?" [Stay] [Leave].
9. **Offline/Sync:** "Composing requires an internet connection." Save draft disabled. Local draft preserved.

### Validation Rules

- Title: required, 1-300 chars
- Body: required, 1-50,000 chars, valid Handlebars
- Channels: in-app always included (M7-R1), cannot uncheck
- Audience: must resolve to >= 1 recipient (M07-003)
- Schedule: must be in future (M07-004)
- Recipient cap: 10,000 max (M07-006)

---

## Screen 3: Notification Preferences

**Route:** `/my/settings/notifications`
**Purpose:** Member controls delivery channels per subscription topic
**App:** account (3002) or memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Notification Preferences" |
| Topics list | `list` | "Subscription topics" |

### Focus Management

- Page load: focus on first topic toggle
- After save: sonner toast, focus preserved on changed toggle
- Toggle change: auto-save (debounced 500ms)

### Fields

| Field | Type | Source | Display | Editable |
|-------|------|--------|---------|----------|
| topicName | text | GET /my/notifications/preferences | Topic label | No |
| channels.email | boolean | GET /my/notifications/preferences | Toggle switch | Yes |
| channels.push | boolean | GET /my/notifications/preferences | Toggle switch | Yes |
| channels.inApp | boolean | GET /my/notifications/preferences | Toggle switch (disabled for announcements, M7-R1) | Conditional |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Toggle channel | Switch change | PUT /my/notifications/preferences | Authenticated | Auto-save, sonner: "Preferences updated." |

### Role-Variant Matrix

| Element | All Authenticated |
|---------|------------------|
| View preferences | Yes |
| Toggle channels | Yes (except in-app for announcements) |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 768px (md) | Topic rows with channel columns | Full grid |
| < 768px (sm) | Stacked topic cards with toggles | Each topic card has 3 toggles |

### Interaction States

1. **Loading:** Skeleton topic rows (5). Toggles disabled.
2. **Empty:** "No notification topics configured for your organizations."
3. **Success:** Populated toggle grid. Auto-save on change.
4. **Validation Error:** "In-app notifications cannot be disabled for announcements." (M7-R1). Toggle reverts with explanation tooltip.
5. **Permission Error:** N/A (own preferences, any authenticated user).
6. **Unexpected Error:** "Couldn't save preferences." + Retry. Previous state preserved.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** N/A (changes are granular and reversible).
9. **Offline/Sync:** Cached preferences shown. Changes queued. "Preferences will sync when you're back online."
