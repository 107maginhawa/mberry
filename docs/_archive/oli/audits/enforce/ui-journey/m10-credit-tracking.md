# UI Journey Report: m10-credit-tracking

**Framework:** React + TanStack Router (Vite)
**Files Scanned:** 10
**Interactive Elements Found:** 34
**Audit Date:** 2026-05-27

## Files Scanned

| # | File | Elements | Role |
|---|------|----------|------|
| 1 | `apps/memberry/src/routes/_authenticated/my/credits/index.tsx` | 6 | Cross-org credit summary + entry table |
| 2 | `apps/memberry/src/routes/_authenticated/my/credits/log.tsx` | 5 | Manual credit entry form |
| 3 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/my-cpd.tsx` | 5 | Org-scoped CPD dashboard |
| 4 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` | 8 | Officer compliance report |
| 5 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx` | 6 | CPD configuration (officer) |
| 6 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId.tsx` | 4 | Training detail with attendance tab |
| 7 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance.tsx` | 2 | Attendance marking (triggers AUTO credit) |
| 8 | `apps/memberry/src/features/dashboard/components/credit-breakdown.tsx` | 3 | Dashboard credit ring widget |
| 9 | `apps/memberry/src/routes/_authenticated/my/training.tsx` | 3 | Member training list |
| 10 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/training/$trainingId.tsx` | 2 | Member training detail + enroll |

---

## Registry 1: Action Registry

| Module | Screen | Element | Type | Label | Handler | API Call | Role Gate | WF-NNN | Confidence |
|--------|--------|---------|------|-------|---------|----------|-----------|--------|------------|
| m10 | /my/credits | Summary stat cards (4x) | display | Total / Required / Carryover / Remaining | useQuery credit-summary | GET /api/persons/me/credit-summary | requireAuth | WF-065 | HIGH |
| m10 | /my/credits | Credit Log table | display | Activity / Date / Type / Credits | useQuery credit-entries | GET /api/persons/me/credit-entries | requireAuth | WF-065 | HIGH |
| m10 | /my/credits | "Log Manual Credit" EmptyState action | button | "Log Manual Credit" | navigate({ to: '/my/credits/log' }) | None (nav) | requireAuth | WF-066 | HIGH |
| m10 | /my/credits/log | Manual credit form | form | Activity Name, Date, Credit Amount, Description | handleSubmit -> onSubmit | POST /api/persons/me/credit-entries | requireAuth (member self) | WF-066 | HIGH |
| m10 | /my/credits/log | "Log Credit" submit button | button | "Log Credit" / "Logging..." | form submit | POST /api/persons/me/credit-entries | requireAuth | WF-066 | HIGH |
| m10 | /my/credits/log | Breadcrumb "Credits" link | Link | "Credits" | Link to="/my/credits" | None (nav) | requireAuth | WF-065 | HIGH |
| m10 | /org/$orgSlug/my-cpd | Total Credits card | display | Total Credits with required count | useQuery my-credits | GET /api/persons/me/credits | requireAuth | WF-065 | HIGH |
| m10 | /org/$orgSlug/my-cpd | Compliance % card | display | Compliance percentage with status icon | computed from credits | None (derived) | requireAuth | WF-065 | HIGH |
| m10 | /org/$orgSlug/my-cpd | Category Breakdown card | display | General / Major / Self-Directed | credits.categoryBreakdown | None (derived) | requireAuth | WF-065 | HIGH |
| m10 | /org/$orgSlug/my-cpd | Credit History list | display | Activity entries with date, category, source | credits.history | None (derived from GET) | requireAuth | WF-065 | HIGH |
| m10 | /org/$orgSlug/my-cpd | "Browse Training" link | Link | "Browse Training" | Link to /org/$orgSlug/training | None (nav) | requireAuth | WF-065 | MEDIUM |
| m10 | /org/$orgSlug/my-cpd | "Browse Events" link | Link | "Browse Events" | Link to /org/$orgSlug/events | None (nav) | requireAuth | WF-065 | MEDIUM |
| m10 | /org/$orgSlug/officer/reports/credits | Summary filter cards (4x) | button | Total / Compliant / At Risk / Non-Compliant | setFilter(status) | None (client filter) | requireAuth + officer | WF-068 | HIGH |
| m10 | /org/$orgSlug/officer/reports/credits | Compliance table | display | Member name, cycle, required, earned, remaining, %, status | useQuery credit-compliance | GET /api/credit-compliance/:orgId | requireAuth + officer | WF-068 | HIGH |
| m10 | /org/$orgSlug/officer/reports/credits | Status filter buttons | button | All / Compliant / At Risk / Non-Compliant | setFilter | None (client) | requireAuth + officer | WF-068 | HIGH |
| m10 | /org/$orgSlug/officer/settings/cpd | Required Credits input | input | Required Credits per Cycle | setRequiredCredits | None (local state) | requireAuth + officer | WF-069 | HIGH |
| m10 | /org/$orgSlug/officer/settings/cpd | Cycle Length select | select | Cycle Length (1-3 years) | setCycleLengthYears | None (local state) | requireAuth + officer | WF-069 | HIGH |
| m10 | /org/$orgSlug/officer/settings/cpd | SDL Cap input | input | SDL Cap (%) | setSdlCapPercent | None (local state) | requireAuth + officer | WF-069 | HIGH |
| m10 | /org/$orgSlug/officer/settings/cpd | Cycle Start Month select | select | Cycle Start Month | setCycleStartMonth | None (local state) | requireAuth + officer | WF-069 | HIGH |
| m10 | /org/$orgSlug/officer/settings/cpd | "Save Configuration" button | button | "Save Configuration" / "Saving..." | handleSave -> updateMutation | PATCH /api/association/member/cpd-config/:orgId | requireAuth + officer | WF-069 | HIGH |
| m10 | /org/$orgSlug/officer/settings/cpd | CPD config query | query | N/A | useQuery cpd-config | GET /api/association/member/cpd-config/:orgId | requireAuth + officer | WF-069 | HIGH |
| m10 | /org/$orgSlug/officer/training/$trainingId | Tab buttons (Details/Edit/Attendance) | button | "Details" / "Edit" / "Attendance" | setTab | None (client) | requireAuth + officer | WF-060 | HIGH |
| m10 | /org/$orgSlug/officer/training/$trainingId | Credit badge | display | "X CPE" | N/A | None (derived) | requireAuth + officer | WF-060 | HIGH |
| m10 | /org/$orgSlug/officer/training/$trainingId/attendance | Attendance marking | button/table | Mark attendance per enrollee | mutation | POST attendance endpoint | requireAuth + officer | WF-060 | HIGH |
| m10 | /features/dashboard/credit-breakdown | CreditRing + CountUp | display | Credit progress ring | props-driven | None (parent fetches) | requireAuth | WF-065 | HIGH |
| m10 | /features/dashboard/credit-breakdown | "View transcript" link | Link | "View transcript" | Link to="/my/credits" | None (nav) | requireAuth | WF-065, WF-070 | HIGH |
| m10 | /features/dashboard/credit-breakdown | "Earn more credits" link | Link | "Earn more credits" | Link to="/my/training" | None (nav) | requireAuth | WF-065 | HIGH |
| m10 | /features/dashboard/credit-breakdown | Empty state | display | "No credits yet" | N/A | None | requireAuth | WF-065 | HIGH |
| m10 | /features/dashboard/credit-breakdown | Error state | display | "Unable to load credit data" | N/A | None | requireAuth | WF-065 | HIGH |
| m10 | /my/training | Training list | display | Training cards with status, dates, credits | useQuery | SDK listMyTrainings or similar | requireAuth | WF-065 | HIGH |
| m10 | /org/$orgSlug/training/$trainingId | Enroll button | button | "Enroll" / "Register" | enrollMutation | POST enroll endpoint | requireAuth + member | WF-060 | HIGH |

---

## Registry 2: Journey Completion Matrix

| WF-ID | Workflow Name | Spec Steps | Implemented Steps | Completion | Verdict |
|-------|-------------|------------|-------------------|------------|---------|
| WF-065 | View Credit Summary | 5 (open /my/credits, view cycle info, progress bar, AUTO vs MANUAL breakdown, cross-org aggregation) | 4 (summary cards, entry table, cross-org subtitle; NO progress bar, NO AUTO/MANUAL breakdown filter) | 80% | PARTIAL |
| WF-066 | Add Manual Credit | 3 (navigate to form, fill activity + date + credits, submit) | 3 (form with validation, POST, toast success, reset) | 100% | COMPLETE |
| WF-067 | Officer Credit Adjustment | 4 (select member, view credits, enter adjustment + reason, submit) | 0 (no UI for officer credit adjustment exists) | 0% | MISSING |
| WF-068 | Org Credit Compliance | 3 (open officer/reports/credits, view table with compliance status, filter/sort) | 3 (summary cards with filter, compliance table, status badges) | 95% | COMPLETE |
| WF-069 | Credit Cycle Management | 3 (configure required credits, cycle length, start date) | 3 (required credits, cycle length, SDL cap, start month, save) | 100% | COMPLETE |
| WF-070 | Credit Transcript Export | 2 (download PDF or CSV of credit history) | 0 (no export/download button anywhere) | 0% | MISSING |

### Journey Notes

- **WF-065 PARTIAL**: The `/my/credits` index shows summary stats and a flat entry table, but lacks the progress bar specified in step 3 and the AUTO vs MANUAL breakdown specified in step 4. The org-scoped `/org/$orgSlug/my-cpd` route does show category breakdown (General/Major/Self-Directed) and a credit history list, but still no progress bar. The dashboard `CreditBreakdown` widget has a `CreditRing` which partially fulfills the progress bar requirement, but only appears on the dashboard, not on `/my/credits`. Cross-org aggregation subtitle exists ("across all organizations") but no org-level breakdown is shown on the cross-org view.
- **WF-066 COMPLETE**: Manual credit entry form at `/my/credits/log` has all required fields (activityName, activityDate, creditAmount, description), Zod validation (min 0.5 credits), POST to `/api/persons/me/credit-entries`, success toast, form reset. Matches spec step-for-step. Note: spec says "no approval required" (BR-13), which is correct -- form submits directly without approval workflow.
- **WF-067 MISSING**: The spec defines an officer flow: open member list -> select member -> view their credits -> "Adjust Credits" button -> enter value (positive/negative) + mandatory reason -> submit. No UI exists for this. The officer credits report at `/org/$orgSlug/officer/reports/credits` shows compliance data but has no per-member "Adjust Credits" action. This is the primary gap in m10 frontend.
- **WF-068 COMPLETE**: Officer compliance report at `/org/$orgSlug/officer/reports/credits` implements all 3 spec steps: compliance table with member name, cycle dates, required/earned/remaining, compliance status badges (compliant/at_risk/non_compliant), filter by status via clickable summary cards. Includes PRC-specific note about 45 units per 3-year cycle.
- **WF-069 COMPLETE**: CPD settings at `/org/$orgSlug/officer/settings/cpd` lets officer configure required credits, cycle length (years), SDL cap percentage, and cycle start month. Uses PATCH mutation with sonner toast. Exceeds spec by also including SDL cap (PRC-specific).
- **WF-070 MISSING**: No transcript export functionality exists in the frontend. The "View transcript" link in `CreditBreakdown` navigates to `/my/credits` (the summary page), not a download. The API contract defines `GET /credits/transcript` (PDF/CSV) but no frontend button wires to it.

---

## Registry 3: Element->Action Binding Map

| Element (file:line approx) | Binding Type | Target Function | API Endpoint | Error Handling | Loading State |
|-----------------------------|-------------|----------------|--------------|----------------|---------------|
| credits/index.tsx: Summary cards | useQuery | api.get | GET /api/persons/me/credit-summary | role="alert" error div | CardSkeleton x4 |
| credits/index.tsx: Entry table | useQuery | api.get | GET /api/persons/me/credit-entries | Shared error state | TableSkeleton |
| credits/index.tsx: EmptyState action | onClick | navigate({ to: '/my/credits/log' }) | None | N/A | N/A |
| credits/log.tsx: Form submit | onSubmit (react-hook-form) | api.post | POST /api/persons/me/credit-entries | toast.error('Failed to add credit entry') | isSubmitting disables button |
| my-cpd.tsx: Credit data | useQuery | api.get | GET /api/persons/me/credits | No error UI (falls through to empty) | CardSkeleton x3 |
| officer/reports/credits.tsx: Compliance data | useQuery | api.get | GET /api/credit-compliance/:orgId | No explicit error UI | CardSkeleton x4 + TableSkeleton |
| officer/reports/credits.tsx: Filter buttons | onClick | setFilter(status) | None (client) | N/A | N/A |
| officer/settings/cpd.tsx: Config query | useQuery | api.get | GET /api/association/member/cpd-config/:orgId | No explicit error UI | CardSkeleton |
| officer/settings/cpd.tsx: Save button | onClick | updateMutation.mutate | PATCH /api/association/member/cpd-config/:orgId | toast.error(err.message) | isPending disables + "Saving..." |
| credit-breakdown.tsx: Ring display | props | parent-driven | None (parent fetches) | isError -> alert text | N/A (parent handles) |
| credit-breakdown.tsx: "View transcript" | Link | to="/my/credits" | None | N/A | N/A |
| credit-breakdown.tsx: "Earn more credits" | Link | to="/my/training" | None | N/A | N/A |

---

## Registry 4: Role Journey Completion

| Role | Assigned Journeys | Completable | Blocked By |
|------|-------------------|-------------|------------|
| Member | WF-065 (View Credit Summary) | PARTIAL | No progress bar on /my/credits; no AUTO/MANUAL breakdown filter; CreditRing only on dashboard widget, not on dedicated credits page |
| Member | WF-066 (Add Manual Credit) | COMPLETE | -- |
| Member | WF-070 (Credit Transcript Export) | MISSING | No export/download button anywhere in the UI |
| Officer (President/Secretary) | WF-067 (Officer Credit Adjustment) | MISSING | Entire workflow missing -- no per-member "Adjust Credits" action on compliance report or member detail |
| Officer (President/Secretary) | WF-068 (Org Credit Compliance) | COMPLETE | -- |
| Officer (President/Secretary) | WF-069 (Credit Cycle Management) | COMPLETE | -- |
| Officer (President/Secretary) | WF-070 (Credit Transcript Export) | MISSING | No officer-side transcript export for individual members |
| super/admin | WF-067 (Officer Credit Adjustment) | MISSING | Same as officer -- no adjustment UI |
| super/admin | WF-068 (Org Credit Compliance) | N/A | Platform admin would use admin app, not memberry |
| support | View credits (read-only) | UNMAPPABLE | No support-specific credit views in memberry app |

---

## Registry 5: Dead Interaction Report

| ID | File:Line | Element | Issue | Severity |
|----|-----------|---------|-------|----------|
| J-M10-001 | credit-breakdown.tsx:~28 | "View transcript" Link | Label says "View transcript" but navigates to `/my/credits` (summary page). No actual transcript download/export exists. Misleading label creates expectation of downloadable document. | P1 |
| J-M10-002 | my-cpd.tsx: error handling | Credit data query | `isLoading` check exists but no `isError` handling. If API call fails, component renders with all values as 0/null -- no error indication to user. Silent failure. | P2 |
| J-M10-003 | officer/reports/credits.tsx: compliance query | Compliance data query | No `isError` handling. If API fails, renders with empty summary (all 0s) and empty member list. No error feedback. | P2 |
| J-M10-004 | officer/settings/cpd.tsx: config query | CPD config query | No `isError` handling on initial load. If config load fails, form populates with defaults (60/3/40/1) -- user may unknowingly save defaults over existing config. | P2 |
| J-M10-005 | my-cpd.tsx:~last lines | "Browse Training" / "Browse Events" links | Links use `as any` type casts: `to={'/org/$orgSlug/training' as any}`. Works at runtime but bypasses TanStack Router type safety. | P3 |
| J-M10-006 | credits/index.tsx: Carryover card | Carryover stat card | Hardcoded to `value: 0`. No API field for carryover credits. Always displays 0 regardless of whether member has excess credits from prior cycle (AC-M10-003 specifies carry-forward). | P2 |

---

## Registry 6: Navigation Integrity

| Link/Navigate | Source File | Target Route | Exists? | Severity |
|---------------|-------------|--------------|---------|----------|
| `to="/my/credits"` | credit-breakdown.tsx | `/_authenticated/my/credits/` | YES | -- |
| `to="/my/training"` | credit-breakdown.tsx | `/_authenticated/my/training` | YES | -- |
| `to="/my/credits/log"` | credits/index.tsx (EmptyState) | `/_authenticated/my/credits/log` | YES | -- |
| `href="/my/credits"` | credits/log.tsx (breadcrumb) | `/_authenticated/my/credits/` | YES | -- |
| `to="/org/$orgSlug/training" as any` | my-cpd.tsx | `/_authenticated/org/$orgSlug/training` | YES (but `as any` cast) | P3 |
| `to="/org/$orgSlug/events" as any` | my-cpd.tsx | `/_authenticated/org/$orgSlug/events` | ASSUMED YES | P3 |
| `href="/org/${orgSlug}/officer/dashboard"` | officer/reports/credits.tsx (breadcrumb) | `/_authenticated/org/$orgSlug/officer/dashboard` | YES | -- |
| `/api/persons/me/credit-summary` | credits/index.tsx | API endpoint | UNKNOWN -- not in API_CONTRACTS.md (spec has GET /credits/my) | P1 |
| `/api/persons/me/credit-entries` | credits/index.tsx + log.tsx | API endpoint | UNKNOWN -- not in API_CONTRACTS.md (spec has GET /credits/my) | P1 |
| `/api/persons/me/credits` | my-cpd.tsx | API endpoint | UNKNOWN -- not in API_CONTRACTS.md (spec has GET /credits/my) | P1 |
| `/api/credit-compliance/${orgId}` | officer/reports/credits.tsx | API endpoint | UNKNOWN -- spec has GET /orgs/:orgId/credits/compliance | P1 |
| `/api/association/member/cpd-config/${orgId}` | officer/settings/cpd.tsx | API endpoint | UNKNOWN -- not in API_CONTRACTS.md (no CPD config endpoint in spec) | P2 |

---

## Findings Summary

| ID | Severity | Registry | Finding | File |
|----|----------|----------|---------|------|
| J-M10-001 | P1 | R5 | **Misleading "View transcript" link**: Label implies downloadable transcript (WF-070) but navigates to summary page. No transcript export exists anywhere in frontend. | `apps/memberry/src/features/dashboard/components/credit-breakdown.tsx` |
| J-M10-007 | P1 | R2, R4 | **WF-067 Officer Credit Adjustment entirely missing**: Spec requires officer to select member, view credits, enter adjustment value (pos/neg) + mandatory reason. No UI for this workflow. API contract defines POST /credits/adjust but no frontend wires to it. | N/A (missing feature) |
| J-M10-008 | P1 | R2, R4 | **WF-070 Credit Transcript Export entirely missing**: Spec requires PDF/CSV download of credit history. API contract defines GET /credits/transcript but no frontend download button or export mechanism exists. | N/A (missing feature) |
| J-M10-009 | P1 | R6 | **API endpoint mismatch -- frontend vs spec**: Frontend calls `/api/persons/me/credit-summary`, `/api/persons/me/credit-entries`, `/api/persons/me/credits`, `/api/credit-compliance/:orgId`. API_CONTRACTS.md defines `GET /credits/my`, `POST /credits/manual`, `POST /credits/adjust`, `GET /orgs/:orgId/credits/compliance`, `GET /credits/transcript`. URL paths do not match. Either hand-wired routes exist that differ from spec, or these are pre-spec implementations. | Multiple files |
| J-M10-002 | P2 | R5 | **Silent failure on my-cpd.tsx**: No isError handling on credit data query. API failure renders 0 values with no user feedback. | `apps/memberry/src/routes/_authenticated/org/$orgSlug/my-cpd.tsx` |
| J-M10-003 | P2 | R5 | **Silent failure on compliance report**: No isError handling. API failure shows empty data without error message. | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` |
| J-M10-004 | P2 | R5 | **Dangerous default-over-write on CPD settings**: If config query fails, form defaults (60/3/40/1) render. Officer pressing Save overwrites real config with defaults. | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx` |
| J-M10-006 | P2 | R5 | **Hardcoded carryover = 0**: Credits index always shows 0 carryover. AC-M10-003 specifies excess credits carry forward. API does not surface carryover, UI hardcodes 0. | `apps/memberry/src/routes/_authenticated/my/credits/index.tsx` |
| J-M10-010 | P2 | R2 | **WF-065 missing progress bar**: Spec step 3 requires progress bar showing completion %. CreditRing exists in dashboard widget but not on /my/credits dedicated page. | `apps/memberry/src/routes/_authenticated/my/credits/index.tsx` |
| J-M10-005 | P3 | R5, R6 | **Type-unsafe route links with `as any`**: my-cpd.tsx uses string route paths cast with `as any`, bypassing TanStack Router type checking. | `apps/memberry/src/routes/_authenticated/org/$orgSlug/my-cpd.tsx` |

---

## Architecture Notes

**Dual credit views**: Credit tracking has two parallel entry points -- `/my/credits` (cross-org, on global nav) and `/org/$orgSlug/my-cpd` (org-scoped). The cross-org view fetches from `/api/persons/me/credit-summary` + `/api/persons/me/credit-entries`; the org-scoped view fetches from `/api/persons/me/credits`. These appear to be separate API endpoints returning different shapes. The spec defines only `GET /credits/my` which should handle both via query params. This dual-endpoint pattern may indicate pre-spec implementation that predates API_CONTRACTS.md.

**Officer compliance as client-side filter**: The compliance report fetches all members in one query and filters client-side via `useState`. This works for small orgs but will degrade for large associations (spec performance requirement: p95 < 500ms for compliance report). Server-side pagination and filtering should be added.

**No SDK usage for credit endpoints**: Unlike other modules that use generated `@monobase/sdk-ts` hooks (e.g., `getTrainingOptions`), all credit-related queries use raw `api.get()`/`api.post()` calls. This indicates the credit API endpoints are hand-wired (not generated from TypeSpec), consistent with the MODULE_SPEC noting training module is "hand-wired" with 10 handlers.

**Form validation strength**: The manual credit log form (`/my/credits/log`) uses Zod with react-hook-form in `onBlur` mode -- solid pattern. Validates min 0.5 credits, required activity name and date. Missing: CPD category field (General/Major/Self-Directed) which the org-scoped view (`my-cpd.tsx`) tries to render from `categoryBreakdown`. Without category on entry, breakdown will always be empty or inferred server-side.

**Missing manual credit category field**: The log form collects activityName, activityDate, creditAmount, description -- but not CPD category. The API_CONTRACTS.md POST /credits/manual includes `category` as an optional field. The org-scoped CPD dashboard renders category breakdown (General/Major/Self-Directed) which requires entries to have categories. This is a data integrity gap.
