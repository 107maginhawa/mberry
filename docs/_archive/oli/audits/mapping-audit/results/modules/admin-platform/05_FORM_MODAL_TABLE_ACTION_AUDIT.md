# Audit 05 — Form, Modal, and Table Action Audit
## Module: Admin / Platform (`apps/admin`)

**Date:** 2026-05-26  
**Branch:** audit/codebase-improvements  
**Auditor:** Claude Code (Sonnet 4.6)  
**Scope:** All forms, modals, and table actions in `apps/admin/src/routes/`  
**Backend scope:** `services/api-ts/src/handlers/platformadmin/` (26 handlers)

---

## 1. Form Registry

| ID | Form Name | Route File | Form Type | Submit Handler |
|----|-----------|-----------|-----------|---------------|
| F-01 | Create Association | `routes/associations/index.tsx` | Dialog-embedded create | `createAssociationMutation` |
| F-02 | Edit Association | `routes/associations/$associationId.tsx` | Full-page edit | `updateAssociationMutation` |
| F-03 | Create Organization | `routes/organizations/index.tsx` | Dialog-embedded create | `createOrganizationMutation` |
| F-04 | Edit Organization | `routes/organizations/$organizationId.tsx` | Full-page edit | `updateOrganizationMutation` |
| F-05 | Invite Operator | `routes/operators/index.tsx` | Dialog-embedded create | `inviteAdminMutation` |
| F-06 | Create Feature Flag | `routes/feature-flags/index.tsx` | Inline panel create | `setFeatureFlagMutation` |
| F-07 | Impersonation | `routes/impersonate/index.tsx` | Two-step workflow form | `startImpersonationApi` |
| F-08 | Audit Log Filters | `routes/audit/index.tsx` | Query filter form (read-only) | — (query params only) |

---

## 2. Form Behavior Matrix

| ID | Fields | Required (frontend) | Defaults | Loading State | Error State | Success State | Dirty Guard | Duplicate Submit Protected | Post-Submit Nav | Reset on Cancel |
|----|--------|--------------------|---------|--------------|-----------|--------------|-----------|--------------------------|--------------:|-|
| F-01 | name, country, currency | name, country, currency (HTML required attr) | — | Button disabled during mutation | Toast error (sonner) | Dialog closes, list invalidated | No | No (button disables on isPending) | Stay on associations list | Yes (dialog unmount) |
| F-02 | name, country, currency, locale, licenseFormatRegex, creditCyclePeriod, requiredCreditsPerCycle, carryoverEnabled | name (inferred by save action) | Prefilled from existing record | Button disabled | Toast error | Toast success + refetch | No | No (button disables on isPending) | Stay on detail page | No (navigating away loses edits) |
| F-03 | associationId, name, orgType, region, contactEmail, initialOfficerEmail | name, associationId (select required) | orgType defaults to 'chapter' | Button disabled | Toast error | Dialog closes, list invalidated | No | No | Stay on organizations list | Yes (dialog unmount) |
| F-04 | Same as F-03 + status transition | name (inferred) | Prefilled | Button disabled | Toast error | Toast success + refetch | No | No | Stay on detail page | No |
| F-05 | name, email, role | name, email (HTML required); role (select has default) | role defaults to 'support' | Button disabled | Toast error | Dialog closes, list invalidated | No | No | Stay on operators list | Yes (dialog unmount) |
| F-06 | targetType, targetId (conditional), moduleName, enabled | targetType, moduleName (implied by selects) | enabled=false, targetType='global' | Button disabled | Toast error | Form resets, table invalidated | No | No | Stay on feature-flags list | No clear reset |
| F-07 | orgId (step 1 select), memberId (step 2 select) | orgId required for step 1, memberId for step 2 | — | Button disabled | Toast error | Redirect/session swap | No | No | Redirect to impersonated session | Partial (step 1 resets step 2) |
| F-08 | action, resourceType, startDate, endDate, userId | None (all optional filters) | — | Query loading indicator | Error state in query | Table updates | N/A | N/A | N/A | Clear button |

---

## 3. Frontend vs. Backend Validation Matrix

| Form | Field | Frontend Validation | Backend Validator | Gap |
|------|-------|--------------------|--------------------|-----|
| F-01 Create Association | name | HTML `required` only | `z.string().min(1)` in `CreateAssociationBody` | **P2** — no min-length, no max-length enforced in UI |
| F-01 | country | HTML `required` only | `z.string()` enum or string | **P2** — no country-code format validation in UI |
| F-01 | currency | HTML `required` + select | `z.string()` | OK — select prevents invalid values |
| F-02 Edit Association | licenseFormatRegex | Text input, no pattern validation | Backend validates regex syntax | **P2** — invalid regex submittable from UI; backend rejects with 400 but no pre-validation |
| F-02 | creditCyclePeriod | Number input | `z.number().min(1)` | **P2** — no min/max in frontend |
| F-02 | requiredCreditsPerCycle | Number input | `z.number().min(0)` | **P2** — no min/max in frontend |
| F-03 Create Org | contactEmail | Text input | `z.string().email()` in `CreateOrganizationBody` | **P2** — no email format validation in frontend |
| F-03 | initialOfficerEmail | Text input | `z.string().email()` | **P2** — no email format validation in frontend |
| F-03 | orgType | Select | `z.enum(['chapter','society','national','clinic'])` | OK — select prevents invalid values |
| F-05 Invite Operator | email | HTML `required` only | `z.string().email()` in `InviteAdminBody` | **P2** — no email format validation in frontend |
| F-05 | role | Select | `z.enum(['super','support','analyst'])` | OK — select prevents invalid values |
| F-06 Feature Flag | targetId | Text input (conditional) | Validated when targetType != global | **P1** — targetId shown/hidden by JS; if JS error, blank targetId submits to backend |
| F-06 | moduleName | Select from hardcoded list | `z.string()` | **P2** — frontend list may diverge from backend allowed values; no runtime sync |
| F-07 Impersonation | memberId | Select from org members | Server-side: member must belong to org | OK — select restricts to valid members |
| F-08 Audit Filters | startDate/endDate | Date inputs | Backend accepts ISO strings | **P3** — no cross-field validation (endDate > startDate) in frontend |

**Summary:**
- No form uses `react-hook-form` or `zodResolver` — zero client-side schema validation library usage.
- All client validation is HTML5 `required` attributes + select constraints.
- Backend validators (auto-generated Zod schemas in `services/api-ts/src/generated/openapi/validators.ts`) are significantly stricter.

---

## 4. Modal Registry

| ID | Modal Name | Route File | Trigger | Type |
|----|-----------|-----------|---------|------|
| M-01 | Create Association Dialog | `routes/associations/index.tsx` | "New Association" button | `Dialog` (shadcn) |
| M-02 | Delete Association Confirmation | `routes/associations/$associationId.tsx` | "Delete" button | `AlertDialog` |
| M-03 | Create Organization Dialog | `routes/organizations/index.tsx` | "New Organization" button | `Dialog` |
| M-04 | Org Status Transition | `routes/organizations/$organizationId.tsx` | Dropdown button | Inline dropdown action (no modal) |
| M-05 | Invite Operator Dialog | `routes/operators/index.tsx` | "Invite Operator" button | `Dialog` |
| M-06 | Revoke Admin Confirmation | `routes/operators/index.tsx` | "Revoke" row action button | `AlertDialog` |
| M-07 | Delete Feature Flag (inline) | `routes/feature-flags/index.tsx` | Row "Delete" button | **No dialog** — direct mutation call |

---

## 5. Modal Behavior Matrix

| ID | Open Trigger | Close/Cancel | Confirm | Escape Key | Outside Click | Focus Trap | Accessible Title | Accessible Description | Destructive Confirmation Pattern | Tests |
|----|------------|------------|--------|-----------|--------------|-----------|----------------|-----------------------|----------------------------------|-------|
| M-01 | Button click | Cancel button / X | Save button → F-01 submit | Closes (Radix default) | Closes (Radix default) | Yes (Radix Dialog) | `DialogTitle` present | `DialogDescription` absent | N/A (create) | None |
| M-02 | Delete button | Cancel | Confirm delete → `deleteAssociationMutation` | Closes | Does NOT close (AlertDialog default) | Yes | `AlertDialogTitle` present | `AlertDialogDescription` present | Yes — AlertDialog used | None |
| M-03 | Button click | Cancel / X | Save → F-03 submit | Closes | Closes | Yes | `DialogTitle` present | `DialogDescription` absent | N/A (create) | None |
| M-04 | Dropdown selection | N/A | Immediate API call on selection | N/A | N/A | N/A | N/A | N/A | **P1 GAP** — suspend/cancel transitions fire with no confirmation | None |
| M-05 | Button click | Cancel / X | Save → F-05 submit | Closes | Closes | Yes | `DialogTitle` present | `DialogDescription` absent | N/A (create) | None |
| M-06 | Revoke button per row | Cancel | Confirm → `revokeAdminMutation` | Closes | Does NOT close | Yes | `AlertDialogTitle` present | `AlertDialogDescription` present | Yes — AlertDialog used | None |
| M-07 | Delete button per row | N/A | Immediate `deleteFeatureFlagMutation` call | N/A | N/A | N/A | N/A | N/A | **P1 GAP** — no confirmation; irreversible action fires directly | None |

---

## 6. Table/List Action Registry

| ID | Table Name | Route File | Row Click | View | Edit | Delete | Bulk Actions | Pagination | Sorting | Filtering | Empty State | Loading State |
|----|-----------|-----------|----------|------|------|--------|-------------|-----------|--------|---------|------------|------------|
| T-01 | Associations Table | `associations/index.tsx` | → detail page | Row click | Via detail page | Via detail page (AlertDialog) | None | **None — loads up to 100** | None | Present | Skeleton/spinner |
| T-02 | Organizations Table | `organizations/index.tsx` | → detail page | Row click | Via detail page | Via detail page | None | **None — loads up to 100** | None | Present | Skeleton |
| T-03 | Operators Table | `operators/index.tsx` | None | None | None | Revoke button (AlertDialog) | None | None | None | Present | Skeleton |
| T-04 | Feature Flags Table | `feature-flags/index.tsx` | None | None | None | Delete button (no confirm) | None | None | None | Present | Skeleton |
| T-05 | Members Table | `members/index.tsx` | → member detail | Row click | None | None | None | None | None | Search input | Skeleton |
| T-06 | Audit Log Table | `audit/index.tsx` | None | None | None | None | None | **Offset-based, 25/page** | None | Present | Skeleton |
| T-07 | National Dashboard Table | `national/index.tsx` | None | None | None | None | None | None | None | None | Skeleton |
| T-08 | Committees Table | `committees/index.tsx` | None | None | None | None | None | None | None | None | Present |
| T-09 | Events Table | `events/index.tsx` | → event detail | Row click | None | None | None | None | None | Search + status filter | Skeleton |
| T-10 | Surveys Table | `surveys/index.tsx` | None | None | None | None | None | None | None | None | Present |

---

## 7. Table/List Behavior Matrix

| ID | Error State | Role Restriction | Confirm Before Delete | Empty State Text | Export | Notes |
|----|------------|-----------------|----------------------|-----------------|--------|-------|
| T-01 | Query error boundary | None (all roles see list) | Yes (AlertDialog on detail page) | "No associations found" | No | 100-item hard cap; no indicator when cap hit |
| T-02 | Query error boundary | None | No confirmation for status change via dropdown | "No organizations found" | No | Status transition (M-04) has no guard |
| T-03 | Query error boundary | Visible to all; Revoke restricted to super by UI (RequireRole on page) | Yes (AlertDialog) | "No operators found" | No | Revoke button visible even to support/analyst — RequireRole wraps the whole page, not just the button |
| T-04 | Query error boundary | RequireRole(['super']) wraps page | **No** — direct delete | "No flags set" | No | **P1**: delete fires immediately |
| T-05 | Query error boundary | None (all admin roles) | N/A | "No members found" | No | Cross-org search; no org filter UI |
| T-06 | Query error boundary | None (all admin roles) | N/A | "No audit entries" | No | Only paginated table in admin; proper offset pagination |
| T-07 | None defined | None | N/A | None defined | No | Read-only metrics |
| T-08 | Query error boundary | RequireRole(['super','support']) | N/A | Present | No | Read-only |
| T-09 | Query error boundary | None | N/A | Present | No | Search works; status filter present |
| T-10 | None defined | None | N/A | Present | No | Read-only |

---

## 8. Role-Aware Form/Modal/Table Matrix

| Component | Visible To | Actionable By | Frontend Gate | Backend Gate | Gap |
|-----------|-----------|--------------|--------------|-------------|-----|
| F-01 Create Association | All admin roles | All roles can reach form | None | `authMiddleware` only — no role check | **P1** — no backend role enforcement on createAssociation; analyst can POST |
| F-02 Edit Association | All admin roles | All roles can submit | None | `authMiddleware` only | **P1** — same; analyst can PATCH |
| F-03 Create Organization | All admin roles | All roles | None | `authMiddleware` only | **P1** — analyst can POST |
| F-04 Edit Organization | All admin roles | All roles | None | `authMiddleware` only | **P1** — analyst can PATCH |
| F-05 Invite Operator | RequireRole(['super']) wraps page | Super only (UI) | RequireRole page wrap | `authMiddleware` only — no `super` check on handler | **P1** — support/analyst can call `POST /admin/admins` directly bypassing UI gate |
| F-06 Create Feature Flag | RequireRole(['super']) wraps page | Super only (UI) | RequireRole page wrap | `authMiddleware` only | **P1** — same bypass vector |
| F-07 Impersonation | RequireRole(['super']) | Super only (UI) | RequireRole page wrap | Handler must verify | Check handler for backend role guard |
| M-06 Revoke Admin | RequireRole(['super']) page | Super only (UI) | RequireRole page wrap | `authMiddleware` only | **P1** — same; `DELETE /admin/admins/:id` callable by any authenticated admin |
| T-03 Operators Table | RequireRole(['super']) page | Super only (UI) | RequireRole page wrap | `authMiddleware` only | **P1** — role enforcement frontend-only |
| T-04 Feature Flags | RequireRole(['super']) page | Super only (UI) | RequireRole page wrap | `authMiddleware` only | **P1** — same |
| T-06 Audit Log | All roles | All roles (read-only) | None | `authMiddleware` | OK — read-only, no mutation |
| T-08 Committees | RequireRole(['super','support']) | Read-only | RequireRole page wrap | N/A (read) | OK |

**Pattern finding:** `RequireRole` is a React component that renders a UI gate — it does NOT protect API routes. The backend `authMiddleware` verifies session but does not check sub-role (`super`/`support`/`analyst`). Any authenticated admin token can call any mutation endpoint regardless of sub-role.

---

## 9. Frontend/Backend Alignment Matrix

| Feature | Frontend Expects | Backend Provides | Aligned? | Gap |
|---------|----------------|-----------------|----------|-----|
| Create Association fields | name, country, currency | `CreateAssociationBody`: name (string), country (string), currency (string) | Yes | Frontend lacks format validation |
| Edit Association fields | 8 fields including locale, licenseFormatRegex | `UpdateAssociationBody`: same 8 fields | Yes | licenseFormatRegex not pre-validated in UI |
| Create Org orgType values | chapter/society/national/clinic | Backend enum same 4 values | Yes | OK |
| Invite Operator roles | super/support/analyst | Backend enum same 3 values | Yes | OK |
| Feature Flag targetType | global/association/organization | Backend accepts same 3 | Yes | Frontend hardcoded list of moduleNames may drift from backend |
| Feature Flag moduleName | Hardcoded list in UI | Backend: `z.string()` (free-form) | **Partial** | **P2** — backend accepts any string; frontend restricts to preset list. New modules added to backend won't appear in UI without code change |
| Impersonation flow | 2-step: orgId then memberId | `POST /admin/impersonate` with personId | Yes | OK |
| Audit log filters | action, resourceType, startDate, endDate, userId | Query params on `GET /admin/audit` | Yes | No cross-field date validation |
| Operators list columns | Name, Email, Role, Last Active | `AdminUser` model includes all fields | Yes | "Last Active" may be null for new admins — no null handling shown |
| Pagination: Associations | No UI pagination (loads all) | API supports `limit`/`offset` | **Misaligned** | **P2** — frontend fetches up to 100 with no user control; large deployments will silently truncate |
| Pagination: Organizations | No UI pagination | Same as above | **Misaligned** | **P2** — same |
| Pagination: Audit Log | Offset-based, 25/page | API offset pagination | Yes | OK |

---

## 10. E2E Form/Modal/Table Coverage Matrix

### Admin E2E Test Files Found

```
apps/admin/playwright/
  associations.spec.ts
  organizations.spec.ts
  operators.spec.ts
  feature-flags.spec.ts
  audit.spec.ts
  impersonate.spec.ts
```

> Note: E2E test files found — coverage levels below are inferred from file existence + known audit context. Actual test pass/fail state requires running `bun run test:e2e` in `apps/admin`.

| Component | Spec File | Happy Path | Error Path | Role Enforcement | Confirmation Dialog | Empty State | Notes |
|-----------|----------|-----------|-----------|-----------------|-------------------|------------|-------|
| F-01 Create Association | `associations.spec.ts` | Unknown | Unknown | Unknown | N/A | Unknown | File exists; depth unknown |
| F-02 Edit Association | `associations.spec.ts` | Unknown | Unknown | Unknown | Unknown | Unknown | |
| M-02 Delete Association | `associations.spec.ts` | Unknown | Unknown | Unknown | Unknown | Unknown | |
| F-03 Create Organization | `organizations.spec.ts` | Unknown | Unknown | Unknown | N/A | Unknown | |
| F-04 Edit Organization | `organizations.spec.ts` | Unknown | Unknown | Unknown | Unknown | Unknown | |
| M-04 Org Status Transition | `organizations.spec.ts` | Unknown | Unknown | Unknown | **Not tested** (no dialog exists) | Unknown | |
| F-05 Invite Operator | `operators.spec.ts` | Unknown | Unknown | Unknown | N/A | Unknown | |
| M-06 Revoke Admin | `operators.spec.ts` | Unknown | Unknown | Unknown | Unknown | Unknown | |
| F-06 Feature Flag | `feature-flags.spec.ts` | Unknown | Unknown | Unknown | N/A | Unknown | |
| M-07 Delete Feature Flag | `feature-flags.spec.ts` | Unknown | Unknown | Unknown | **Not tested** (no dialog exists) | Unknown | |
| F-07 Impersonation | `impersonate.spec.ts` | Unknown | Unknown | Unknown | N/A | Unknown | |
| F-08 Audit Filters | `audit.spec.ts` | Unknown | Unknown | Unknown | N/A | Unknown | |
| T-05 Members Table search | None found | Not covered | Not covered | Not covered | N/A | Not covered | **P2** — no spec file |
| T-07 National Dashboard | None found | Not covered | Not covered | Not covered | N/A | Not covered | **P3** — read-only |
| T-08 Committees | None found | Not covered | Not covered | Not covered | N/A | Not covered | **P3** — read-only |
| T-09 Events Table | None found | Not covered | Not covered | Not covered | N/A | Not covered | **P2** — no spec file |
| T-10 Surveys Table | None found | Not covered | Not covered | Not covered | N/A | Not covered | **P3** — read-only |

**Backend test coverage:** 27 test files, 405 assertions in `services/api-ts` for platformadmin handlers. Backend unit coverage is strong. Frontend E2E coverage depth is unknown — spec files exist but assertions have not been audited in this pass.

---

## 11. Accessibility Matrix

| Component | Labels (`htmlFor`/`aria-label`) | Error Announced (`aria-invalid`/`role="alert"`) | Focus Trap | Keyboard Dismiss | Screen Reader Title | Notes |
|-----------|--------------------------------|------------------------------------------------|-----------|-----------------|---------------------|-------|
| M-01 Create Association Dialog | Partial — Label+Input pairs present via shadcn Label | No `aria-invalid` on fields | Yes (Radix Dialog) | Escape closes | `DialogTitle` present | `DialogDescription` absent — screen readers lack context |
| M-03 Create Organization Dialog | Same as M-01 | No | Yes | Yes | Present | Same gap |
| M-05 Invite Operator Dialog | Same | No | Yes | Yes | Present | Same |
| M-02 Delete Association AlertDialog | N/A (no inputs) | N/A | Yes | Escape closes | Present | `AlertDialogDescription` present |
| M-06 Revoke Admin AlertDialog | N/A | N/A | Yes | Yes | Present | Good pattern |
| M-07 Delete Feature Flag (inline button) | Button has no `aria-label` | N/A | N/A | N/A | N/A | **P2** — icon-only delete button likely lacks accessible label |
| F-06 Feature Flag targetId (conditional) | Label present when visible | No | N/A | N/A | N/A | Conditional field hide/show may not announce change to screen reader |
| F-07 Impersonation two-step | Labels on selects | No | N/A | N/A | N/A | Step indicator not announced |
| T-01–T-10 Tables | Table has no `<caption>` or `aria-label` | N/A | N/A | N/A | N/A | **P2** — all tables lack accessible caption; screen readers announce generic table |
| F-08 Audit Filters | Labels present on date inputs | No | N/A | N/A | N/A | Date range cross-field error not announced |

**Global finding:** No `aria-describedby` linking form inputs to error messages exists in any admin form. The admin app has significantly weaker accessibility implementation than the memberry product app (which has 51 `role="alert"` instances, `aria-live`, etc.).

---

## 12. Form/Modal/Table Gap Report

### P0 — Blocking (data loss / security breach risk)

None identified at P0 severity.

### P1 — Critical (security or UX-breaking)

| ID | Location | Issue | Evidence |
|----|---------|-------|---------|
| G-01 | All mutation endpoints in platformadmin | **Role enforcement is frontend-only.** `RequireRole` component is a UI gate only. Any authenticated admin can call `POST /admin/admins`, `DELETE /admin/admins/:id`, `POST /admin/feature-flags`, etc. regardless of sub-role. Backend `authMiddleware` does not check `role` field. | `apps/admin/src/lib/role-gate.tsx` — renders access-denied UI but does not abort request. Route registration in `services/api-ts/src/generated/openapi/routes.ts` has no role middleware. |
| G-02 | `routes/feature-flags/index.tsx` M-07 | **Delete feature flag has no confirmation dialog.** Clicking Delete fires `deleteFeatureFlagMutation` immediately. Feature flags control module access; accidental deletion affects production. | Context search: "Delete feature flag" — direct mutation, no AlertDialog pattern. Spec `UI_STATES.md` §5.1 requires modal for all destructive actions. |
| G-03 | `routes/organizations/$organizationId.tsx` M-04 | **Org status transitions (suspend/cancel) fire with no confirmation dialog.** Suspending an org locks out all members. No "Are you sure?" guard. | Grep: `AlertDialog` absent from organizations detail file. Destructive action spec: "always a modal dialog, never inline confirmation." |

### P2 — Significant (UX defect or data integrity risk)

| ID | Location | Issue | Evidence |
|----|---------|-------|---------|
| G-04 | F-01, F-03, F-05 | **No email/format validation in frontend.** Email fields for `contactEmail`, `initialOfficerEmail`, operator `email` have HTML `required` only. Invalid emails submit and fail at backend with 400; user sees generic error toast. | Grep: `zodResolver` — 0 results in admin. Backend: `z.string().email()` in validators. |
| G-05 | F-02 | **`licenseFormatRegex` field accepts invalid regex syntax.** Backend validates regex at `updateAssociation`; frontend sends any string. Backend returns 400 with no user-friendly message for invalid regex. | Field type: `<Input type="text">` with no pattern pre-validation. |
| G-06 | T-01, T-02 | **Tables load up to 100 records with no pagination UI.** Associations and organizations lists use fixed `limit=100`. No indication to user when results are capped. Large deployments silently truncate. | Context: pagination grep shows only T-06 (Audit) uses offset pagination. |
| G-07 | F-06 | **Feature flag `moduleName` is a hardcoded frontend list.** Backend accepts free-form string (`z.string()`). New backend modules will not appear in UI without a frontend code change. Risk of desync. | Grep: module name select options — static array in component. |
| G-08 | T-05 Members | **No E2E spec for members table.** Cross-org member search is a power feature with no automated test coverage. | File search: no `members.spec.ts` found. |
| G-09 | All admin `Dialog` modals | **`DialogDescription` absent from create dialogs.** Screen readers announce dialog title but no description context. Radix emits a console warning for missing description. | Accessibility grep: `DialogDescription` — 0 hits in admin routes. AlertDialog pages have `AlertDialogDescription`. |
| G-10 | All tables | **All tables lack accessible caption/`aria-label`.** Screen readers cannot identify table purpose. | Grep: `<caption>` `aria-label` on table elements — 0 results in admin. |
| G-11 | M-07 Delete Feature Flag inline button | **Icon-only delete button likely lacks `aria-label`.** Row delete is a Trash icon button with no visible label. | Accessibility grep: icon button aria-label — absent in feature-flags route. |

### P3 — Minor (polish / completeness)

| ID | Location | Issue | Evidence |
|----|---------|-------|---------|
| G-12 | F-08 Audit Filters | No cross-field date validation (endDate must be >= startDate). | Frontend: two independent date inputs, no cross-validation logic. |
| G-13 | F-02, F-04 | No dirty-state guard — navigating away from an unsaved edit loses changes silently. | No `useBlocker` or `onBeforeUnload` handler found in routes. |
| G-14 | T-07, T-10 | National Dashboard and Surveys tables have no defined error state. | No error boundary or error UI shown in those routes. |
| G-15 | T-03 Operators | "Last Active" column has no null/undefined handling documented. New operators will have null last-active; display behavior unverified. | `AdminUser` model — `lastActive` is nullable. |
| G-16 | F-07 Impersonation | Two-step flow has no step indicator accessible to screen readers. | No `aria-current` or step announcement in impersonate route. |

---

## 13. Product Decisions Needed

| # | Question | Context | Severity if Unresolved |
|---|---------|---------|----------------------|
| PD-01 | Should `analyst` role be able to view-only on associations/organizations list pages, but blocked from all mutations? Current UI shows same pages to all roles. Defining read-only vs. mutation scopes per role requires backend middleware. | G-01 establishes that sub-roles are frontend-only today. | P1 |
| PD-02 | What is the intended behavior when 100+ associations or organizations exist? Cap silently at 100, add server-side pagination, or add a load-more? | G-06. Current hard cap gives no user signal. | P2 |
| PD-03 | Should org status transitions (active → suspended → cancelled) be reversible? If so, a confirmation dialog with consequence text is required. If irreversible (cancelled), a typed-confirmation dialog (like the ConfirmDialog `irreversible` variant) should be used. | G-03. Spec `UI_STATES.md §5.1` mandates modal for destructive transitions. | P1 |
| PD-04 | Should the admin feature-flag module name list be dynamically fetched from the backend to stay in sync, or remain a frontend constant? | G-07. Drift risk as product grows. | P2 |
| PD-05 | Is impersonation logged in the audit trail? If not, this is a compliance gap — any super admin could impersonate any member with no trace. | `routes/impersonate/index.tsx` uses `startImpersonationApi`. Backend audit handler exists but impersonation event logging not confirmed. | P1 |

---

## 14. Gate 5 Evaluation

### Scoring Summary

| Category | Max | Score | Notes |
|----------|-----|-------|-------|
| Form completeness | 20 | 14 | All 8 forms identified; missing Zod/RHF validation throughout |
| Form validation alignment (FE vs BE) | 15 | 7 | No client-side schema library; 6+ fields with FE/BE validation gap |
| Modal completeness | 15 | 10 | 7 modals registered; 2 missing confirmation dialogs (G-02, G-03) |
| Table action coverage | 15 | 11 | 10 tables; only T-06 has pagination; T-05/T-09/T-07/T-10 lack E2E |
| Role enforcement | 15 | 4 | Frontend-only gates; backend has no sub-role middleware (G-01 — systemic P1) |
| Accessibility | 10 | 4 | No `aria-invalid`, no table captions, no `DialogDescription`, icon buttons unlabeled |
| E2E coverage | 10 | 5 | Spec files exist for 6/10+ surfaces; depth unknown; 4 tables have zero spec |

**Total: 55/100**

### Gate 5 Verdict: FAIL

**Blocking issues (must fix before gate pass):**

1. **G-01** — Sub-role enforcement must move to backend middleware for all mutation routes. Frontend `RequireRole` alone is not security.
2. **G-02** — Feature flag delete must show confirmation `AlertDialog` before firing mutation.
3. **G-03** — Org status transitions to `suspended`/`cancelled` must require confirmation dialog.
4. **PD-05** — Impersonation audit logging must be confirmed or implemented.

**Recommended fixes for P2 before next milestone:**

- Add `zodResolver` + Zod schema to F-01, F-03, F-05 at minimum (email, required format).
- Add table pagination UI for T-01 and T-02.
- Add `DialogDescription` to all 3 create dialogs.
- Add `aria-label` to icon-only delete buttons.
- Add `members.spec.ts` and `events.spec.ts` E2E specs for admin.

---

*Audit 05 complete. Next: Audit 06 — State Management and Data Flow Audit.*
