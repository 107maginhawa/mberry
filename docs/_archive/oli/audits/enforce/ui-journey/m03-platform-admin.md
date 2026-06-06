# UI Journey Audit: m03-platform-admin (Admin App)

**Audited:** 2026-05-27
**Auditor:** oli-ui-journey
**App:** `apps/admin` (port 3003)
**Route files:** 22 TSX files across 10 route directories
**Spec refs:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md

---

## R1 — Action Registry

Every interactive element across all admin routes, classified by type and wiring status.

### Dashboard (`/`) — `routes/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-001 | Refresh button | button | YES | `window.location.reload()` |
| J-M03-002 | Quick Action: Manage Operators | link | YES | `/operators` |
| J-M03-003 | Quick Action: Feature Flags | link | YES | `/feature-flags` |
| J-M03-004 | Quick Action: Impersonate User | link | YES | `/impersonate` |
| J-M03-005 | Quick Action: Member Lookup | link | YES | `/members` |
| J-M03-006 | View all audit link | link | YES | `/audit` |

### Associations List (`/associations`) — `routes/associations/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-010 | Create Association button | button | YES | opens CreateAssociationDialog |
| J-M03-011 | Create form submit | form | YES | `createAssociationMutation` via SDK |
| J-M03-012 | Association name link (row) | link | YES | `/associations/$associationId` |
| J-M03-013 | View link (row action) | link | YES | `/associations/$associationId` |

### Association Detail (`/associations/$associationId`) — `routes/associations/$associationId.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-020 | Back to Associations | link | YES | `/associations` |
| J-M03-021 | Edit Association button | button | YES | opens inline edit dialog |
| J-M03-022 | Delete button | button | YES | opens confirm dialog |
| J-M03-023 | Edit form submit | form | YES | `updateAssociationMutation` via SDK |
| J-M03-024 | Delete confirm | button | YES | `deleteAssociationMutation` via SDK |
| J-M03-025 | Add Organization button | button | **NO** | no onClick handler, no mutation |
| J-M03-026 | Org name link (row) | link | YES | `/organizations/$organizationId` |
| J-M03-027 | View National Dashboard link | link | YES | `/national-dashboard` |

### Organizations List (`/organizations`) — `routes/organizations/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-030 | Org name link (row) | link | YES | `/organizations/$organizationId` |
| J-M03-031 | View link (row action) | link | YES | `/organizations/$organizationId` |

### Organization Detail (`/organizations/$organizationId`) — `routes/organizations/$organizationId.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-040 | Back to Organizations | link | YES | `/organizations` |
| J-M03-041 | Edit Organization button | button | **NO** | no onClick handler, no mutation |
| J-M03-042 | Activate button | button | **NO** | no onClick handler — renders `<Button>` with no action |
| J-M03-043 | Suspend button | button | **NO** | no onClick handler — renders `<Button>` with no action |
| J-M03-044 | Archive button | button | **NO** | no onClick handler — renders `<Button>` with no action |
| J-M03-045 | Member row "Actions" column | text | **NO** | hardcoded `--` in every row |

### Operators (`/operators`) — `routes/operators/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-050 | Invite Operator button | button | YES | opens InviteDialog |
| J-M03-051 | Invite form submit | form | YES | `inviteAdminMutation` via SDK |
| J-M03-052 | Revoke button (trash icon) | button | YES | sets `revokeTarget` state |
| J-M03-053 | Revoke confirm "Yes" | button | YES | `revokeAdminMutation` via SDK |
| J-M03-054 | Revoke cancel "No" | button | YES | clears `revokeTarget` |

### Feature Flags (`/feature-flags`) — `routes/feature-flags/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-060 | Create Flag button | button | YES | opens CreateFlagDialog |
| J-M03-061 | Create form submit | button | YES | `setFeatureFlagMutation` via SDK |
| J-M03-062 | Delete flag button (trash) | button | YES | `deleteFeatureFlagMutation` via SDK |
| J-M03-063 | Enabled toggle (in table) | div | **NO** | visual-only, no click handler to toggle |

### Impersonate (`/impersonate`) — `routes/impersonate/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-070 | Search input | input | YES | filters member list |
| J-M03-071 | Impersonate button (row) | button | YES | `startImpersonationApi` via SDK |
| J-M03-072 | End Session button | button | YES | `endImpersonationApi` via SDK |

### Audit Log (`/audit`) — `routes/audit/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-080 | Action filter select | select | YES | filters query param |
| J-M03-081 | Resource type input | input | YES | filters query param |
| J-M03-082 | Start date input | input | YES | filters query param |
| J-M03-083 | End date input | input | YES | filters query param |
| J-M03-084 | User ID input | input | YES | filters query param |
| J-M03-085 | Refresh button | button | YES | `refetch()` |
| J-M03-086 | Previous page button | button | YES | decrements page state |
| J-M03-087 | Next page button | button | YES | increments page state |

### Members (`/members`) — `routes/members/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-090 | Search input | input | YES | filters member list |
| J-M03-091 | Org filter select | select | YES | filters by org |
| J-M03-092 | Member name link (row) | link | YES | `/members/$personId` |

### Member Detail (`/members/$personId`) — `routes/members/$personId.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-095 | Back to Members link | link | YES | `/members` |
| J-M03-096 | Profile/Credentials/... tabs | button | YES | local tab state |

### Communications — Broadcasts (`/communications`) — `routes/communications/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-100 | (no interactive elements) | -- | **NO** | hardcoded stats, placeholder text, no API calls |

### Communications — Moderation (`/communications/moderation`) — `routes/communications/moderation.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-105 | Filter tabs (All/Feed/Chat/Resolved) | button | **NO** | no onClick, no state change |
| J-M03-106 | Dismiss button | button | **NO** | no onClick handler |
| J-M03-107 | Warn Author button | button | **NO** | no onClick handler |
| J-M03-108 | Remove button | button | **NO** | no onClick handler |

### Communications — Templates (`/communications/templates`) — `routes/communications/templates.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-110 | New Template button | button | **NO** | no onClick handler |
| J-M03-111 | Category filter tabs | button | **NO** | no onClick handler |

### Communications — Email Health (`/communications/email`) — `routes/communications/email.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-115 | (read-only stats) | -- | -- | placeholder stats, no API calls |

### Compliance (`/compliance`) — `routes/compliance/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-120 | (none) | -- | -- | "Coming Soon" stub page |

### Verifications (`/verifications`) — `routes/verifications/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-125 | (none) | -- | -- | "Coming Soon" stub page |

### National Dashboard (`/national-dashboard`) — `routes/national-dashboard/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-130 | Association select | select | YES | filters dashboard data |
| J-M03-131 | Export Report button | button | YES | `exportDashboardReport` via fetch |

### Events (`/events`) — `routes/events/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-135 | Org filter select | select | YES | filters events |
| J-M03-136 | Event row click | button | YES | opens detail drawer |
| J-M03-137 | Export CSV button | button | YES | CSV download |
| J-M03-138 | View in Memberry link | link | YES | external localhost:3004 link |

### Training (`/training`) — `routes/training/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-140 | (read-only list) | -- | YES | `searchCoursesOptions` via SDK |

### Committees (`/committees`) — `routes/committees/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-145 | Committee row click | row | YES | local expand/detail |

### Surveys (`/surveys`) — `routes/surveys/index.tsx`

| ID | Element | Type | Wired | Target |
|----|---------|------|-------|--------|
| J-M03-150 | (read-only list) | -- | YES | raw `fetch` to `/api/admin/surveys` |

---

## R2 — Dead Interaction Registry

Elements that render as interactive but have no handler, no mutation, no navigation.

| ID | Severity | Page | Element | Problem |
|----|----------|------|---------|---------|
| J-M03-025 | **P1** | `/associations/$id` | "Add Organization" button | No onClick, no dialog, no mutation. Button renders but does nothing. Backend `createOrganization` handler exists. |
| J-M03-041 | **P1** | `/organizations/$id` | "Edit Organization" button | No onClick, no dialog, no mutation. Backend `updateOrganization` handler exists. |
| J-M03-042 | **P0** | `/organizations/$id` | "Activate" lifecycle button | No onClick. Backend `transitionOrgStatus` handler exists. Critical WF-023 workflow broken. |
| J-M03-043 | **P0** | `/organizations/$id` | "Suspend" lifecycle button | No onClick. Backend `transitionOrgStatus` handler exists. Critical WF-023 workflow broken. |
| J-M03-044 | **P0** | `/organizations/$id` | "Archive" lifecycle button | No onClick. Backend `transitionOrgStatus` handler exists. Critical WF-023 workflow broken. |
| J-M03-045 | **P2** | `/organizations/$id` | Member row "Actions" column | Hardcoded `--`, no actions available. Column header says "Actions" but no actions exist. |
| J-M03-063 | **P1** | `/feature-flags` | Enabled toggle in table rows | Visual-only toggle indicator (div, not button), no click handler to toggle existing flags. Can only create/delete, not toggle. Backend `setFeatureFlag` supports updates. |
| J-M03-105 | **P2** | `/communications/moderation` | Filter tabs (All/Feed/Chat/Resolved) | Buttons with no onClick, no state change. Decorative. |
| J-M03-106 | **P2** | `/communications/moderation` | Dismiss button | No onClick. Placeholder page with `PLACEHOLDER_ITEMS = []`. |
| J-M03-107 | **P2** | `/communications/moderation` | Warn Author button | No onClick. Placeholder. |
| J-M03-108 | **P2** | `/communications/moderation` | Remove button | No onClick. Placeholder. |
| J-M03-110 | **P2** | `/communications/templates` | "New Template" button | No onClick. Placeholder page, no API calls. |
| J-M03-111 | **P2** | `/communications/templates` | Category filter tabs | No onClick. Decorative buttons. |

**Total dead interactions: 13** (3x P0, 3x P1, 7x P2)

---

## R3 — Journey Completion Registry

End-to-end user journeys mapped from WORKFLOW_MAP.md specs to actual UI completability.

| Journey | WF-ID | Spec Steps | UI Complete | Verdict | Blocking Findings |
|---------|-------|------------|-------------|---------|-------------------|
| Onboard Association | WF-015 | Create assoc with locale, license, credit config | **PARTIAL** | P1 | Create form only has name/country/currency. Missing: locale, license regex, credit config fields per spec. |
| Provision Organization | WF-016 | Create org within assoc, assign initial officer | **BROKEN** | P0 | "Add Organization" button on association detail is dead (J-M03-025). No create org form exists in admin UI. Backend handler exists. |
| Manage Subscriptions | WF-017 | Trial-to-paid conversion, payment mgmt | **MISSING** | P0 | No subscription management UI anywhere in admin app. No route, no page. Spec requires billing/pricing management. |
| Feature Flag Management | WF-018 | Module x tier matrix, per-org overrides | **PARTIAL** | P1 | Can create/delete flags. Cannot toggle existing flags (J-M03-063). No matrix view (spec: rows=modules, cols=tiers). No "active data" warning when disabling. No M01 auth block guard. |
| User Impersonation | WF-019 | Search user, start session, orange banner, 30min timeout | **PARTIAL** | P1 | Search works. Start/end session wired. Missing: (a) persistent orange banner across ALL admin pages (spec: "every page"), only shows on impersonate page. (b) No 30-min auto-timeout. (c) No confirmation dialog before starting (spec requires it). (d) No "impersonating another admin" block check. |
| Support Ticket Resolution | WF-020 | Ticket inbox, SLA tracking, escalation | **MISSING** | P1 | No ticket/support UI anywhere in admin app. No route, no page. |
| Revenue Dashboard | WF-021 | MRR, ARR, churn, growth metrics | **MISSING** | P1 | Dashboard shows basic counts (associations, orgs, events, operators) but no revenue metrics. No MRR/ARR/churn/growth. No analytics endpoints called. |
| Admin Team Management | WF-022 | Invite/modify/remove admins | **PARTIAL** | P1 | Can invite and revoke. Missing: (a) Cannot modify existing admin role (spec: "change role"). Backend `updateAdmin` handler exists. (b) No "last Super Admin" protection in UI. (c) No MFA enforcement check. |
| Org Suspension/Cancellation | WF-023 | Suspend or cancel org | **BROKEN** | P0 | Lifecycle buttons exist on org detail but are completely dead (J-M03-042/043/044). Backend `transitionOrgStatus` exists. |

**Journey summary: 0/9 COMPLETE, 4 PARTIAL, 3 MISSING, 2 BROKEN**

---

## R4 — Role-Journey Matrix

Can each admin role complete their assigned journeys?

### Roles: `super`, `support`, `analyst`

| Journey | WF-ID | Required Role (spec) | super | support | analyst |
|---------|-------|---------------------|-------|---------|---------|
| Onboard Association | WF-015 | Super Admin | PARTIAL | N/A | N/A |
| Provision Organization | WF-016 | Super Admin | BROKEN | N/A | N/A |
| Manage Subscriptions | WF-017 | Super Admin | MISSING | N/A | N/A |
| Feature Flag Mgmt | WF-018 | Super Admin | PARTIAL | N/A | N/A |
| Impersonation | WF-019 | Super/Support | PARTIAL | BLOCKED* | N/A |
| Support Tickets | WF-020 | Super/Support | MISSING | MISSING | N/A |
| Revenue Dashboard | WF-021 | Super/Admin | MISSING | MISSING | MISSING |
| Admin Team Mgmt | WF-022 | Super Admin | PARTIAL | N/A | N/A |
| Org Suspension | WF-023 | Super/Admin | BROKEN | N/A | N/A |

*Support role: ROUTE_ROLES restricts `/impersonate` to `['super']` only. Spec says "Super/Support" should have access (M3-R5). Support is locked out.

### Role Gate Discrepancies

| Route | ROUTE_ROLES | Spec Permission | Delta |
|-------|------------|-----------------|-------|
| `/impersonate` | `['super']` | Super + Support | **Support excluded** — violates WF-019 actor definition |
| `/operators` | `['super']` | Super only | OK |
| `/feature-flags` | `['super']` | Super only | OK |
| `/audit` | `['super', 'support']` | Super + Support + Analyst | **Analyst excluded** — ROLE_PERMISSION_MATRIX 3.20 says all PA roles can view audit logs |

---

## R5 — Backend Gap Registry (P0 Critical)

Admin actions that call non-existent or unwired backend endpoints.

| ID | Page | Action | Frontend Call | Backend Handler | Status |
|----|------|--------|-------------|----------------|--------|
| J-M03-025 | Assoc detail | Add Organization | NONE (dead button) | `createOrganization.ts` EXISTS | **UI gap** — handler exists, UI not wired |
| J-M03-041 | Org detail | Edit Organization | NONE (dead button) | `updateOrganization.ts` EXISTS | **UI gap** — handler exists, UI not wired |
| J-M03-042 | Org detail | Activate/Suspend/Archive | NONE (dead buttons) | `transitionOrgStatus.ts` EXISTS | **UI gap** — handler exists, UI not wired |
| J-M03-063 | Feature flags | Toggle existing flag | NONE (visual-only) | `setFeatureFlag.ts` EXISTS | **UI gap** — handler exists, UI not wired |
| -- | -- | Update admin role | NONE (no UI) | `updateAdmin.ts` EXISTS | **UI gap** — handler exists, no UI for role change |
| -- | Association detail | National Dashboard API | raw `fetch('/api/admin/national-dashboard/...')` | `getNationalDashboard.ts` EXISTS | **OK but uses raw fetch** instead of SDK |
| -- | -- | Manage subscriptions | NONE | NO HANDLER | **Full gap** — neither UI nor backend |
| -- | -- | Revenue analytics | NONE | NO HANDLER (no `getRevenueAnalytics` or `getHealthAnalytics`) | **Full gap** — spec contracts define `GET /admin/analytics/revenue` and `GET /admin/analytics/health`, neither exists |
| -- | -- | Update pricing | NONE | NO HANDLER (no `updatePricing`) | **Full gap** — spec defines `PUT /admin/pricing`, not implemented |
| -- | Comms Broadcasts | Send broadcast | NONE | NO HANDLER | **Full gap** — placeholder page |
| -- | Comms Moderation | Moderate content | NONE | NO HANDLER | **Full gap** — placeholder page |
| -- | Comms Templates | CRUD templates | NONE | NO HANDLER | **Full gap** — placeholder page |
| -- | Comms Email | Email health stats | NONE | NO HANDLER | **Full gap** — placeholder page |

**Summary:** 5 cases where backend handlers exist but UI is dead/unwired. 7 cases where neither backend nor UI exists (full gap from spec).

---

## R6 — Consolidated Finding Summary

### P0 — Blockers (3)

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| P0-1 | Org lifecycle buttons are dead | J-M03-042/043/044 | Wire Activate/Suspend/Archive to `transitionOrgStatus` SDK mutation + confirmation dialog |
| P0-2 | Provision Organization journey broken | J-M03-025 + WF-016 | Wire "Add Organization" button to `createOrganization` SDK mutation with dialog form |
| P0-3 | Subscription management entirely absent | WF-017 | Requires new route + page + backend endpoints for trial-to-paid conversion |

### P1 — High (7)

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| P1-1 | Edit Organization button dead | J-M03-041 | Wire to `updateOrganization` SDK mutation with edit dialog |
| P1-2 | Feature flag toggle is visual-only | J-M03-063 | Add onClick to call `setFeatureFlag` mutation to toggle `enabled` |
| P1-3 | Update admin role not exposed | WF-022 | Add role-change dropdown/dialog on operators page, wire to `updateAdmin` |
| P1-4 | Association create form missing spec fields | WF-015 | Add locale, license regex, credit config to create form |
| P1-5 | Impersonation missing orange global banner | WF-019 / AC-M03-001 | Impersonation banner only on `/impersonate` page, needs to be in `__root.tsx` layout |
| P1-6 | Impersonation missing 30-min auto-timeout + confirmation dialog | WF-019 | Add timer + auto-end + pre-start confirmation dialog |
| P1-7 | Support role locked out of impersonation | WF-019 / ROUTE_ROLES | Add `'support'` to ROUTE_ROLES['/impersonate'] |

### P2 — Medium (7)

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| P2-1 | Revenue Dashboard absent | WF-021 | Add analytics endpoints + update dashboard or add `/analytics` route |
| P2-2 | Support ticket system absent | WF-020 | Entirely new feature — route + backend |
| P2-3 | Communications pages are all placeholders | J-M03-100/105-111 | 4 pages with no API calls, dead buttons, hardcoded stats |
| P2-4 | Moderation filter tabs decorative | J-M03-105 | Wire tab state to filter logic |
| P2-5 | Compliance page is stub | J-M03-120 | "Coming Soon" — no functionality |
| P2-6 | Verifications page is stub | J-M03-125 | "Coming Soon" — no functionality |
| P2-7 | Analyst role excluded from audit logs | ROUTE_ROLES | Add `'analyst'` to ROUTE_ROLES['/audit'] per spec |
| P2-8 | Org detail member actions column empty | J-M03-045 | Either add actions or remove the "Actions" column header |
| P2-9 | Association detail uses raw fetch for national dashboard | J-M03-027 | Replace `fetch('/api/admin/...')` with SDK-generated query |

### Stub Pages (no functionality, "Coming Soon" or placeholder only)

| Page | Route | Notes |
|------|-------|-------|
| Compliance | `/compliance` | "Coming Soon" stub |
| Verifications | `/verifications` | "Coming Soon" stub |
| Broadcasts | `/communications` | Hardcoded stats, no API |
| Moderation | `/communications/moderation` | Empty array, dead buttons |
| Templates | `/communications/templates` | Empty, dead button |
| Email Health | `/communications/email` | Placeholder stats, no API |

---

## Metrics

| Metric | Value |
|--------|-------|
| Total interactive elements audited | ~65 |
| Wired correctly | 45 (69%) |
| Dead interactions (P0-P2) | 13 (20%) |
| Placeholder/stub pages | 6 |
| Spec workflows covered (COMPLETE) | 0/9 (0%) |
| Spec workflows PARTIAL | 4/9 (44%) |
| Spec workflows MISSING | 3/9 (33%) |
| Spec workflows BROKEN | 2/9 (22%) |
| Backend handlers with no UI wiring | 5 |
| Spec endpoints with no backend | 7 |
| Role gate discrepancies | 2 |
