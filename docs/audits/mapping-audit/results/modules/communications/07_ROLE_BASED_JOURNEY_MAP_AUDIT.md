# Audit 07 — Role-Based Journey Map
## Module: Communications (communication/ + communications/ + comms/)
**Date:** 2026-05-26
**Auditor:** Automated Mapping Audit
**Severity scale:** P0 = data loss / security breach · P1 = broken feature · P2 = degraded UX · P3 = tech debt

---

## 07-1. Roles in Scope

| Role | Context | Primary comms capabilities |
|------|---------|---------------------------|
| **Officer** | Association-scoped | Create/edit/publish/archive announcements; view analytics; manage templates |
| **Member** | Association-scoped | View published announcements; read detail; use chat/DM; manage notification preferences |
| **Admin (platform)** | Platform-level | Monitor email queue; moderate content; manage platform templates; send broadcasts |
| **Coordinator** | Association-scoped | Manage message templates; compose/schedule/send messages; manage saved segments |

---

## 07-2. Officer — Announcement Lifecycle Journey

### Expected journey
`List view` → `New Message` → `Compose form` → `Set audience` → `Schedule or Send` → `Confirmation` → `Sent history` → `Detail + analytics`

### Actual frontend coverage

| Step | Route | API call | Status |
|------|-------|----------|--------|
| List view | `officer/communications/index.tsx` | `GET /communications/announcements/:orgId` (via AnnouncementList) | OK |
| New message button | `index.tsx` → link to `/new` | n/a | OK |
| Compose form | `officer/communications/new.tsx` → `ComposeForm` | `POST /communications/announcements/:orgId` | OK |
| Edit existing draft | `new.tsx?edit=<id>` | `GET /communications/announcements/detail/:id` then PATCH | OK |
| Set audience | `ComposeForm` → `AudiencePicker` component | Internal form state | OK |
| Send now | `ComposeForm` → `api.post(.../announcements/${orgId})` | `POST /communications/announcements/:orgId` | OK |
| Schedule | `ComposeForm` → scheduledAt field | Passed in POST body | **PARTIAL — no dedicated schedule endpoint used** |
| Publish (from detail) | `$announcementId.tsx` → `publishMutation` | `POST /communications/announcements/:id/publish` | OK |
| Archive | `$announcementId.tsx` → `archiveMutation` | `POST /communications/announcements/:id/archive` | OK |
| Sent history | `officer/communications/sent.tsx` | `GET /communications/announcements?organizationId=...` | **[LIKELY BUG] URL mismatch — see Audit 06 §06-5** |
| Analytics dashboard | `officer/communications/analytics.tsx` | `GET /communications/announcements/:orgId?status=sent` | OK (but client-side aggregation only) |

### Dead ends and gaps

**GAP 1 — Schedule flow ambiguity (P2):** The compose form includes a `scheduledAt` field in the POST body to `createAnnouncement`. However, the backend has a dedicated `POST /communications/announcements/:id/schedule` endpoint. It is unclear whether passing `scheduledAt` in the create body triggers scheduling or requires a subsequent call to the schedule endpoint. No E2E test validates the scheduled → auto-send lifecycle.

**GAP 2 — Delete announcement (P2):** The backend exposes `DELETE /communications/announcements/:id` (officer role). No frontend route or button exists to delete an announcement from the officer detail page. Officers can only archive, not delete.

**GAP 3 — Sent history broken URL (P2):** [LIKELY BUG] `sent.tsx` constructs `?organizationId=${orgId}` as a query param. The backend expects `:organizationId` as a path segment. The sent history page may return empty or incorrect results silently.

**GAP 4 — Analytics uses client-side aggregation only (P3):** The analytics page fetches the full announcements list and aggregates stats in the browser (no dedicated analytics endpoint). This works for small datasets but will degrade at scale and does not match the expected "server-computed delivery funnel" design.

---

## 07-3. Officer — Template Management Journey

### Expected journey
`Templates list` → `New Template` → `Fill channel/subject/body` → `Preview` → `Save` → `Use template in compose`

### Actual frontend coverage

| Step | Route | Status |
|------|-------|--------|
| Templates list | `officer/communications/templates/index.tsx` | Route exists — internal state unknown without full read |
| New template | `officer/communications/templates/new.tsx` | Route exists |
| Template form | `features/communications/components/template-form.tsx` | Component exists |
| Preview | `features/communications/components/template-preview.tsx` | Component exists |
| Save | Presumably `api.post(/association/message-templates)` | **Unverified — no API call confirmed in audit** |
| Use in compose | Link from template to compose | **Not confirmed — no cross-navigation found** |

**GAP 5 — Template → Compose integration unverified (P2):** The backend provides `POST /association/message-templates/:templateId/preview` for rendering with merge fields. No frontend code was found confirming this endpoint is called. The template split-editor component exists (`template-split-editor.tsx`) but its API wiring is unverified.

**GAP 6 — No E2E for template CRUD (P2):** [E2E GAP] Zero E2E tests cover template creation, preview, or use-in-compose flow.

---

## 07-4. Member — Announcement Consumption Journey

### Expected journey
`Dashboard widget` → `Announcements list` → `Detail view` → `Back to list`

### Actual frontend coverage

| Step | Route | API call | Status |
|------|-------|----------|--------|
| Dashboard widget | `features/dashboard/components/org-announcements.tsx` | Unknown — not fully audited | Partial |
| Announcements list | `org/$orgSlug/announcements/index.tsx` | `GET /communications/announcements/${orgId}?status=sent` | OK |
| Detail view | `org/$orgSlug/announcements/$announcementId.tsx` | `GET /communications/announcements/detail/${announcementId}` | OK |
| Back navigation | `navigate({ to: -1 })` | n/a | OK |

**No dead ends** in the member announcement journey. The path is linear and functional.

**Note:** Members receive only `status=sent` announcements. Draft and scheduled announcements are correctly hidden. No misalignment found.

**GAP 7 — No unread/read tracking (P3):** The backend returns announcements but no "mark as read" endpoint exists. Members cannot distinguish read from unread announcements. Not a broken journey, but a missing engagement feature.

---

## 07-5. Member — Chat and DM Journey

### Expected journey
`Messages tab` → `Select channel or start DM` → `Chat view with WebSocket` → `Send message` → `Optional: join video call`

### Actual frontend coverage

| Step | Route | API / WS call | Status |
|------|-------|--------------|--------|
| Messages list | `org/$orgSlug/messages/index.tsx` | `getPersonOptions` (SDK) + `ChannelList` component | OK |
| Select channel | `ChannelList` → sets `activeRoomId` | `GET /comms/chat-rooms` | OK |
| DM tab | Link to `messages/dm/` | `DmList` component | OK |
| DM list | `org/$orgSlug/messages/dm/index.tsx` | `GET /comms/chat-rooms` (filtered) | OK |
| Chat view | `ChatView` component | WebSocket `/ws/comms/chat-rooms/:room` | OK |
| Send message | WebSocket `chat.message` event | WS publish | OK |
| Video call | `use-video-call.ts` hook | REST + WebRTC signaling over WS | OK |

**No dead ends** in the chat/DM journey. WebSocket handler enforces participant-only access correctly.

**GAP 8 — No E2E for chat or video (P1):** [E2E GAP] Zero E2E tests cover message sending, DM creation, video call join, or WebSocket reconnection. The entire real-time layer is untested end-to-end.

**GAP 9 — New DM initiation flow missing (P2):** Members can select existing DMs from `DmList`, but there is no UI for **starting a new DM** with a specific person (no "New DM" button wired to `POST /comms/chat-rooms`). The create endpoint exists on the backend but has no corresponding UI entry point visible in the audited routes.

---

## 07-6. Member — Notification Preferences Journey

### Expected journey
`Profile or Settings` → `Notification Preferences` → `Toggle topics` → `Save`

### Actual frontend coverage

A `notification-preferences.tsx` component exists in `features/communications/components/`. Backend endpoints exist for subscription topics and bulk updates. No route was found that surfaces this component as a navigable page.

**GAP 10 — Notification preferences unreachable (P2):** [LIKELY BUG] The `notification-preferences.tsx` component exists but no route exposes it. Members cannot discover or modify their notification preferences through any linked navigation path found in this audit.

---

## 07-7. Admin — Platform Communications Journey

### Expected journey
`Admin dashboard` → `Communications` → `View email queue` → `Monitor flagged content` → `Send broadcast` → `View sent history`

### Actual frontend coverage

| Step | Route | Status |
|------|-------|--------|
| Platform broadcast | `admin/communications/index.tsx` | **Hardcoded fake stats — no API** |
| Platform templates | `admin/communications/templates.tsx` | **Empty shell — no API** |
| Email queue | `admin/communications/email.tsx` | **No API calls found** |
| Content moderation | `admin/communications/moderation.tsx` | **Placeholder UI — no API** |

**GAP 11 — Entire admin comms journey is non-functional (P1):** [LIKELY BUG] All four admin communications pages render static UI with no backend integration. Admin operators see fabricated numbers (`"34" broadcasts sent`, `"1,247" recipients`). No broadcast can actually be sent. No real email queue is displayed. This is a complete journey failure for the admin role.

---

## 07-8. Coordinator — Message and Segment Journey

### Expected journey
`Templates list` → `Create/Edit template` → `Compose message` → `Select segment` → `Schedule or send`

### Actual frontend coverage

The `communication/` sub-module endpoints (`/association/messages`, `/association/message-templates`, `/association/segments`) have backend handlers but **no corresponding frontend routes in either memberry or admin** were found during this audit.

**GAP 12 — Coordinator workflow entirely absent from frontend (P1):** Template CRUD, message scheduling, segment management, and subscription topic management are all backend-complete but frontend-invisible. The coordinator role has no usable UI journey.

---

## 07-9. Cross-Module Journey: Announcement → Email Queue → Delivery

### Expected flow
Officer publishes announcement → backend triggers email delivery → email appears in queue → delivery tracked

### Coverage status

| Step | Backend | Frontend |
|------|---------|----------|
| Publish announcement | `POST /communications/announcements/:id/publish` | OK (officer detail page) |
| Email dispatch | Assumed via email module handlers | Not audited here |
| Email queue monitoring | Admin `email.tsx` page | **No API — hardcoded** |
| Delivery stats on announcement | `stats.emailSent` on announcement object | Rendered in analytics but no real-time update |

**GAP 13 — No observable cross-module delivery chain (P2):** The publish action fires but officers cannot confirm delivery was actually triggered. The analytics stats (`emailSent`, `pushDelivered`) are sourced from the announcement object's `stats` field — it is unclear whether these stats are updated post-delivery or remain 0. No E2E test exercises the full publish → delivery chain.

---

## 07-10. Summary of Role Journey Gaps

| # | Gap | Role affected | Severity |
|---|-----|--------------|----------|
| 1 | Schedule flow ambiguity — create vs. dedicated schedule endpoint | Officer | P2 |
| 2 | No delete announcement UI (backend exists) | Officer | P2 |
| 3 | Sent history URL broken — wrong query format | Officer | P2 |
| 4 | Analytics client-side only — no server aggregation | Officer | P3 |
| 5 | Template → Compose integration unverified | Officer/Coordinator | P2 |
| 6 | Zero E2E for template CRUD | Officer | P2 |
| 7 | No read/unread tracking on announcements | Member | P3 |
| 8 | Zero E2E for chat, DM, and video call flows | Member | P1 |
| 9 | No "New DM" initiation UI | Member | P2 |
| 10 | Notification preferences component unreachable | Member | P2 |
| 11 | All admin communications pages non-functional | Admin | P1 |
| 12 | Coordinator workflow entirely absent from frontend | Coordinator | P1 |
| 13 | No observable publish → delivery chain | Officer/Admin | P2 |

---

## Gate 7

**GATE STATUS: FAIL**

P1 blockers:
- **GAP-8**: Zero E2E coverage for the entire real-time chat/video layer
- **GAP-11**: Admin communications pages are non-functional (hardcoded data, no API)
- **GAP-12**: Coordinator role has no usable frontend journey despite full backend implementation

These represent complete journey failures for two roles (admin, coordinator) and an untested critical path for members (real-time messaging).
