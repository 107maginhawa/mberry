# Module 7: Communications

## Overview

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Deliver announcements, activity feeds, and notifications across the organization network. Enable officers to reach members through rich-text announcements with scheduling, and give members granular control over how they receive notifications. |
| **Phase** | 1 |
| **Monetization Tier** | Standard |
| **Dependencies** | M05 (Membership) -- announcements target org members; notification categories reference membership status changes, dues reminders, and activity updates that originate in M05. |

---

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 7.1 | Unified activity feed | Members see a single feed combining events and trainings from their org and shared activities from the network (societies, national body). Feed is chronological, filterable by type (events/trainings/announcements) and source org. Items link to detail pages. | Member | P0 |
| 7.2 | Rich text announcements | Officer creates announcements using a Tiptap rich text editor. Supports: headings, bold/italic, bullet and numbered lists, inline images (upload or paste), links, and blockquotes. Announcements are published to all org members or selected membership categories. | Officer (Secretary) | P0 |
| 7.3 | Scheduled announcements | Officer writes an announcement and sets a future publish date/time. The system publishes automatically at the scheduled time. Draft announcements are editable until published. Scheduled announcements can be cancelled before their publish time. | Officer (Secretary) | P0 |
| 7.4 | Notification hierarchy | System delivers notifications through a priority-based hierarchy: **In-app** (always on, cannot be disabled -- badge count + notification center). **Push** (high-priority items: dues overdue, upcoming event tomorrow, payment confirmed. Toggleable per category by member). **Email** (transactional: receipts, password reset, account claim -- always sent. Announcements and activity updates: opt-in). **Weekly digest** (opt-in, sent every Monday: summary of new announcements, upcoming activities, dues status across all orgs). | System, Member | P0 |
| 7.5 | Notification preferences | Member controls delivery per channel and per category. Categories: Dues reminders, Event updates, Training updates, Announcements, Membership status changes, System alerts. Channels: In-app (always on), Push (default on), Email (default off). High-priority items (dues overdue, account security) always push regardless of preference. | Member | P0 |
| 7.6 | Notification deduplication | If a member belongs to multiple orgs and the same network-wide activity (e.g., a training shared by 3 orgs) generates notifications, the member receives ONE notification, not one per org. Deduplication keyed on activity ID + member ID. | System | P0 |
| 7.7 | Delivery and engagement tracking | Officer views delivery metrics per announcement: total recipients, sent count, delivered count, opened count (for email), in-app view count. Shows read rate percentage. Individual member read status is not exposed (privacy). | Officer | P0 |
| 7.8 | Email templates | Org-branded email templates featuring org logo and colors. Secretary can customize subject line and body content. Templates apply to announcement emails only (transactional emails use platform templates). | Officer (Secretary) | P0 |
| 7.9 | Cross-org content sharing | Default sharing rules: **Trainings** are network-wide by default. **Events** are internal by default. Officer can toggle visibility. Chapter-level settings (see M04, capability 4.11) control whether shared content from societies/national body/other chapters appears in the chapter's feed. | Officer, System | P0 |
| 7.10 | Draft announcements | Officer can save announcements as drafts. Drafts are visible only to officers. Drafts can be edited, scheduled, published, or deleted. Draft list is accessible from the communications dashboard. | Officer (Secretary) | P0 |

---

## User Journeys

### CS-6: Send Announcement to Members

| Attribute | Detail |
|-----------|--------|
| **Actor** | Chapter Secretary |
| **Trigger** | Secretary needs to communicate information to chapter members (meeting agenda, policy update, general announcement). |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "Communications" from sidebar | Communications dashboard: list of sent/draft/scheduled announcements with stats | |
| 2 | Clicks "New Announcement" | Rich text editor (Tiptap) with formatting toolbar: headings, bold/italic, lists, images, links, blockquotes | |
| 3 | Writes announcement content, optionally embeds images | Images uploaded inline (max 5 MB per image, JPEG/PNG/WebP). Live preview available. | Image upload fails -> "Upload failed. Max 5 MB, JPEG/PNG/WebP only." |
| 4 | Selects audience | Options: "All members" or filter by membership category (Regular, Life, Student, etc.) | No members in selected category -> "No recipients. Select a different audience." |
| 5 | Selects notification channels | Toggles: In-app (always on, cannot disable), Push (default on), Email (default off). If email selected, email template preview shown. | |
| 6 | Selects visibility | Internal (chapter only, default) or Network-wide (shared to other orgs' feeds) | |
| 7 | Previews announcement | Full preview of how it will appear in-app and in email (if email selected) | |
| 8 | Clicks "Publish Now" | Announcement delivered immediately to all matching recipients via selected channels. Confirmation: "Announcement sent to N members." | Send fails -> "Failed to send. Try again." with retry button. |
| 9 | Views delivery stats | Sent count, delivered count, opened count (email), in-app view count refresh in real-time | |

**Success criteria:** Announcement appears in all targeted members' notification centers within 30 seconds. Email delivery (if selected) initiates within 2 minutes.

---

### CS-7: Schedule Announcement

| Attribute | Detail |
|-----------|--------|
| **Actor** | Chapter Secretary |
| **Trigger** | Secretary wants to prepare an announcement in advance and have it publish automatically at a future date/time. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "Communications" -> "New Announcement" | Rich text editor | |
| 2 | Writes announcement content and configures audience/channels (same as CS-6 stages 2-6) | Content saved as draft in real-time | |
| 3 | Instead of "Publish Now," clicks "Schedule" | Date/time picker appears. Timezone displayed (based on org locale). | |
| 4 | Sets publish date and time | Validates date is in the future. Minimum 15 minutes from now. | Date in the past -> "Schedule time must be in the future." |
| 5 | Confirms schedule | Announcement saved with "Scheduled" status. Appears in scheduled list with countdown. | |
| 6 | (Optional) Edits scheduled announcement before publish time | Full editing available. Can change content, audience, channels, or scheduled time. | |
| 7 | (Optional) Cancels scheduled announcement | Confirmation dialog: "Cancel this scheduled announcement?" -> Moves to drafts. | |
| 8 | At scheduled time, system publishes automatically | Announcement delivered to recipients. Status changes to "Sent." Officer sees delivery stats. | Publish fails -> system retries 3 times over 15 minutes. If still failing, notification sent to secretary: "Scheduled announcement failed to send." |

**Success criteria:** Announcement publishes within 60 seconds of the scheduled time. Secretary receives confirmation notification upon auto-publish.

---

### M-15: View Notifications

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member taps the bell icon (badge shows unread count) or navigates to notification center. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Taps bell icon in header | Notification center opens: all notifications sorted by date (newest first). Unread items visually distinct (bold/highlighted). | |
| 2 | Scrolls through notifications | Grouped by date. Types: announcements, payment confirmations, dues reminders, event updates, training updates, credit awards, membership status changes, system alerts. Each shows: icon by type, title, preview text, timestamp, source org. | No notifications -> "You're all caught up." |
| 3 | Taps a notification | Expands to full content (for announcements) or navigates to relevant screen (payment receipt, event detail, credit dashboard). Notification marked as read. | Deep link target unavailable (deleted event) -> "This content is no longer available." |
| 4 | Marks notification as read/unread | Toggle per notification. Bulk "Mark all as read" available. | |
| 5 | Filters notifications | Filter by category (Announcements, Payments, Events, Training, Credits, System) or by org (if multi-org member). | No results for filter -> "No notifications in this category." |

**Success criteria:** Notification center loads within 1 second. Unread badge count is accurate across all devices within 5 seconds of a new notification.

---

### M-16: Update Notification Preferences

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member navigates to settings to control how they receive notifications. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens profile settings -> "Notifications" tab | Notification preferences matrix displayed. Rows: notification categories. Columns: In-app, Push, Email. | |
| 2 | Views current settings | Default state shown: In-app = always on (locked), Push = on for all categories, Email = off for non-transactional. Transactional emails (receipts, password reset) shown as "Always on" with no toggle. | |
| 3 | Toggles push for a category | Example: disables push for "Announcements" but keeps push for "Dues reminders" | |
| 4 | Toggles email for a category | Example: enables email for "Event updates" | |
| 5 | Toggles weekly digest | On/off toggle. If on, shows delivery day (default Monday). | |
| 6 | Saves preferences | "Preferences updated." Changes take effect immediately for future notifications. | Save fails -> "Failed to update preferences. Try again." |
| 7 | Sees confirmation | Summary of active channels per category displayed | |

**Success criteria:** Preference changes apply to the next notification generated. No retroactive changes to already-queued notifications.

---

## Business Rules

### Referenced Business Rules

| Rule ID | Summary | Relevance to This Module |
|---------|---------|--------------------------|
| BR-28 | Communication Deduplication | If a member belongs to multiple orgs and the same network-wide activity generates notifications from multiple orgs, the member receives exactly ONE notification. Deduplication keyed on activity ID + member ID. |

### Module-Specific Rules

| Rule ID | Rule | Category |
|---------|------|----------|
| M7-R1 | **Notification deduplication across orgs.** If a member belongs to N orgs and the same network-wide activity triggers notifications from multiple orgs, the member receives exactly ONE notification. Deduplication key: `activity_id + member_id`. The notification references the originating org (the activity host), not the sharing orgs. | Constraint |
| M7-R2 | **Announcement content sanitization.** All rich text content must be sanitized on save to prevent XSS. Script tags, event handlers, and embedded iframes are stripped. Allowed HTML: headings (h1-h3), paragraphs, bold, italic, lists (ul/ol/li), links (a with href), images (img with src), blockquotes. | Validation |
| M7-R3 | **Scheduled announcement timing tolerance.** Scheduled announcements must publish within 60 seconds of the configured time. If the publish job fails, it retries up to 3 times over 15 minutes. After 3 failures, the announcement remains in "Scheduled (Failed)" state and the secretary is notified. | Time-based |
| M7-R4 | **Email template branding.** Org-branded email templates must include the org logo and primary color. If no logo or color is configured, platform defaults are used. Email templates must include an unsubscribe link for non-transactional emails (per anti-spam compliance). | Configuration |
| M7-R5 | **Delivery tracking privacy.** Delivery stats (sent, delivered, opened) are shown as aggregate counts only. Individual member read/open status is never exposed to officers. Email open tracking uses a standard tracking pixel; members who block images will not be counted as "opened." | Constraint |
| M7-R6 | **Activity feed load performance.** The unified activity feed must load the first page within 2 seconds and support infinite scroll with pagination (20 items per page). Feed items are sorted by date descending. | Threshold / UX |
| M7-R7 | **In-app notifications always enabled.** In-app is the guaranteed delivery channel. Cannot be disabled by members. Every notifiable event generates an in-app notification. The toggle is absent from the UI and the API rejects attempts to disable in-app notifications. | Constraint |
| M7-R8 | **Push notification defaults and controls.** Push enabled by default for high-priority items (dues overdue, payment confirmed, status changes). Member can toggle per category. Device-level permission is an additional gate. High-priority items (dues overdue, account security) always push regardless of member preference. | Configuration |
| M7-R9 | **Weekly digest opt-in.** Digest aggregates the past week's activity across all orgs. Opt-in only. Sent on a configurable day (default Monday). Multi-org members get a combined or per-org digest (configurable). | Configuration |

---

## UX Specification

### Screen Inventory

| Route | Page Name | Description | Desktop | Mobile |
|-------|-----------|-------------|---------|--------|
| `/org/[id]/officer/communications` | Communications Dashboard | List of all announcements (sent, draft, scheduled) with delivery stats and filters | Sidebar + main content area with table/card view | Full-width list with cards |
| `/org/[id]/officer/communications/new` | Compose Announcement | Rich text editor with audience selector, channel toggles, schedule option, preview | Split view: editor left, preview right | Full-width editor, preview as modal/sheet |
| `/org/[id]/officer/communications/[id]` | Announcement Detail | Standalone screen — view sent announcement with full content and delivery stats (screen spec being added to inventory separately) | Main content with stats sidebar | Full-width content, stats below |

### Screen Details

#### Communications Dashboard (`/org/[id]/officer/communications`)

**Layout:**
- Header: "Communications" title + "New Announcement" primary button
- Filter bar: Status tabs (All / Sent / Scheduled / Drafts), Date range picker, Search
- Announcement list: Card or table view

**Components:**
- Announcement card: Title, preview text (first 100 chars), publish date, status badge (Sent/Scheduled/Draft), delivery stats (recipients, views, opens), audience label
- Stats summary row: Total announcements this month, average read rate, total recipients reached
- Empty state: "No announcements yet. Create your first announcement to reach your members."

**States:**
- Loading: Skeleton cards
- Empty: Illustration + CTA to create first announcement
- Populated: Paginated list (20 per page)
- Error: "Failed to load announcements. Retry."

#### Compose Announcement (`/org/[id]/officer/communications/new`)

**Layout:**
- Desktop: Two-column. Left: editor. Right: live preview + audience/channel config.
- Mobile: Single column. Editor at top, config below, preview as bottom sheet.

**Components:**
- Rich text editor (Tiptap): Toolbar with heading, bold, italic, underline, bullet list, numbered list, link, image upload, blockquote. Image upload: drag-and-drop or click, max 5 MB, JPEG/PNG/WebP.
- Audience selector: Radio group -- "All members" or "By category" with category checkboxes
- Channel toggles: In-app (locked on), Push (toggle, default on), Email (toggle, default off)
- Visibility selector: Internal (default) / Network-wide
- Action buttons: "Save Draft", "Schedule" (opens date/time picker), "Publish Now"
- Preview panel: Renders announcement as members will see it. Toggle between "In-app" and "Email" preview.

**States:**
- Empty editor: Placeholder text "Write your announcement here..."
- Editing: Auto-save draft every 30 seconds
- Publishing: Loading spinner on button, "Sending to N members..."
- Published: Redirect to announcement detail with success toast
- Validation error: "Content cannot be empty" if attempting to publish blank announcement

#### Announcement Detail (`/org/[id]/officer/communications/[id]`)

**Layout:**
- Full announcement content rendered as rich text
- Delivery stats panel: Recipients, In-app views, Email sent, Email opened, Push delivered
- Metadata: Published date, author (officer name), audience, channels used, visibility

**States:**
- Sent: Read-only content + live stats
- Scheduled: Editable content + countdown to publish time + "Cancel Schedule" button
- Draft: Editable content + "Publish Now" / "Schedule" buttons

#### Email Templates (tab on `/org/[id]/officer/communications`)

> **Note:** Email templates are accessed via a tab on `/org/[id]/officer/communications` — not a separate standalone page.

**Layout:**
- Template list (if multiple) or single default template editor
- Editor: Logo upload, primary color picker, header text, footer text
- Live preview: Renders a sample announcement email with current template settings

**Components:**
- Logo upload: Drag-and-drop, max 5 MB, JPEG/PNG/SVG
- Color picker: Hex input + visual picker for primary color
- Subject line template: Text input with variable placeholders (`{org_name}`, `{announcement_title}`)
- Preview: Desktop and mobile email preview toggle

#### Communication Settings (panel within `/org/[id]/officer/communications`)

> **Note:** Communication settings are accessed via a settings gear icon within `/org/[id]/officer/communications` — not a separate standalone page.

**Components:**
- Default push toggle: On/off for new announcements
- Default email toggle: On/off for new announcements
- Digest day selector: Dropdown (Monday-Sunday)
- Sharing preferences: Toggle -- "Show shared content from societies/national body/other chapters"

### Empty States

| Screen | Empty State Message | CTA |
|--------|-------------------|-----|
| Communications Dashboard | "No announcements yet. Keep your members informed with announcements about upcoming events, policy changes, or general updates." | "Create First Announcement" button |
| Notification Center (Member) | "You're all caught up! No new notifications." | None |
| Email Templates (tab within Communications Dashboard) | "No custom template configured. Announcements will use the platform default template." | "Customize Template" button |

### Error States

| Screen | Error Condition | Message | Recovery |
|--------|----------------|---------|----------|
| Compose | Image upload fails | "Image upload failed. Please try again. Max 5 MB, JPEG/PNG/WebP." | Retry upload |
| Compose | Publish fails | "Failed to send announcement. Your draft has been saved." | Retry publish or return to drafts |
| Dashboard | Load fails | "Unable to load announcements. Please try again." | Retry button |
| Notification Center | Load fails | "Unable to load notifications. Pull to refresh." | Pull-to-refresh (mobile) or retry button |
| Scheduled publish | Auto-publish fails after 3 retries | "Scheduled announcement failed to send. Please publish manually." (notification to secretary) | Secretary manually publishes from draft |

---

## Acceptance Criteria Patterns

- Activity feed loads the first page within 2 seconds and supports infinite scroll.
- Rich text editor prevents XSS -- all content is sanitized on save. Script tags and event handlers are stripped.
- Weekly digest only includes content from the past 7 days and respects multi-org membership.
- Notification deduplication prevents a member from receiving more than one notification per network-wide activity, regardless of how many orgs share it.
- Scheduled announcements publish within 60 seconds of the configured time.
- Email templates render correctly across major email clients (Gmail, Outlook, Apple Mail).
- Delivery tracking shows aggregate metrics only -- individual member read status is never exposed.
- In-app notification badge count updates across devices within 5 seconds of a new notification.
- Members cannot disable in-app notifications. The toggle is absent from the UI and the API rejects attempts to disable.
- Push notification defaults respect M7-R8: high-priority items default to on; members can toggle per category.
- Email opt-in defaults respect M7-R8: only transactional emails are on by default; announcement and activity emails are opt-in per BR-28 deduplication scope.

---

## Data Entities

| Entity | Description | Key Fields | Relationships |
|--------|-------------|------------|---------------|
| **Announcement** | A rich-text message created by an officer for delivery to org members. | `id`, `org_id`, `author_id`, `title`, `content_html`, `content_text` (plain text fallback), `status` (draft/scheduled/sent/failed), `audience_type` (all/by_category), `audience_categories[]`, `visibility` (internal/network), `channels` (in_app/push/email flags), `scheduled_at`, `published_at`, `created_at`, `updated_at` | Belongs to Org. Belongs to Officer (author). Has many AnnouncementDeliveries. Has many AnnouncementStats. |
| **AnnouncementDelivery** | Tracks delivery of an announcement to a specific member via a specific channel. | `id`, `announcement_id`, `member_id`, `channel` (in_app/push/email), `status` (pending/sent/delivered/failed), `sent_at`, `delivered_at` | Belongs to Announcement. Belongs to Member. |
| **Notification** | An in-app notification for a member. Generated by system events (announcements, payments, status changes, credits, activities). | `id`, `member_id`, `type` (announcement/payment/dues_reminder/event/training/credit/status_change/system), `title`, `body`, `source_org_id`, `reference_type`, `reference_id`, `read`, `read_at`, `created_at` | Belongs to Member. Optionally references an Org. References a polymorphic source (announcement, payment, event, training, etc.). |
| **NotificationPreference** | Member's per-category notification channel preferences. | `id`, `member_id`, `category` (dues/events/training/announcements/membership/system), `push_enabled`, `email_enabled`, `updated_at` | Belongs to Member. |
| **EmailTemplate** | Org-branded email template for announcements. | `id`, `org_id`, `logo_url`, `primary_color`, `header_text`, `footer_text`, `subject_template`, `created_at`, `updated_at` | Belongs to Org. |
| **WeeklyDigestPreference** | Member's opt-in preference for the weekly digest email. | `id`, `member_id`, `enabled`, `delivery_day` (0-6, default 1 = Monday), `format` (combined/per_org), `updated_at` | Belongs to Member. |

---

*End of Module 7: Communications*
