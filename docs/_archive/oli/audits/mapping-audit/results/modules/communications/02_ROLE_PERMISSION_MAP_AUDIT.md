# Audit 02 — Role/Permission Map Audit
## Module: Communications (Three Bounded Contexts)
**Date:** 2026-05-26
**Auditor:** Claude Code (automated)
**Scope:** `handlers/communication/` (28 handlers), `handlers/comms/` (11 handlers), `handlers/communications/` (EMPTY — routes only)

---

## Section 1: Role Inventory

### 1.1 Backend Roles Used Across All Three Sub-Modules

| Role Token | Scope | Sub-module(s) |
|---|---|---|
| `association:officer` | Org-scoped officer | communication (announcements CRUD/publish/archive/delete) |
| `association:member` | Org-scoped member | communication (listAnnouncements, getAnnouncement) |
| `admin` | Platform admin | communication (all message-template mutations, subscription-topic CUD, segments CUD, messages CUD) |
| `coordinator` | Platform coordinator | communication (message-template read/write, messages CUD, listPersonSubscriptions, listSegments) |
| `member:owner` | Self-ownership claim | communication (listPersonSubscriptions, updatePersonSubscription, bulkUpdatePersonSubscriptions) |
| `member` | Basic association member | communication (getSubscriptionTopic) |
| `user` | Any authenticated session | comms (all chat-room operations except endVideoCall) |
| `user:admin` | Chat-room admin | comms (endVideoCall only) |
| `super` | Platform super-admin | admin app frontend (broadcasts, templates, moderation) |
| `support` | Platform support | admin app frontend (broadcasts, moderation) |

### 1.2 Frontend Role Gates

| Location | Mechanism | Roles Allowed |
|---|---|---|
| Admin `/communications/` | `<RequireRole allowed={['super', 'support']}>` | super, support |
| Admin `/communications/templates` | `<RequireRole allowed={['super']}>` | super only |
| Admin `/communications/moderation` | `<RequireRole allowed={['super', 'support']}>` | super, support |
| Admin `/communications/email` | `<RequireRole allowed={['super', 'support', 'admin']}>` | all admin roles |
| Memberry officer routes | `_authenticated` layout only — no role gate | NONE (see §4) |
| Memberry member routes | `_authenticated` layout only — no role gate | NONE (see §4) |

---

## Section 2: Backend Permission Matrix — `communication/` (Templated Messaging)

### 2.1 Announcements

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| Create | POST | `/communications/announcements/:organizationId` | `association:officer` |
| List | GET | `/communications/announcements/:organizationId` | `association:member` |
| Get detail | GET | `/communications/announcements/detail/:id` | `association:member` |
| Update | PATCH | `/communications/announcements/:id` | `association:officer` |
| Delete | DELETE | `/communications/announcements/:id` | `association:officer` |
| Archive | POST | `/communications/announcements/:id/archive` | `association:officer` |
| Publish | POST | `/communications/announcements/:id/publish` | `association:officer` |

### 2.2 Message Templates

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| Create | POST | `/association/message-templates` | `admin`, `coordinator` |
| Search/List | GET | `/association/message-templates` | `admin`, `coordinator` |
| Get | GET | `/association/message-templates/:templateId` | `admin`, `coordinator` |
| Update | PATCH | `/association/message-templates/:templateId` | `admin`, `coordinator` |
| Delete | DELETE | `/association/message-templates/:templateId` | `admin` ONLY |
| Preview | POST | `/association/message-templates/:templateId/preview` | `admin`, `coordinator` |

**Note:** Delete is `admin`-only; all other operations allow `coordinator`. This asymmetry is intentional but not documented.

### 2.3 Scheduled Messages

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| Create | POST | `/association/messages` | `admin`, `coordinator` |
| Search | GET | `/association/messages` | `admin`, `coordinator` |
| Get | GET | `/association/messages/:messageId` | `admin`, `coordinator` |
| Update | PATCH | `/association/messages/:messageId` | `admin`, `coordinator` |
| Delete | DELETE | `/association/messages/:messageId` | `admin`, `coordinator` |
| Cancel | POST | `/association/messages/:messageId/cancel` | `admin`, `coordinator` |
| Schedule | POST | `/association/messages/:messageId/schedule` | `admin`, `coordinator` |
| Send | POST | `/association/messages/:messageId/send` | `admin`, `coordinator` |

### 2.4 Subscription Topics

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| Create | POST | `/association/subscription-topics` | `admin` ONLY |
| Get | GET | `/association/subscription-topics/:topicId` | `admin`, `coordinator`, `member` |
| Update | PATCH | `/association/subscription-topics/:topicId` | `admin` ONLY |
| Delete | DELETE | `/association/subscription-topics/:topicId` | `admin` ONLY |

### 2.5 Person Subscriptions (Member Preferences)

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| List | GET | `/association/person-subscriptions` | `admin`, `coordinator`, `member:owner` |
| Bulk Update | POST | `/association/person-subscriptions/bulk-update` | `admin`, `member:owner` |
| Update Single | PATCH | `/association/person-subscriptions/:subscriptionId` | `admin`, `member:owner` |

### 2.6 Saved Segments

| Operation | HTTP | Route | Required Role (Generated) | Role (Hand-wired) |
|---|---|---|---|---|
| Create | POST | `/communications/segments` | `admin`, `coordinator` | `authMiddleware()` — **no roles** |
| List | GET | `/communications/segments` | `admin`, `coordinator` | `authMiddleware()` — **no roles** |
| Delete | DELETE | `/communications/segments/:id` | `admin`, `coordinator` | `authMiddleware()` — **no roles** |

**[LIKELY BUG] P1 — Duplicate route conflict:** Both `app.ts` (hand-wired, Wave 4β) and `generated/openapi/routes.ts` register the same three `/communications/segments` routes. The generated routes require `admin`/`coordinator`; the hand-wired routes use bare `authMiddleware()` (any authenticated user). Whichever is registered last wins. If the hand-wired routes land after generated, any authenticated user can create/delete segments. Route registration order in `app.ts` determines which handler wins — this must be verified and the hand-wired routes removed.

---

## Section 3: Backend Permission Matrix — `comms/` (Real-Time Chat + Video)

### 3.1 Chat Rooms

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| Create room | POST | `/comms/chat-rooms` | `user` |
| List rooms | GET | `/comms/chat-rooms` | `user` |
| Get room | GET | `/comms/chat-rooms/:room` | `user` |
| Get messages | GET | `/comms/chat-rooms/:room/messages` | `user` |
| Send message | POST | `/comms/chat-rooms/:room/messages` | `user` |
| WebSocket connect | WS | `/comms/chat-rooms/:room/ws` | (registry, auth mechanism TBD) |

### 3.2 Video Calls

| Operation | HTTP | Route | Required Role |
|---|---|---|---|
| Join | POST | `/comms/chat-rooms/:room/video-call/join` | `user` |
| Leave | POST | `/comms/chat-rooms/:room/video-call/leave` | `user` |
| Update participant | PATCH | `/comms/chat-rooms/:room/video-call/participant` | `user` |
| **End call** | **POST** | `/comms/chat-rooms/:room/video-call/end` | **`user:admin` ONLY** |
| ICE servers | GET | `/comms/ice-servers` | `user` |

---

## Section 4: Frontend vs Backend Alignment Analysis

### 4.1 Officer Routes — No Frontend Role Enforcement [LIKELY BUG] P1

**Finding:** The officer communications layout route (`/officer/communications.tsx`) is a bare `<Outlet />` with zero role checking:

```tsx
export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/communications')({
  component: () => <Outlet />,
})
```

There is no `RequireRole`, no `useOfficer` hook, no `beforeLoad` guard. Any authenticated member who navigates directly to `/org/X/officer/communications` will see the officer UI. The backend will reject API calls with 403, but the frontend will render forms and empty states, not a proper access-denied experience.

**Severity:** P1 — UX security gap. Member sees officer UI shell before any API call fails.

### 4.2 Member Announcement Routes — No Org-Member Validation [NEEDS PRODUCT DECISION]

The member announcements list (`/announcements/index.tsx`) calls `GET /communications/announcements/:organizationId` which requires `association:member`. The backend enforces org membership at the API level. The frontend does not pre-check whether the user is a member of the current org before rendering. If a non-member somehow navigates to the org slug, they get a 403 from the API and see an empty list — no explicit "you are not a member" message.

### 4.3 Message Templates — Alignment Mismatch [LIKELY BUG] P2

The officer templates route at `/officer/communications/templates/` calls the backend at `/association/message-templates` which requires `admin` or `coordinator` — **not** `association:officer`. An officer who is not also an `admin`/`coordinator` will get a 403 when loading or saving templates, even though the frontend nav links directly to the templates page from the officer sidebar.

**Severity:** P2 — Officer can navigate to templates page; all API calls fail silently.

### 4.4 Admin App — Correct Alignment

Admin app routes use `<RequireRole>` correctly. Role gates match intended personas:
- Broadcasts + Moderation: `super`, `support`
- Templates: `super` only (more restrictive — intentional)
- Email health: broader (`super`, `support`, `admin`)

### 4.5 Chat Room Participant Enforcement [NEEDS PRODUCT DECISION]

The `comms/` handler schema has a `chatRoomMember.repo.ts` — the data model supports room membership. However, the generated routes use the permissive `user` role for all chat operations (read messages, send messages). It is unclear whether the repository layer enforces that the caller is an actual member of the room before returning messages or allowing sends. If not, any authenticated user can read/post to any chat room by ID.

**Severity:** P2 — Requires handler-level audit to confirm.

---

## Section 5: Org-Scoping Analysis

### 5.1 Announcements — Correctly Org-Scoped

`listAnnouncements` accepts `:organizationId` as a path param and the repo filters by it (`repo.list(params.organizationId, ...)`). Org isolation is enforced at the database layer.

### 5.2 Message Templates — NOT Org-Scoped [NEEDS PRODUCT DECISION]

Routes at `/association/message-templates` take no org param. Templates appear to be platform-wide (admin/coordinator scope). Officers browsing templates via the memberry frontend are reading platform-level templates, not org-specific ones. This is likely by design (shared template library), but the officer UI does not communicate this distinction to the user.

### 5.3 Saved Segments — NOT Org-Scoped [NEEDS PRODUCT DECISION]

`/communications/segments` has no org param in the route or generated validators. Segments are platform-wide audience presets. If the intent is org-specific audience segments (e.g., "all members of org X"), the missing org scoping is a data isolation bug.

### 5.4 Chat Rooms — Org-Scoping Unknown [NEEDS PRODUCT DECISION]

`/comms/chat-rooms` list endpoint accepts a query param (from `ListChatRoomsQuery` validator). Whether org filtering is required or optional is unverified. A user could potentially list rooms across orgs if no filter is enforced.

---

## Section 6: Role Escalation and Boundary Risks

| Risk | Severity | Detail |
|---|---|---|
| Segment route conflict (hand-wired vs generated) | P1 | Any authenticated user may bypass `admin`/`coordinator` guard on segments |
| Officer UI rendered for non-officers | P1 | No frontend guard on officer communications layout |
| Officer cannot use template API | P2 | Templates require `admin`/`coordinator`; officers get 403 |
| Chat room participant enforcement unknown | P2 | `user` role allows any authenticated user to access any room by ID |
| `deleteMessageTemplate` requires `admin` not `coordinator` | P3 | Asymmetry may surprise coordinators; no UI feedback |
| `member:owner` self-check | P3 | Backend checks `member:owner` but no UI validates this ownership before calling |

---

## Section 7: WebSocket Authentication

The WebSocket handler `ws.chat-room.ts` is registered via `services/api-ts/src/generated/websocket/registry.ts`. The `comms/*` REST prefix is included in the `authMiddleware` prefix list (`app.ts` line 255), but WebSocket upgrade auth is a separate concern — the WS handshake may not go through the same middleware chain. [NEEDS PRODUCT DECISION] — WebSocket auth mechanism must be confirmed separately.

---

## Section 8: `handlers/communications/` — Empty Directory

The directory `services/api-ts/src/handlers/communications/` does not exist on disk. All routes under `/communications/announcements/*` and `/communications/segments/*` are handled by handlers in `handlers/communication/` (singular), registered via the generated `routes.ts`. The naming inconsistency (plural directory for routes, singular directory for handlers) is a source of confusion but not a functional bug. [NEEDS PRODUCT DECISION] — The generated routes file uses `/communications/` prefix; handler implementations live in `/communication/`. A developer may accidentally create a `communications/` handler directory thinking it's the right place.

---

## Section 9: Survey and Professional Feed — No Frontend Exposure

Handlers exist for:
- Surveys (`createSurvey`, `listSurveys`, `getSurveyResults`, `submitSurveyResponse`)
- Polls (`createPoll`, `votePoll`)
- Professional Feed (`createFeedPost`, `listFeedPosts`, `getFeedPost`, `deleteFeedPost`, `reportFeedPost`, `muteAuthor`)

None of these have routes in the generated `routes.ts` for the `comms/` or `communications/` prefixes — they appear under `/surveys/` (confirmed from route scan). No memberry frontend routes expose surveys or professional feed. Role permissions for these handlers are unverified (not in generated routes). [E2E GAP] — No E2E coverage for survey submit, poll vote, or feed post flows.

---

## Section 10: Role Consistency Across Sub-Modules

| Concern | Finding |
|---|---|
| `association:officer` vs `admin`/`coordinator` | Announcements use org-role (`association:officer`); templates/messages use platform-roles (`admin`/`coordinator`). These are different role namespaces. Officers cannot manage templates without being promoted to platform `admin`/`coordinator`. |
| `user` vs `association:member` for chat | Chat uses generic `user` (any authenticated person); announcements use `association:member` (org-scoped). A person with no org membership can join chat rooms. |
| `member` vs `member:owner` | Subscription topics use bare `member` for GET; subscriptions use `member:owner` for mutations. The distinction is correct but inconsistent in naming style. |

---

## Section 11: Missing Role Guards Summary

| Route/Component | Missing Guard | Recommended Fix |
|---|---|---|
| `/officer/communications.tsx` layout | No role check | Add `beforeLoad` with officer role assertion or `RequireRole` wrapper |
| All officer sub-routes (new, sent, analytics, templates, `$announcementId`) | No role check — inherited from unguarded layout | Fix via layout guard (cascades) |
| `/org/$orgSlug/officer/messages/` | No role check | Same — officer layout must guard |
| `/communications/segments` hand-wired routes | Wrong auth (bare `authMiddleware()`) | Remove hand-wired routes; rely on generated routes with proper roles |

---

## Section 12: Test Coverage for Permissions

| Test File | What It Covers | Quality |
|---|---|---|
| `role-boundaries.spec.ts` | Member cannot access officer dashboard, members, finances | MEDIUM — communications access is tested (redirect/403 check) but is soft (accepts either redirect OR forbidden text) |
| `communications-states.spec.ts` | Officer sees UI, member gets blocked | WEAK — permission test only checks URL or text, not actual API 403 |
| No test | Template API called by officer without `admin`/`coordinator` role | GAP |
| No test | Segment route conflict — which registration wins | GAP |
| No test | Chat room accessed by non-member of room | GAP |
| No test | WebSocket auth | GAP |

---

## Gate 2: Role/Permission Map Gate

| Criterion | Status |
|---|---|
| All backend roles documented | PASS |
| Frontend role gates mapped | PASS |
| Org-scoping verified | PARTIAL — templates and segments lack org scoping (may be by design) |
| Escalation risks identified | PASS — 6 risks documented |
| Frontend/backend alignment verified | FAIL — officer UI has no frontend role guard (P1) |
| Duplicate route conflict identified | FAIL — segments hand-wired vs generated (P1) |

**Gate 2 result: FAIL (2 P1 blockers)**

### P1 Blockers
1. **Segment route conflict** — hand-wired `authMiddleware()` may override generated `admin`/`coordinator` guard
2. **Officer layout has no role gate** — any authenticated user can render officer communications UI

### P2 Issues
3. **Template API mismatch** — officer frontend links to templates requiring `admin`/`coordinator`
4. **Chat room participant enforcement unconfirmed**

### P3 / Product Decisions
5. Template org-scoping (platform vs org-level)
6. Segment org-scoping
7. Chat room org-scoping
8. WebSocket auth mechanism
9. Empty `handlers/communications/` directory naming confusion
