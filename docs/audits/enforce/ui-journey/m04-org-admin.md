# UI Journey Audit: Organization Admin (M04)

<!-- oli:ui-journey v1.0 | audited 2026-05-27 | module: m04-org-admin -->

**Module:** m04-org-admin (Officer Management UI)
**Auditor:** oli-ui-journey
**Date:** 2026-05-27
**Scope:** Officer panel routes, sidebar navigation, org settings, officer CRUD, disciplinary actions, public page

---

## R1 -- Action Registry

Every interactive element in scope, mapped to its handler.

| ID | Route | Element | Type | Handler | API Endpoint | Spec Ref |
|----|-------|---------|------|---------|-------------|----------|
| J-M04-001 | `/org/:slug/officer/dashboard` | Dashboard KPI "Active Members" card | link | navigates to `/org/:slug/officer/roster` | GET `/api/association/member/summary` | WF-027 |
| J-M04-002 | `/org/:slug/officer/dashboard` | Dashboard KPI "Grace Period" card | link | navigates to `/org/:slug/officer/roster?status=grace` | GET `/api/association/member/summary` | WF-027 |
| J-M04-003 | `/org/:slug/officer/dashboard` | Dashboard KPI "Lapsed" card | link | navigates to `/org/:slug/officer/roster?status=lapsed` | GET `/api/association/member/summary` | WF-027 |
| J-M04-004 | `/org/:slug/officer/dashboard` | Dashboard KPI "Collection Rate" card | link | navigates to `/org/:slug/officer/payments` | GET `/api/association/member/summary` | WF-027 |
| J-M04-005 | `/org/:slug/officer/dashboard` | Dashboard KPI "Upcoming Events" card | link | navigates to `/org/:slug/officer/events` | `searchEventsOptions` | WF-027 |
| J-M04-006 | `/org/:slug/officer/dashboard` | Dashboard KPI "Active Elections" card | link | navigates to `/org/:slug/officer/elections` | `listElectionsOptions` | WF-027 |
| J-M04-007 | `/org/:slug/officer/dashboard` | Action Queue items | link | navigates to relevant module route | computed from multiple queries | WF-027 |
| J-M04-008 | `/org/:slug/officer/dashboard` | Module Summary "Members" card | link | navigates to `/org/:slug/officer/roster` | same as KPIs | WF-027 |
| J-M04-009 | `/org/:slug/officer/dashboard` | Module Summary "Members" secondary action "Review N pending" | link | navigates to `/org/:slug/officer/applications` | GET `/api/association/member/applications` | WF-027 |
| J-M04-010 | `/org/:slug/officer/dashboard` | Module Summary "Finances" card | link | navigates to `/org/:slug/officer/payments` | same as KPIs | WF-027 |
| J-M04-011 | `/org/:slug/officer/dashboard` | Module Summary "Events" card | link | navigates to `/org/:slug/officer/events` | `searchEventsOptions` | WF-027 |
| J-M04-012 | `/org/:slug/officer/dashboard` | Module Summary "Elections" card | link | navigates to `/org/:slug/officer/elections` | `listElectionsOptions` | WF-027 |
| J-M04-013 | `/org/:slug/officer/dashboard` | Module Summary "Documents" card | link | navigates to `/org/:slug/officer/documents` | `searchDocumentsOptions` | WF-027 |
| J-M04-014 | `/org/:slug/officer/dashboard` | Module Summary "Communications" card | link | navigates to `/org/:slug/officer/announcements` | -- | WF-027 |
| J-M04-015 | `/org/:slug/officer/officers` | "Assign Role" button | button | opens AssignRoleModal | POST `/api/association/member/officer-terms` | WF-025 |
| J-M04-016 | `/org/:slug/officer/officers` | AssignRoleModal Position combobox | select | sets positionId state | GET `/api/association/member/positions` (inferred) | WF-025 |
| J-M04-017 | `/org/:slug/officer/officers` | AssignRoleModal Member search combobox | combobox | searches members by name | GET `/api/association/member/members?search=` (inferred) | WF-025 |
| J-M04-018 | `/org/:slug/officer/officers` | AssignRoleModal "Assign" submit | button | `handleSubmit` -> POST officer-term | POST `/api/association/member/officer-terms` | WF-025 |
| J-M04-019 | `/org/:slug/officer/officers` | Row trash icon (remove officer) | button | opens confirm dialog -> `handleRemove` | DELETE `/api/association/member/officer-terms/:termId` | WF-025 |
| J-M04-020 | `/org/:slug/officer/officers` | Remove confirm "Remove" button | button | `handleRemove` with optimistic update | DELETE `/api/association/member/officer-terms/:termId` | WF-025, AC-M04-002 |
| J-M04-021 | `/org/:slug/officer/settings/org` | "Edit" button | button | sets `isEditing=true` | -- | WF-024 |
| J-M04-022 | `/org/:slug/officer/settings/org` | "Save" button | button | `handleSave` -> PUT org profile | PUT `/api/association/member/orgs/:orgId` | WF-024, AC-M04-001 |
| J-M04-023 | `/org/:slug/officer/settings/org` | "Cancel" button | button | `handleCancel` reverts draft | -- | WF-024 |
| J-M04-024 | `/org/:slug/officer/settings/org` | Logo URL input | input | updates `draft.logoUrl` | -- | WF-024 |
| J-M04-025 | `/org/:slug/officer/settings/org` | Organization Name input | input | updates `draft.name` (required) | -- | WF-024 |
| J-M04-026 | `/org/:slug/officer/settings/org` | Description textarea | textarea | updates `draft.description` | -- | WF-024 |
| J-M04-027 | `/org/:slug/officer/settings/org` | Contact Email input | input | updates `draft.contactEmail` | -- | WF-024 |
| J-M04-028 | `/org/:slug/officer/settings/org` | Address input | input | updates `draft.address` | -- | WF-024 |
| J-M04-029 | `/org/:slug/officer/settings/org` | Website input | input | updates `draft.website` | -- | WF-024 |
| J-M04-030 | `/org/:slug/officer/settings/org` | Founding Date picker | date-picker | updates `draft.foundingDate` | -- | WF-024 |
| J-M04-031 | `/org/:slug/officer/roster` | "Add Member" button | button | opens AddMemberDialog | POST `/api/association/member/roster` | -- |
| J-M04-032 | `/org/:slug/officer/roster` | MemberTable component | table | fetches/renders members | GET `/api/association/member/members` | -- |
| J-M04-033 | `/org/:slug/officer/roster` | AddMemberDialog form submit | button | calls `addRosterMemberMutation` | POST roster | -- |
| J-M04-034 | `/org/:slug/officer/roster/import` | CSV file upload | input[file] | `parseCSV` -> preview table | -- | -- |
| J-M04-035 | `/org/:slug/officer/roster/import` | "Import" submit | button | `importRosterMembersMutation` | POST `/api/association/member/roster/import` | -- |
| J-M04-036 | `/org/:slug/officer/roster/:memberId` | MemberDetail component | composite | renders member info | GET `/api/association/member/members/:id` | -- |
| J-M04-037 | `/org/:slug/officer/roster/:memberId` | License verify button | button | `verifyMutation` | POST `/api/association/member/licenses/:id/verify` | -- |
| J-M04-038 | `/org/:slug/officer/roster/:memberId` | Bulk issue button | button | `bulkMutation` | POST bulk certificates | -- |
| J-M04-039 | `/org/:slug/officer/compliance` | "Refresh" button | button | `refreshMutation` POST compliance refresh | POST `/api/association/member/compliance/:orgId/refresh` | -- |
| J-M04-040 | `/org/:slug/officer/compliance` | Status filter select | select | sets `statusFilter` -> refetches | GET `/api/association/member/compliance/:orgId?status=` | -- |
| J-M04-041 | `/org/:slug/officer/settings/cpd` | CPD cycle select | select | updates cycle config | PUT org CPD settings (inferred) | -- |
| J-M04-042 | `/org/:slug/officer/settings/cpd` | "Save Configuration" button | button | `updateMutation` | PUT CPD config | -- |
| J-M04-043 | `/org/:slug/officer/settings/chapters` | AffiliationList component | composite | chapter CRUD | GET/POST/DELETE affiliations | -- |
| J-M04-044 | `/org/:slug/officer/settings/gateway` | GatewaySetup component | composite | Stripe Connect config | Stripe/billing endpoints | -- |
| J-M04-045 | `/org/:slug/officer/settings/membership-categories` | CategoryEditor component | composite | tier CRUD | GET/POST/PUT/DELETE tiers | -- |
| J-M04-046 | `/org/:slug/officer/settings/providers` | Provider table + form | composite | provider CRUD | GET/POST/PUT providers | -- |
| J-M04-047 | `/org/:slug/officer/certificates` | Bulk issue certificates form | composite | `handleBulkIssue` | POST certificates bulk | -- |
| J-M04-048 | `/org/:slug/officer/certificates` | Single verify input | input+button | `verifyMutation` | POST certificate verify | -- |
| J-M04-049 | `/org/:slug` (public) | "Apply to Join" button | button | `handleApplyClick` -> opens apply dialog | -- | WF-028, AC-M04-006 |
| J-M04-050 | `/org/:slug` (public) | Apply dialog tier select | select | sets `selectedTierId` | GET `/api/association/member/tiers` | WF-028 |
| J-M04-051 | `/org/:slug` (public) | Apply dialog "Submit Application" button | button | `handleSubmitApplication` | POST `/api/association/member/applications` | WF-028 |
| J-M04-052 | `/my/organizations` | "Find Organizations" button | button | `toast.info('Organization discovery coming soon')` | -- | -- |
| J-M04-053 | `/my/organizations` | "Leave" button per org | button | opens confirm dialog -> terminate membership | DELETE `/api/association/member/:id/terminate` | -- |
| J-M04-054 | `/my/organizations` | Transfer membership icon button | button | opens transfer dialog | -- | -- |
| J-M04-055 | `/my/organizations` | "Renew" button (grace/lapsed) | button | navigates to dues | -- | -- |
| J-M04-056 | `/my/organizations` | Org row link | link | navigates to `/org/:slug/members` | -- | -- |
| J-M04-057 | Sidebar | "Back to Member View" link | link | navigates to `/dashboard` | -- | -- |

---

## R2 -- Journey Completion Registry

End-to-end user journeys traced through the UI.

| Journey ID | Workflow | Actor | Steps | Status | Findings |
|------------|---------|-------|-------|--------|----------|
| JC-M04-001 | WF-024: Update Org Profile | President | 1. Sidebar > Settings > Org Profile 2. Click "Edit" 3. Modify fields (name, logo, description, email, address, website, founding date) 4. Click "Save" 5. See success toast | COMPLETE | Form has dirty-check, cancel, loading states. No SVG sanitization on logo URL (AC-M04-007 gap). |
| JC-M04-002 | WF-025: Assign Officer | President | 1. Sidebar > Settings > Officers 2. Click "Assign Role" 3. Select position from combobox 4. Search and select member 5. Click "Assign" 6. See success toast + table updates | COMPLETE | Optimistic update on remove. Position list fetched from API. |
| JC-M04-003 | WF-025: Remove Officer | President | 1. Sidebar > Settings > Officers 2. Click trash icon on officer row 3. Confirm in dialog 4. See success toast + row removed | COMPLETE | Optimistic rollback on error. No check for "last officer" constraint (M04-001 error) -- relies on backend. |
| JC-M04-004 | WF-025: Officer Transition (handoff) | President | Expected: select outgoing officer -> initiate transition -> handoff checklist -> assign incoming | MISSING | **No transition UI exists.** OfficerManagement only has assign + remove. WF-025 specifies handoff checklist (TransitionChecklist entity) but no frontend implementation. AC-M04-003 unmet. |
| JC-M04-005 | WF-026: Disciplinary Action | President | Expected: select member -> choose action type -> enter reason -> confirm -> member notified | MISSING | **No disciplinary action UI exists.** No route, no component, no modal. API contract `POST /org/:id/discipline` has no frontend caller. AC-M04-004 unmet. |
| JC-M04-006 | WF-027: Org Dashboard | Any Officer | 1. Navigate to officer panel 2. See 6 KPI cards 3. See Action Queue 4. See Module Summary cards 5. Click through to sub-modules | COMPLETE | KPIs: active members, grace, lapsed, collection rate, events, elections. Module cards link correctly. Action queue computed dynamically. |
| JC-M04-007 | WF-028: Public Org Page | Visitor | 1. Navigate to `/org/:slug` 2. See org profile info 3. Click "Apply to Join" 4. Sign in if needed 5. Select tier 6. Submit application | COMPLETE | Auth redirect on unauthenticated apply. Tier selection pre-fills if single tier. |
| JC-M04-008 | Roster Management | Secretary/President | 1. Sidebar > Members > Roster 2. View member table 3. Click "Add Member" -> fill form 4. Or click member row -> detail view 5. View licenses, verify, bulk issue | COMPLETE | Add, view, detail, license verify all wired. Status filter via URL params. |
| JC-M04-009 | Roster Import | Secretary/President | 1. Sidebar > Members > Import 2. Upload CSV 3. Preview parsed rows 4. Click Import | COMPLETE | BOM stripping, quoted field parsing, preview table. SDK mutation used. |
| JC-M04-010 | My Organizations | Member | 1. Navigate to `/my/organizations` 2. See org list with status badges 3. Leave org (confirm dialog) 4. Transfer membership | PARTIAL | Leave works. Transfer dialog opens but **transfer mutation not visible in code** -- may be stub. "Find Organizations" is toast-only placeholder. |

---

## R3 -- Dead Interaction Registry

Elements that exist in UI but lead nowhere or have no effect.

| ID | Route | Element | Issue | Severity | Fix |
|----|-------|---------|-------|----------|-----|
| DI-M04-001 | `/my/organizations` | "Find Organizations" button | Shows `toast.info('...coming soon')` -- no navigation, no search | P3-LOW | Roadmap item. Remove button or implement discovery. |
| DI-M04-002 | `/org/:slug/officer/dashboard` | Module Summary "Communications" card | Links to `/org/:slug/officer/announcements` but route file is `communications/index.tsx` not `announcements` | P2-MED | Verify route resolution. May 404 if TanStack Router doesn't alias. |
| DI-M04-003 | `/org/:slug/officer/payments` | Payments layout route | `component: () => <Outlet />` -- renders nothing if no child route matched | P2-MED | Add payments/index.tsx with payment records list, or redirect to finances. |
| DI-M04-004 | `/org/:slug/officer/settings/dues` | Dues settings route | Redirects to `/org/:slug/officer/finances/dues` | P3-LOW | Intentional redirect. Working as designed. |
| DI-M04-005 | `/org/:slug/officer/settings/funds` | Funds settings route | Redirects to `/org/:slug/officer/finances/funds` | P3-LOW | Intentional redirect. Working as designed. |
| DI-M04-006 | Mobile nav | FINANCES section links | Mobile nav links to `settings/dues` and `settings/funds` (old redirect paths) while desktop links to `finances/*` (direct) | P2-MED | Update mobile nav to match desktop sidebar routes for consistency. |
| DI-M04-007 | `/my/organizations` | Transfer membership icon button | Opens dialog but **transfer mutation implementation not confirmed** in route code | P2-MED | Verify transfer endpoint exists and is wired. |

---

## R4 -- Spec-vs-Implementation Gap Registry

Discrepancies between MODULE_SPEC/API_CONTRACTS and actual frontend code.

| ID | Spec Artifact | Spec Requirement | Implementation Status | Gap Severity | Notes |
|----|--------------|-----------------|----------------------|-------------|-------|
| SG-M04-001 | MODULE_SPEC S4 WF-025 | Officer Transition with handoff checklist | NOT IMPLEMENTED | P1-HIGH | No transition UI. Only assign + remove exist. TransitionChecklist entity has no frontend representation. |
| SG-M04-002 | MODULE_SPEC S4 WF-026 | Disciplinary Action (warning/suspension/removal/probation) | NOT IMPLEMENTED | P1-HIGH | No disciplinary action route, component, or modal anywhere in the officer panel. |
| SG-M04-003 | API_CONTRACTS 2.4 | `POST /org/:id/officers/:termId/transition` endpoint | NO FRONTEND CALLER | P1-HIGH | Endpoint defined in API contracts but no UI calls it. |
| SG-M04-004 | API_CONTRACTS 2.5 | `POST /org/:id/discipline` endpoint | NO FRONTEND CALLER | P1-HIGH | Endpoint defined in API contracts but no UI calls it. |
| SG-M04-005 | API_CONTRACTS 2.6 | `GET /org/:id/dashboard` endpoint | PARTIALLY USED | P2-MED | Dashboard component fetches from multiple hand-wired endpoints (`/api/association/member/summary`, etc.) rather than the consolidated `/org/:id/dashboard` endpoint. |
| SG-M04-006 | MODULE_SPEC S9 | Screen: Org Dashboard -- "smart action cards" | IMPLEMENTED | OK | ActionQueue component renders dynamic action items based on pending counts. |
| SG-M04-007 | MODULE_SPEC S9 | Screen: Officer Management -- assign/remove/transition | PARTIAL (no transition) | P1-HIGH | See SG-M04-001. |
| SG-M04-008 | MODULE_SPEC S9 | Screen: Org Public Page | IMPLEMENTED | OK | `/org/:slug` route with profile + "Apply to Join" CTA. |
| SG-M04-009 | MODULE_SPEC S11 AC-M04-001 | Org Settings CRUD | IMPLEMENTED | OK | OrgSettingsForm with edit/save/cancel cycle. |
| SG-M04-010 | MODULE_SPEC S11 AC-M04-002 | Officer Role Constraint (max 1 person per position) | DELEGATED TO BACKEND | P3-LOW | Frontend does not enforce -- relies on 422 from API. Acceptable pattern. |
| SG-M04-011 | MODULE_SPEC S11 AC-M04-003 | Officer Transition with Handoff Checklist | NOT IMPLEMENTED | P1-HIGH | Same as SG-M04-001. |
| SG-M04-012 | MODULE_SPEC S11 AC-M04-004 | Disciplinary Action with Mandatory Reason | NOT IMPLEMENTED | P1-HIGH | Same as SG-M04-002. |
| SG-M04-013 | MODULE_SPEC S11 AC-M04-005 | Org Dashboard Metrics | IMPLEMENTED | OK | 6 KPIs + module cards + action queue. |
| SG-M04-014 | MODULE_SPEC S11 AC-M04-006 | Public Page Slug loads in <2s | IMPLEMENTED (no perf test) | P3-LOW | Route exists. No lighthouse/perf assertion. |
| SG-M04-015 | MODULE_SPEC S11 AC-M04-007 | SVG Sanitization on logo upload | NOT IMPLEMENTED | P2-MED | OrgSettingsForm accepts raw URL string for logo. No sanitization or validation. |
| SG-M04-016 | MODULE_SPEC S5 BR-M4-R3 | "Every disciplinary action requires a non-empty reason" | NOT IMPLEMENTED | P1-HIGH | No disciplinary UI = no reason field. |
| SG-M04-017 | MODULE_SPEC S5 BR-M4-R6 | "Officer cannot remove themselves" | NOT ENFORCED IN UI | P2-MED | No client-side check. Backend must enforce. |
| SG-M04-018 | ROLE_PERMISSION_MATRIX | Governance mutations require president + 2FA | GUARD EXISTS | OK | `requireOrgOfficer` guard in route `beforeLoad`. 2FA enforcement is backend-side. |
| SG-M04-019 | WORKFLOW_MAP WF-024 | Org branding (logo, public page) | PARTIAL | P2-MED | Logo is URL-only. No file upload to S3/MinIO. No branding preview. |

---

## R5 -- Navigation Consistency Registry

Sidebar/mobile nav alignment with actual routes.

| ID | Nav Context | Nav Item | Target Route | Route Exists? | Mismatch? | Notes |
|----|------------|----------|-------------|--------------|-----------|-------|
| NC-M04-001 | Desktop sidebar | Dashboard | `${base}/dashboard` | YES | -- | -- |
| NC-M04-002 | Desktop sidebar | Roster | `${base}/roster` | YES | -- | -- |
| NC-M04-003 | Desktop sidebar | Applications | `${base}/applications` | YES | -- | -- |
| NC-M04-004 | Desktop sidebar | Import | `${base}/roster/import` | YES | -- | -- |
| NC-M04-005 | Desktop sidebar | Overview (Finances) | `${base}/finances` | YES | -- | -- |
| NC-M04-006 | Desktop sidebar | Invoices | `${base}/finances/invoices` | YES | -- | -- |
| NC-M04-007 | Desktop sidebar | Payments | `${base}/payments` | YES (layout only) | P2-MED | Route is `<Outlet/>` with no index page. Clicking "Payments" renders blank content area. |
| NC-M04-008 | Desktop sidebar | Members (Finances) | `${base}/finances/members` | YES | -- | -- |
| NC-M04-009 | Desktop sidebar | Assessments | `${base}/finances/assessments` | YES | -- | -- |
| NC-M04-010 | Desktop sidebar | Funds | `${base}/finances/funds` | YES | -- | -- |
| NC-M04-011 | Desktop sidebar | Reports (Financial) | `${base}/reports/financial` | YES | -- | -- |
| NC-M04-012 | Desktop sidebar | Events | `${base}/events` | YES | -- | -- |
| NC-M04-013 | Desktop sidebar | Trainings | `${base}/training` | YES | -- | -- |
| NC-M04-014 | Desktop sidebar | Channels (Messages) | `${base}/messages` | YES | -- | -- |
| NC-M04-015 | Desktop sidebar | Announcements | `${base}/communications` | YES | -- | -- |
| NC-M04-016 | Desktop sidebar | Templates | `${base}/communications/templates` | YES | -- | -- |
| NC-M04-017 | Desktop sidebar | Elections | `${base}/elections` | YES | -- | -- |
| NC-M04-018 | Desktop sidebar | Surveys | `${base}/surveys` | YES (dir exists) | -- | -- |
| NC-M04-019 | Desktop sidebar | Reviews | `${base}/reviews` | YES (dir exists) | -- | -- |
| NC-M04-020 | Desktop sidebar | Document Library | `${base}/documents` | YES | -- | -- |
| NC-M04-021 | Desktop sidebar | Credit Reports | `${base}/reports/credits` | YES | -- | -- |
| NC-M04-022 | Desktop sidebar | Org Profile (Settings) | `${base}/settings/org` | YES | -- | -- |
| NC-M04-023 | Desktop sidebar | Officers (Settings) | `${base}/officers` | YES | -- | -- |
| NC-M04-024 | Desktop sidebar | Categories (Settings) | `${base}/settings/membership-categories` | YES | -- | -- |
| NC-M04-025 | Desktop sidebar | Payment Gateway (Settings) | `${base}/settings/gateway` | YES | -- | -- |
| NC-M04-026 | Mobile nav | Dues Config | `${base}/settings/dues` | YES (redirect) | P3-LOW | Redirects to `finances/dues`. Works but inconsistent with desktop which links directly. |
| NC-M04-027 | Mobile nav | Fund Allocation | `${base}/settings/funds` | YES (redirect) | P3-LOW | Same redirect pattern as NC-M04-026. |
| NC-M04-028 | Mobile nav | Credit Reports (Documents) | `${base}/reports/credits` | YES | -- | -- |
| NC-M04-029 | Dashboard module card | Communications | `/org/:slug/officer/announcements` | UNCERTAIN | P2-MED | Dashboard links to `/announcements` but route is `/communications`. May resolve via TanStack but needs verification. |
| NC-M04-030 | Position nav config | `POSITION_NAV_CONFIG` | N/A | N/A | -- | President sees all 8 sections. Treasurer: FINANCES+DOCUMENTS+SETTINGS. Secretary: MEMBERS+COMMUNICATIONS+FEEDBACK+SETTINGS. Society officer: ACTIVITIES+FEEDBACK+DOCUMENTS+SETTINGS. |

---

## R6 -- Summary & Recommendations

### Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Action coverage | 7/10 | 57 actions mapped. Core CRUD flows work. Two entire workflows missing (transition, discipline). |
| Journey completion | 6/10 | 7/10 journeys complete. 2 critical journeys (WF-025 transition, WF-026 discipline) have NO UI. |
| Dead interactions | 8/10 | 7 dead/stub interactions found. Most are low severity (redirects, placeholders). |
| Spec alignment | 5/10 | 6 P1-HIGH gaps. Two API endpoints with zero frontend callers. |
| Nav consistency | 8/10 | 25/30 nav items perfectly aligned. 3 P2 mismatches, 2 P3 redirects. |
| **Overall** | **6.8/10** | Two missing workflows drag the score. Core officer panel is solid. |

### P1-HIGH Findings (Must Fix)

1. **WF-025 Officer Transition UI missing** (SG-M04-001, SG-M04-003, SG-M04-007, SG-M04-011)
   - No handoff checklist UI
   - `POST /org/:id/officers/:termId/transition` has no frontend caller
   - Build: transition modal with outgoing/incoming officer selection + checklist steps

2. **WF-026 Disciplinary Action UI missing** (SG-M04-002, SG-M04-004, SG-M04-012, SG-M04-016)
   - No warning/suspension/removal/probation UI
   - `POST /org/:id/discipline` has no frontend caller
   - Build: discipline modal accessible from member detail or officer panel with action type selector + mandatory reason textarea

### P2-MED Findings (Should Fix)

3. **Payments route is empty shell** (NC-M04-007, DI-M04-003) -- `<Outlet/>` with no index page
4. **Dashboard -> Communications link may 404** (NC-M04-029, DI-M04-002) -- links to `/announcements` not `/communications`
5. **Mobile nav uses redirect paths** (DI-M04-006) -- inconsistent with desktop sidebar
6. **SVG sanitization missing on logo** (SG-M04-015) -- raw URL accepted without validation
7. **Transfer membership may be stub** (DI-M04-007) -- dialog opens but mutation unconfirmed
8. **Logo upload is URL-only** (SG-M04-019) -- no S3 file upload integration for branding
9. **Officer self-removal not blocked in UI** (SG-M04-017)

### P3-LOW Findings (Nice to Have)

10. "Find Organizations" button is toast placeholder (DI-M04-001)
11. Settings/dues and settings/funds redirects work but add unnecessary hops (DI-M04-004, DI-M04-005)
12. No client-side performance test for public page <2s (SG-M04-014)
