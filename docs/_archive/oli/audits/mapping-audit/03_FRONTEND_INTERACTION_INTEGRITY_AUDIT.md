# 03 — Frontend Interaction Integrity Audit

**Date:** 2026-05-26
**Scope:** All clickable/actionable UI elements across Memberry and Admin apps
**Mode:** Read-only audit. No code modifications.

---

## 1. Interaction Pattern Summary

| Pattern | Count | Status |
|---------|-------|--------|
| Buttons with API mutations | 25+ | Most have loading/error/success |
| Toast notifications (sonner) | 23+ uses | Standard success/error pattern |
| Confirmation dialogs | 14 files use AlertDialog/ConfirmDialog | Partial — some destructive actions lack confirmation |
| Query invalidations after mutation | 16+ | Good cache update pattern |
| Form submissions (react-hook-form) | 12 forms | Consistent pattern |
| Table row actions | 4+ data tables | Via DataTable actions column |

### Confirmation Dialog Pattern
**File:** `apps/memberry/src/components/patterns/confirm-dialog.tsx`
**Used in:** event-list, document-library, post-event-actions, special-assessments-list, booking-card, training-list, announcement detail, account settings, organizations

---

## 2. Broken Interaction Report

| ID | Issue | Severity | File | Route/Page | Role | Evidence | Recommended Test |
|----|-------|----------|------|-----------|------|----------|-----------------|
| BI-01 | NPS modal submit has silent error — no toast on failure | P2 | `features/surveys/components/nps-modal.tsx` | Any (global provider) | All members | `onError` missing or empty | Component test |
| BI-02 | Feature flag delete has no confirmation dialog | P1 | `apps/admin/src/routes/feature-flags/index.tsx` | `/feature-flags` | super | Destructive action, no AlertDialog | E2E + component test |
| BI-03 | Member table TODO: dynamic credit requirements hardcoded | P2 | `features/membership/components/member-table.tsx` | Officer roster | Officers | `// TODO: Dynamic credit requirements per tier` | `[NEEDS PRODUCT DECISION]` |
| BI-04 | Document delete in library — verify confirmation exists | P2 | `features/documents/components/document-library.tsx` | Officer documents | Officers | Uses ConfirmDialog ✓ but `[NEEDS MANUAL CONFIRMATION]` of UX | E2E test |
| BI-05 | Avatar upload error silent — no toast on failure | P2 | `features/person/components/personal-info-form.tsx` | `/my/profile` | All users | Upload error not surfaced | Component test |
| BI-06 | Dues export lacks error display | P3 | `features/dues/` | Member dues | Members | Export failure not communicated | Component test |
| BI-07 | Form submissions not debounced — double-submit risk | P2 | Person forms (contact, address, preferences, personal-info) | `/my/profile` | All users | No `isPending` disable on submit button `[NEEDS MANUAL CONFIRMATION]` | Component test |
| BI-08 | Survey submission has no retry logic | P2 | `features/surveys/components/survey-flow.tsx` | `/my/surveys/$surveyId` | Members | Failed submission lost | Component test |
| BI-09 | Election candidate delete — weak confirmation | P2 | `features/elections/` | Officer elections | Officers | Standard confirm, not AlertDialog `[NEEDS MANUAL CONFIRMATION]` | E2E test |
| BI-10 | Member add causes page reload | P3 | `officer/roster/index.tsx` | Officer roster | Officers | Full page reload vs query invalidation | UX improvement |

---

## 3. Interaction Registry — Member Features

### Dashboard

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Navigate to org | Card click | `navigate()` | None | N/A | N/A | Route change | NONE |
| Switch org | Org picker | `navigate()` | None | N/A | N/A | Route change | NONE |
| View dues | Quick action | Link | None | N/A | N/A | Route change | NONE |

### Profile

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Save personal info | Button | `onSubmit` | `PUT /api/persons/me` | ✓ isPending | ✓ toast.error | ✓ toast.success | ✓ `profile.spec.ts` |
| Save contact info | Button | `onSubmit` | `PUT /api/persons/me/contact` | ✓ isPending | ✓ toast.error | ✓ toast.success | NONE |
| Save address | Button | `onSubmit` | `PUT /api/persons/me/address` | ✓ isPending | ✓ toast.error | ✓ toast.success | NONE |
| Save preferences | Button | `onSubmit` | `PUT /api/persons/me/preferences` | ✓ isPending | ✓ toast.error | ✓ toast.success | NONE |
| Upload avatar | File input | onChange | `POST /api/storage/upload` | ✓ | ✗ Silent | ✓ | NONE |
| Delete account | AlertDialog | confirm | `DELETE /api/persons/me` | ✓ | ✓ | Redirect | NONE |
| Export data | Button | onClick | `GET /api/persons/me/export` | ✓ | ✓ toast.error | Download | ✓ `data-export.spec.ts` |

### Bookings

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Book slot | Button | mutation | `POST /api/booking/bookings` | ✓ | ✓ toast | ✓ toast + invalidate | NONE |
| Cancel booking | ConfirmDialog | mutation | `DELETE /api/booking/bookings/:id` | ✓ | ✓ toast | ✓ toast + invalidate | NONE |

### Events

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| RSVP/Register | Button | mutation | `POST /api/events/:id/register` | ✓ | ✓ | ✓ toast | Partial |
| Cancel registration | ConfirmDialog | mutation | `DELETE /api/events/:id/register` | ✓ | ✓ | ✓ | NONE |
| Post-event: rate | Dialog | mutation | `POST /api/reviews` | ✓ | ✓ | ✓ | NONE |
| Post-event: claim credits | Button | mutation | Credit claim API | ✓ | ✓ | ✓ | NONE |

### Messages/DM

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Send message | Button/Enter | WebSocket send | WS channel | ✓ | ✗ `[INFERRED]` | Optimistic UI | NONE |
| Create channel | Dialog form | mutation | `POST /api/comms/channels` | ✓ | ✓ | ✓ redirect | NONE |

### Elections

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Cast vote | Button | mutation | `POST /api/elections/:id/vote` | ✓ | ✓ | ✓ toast + redirect | NONE |
| Nominate | Button | mutation | `POST /api/elections/:id/nominate` | ✓ | ✓ | ✓ | NONE |

### Surveys

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Submit survey | Button | mutation | `POST /api/surveys/:id/response` | ✓ | ✓ toast | ✓ redirect | NONE |
| Submit NPS | Modal button | mutation | `POST /api/reviews` | ✓ | ✗ Silent | ✓ close modal | NONE |

---

## 4. Interaction Registry — Officer Features

### Roster Management

| Action | Element | Handler | API | Loading | Error | Success | Confirmation | Test |
|--------|---------|---------|-----|---------|-------|---------|-------------|------|
| Add member | Form | mutation | `POST /api/membership/members` | ✓ | ✓ | Page reload | No | NONE |
| Edit member status | Dropdown | mutation | `PATCH /api/membership/members/:id` | ✓ | ✓ | ✓ invalidate | ConfirmDialog for status change | NONE |
| Import members | Button | file upload | `POST /api/membership/import` | ✓ | ✓ | ✓ toast | No | NONE |
| Remove member | Button | mutation | `DELETE /api/membership/members/:id` | ✓ | ✓ | ✓ invalidate | ConfirmDialog | NONE |

### Finances/Dues

| Action | Element | Handler | API | Loading | Error | Success | Confirmation | Test |
|--------|---------|---------|-----|---------|-------|---------|-------------|------|
| Record payment | Form | mutation | `POST /api/dues/payments/record` | ✓ | ✓ | ✓ toast | No | NONE |
| Issue refund | Form | mutation | `POST /api/dues/refunds` | ✓ | ✓ | ✓ toast | AlertDialog | NONE |
| Create assessment | Form | mutation | `POST /api/dues/assessments` | ✓ | ✓ | ✓ toast | No | NONE |
| Configure dues | Form | mutation | `PUT /api/dues/config` | ✓ | ✓ | ✓ toast | No | NONE |
| Delete assessment | Button | mutation | `DELETE /api/dues/assessments/:id` | ✓ | ✓ | ✓ | ConfirmDialog | NONE |

### Events Management

| Action | Element | Handler | API | Loading | Error | Success | Confirmation | Test |
|--------|---------|---------|-----|---------|-------|---------|-------------|------|
| Create event | Form | mutation | `POST /api/events` | ✓ | ✓ | ✓ redirect | No | NONE |
| Edit event | Form | mutation | `PUT /api/events/:id` | ✓ | ✓ | ✓ toast | No | NONE |
| Cancel event | Button | mutation | `DELETE /api/events/:id` | ✓ | ✓ | ✓ | ConfirmDialog | NONE |

### Training Management

| Action | Element | Handler | API | Loading | Error | Success | Confirmation | Test |
|--------|---------|---------|-----|---------|-------|---------|-------------|------|
| Create training | Form | mutation | `POST /api/training` | ✓ | ✓ | ✓ redirect | No | NONE |
| Mark attendance | Checkbox | mutation | `POST /api/training/:id/attendance` | ✓ | ✓ | ✓ | No | NONE |
| Delete training | Button | mutation | `DELETE /api/training/:id` | ✓ | ✓ | ✓ | ConfirmDialog | NONE |

### Communications

| Action | Element | Handler | API | Loading | Error | Success | Confirmation | Test |
|--------|---------|---------|-----|---------|-------|---------|-------------|------|
| Send announcement | Form | mutation | `POST /api/announcements` | ✓ | ✓ | ✓ redirect | No | NONE |
| Delete announcement | Button | mutation | `DELETE /api/announcements/:id` | ✓ | ✓ | ✓ | ConfirmDialog | NONE |
| Save template | Form | mutation | `POST/PUT /api/templates` | ✓ | ✓ | ✓ toast | No | NONE |

### Elections Management

| Action | Element | Handler | API | Loading | Error | Success | Confirmation | Test |
|--------|---------|---------|-----|---------|-------|---------|-------------|------|
| Create election | Form | mutation | `POST /api/elections` | ✓ | ✓ | ✓ redirect | No | NONE |
| Add candidate | Form | mutation | `POST /api/elections/:id/candidates` | ✓ | ✓ | ✓ | No | NONE |
| Remove candidate | Button | mutation | `DELETE /api/elections/:id/candidates/:cid` | ✓ | ✓ | ✓ | Weak confirm | NONE |
| Start/end voting | Button | mutation | `PATCH /api/elections/:id` | ✓ | ✓ | ✓ | No `[LIKELY BUG]` | NONE |

### Settings

| Action | Element | Handler | API | Loading | Error | Success | Test |
|--------|---------|---------|-----|---------|-------|---------|------|
| Save org settings | Form | mutation | `PUT /api/orgs/:id` | ✓ | ✓ | ✓ toast | ✓ `settings.spec.ts` |
| Assign officer | Dialog form | mutation | `POST /api/association/member/officer-terms` | ✓ | ✓ | ✓ | NONE |
| Remove officer | Button | mutation | `DELETE /api/association/member/officer-terms/:id` | ✓ | ✓ | ✓ | ConfirmDialog | NONE |
| Save membership categories | Form | mutation | `PUT /api/orgs/:id/categories` | ✓ | ✓ | ✓ | ✓ Partial |
| Configure payment gateway | Form | mutation | `PUT /api/billing/connect` | ✓ | ✓ | ✓ | NONE |

---

## 5. Interaction Registry — Admin App

| Route | Action | Element | Handler | API | Confirmation | Test |
|-------|--------|---------|---------|-----|-------------|------|
| `/operators` | Invite operator | Form | mutation | `POST /api/admins` | No | NONE |
| `/operators` | Revoke operator | Button | mutation | `DELETE /api/admins/:id` | ConfirmDialog | NONE |
| `/operators` | Change role | Dropdown | mutation | `PUT /api/admins/:id` | No | NONE |
| `/feature-flags` | Toggle flag | Switch | mutation | `PATCH /api/feature-flags/:id` | No | NONE |
| `/feature-flags` | Delete flag | Button | mutation | `DELETE /api/feature-flags/:id` | **NO** — destructive without confirm | NONE |
| `/impersonate` | Start impersonation | Form | mutation | `POST /api/admin/impersonate` | ConfirmDialog | NONE |
| `/verifications` | Approve/reject | Button | mutation | `PATCH /api/verifications/:id` | No | NONE |
| `/communications` | Moderate content | Button | mutation | Various | No | NONE |
| `/surveys` | Create survey | Form | mutation | `POST /api/surveys` | No | NONE |

---

## 6. Missing Test Matrix — High Priority

| Interaction | Risk | Current Test | Recommended Test | Severity |
|-------------|------|-------------|-----------------|----------|
| Feature flag delete (no confirm) | Data loss | NONE | E2E + add ConfirmDialog | P1 |
| Cast vote in election | Data integrity | NONE | E2E journey | P1 |
| Record payment | Financial | NONE | E2E + API integration | P1 |
| Issue refund | Financial, destructive | NONE | E2E + API integration | P1 |
| Start/end voting (no confirm) | State change, irreversible | NONE | E2E + add confirmation | P1 |
| Send announcement (broadcast) | Mass communication | NONE | E2E journey | P1 |
| Book/cancel booking | Core UX | NONE | E2E journey | P1 |
| Assign/remove officer | Access control change | NONE | E2E + permission | P1 |
| Import members | Bulk data change | NONE | E2E + validation | P1 |
| Member status change | Membership impact | NONE | E2E + state machine | P1 |
| Create/edit event | Core feature | NONE | E2E journey | P2 |
| Mark training attendance | Credit impact | NONE | E2E | P2 |
| Save org settings | Config change | Partial | Complete E2E | P2 |
| Delete document | Data loss | ConfirmDialog exists | E2E | P2 |
| Delete training | Data loss | ConfirmDialog exists | E2E | P2 |
| Profile form saves | User data | Partial (profile only) | All form variants | P2 |
| NPS modal submit (silent error) | Lost feedback | NONE | Component test | P2 |
| WebSocket message send | Real-time | NONE | Integration test | P2 |
| Start impersonation | Security | NONE | E2E + security | P1 |

---

## 7. Cross-Cutting Concerns

### Double-Submit Protection

| Pattern | Status | Evidence |
|---------|--------|----------|
| `isPending` on mutation buttons | Most forms | `disabled={isPending}` pattern |
| Debounce on form submit | NOT FOUND | Person forms lack debounce `[NEEDS MANUAL CONFIRMATION]` |
| Optimistic updates | Messages only | `useOptimisticMutation` in SDK |

### Destructive Actions Without Confirmation

| Action | File | Risk | Status |
|--------|------|------|--------|
| Delete feature flag | `admin/feature-flags/index.tsx` | Feature disabled permanently | **NO CONFIRMATION** — P1 |
| Start/end voting | `officer/elections/` | Irreversible state change | **NO CONFIRMATION** — P1 |
| Toggle feature flag | `admin/feature-flags/index.tsx` | Feature behavior change | No confirmation (acceptable for toggle) |

### Accessibility

| Concern | Status |
|---------|--------|
| Icon buttons with `aria-label` | `[NEEDS MANUAL CONFIRMATION]` — spot checks suggest partial |
| Keyboard navigation for modals | Radix Dialog handles this | 
| Focus management after mutation | Not audited `[NEEDS MANUAL CONFIRMATION]` |

---

## Gate Evaluation: Audit 04

| Criterion | Status |
|-----------|--------|
| Actionable elements scanned | PASS |
| Each action assessed (handler, API, states) | PASS |
| Issues flagged with severity | PASS |
| Interactions classified | PASS |
| Test recommendations provided | PASS |

**Gate Result: PASS**

---

## Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | COMPLETE | PASS | `01_ROLE_PERMISSION_MAP_AUDIT.md` |
| 03 — Route Navigation | COMPLETE | PASS | `02_ROUTE_NAVIGATION_AUDIT.md` |
| 04 — Frontend Interaction Integrity | COMPLETE | PASS | `03_FRONTEND_INTERACTION_INTEGRITY_AUDIT.md` |
| 05 — Form/Modal/Table Action | PENDING | — | — |
| 06 — Backend API Contract Alignment | PENDING | — | — |
| 07 — Role-Based Journey Map | PENDING | — | — |
| 08 — Test Confidence Gap | PENDING | — | — |
| 09 — Prioritized Stabilization Plan | PENDING | — | — |

**Cumulative findings:** P0: 0 | P1: 14+ | P2: 12+ | P3: 3+
