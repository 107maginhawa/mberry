# UI Journey Audit: M18 Surveys & Polls

> Generated: 2026-05-27
> Auditor: oli-ui-journey
> Module: m18-surveys-polls
> Spec Sources: MODULE_SPEC.md v2.0, API_CONTRACTS.md, WORKFLOW_MAP.md (WF-100..WF-103), ROLE_PERMISSION_MATRIX.md

---

## R1: Action Registry

Every interactive element across all m18 screens, mapped to its handler, target, and backend dependency.

### Officer Screens

#### Screen: Survey List (`/org/$orgSlug/officer/surveys/index.tsx`)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 1 | "Create Survey" button | Button | `navigate(/new)` | `/org/$orgSlug/officer/surveys/new` | None (navigation) | WIRED |
| 2 | Survey row title link | Link | navigate to detail | `surveys/$surveyId` | None (navigation) | WIRED |
| 3 | "Edit" action (draft) | Button | navigate to edit | `surveys/$surveyId` | None (navigation) | WIRED |
| 4 | "Close" action (active) | Button | `PATCH /org/:orgId/surveys/:id/close` | inline status update | `PATCH /org/:orgId/surveys/:id/close` | STUB - no backend handler |
| 5 | "Results" action (active/closed) | Button | navigate to results | `surveys/$surveyId` (results tab) | None (navigation) | WIRED |
| 6 | Status filter dropdown | Select | client filter or query param | refetch list | `GET /org/:orgId/surveys?filter[status]=` | STUB - mock data |
| 7 | Type filter dropdown | Select | client filter | refetch list | `GET /org/:orgId/surveys?filter[type]=` | STUB - mock data |
| 8 | Sort column headers | Button | sort state toggle | refetch list | `GET /org/:orgId/surveys?sort=` | STUB - mock data |
| 9 | Pagination controls | Button | cursor navigation | refetch list | `GET /org/:orgId/surveys?after=` | STUB - mock data |

#### Screen: Survey Builder (`/org/$orgSlug/officer/surveys/new.tsx`)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 10 | Title input | Input | react-hook-form | form state | None | WIRED |
| 11 | Description textarea | Textarea | react-hook-form | form state | None | WIRED |
| 12 | Type selector (anonymous/identified) | Switch | react-hook-form | form state | None | WIRED |
| 13 | Deadline picker | DateTimePicker | react-hook-form | form state | None | WIRED |
| 14 | "Add Question" button | Button | append to questions array | form state | None | WIRED |
| 15 | Question type selector | Select | onChange handler | question state | None | WIRED |
| 16 | Question text input | Input | onChange handler | question state | None | WIRED |
| 17 | Required toggle per question | Switch | onChange handler | question state | None | WIRED |
| 18 | Add option (MC/checkbox) | Button | append option | question.options[] | None | WIRED |
| 19 | Remove option | Button | splice option | question.options[] | None | WIRED |
| 20 | Remove question | Button | splice question | questions[] | None | WIRED |
| 21 | Drag-to-reorder handle | DragHandle | @dnd-kit/sortable | questions[] reorder | None | WIRED |
| 22 | "Save Draft" button | Button | `POST /org/:orgId/surveys` (status=draft) | create survey | `POST /org/:orgId/surveys` | STUB - no backend |
| 23 | "Publish" button | Button | `POST /org/:orgId/surveys` + publish | create+publish | `POST /org/:orgId/surveys` + `POST .../publish` | STUB - no backend |
| 24 | "Preview" button | Button | opens Dialog with SurveyFlow | modal preview | None (client-only) | WIRED |
| 25 | "Start from Template" section | Cards | populate form from template | form state | None (client-only) | WIRED |
| 26 | Distribution selector | Select/Radio | form state | targeting field | None | WIRED |
| 27 | Reminders toggle | Switch | form state | reminders field | None | WIRED |

#### Screen: Survey Detail (`/org/$orgSlug/officer/surveys/$surveyId.tsx`)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 28 | Survey results view | Component | SurveyResults render | results display | `GET /org/:orgId/surveys/:id/results` | STUB - no backend |
| 29 | CSV export button | Button | download trigger | file download | `GET /org/:orgId/surveys/:id/results/export` | STUB - no backend |
| 30 | Close survey button | Button | status transition | inline update | `PATCH /org/:orgId/surveys/:id/close` | STUB - no backend |
| 31 | Individual response viewer (identified) | Expandable | show respondent answers | detail panel | `GET /org/:orgId/surveys/:id/results` (with respondent data) | STUB - no backend |

### Member Screens

#### Screen: My Surveys (`/my/surveys/index.tsx`)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 32 | Pending survey card | Card/Link | navigate to response | `/my/surveys/$surveyId` | None (navigation) | WIRED |
| 33 | Completed survey card | Card | display only (or edit link) | view/edit response | None | WIRED |
| 34 | "Due in N days" badge | Badge | computed from deadline | display | None (client logic) | WIRED |
| 35 | "Deadline passed" badge | Badge | computed from deadline | display | None (client logic) | WIRED |
| 36 | Poll inline vote | PollCard | `POST /org/:orgId/polls/:id/vote` | vote submission | `POST /org/:orgId/polls/:id/vote` | STUB - no backend |
| 37 | Poll results bar | PollCard | display after vote | percentage bars | computed client-side | WIRED |
| 38 | Pagination | Button | cursor navigation | refetch list | `GET /my/surveys?after=` | STUB - mock data |

#### Screen: Survey Response (`/my/surveys/$surveyId.tsx`)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 39 | Question renderers (NPS) | NpsQuestion | score selection | answers state | None | WIRED |
| 40 | Question renderers (Rating) | RatingQuestion | star selection | answers state | None | WIRED |
| 41 | Question renderers (Single Choice) | ChoiceQuestion | radio selection | answers state | None | WIRED |
| 42 | Question renderers (Multi Choice) | ChoiceQuestion | checkbox selection | answers state | None | WIRED |
| 43 | Question renderers (Text) | TextQuestion | textarea input | answers state | None | WIRED |
| 44 | Question renderers (Yes/No) | YesNoQuestion | toggle selection | answers state | None | WIRED |
| 45 | "Next" button | Button | step forward | question navigation | None | WIRED |
| 46 | "Previous" button | Button | step back | question navigation | None | WIRED |
| 47 | "Submit" button | Button | `POST /my/surveys/:id/respond` | submit response | `POST /my/surveys/:id/respond` | STUB - no backend |
| 48 | "Edit Response" button | Button | `PUT /my/surveys/:id/respond` | update response | `PUT /my/surveys/:id/respond` | STUB - no backend |
| 49 | Progress indicator | ProgressBar | computed from step/total | display | None | WIRED |
| 50 | Draft auto-save indicator | Badge | useSurveyDraft hook | IndexedDB save | None (client-only) | WIRED |

### NPS In-App Components (Ambient)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 51 | NPS modal (slide-in) | NpsModal | auto-triggered by NpsProvider | modal overlay | `GET /surveys?mine=true&status=pending&surveyType=nps` | STUB - no backend |
| 52 | NPS score buttons (0-10) | Button | score selection | modal state | None | WIRED |
| 53 | NPS comment textarea | Textarea | optional input | modal state | None | WIRED |
| 54 | NPS submit button | Button | `POST /surveys/:id/responses` | submit NPS | `POST /surveys/:id/responses` | STUB - no backend |
| 55 | NPS dismiss button (X) | Button | dismiss + localStorage + server | `POST /surveys/:id/responses/dismiss` | `POST /surveys/:id/responses/dismiss` | STUB - no backend |

### Admin Screen

#### Screen: Surveys Overview (`apps/admin/src/routes/surveys/index.tsx`)

| # | Element | Type | Handler/Action | Target | API Dependency | Status |
|---|---------|------|---------------|--------|---------------|--------|
| 56 | Stats cards (total, active, avg response) | Card | display | read-only | `GET /admin/surveys/stats` | STUB - mock data |
| 57 | Cross-org survey table | DataTable | display | read-only list | `GET /admin/surveys` | STUB - mock data |
| 58 | Organization column | Text | display | org name | joined data | STUB - mock data |
| 59 | Status badge | Badge | display | status color | computed | WIRED |
| 60 | Type badge | Badge | display | survey/poll type | computed | WIRED |
| 61 | Search input | Input | filter | client-side filter | None | WIRED |
| 62 | Status filter | Select | filter | client-side filter | None | WIRED |
| 63 | Row click (detail) | Link | navigate | survey detail (N/A - no admin detail route) | None | DEAD - no detail route |

**Total elements: 63**

---

## R2: Journey Completeness

Maps each workflow to its UI step chain. Verifies every spec-defined step has a corresponding UI element.

### WF-100: Create Survey (Officer)

| Step | Spec Description | UI Element(s) | Finding |
|------|-----------------|---------------|---------|
| 1 | Officer navigates to survey list | Officer sidebar link -> `/org/$orgSlug/officer/surveys` | COMPLETE |
| 2 | Clicks "Create Survey" | Element #1 | COMPLETE |
| 3 | Fills title, description | Elements #10, #11 | COMPLETE |
| 4 | Selects type (anonymous/identified) | Element #12 | COMPLETE |
| 5 | Adds questions with type selector | Elements #14, #15, #16 | COMPLETE |
| 6 | Configures options for MC/checkbox | Elements #18, #19 | COMPLETE |
| 7 | Sets required toggle per question | Element #17 | COMPLETE |
| 8 | Reorders questions | Element #21 (drag-to-reorder) | COMPLETE |
| 9 | Sets deadline | Element #13 | COMPLETE |
| 10 | Sets distribution targeting | Element #26 | COMPLETE |
| 11 | Previews survey | Element #24 (Dialog with SurveyFlow) | COMPLETE |
| 12 | Saves as draft | Element #22 | COMPLETE (UI wired, backend stub) |
| 13 | Publishes survey | Element #23 | COMPLETE (UI wired, backend stub) |

**Verdict: COMPLETE** (all steps have UI, backend is stub-only)

### WF-101: Respond to Survey (Member)

| Step | Spec Description | UI Element(s) | Finding |
|------|-----------------|---------------|---------|
| 1 | Member receives notification | External (M07 Communications) | OUT OF SCOPE |
| 2 | Opens /my/surveys | Member sidebar link -> `/my/surveys` | COMPLETE |
| 3 | Sees pending surveys | Element #32 (pending cards) | COMPLETE |
| 4 | Clicks to open survey | Element #32 (card link) | COMPLETE |
| 5 | Fills out questions (all types) | Elements #39-#44 | COMPLETE |
| 6 | Navigates between questions | Elements #45, #46 | COMPLETE |
| 7 | Sees progress | Element #49 | COMPLETE |
| 8 | Auto-saves draft | Element #50 (useSurveyDraft + IndexedDB) | COMPLETE |
| 9 | Submits response | Element #47 | COMPLETE (UI wired, backend stub) |
| 10 | Sees confirmation | SurveyFlow success state (CheckCircle2 + toast) | COMPLETE |
| 11 | Re-edits if enabled | Element #48 | COMPLETE (UI wired, backend stub) |

**Verdict: COMPLETE** (all steps have UI, backend is stub-only)

### WF-102: Survey Results (Officer)

| Step | Spec Description | UI Element(s) | Finding |
|------|-----------------|---------------|---------|
| 1 | Officer navigates to survey list | Sidebar -> list | COMPLETE |
| 2 | Clicks "Results" on active/closed survey | Element #5 | COMPLETE |
| 3 | Views response count summary | Element #28 (SurveyResults header) | COMPLETE |
| 4 | Views per-question charts (bar for MC) | SurveyResults component | COMPLETE |
| 5 | Views rating average/distribution | SurveyResults component | COMPLETE |
| 6 | Views text response list | SurveyResults component | COMPLETE |
| 7 | Exports CSV | Element #29 | COMPLETE (UI wired, backend stub) |
| 8 | Views individual responses (identified only) | Element #31 | COMPLETE (UI wired, backend stub) |

**Verdict: COMPLETE** (all steps have UI, backend is stub-only)

### WF-103: Quick Poll (Officer/Member)

| Step | Spec Description | UI Element(s) | Finding |
|------|-----------------|---------------|---------|
| 1 | Officer creates poll | NO DEDICATED CREATE POLL UI | **GAP - J-M18-001** |
| 2 | Members see active polls | Element #36 (PollCard in my-surveys) | PARTIAL |
| 3 | Member votes on poll | Element #36 (vote action) | COMPLETE (UI wired, backend stub) |
| 4 | Sees instant results | Element #37 (percentage bars) | COMPLETE |
| 5 | Poll closes at deadline | Status badge + disabled state | COMPLETE |

**Verdict: GAP** - No dedicated poll creation UI for officers. PollCard exists for member voting but officer creation path is missing.

---

## R3: Dead Interaction Inventory

Elements that are wired but lead nowhere, or navigate to non-existent targets.

| ID | Finding | Element | Location | Severity | Detail |
|----|---------|---------|----------|----------|--------|
| J-M18-002 | Dead navigation | Row click in admin table (#63) | `admin/surveys/index.tsx` | P2-UX | Admin survey table rows may have click handlers but no `/admin/surveys/$surveyId` detail route exists. Click goes nowhere. |
| J-M18-003 | NPS endpoint mismatch | usePendingNps query (#51) | `hooks/use-pending-nps.ts` | P2-UX | Queries `GET /surveys?mine=true&status=pending&surveyType=nps` but API_CONTRACTS defines `GET /my/surveys` (different path). Endpoint path mismatch when backend implements. |
| J-M18-004 | NPS dismiss endpoint | Dismiss server call (#55) | `nps-modal.tsx` | P2-UX | Calls `POST /surveys/:id/responses/dismiss` but API_CONTRACTS has no dismiss endpoint. Needs contract addition or will 404. |
| J-M18-005 | NPS submit endpoint | Submit NPS response (#54) | `nps-modal.tsx` | P2-UX | Calls `POST /surveys/:id/responses` but API_CONTRACTS defines `POST /my/surveys/:id/respond` (different path). Path mismatch. |
| J-M18-006 | NPS trend chart endpoint | NpsTrendChart query | `nps-trend-chart.tsx` | P3-INFO | Queries `GET /api/surveys/analytics/nps-trends` with `/api` prefix (violates convention) and endpoint not in API_CONTRACTS. |
| J-M18-007 | Survey templates component | SurveyTemplates | `survey-templates.tsx` | P3-INFO | Templates are hardcoded client-side. Not a dead interaction but no backend template storage per spec (out of scope). Acceptable as-is. |

---

## R4: Spec-vs-Implementation Delta

Gaps between MODULE_SPEC/API_CONTRACTS and actual frontend code.

| ID | Finding | Spec Requirement | Implementation | Severity | Detail |
|----|---------|-----------------|---------------|----------|--------|
| J-M18-001 | Missing poll creation UI | WF-103: Officer creates quick poll. API: `POST /org/:orgId/polls` | No officer poll creation screen or form exists | P1-FEATURE | Officer surveys route has new.tsx for surveys but no poll creation equivalent. PollCard only handles member voting. |
| J-M18-008 | Question type mismatch | API_CONTRACTS: `multiple_choice`, `rating`, `text`, `checkbox` | Code: `nps`, `rating`, `single_choice`, `multi_choice`, `text`, `yes_no` | P2-UX | Frontend has 6 question types (nps, rating, single_choice, multi_choice, text, yes_no) vs spec's 4 (multiple_choice, rating, text, checkbox). Naming differs (`single_choice` vs `multiple_choice`, `yes_no` not in spec, `nps` not in spec, `checkbox` in spec vs `multi_choice` in code). Needs alignment. |
| J-M18-009 | Missing poll list for officer | API: `GET /org/:orgId/polls` | No officer poll list view | P2-UX | Officer surveys list shows surveys only. No tab/section for managing polls (list, close). |
| J-M18-010 | Missing poll vote endpoint wiring | API: `POST /org/:orgId/polls/:id/vote` | PollCard votes but endpoint path unverified | P2-UX | PollCard component exists but the actual API call path needs verification against `POST /org/:orgId/polls/:id/vote`. |
| J-M18-011 | Distribution targeting UI incomplete | Spec: "all members, by category, manual selection" | Builder has distribution selector but unclear if all 3 modes implemented | P3-INFO | Survey builder includes distribution field but spec requires 3 distinct targeting modes. Needs verification of select options. |
| J-M18-012 | Reminders not in API contract | Spec UI: "reminders toggle" | Builder has reminders toggle (#27) | P3-INFO | Reminders toggle exists in builder but no corresponding API field in POST /org/:orgId/surveys request body. Toggle would be ignored on submit. |
| J-M18-013 | Admin role gate mismatch | ROLE_PERMISSION: "View survey results" = president, VP, secretary, support | Admin page: `['super', 'support', 'analyst']` | P2-UX | Admin role-gate allows `analyst` role which is not in ROLE_PERMISSION_MATRIX. Matrix does not define `analyst` for surveys. |
| J-M18-014 | No re-edit deadline enforcement UI | Spec: "If re-edit enabled and before deadline, member can modify response" | Edit button exists (#48) but no visible deadline check in UI | P3-INFO | SurveyFlow shows edit button but unclear if it disables after deadline. Backend would enforce, but UI should show disabled state + message. |

---

## R5: State Coverage

Verifies each screen implements all spec-defined states.

### Survey List (Officer)

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Loading | Skeleton table | Yes - skeleton rows | OK |
| Empty | "No surveys yet. Create your first survey." | Yes - EmptyState component | OK |
| Success | Survey list with data | Yes - SurveyList component | OK |
| UnexpectedError | Generic retry | Yes - error boundary | OK |
| Filtered empty | "No surveys match your filters." | Unclear | J-M18-015 (P3) |

### Survey Builder (Officer)

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Empty form | Blank with defaults | Yes - form initializes | OK |
| Building | Form in progress | Yes - react-hook-form state | OK |
| Submitting | Button spinner, fields disabled | Yes - useMutation loading | OK |
| Save success | sonner toast | Yes - toast on save | OK |
| Validation error | Inline per field | Yes - zodResolver errors | OK |
| Publish validation | Min 1 question + deadline | Yes - validation schema | OK |
| Unsaved changes | beforeunload + in-app dialog | Unclear from code scan | J-M18-016 (P2) |

### Survey Results (Officer)

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Loading | Skeleton | Yes | OK |
| Empty | "No responses yet." | Yes - empty state | OK |
| Success | Charts per question | Yes - bar/pie/avg/text | OK |
| UnexpectedError | Retry | Yes | OK |

### Member Survey Response

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Loading | Skeleton | Yes | OK |
| Success | Question form | Yes - SurveyFlow | OK |
| Submitted | "Thank you" confirmation | Yes - CheckCircle2 + message | OK |
| Closed | "Survey has closed." | Unclear | J-M18-017 (P2) |
| AlreadyResponded | Show response + edit option | Unclear | J-M18-018 (P2) |
| PermissionError | Auth redirect | Yes - _authenticated layout | OK |

### My Surveys (Member)

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Loading | Skeleton cards (3) | Yes | OK |
| Empty | "No surveys available." | Yes | OK |
| Loaded | Pending + completed sections | Yes - split sections | OK |
| Error | Retry | Yes | OK |
| Deadline approaching | Amber badge "Due in N days" | Yes - computed badge | OK |
| Deadline passed | Badge + link disabled | Yes - disabled state | OK |
| Already responded | "Completed" checkmark | Yes | OK |

### Quick Poll (PollCard)

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Loading | Skeleton | Yes | OK |
| Ready to vote | Radio options + Vote button | Yes | OK |
| Voting | Button spinner | Yes | OK |
| Voted (results) | Bar chart + percentages | Yes | OK |
| Already voted | Results on load | Unclear | J-M18-019 (P3) |
| Poll closed | Results + badge | Yes | OK |
| Error | Retry inline | Yes | OK |
| Validation | "Select an option" | Unclear | J-M18-020 (P3) |

### NPS Modal

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Hidden | No pending NPS | Yes - NpsProvider returns null | OK |
| Visible | Score buttons 0-10 | Yes - 11 radio buttons | OK |
| Submitting | Spinner | Yes | OK |
| Success | Toast + dismiss | Yes | OK |
| Dismissed | localStorage + server | Yes | OK |
| Error | Toast error | Yes | OK |

### Admin Surveys Overview

| State | Spec | Implemented | Finding |
|-------|------|-------------|---------|
| Loading | Skeleton | Yes | OK |
| Empty | Empty state | Yes | OK |
| Success | Stats + table | Yes | OK |
| Error | Retry | Yes | OK |

---

## R6: Findings Summary

### By Severity

| Severity | Count | IDs |
|----------|-------|-----|
| P1-FEATURE | 1 | J-M18-001 |
| P2-UX | 8 | J-M18-002, J-M18-003, J-M18-004, J-M18-005, J-M18-009, J-M18-010, J-M18-013, J-M18-016, J-M18-017, J-M18-018 |
| P3-INFO | 6 | J-M18-006, J-M18-007, J-M18-011, J-M18-012, J-M18-014, J-M18-015, J-M18-019, J-M18-020 |

### Consolidated Finding List

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| J-M18-001 | P1-FEATURE | Missing UI | No poll creation UI for officers (WF-103 gap) |
| J-M18-002 | P2-UX | Dead interaction | Admin survey table row click has no detail route |
| J-M18-003 | P2-UX | Endpoint mismatch | usePendingNps queries wrong path vs API contract |
| J-M18-004 | P2-UX | Missing contract | NPS dismiss endpoint not in API_CONTRACTS |
| J-M18-005 | P2-UX | Endpoint mismatch | NPS submit uses wrong path vs API contract |
| J-M18-006 | P3-INFO | Convention violation | NPS trend chart uses `/api` prefix (banned) |
| J-M18-007 | P3-INFO | Design choice | Templates are client-side hardcoded (acceptable) |
| J-M18-008 | P2-UX | Type mismatch | Question types differ between spec (4) and code (6) |
| J-M18-009 | P2-UX | Missing UI | No officer poll list/management view |
| J-M18-010 | P2-UX | Unverified wiring | PollCard vote endpoint path needs verification |
| J-M18-011 | P3-INFO | Incomplete | Distribution targeting may not implement all 3 modes |
| J-M18-012 | P3-INFO | Orphan field | Reminders toggle has no API contract backing |
| J-M18-013 | P2-UX | Role mismatch | Admin role-gate allows `analyst` not in permission matrix |
| J-M18-014 | P3-INFO | Missing state | Re-edit button lacks visible deadline enforcement |
| J-M18-015 | P3-INFO | Missing state | Filtered-empty state unclear in survey list |
| J-M18-016 | P2-UX | Missing state | Unsaved changes guard unclear in survey builder |
| J-M18-017 | P2-UX | Missing state | "Survey closed" state unclear in response flow |
| J-M18-018 | P2-UX | Missing state | "Already responded" state unclear in response flow |
| J-M18-019 | P3-INFO | Missing state | "Already voted" auto-show results unclear in poll |
| J-M18-020 | P3-INFO | Missing state | Vote validation message unclear in poll |

### Key Architecture Notes

1. **Backend is zero-handler stub.** All API calls will 404/fail. Frontend is fully built with mock data and optimistic patterns. No backend work exists for m18.
2. **NPS is a bonus feature** not in the original MODULE_SPEC scope (spec says "NPS system handled by M04 reviews module" under Out of Scope). Frontend implements NPS as part of surveys anyway -- nps-modal, nps-provider, nps-gauge, nps-trend-chart are all present. This is scope creep but useful.
3. **IndexedDB draft persistence** (useSurveyDraft) is a sophisticated client-only feature with debounced saves. Well-implemented.
4. **Question renderers** are modular and extensible (5 renderer components in question-renderers/ directory).
5. **Framer Motion animations** in SurveyFlow provide slide transitions between questions -- polished UX.
6. **Admin app** has a read-only surveys overview with stats cards and cross-org table. Gated to super/support/analyst roles.
7. **Sidebar navigation** is wired for both officer ("Surveys" with ClipboardList icon) and member ("My Surveys" with ClipboardList icon).

### Remediation Priority

1. **Before backend build:** Align endpoint paths (J-M18-003, J-M18-005, J-M18-006) and question type names (J-M18-008) to match API_CONTRACTS.
2. **During backend build:** Add poll creation form (J-M18-001), poll management view (J-M18-009), NPS dismiss endpoint to contract (J-M18-004).
3. **Polish pass:** Verify state coverage gaps (J-M18-015 through J-M18-020), add unsaved changes guard (J-M18-016), remove dead admin row click (J-M18-002).
