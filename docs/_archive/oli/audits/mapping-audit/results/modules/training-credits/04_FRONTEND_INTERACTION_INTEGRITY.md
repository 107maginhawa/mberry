# 04 — Frontend Interaction Integrity: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26

---

## Interactive Elements Inventory

### Member: `/org/$orgSlug/training/` (Training Catalog)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Training card click → navigate to detail | Link | None (navigation) | N/A | OK |
| Training list (published filter) | Auto-load query | `GET /association/training?status=published` | `searchTrainings` | OK |

### Member: `/org/$orgSlug/training/$trainingId` (Training Detail)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Enroll button | Button → mutation | `POST /association/training-lifecycle/:trainingId/enroll` via `enrollInCustomTrainingMutation()` | `enroll.ts` | OK — correct SDK hook |
| Training detail load | Auto-load | `GET /association/training/:trainingId` via `getTrainingOptions` | `getTraining` (assumed in generated) | OK |

**Note:** Enrolled state is tracked in local React state (`useState(false)`) — not re-fetched from API after enrollment. Member's enrollment status is lost on page refresh.

### Member: `/my/training` (My Trainings)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| My enrollments list | Auto-load | `GET /association/training-lifecycle/my` via `listMyCustomTrainingsOptions` | `listMyTrainings.ts` | OK |
| Available trainings discovery | Auto-load | `GET /association/training?status=published` | `searchTrainings` | OK |
| Stat cards (enrolled, pending, CPE credits, completed) | Derived from data | Computed from API response | N/A | OK |

### Member: `/my/credits/` (Credit Summary)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Credit summary cards | Auto-load | `GET /api/persons/me/credit-summary` via `api.get()` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |
| Credit entries table | Auto-load | `GET /api/persons/me/credit-entries` via `api.get()` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |
| "Log Manual Credit" link | Link | Navigate to `/my/credits/log` | N/A | OK |

### Member: `/my/credits/log` (Manual Credit Entry)

- **Status:** [NEEDS MANUAL CONFIRMATION] — `log.tsx` file exists but content not audited in detail. Assumed form submission to credit entry endpoint.

### Officer: `/org/$orgSlug/officer/training/new` (Create Training)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Title input | Form field | — | — | OK (form state) |
| Description textarea | Form field | — | — | OK |
| Type select | Form field | — | — | OK |
| Start/End datetime pickers | Form fields | — | — | OK |
| Location input | Form field | — | — | OK |
| Credit amount input | Form field | — | — | OK |
| Capacity input | Form field | — | — | OK |
| Registration fee input | Form field | — | — | OK |
| **"Save Draft" button** | Button → mutation | **`POST /api/training/create/${orgId}`** | **DOES NOT EXIST** | **BROKEN** |
| **"Publish" button** | Button → mutation | **`POST /api/training/create/${orgId}`** | **DOES NOT EXIST** | **BROKEN** |

Evidence from `training-form.tsx`:
```typescript
const url = isEdit
  ? `/api/training/update/${orgId}/${trainingId}`
  : `/api/training/create/${orgId}`
const method = isEdit ? 'PUT' : 'POST'
```
Correct routes are `POST /association/training` and `PATCH /association/training/:trainingId`.

### Officer: `/org/$orgSlug/officer/training/$trainingId` (Training Detail)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Training detail load | Auto-load | `GET /association/training/:trainingId` | `getTraining` | OK — but no org header |
| Details tab | Display | — | — | OK |
| Attendance tab | Display | Sub-page — see `attendance.tsx` | — | [NEEDS MANUAL CONFIRMATION] |
| **Edit tab → TrainingForm** | Form + mutation | **`PUT /api/training/update/${orgId}/${trainingId}`** | **DOES NOT EXIST** | **BROKEN** |

### Officer: `/org/$orgSlug/officer/reports/credits` (Credit Compliance)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Credit compliance table | Auto-load | `GET /api/credit-compliance/${orgId}?requiredCredits=45&cyclePeriodYears=3` | `getCreditCompliance.ts` | OK |
| Filter buttons (all/compliant/at_risk/non_compliant) | Client-side filter | None — filters local data | N/A | OK |

**Note:** `requiredCredits=45` is hard-coded in the frontend call, but the CPD settings page allows officers to configure required credits. This creates a disconnect — the compliance report does not use the org's configured credit requirement.

### Officer: `/org/$orgSlug/officer/settings/cpd` (CPD Settings)

| Element | Type | API Call | Handler | Status |
|---------|------|----------|---------|--------|
| Required credits input | Form field | — | — | OK |
| Cycle length select | Form field | — | — | OK |
| SDL Cap input | Form field | — | — | OK |
| Cycle start month select | Form field | — | — | OK |
| **"Save Configuration" button** | Button → mutation | `PATCH /api/association/member/cpd-config/${orgId}` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |

---

## P0 Findings

### [P0-INT-01] Officer Training Create/Edit Calls Dead Endpoints

- **File:** `apps/memberry/src/features/training/components/training-form.tsx`
- **Evidence:** `POST /api/training/create/${orgId}` and `PUT /api/training/update/${orgId}/${trainingId}` — neither route exists in the API
- **Impact:** Officers cannot create or edit trainings; requests will 404
- **Severity:** P0

---

## P1 Findings

### [P1-INT-02] Enrolled State Not Persisted After Enrollment

- **File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/training/$trainingId.tsx`
- **Evidence:** `const [enrolled, setEnrolled] = useState(false)` — state resets on page refresh; no API check for existing enrollment on page load
- **Impact:** Member who enrolled sees the Enroll button again on refresh; may attempt re-enrollment
- **Severity:** P1

### [P1-INT-03] Credit Compliance Report Uses Hard-Coded `requiredCredits=45`, Ignoring CPD Config

- **File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx`
- **Evidence:** `api.get('/api/credit-compliance/${orgId}?requiredCredits=45&cyclePeriodYears=3')`
- **File:** `officer/settings/cpd.tsx` — officers can set `requiredCredits` (defaults to 60 in that page) and `cycleLengthYears`
- **Impact:** Report may show incorrect compliance status; PRC note in UI says "45 credits" but settings page defaults to "60 credits" — inconsistency
- **Severity:** P1

---

## P2 Findings

### [P2-INT-04] Training Type Mismatch Between Frontend and Backend

- **Frontend types** (`training-form.tsx`): `seminar, workshop, convention, online_course, skills_training`
- **AC-M09-004 domain types**: `seminar, workshop, webinar, conference, self-paced`
- **Impact:** Frontend allows creating `convention`, `online_course`, `skills_training` which are not valid platform types; backend allows `webinar`, `conference`, `self-paced` not offered in frontend
- **Severity:** P2

### [P2-INT-05] No Loading State Shown When Enroll Mutation Fails

- **File:** `$orgSlug/training/$trainingId.tsx`
- **Evidence:** `onError: (err: any) => toast.error(...)` — uses toast, which is correct per conventions; but no retry affordance or error UI inline
- **Severity:** P2

### [P2-INT-06] No Confirmation Dialog on Training Cancel

- **Evidence:** `cancelTraining.ts` handler exists; no frontend button/dialog found in audited files for member or officer cancel action
- **Severity:** P2 — [NEEDS MANUAL CONFIRMATION] if cancel UI exists somewhere
