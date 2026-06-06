# UI Journey Audit: Communications (M07)

> **Audited:** 2026-05-27
> **Module:** m07-communications
> **Spec refs:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, WORKFLOW_MAP.md (WF-046..WF-050), ROLE_PERMISSION_MATRIX.md 3.12/3.18
> **Apps:** memberry (member + officer), admin (platform ops)
> **Finding IDs:** J-M07-001 through J-M07-039

---

## Scope

Two handler subsystems:
- `handlers/communication/` (async broadcast: announcements, templates, 28 handlers)
- `handlers/comms/` (real-time WebSocket: chat, video, 11 handlers)

Frontend surfaces:
- **Memberry member:** `/announcements/`, `/messages/`, `/messages/dm/`
- **Memberry officer:** `/officer/communications/` (dashboard, new, sent, analytics, templates, detail), `/officer/messages/`
- **Admin:** `/communications/` (index, email, moderation, templates)
- **Features:** `features/communications/` (7 components), `features/comms/` (6 components + 1 hook)

---

## R1 — Action Registry

Every interactive element mapped to its handler, API call, and feedback mechanism.

### R1.1 Announcement Create/Publish Flow

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 1 | officer/communications/new | "Send Now" button | Button | `submitWithAction('sent')` | POST `/api/communications/announcements/:orgId` with status=sent | Navigate to list + query invalidation | WF-046 |
| 2 | officer/communications/new | "Schedule" button | Button (conditional) | `submitWithAction('scheduled')` | POST `/api/communications/announcements/:orgId` with status=scheduled | Navigate to list + query invalidation | WF-046, M7-R3 |
| 3 | officer/communications/new | "Save Draft" button | Button | `submitWithAction('draft')` | POST `/api/communications/announcements/:orgId` with status=draft | Navigate to list + query invalidation | WF-046 |
| 4 | officer/communications/new | "Cancel" button | Button | `navigate()` | None | Navigate to `/officer/communications` | -- |
| 5 | officer/communications/new | Title input | Input (controlled) | react-hook-form `register('title')` | Client-only | Zod validation: min 1, max 200 | WF-046 |
| 6 | officer/communications/new | Content textarea | Textarea (controlled) | react-hook-form `register('content')` | Client-only | Zod validation: min 1 | WF-046 |
| 7 | officer/communications/new | "All members" / "By category" toggle | Radio/enum | react-hook-form `audienceType` | Client-only | Toggles audience picker visibility | WF-046 |
| 8 | officer/communications/new | Push channel switch | Switch | react-hook-form `channelPush` | Client-only | Visual toggle | WF-046 |
| 9 | officer/communications/new | Email channel switch | Switch | react-hook-form `channelEmail` | Client-only | Visual toggle | WF-046 |
| 10 | officer/communications/new | Visibility toggle | Select | react-hook-form `visibility` | Client-only | internal/network enum | WF-046 |
| 11 | officer/communications/new | DateTimePicker | DateTimePicker | react-hook-form `scheduledAt` | Client-only | Shows Schedule button when set | WF-046, M7-R3 |
| 12 | officer/communications/new | Server error alert | Alert (role=alert, aria-live=polite) | `setServerError` | Client-only | Red banner with error message | -- |

### R1.2 Announcement Detail Actions (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 13 | officer/communications/$id | "Publish" button (draft only) | Button | `publishMutation.mutate()` | POST `/api/communications/announcements/:id/publish` | "Pu..." pending text + query invalidation | WF-046, M7-R1 |
| 14 | officer/communications/$id | "Archive" button (sent/scheduled) | Button | `archiveMutation.mutate()` | PATCH `/api/communications/announcements/:id` status=archived | "Archiving..." pending text | WF-046 |
| 15 | officer/communications/$id | "Edit" link (draft only) | Link | Navigate with `?edit=:id` | None | Navigate to compose with pre-fill | WF-046 |
| 16 | officer/communications/$id | "Delete" button (draft only) | Button (destructive) | `confirm()` + `api.delete()` | DELETE `/api/communications/announcements/:id` | Browser confirm dialog + navigate back | WF-046 |

### R1.3 Announcement List (Officer Dashboard)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 17 | officer/communications | Status tab bar (All/Sent/Scheduled/Drafts/Archived) | Tab group | `setActiveTab()` | GET `/api/communications/announcements/:orgId?status=` | List updates with filtered results | WF-049 |
| 18 | officer/communications | Search input | Input | `setSearch()` | GET with `?search=` param | Debounced list filter | WF-049 |
| 19 | officer/communications | Announcement row click | Link (`<a>`) | Navigate | None | Navigate to detail `/$announcementId` | WF-049 |
| 20 | officer/communications | Stat cards (Total/Sent/Channels) | Display | useQuery | GET `/api/communications/announcements/:orgId?status=sent&pageSize=1` | Static display with count | WF-048 |
| 21 | officer/communications | "New Message" button | Link | Navigate | None | Navigate to `/officer/communications/new` | WF-046 |

### R1.4 Audience Picker

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 22 | compose (embedded) | Chapter dropdown | Select | `updateFilter('chapterId')` | Client-only | Audience count updates | WF-046 |
| 23 | compose (embedded) | Dues status dropdown | Select | `updateFilter('duesStatus')` | Client-only | Filters: active/expired/suspended/pending | WF-046 |
| 24 | compose (embedded) | Membership tier dropdown | Select | `updateFilter('membershipTier')` | Client-only | Tier filter | WF-046 |
| 25 | compose (embedded) | CPD compliant toggle | Checkbox | `updateFilter('cpdCompliant')` | Client-only | Boolean filter | WF-046 |
| 26 | compose (embedded) | Joined after date | Date input | `updateFilter('joinedAfter')` | Client-only | Date filter | WF-046 |
| 27 | compose (embedded) | Recipient count preview | Display | useQuery debounced | GET `/api/roster/preview?org=...&filters=...` | Shows count + warning if 0 | WF-046 |
| 28 | compose (embedded) | "Save Segment" button | Button | `handleSaveSegment()` | POST `/api/communications/segments` | window.prompt + toast | WF-046 |
| 29 | compose (embedded) | Saved segment select | Select | `handleSelectSegment()` | None (local) | Applies saved filters | WF-046 |
| 30 | compose (embedded) | Delete segment button | Button (X icon) | `deleteSegmentMutation` | DELETE `/api/communications/segments/:id` | Toast success/error | WF-046 |

### R1.5 Template Management

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 31 | officer/communications/templates | Template list | Display | useQuery | GET `/api/communications/templates/:orgId` | List with status badges | WF-047 |
| 32 | officer/communications/templates | Status filter tabs | Tab group | `setFilterStatus()` | Client-side filter | Filtered list | WF-047 |
| 33 | officer/communications/templates | Template row click | Link | Navigate | None | Navigate to detail/edit | WF-047 |
| 34 | officer/communications/templates | "New Template" button | Link | Navigate | None | Navigate to `/templates/new` | WF-047 |
| 35 | officer/communications/templates/new | Name input | Input | react-hook-form | Client-only | Zod: min 1, max 100 | WF-047 |
| 36 | officer/communications/templates/new | Subject input | Input | react-hook-form | Client-only | Zod: min 1, max 200 | WF-047 |
| 37 | officer/communications/templates/new | Body HTML textarea | Textarea | react-hook-form | Client-only | Handlebars syntax | WF-047, M7-R4 |
| 38 | officer/communications/templates/new | Category select | Select | react-hook-form | Client-only | Optional category | WF-047 |
| 39 | officer/communications/templates/new | Channel multi-select | Checkboxes | react-hook-form | Client-only | email/push/inapp | WF-047 |
| 40 | officer/communications/templates/new | Merge field insert buttons | Button group | `insertMergeField()` | Client-only | Inserts `{{var}}` at cursor | WF-047 |
| 41 | officer/communications/templates/new | Status toggle (Draft/Active) | Button group | `setValue('status')` | Client-only | Visual toggle with Badge | WF-047 |
| 42 | officer/communications/templates/new | Template preview | Display | Computed from body | Client-only | Live Handlebars render | WF-047 |
| 43 | officer/communications/templates/new | "Save Template" button | Button | `mutation.mutate(data)` | POST/PATCH `/api/communications/templates/:orgId` | Navigate + toast | WF-047 |

### R1.6 Notification Preferences (Member)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 44 | notification preferences | Channel toggle matrix (5 categories x 3 channels) | Switch grid | `handleToggle()` | PUT `/api/communications/subscriptions/person` | Debounced auto-save + toast | WF-050, M7-R1 |
| 45 | notification preferences | Category headers (Dues/Events/Training/Announcements/Comms) | Display | Static | None | Visual grouping | WF-050 |
| 46 | notification preferences | Loading skeleton | Skeleton | useQuery loading | GET `/api/communications/subscriptions/person` | Skeleton grid | WF-050 |

### R1.7 WebSocket Chat (Real-time)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 47 | messages/dm | Message composer input | Input | `handleSubmit` | sendChatMessageMutation (SDK) | Clear input + 500ms throttle | -- |
| 48 | messages/dm | Send button | Button | `handleSubmit` | sendChatMessageMutation | Disabled during pending/throttle | -- |
| 49 | messages/dm | Typing indicator emit | Keystroke handler | `wsSend('chat.typing')` | WebSocket | 3s throttle on emit | -- |
| 50 | messages/dm | Message bubble | Display | Rendered from data | None | Author avatar + timestamp + read receipt | -- |
| 51 | messages/dm | Reaction button (per-message) | Button (ghost) | `onReact(emoji)` / `onRemoveReaction(emoji)` | WebSocket/API | Toggle highlight + count update | -- |
| 52 | messages/dm | Quick reaction picker | Popover | `setShowPicker(true)` | None | 6 emoji grid | -- |
| 53 | messages/dm | Message search input | Input | `setSearchTerm()` | GET or local filter | Debounced results list | -- |
| 54 | messages/dm | Search result click | Button | Navigate/scroll | None | Scroll to message in thread | -- |
| 55 | messages/dm | DM list sidebar | List | useQuery (listChatRooms) | GET `/chat-rooms?status=active` | Filtered to 2-participant rooms, sorted by lastMessageAt | -- |
| 56 | messages/dm | DM room click | Button | `onSelectRoom(roomId)` | None | Loads thread for selected room | -- |
| 57 | messages/dm | "New DM" button | Button | `onNewDm()` | None | Opens member picker | -- |
| 58 | messages/dm | WebSocket connection indicator | Display | `useChatWebSocket.isConnected` | WebSocket | Green/amber dot | -- |

### R1.8 Member Announcement View

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 59 | announcements/$id | Back button | Button | `navigate()` | None | Navigate to announcements list | -- |
| 60 | announcements/$id | Announcement content | Display | useQuery | GET `/api/communications/announcements/:id` | Loading skeleton / error state / content | WF-046 |
| 61 | announcements/index | Announcement list | Display | useQuery | GET `/api/communications/announcements/:orgId` | Card list with status badges | WF-049 |

### R1.9 Admin Communications

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 62 | admin/communications | Stat cards (4) | Display | Static mock | None | Broadcasts/Active Templates/Pending Moderation/Email Sent | -- |
| 63 | admin/communications | "View Broadcasts" link | Link | Navigate | None | Navigate to broadcasts section | -- |
| 64 | admin/communications/email | Email queue table | Display | useQuery | GET `/api/admin/email-queue` | Table with status/subject/recipient/date | -- |
| 65 | admin/communications/email | Status filter | Select | `setStatusFilter()` | Client-side filter | Filters: all/queued/sent/failed/bounced | -- |
| 66 | admin/communications/email | Search input | Input | `setSearch()` | Client-side | Filtered table | -- |
| 67 | admin/communications/email | "Retry" button (failed emails) | Button | `retryMutation.mutate()` | POST `/api/admin/email-queue/:id/retry` | Optimistic update + toast | -- |
| 68 | admin/communications/moderation | Flagged content table | Display | useQuery | GET `/api/admin/moderation/flagged` | Table with reporter/content/date | -- |
| 69 | admin/communications/moderation | "Approve" button | Button | `approveMutation.mutate()` | PATCH `/api/admin/moderation/:id` status=approved | Row removal + toast | -- |
| 70 | admin/communications/moderation | "Remove" button | Button (destructive) | `removeMutation.mutate()` | PATCH `/api/admin/moderation/:id` status=removed | Confirm dialog + row removal | -- |
| 71 | admin/communications/templates | Platform template list | Display | useQuery | GET `/api/admin/templates` | Table with org/name/status | -- |
| 72 | admin/communications/templates | Status filter | Select | `setFilter()` | Client-side | Filters: all/active/draft/archived | -- |

**Total registered actions:** 72

---

## R2 — Journey Completion Registry

End-to-end user journeys traced from entry to terminal state.

### J-COMMS-01: Officer Creates and Publishes Announcement (WF-046)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/communications | Click "New Message" | Navigate to /new | YES |
| 2 | officer/communications/new | Fill title + content | Form populated | YES |
| 3 | officer/communications/new | Select audience (all or filtered) | Audience picker updates count | YES |
| 4 | officer/communications/new | Toggle channels (push/email) | Switches toggled | YES |
| 5 | officer/communications/new | Click "Send Now" | POST announcement, navigate to list | YES |
| 6 | officer/communications | See announcement in "Sent" tab | List updated | YES |
| **Terminal:** Announcement delivered to recipients | | | | |

### J-COMMS-02: Officer Saves Draft, Edits, Then Publishes

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/communications/new | Fill form, click "Save Draft" | Navigate to list | YES |
| 2 | officer/communications | See draft in "Drafts" tab | Listed with draft badge | YES |
| 3 | officer/communications/$id | Click draft row | Navigate to detail | YES |
| 4 | officer/communications/$id | Click "Edit" link | Navigate to compose with ?edit=id | YES |
| 5 | officer/communications/new | Modify content, click "Send Now" | PATCH + publish | YES |
| **Terminal:** Draft promoted to sent | | | | |

### J-COMMS-03: Officer Schedules Announcement

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/communications/new | Fill form + set scheduledAt | Schedule button appears | YES |
| 2 | officer/communications/new | Click "Schedule" | POST with status=scheduled | YES |
| 3 | officer/communications | See in "Scheduled" tab | Listed with scheduled badge | YES |
| **Terminal:** Announcement queued for future delivery | | | | |

### J-COMMS-04: Officer Creates Message Template (WF-047)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/communications/templates | Click "New Template" | Navigate to /templates/new | YES |
| 2 | officer/communications/templates/new | Fill name/subject/body | Form populated | YES |
| 3 | officer/communications/templates/new | Insert merge fields | `{{var}}` inserted in body | YES |
| 4 | officer/communications/templates/new | Preview renders | Live preview panel | YES |
| 5 | officer/communications/templates/new | Set status active, click "Save Template" | POST template, navigate back | YES |
| 6 | officer/communications/templates | Template visible in list | Listed with active badge | YES |
| **Terminal:** Template available for announcements | | | | |

### J-COMMS-05: Member Views Announcement

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | announcements/index | See announcements list | Card list displayed | YES |
| 2 | announcements/$id | Click announcement card | Navigate to detail | YES |
| 3 | announcements/$id | Read content | Content rendered (read-only) | YES |
| 4 | announcements/$id | Click back | Navigate to list | YES |
| **Terminal:** Member informed | | | | |

### J-COMMS-06: Member Sends Direct Message (WebSocket)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | messages/dm | See DM list sidebar | Rooms sorted by activity | YES |
| 2 | messages/dm | Click room or "New DM" | Thread loaded / member picker opens | YES |
| 3 | messages/dm | Type message in composer | Typing indicator emitted via WS | YES |
| 4 | messages/dm | Press Enter or click Send | sendChatMessageMutation fires | YES |
| 5 | messages/dm | Message appears in thread | Bubble rendered with timestamp | YES |
| **Terminal:** Message delivered in real-time | | | | |

### J-COMMS-07: Member Manages Notification Preferences (WF-050)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | notification preferences | See 5x3 toggle matrix | All toggles loaded from server | YES |
| 2 | notification preferences | Toggle email off for "Events" | Switch changes + debounced PUT | YES |
| 3 | notification preferences | Toast confirms save | "Preferences updated" toast | YES |
| **Terminal:** Preferences persisted per-channel | | | | |

### J-COMMS-08: Officer Views Delivery Analytics (WF-048)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/communications/analytics | See analytics dashboard | Charts + metrics rendered | YES |
| 2 | officer/communications/analytics | View per-announcement stats | Sent/delivered/opened counts | YES |
| **Terminal:** Officer informed of delivery performance | | | | |

### J-COMMS-09: Admin Monitors Email Queue

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | admin/communications/email | See email queue table | Rows with status/subject | YES |
| 2 | admin/communications/email | Filter by "failed" status | Table filtered | YES |
| 3 | admin/communications/email | Click "Retry" on failed email | POST retry, optimistic update | YES |
| **Terminal:** Failed email re-queued | | | | |

### J-COMMS-10: Admin Moderates Flagged Content

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | admin/communications/moderation | See flagged content table | Rows with reporter/content | YES |
| 2 | admin/communications/moderation | Click "Approve" | PATCH approved, row removed | YES |
| 3 | admin/communications/moderation | Click "Remove" | Confirm + PATCH removed | YES |
| **Terminal:** Content moderated | | | | |

**Total journeys:** 10

---

## R3 — Dead Interaction Registry

Elements present in UI but with no effect, broken handler, or unreachable state.

| ID | Screen | Element | Issue | Severity | Fix |
|----|--------|---------|-------|----------|-----|
| J-M07-001 | admin/communications | Stat cards (Broadcasts: 1,247 / Templates: 23 / etc.) | **Hardcoded mock data.** All 4 stat cards show static numbers, no API call. User sees fake metrics. | P1 | Wire to real aggregation endpoints or remove until API ready. |
| J-M07-002 | admin/communications | "View Broadcasts" / "View Templates" / "View Queue" / "View Reports" links | Links present but navigate to sibling routes that exist. Not dead per se, but the stat cards above them are misleading. | P2 | Depends on J-M07-001 fix. |
| J-M07-003 | officer/communications/$id | "Delete" button uses `api.delete()` inline | No mutation wrapper, no query invalidation after delete. If deletion succeeds, navigates away, but cached list still shows deleted item until manual refresh. | P2 | Wrap in useMutation with `onSuccess: () => queryClient.invalidateQueries(['announcements'])`. |
| J-M07-004 | officer/communications/$id | "Archive" button | Uses `archiveMutation` but the mutation function is not visible in the detail route -- it delegates to AnnouncementContent component props. If the parent does not pass `onArchive`, button renders but does nothing. | P2 | Verify prop wiring in the detail route. Add guard: hide button if `onArchive` is undefined. |
| J-M07-005 | compose form | Server error alert | `setServerError(err.message)` -- if API returns non-JSON error (network failure), `err.message` may be unhelpful ("Failed to fetch"). | P3 | Add user-friendly fallback message for network errors. |
| J-M07-006 | audience picker | "Save Segment" via `window.prompt()` | Uses browser native prompt which is non-standard, can't be styled, and will be blocked in some mobile WebViews. | P3 | Replace with modal dialog component. |
| J-M07-007 | notification preferences | In-App toggle for Announcements category | Spec M7-R1 says "In-app cannot be disabled for announcement topics." UI does not enforce this -- all 15 toggles are equally toggleable. | P1 | Disable the inApp switch for the "announcements" row and show tooltip explaining M7-R1 constraint. |
| J-M07-008 | messages/dm | WebSocket reconnection indicator | `isReconnecting` state exists in hook but no UI element consumes it. User has no visual feedback during reconnection. | P2 | Show "Reconnecting..." banner or amber indicator when `isReconnecting === true`. |
| J-M07-009 | officer/communications/sent | Sent history page | Route file exists but rendered content relies on same `AnnouncementList` component with status pre-filtered. No dedicated "sent" optimizations (e.g., delivery summary per row). | P3 | Enhance sent view with inline delivery stats per announcement. |
| J-M07-010 | admin/communications/templates | "Edit" action column | Template list shows templates but no edit/click handler per row. List is view-only for admin. | P3 | Add row click to view template detail or clarify admin role is view-only per spec. |

---

## R4 — Orphan Action Registry

Actions wired to API endpoints that don't exist, or actions referencing removed/renamed routes.

| ID | Screen | Element | Issue | Severity |
|----|--------|---------|-------|----------|
| J-M07-011 | audience picker | Recipient count preview | Calls `GET /api/roster/preview?org=...&filters=...`. This endpoint is not in API_CONTRACTS.md for M07. May be a cross-module call to M05 membership or may not exist. | P2 |
| J-M07-012 | audience picker | Save/Delete segment | Calls `POST /api/communications/segments` and `DELETE /api/communications/segments/:id`. These endpoints are not in API_CONTRACTS.md. Segments are an undocumented feature. | P2 |
| J-M07-013 | admin/communications/email | Email queue fetch | Calls `GET /api/admin/email-queue`. This is not in M07 API_CONTRACTS. May be a platform-admin (M03) endpoint or unimplemented. | P2 |
| J-M07-014 | admin/communications/email | Retry failed email | Calls `POST /api/admin/email-queue/:id/retry`. Not in API_CONTRACTS. | P2 |
| J-M07-015 | admin/communications/moderation | Flagged content fetch | Calls `GET /api/admin/moderation/flagged`. Not in M07 API_CONTRACTS. Cross-module or unimplemented. | P2 |
| J-M07-016 | admin/communications/moderation | Approve/Remove moderation | Calls `PATCH /api/admin/moderation/:id`. Not in API_CONTRACTS. | P2 |
| J-M07-017 | notification preferences | Preferences fetch | Calls `GET /api/communications/subscriptions/person?personId=`. API_CONTRACTS specifies `GET /my/notifications/preferences`. URL mismatch. | P1 |
| J-M07-018 | notification preferences | Preferences save | Debounced PUT to `/api/communications/subscriptions/person`. API_CONTRACTS specifies `PUT /my/notifications/preferences`. URL mismatch. | P1 |
| J-M07-019 | admin/communications/templates | Platform templates fetch | Calls `GET /api/admin/templates`. Not in M07 API_CONTRACTS (which defines `/org/:id/templates`). | P2 |

---

## R5 — Spec Conformance Registry

Comparison of implemented UI behavior against MODULE_SPEC and API_CONTRACTS.

| ID | Spec Requirement | Expected | Actual | Status | Severity |
|----|-----------------|----------|--------|--------|----------|
| J-M07-020 | WF-046: Compose, target audience, schedule/send immediately | Full compose flow with audience picker, channel toggles, schedule option | Implemented with ComposeForm + AudiencePicker + DateTimePicker | PASS | -- |
| J-M07-021 | WF-047: Create/edit reusable templates with variables | Template CRUD with Handlebars variable support | Implemented with TemplateForm + merge field insertion + preview | PASS | -- |
| J-M07-022 | WF-048: Open/delivery rates per announcement | Stats displayed per announcement | Analytics page exists. AnnouncementContent supports `showStats` prop with recipients/emailSent/pushDelivered/inappViews. | PASS | -- |
| J-M07-023 | WF-049: Communication Dashboard: announcement list, drafts, scheduled | Dashboard with filtered tabs | AnnouncementList with All/Sent/Scheduled/Drafts/Archived tabs + search | PASS | -- |
| J-M07-024 | WF-050: Email Opt-Out Management: respect member preferences per channel | Per-channel preference toggles | NotificationPreferences with 5x3 matrix. **BUT** in-app disable not blocked per M7-R1. | FAIL | P1 |
| J-M07-025 | M7-R1: In-app notifications cannot be disabled for official announcements | In-app toggle locked for announcements | All toggles freely toggleable. No enforcement of M7-R1. | FAIL | P1 |
| J-M07-026 | M7-R2: Member-level suppression list honored during broadcast | Suppressed members skipped during send | Backend concern -- UI does not display suppression status. No visibility into who was suppressed. | WARN | P3 |
| J-M07-027 | M7-R3: Scheduled time must be in the future | Validation on scheduledAt | Zod schema accepts any string for scheduledAt. No future-date validation on client. Server may reject. | FAIL | P2 |
| J-M07-028 | M7-R4: Missing Handlebars variable at render time shows placeholder | Graceful degradation | TemplatePreview does basic render. Behavior on missing var not visually handled in preview. | WARN | P3 |
| J-M07-029 | AC-M07-001: In-app always on | In-app delivery guaranteed regardless of email opt-out | No client-side enforcement. See J-M07-025. | FAIL | P1 |
| J-M07-030 | AC-M07-004: Delivery Stats visible | Sent/delivered/opened count shown | AnnouncementContent.stats shows recipients/emailSent/pushDelivered/inappViews. API_CONTRACTS uses sentCount/deliveredCount/failedCount. **Field name mismatch.** | FAIL | P2 |
| J-M07-031 | API: GET `/my/notifications/preferences` | Fetch preferences via `/my/` path | UI calls `/api/communications/subscriptions/person?personId=`. Wrong endpoint. | FAIL | P1 |
| J-M07-032 | API: PUT `/my/notifications/preferences` with subscriptions array | Update via `/my/` path with topic/channel structure | UI calls different endpoint with different payload shape. | FAIL | P1 |
| J-M07-033 | Permissions: Send broadcast restricted to president, secretary | Only president/secretary can see Send Now | No role gate on compose page. Any officer with route access can send. | FAIL | P2 |
| J-M07-034 | Permissions: Manage subscription topics requires president (2FA) + admin | Restricted to president with 2FA | No subscription topic management UI exists. Topics are hardcoded in NotificationPreferences constant. | WARN | P3 |
| J-M07-035 | Screen: `/my/settings/notifications` per MODULE_SPEC 9.3 | Preferences at `/my/settings/notifications` | NotificationPreferences component exists but route location not verified. May be embedded elsewhere. | WARN | P3 |

---

## R6 — Cross-Module Dependency Registry

Inter-module touchpoints and integration contracts.

| ID | From | To | Integration Point | Status | Issue |
|----|------|----|--------------------|--------|-------|
| J-M07-036 | M07 (audience picker) | M05 (Membership) | Roster preview endpoint for recipient count | UNVERIFIED | Endpoint `/api/roster/preview` not in M07 or M05 API_CONTRACTS. |
| J-M07-037 | M07 (compose form) | M04 (Org Admin) | Organization context via `orgSlug` param | OK | TanStack Router provides orgSlug, used as orgId for API calls. |
| J-M07-038 | M07 (chat/comms) | M01 (Auth) | WebSocket authentication | PARTIAL | `useChatWebSocket` opens WS to `/ws/chat/:roomId`. Auth token passing mechanism not visible in hook. |
| J-M07-039 | M07 (admin email) | M03 (Platform Admin) | Email queue monitoring endpoints | UNVERIFIED | Admin email/moderation endpoints not in M07 contracts. May be M03 endpoints. |

---

## Summary

| Registry | Count | Pass | Fail/Dead | Warn |
|----------|-------|------|-----------|------|
| R1 Actions | 72 | -- | -- | -- |
| R2 Journeys | 10 | 10 complete | 0 broken | 0 |
| R3 Dead Interactions | 10 | -- | 3 P1, 4 P2, 3 P3 | -- |
| R4 Orphan Actions | 9 | -- | 2 P1, 7 P2 | -- |
| R5 Spec Conformance | 16 checks | 4 PASS | 8 FAIL, 4 WARN | -- |
| R6 Cross-Module | 4 | 1 OK, 1 PARTIAL | 2 UNVERIFIED | -- |

### P1 Findings (Blockers) — 5 total

| ID | Summary |
|----|---------|
| J-M07-001 | Admin communications stat cards show hardcoded mock data |
| J-M07-007 | Notification preferences: in-app toggle for announcements not locked per M7-R1 |
| J-M07-017 | Notification preferences GET calls wrong endpoint (not `/my/notifications/preferences`) |
| J-M07-018 | Notification preferences PUT calls wrong endpoint (not `/my/notifications/preferences`) |
| J-M07-025 | M7-R1 in-app-always-on not enforced in UI |

### P2 Findings (Important) — 11 total

| ID | Summary |
|----|---------|
| J-M07-003 | Delete announcement: no query invalidation, stale cache |
| J-M07-004 | Archive button may be no-op if onArchive prop not passed |
| J-M07-008 | WebSocket reconnection state not surfaced in UI |
| J-M07-011 | Audience picker calls undocumented roster preview endpoint |
| J-M07-012 | Saved segments use undocumented API endpoints |
| J-M07-013 | Admin email queue uses undocumented endpoint |
| J-M07-014 | Admin retry email uses undocumented endpoint |
| J-M07-015 | Admin moderation uses undocumented endpoint |
| J-M07-016 | Admin moderation approve/remove uses undocumented endpoint |
| J-M07-027 | Scheduled time not validated as future on client side |
| J-M07-030 | Delivery stats field names don't match API_CONTRACTS |
| J-M07-033 | No role gate on announcement send (president/secretary only per spec) |

### P3 Findings (Advisory) — 6 total

| ID | Summary |
|----|---------|
| J-M07-005 | Compose error alert shows raw error message for network failures |
| J-M07-006 | Audience picker uses window.prompt() for segment naming |
| J-M07-009 | Sent history page has no delivery stats per row |
| J-M07-010 | Admin template list is view-only with no click handler |
| J-M07-019 | Admin templates call `/api/admin/templates` (not in M07 contracts) |
| J-M07-026 | No UI visibility into suppressed members during broadcast |
| J-M07-028 | Missing Handlebars variable behavior not shown in template preview |
| J-M07-034 | No subscription topic management UI (spec says president+2FA can manage) |
| J-M07-035 | Notification preferences route location unclear vs spec `/my/settings/notifications` |
