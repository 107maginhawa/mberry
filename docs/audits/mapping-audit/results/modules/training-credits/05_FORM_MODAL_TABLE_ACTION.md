# 05 — Form, Modal & Table Action Audit: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26

---

## Forms Inventory

### Training Create/Edit Form (`training-form.tsx`)

**File:** `apps/memberry/src/features/training/components/training-form.tsx`

| Field | Frontend Validation | Backend Validation | Match? |
|-------|--------------------|--------------------|--------|
| `title` (required) | Required check before button enable (`!form.title`) | `CreateTrainingBody` via zValidator | OK — but backend validator not inspected in detail |
| `description` | Optional | Optional | OK |
| `type` (select) | Constrained to 5 values: `seminar, workshop, convention, online_course, skills_training` | Domain types: `seminar, workshop, webinar, conference, self-paced` | **MISMATCH** |
| `startDate` (required) | Required check before button enable (`!form.startDate`) | Validated in body | OK |
| `endDate` | Optional | Optional | OK |
| `location` | Optional string | Optional | OK |
| `creditAmount` | Parsed as float, defaults to 0 | Number | OK |
| `registrationFee` | Parsed as int, defaults to 0 | Number | OK |
| `capacity` | Optional int | Optional | OK |
| Status (`draft`/`published`) | Set by button choice | Rejected via `updateTraining.ts` if sent directly | **Note: create passes status in payload; update explicitly blocks status changes** |

**Critical issue:** The entire form posts to non-existent endpoints (see P0-INT-01). Validation is moot until endpoint is fixed.

**Missing frontend validation:**
- No check that `endDate` > `startDate`
- No check that `registrationFee` >= 0
- No check that `creditAmount` >= 0

### Enrollment (Member Enroll Button)

**File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/training/$trainingId.tsx`

| Aspect | Status |
|--------|--------|
| No form fields — single button click | N/A |
| Backend validates: membership active, training not completed/cancelled, fee=0 | YES — in `enroll.ts` |
| Frontend shows success toast | YES (`sonner`) |
| Frontend shows error toast | YES |
| No confirmation dialog before enrolling | MISSING — [NEEDS PRODUCT DECISION] whether confirmation is required |

### Manual Credit Log Form

**File:** `apps/memberry/src/routes/_authenticated/my/credits/log.tsx`

- **Status:** [NEEDS MANUAL CONFIRMATION] — file exists but was not fully audited. Expected to contain a form for manual credit entry.

### CPD Settings Form (`cpd.tsx`)

**File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx`

| Field | Frontend Validation | Backend Validation | Notes |
|-------|--------------------|--------------------|-------|
| `requiredCredits` | Number input, min implied | Unknown | [NEEDS MANUAL CONFIRMATION] |
| `cycleLengthYears` | Select (values 1–5 assumed) | Unknown | [NEEDS MANUAL CONFIRMATION] |
| `sdlCapPercent` | Number input, min=0 max=100 | Unknown | OK client-side |
| `cycleStartMonth` | Select (1–12) | Unknown | OK client-side |

**Note:** No explicit validation error display — errors shown only via `toast.error`. No field-level error messages.

---

## Destructive Actions Audit

| Action | UI Trigger | Confirmation Dialog | Backend guard |
|--------|-----------|---------------------|---------------|
| Cancel training | [NEEDS MANUAL CONFIRMATION — no cancel button found in audited pages] | MISSING | `cancelTraining.ts` has state checks |
| Delete training | [NEEDS MANUAL CONFIRMATION — no delete button found in audited officer pages] | MISSING | `DELETE /association/training/:trainingId` exists |
| Delete accredited provider | [NEEDS MANUAL CONFIRMATION] | [UNKNOWN] | `deleteAccreditedProvider.ts` exists |
| Mark training complete | Attendance tab (assumed) | [NEEDS MANUAL CONFIRMATION] | `markComplete.ts` checks end date passed |
| Delete course enrollment | `DELETE /association/training/courses/enrollments/:enrollmentId` | [NO FRONTEND FOUND] | Route exists |

**P1 Finding:** No confirmation dialogs were verified for any destructive training action in the audited code. Cancel and Delete are particularly risky with no confirmation.

---

## Tables / Lists

### Training List (Officer) — `training-list.tsx` component

**File:** `apps/memberry/src/features/training/components/training-list.tsx`
- **Contents:** [NEEDS MANUAL CONFIRMATION] — component exists but not fully read
- **Expected:** List of trainings with status, date, enrollment count, action links

### Training List (Member) — `org/training/index.tsx`

| Aspect | Status |
|--------|--------|
| Shows published trainings only | YES — filters `status: 'published'` |
| Links to training detail | YES |
| Empty state | YES — `EmptyState` component |
| Loading skeleton | YES — `CardSkeleton` |
| Pagination | NOT FOUND — slice `.slice(0, 6)` in `/my/training` suggests truncation without pagination |

### Credit Compliance Table (Officer) — `officer/reports/credits.tsx`

| Aspect | Status |
|--------|--------|
| Shows member name, ID, earned credits, breakdown, required, remaining, status | YES |
| Category breakdown (General, Major, Self-Directed) | YES |
| Filter by status (all/compliant/at_risk/non_compliant) | YES — client-side |
| Export/download | NOT FOUND |
| Pagination | NOT FOUND |
| Loading state | YES — `TableSkeleton` |

---

## P1 Findings

### [P1-FORM-01] No Confirmation on Destructive Actions

- **Evidence:** No dialog/confirm components found for cancel, delete, or mark-complete flows in audited frontend files
- **Severity:** P1 — risk of accidental destructive action

### [P1-FORM-02] Training Type Values Inconsistent Between Form and Domain

- **Form options:** `seminar, workshop, convention, online_course, skills_training`
- **Domain constants (AC-M09-004):** `seminar, workshop, webinar, conference, self-paced`
- **Impact:** Creating trainings with `convention` or `online_course` types may fail validation or store invalid values
- **Severity:** P1

---

## P2 Findings

### [P2-FORM-03] No Date Range Validation (endDate > startDate)

- **File:** `training-form.tsx`
- **Evidence:** No comparison check between `startDate` and `endDate` fields before submission
- **Severity:** P2

### [P2-FORM-04] CPD Config Form — No Field-Level Error Feedback

- **File:** `officer/settings/cpd.tsx`
- **Evidence:** Only `toast.error` on save failure; no inline field errors
- **Severity:** P2

### [P2-FORM-05] Credit Compliance Table — Hard-Coded Required Credits

- **File:** `officer/reports/credits.tsx`
- **Evidence:** `requiredCredits=45` hard-coded; CPD settings page shows 60 as default
- **Note:** PRC standard is 45 units per 3-year cycle, but CPD settings allows configuration — [NEEDS PRODUCT DECISION] which value governs the compliance report
- **Severity:** P2

### [P2-FORM-06] No Pagination on Training Lists

- **Evidence:** No pagination controls in `org/training/index.tsx` or `my/training.tsx`; API query has no `limit`/`offset` params sent from frontend
- **Severity:** P2
