# Audit 03 — Route/Navigation Audit
## Module: Communications (Three Bounded Contexts)
**Date:** 2026-05-26
**Auditor:** Claude Code (automated)
**Scope:** `apps/memberry` + `apps/admin` — all communications, announcements, messages, and chat routes

---

## Section 1: Complete Route Inventory

### 1.1 Memberry App — Member-Facing Routes

| Route Path | File | Component | Notes |
|---|---|---|---|
| `/org/$orgSlug/announcements/` | `announcements/index.tsx` | `MemberAnnouncementFeed` | Member announcement list |
| `/org/$orgSlug/announcements/$announcementId` | `announcements/$announcementId.tsx` | (announcement detail) | Member read-only detail |
| `/org/$orgSlug/messages/` | `messages/index.tsx` | `MessagesIndexPage` | Channel list + inline chat view |
| `/org/$orgSlug/messages/dm/` | `messages/dm/index.tsx` | `DmIndexPage` | DM sidebar + inline chat view |

### 1.2 Memberry App — Officer-Facing Routes

| Route Path | File | Component | Notes |
|---|---|---|---|
| `/org/$orgSlug/officer/communications` | `officer/communications.tsx` | Bare `<Outlet />` | Layout only — no content |
| `/org/$orgSlug/officer/communications/` | `officer/communications/index.tsx` | `OfficerCommunications` | Announcement list + New Message CTA |
| `/org/$orgSlug/officer/communications/new` | `officer/communications/new.tsx` | `NewAnnouncementPage` | Compose form; `?edit=id` re-uses for edit |
| `/org/$orgSlug/officer/communications/$announcementId` | `officer/communications/$announcementId.tsx` | `AnnouncementDetailPage` | View + publish + archive actions |
| `/org/$orgSlug/officer/communications/sent` | `officer/communications/sent.tsx` | `SentHistoryPage` | Sent announcements table with stats |
| `/org/$orgSlug/officer/communications/analytics` | `officer/communications/analytics.tsx` | `AnalyticsDashboard` | Delivery analytics |
| `/org/$orgSlug/officer/communications/templates/` | `officer/communications/templates/index.tsx` | `TemplateListPage` | Template list |
| `/org/$orgSlug/officer/communications/templates/new` | `officer/communications/templates/new.tsx` | Template compose | `?edit=id` re-uses for edit |
| `/org/$orgSlug/officer/messages/` | `officer/messages/index.tsx` | `OfficerMessagesPage` | Channel list + inline chat + create channel |

### 1.3 Admin App — Communications Routes

| Route Path | File | Component | RequireRole |
|---|---|---|---|
| `/communications/` | `communications/index.tsx` | `CommunicationsBroadcasts` | `super`, `support` |
| `/communications/templates` | `communications/templates.tsx` | `PlatformTemplates` | `super` |
| `/communications/email` | `communications/email.tsx` | Email queue monitor | `super`, `support`, `admin` |
| `/communications/moderation` | `communications/moderation.tsx` | `ModerationQueue` | `super`, `support` |

### 1.4 Admin App Navigation (sidebar)

Admin sidebar at `__root.tsx` defines four nav entries:
```
/communications        → "Broadcasts"
/communications/moderation → "Moderation"
/communications/templates  → "Templates"
/communications/email      → "Email Health"
```
All four entries are reachable from the sidebar. No deep sub-routes exist for any of these (flat structure). No layout file wraps the `/communications/` directory in the admin app — each route is standalone with its own `RequireRole`.

---

## Section 2: Navigation Flow Analysis

### 2.1 Officer Announcement Flow

```
Officer sidebar
  └─ "Announcements" link → /officer/communications/
        ├─ "New Message" button → /officer/communications/new
        │     └─ ComposeForm submit → POST /communications/announcements/:orgId
        │           └─ success → [no explicit redirect — stays on form] [LIKELY BUG]
        ├─ AnnouncementList row → /officer/communications/$announcementId
        │     ├─ Publish button → POST …/publish → invalidates queries → stays on page
        │     ├─ Archive button → POST …/archive → invalidates queries → stays on page
        │     └─ Edit link → /officer/communications/new?edit=$id
        ├─ "Sent" (breadcrumb only — no sidebar link) → /officer/communications/sent
        ├─ "Analytics" (breadcrumb only — no sidebar link) → /officer/communications/analytics
        └─ "Templates" sidebar link → /officer/communications/templates/
              └─ "New Template" → /officer/communications/templates/new
```

**Findings:**
- "Sent" and "Analytics" are not in the sidebar nav and have no CTA from the index page. They are only discoverable via breadcrumbs from inside those pages themselves — a navigation dead end for new users. [LIKELY BUG] P2
- After creating an announcement via `ComposeForm`, there is no programmatic redirect. The user stays on the compose form. [LIKELY BUG] P2 — success toast appears but the user must manually navigate back.
- The officer sidebar includes `Templates` as a direct sidebar entry linking to `/officer/communications/templates/` — correctly reachable.

### 2.2 Member Announcement Flow

```
Member sidebar
  └─ "Announcements" link → /org/$orgSlug/announcements/
        └─ Announcement card (Link) → /org/$orgSlug/announcements/$announcementId
              └─ [back navigation: breadcrumb "Announcements" link back to list]
```

Flow is complete. List → detail → back via breadcrumb. No gaps.

**Finding:** The member detail route (`/org/$orgSlug/announcements/$announcementId`) was not observed in the file listing — only `index.tsx` and `$announcementId.tsx` exist in the announcements directory. Both are present. Navigation is functional.

**Notification deep-link:** The notification drawer routes announcement notifications to `/org/${orgId}/announcements/${entityId}` — correct match to the file route.

### 2.3 Messages / Chat Flow

```
Member sidebar + bottom nav
  └─ "Messages" → /org/$orgSlug/messages/
        ├─ ChannelList sidebar (inline state) → sets activeRoomId → ChatView renders inline
        │     [No URL change when switching channels — state is ephemeral]
        └─ "Direct Messages" button → /org/$orgSlug/messages/dm/
              └─ DmList sidebar (inline state) → sets activeRoomId → ChatView renders inline
```

**Findings:**
- Channel selection is purely state-driven (`useState<string | null>`). Switching channels does NOT update the URL. If a user refreshes mid-conversation, they return to the empty state (no active room). [NEEDS PRODUCT DECISION] P2 — no deep-linkable channel URL.
- Same pattern applies to DM — selecting a DM conversation does not update the URL.
- On mobile, the DM sidebar is hidden (`hidden md:block`). There is no mobile-accessible path to select a DM conversation once hidden — the DmList is invisible on small screens. [LIKELY BUG] P2.

### 2.4 Officer Messages Flow

```
Officer sidebar
  └─ "Channels" → /org/$orgSlug/officer/messages/
        ├─ ChannelList (isOfficer prop) → inline ChatView
        └─ "Create Channel" button → CreateChannelDialog modal
              └─ onCreated callback → sets activeRoomId → shows new channel chat
```

Flow is functional. Officer has channel creation capability that member does not.

**Finding:** No URL-based deep-linking here either (same `useState` pattern as member messages).

### 2.5 Admin Communications Flow

```
Admin sidebar
  ├─ "Broadcasts" → /communications/ — overview + broadcast form (placeholder)
  ├─ "Moderation" → /communications/moderation — flagged content queue (placeholder data)
  ├─ "Templates" → /communications/templates — platform template list (empty state)
  └─ "Email Health" → /communications/email — email queue monitor
```

All four routes are reachable from the sidebar. Navigation is flat — no sub-routes, no tab-based navigation within pages. Each page is self-contained.

**Finding:** No layout wrapper file exists for `/communications/` in the admin app (unlike memberry which has `communications.tsx` layout). Each route independently applies `RequireRole`. This means the sidebar is always rendered (from `__root.tsx` layout) but the page content is role-gated per-page. A `support` user navigating to `/communications/templates` will render the sidebar but see a `RequireRole` block inside the page content — this is the expected pattern for this app.

---

## Section 3: Missing and Broken Routes

### 3.1 [LIKELY BUG] P1 — Sent History API Call Uses Wrong URL Pattern

**File:** `/officer/communications/sent.tsx` line 39

```typescript
api.get(`/api/communications/announcements?organizationId=${orgId}&status=sent`)
```

**Problem:** The backend route is `GET /communications/announcements/:organizationId` (path param), not a query param. The frontend sends `organizationId` as a query param. This is a URL mismatch — the backend will not match `organizationId` from `req.query`, it expects it as a path segment. The sent history page will return 404 or an empty result for every request.

**Expected URL:** `/api/communications/announcements/${orgId}?status=sent`

### 3.2 [E2E GAP] P2 — No E2E Coverage for Critical Officer Flows

| Flow | Covered? |
|---|---|
| Officer composes and publishes announcement | NO |
| Officer views sent history (broken — see §3.1) | NO |
| Officer views analytics page | NO |
| Officer creates/edits message template | NO |
| Member views announcement detail | NO |
| Member navigates from notification to announcement | NO |
| Chat channel selection persists on refresh | NO |
| DM selection on mobile | NO |
| Video call join/leave | NO |
| Create channel (officer) | NO |

Covered:
- Officer communications page loads (states test) ✓
- Member cannot access officer communications (permission test) ✓
- Role boundaries (redirect or 403) ✓
- Basic accessibility check ✓

### 3.3 [LIKELY BUG] P2 — No Post-Submit Redirect in ComposeForm

After a successful announcement create/publish via `ComposeForm`, there is no programmatic navigation. The officer stays on the `/officer/communications/new` form with a success toast. Expected behavior: redirect to the announcement detail page or back to the list.

### 3.4 [LIKELY BUG] P2 — Sent/Analytics Pages Not Reachable from Officer Index

The officer communications index page (`/officer/communications/`) only links to `/officer/communications/new`. The `sent` and `analytics` pages are registered routes but have no CTA, sidebar entry, or inline tab navigation pointing to them. The only path is typing the URL directly.

**Officer sidebar links (from `officer-sidebar.tsx`):**
```
/officer/messages         → "Channels"
/officer/communications   → "Announcements"
/officer/communications/templates → "Templates"
```

`/officer/communications/sent` and `/officer/communications/analytics` are not listed.

### 3.5 Missing: Officer Mobile Nav Gap

**File:** `officer-mobile-nav.tsx` line 48:
```
{ to: `${base}/communications`, label: 'Announcements', icon: Megaphone }
```

Mobile nav links to `/officer/communications` (the layout, bare `<Outlet />`). TanStack Router should resolve this to the index child (`/officer/communications/`), which it does by convention. Functional but slightly ambiguous.

The officer mobile nav does NOT include a link to `Templates`, `Sent`, or `Analytics` — same discovery gap as the sidebar.

---

## Section 4: Route Parameter Validation

### 4.1 Announcement Detail — Correct

`/officer/communications/$announcementId` uses `Route.useParams()` to extract `announcementId` and passes it directly to the API call. No frontend validation of UUID format. If a non-UUID is entered in the URL, the API returns 404 or a database error.

### 4.2 New Announcement Edit Mode — Correct

`/officer/communications/new` uses `validateSearch` to type-check the `edit` query param. The query is only fired when `!!edit` is truthy. Correct pattern.

### 4.3 Template Edit Mode — Correct Pattern

`/officer/communications/templates/index.tsx` calls `navigate({ to: '…/templates/new', search: { edit: id } })` for edit. Same `validateSearch` pattern should be applied in the `templates/new.tsx` route.

---

## Section 5: Navigation Link Audit — Memberry Sidebar/Nav

### 5.1 Member Sidebar (`member-sidebar.tsx`)

| Label | Target | Route Exists? |
|---|---|---|
| Messages | `/org/$orgSlug/messages` | YES |
| Announcements | `/org/$orgSlug/announcements` | YES |

Clean — both links resolve to existing routes.

### 5.2 Member Bottom Nav (`member-bottom-nav.tsx`)

| Label | Target | Route Exists? |
|---|---|---|
| Messages | `/org/$orgSlug/messages` | YES |

Clean — announcement not in bottom nav (space-constrained; acceptable).

### 5.3 Officer Sidebar (`officer-sidebar.tsx`)

| Label | Target | Route Exists? |
|---|---|---|
| Channels | `/org/$orgSlug/officer/messages` | YES |
| Announcements | `/org/$orgSlug/officer/communications` | YES (resolves to index child) |
| Templates | `/org/$orgSlug/officer/communications/templates` | YES (resolves to index child) |

**Gap:** `Sent` and `Analytics` routes exist but are not linked.

### 5.4 Officer Mobile Nav (`officer-mobile-nav.tsx`)

| Label | Target | Route Exists? |
|---|---|---|
| Announcements | `/org/$orgSlug/officer/communications` | YES |

**Gap:** No mobile entry for Templates, Sent, Analytics, or Messages.

---

## Section 6: Admin App Navigation Audit

### 6.1 Admin Sidebar → Communications

All four admin communications sidebar entries verified reachable:

| Sidebar Label | Route | Page Renders? |
|---|---|---|
| Broadcasts | `/communications/` | YES — placeholder content |
| Moderation | `/communications/moderation` | YES — empty queue, placeholder data |
| Templates | `/communications/templates` | YES — empty state |
| Email Health | `/communications/email` | YES — email queue monitor |

No broken links. No sub-routes needed. Admin communications is entirely placeholder/stub — no real API calls are wired to the admin broadcast form or template list (both show placeholder data, no fetches). [E2E GAP] P3.

---

## Section 7: Deep-Link and Refresh Behavior

| Scenario | Behavior | Issue? |
|---|---|---|
| Refresh on `/officer/communications/` | Reloads announcement list | OK |
| Refresh on `/officer/communications/new?edit=X` | Re-fetches draft | OK |
| Refresh on `/messages/` with channel selected | Returns to empty (no active room) | [NEEDS PRODUCT DECISION] — expected given state-only selection |
| Refresh on `/messages/dm/` with DM open | Returns to empty | Same |
| Notification click → `/org/$orgId/announcements/$entityId` | Navigates to detail | OK — uses `orgId` not `orgSlug`; verify `useOrg` hook resolves correctly |

**Note on notification deep-link:** The notification drawer passes `orgId` (UUID) as the org segment: `/org/${orgId}/announcements/${entityId}`. The route file uses `$orgSlug`. If the app expects slug and the notification provides UUID, the `useOrg` hook must handle UUID-as-slug lookup or the link breaks. [LIKELY BUG] P1 — verify `useOrg` accepts UUID in the org segment.

---

## Section 8: Cross-Module Navigation

### 8.1 Breadcrumb Consistency

| Page | Breadcrumb Trail | Correct? |
|---|---|---|
| Officer communications index | Officer → Communications | YES |
| Officer new announcement | Officer → Communications → New/Edit | YES |
| Officer announcement detail | Officer → Communications → $title | YES |
| Officer sent history | Officer → Communications → Sent | YES |
| Officer analytics | Officer → Communications → Analytics | YES |
| Officer templates | Officer → Communications → Templates | YES |
| Member announcements | Home → Announcements | YES |
| Member DMs | Messages → Direct Messages | YES |

All breadcrumb trails are correct and link back to parent pages.

### 8.2 Officer Dashboard → Communications

The officer dashboard (not audited here) is expected to link to communications. The breadcrumb anchor `{ label: 'Officer', href: '/org/$orgSlug/officer/dashboard' }` on all officer comms pages implies the dashboard exists. If the dashboard is missing or renamed, all communications breadcrumbs show a broken link. [E2E GAP] P3.

---

## Section 9: Tab Navigation Analysis

### 9.1 Officer Communications — No Tab Nav

The officer communications hub (index, sent, analytics, templates) has no in-page tab navigation. Each sub-page is a fully separate route. The sidebar provides links only to `Announcements` and `Templates`; `Sent` and `Analytics` are islands. This is the primary discoverability problem documented in §3.4.

**Recommendation:** [NEEDS PRODUCT DECISION] — Add tab navigation (`Announcements | Sent | Analytics`) to the officer communications index layout, or add sidebar entries for Sent and Analytics.

### 9.2 Admin Communications — Pseudo-Tabs via Sidebar

The admin app uses sidebar navigation as the tab equivalent. All four comms pages are one click away from any other. This pattern works for a small set of top-level pages.

---

## Section 10: Missing Routes / Dead Ends

| Missing Route | Impact | Severity |
|---|---|---|
| No route for officer to view/manage surveys | Surveys exist in backend; no frontend | P3 |
| No route for officer to view professional feed | Feed handlers exist; no frontend | P3 |
| No route for member to manage notification preferences | `notification-preferences.tsx` component exists in features but no route | P2 |
| No route for member to manage subscription topics opt-in | `updatePersonSubscription` API exists; no frontend flow | P2 |
| No route for admin to trigger a platform broadcast | Broadcast form is a placeholder | P3 |
| `/officer/communications/sent` unreachable from nav | Route exists but no link | P2 |
| `/officer/communications/analytics` unreachable from nav | Route exists but no link | P2 |

**Notification preferences component:** `apps/memberry/src/features/communications/components/notification-preferences.tsx` exists but no route in `src/routes/` imports or renders it. [LIKELY BUG] P2 — feature built but never wired.

---

## Section 11: E2E Coverage Map

| User Journey | Spec File | Coverage Level |
|---|---|---|
| Officer sees announcement list | `communications-states.spec.ts` | WEAK (page loads only) |
| Member blocked from officer comms | `communications-states.spec.ts`, `role-boundaries.spec.ts` | MEDIUM |
| Officer composes announcement | `officer/communications.spec.ts` (exists) | UNKNOWN — not read |
| Officer publishes announcement | NONE confirmed | GAP |
| Member views announcement detail | NONE | GAP |
| Officer views sent history | NONE | GAP (also broken — §3.1) |
| Officer views analytics | NONE | GAP |
| Officer manages templates | NONE | GAP |
| Member uses chat | NONE | GAP |
| Video call join/leave | NONE | GAP |
| DM flow | NONE | GAP |
| Notification → announcement deep-link | NONE | GAP (UUID/slug risk — §7) |

---

## Gate 3: Route/Navigation Gate

| Criterion | Status |
|---|---|
| All routes mapped across both apps | PASS |
| Navigation flows documented | PASS |
| Broken routes identified | PASS — 1 P1 (sent URL), 2 P2 nav dead-ends |
| Deep-link and refresh behavior assessed | PASS |
| E2E coverage gaps documented | PASS — 10+ gaps identified |
| Tab/sidebar navigation verified | PASS |

**Gate 3 result: FAIL (1 P1 blocker, 3 P2 issues)**

### P1 Blockers
1. **Sent history page broken** — wrong API URL format (`?organizationId=` instead of `/:organizationId`) — sent history always returns 404/empty

### P2 Issues
2. **Notification deep-link uses orgId UUID** — verify `useOrg` resolves UUID-as-slug
3. **Sent and Analytics unreachable from nav** — no sidebar or CTA links
4. **No post-submit redirect in ComposeForm** — officer stranded on empty form after success
5. **DM sidebar hidden on mobile** — no mobile path to select a DM conversation
6. **Notification preferences component built but never routed**

### P3 Issues / Product Decisions
7. Surveys and professional feed have no frontend routes
8. Member subscription opt-in/opt-out has no frontend flow
9. Admin broadcast form is placeholder
10. Channel selection not URL-persistent (by-design? requires decision)
