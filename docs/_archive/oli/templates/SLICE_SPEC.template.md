# Slice Specification: [Slice Name]

**Parent Module Spec:** [docs/specs/MODULE_NAME.md]
**Slice Type:** full-stack | backend-only
**Version:** [0.1.0]
**Date:** [YYYY-MM-DD]
**Author:** [Name]
**Status:** Draft | Review | Approved

---

## 1. User Story / Workflow Description

<!-- Full-stack: "As a [role], I want to [action] so that [outcome]." -->
<!-- Backend-only: "When [system event], the API must [behavior]." -->

**Story:**
> As a [role], I want to [action] so that [outcome].

**Happy Path Workflow:**
1. [Step 1 — user or system action]
2. [Step 2 — system response]
3. [Step 3 — outcome visible to user/caller]

---

## 2. Acceptance Criteria

<!-- Each AC becomes exactly one test. Number them — slices, tests, and reviews reference by number. -->
<!-- Format: "Given [context], when [action], then [outcome]." -->

1. Given [context], when [action], then [outcome].
2. Given [context], when [action], then [outcome].
3. Given a user without the required role, when they call the endpoint, then they receive 403.
4. Given invalid input [field], when the request is submitted, then [error message] is returned.

---

## 3. Business Rules for This Slice

<!-- Reference rule numbers from the parent Module Spec. Add slice-specific rules here. -->

- Applies: Rule #[N] from module spec — [brief restatement]
- Applies: Rule #[N] from module spec — [brief restatement]
- Slice-specific: [any rule unique to this slice]

---

## 4. Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| [fieldName] | Required, non-empty string | "[fieldName] is required" |
| [fieldName] | Max [N] characters | "[fieldName] must be [N] characters or fewer" |
| [fieldName] | Must match pattern [regex] | "[fieldName] format is invalid" |
| [fieldName] | Must be unique per [scope] | "[fieldName] already exists" |

---

## 5. Permission Requirements

**Required role(s):** [role1] | [role2]
**Ownership check:** <!-- e.g. User may only access records where person_id = auth.user.id -->
**Cross-entity check:** <!-- e.g. Parent entity must belong to same tenant -->

---

## 6. Error Scenarios

| Scenario | Expected Behavior | HTTP Status |
|----------|-------------------|-------------|
| [Entity] not found | Return error message "[Entity] not found" | 404 |
| Caller lacks required role | Return "Forbidden" | 403 |
| Duplicate [unique field] | Return "[field] already exists" | 409 |
| Missing required field | Return validation error | 400 |
| [Domain-specific error] | <!-- describe --> | [4xx/5xx] |

---

## 7. UI States

<!-- Mark entire section N/A for backend-only slices. -->
<!-- For full-stack slices, every state needs a defined rendering. -->

| State | Trigger | Expected Rendering |
|-------|---------|-------------------|
| Loading | Request in flight | Skeleton or spinner with accessible label |
| Success | Response received | [describe what the user sees] |
| Empty | Success but zero results | Empty state with guidance and CTA |
| Validation Error | Form submit with invalid data | Inline field errors per validation rules above |
| Permission Error | 403 response | "You don't have permission" message, no data exposed |
| Not Found | 404 response | [describe — redirect or inline message] |
| Unexpected Error | 5xx or network failure | Generic error with retry option |

---

## 8. API Contract (generated from TypeSpec — fill after TypeSpec is written)

**Endpoint:** `[METHOD] /[path]`
**Request shape:** <!-- key fields, or "see TypeSpec" -->
**Response shape:** <!-- key fields, or "see TypeSpec" -->
**TypeSpec location:** `specs/api/src/modules/[module].tsp`

---

## 9. Test Plan

<!-- Derived directly from ACs above. Maps 1:1. -->

| AC # | Test Description | Test Type | File |
|------|-----------------|-----------|------|
| AC-1 | [description] | unit / integration / e2e | `tests/[path]` |
| AC-2 | [description] | unit / integration / e2e | `tests/[path]` |
| AC-3 | Permission denied for wrong role | integration | `tests/[path]` |
| AC-4 | Validation rejects [field] | unit | `tests/[path]` |

---

## 10. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1.0 | [YYYY-MM-DD] | [Name] | Initial draft |
