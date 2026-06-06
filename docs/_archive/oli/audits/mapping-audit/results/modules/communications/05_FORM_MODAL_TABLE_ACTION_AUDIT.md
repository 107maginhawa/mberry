# Audit 05 — Form / Modal / Table Action Audit
## Module: Communications
**Scope:** `apps/memberry` + `apps/admin` — deep-dive on all forms, modals/dialogs, and table interactions.
**Date:** 2026-05-26
**Auditor:** Claude Code (automated static analysis)
**Depends on:** Audit 04 (interaction inventory), Audit 06 (API contract alignment)

---

## Section 1 — ComposeForm (Announcement Compose)

**File:** `apps/memberry/src/features/communications/components/compose-form.tsx`

### 1.1 Schema Definition

```typescript
const composeSchema = z.object({
  title:        z.string().min(1).max(200),
  content:      z.string().min(1),
  audienceType: z.enum(['all', 'by_category']).default('all'),
  channelPush:  z.boolean().default(true),
  channelEmail: z.boolean().default(false),
  visibility:   z.enum(['internal', 'network']).default('internal'),
  scheduledAt:  z.string().optional(),
})
```

### 1.2 Field Coverage

| Field | UI Element | Validation | Rendered |
|---|---|---|---|
| `title` | `<Input>` maxLength=200 | `min(1)`, `max(200)` | Yes |
| `content` | `<Textarea>` resize-y | `min(1)` | Yes |
| `audienceType` | Picker (all / by_category) | `enum` | Yes |
| `audienceCategories` | Conditional multi-select | **None — not in schema** | Yes (conditional) |
| `channelPush` | `<Switch>` | `boolean` default `true` | Yes |
| `channelEmail` | `<Switch>` | `boolean` default `false` | Yes |
| `visibility` | Picker (internal / network) | `enum` | Yes |
| `scheduledAt` | `<DateTimePicker>` | `string().optional()` | Yes |

### 1.3 Validation Gaps

**[LIKELY BUG] P1** — `audienceCategories` is collected in component state but **not included in the Zod schema**. It is passed to the API payload outside of `handleSubmit` validation:

```typescript
// Payload constructed manually — not from react-hook-form validated data
const data = {
  title: titleValue,           // from watch()
  content: watch('content'),
  audienceType,
  audienceCategories,          // from separate useState — unvalidated
  channelPush,
  channelEmail,
  visibility,
  status: action,
  scheduledAt: action === 'scheduled' && scheduledAt ? scheduledAt : undefined,
}
```

The form's `handleSubmit` is called but the payload is constructed from component state rather than from the validated form values. This means:
- `audienceCategories` can be an empty array when `audienceType === 'by_category'` (no validation fires)
- `scheduledAt` can be omitted when action is `'scheduled'` (no validation fires to require it)
- The `handleSubmit` call validates the schema fields, but the actual API payload is composed separately — a logic split that bypasses schema enforcement

**[LIKELY BUG] P1** — `scheduledAt` is `z.string().optional()` with no date-in-future validation. A user can schedule an announcement for a past date — backend must enforce but frontend gives no feedback.

### 1.4 API Endpoint Alignment

| Action | Frontend Call | Expected Endpoint |
|---|---|---|
| Create | `api.post('/api/communications/announcements/${orgId}', data)` | `POST /communications/announcements/{organizationId}` |
| Update | `api.patch('/api/communications/announcements/${existingAnnouncement.id}', data)` | `PATCH /communications/announcements/{announcementId}` |

**[LIKELY BUG] P2** — Create uses `orgId` as URL segment (`/announcements/${orgId}`). Update uses `announcementId` as URL segment. The two endpoints have different URL structures. If the backend create route expects `organizationId` as a query param (not path segment), the create call will fail.

### 1.5 Edit Mode

Edit mode is triggered via `?edit=<announcementId>` query param on the `/new` route. The parent route (`new.tsx`) fetches existing data via `api.get` and passes it as `existingAnnouncement` prop to `ComposeForm`.

**[LIKELY BUG] P2** — The draft fetch in edit mode uses `api.get` (raw call, not SDK hook). If the endpoint returns a different shape than `existingAnnouncement` prop expects (e.g., `visibility: 'public'` vs `'network'`), the form silently pre-fills with mismatched values.

Specifically: schema uses `visibility: z.enum(['internal', 'network'])` but the `existingAnnouncement` prop type accepts `string` for `visibility`. If the API stores `'public'` internally, the enum picker will default to `'internal'` silently.

### 1.6 Submit State

- Buttons are disabled while `mutation.isPending`. Correct.
- No explicit loading indicator on buttons (text changes: "Sending..." for "Send Now"). Draft and Schedule buttons show no loading text.
- Server error is displayed inline under submit buttons via `setServerError`. Correct.

---

## Section 2 — TemplateForm (Create / Edit Template)

**File:** `apps/memberry/src/features/communications/components/template-form.tsx`

### 2.1 Schema Definition

```typescript
const templateSchema = z.object({
  name:     z.string().min(1, 'Template name is required'),
  channel:  z.enum(['email', 'push', 'inApp']).default('email'),
  category: z.string().default('announcement'),
  subject:  z.string().optional(),
  body:     z.string().min(1, 'Body is required'),
  status:   z.enum(['draft', 'active']).default('draft'),
})
```

### 2.2 Field Coverage

| Field | UI Element | Validation | Notes |
|---|---|---|---|
| `name` | `<Input>` | `min(1)` | Required |
| `channel` | Picker (email / push / inApp) | `enum` | Correct |
| `category` | `<Input>` or picker | `string` default | No enum constraint |
| `subject` | `<Input>` | `optional()` | Conditional — shown for email channel |
| `body` | `<Textarea>` | `min(1)` | Required |
| `status` | Toggle (draft / active) | `enum` | Correct |
| `mergeFields` | Auto-extracted from body | **Not in schema** | Computed via `extractMergeFields(body)` |

### 2.3 Merge Fields

Merge fields (`{{member.name}}`, `{{org.name}}`, etc.) are extracted client-side via regex and inserted into the API payload separately. They are not validated in the Zod schema.

**[LIKELY BUG] P2** — Invalid merge field tokens (e.g., `{{member.invalidField}}`) pass client-side extraction without error. Backend must validate, but frontend gives no feedback.

### 2.4 Subject Required for Email

`subject` is `optional()` in schema. When `channel === 'email'`, a subject is contextually required for most email systems.

**[LIKELY BUG] P2** — No conditional validation: `subject` not required even when `channel === 'email'`. An email template with no subject line can be created and sent.

### 2.5 API Endpoint

| Action | Call |
|---|---|
| Create | `api.post('/api/communications/templates', payload)` |
| Update | `api.patch('/api/communications/templates/${existingTemplate.id}', payload)` |

Uses raw `api.post/patch` — not SDK mutations. See Audit 04 §2.3 for SDK gap.

### 2.6 Template Edit Loading

`new.tsx` fetches existing template via `api.get('/api/communications/templates/${edit}')`. If `edit` param is invalid, the query runs but returns an error — no error state rendered in `NewTemplatePage`. The form silently shows empty fields.

**[LIKELY BUG] P2** — Invalid `?edit=` param produces no visible error.

---

## Section 3 — Chat Message Input

**File:** `apps/memberry/src/features/comms/components/message-composer.tsx`

### 3.1 Validation

| Rule | Implemented |
|---|---|
| Non-empty message | `draft.trim().length > 0` — Yes |
| Max length | **None** — no max character limit enforced |
| Send throttle (500ms) | Yes — prevents double-send |
| Pending guard | `!send.isPending` — Yes |

**[LIKELY BUG] P2** — No max message length on the frontend. Backend `sendChatMessage` handler validates via OpenAPI-generated validators. If backend rejects a long message, the user sees `toast.error('Could not send message')` with no length guidance.

### 3.2 SDK Usage

Uses `sendChatMessageMutation()` from `@monobase/sdk-ts/generated/react-query`. **Correct — only comms feature using SDK mutation for message actions.**

### 3.3 Keyboard Behavior

- `Enter` (without Shift) → submit. Correct.
- `Shift+Enter` → no submit (falls through to default newline). The `<Input>` component is single-line; Shift+Enter does not produce a newline in `<Input>`. This is a UX inconsistency for a chat interface (users expect multi-line capability).

**P3** — Single-line input for chat messages; `Shift+Enter` handling documented but ineffective on `<Input>`. Should be `<textarea>` for multi-line support.

### 3.4 Typing Events

Throttled to once per 2 seconds via `wsSend('chat.typing', { roomId })`. Correctly throttled.

---

## Section 4 — Subscription Preferences

**Relevant backend handlers:** `bulkUpdatePersonSubscriptions.ts`, `createSubscriptionTopic.ts`

No subscription preferences form component was found in `apps/memberry/src`. The `bulkUpdatePersonSubscriptions` handler exists in the backend but no corresponding frontend form was located.

**[E2E GAP] P1** — Subscription preferences UI (toggle matrix: categories × channels) is listed in the audit brief as a form but does not appear to exist in the codebase. Members cannot manage their notification preferences from the frontend.

---

## Section 5 — Survey Response Form

**Relevant backend handlers:** `createSurvey.ts`, `ac-m18.surveys.test.ts`

No survey response form component was found in `apps/memberry/src/features/communications`. The backend has survey handlers but no frontend form for responding to surveys was located.

**[E2E GAP] P1** — Survey response form is absent from the frontend despite backend implementation.

---

## Section 6 — Modals and Confirm Dialogs

### 6.1 Audit Results

A `grep` across all `communications` feature files for `AlertDialog`, `Dialog`, `ConfirmDialog`, `onConfirm`, `destructive` returned **zero results**.

| Modal | Expected | Found |
|---|---|---|
| Delete Announcement Confirm | Yes | **No** |
| Archive Announcement Confirm | Yes | **No** |
| Publish Announcement Confirm | Yes | **No** |
| Report Feed Post modal | No component found | **No** |
| Create Channel dialog | `CreateChannelDialog.tsx` | Yes |
| Delete Template Confirm | No — direct delete | **No** |

### 6.2 Delete Without Confirm

`TemplateList` delete action fires `api.delete(...)` directly on button click with no confirmation dialog:

```typescript
// template-list.tsx — row delete button
onClick={() => deleteMutation.mutate(id)}
```

**[LIKELY BUG] P1** — Template deletion is immediate, irreversible, with no confirmation. User can accidentally delete a template in use.

### 6.3 Archive Announcement — No Modal, No Handler

The `$announcementId` officer detail page has an Archive button rendered but archiving relies on `archiveAnnouncement.ts` backend handler. No confirmation dialog wraps this destructive action.

**[LIKELY BUG] P1** — Destructive archive action (changes announcement status permanently) fires without confirmation.

### 6.4 Publish Announcement — No Modal

Sending an announcement to all members (status transition `draft → sent`) is performed via ComposeForm "Send Now" button with no intermediate confirmation step. For a bulk action reaching all org members, this is a significant UX risk.

**[LIKELY BUG] P1** — No publish confirmation dialog before sending to all members.

### 6.5 CreateChannelDialog — Correctly Implemented

`CreateChannelDialog` uses `Dialog` + `DialogContent` from `@monobase/ui`. Validates `name.trim().length > 0`. Uses SDK mutation. Shows `toast.success/error`. **Correctly implemented.**

---

## Section 7 — Announcement List Table

**File:** `apps/memberry/src/features/communications/components/announcement-list.tsx`

### 7.1 Tabs & Filtering

| Feature | Implemented |
|---|---|
| Tab bar (All / Sent / Scheduled / Drafts / Archived) | Yes — 5 tabs |
| Tab click sets `activeTab` state | Yes |
| Active tab passed as `status` query param to API | Yes |
| Search input | Yes — `search` state passed as param |
| Client-side filter | No — server-side only |

### 7.2 Pagination

`AnnouncementList` fetches with no explicit `pageSize` parameter (except the stats sub-query which uses `pageSize=1`). The main query passes no `page` or `cursor` param.

**[LIKELY BUG] P2** — No pagination control. If an organization has more announcements than the API default page size, only the first page is shown with no way to load more.

### 7.3 Loading State

`isLoading` → renders `<Skeleton>` elements inline. Correct.

### 7.4 Empty State

```typescript
// When announcements.length === 0:
'No announcements yet. Send your first message to members.'
```
Correct, friendly empty state text.

### 7.5 Row Actions

Announcement rows are `<Link>` elements to the detail page. No inline row action menu (edit, delete, archive) exists in the list view — all actions are on the detail page.

**P3** — No bulk action selection. Officers cannot bulk-archive or bulk-delete from list view.

### 7.6 Stat Cards

Stats rendered from live API data (`statsData.totalSent`, `total`, `channelLabels`). **Correct — not hardcoded.** Contrasts with admin page (hardcoded).

---

## Section 8 — Sent Messages Table

**File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications/sent.tsx`

### 8.1 Data Source

```typescript
useQuery({
  queryKey: ['announcements-sent', orgId],
  queryFn: () => api.get('/api/communications/announcements?organizationId=${orgId}&status=sent'),
})
```

Uses raw `api.get`. No SDK hook. Endpoint URL format mixes `?organizationId=` query param vs create endpoint which uses path segment. Inconsistency noted.

### 8.2 Delivery Stats Display

Each row renders `stats.recipients`, `stats.emailSent`, `stats.pushDelivered`, `stats.inappViews` if present.

**[LIKELY BUG] P2** — `stats` is typed as optional (`stats?: {...}`). If backend does not return stats (e.g., announcement was sent before stats tracking was added), the row shows no stats data with no fallback UI.

### 8.3 Pagination

No pagination. Same issue as AnnouncementList (§7.2).

### 8.4 Empty State

Not observed in source — the table likely shows an empty `<tbody>` when no sent announcements exist. No explicit empty state component rendered.

**P2** — Missing empty state for sent history.

---

## Section 9 — Template List Table

**File:** `apps/memberry/src/features/communications/components/template-list.tsx`

### 9.1 Data Source

```typescript
useQuery({
  queryKey: ['templates', orgId],
  queryFn: () => api.get('/api/association/message-templates?organizationId=${orgId}'),
})
```

Note: endpoint is `/api/association/message-templates` — uses the `association` handler namespace, not `communication`. This is notable because template CRUD sits under a different API module.

### 9.2 Features

| Feature | Implemented |
|---|---|
| Loading skeleton | `<TableSkeleton rows={5} cols={5}>` |
| Empty state | `<EmptyState>` with "New Template" action button |
| Search | Client-side filter on `t.name` |
| Edit row button | `onEdit(templateId)` prop callback |
| Delete row button | Direct `deleteMutation.mutate(id)` — no confirm dialog |
| Pagination | **None** |

### 9.3 Delete Confirmation Gap

See §6.2. Delete fires immediately without confirmation dialog.

---

## Section 10 — Analytics Dashboard Table

**File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications/analytics.tsx`

### 10.1 Data Source

```typescript
api.get('/api/communications/announcements/${orgId}?status=sent')
```

URL uses path segment for `orgId` here vs query param in the sent page. **Inconsistency between sent page and analytics page for the same data.**

**[LIKELY BUG] P2** — Different URL shapes for effectively the same resource (sent announcements with stats). One will 404 or return incorrect data depending on backend route registration.

### 10.2 DeliveryFunnel Component

`<DeliveryFunnel>` receives per-announcement stats and renders a funnel visualization. If stats are missing (optional field), behavior of `DeliveryFunnel` with null/undefined stats is unknown.

**[E2E GAP] P2** — No test covers analytics page with partial stats data.

---

## Section 11 — Chat Channel & DM Lists

### 11.1 ChannelList

| Feature | Implemented |
|---|---|
| SDK hook | `listChatRoomsOptions` — Yes |
| Loading skeleton | `<Skeleton>` rows — Yes |
| Empty state | `<EmptyState>` — Yes |
| Unread indicators | `useUnreadCounts` hook — Yes |
| Create channel (officers) | `CreateChannelDialog` — Yes |
| Room display name | Derived from `room.context` or fallback — Yes |

### 11.2 DmList

| Feature | Implemented |
|---|---|
| SDK hook | `listChatRoomsOptions` filtered to 2-participant rooms — Yes |
| Loading skeleton | `<Skeleton>` rows — Yes |
| Empty state | `<EmptyState>` — Yes |
| "New DM" button | `<Button>` calls `onNewDm` prop — **No dialog/handler found** |
| Sort by last activity | Yes |

---

## Section 12 — Admin App Tables

### 12.1 Platform Broadcasts (`/communications`)

No table rendered. Placeholder text only. All stat values hardcoded. See Audit 04 §7.1.

### 12.2 Platform Templates (`/communications/templates`)

| Element | Status |
|---|---|
| Category filter tabs | Render-only, no logic |
| Template list | `<EmptyState>` always shown — no API call |
| "New Template" button | No `onClick` handler |

**All interactive elements in admin templates page are non-functional.** P1.

### 12.3 Missing Admin Tables

- `/communications/email` — route file absent; email queue table not implemented
- `/communications/moderation` — route file absent; moderation queue not implemented

---

## Section 13 — Frontend Zod vs Backend Validator Alignment

### 13.1 Announcement Create

| Field | Frontend Zod | Backend Validator (generated from OpenAPI) |
|---|---|---|
| `title` | `string.min(1).max(200)` | Expected: `string`, maxLength likely defined in TypeSpec |
| `content` | `string.min(1)` | Expected: `string` |
| `audienceType` | `enum(['all','by_category'])` | Must match OpenAPI enum |
| `channelPush` | `boolean` | Must match OpenAPI `boolean` |
| `channelEmail` | `boolean` | Must match OpenAPI `boolean` |
| `visibility` | `enum(['internal','network'])` | Frontend uses `'network'` — OpenAPI may use `'public'` |
| `scheduledAt` | `string.optional()` | Date-time format (`date-time`) expected by OpenAPI |
| `audienceCategories` | **Not in schema** | OpenAPI likely defines as `string[]` optional |

**[LIKELY BUG] P1** — `visibility` uses value `'network'` in frontend. OpenAPI/backend may use `'public'`. If values differ, visibility is always stored incorrectly.

**[LIKELY BUG] P2** — `scheduledAt` as raw `string` vs backend expecting ISO 8601 `date-time` format. `DateTimePicker` component must output a valid ISO string; not verified.

### 13.2 Template Create

| Field | Frontend Zod | Backend Concern |
|---|---|---|
| `channel` | `enum(['email','push','inApp'])` | `inApp` vs `in_app` — casing difference risk |
| `category` | `string` | No enum constraint; backend may reject unknown categories |
| `mergeFields` | Not in schema | Computed and sent separately |

**[LIKELY BUG] P2** — `channel: 'inApp'` (camelCase) in frontend schema. Backend generated validators may use `'in_app'` (snake_case). Templates created with push/inApp channels may fail or be stored incorrectly.

---

## Section 14 — Error Recovery & Edge Cases

### 14.1 Network Errors

| Surface | Recovery |
|---|---|
| `ComposeForm` | `onError` sets `serverError` state — displayed inline |
| `TemplateForm` | `toast.error('Failed to save template')` |
| `MessageComposer` | `toast.error('Could not send message')` |
| `AnnouncementList` | No error state — silent empty render |
| `SentHistoryPage` | No error state — silent empty render |
| `AnalyticsDashboardPage` | No error state — silent empty render |
| `VideoCallPanel` join error | SDK meta `toast: { error: '...' }` — handled |

### 14.2 Optimistic Updates

- `ChatView` appends incoming WS messages optimistically. Dedup by `m.id`. Correct.
- `AnnouncementList` invalidates `['announcements', orgId]` on compose success. Correct.
- `TemplateList` invalidates `['templates', orgId]` on delete success. Correct.

### 14.3 Race Conditions

**[LIKELY BUG] P2** — `AnnouncementList` and `SentHistoryPage` both query similar announcement data with different query keys (`['announcements', orgId, ...]` vs `['announcements-sent', orgId]`). After a ComposeForm submission, only `['announcements', orgId]` is invalidated. `SentHistoryPage` cache is not invalidated and may show stale data.

---

## Gate 5 — Form / Modal / Table Action

| Check | Result |
|---|---|
| All forms use Zod schema with complete field coverage | FAIL — `audienceCategories` and `scheduledAt` bypass schema enforcement |
| All destructive actions have confirm dialogs | FAIL — delete template, archive announcement, publish announcement all lack confirms |
| Table pagination implemented | FAIL — no pagination in AnnouncementList, TemplateList, SentHistoryPage |
| Empty states present for all tables | PARTIAL — missing in SentHistoryPage |
| Loading states present for all tables | PASS |
| Error states present for all query surfaces | FAIL — 3 surfaces have no error UI |
| Frontend Zod aligns with backend validators | FAIL — `visibility` enum mismatch, `channel` casing risk, `audienceCategories` unvalidated |
| Subscription preferences form exists | FAIL — not implemented |
| Survey response form exists | FAIL — not implemented |
| Admin tables load real data | FAIL — all admin comms tables hardcoded or empty |

**Gate 5 status: FAIL**

### Issue Summary

| Severity | Count | Key Issues |
|---|---|---|
| P0 | 0 | — |
| P1 | 7 | `audienceCategories` bypasses schema, delete template no confirm, archive no confirm, publish no confirm, visibility enum mismatch, subscription prefs UI absent, survey form absent |
| P2 | 10 | `scheduledAt` no future-date validation, subject not required for email templates, `channel` casing mismatch, URL inconsistency (path vs query param), stats optional with no fallback, analytics URL differs from sent page URL, `SentHistoryPage` no empty state, 3 surfaces no error UI, stale cache after compose, no pagination |
| P3 | 2 | Chat input single-line UX, no bulk actions in announcement list |

---

*End of Audit 05*
