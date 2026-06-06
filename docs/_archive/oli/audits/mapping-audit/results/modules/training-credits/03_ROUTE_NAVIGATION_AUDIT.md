# 03 — Route & Navigation Audit: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26

---

## Frontend Routes Inventory

### Member Routes

| Frontend Route | File | Description |
|---------------|------|-------------|
| `/my/training` | `_authenticated/my/training.tsx` | Member's enrolled trainings (global, no org context) |
| `/my/credits/` | `_authenticated/my/credits/index.tsx` | Member credit summary + log |
| `/my/credits/log` | `_authenticated/my/credits/log.tsx` | Manual credit log form |
| `/org/$orgSlug/training/` | `_authenticated/org/$orgSlug/training/index.tsx` | Org-scoped training catalog (published only) |
| `/org/$orgSlug/training/$trainingId` | `_authenticated/org/$orgSlug/training/$trainingId.tsx` | Training detail + enroll button |
| `/org/$orgSlug/my-cpd` | `_authenticated/org/$orgSlug/my-cpd.tsx` | Org-scoped CPD tracker |

### Officer Routes

| Frontend Route | File | Description |
|---------------|------|-------------|
| `/org/$orgSlug/officer/training/` | `officer/training/index.tsx` | Training management list |
| `/org/$orgSlug/officer/training/new` | `officer/training/new.tsx` | Create training form |
| `/org/$orgSlug/officer/training/$trainingId` | `officer/training/$trainingId.tsx` | Training detail (edit + attendance tabs) |
| `/org/$orgSlug/officer/training/$trainingId/attendance` | `officer/training/$trainingId/attendance.tsx` | Attendance management sub-page |
| `/org/$orgSlug/officer/reports/credits` | `officer/reports/credits.tsx` | Credit compliance report |
| `/org/$orgSlug/officer/settings/cpd` | `officer/settings/cpd.tsx` | CPD cycle configuration |

---

## Backend API Routes Inventory

### Generated Routes (`/association/training*`)

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/association/training` | `createTraining` |
| `GET` | `/association/training` | `searchTrainings` |
| `GET` | `/association/training/:trainingId` | `getTraining` |
| `PATCH` | `/association/training/:trainingId` | `updateTraining` |
| `DELETE` | `/association/training/:trainingId` | `deleteTraining` |
| `POST` | `/association/training/:trainingId/publish` | `publishTraining` |
| `GET` | `/association/training-lifecycle/my` | `listMyCustomTrainings` |
| `POST` | `/association/training-lifecycle/:trainingId/cancel` | `cancelCustomTraining` |
| `POST` | `/association/training-lifecycle/:trainingId/check-in` | `checkInCustomTraining` |
| `POST` | `/association/training-lifecycle/:trainingId/complete` | `completeCustomTraining` |
| `POST` | `/association/training-lifecycle/:trainingId/enroll` | `enrollInCustomTraining` |
| `GET` | `/association/training-lifecycle/:trainingId/enrollments` | `listCustomTrainingEnrollments` |
| `POST` | `/association/training/courses` | `createCourse` |
| `GET` | `/association/training/courses` | `searchCourses` |
| `GET` | `/association/training/courses/:courseId` | `getCourse` |
| `PATCH` | `/association/training/courses/:courseId` | `updateCourse` |
| `DELETE` | `/association/training/courses/:courseId` | `deleteCourse` |
| `POST` | `/association/training/courses/enrollments` | `createCourseEnrollment` |
| `GET` | `/association/training/courses/enrollments` | `searchCourseEnrollments` |
| `GET` | `/association/training/courses/enrollments/:enrollmentId` | `getCourseEnrollment` |
| `PATCH` | `/association/training/courses/enrollments/:enrollmentId` | `updateCourseEnrollment` |
| `DELETE` | `/association/training/courses/enrollments/:enrollmentId` | `deleteCourseEnrollment` |
| `POST` | `/association/training/courses/enrollments/:enrollmentId/progress` | `updateCourseProgress` |
| `POST` | `/association/training/courses/quiz-attempts` | `createQuizAttempt` |
| `GET` | `/association/training/courses/quiz-attempts` | `searchQuizAttempts` |
| `POST` | `/association/training/enrollments` | `createTrainingEnrollment` |
| `GET` | `/association/training/enrollments` | `searchTrainingEnrollments` |
| `GET` | `/association/training/enrollments/:enrollmentId` | `getTrainingEnrollment` |
| `PATCH` | `/association/training/enrollments/:enrollmentId` | `updateTrainingEnrollment` |
| `DELETE` | `/association/training/enrollments/:enrollmentId` | `deleteTrainingEnrollment` |
| `POST` | `/association/training/enrollments/:enrollmentId/complete` | `completeTrainingEnrollment` |

### Hand-Wired Routes (Credits)

| Method | Path | Location |
|--------|------|---------|
| `GET` | `/credit-compliance/:organizationId` | `handlers/association:member/getCreditCompliance.ts` |
| `GET` | `/persons/me/credit-summary` | `handlers/person/` (assumed) |
| `GET` | `/persons/me/credit-entries` | `handlers/person/` (assumed) |

---

## Frontend → Backend Alignment

| Frontend Action | Frontend API Call | Backend Route | Match? |
|----------------|------------------|---------------|--------|
| Browse training catalog | `searchTrainingsOptions({ query: { status: 'published' } })` | `GET /association/training` | YES |
| View training detail | `getTrainingOptions({ path: { trainingId } })` | `GET /association/training/:trainingId` | YES |
| Enroll in training | `enrollInCustomTrainingMutation()` → `POST /association/training-lifecycle/:trainingId/enroll` | `POST /association/training-lifecycle/:trainingId/enroll` | YES |
| My trainings list | `listMyCustomTrainingsOptions()` | `GET /association/training-lifecycle/my` | YES |
| **Create training (officer)** | `fetch('/api/training/create/${orgId}', { method: 'POST' })` | **NO MATCHING ROUTE** | **BROKEN** |
| **Update training (officer)** | `fetch('/api/training/update/${orgId}/${trainingId}', { method: 'PUT' })` | **NO MATCHING ROUTE** | **BROKEN** |
| Credit compliance report | `api.get('/api/credit-compliance/${orgId}')` | `GET /credit-compliance/:organizationId` | YES (hand-wired) |
| CPD config GET | `api.get('/api/association/member/cpd-config/:orgId')` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |
| CPD config PATCH | `api.patch('/api/association/member/cpd-config/:orgId', body)` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |
| My credit summary | `api.get('/api/persons/me/credit-summary')` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |
| My credit entries | `api.get('/api/persons/me/credit-entries')` | [NEEDS MANUAL CONFIRMATION] | UNKNOWN |

---

## P0 Findings

### [P0-ROUTE-01] Training Create Form Calls Non-Existent API Endpoint

- **File:** `apps/memberry/src/features/training/components/training-form.tsx`
- **Evidence:**
  ```typescript
  const url = isEdit
    ? `/api/training/update/${orgId}/${trainingId}`  // does not exist
    : `/api/training/create/${orgId}`                 // does not exist
  ```
- **Correct route:** `POST /association/training` (with org via header or body) / `PATCH /association/training/:trainingId`
- **Impact:** Officer cannot create or edit trainings. The core officer workflow is broken.
- **Severity:** P0 — critical workflow failure

---

## P1 Findings

### [P1-ROUTE-02] Courses Sub-Module Has No Frontend Coverage

- **Evidence:** `POST/GET /association/training/courses`, `GET /association/training/courses/:courseId`, etc. — 10+ generated course routes exist but no frontend page targets them
- **Severity:** P1 — orphan backend routes, no user path to access course functionality

### [P1-ROUTE-03] `my-cpd.tsx` Route Purpose Unclear vs `/my/credits`

- **File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/my-cpd.tsx`
- **Status:** [NEEDS MANUAL CONFIRMATION] — unclear if this duplicates `/my/credits` or serves distinct org-scoped view. Navigation links need verification.
- **Severity:** P1 — potential dead/duplicate route

### [P2-ROUTE-04] Training Detail (Officer) Uses `getTrainingOptions` Without Org Scoping

- **File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId.tsx`
- **Evidence:** `getTrainingOptions({ path: { trainingId } })` — no org header passed
- **Impact:** May fetch training from any org; org isolation unverified
- **Severity:** P2

### [P2-ROUTE-05] Delete Training — No Frontend Page/Button Found

- **Evidence:** `DELETE /association/training/:trainingId` route exists in generated routes, but no frontend UI element for deletion was found in audited files
- **Severity:** P2 — orphan backend route

---

## Navigation Link Check

| Link | Source | Target | Status |
|------|--------|--------|--------|
| Officer Training breadcrumb | `$trainingId.tsx` | `/org/$orgSlug/officer/training` | OK |
| Create Training link | `officer/training/index.tsx` | `/org/$orgSlug/officer/training/new` | OK |
| Training card link | `org/training/index.tsx` | `/org/$orgSlug/training/$trainingId` | OK |
| My Training nav | Sidebar (assumed) | `/my/training` | [NEEDS MANUAL CONFIRMATION] |
| My Credits nav | Sidebar (assumed) | `/my/credits` | [NEEDS MANUAL CONFIRMATION] |
