# 04 — Frontend Interaction Integrity Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## Interaction Registry

### MemberTable (`features/membership/components/member-table.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-01 | Officer Roster | MemberTable | Search input | Input | officer | `setSearch` (debounced) | Query param → `GET /association/member/roster?search=` | Working | E2E: implied |
| I-02 | Officer Roster | MemberTable | Status tab filter | Tabs | officer | `setStatusTab` | Query param → `GET /association/member/roster?status=` | Working | E2E: implied |
| I-03 | Officer Roster | MemberTable | Category filter | Select | officer | `setCategoryId` | Query param → `GET /association/member/roster?categoryId=` | Working | None |
| I-04 | Officer Roster | MemberTable | Dues status filter | Select | officer | `setDuesStatusFilter` | Extended param `duesStatus` (not in SDK types) | Likely working `[NEEDS MANUAL CONFIRMATION]` | None |
| I-05 | Officer Roster | MemberTable | Training filter | Select | officer | `setTrainingFilter` | Extended param `trainingCompliant` (not in SDK types) | Likely working `[NEEDS MANUAL CONFIRMATION]` | None |
| I-06 | Officer Roster | MemberTable | Expiring within N days | Select | officer | `setExpiringDays` | Client-side filter on `duesExpiryDate` | Working | None |
| I-07 | Officer Roster | MemberTable | Member name link | Link | officer | TanStack Router Link | Navigate to `/officer/roster/$memberId` | Working | E2E: STRONG |
| I-08 | Officer Roster | MemberTable | Select all checkbox | Checkbox | officer | `toggleSelectAll` | N/A (local state) | Working | None |
| I-09 | Officer Roster | MemberTable | Row checkbox | Checkbox | officer | `toggleSelect` | N/A (local state) | Working | None |
| I-10 | Officer Roster | MemberTable | Pagination Previous/Next | Button | officer | `setPage` | Query offset changes | Working | None |

### ApplicationList (`features/membership/components/application-list.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-11 | Applications | ApplicationList | Status filter | Select | officer | `setStatusFilter` | Query param → `GET /association/member/applications?status=` | Working | None |
| I-12 | Applications | ApplicationList | Sort by | Select | officer | `setSortBy` | Client-side sort | Working | None |
| I-13 | Applications | ApplicationList | Select all checkbox | Checkbox | officer | `toggleSelectAll` | N/A (local) | Working | None |
| I-14 | Applications | ApplicationList | Row checkbox | Checkbox | officer | `toggleSelect` | N/A (local) | Working | None |
| I-15 | Applications | ApplicationList | "Approve" button | Button | officer | `reviewMutation.mutate({status:'approved'})` | `POST /association/member/applications/:id/approve` | Working | E2E: None |
| I-16 | Applications | ApplicationList | "Deny" button | Button | officer | `reviewMutation.mutate({status:'denied'})` | `POST /association/member/applications/:id/deny` | Working | E2E: None |
| I-17 | Applications | ApplicationList | "Approve N Selected" | Button | officer | `bulkApprove.mutate({applicationIds})` | `POST /association/member/applications/bulk-approve` (direct fetch, not SDK) | Working | E2E: None |

### MemberDetail (`features/membership/components/member-detail.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-18 | Member Detail | MemberDetail | "Suspend Member" button | Button | officer | Opens suspend dialog | — | Working | E2E: STRONG |
| I-19 | Member Detail | MemberDetail | Suspend confirm | Dialog Button | officer | `updateMutation.mutate({status:'suspended', note})` | `PUT /association/member/roster/:memberId` | Working | E2E: STRONG |
| I-20 | Member Detail | MemberDetail | "Reinstate" button | Button | officer | `reinstateMutation.mutate()` | `POST /association/member/memberships/:id/reinstate` | Likely working | E2E: partial |
| I-21 | Member Detail | MemberDetail | "Terminate" button | Button | officer | Opens terminate dialog | — | Working | None |
| I-22 | Member Detail | MemberDetail | "Mark Deceased" button | Button | officer | Opens deceased dialog → `deceasedMutation` | `POST /.../memberships/:id/decease` | Working | None |
| I-23 | Member Detail | MemberDetail | "Change Category" button | Button | officer | Category change dropdown | `PUT /association/member/roster/:memberId` | `[NEEDS MANUAL CONFIRMATION]` | None |
| I-24 | Member Detail | MemberDetail | Back breadcrumb | Link | officer | Navigate to roster | — | Working | None |

### CategoryEditor (`features/membership/components/category-editor.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-25 | Categories | CategoryEditor | "Add Category" button | Button | officer | Opens add dialog | — | Working | E2E: render check |
| I-26 | Categories | CategoryEditor | Add form submit | Dialog Button | officer | `handleAdd()` → `saveMutation.mutate()` | `PUT /association/member/membership-categories/:orgId` | Working | None |
| I-27 | Categories | CategoryEditor | "Deactivate" button | Button | officer | `handleDeactivate(categoryId)` | `PUT /association/member/membership-categories/:orgId` with `{id, active: false}` | Working | None |
| I-28 | Categories | CategoryEditor | Deactivate confirm | Dialog Button | officer | Same as I-27 | Same | Working | None |

### CSV Import (`routes/.../officer/roster/import.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-29 | Import | Import page | File drop / browse | Drag area + input | officer | `handleDrop` / `handleFileInput` | Client-side CSV parse | Working | E2E: render check |
| I-30 | Import | Import page | "Import Members" button | Button | officer | `handleImport()` → `importMutOpts.mutationFn()` | `POST /association/member/roster/import` | Working | None |

### MembershipList (`features/membership/components/membership-list.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-31 | Members page | MembershipList | "Renew" button | Button | member | NO handler (just renders text) | None | **Broken** — no onClick | None |

### ProfessionalLicenses (`routes/.../officer/roster/$memberId.tsx`)

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|---------------|
| I-32 | Member Detail | ProfessionalLicenses | "Verify" button | Button | officer | `verifyMutation.mutate(licenseId)` | `PATCH /association/member/licenses/:licenseId` (direct api.patch) | Likely working | None |

---

## Broken Interaction Report

| ID | Issue | File | Route/Page | Role | Evidence | Severity | Recommended Test |
|----|-------|------|-----------|------|---------|----------|-----------------|
| BI-M4-01 | "Renew" button has NO onClick handler — renders as dead UI | `membership-list.tsx` | Members page | member | `<Button variant="link" size="sm">Renew</Button>` with no onClick or href | P2 | Component test |
| BI-M4-02 | Bulk approve uses direct `fetch()` instead of SDK hook — bypasses SDK error handling, auth refresh | `application-list.tsx` | Applications | officer | Lines: `const response = await fetch('/api/association/member/applications/bulk-approve', ...)` | P2 | Integration test |
| BI-M4-03 | Category editor sends extra fields not in TypeSpec body schema (`duesAmount`, `billingCycle`, `sortOrder`, `active`, `id`) via double type cast | `category-editor.tsx` | Categories | officer | `as UpsertCategoryBody as Parameters<...>` double-cast to bypass type safety | P1 | Integration test: verify backend accepts/rejects extra fields |
| BI-M4-04 | MemberTable uses extended query params (`duesStatus`, `trainingCompliant`) not in generated SDK types — hand-cast as custom interface | `member-table.tsx` | Roster | officer | `interface RosterQueryOptions` with comment "not yet reflected in generated SDK type" | P2 | API/integration test |
| BI-M4-05 | Terminate member flow: dialog exists but no E2E or integration test covers the full terminate→status change path | `member-detail.tsx` | Member Detail | officer | Terminate dialog with `updateMutation` but no test evidence | P1 | E2E test |
| BI-M4-06 | License verify uses direct `api.patch()` not SDK — no type safety | `roster/$memberId.tsx` | Member Detail | officer | `api.patch(\`/api/association/member/licenses/${licenseId}\`, {...})` | P2 | Integration test |

---

## Missing Test Matrix

| Interaction | Risk | Recommended Test Type | Suggested Assertion |
|-------------|------|--------------------|-------------------|
| Approve single application (I-15) | Officer action changes membership state | E2E | Click approve → toast success → application status changes to "Approved" |
| Deny application with reason (I-16) | Officer action blocks membership | E2E | Click deny → enter reason → toast success → status = "Denied" |
| Bulk approve (I-17) | Multi-record state change | E2E + API | Select multiple → approve → all change status, partial failure handled |
| Add category form (I-26) | Creates financial tier | Component + API | Fill form → submit → category appears in table |
| Deactivate category (I-27/28) | Modifies tier availability | Component + API | Click deactivate → confirm → status changes |
| CSV import full flow (I-30) | Bulk data ingestion | E2E | Upload CSV → preview → import → roster shows new members |
| Terminate member (I-21/22) | Destructive membership action | E2E | Open dialog → confirm → member status = removed/deceased |
| Category filter (I-03) | Filters roster display | E2E or component | Select category → table shows only matching members |
| License verify (I-32) | Officer verification of credential | API + E2E | Click verify → license shows "Verified" badge |

---

## Gate 4 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 4 | Membership/Applications | **PASS** | 32 interactions catalogued, 6 broken/incomplete identified, missing tests documented | None blocking |
