# Test Plan: [Slice Name]

**Parent Slice Spec:** [docs/specs/SLICE_NAME.md]
**Date:** [YYYY-MM-DD]
**Author:** [Name]
**Slice Type:** full-stack | backend-only

---

## 1. Business Rule Tests

<!-- One row per business rule that applies to this slice. -->

| Rule | Test Description | Input | Expected Result |
|------|-----------------|-------|-----------------|
| Rule #[N] | [what is being verified] | [input state] | [expected outcome] |
| Rule #[N] | | | |

---

## 2. Validation Tests

<!-- One row per validation rule from the slice spec. -->

| Field | Invalid Input | Expected Outcome | Error Message |
|-------|---------------|-----------------|---------------|
| [fieldName] | Empty string | 400 Bad Request | "[fieldName] is required" |
| [fieldName] | [N+1] characters | 400 Bad Request | "[fieldName] must be [N] characters or fewer" |
| [fieldName] | [bad format] | 400 Bad Request | "[fieldName] format is invalid" |
| [fieldName] | Duplicate value | 409 Conflict | "[fieldName] already exists" |

---

## 3. Permission Tests

<!-- One row per role × action combination. -->

| Role | Action | Expected Result | Notes |
|------|--------|-----------------|-------|
| [role with access] | [action] | 200 / 201 | |
| [role without access] | [action] | 403 Forbidden | |
| Unauthenticated | [action] | 401 Unauthorized | |
| [owner] | Access own record | 200 | |
| [owner] | Access other's record | 403 | |

---

## 4. API Contract Tests

<!-- Maps to Hurl contract tests in specs/api/tests/contract/ -->

| Endpoint | Method | Request Body / Params | Expected Status | Expected Shape |
|----------|--------|-----------------------|-----------------|----------------|
| /[path] | POST | [key fields] | 201 | `{ data: { id, [fields] } }` |
| /[path]/:id | GET | — | 200 | `{ data: { id, [fields] } }` |
| /[path]/:id | GET | non-existent id | 404 | `{ error: "[Entity] not found" }` |
| /[path]/:id | PUT | [key fields] | 200 | `{ data: { id, [updated fields] } }` |
| /[path]/:id | DELETE | — | 204 | empty body |

**Hurl file location:** `specs/api/tests/contract/[module]/[slice].hurl`

---

## 5. UI State Tests

<!-- N/A for backend-only slices — replace this entire section with "N/A — backend-only slice" -->

| State | How to Trigger | Expected Rendering | Pass Criteria |
|-------|---------------|-------------------|---------------|
| Loading | Delay API response | Skeleton visible | No content flash, accessible label present |
| Success | Normal response | [key elements visible] | Data matches fixture |
| Empty | Response with empty array | Empty state message + CTA | CTA links to correct route |
| Validation Error | Submit form with [bad field] | Inline error on [field] | Error text matches validation rule |
| Permission Error | 403 response | "You don't have permission" | No data exposed, no stack trace |
| Not Found | 404 response | [redirect or inline message] | [expected behavior] |
| Unexpected Error | 500 / network failure | Generic error + retry button | Retry triggers re-fetch |

---

## 6. Edge Cases

| Scenario | Input / State | Expected Behavior |
|----------|---------------|-------------------|
| Concurrent create with same unique field | Two simultaneous POST requests | One succeeds (201), one fails (409) |
| [Entity] with maximum field lengths | All fields at max chars | Accepted, no truncation |
| [Domain-specific edge case] | [describe] | [expected] |

---

## 7. Test Data Requirements

<!-- What seed data, fixtures, or factory inputs are needed to run these tests? -->

| Data Needed | Source | Notes |
|-------------|--------|-------|
| User with role [X] | Better-Auth seed / factory | Created in test setup |
| Existing [Entity] record | DB seed / factory | ID stored in variable for reuse |
| [Other fixture] | [source] | |

**Seed file location (if shared):** `tests/fixtures/[module]-seed.ts`

---

## 8. Test File Locations

| Test Type | File Path |
|-----------|-----------|
| Unit (domain/service) | `services/api-ts/src/handlers/[module]/__tests__/[slice].test.ts` |
| Integration (transport) | `services/api-ts/src/handlers/[module]/__tests__/[slice].integration.test.ts` |
| Contract (Hurl) | `specs/api/tests/contract/[module]/[slice].hurl` |
| E2E (Playwright) | `apps/account/e2e/[module]/[slice].spec.ts` |
| Component (Storybook) | `apps/account/src/[path]/[Component].stories.tsx` |
