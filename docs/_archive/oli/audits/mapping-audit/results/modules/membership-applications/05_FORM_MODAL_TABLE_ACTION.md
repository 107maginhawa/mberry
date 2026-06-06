# 05 — Form, Modal, and Table Action Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## Form Registry

| Form | Route/Page | Fields | Submit Handler | API | Role | Validation | Existing Tests | Status |
|------|-----------|--------|---------------|-----|------|-----------|---------------|--------|
| Add Member (inline) | Officer Roster | personId, tierId, categoryId, memberNumber `[NEEDS MANUAL CONFIRMATION]` | `addRosterMemberMutation` | `POST /association/member/roster` | association:admin | zValidator on backend; frontend form validation unclear | None | Likely working |
| Application Form | Member apply page | organizationId, tierId, personId `[INFERRED from TypeSpec]` | `createMembershipApplicationMutation` | `POST /association/member/applications` | user | Backend: zValidator; Frontend: `[NEEDS MANUAL CONFIRMATION]` | None | `[NEEDS MANUAL CONFIRMATION]` |
| Suspend Reason | Member Detail dialog | reason (Textarea, required for confirm) | `updateMutation.mutate({status:'suspended', note})` | `PUT /association/member/roster/:memberId` | association:admin | Frontend: `!suspendReason.trim()` disables button | E2E: STRONG | Working |
| Mark Deceased | Member Detail dialog | None (confirmation only) | `deceasedMutation.mutate({terminationReason:'deceased'})` | `POST /.../memberships/:id/decease` | association:admin | None needed (no input) | None | Working |
| Add Category | Categories dialog | name*, description, duesAmount*, billingCycle, sortOrder | `handleAdd()` → `saveMutation.mutate()` | `PUT /association/member/membership-categories/:orgId` | association:admin | Frontend: `form.name.trim() && form.duesAmount && parseFloat >= 0`; Backend: zValidator on TypeSpec fields ONLY | None | Working but drift (see BI-M4-03) |
| CSV Import | Import page | CSV file (drag/drop or browse) | `handleImport()` | `POST /association/member/roster/import` | association:admin | Frontend: CSV parse + preview; Backend: Zod `importMemberRowSchema` + per-row validation | E2E: render only | Working |
| Deny Application | Applications inline | denialReason `[INFERRED]` | `denyMutation.mutate({denialReason})` | `POST /.../applications/:id/deny` | association:admin | Backend: zValidator | None | Likely working |

### Form Field-by-Field Comparison: Add Category

| Field | Frontend Form | TypeSpec `UpsertCategoryBody` | Backend Handler | Drift? |
|-------|-------------|-------------------------------|----------------|--------|
| name | `form.name` (required) | `name: string` (required) | `body.name` | No |
| description | `form.description` (optional) | `description?: string` | `body.description` | No |
| duesAmount | `form.duesAmount` (required, converted to cents) | **NOT IN TYPESPEC** | `[NEEDS MANUAL CONFIRMATION]` | **YES — P1** |
| billingCycle | `form.billingCycle` (select) | **NOT IN TYPESPEC** | `[NEEDS MANUAL CONFIRMATION]` | **YES — P1** |
| sortOrder | `form.sortOrder` (number) | **NOT IN TYPESPEC** | `[NEEDS MANUAL CONFIRMATION]` | **YES — P1** |
| active | Sent on deactivate | **NOT IN TYPESPEC** | `[NEEDS MANUAL CONFIRMATION]` | **YES — P1** |
| id | Sent on deactivate to identify existing | **NOT IN TYPESPEC** | `[NEEDS MANUAL CONFIRMATION]` | **YES — P1** |
| applicableTiers | NOT sent by frontend | `applicableTiers?: string[]` | `body.applicableTiers ?? []` | Frontend omits field in TypeSpec schema |

**Verdict:** Category form has significant frontend/backend/TypeSpec drift. Frontend sends 5 fields not in TypeSpec. The double type-cast (`as UpsertCategoryBody as Parameters<...>`) confirms intentional bypass. The hand-wired `upsertCategory` handler in `membership/` accepts these fields; the TypeSpec-generated handler may not. **P1 — schema alignment needed.**

---

## Modal Registry

| Modal | Trigger | Confirm Action | Cancel/Close | Accessibility | Existing Tests | Status |
|-------|---------|---------------|-------------|---------------|---------------|--------|
| Suspend Member | "Suspend Member" button on member detail | `updateMutation.mutate({status:'suspended', note})` | Button + dialog close | `DialogTitle` present | E2E: STRONG | Working |
| Mark Deceased | "Mark Deceased" button on member detail | `deceasedMutation.mutate({terminationReason:'deceased'})` | Button + dialog close | `DialogTitle` present | None | Working |
| Terminate Member | "Terminate" button (status-dependent) | `[NEEDS MANUAL CONFIRMATION]` | `[NEEDS MANUAL CONFIRMATION]` | `[NEEDS MANUAL CONFIRMATION]` | None | `[NEEDS MANUAL CONFIRMATION]` |
| Add Category | "Add Category" button on categories page | `handleAdd()` | Button + dialog close | `DialogTitle` present | None | Working |
| Deactivate Category | "Deactivate" action button per row | `handleDeactivate(categoryId)` | Button + dialog close | `DialogTitle`, `DialogDescription` | None | Working |
| Deny Confirmation | `[NEEDS MANUAL CONFIRMATION]` — deny may show inline reason input or dialog | `denyMutation.mutate()` | `[NEEDS MANUAL CONFIRMATION]` | `[NEEDS MANUAL CONFIRMATION]` | None | `[NEEDS MANUAL CONFIRMATION]` |

---

## Table/List Action Registry

### MemberTable

| Table/List | Action | Role | Handler/API | State Updates | Existing Tests | Status |
|-----------|--------|------|------------|--------------|---------------|--------|
| MemberTable | Row click (name link) | officer | Navigate to `roster/$memberId` | Page navigation | E2E: STRONG | Working |
| MemberTable | Select row (checkbox) | officer | `toggleSelect(id)` | Local state | None | Working |
| MemberTable | Select all | officer | `toggleSelectAll()` | Local state | None | Working |
| MemberTable | Pagination Previous | officer | `setPage(p-1)` | Refetch with new offset | None | Working |
| MemberTable | Pagination Next | officer | `setPage(p+1)` | Refetch with new offset | None | Working |
| MemberTable | Status tab switch | officer | `setStatusTab(v)` | Refetch with status filter | None | Working |
| MemberTable | Search (debounced) | officer | `setSearch(v)` | Refetch with search param | None | Working |

### ApplicationList

| Table/List | Action | Role | Handler/API | State Updates | Existing Tests | Status |
|-----------|--------|------|------------|--------------|---------------|--------|
| ApplicationList | Approve single | officer | `approveMutation.mutate({path:{applicationId}})` | Invalidate query → refresh list | None | Working |
| ApplicationList | Deny single | officer | `denyMutation.mutate({path:{applicationId}, body:{denialReason}})` | Invalidate query → refresh list | None | Working |
| ApplicationList | Bulk approve | officer | Direct fetch → `POST /api/association/member/applications/bulk-approve` | Invalidate query → refresh, toast feedback | None | Working |
| ApplicationList | Select row | officer | `toggleSelect(appId)` | Local state | None | Working |
| ApplicationList | Status filter | officer | `setStatusFilter(v)` | Re-filter + clear selection | None | Working |

### CategoryEditor

| Table/List | Action | Role | Handler/API | State Updates | Existing Tests | Status |
|-----------|--------|------|------------|--------------|---------------|--------|
| CategoryEditor | Add category | officer | `saveMutation.mutate()` | Invalidate query → refresh table | None | Working |
| CategoryEditor | Deactivate | officer | `saveMutation.mutate({id, active:false})` | Invalidate query → refresh table | None | Working |
| CategoryEditor | Toggle active/inactive display | officer | `[INFERRED]` — rows show status badge | N/A (display) | None | Working |

---

## Form/Modal/Table Gap Report

| ID | Issue | File | Component | Role | Backend/API Link | Severity | Recommended Test |
|----|-------|------|----------|------|-----------------|----------|-----------------|
| FG-M4-01 | Category form sends 5 fields not in TypeSpec schema — double type-cast bypass | `category-editor.tsx` | CategoryEditor | officer | `PUT /association/member/membership-categories/:orgId` | P1 | Integration: verify backend handles extra fields correctly |
| FG-M4-02 | Suspend dialog requires reason text but no minimum length validation | `member-detail.tsx` | MemberDetail | officer | `PUT /association/member/roster/:memberId` | P3 | Component test: verify disabled state |
| FG-M4-03 | CSV import has no E2E test for full upload→preview→import→verify flow | `roster/import.tsx` | Import page | officer | `POST /association/member/roster/import` | P1 | E2E |
| FG-M4-04 | Application approve/deny has no E2E test covering state change | `application-list.tsx` | ApplicationList | officer | approve/deny endpoints | P1 | E2E |
| FG-M4-05 | Bulk approve uses raw `fetch()` not SDK — no type safety, no auth token refresh | `application-list.tsx` | ApplicationList | officer | `POST /.../bulk-approve` | P2 | Integration: verify auth failure handling |
| FG-M4-06 | No duplicate submission protection on category add (button only disabled while pending) | `category-editor.tsx` | CategoryEditor | officer | PUT endpoint | P3 | Component test |
| FG-M4-07 | MembershipList "Renew" button is dead — no handler | `membership-list.tsx` | MembershipList | member | None | P2 | Component test |
| FG-M4-08 | No form validation test for add member inline form | `roster/index.tsx` | RosterPage | officer | `POST /association/member/roster` | P2 | Component + integration test |

---

## Gate 5 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 5 | Membership/Applications | **PASS** | Forms, modals, table actions catalogued. Field-by-field comparison done for category form. Gaps documented with evidence. | None blocking |
