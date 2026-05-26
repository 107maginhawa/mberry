# 07 — Role-Based Journey Map Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## 1. Role Journey Summary

| Role | Journeys Found | Critical Journeys | Broken Journeys | E2E Gaps |
|------|---------------|------------------|----------------|----------|
| Officer (association:admin) | 8 | 5 | 0 | 4 |
| Regular Member (user) | 3 | 2 | 1 (renew button dead) | 2 |
| President | 2 | 1 | 0 | 1 |
| Unauthenticated | 1 | 1 | 0 | 1 |

---

## 2. Journey Registry

| Journey | Role | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Existing E2E | Criticality |
|---------|------|------------|----------|--------|-----------|------|---------------|-------------|-------------|
| J-01: View & manage roster | Officer | `/org/$s/officer/roster` | Member list displayed, filterable | roster/, roster/$id | Search, filter, paginate, click member | GET roster | Backend tests (dead handler) | membership-actions: STRONG | CRITICAL |
| J-02: Review single application | Officer | `/org/$s/officer/applications` | Application approved/denied | applications | Filter, approve, deny | GET apps, POST approve/deny | Backend tests (association:member) | None | CRITICAL |
| J-03: Bulk approve applications | Officer | `/org/$s/officer/applications` | Multiple applications approved | applications | Select, bulk approve | POST bulk-approve | Backend tests | None | CRITICAL |
| J-04: Add member to roster | Officer | `/org/$s/officer/roster` | New member in roster | roster/ | Click "Add Member", fill form | POST roster | Backend test (dead handler) | None | CRITICAL |
| J-05: Suspend/reinstate member | Officer | `/org/$s/officer/roster/$id` | Member status changed | roster/$id | Suspend button → dialog → confirm | PUT roster/:id | E2E: membership-actions | membership-actions: STRONG | CRITICAL |
| J-06: Import members via CSV | Officer | `/org/$s/officer/roster/import` | Members added to roster | import | Upload CSV, preview, import | POST roster/import | Backend tests | E2E: render only (WEAK) | IMPORTANT |
| J-07: Manage categories | Officer | `/org/$s/officer/settings/membership-categories` | Categories created/updated | categories | Add, deactivate | PUT categories/:orgId | Backend test (dead handler) | E2E: render only (WEAK) | IMPORTANT |
| J-08: Terminate/decease member | Officer | `/org/$s/officer/roster/$id` | Member removed/deceased | roster/$id | Terminate or deceased dialog | POST decease, PUT status | None | None | IMPORTANT |
| J-09: Apply for membership | Member | Application form `[NEEDS MANUAL CONFIRMATION]` | Application submitted | `[NEEDS MANUAL CONFIRMATION]` | Fill form, submit | POST applications | Backend tests | None | CRITICAL |
| J-10: View own memberships | Member | `/org/$s/members` | Membership list displayed | members | View list | GET memberships | None | None | IMPORTANT |
| J-11: Renew membership | Member | `/org/$s/members` | Dues paid, status renewed | members → dues? | Click "Renew" → payment | `[BROKEN — Renew button has no handler]` | None | None | CRITICAL (broken) |
| J-12: Update org profile | President | Settings page `[NEEDS MANUAL CONFIRMATION]` | Org profile saved | settings | Fill form, save | PUT org-profile/:orgId | Backend test | None | IMPORTANT |
| J-13: Accept invite | Unauthed → Member | `/invite/validate/:token` → `/invite/claim/:token` | User joins org | validate → auth → claim | Click invite link, sign in/up, claim | GET validate, POST claim | Backend tests | None | CRITICAL |

---

## 3. Step-by-Step Journey Maps

### J-02: Review Single Application

| Step | Route/Page | UI Action | Component/File | API/Backend Call | Expected Result | Evidence | Status |
|------|-----------|-----------|---------------|-----------------|----------------|---------|--------|
| 1 | `/org/$s/officer/applications` | Navigate via sidebar | ApplicationList | — | Applications page loads | E2E: empty state visible | WORKING |
| 2 | Applications page | Filter by status (submitted) | Select component | — | Filtered list shown | Code review | LIKELY WORKING BUT UNTESTED |
| 3 | Applications page | Click "Approve" on application | Button | `POST /association/member/applications/:id/approve` | Application status → approved, membership created | Code: `approveMutation` | LIKELY WORKING BUT UNTESTED |
| 4 | Applications page | Toast success | — | — | "Application approved" toast | Code: `onSuccess` | LIKELY WORKING BUT UNTESTED |
| 5 | Applications page | List refreshes | QueryClient invalidate | `GET /association/member/applications` re-fetched | Approved app removed from "submitted" filter | Code: `invalidateApplications()` | LIKELY WORKING BUT UNTESTED |

### J-05: Suspend Member

| Step | Route/Page | UI Action | Component/File | API/Backend Call | Expected Result | Evidence | Status |
|------|-----------|-----------|---------------|-----------------|----------------|---------|--------|
| 1 | `/org/$s/officer/roster` | Click member name | MemberTable | — | Navigate to detail | E2E: STRONG | WORKING |
| 2 | `/org/$s/officer/roster/$id` | Page loads | MemberDetail | `GET /association/member/roster/:memberId` | Member data displayed | E2E: STRONG | WORKING |
| 3 | Member detail | Click "Suspend Member" | Button | — | Suspend dialog opens | E2E: STRONG | WORKING |
| 4 | Suspend dialog | Enter reason, click "Suspend" | Dialog | `PUT /association/member/roster/:memberId` with `{status:'suspended', note}` | Member suspended | E2E: STRONG | WORKING |
| 5 | Member detail | Status updates | QueryClient invalidate | — | Status badge shows "Suspended" | E2E: STRONG | WORKING |

### J-06: CSV Import

| Step | Route/Page | UI Action | Component/File | API/Backend Call | Expected Result | Evidence | Status |
|------|-----------|-----------|---------------|-----------------|----------------|---------|--------|
| 1 | `/org/$s/officer/roster/import` | Navigate to import | Import page | — | Upload area visible | E2E: render check | WORKING |
| 2 | Import page | Drop/browse CSV file | File input | Client-side CSV parse | Preview table shown with validated rows | Code review | LIKELY WORKING BUT UNTESTED |
| 3 | Import page | Click "Import Members" | Button | `POST /association/member/roster/import` | Members imported, success banner | Code review | LIKELY WORKING BUT UNTESTED |
| 4 | Import page | Toast success | — | — | "Successfully imported N members" | Code: toast.success | LIKELY WORKING BUT UNTESTED |

### J-13: Accept Invite

| Step | Route/Page | UI Action | Component/File | API/Backend Call | Expected Result | Evidence | Status |
|------|-----------|-----------|---------------|-----------------|----------------|---------|--------|
| 1 | Email link | Click invite link | — | — | Navigate to `/invite/validate/:token` | Code: validateInvite handler | LIKELY WORKING BUT UNTESTED |
| 2 | Validate page | Page loads | — | `GET /invite/validate/:token` | Pre-populated claim form shown | Code: response `{valid, email, orgId}` | LIKELY WORKING BUT UNTESTED |
| 3 | Auth page | Sign in or sign up | — | Better-Auth | User authenticated | Code: auth flow | LIKELY WORKING BUT UNTESTED |
| 4 | Claim page | Click claim | — | `POST /invite/claim/:token` | User added to org membership | Code: claimInvite handler | LIKELY WORKING BUT UNTESTED |

---

## 4. Broken Journey Report

| ID | Journey | Role | Broken Step | Evidence | Severity | Recommended Fix | Recommended Test Type |
|----|---------|------|------------|---------|----------|----------------|---------------------|
| BJ-M4-01 | J-11: Renew membership | Member | Step: Click "Renew" | `membership-list.tsx` — `<Button variant="link">Renew</Button>` has no onClick handler | P2 | Wire to dues payment flow or remove button | Component + E2E |
| BJ-M4-02 | J-02: Review application | Officer | Entire journey untested E2E | No E2E test covers approve/deny with real data | P1 | Add E2E test: filter → approve → verify status change | E2E |
| BJ-M4-03 | J-04: Add member to roster | Officer | Full form submission untested | No E2E test for add member form | P1 | Add E2E: open form → fill → submit → verify member in roster | E2E |
| BJ-M4-04 | J-13: Accept invite | Unauthed | Full journey untested E2E | No E2E covers validate → auth → claim → org membership | P1 | Add E2E cross-module journey | E2E |
| BJ-M4-05 | J-08: Terminate member | Officer | No test coverage at all | terminate/decease dialogs exist in code but no tests | P1 | Add E2E: terminate → status changes | E2E |

---

## 5. Journey Criticality

| Journey | Role | Criticality | Reason | Required Test Level | E2E Required? |
|---------|------|-------------|--------|-------------------|--------------|
| J-01: View roster | Officer | CRITICAL | Core officer workflow | API + E2E | Yes |
| J-02: Review application | Officer | CRITICAL | Membership gate — determines who joins | API + E2E | Yes |
| J-03: Bulk approve | Officer | CRITICAL | Efficiency feature for large orgs | API + E2E | Yes |
| J-04: Add member | Officer | CRITICAL | Manual member addition | API + E2E | Yes |
| J-05: Suspend/reinstate | Officer | CRITICAL | Membership lifecycle | API + E2E | Yes (COVERED) |
| J-06: CSV import | Officer | IMPORTANT | Bulk onboarding | API + E2E | Yes |
| J-07: Manage categories | Officer | IMPORTANT | Financial tier config | API + E2E | Yes |
| J-08: Terminate/decease | Officer | IMPORTANT | Destructive lifecycle action | API + E2E | Yes |
| J-09: Apply for membership | Member | CRITICAL | Entry point for new members | API + E2E | Yes |
| J-10: View memberships | Member | IMPORTANT | Self-service | E2E | Yes |
| J-11: Renew membership | Member | CRITICAL | Revenue, member retention | API + E2E | Yes (BROKEN) |
| J-12: Update org profile | President | IMPORTANT | Org management | API + E2E | Yes |
| J-13: Accept invite | Unauthed→Member | CRITICAL | Onboarding path | API + E2E | Yes |

---

## 6. E2E Journey Coverage Matrix

| Journey | Role | Requires E2E? | Existing E2E Test | Coverage Quality | Missing Assertions | Severity |
|---------|------|--------------|------------------|-----------------|-------------------|----------|
| J-01: View roster | Officer | Yes | `membership-actions.spec.ts` | STRONG | Category filter, dues status filter | P2 |
| J-02: Review application | Officer | Yes | None | NONE | Approve→status change, deny→reason stored | P1 `[E2E GAP]` |
| J-03: Bulk approve | Officer | Yes | None | NONE | Select→bulk approve→all status change | P1 `[E2E GAP]` |
| J-04: Add member | Officer | Yes | None | NONE | Form→submit→member in roster | P1 `[E2E GAP]` |
| J-05: Suspend/reinstate | Officer | Yes | `membership-actions.spec.ts` | STRONG | Reinstate after suspend, terminate | P2 |
| J-06: CSV import | Officer | Yes | `membership-actions.spec.ts` | WEAK (render only) | Upload→preview→import→verify roster | P1 `[E2E GAP]` |
| J-07: Manage categories | Officer | Yes | `membership-actions.spec.ts` | WEAK (render only) | Add→save→verify in table, deactivate | P2 |
| J-08: Terminate/decease | Officer | Yes | None | NONE | Dialog→confirm→status = removed/deceased | P1 `[E2E GAP]` |
| J-09: Apply for membership | Member | Yes | `registration-to-payment.spec.ts` | WEAK (page presence only) | Form submit→application created→status = submitted | P1 `[E2E GAP]` |
| J-10: View memberships | Member | Yes | None | NONE | Page loads with real data, renew visible | P2 |
| J-11: Renew membership | Member | Yes | None | NONE (BROKEN) | Button click→payment flow→status renewed | P1 `[E2E GAP]` |
| J-12: Update org profile | President | Yes | None | NONE | Form→save→data persisted | P2 |
| J-13: Accept invite | Unauthed | Yes | None | NONE | Validate→auth→claim→org membership | P1 `[E2E GAP]` `[CROSS-MODULE JOURNEY]` |

---

## 7. Navigation Smoke Coverage Matrix

| Nav Path | Source Route | Target Route | Role | Existing Test | Existing E2E | Needs E2E Smoke? | Severity |
|----------|------------|-------------|------|-------------|-------------|-----------------|----------|
| Sidebar → Roster | Officer dashboard | `/org/$s/officer/roster` | officer | None | E2E: implied | Yes | P2 |
| Sidebar → Applications | Officer dashboard | `/org/$s/officer/applications` | officer | None | E2E: implied | Yes | P2 |
| Roster → Member detail | `/org/$s/officer/roster` | `/org/$s/officer/roster/$id` | officer | E2E: STRONG | E2E: STRONG | Covered | — |
| Roster → Import | `/org/$s/officer/roster` | `/org/$s/officer/roster/import` | officer | None | E2E: render check | Yes | P2 |
| Settings → Categories | Officer settings | `/org/$s/officer/settings/membership-categories` | officer | None | E2E: render check | Yes | P2 |
| Sidebar → Directory | Member dashboard | `/org/$s/directory` | member | None | E2E: directory-onboarding | Covered | — |
| Sidebar → Members | Member dashboard | `/org/$s/members` | member | None | None | Yes | P2 |

---

## 8. Role Access Coverage Matrix

| Route/Journey | Role | Should Allow? | Frontend Test | API/Integration Test | E2E Test | Gap | Severity |
|--------------|------|--------------|--------------|--------------------|---------|----|----------|
| `GET /association/member/roster` | association:admin | Yes | None | Dead handler test | E2E: implied | Live handler deny test missing | P1 |
| `GET /association/member/roster` | user | No | None | None | None | No deny test | P1 |
| `POST /.../applications/:id/approve` | association:admin | Yes | None | Backend test | None | E2E missing | P1 |
| `POST /.../applications/:id/approve` | user | No | None | None | None | No deny test | P1 |
| `PUT /membership/org-profile/:orgId` | PRESIDENT | Yes | None | Backend test | None | E2E missing | P2 |
| `PUT /membership/org-profile/:orgId` | non-president officer | No | None | None | None | No deny test | P1 |
| `POST /invite` | officer + org context | Yes | None | Backend test | None | E2E missing | P2 |
| `POST /invite` | unauthenticated | No | None | None | None | No deny test | P2 |

---

## 9. Product Decisions Needed

| Question | Journey | Role | Affected Route/API/Component | Why Needed |
|----------|---------|------|----------------------------|----|
| Should any authenticated user be able to read any org's profile? | J-12 | user | `GET /membership/org-profile/:orgId` | Currently roles: ["user"] — no org membership check. Is this intentional? |
| What should the Renew button do? | J-11 | member | `membership-list.tsx` | Button exists with no handler — needs payment flow wiring or removal |
| Should category editor support duesAmount/billingCycle/sortOrder? | J-07 | officer | `category-editor.tsx`, TypeSpec `UpsertCategoryBody` | Frontend sends these but TypeSpec doesn't define them |
| Is the member application form accessible from the member side? | J-09 | member | `[NEEDS MANUAL CONFIRMATION]` | No obvious "Apply" button found in member routes |

---

## 10. Gate 7 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 7 | Membership/Applications | **PASS** | 13 journeys mapped by role, steps listed, UI actions linked, APIs linked, final states defined, broken steps identified (5), E2E gaps identified (8), criticality assigned | None blocking |
