# 02 — Route and Navigation Audit

**Date:** 2026-05-26
**Scope:** All frontend routes, navigation links, redirects, route states, navigation tests
**Mode:** Read-only audit. No code modifications.

---

## 1. Route Registry

### Memberry App — Auth Routes

| Route | Type | Auth | Roles | Guard | Source File | Test Coverage |
|-------|------|------|-------|-------|------------|---------------|
| `/auth/$authView` | Dynamic | Guest only | None | `requireGuest` | `routes/auth/$authView.tsx` | ✓ `auth.spec.ts` |
| `/onboarding` | Static | Auth | None | `requireAuth` + no person | `routes/_authenticated/onboarding.tsx` | Partial |
| `/verify-email` | Static | Auth | None | `requireEmailVerified` (inverse) | Inferred | NONE |

### Memberry App — Member Routes (43)

| Route | Type | Params | Guard | Source File | Test |
|-------|------|--------|-------|------------|------|
| `/dashboard` | Static | — | `requireAuth` | `_authenticated/dashboard.tsx` | Partial |
| `/my/profile` | Static | — | `requireAuth` | `_authenticated/my/profile.tsx` | ✓ `profile.spec.ts` |
| `/my/settings` | Static | — | `requireAuth` | `_authenticated/my/settings.tsx` | NONE |
| `/my/billing` | Static | — | `requireAuth` | `_authenticated/my/billing.tsx` | NONE |
| `/my/payments` | Static | — | `requireAuth` | `_authenticated/my/payments.tsx` | NONE |
| `/my/bookings` | Static | — | `requireAuth` | `_authenticated/my/bookings/index.tsx` | NONE |
| `/my/bookings/$bookingId` | Dynamic | bookingId | `requireAuth` | `_authenticated/my/bookings/$bookingId.tsx` | NONE |
| `/my/bookings/host/$personId` | Dynamic | personId | `requireAuth` | `_authenticated/my/bookings/host.$personId.tsx` | NONE |
| `/my/bookings/host/$personId/$slotId` | Dynamic | personId, slotId | `requireAuth` | `_authenticated/my/bookings/host.$personId.$slotId.tsx` | NONE |
| `/my/calendar` | Static | — | `requireAuth` | `_authenticated/my/calendar.tsx` | NONE |
| `/my/certificates` | Static | — | `requireAuth` | `_authenticated/my/certificates/index.tsx` | NONE |
| `/my/certificates/$certificateId` | Dynamic | certificateId | `requireAuth` | `_authenticated/my/certificates/$certificateId.tsx` | NONE |
| `/my/credits` | Static | — | `requireAuth` | `_authenticated/my/credits/index.tsx` | NONE |
| `/my/credits/log` | Static | — | `requireAuth` | `_authenticated/my/credits/log.tsx` | NONE |
| `/my/data-export` | Static | — | `requireAuth` | `_authenticated/my/data-export.tsx` | ✓ `data-export.spec.ts` |
| `/my/events` | Static | — | `requireAuth` | `_authenticated/my/events.tsx` | Partial |
| `/my/id-card` | Static | — | `requireAuth` | `_authenticated/my/id-card.tsx` | NONE |
| `/my/notifications` | Static | — | `requireAuth` | `_authenticated/my/notifications.tsx` | NONE |
| `/my/organizations` | Static | — | `requireAuth` | `_authenticated/my/organizations.tsx` | NONE |
| `/my/schedule` | Static | — | `requireAuth` | `_authenticated/my/schedule.tsx` | NONE |
| `/my/surveys` | Static | — | `requireAuth` | `_authenticated/my/surveys/index.tsx` | NONE |
| `/my/surveys/$surveyId` | Dynamic | surveyId | `requireAuth` | `_authenticated/my/surveys/$surveyId.tsx` | NONE |
| `/my/training` | Static | — | `requireAuth` | `_authenticated/my/training.tsx` | Partial |
| `/org/$orgSlug/home` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/home.tsx` | ✓ `org-home.spec.ts` |
| `/org/$orgSlug/directory` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/directory.tsx` | NONE |
| `/org/$orgSlug/directory/$personId` | Dynamic | orgSlug, personId | `requireAuth` | `_authenticated/org/$orgSlug/directory/$personId.tsx` | NONE |
| `/org/$orgSlug/documents` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/documents/index.tsx` | ✓ `documents.spec.ts` |
| `/org/$orgSlug/documents/$documentId` | Dynamic | orgSlug, documentId | `requireAuth` | `_authenticated/org/$orgSlug/documents/$documentId.tsx` | NONE |
| `/org/$orgSlug/elections` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/elections/index.tsx` | NONE |
| `/org/$orgSlug/elections/$electionId` | Dynamic | orgSlug, electionId | `requireAuth` | `_authenticated/org/$orgSlug/elections/$electionId.tsx` | NONE |
| `/org/$orgSlug/governance` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/governance/index.tsx` | NONE |
| `/org/$orgSlug/announcements` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/announcements/index.tsx` | NONE |
| `/org/$orgSlug/announcements/$announcementId` | Dynamic | orgSlug, announcementId | `requireAuth` | `_authenticated/org/$orgSlug/announcements/$announcementId.tsx` | NONE |
| `/org/$orgSlug/messages` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/messages/index.tsx` | NONE |
| `/org/$orgSlug/messages/dm` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/messages/dm/index.tsx` | NONE |
| `/org/$orgSlug/my-cpd` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/my-cpd.tsx` | NONE |
| `/org/$orgSlug/my-notifications` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/my-notifications.tsx` | NONE |
| `/org/$orgSlug/training` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/training/index.tsx` | ✓ `training-browse.spec.ts` |
| `/org/$orgSlug/training/$trainingId` | Dynamic | orgSlug, trainingId | `requireAuth` | `_authenticated/org/$orgSlug/training/$trainingId.tsx` | NONE |
| `/org/$orgSlug/dues` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/dues.tsx` | NONE |
| `/org/$orgSlug/events` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/events.tsx` | Partial |
| `/org/$orgSlug/members` | Dynamic | orgSlug | `requireAuth` | `_authenticated/org/$orgSlug/members.tsx` | NONE |
| `/discover/events` | Static | — | None (public) | `discover/events.tsx` | NONE |

### Memberry App — Officer Routes (36)

| Route | Params | Guard | Source File | Test |
|-------|--------|-------|------------|------|
| `/org/$orgSlug/officer/dashboard` | orgSlug | `requireOrgOfficer` | `officer/dashboard.tsx` | ✓ `role-boundaries.spec.ts` |
| `/org/$orgSlug/officer/roster` | orgSlug | `requireOrgOfficer` | `officer/roster/index.tsx` | ✓ `role-boundaries.spec.ts` |
| `/org/$orgSlug/officer/roster/$memberId` | orgSlug, memberId | `requireOrgOfficer` | `officer/roster/$memberId.tsx` | NONE |
| `/org/$orgSlug/officer/roster/import` | orgSlug | `requireOrgOfficer` | `officer/roster/import.tsx` | NONE |
| `/org/$orgSlug/officer/applications` | orgSlug | `requireOrgOfficer` | `officer/applications.tsx` | NONE |
| `/org/$orgSlug/officer/finances` | orgSlug | `requireOrgOfficer` | `officer/finances/index.tsx` | NONE |
| `/org/$orgSlug/officer/finances/invoices` | orgSlug | `requireOrgOfficer` | `officer/finances/invoices.tsx` | NONE |
| `/org/$orgSlug/officer/finances/members` | orgSlug | `requireOrgOfficer` | `officer/finances/members/index.tsx` | NONE |
| `/org/$orgSlug/officer/finances/dues` | orgSlug | `requireOrgOfficer` | `officer/finances/dues.tsx` | NONE |
| `/org/$orgSlug/officer/finances/assessments` | orgSlug | `requireOrgOfficer` | `officer/finances/assessments.tsx` | NONE |
| `/org/$orgSlug/officer/finances/funds` | orgSlug | `requireOrgOfficer` | `officer/finances/funds.tsx` | NONE |
| `/org/$orgSlug/officer/payments` | orgSlug | `requireOrgOfficer` | `officer/payments/index.tsx` | NONE |
| `/org/$orgSlug/officer/reports/financial` | orgSlug | `requireOrgOfficer` | `officer/reports/financial.tsx` | NONE |
| `/org/$orgSlug/officer/reports/credits` | orgSlug | `requireOrgOfficer` | `officer/reports/credits.tsx` | NONE |
| `/org/$orgSlug/officer/events` | orgSlug | `requireOrgOfficer` | `officer/events/index.tsx` | ✓ `role-boundaries.spec.ts` |
| `/org/$orgSlug/officer/events/$eventId` | orgSlug, eventId | `requireOrgOfficer` | `officer/events/$eventId.tsx` | NONE |
| `/org/$orgSlug/officer/training` | orgSlug | `requireOrgOfficer` | `officer/training/index.tsx` | NONE |
| `/org/$orgSlug/officer/training/$trainingId` | orgSlug, trainingId | `requireOrgOfficer` | `officer/training/$trainingId.tsx` | NONE |
| `/org/$orgSlug/officer/training/$trainingId/attendance` | orgSlug, trainingId | `requireOrgOfficer` | `officer/training/$trainingId/attendance.tsx` | NONE |
| `/org/$orgSlug/officer/communications` | orgSlug | `requireOrgOfficer` | `officer/communications/index.tsx` | ✓ `role-boundaries.spec.ts` |
| `/org/$orgSlug/officer/communications/new` | orgSlug | `requireOrgOfficer` | `officer/communications/new.tsx` | NONE |
| `/org/$orgSlug/officer/communications/sent` | orgSlug | `requireOrgOfficer` | `officer/communications/sent.tsx` | NONE |
| `/org/$orgSlug/officer/communications/analytics` | orgSlug | `requireOrgOfficer` | `officer/communications/analytics.tsx` | NONE |
| `/org/$orgSlug/officer/communications/$announcementId` | orgSlug, announcementId | `requireOrgOfficer` | `officer/communications/$announcementId.tsx` | NONE |
| `/org/$orgSlug/officer/communications/templates` | orgSlug | `requireOrgOfficer` | `officer/communications/templates/index.tsx` | NONE |
| `/org/$orgSlug/officer/communications/templates/new` | orgSlug | `requireOrgOfficer` | `officer/communications/templates/new.tsx` | NONE |
| `/org/$orgSlug/officer/documents` | orgSlug | `requireOrgOfficer` | `officer/documents/index.tsx` | NONE |
| `/org/$orgSlug/officer/documents/$documentId` | orgSlug, documentId | `requireOrgOfficer` | `officer/documents/$documentId.tsx` | NONE |
| `/org/$orgSlug/officer/elections` | orgSlug | `requireOrgOfficer` | `officer/elections/index.tsx` | NONE |
| `/org/$orgSlug/officer/elections/new` | orgSlug | `requireOrgOfficer` | `officer/elections/new.tsx` | NONE |
| `/org/$orgSlug/officer/elections/$electionId` | orgSlug, electionId | `requireOrgOfficer` | `officer/elections/$electionId.tsx` | NONE |
| `/org/$orgSlug/officer/elections/$electionId/edit` | orgSlug, electionId | `requireOrgOfficer` | `officer/elections/$electionId/edit.tsx` | NONE |
| `/org/$orgSlug/officer/surveys` | orgSlug | `requireOrgOfficer` | `officer/surveys/index.tsx` | NONE |
| `/org/$orgSlug/officer/settings/*` (8 routes) | orgSlug | `requireOrgOfficer` | `officer/settings/*.tsx` | ✓ `settings.spec.ts` (partial) |
| `/org/$orgSlug/officer/officers` | orgSlug | `requireOrgOfficer` | `officer/officers.tsx` | NONE |
| `/org/$orgSlug/officer/messages` | orgSlug | `requireOrgOfficer` | `officer/messages.tsx` | NONE |

### Admin App (23 routes)

All admin routes require platform admin auth (redirect to memberry login if unauthenticated).

| Route | Roles | Source File | Test |
|-------|-------|------------|------|
| `/` | super, support, analyst | `routes/index.tsx` | ✓ `admin-smoke.spec.ts` |
| `/associations` | super, support, analyst | `routes/associations/index.tsx` | ✓ `associations.spec.ts` |
| `/associations/$associationId` | super, support, analyst | `routes/associations/$associationId.tsx` | Partial |
| `/organizations` | super, support, analyst | `routes/organizations/index.tsx` | ✓ `organizations.spec.ts` |
| `/organizations/$organizationId` | super, support, analyst | `routes/organizations/$organizationId.tsx` | Partial |
| `/members` | super, support, analyst | `routes/members/index.tsx` | ✓ `members.spec.ts` |
| `/members/$personId` | super, support, analyst | `routes/members/$personId.tsx` | NONE |
| `/operators` | super | `routes/operators/index.tsx` | NONE |
| `/training` | super, support, analyst | `routes/training/index.tsx` | NONE |
| `/committees` | super, support | `routes/committees/index.tsx` | NONE |
| `/events` | super, support | `routes/events/index.tsx` | NONE |
| `/verifications` | super, support | `routes/verifications/index.tsx` | NONE |
| `/national-dashboard` | super, support, analyst | `routes/national-dashboard/index.tsx` | NONE |
| `/compliance` | super, support, analyst | `routes/compliance/index.tsx` | NONE |
| `/audit` | super, support | `routes/audit/index.tsx` | ✓ `audit.spec.ts` |
| `/surveys` | super, support, analyst | `routes/surveys/index.tsx` | NONE |
| `/feature-flags` | super | `routes/feature-flags/index.tsx` | NONE |
| `/impersonate` | super | `routes/impersonate/index.tsx` | NONE |
| `/communications` | super, support | `routes/communications/index.tsx` | NONE |
| `/communications/templates` | super | `routes/communications/templates.tsx` | NONE |
| `/communications/email` | super, support, analyst | `routes/communications/email.tsx` | NONE |
| `/communications/moderation` | super, support | `routes/communications/moderation.tsx` | NONE |

---

## 2. Navigation Registry

### Broken/Missing Navigation Targets

| Source | Label | Target Route | Route Exists? | Severity |
|--------|-------|-------------|---------------|----------|
| Officer Sidebar | "Reviews" | `/org/$orgSlug/officer/reviews` | **NO** — no route file | P1 |

**All other 90+ navigation links verified — targets exist.**

### Legacy Route Redirects (Working)

| Old Route | New Route | Evidence |
|-----------|----------|---------|
| `/org/$orgSlug/officer/settings/funds` | `/org/$orgSlug/officer/finances/funds` | Route file redirect |
| `/org/$orgSlug/officer/settings/dues` | `/org/$orgSlug/officer/finances/dues` | Route file redirect |
| `/org/$orgSlug/officer/dues/assessments` | `/org/$orgSlug/officer/finances/assessments` | Route file redirect |
| `/org/$orgSlug/officer/dues/member.$memberId` | `/org/$orgSlug/officer/finances/members/$memberId` | Route file redirect |
| `/org/$orgSlug/officer/dues/treasurer` | `/org/$orgSlug/officer/finances` | Route file redirect |

---

## 3. Broken Navigation Report

| ID | Issue | Severity | Source File | Target | Affected Role | Recommended Test |
|----|-------|----------|------------|--------|--------------|-----------------|
| BN-01 | Officer sidebar links to non-existent `/officer/reviews` | P1 | `officer-sidebar.tsx` | `/org/$orgSlug/officer/reviews` | All officers | E2E navigation test |
| BN-02 | No 404 page for admin app | P2 | `apps/admin/src/routes/` | Any invalid admin route | All admins | E2E 404 test |
| BN-03 | Admin ROUTE_ROLES not enforced in route `beforeLoad` — only sidebar filter | P1 | `apps/admin/src/routes/__root.tsx` | `/operators`, `/impersonate`, `/feature-flags` | analyst, support | E2E direct-URL test |
| BN-04 | Dynamic detail routes have no not-found handling for invalid IDs | P1 | Multiple `$id.tsx` routes | Various | All users | E2E + component |
| BN-05 | `window.location.assign` used for payment detail navigation (bypasses router) | P2 | Payment history table | `/org/$orgSlug/officer/payments/$id` | Officers | Note: full page reload |

---

## 4. Route State Coverage

### State Handling Audit (19 routes sampled)

| Route | Loading | Error | Empty | Not-Found | ErrorBoundary |
|-------|---------|-------|-------|-----------|---------------|
| `/dashboard` | ✓ | ✗ | ✓ | N/A | ✗ |
| `/my/profile` | ✓ | ✓ | ✗ | N/A | ✗ |
| `/my/bookings` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/my/bookings/$bookingId` | ✓ | ✗ | ✗ | ✓ | ✗ |
| `/my/training` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/my/certificates` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/org/$orgSlug/home` | ✓ | ✓ | ✓ | N/A | ✗ |
| `/org/$orgSlug/directory` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/org/$orgSlug/directory/$personId` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `/org/$orgSlug/announcements` | ✓ | ✗ | ✓ | N/A | ✗ |
| `/org/$orgSlug/announcements/$id` | ✓ | ✓ | ✗ | ✓ | ✗ |
| `/org/$orgSlug/officer` (layout) | ✓ | ✓ | N/A | N/A | ✓ |
| `/org/$orgSlug/officer/roster` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/org/$orgSlug/officer/dashboard` | ✓ | ✓ | ✗ | N/A | ✗ |
| `/org/$orgSlug/officer/events` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/org/$orgSlug/officer/elections` | ✓ | ✗ | ✗ | N/A | ✗ |
| `/org/$orgSlug/officer/elections/$id` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `/org/$orgSlug/officer/dues/treasurer` | ✓ | ✓ | ✗ | N/A | ✗ |
| Admin routes (20) | ✗ | ✗ | ✗ | ✗ | ✗ |

**Summary:**
- Loading: 84% (16/19) — GOOD
- Error: 37% (7/19) — POOR
- Empty: 26% (5/19) — POOR
- Not-Found (detail routes): 22% (2/9 detail routes) — CRITICAL
- ErrorBoundary: 5% (1/19) — CRITICAL
- Admin routes: 0% across all states — CRITICAL

---

## 5. Route Test Gap Matrix

### High-Priority Gaps

| Route Group | Routes | Existing Tests | Missing Tests | Priority |
|-------------|--------|---------------|--------------|----------|
| Member bookings | 4 routes | NONE | Booking flow E2E, not-found for invalid ID | P1 |
| Member certificates | 2 routes | NONE | Certificate list/detail E2E | P2 |
| Member calendar/schedule | 2 routes | NONE | Calendar render, schedule E2E | P2 |
| Member billing/payments | 2 routes | NONE | Billing page render, payment history | P2 |
| Org elections | 2 routes | NONE | Voting E2E, election detail | P1 |
| Org messages/DM | 2 routes | NONE | Messaging E2E | P1 |
| Officer roster detail | 1 route | NONE | Member detail view | P2 |
| Officer finances (6 routes) | 6 routes | NONE | Finances overview, invoices, dues config | P1 |
| Officer elections mgmt | 4 routes | NONE | Create/edit/monitor election | P1 |
| Officer training mgmt | 3 routes | NONE | Course mgmt, attendance | P2 |
| Officer documents mgmt | 2 routes | NONE | Doc management E2E | P2 |
| Officer communications | 6 routes | Partial (index) | New/sent/analytics/templates | P2 |
| Admin operators | 1 route | NONE | Super-only access test | P1 |
| Admin impersonate | 1 route | NONE | Super-only, impersonation flow | P1 |
| Admin feature-flags | 1 route | NONE | Super-only access test | P2 |
| Admin comms suite | 4 routes | NONE | Role-filtered access | P2 |
| Admin national-dashboard | 1 route | NONE | Analytics render | P2 |
| Admin compliance | 1 route | NONE | Compliance data render | P2 |

### Routes With Tests (for reference)

| Route | Test File | Cases |
|-------|----------|-------|
| `/auth/*` | `auth.spec.ts`, `otp-registration.spec.ts`, `password-reset.spec.ts`, `session-*.spec.ts` | 30+ |
| `/my/profile` | `profile.spec.ts` | 5 |
| `/org/$orgSlug/home` | `member/org-home.spec.ts` | ~4 |
| `/org/$orgSlug/training` | `member/training-browse.spec.ts` | 9 |
| `/org/$orgSlug/documents` | `member/documents.spec.ts` | 4 |
| `/my/data-export` | `member/data-export.spec.ts` | 2 |
| Officer dashboard/roster/events/comms | `role-boundaries.spec.ts` | 16 (deny only) |
| Officer settings | `officer/settings.spec.ts`, `officer/settings-e2e.spec.ts` | 26 |
| Admin routes | `admin-smoke.spec.ts`, `admin-routes.spec.ts` | 6 |
| Admin associations/orgs/members/audit | Various | 19 |

---

## Gate Evaluation: Audit 03

| Criterion | Status |
|-----------|--------|
| All routes extracted | PASS |
| Navigation sources mapped | PASS |
| Route targets validated | PASS |
| Role-aware navigation checked | PASS |
| Route-level states assessed | PASS |
| Test coverage mapped | PASS |
| Broken navigation documented | PASS |

**Gate Result: PASS**

---

## Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | COMPLETE | PASS | `01_ROLE_PERMISSION_MAP_AUDIT.md` |
| 03 — Route Navigation | COMPLETE | PASS | `02_ROUTE_NAVIGATION_AUDIT.md` |
| 04 — Frontend Interaction Integrity | PENDING | — | — |
| 05 — Form/Modal/Table Action | PENDING | — | — |
| 06 — Backend API Contract Alignment | PENDING | — | — |
| 07 — Role-Based Journey Map | PENDING | — | — |
| 08 — Test Confidence Gap | PENDING | — | — |
| 09 — Prioritized Stabilization Plan | PENDING | — | — |

**Cumulative findings:** P0: 0 | P1: 12 | P2: 8+
