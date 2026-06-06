# 05 — Backend/API Contract Alignment Audit

**Date:** 2026-05-26
**Scope:** Frontend API calls vs backend endpoints, SDK coverage, response shapes, contract drift
**Mode:** Read-only audit. No code modifications.

---

## 1. API Integration Strategy

| Integration Method | Usage | TypeScript Safety | Count |
|-------------------|-------|-------------------|-------|
| Generated SDK hooks (`@monobase/sdk-ts`) | Primary for TypeSpec-covered endpoints | ✓ Full types | ~276 endpoints |
| Custom `api.get/post/put/delete` helper | Hand-wired routes + officer management | Partial (manual types) | ~30 calls |
| Direct `fetch()` | Special cases (multipart, missing hooks) | ✗ No types | ~5 calls |

---

## 2. Frontend/Backend Drift Report

### P0 — Critical (Will Break)

| ID | Issue | Frontend File | Backend | Evidence | Impact |
|----|-------|-------------|---------|----------|--------|
| CD-01 | Endpoint called but MISSING in backend: `POST /api/association/member/credits/void-event` | `features/events/components/post-event-actions.tsx:236` | Not implemented | Direct fetch to non-existent endpoint | **Feature broken** — revoking event credits from attendees always returns 404 |

### P1 — Major (Strong Drift)

| ID | Issue | Frontend File | Backend | Evidence | Impact |
|----|-------|-------------|---------|----------|--------|
| CD-02 | SDK codegen not re-run after bulk-approve endpoint added | `features/membership/components/application-list.tsx:115` | `POST /api/association/member/applications/bulk-approve` exists | Comment: "SDK does not yet have a generated hook" | No TypeScript safety, raw fetch |
| CD-03 | Response envelope inconsistency: positions endpoint | `features/admin/components/officer-management.tsx` | `GET /api/association/member/positions` | Frontend: `(json.items \|\| json.data \|\| [])` — checks BOTH fields | Indicates backend changed response shape |
| CD-04 | Response shape inconsistency: officer-terms flattening | Same file | `GET /api/association/member/officer-terms` | Frontend handles `t.position?.title` AND `t.positionTitle` | Backend returns both nested and flat formats unpredictably |
| CD-05 | Frontend Zod schemas vs TypeSpec validators — no verified alignment | All form components | `services/api-ts/src/generated/openapi/validators.ts` | Schemas defined independently in frontend and backend | Validation drift risk — frontend may accept data backend rejects or vice versa |

### P2 — Medium (Moderate Drift)

| ID | Issue | Frontend File | Backend | Evidence | Impact |
|----|-------|-------------|---------|----------|--------|
| CD-06 | 4 hand-wired routes NOT in OpenAPI spec | Admin app | Backend `app.ts` | `GET /admin/surveys`, `GET /og/events/:slug`, `GET /surveys/analytics/nps-trends`, `DELETE /surveys/my-responses` | No SDK hooks, no TypeSpec types |
| CD-07 | 30+ `api.get/post` calls bypass SDK hooks | Officer management, admin dashboard, directory, assessments, communications | Various hand-wired endpoints | Custom axios-style helper instead of generated hooks | No type safety, manual error handling |
| CD-08 | 6 instances of `as any` type casts | `features/dues/components/dues-setup-checklist.tsx` | Various | Type mismatch between frontend expectations and API responses | Silent type errors |
| CD-09 | Training form POST uses dynamic endpoint path | `features/training/components/training-form.tsx` | Training handlers | Endpoint constructed from state, not SDK hook | Fragile, no type safety |

---

## 3. Hand-Wired Routes Coverage

### Routes NOT in OpenAPI (no SDK hooks)

| Route | Method | Purpose | Frontend Calls Via | Test Coverage |
|-------|--------|---------|-------------------|---------------|
| `/dues/config/:orgId` | GET/PUT | Dues configuration | `api.get()` / `api.put()` | ✓ `custom-routes-auth.test.ts` (auth only) |
| `/dues/dashboard/:orgId` | GET | Dues dashboard data | `api.get()` | ✓ `route-protection-handwired.test.ts` |
| `/dues/payments/record` | POST | Record payment | `api.post()` | NONE (behavior) |
| `/dues/refunds` | POST | Issue refund | `api.post()` | NONE (behavior) |
| `/membership/members/:orgId` | GET | Roster members | `api.get()` | ✓ `route-protection-handwired.test.ts` |
| `/membership/applications/:orgId` | GET | Pending applications | `api.get()` | ✓ `route-protection-handwired.test.ts` |
| `/communications/announcements/:orgId` | GET/POST | Announcements CRUD | `api.get()` / `api.post()` | Partial |
| `/certificates/my` | GET | My certificates | `api.get()` | ✓ Auth test |
| `/events/list/:orgId` | GET | Events by org | `api.get()` | ✓ Auth test |
| `/training/list/:orgId` | GET | Training by org | `api.get()` | ✓ Auth test |
| `/elections/list/:orgId` | GET | Elections by org | `api.get()` | ✓ Auth test |
| `/credit-compliance/:orgId` | GET | CPD compliance | `api.get()` | ✓ `route-protection-handwired.test.ts` |
| `/officer-terms/:orgId` | GET | Officer terms | `api.get()` | ✓ `route-protection-handwired.test.ts` |
| `/admin/national-dashboard/:assocId` | GET | National analytics | `api.get()` | ✓ `route-protection-admin.test.ts` |
| `/admin/committees` | GET | Committees list | `api.get()` | ✓ `route-protection-admin.test.ts` |
| `/admin/surveys` | GET | Surveys list | `api.get()` | NONE |
| `/surveys/analytics/nps-trends` | GET | NPS analytics | `api.get()` | NONE |

---

## 4. API Test Gap Matrix

### Endpoints with NO behavior tests (auth-only or none)

| Endpoint | Auth Test | Behavior Test | Role Test | Error Test | Priority |
|----------|----------|--------------|-----------|-----------|----------|
| `POST /dues/payments/record` | ✓ | NONE | NONE | NONE | P1 — Financial |
| `POST /dues/refunds` | ✓ | NONE | NONE | NONE | P1 — Financial |
| `POST /api/elections/:id/vote` | Partial | NONE | NONE | NONE | P1 — Data integrity |
| `POST /api/events` | Partial | NONE | NONE | NONE | P1 — Core feature |
| `POST /api/announcements` | Partial | NONE | NONE | NONE | P1 — Mass comms |
| `POST /api/training` | Partial | NONE | NONE | NONE | P2 — Core feature |
| `POST /api/elections` | Partial | NONE | NONE | NONE | P1 — Governance |
| `POST /api/association/member/officer-terms` | NONE | NONE | NONE | NONE | P1 — Access control |
| `DELETE /api/association/member/officer-terms/:id` | NONE | NONE | NONE | NONE | P1 — Access control |
| `POST /api/membership/import` | NONE | NONE | NONE | NONE | P1 — Bulk data |
| `PATCH /api/membership/members/:id` (status) | NONE | NONE | NONE | NONE | P1 — State machine |
| `POST /api/association/member/applications/bulk-approve` | NONE | NONE | NONE | NONE | P1 — Bulk action |
| `POST /api/association/member/credits/void-event` | N/A | N/A | N/A | N/A | **P0 — Endpoint missing** |

---

## 5. Contract Alignment Recommendations

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Implement `POST /api/association/member/credits/void-event` or remove frontend call | Broken feature |
| P1 | Re-run SDK codegen to pick up `bulk-approve` and other new endpoints | Type safety |
| P1 | Standardize response envelope format (`.data` vs `.items` vs flat) | Reduce defensive fallback code |
| P1 | Add behavior tests for financial endpoints (payments, refunds) | Data integrity |
| P2 | Migrate 30+ `api.get/post` calls to generated SDK hooks | Type safety + consistency |
| P2 | Remove `as any` casts by fixing SDK types | Catch runtime errors at build time |
| P2 | Add TypeSpec definitions for remaining hand-wired routes | Full OpenAPI coverage |
| P3 | Centralize frontend Zod schemas and verify against TypeSpec | Validation alignment |

---

## Gate Evaluation: Audit 06

| Criterion | Status |
|-----------|--------|
| Backend endpoints catalogued | PASS |
| Frontend API calls catalogued | PASS |
| Frontend vs backend compared | PASS |
| Backend tests checked | PASS |
| Drift documented with severity | PASS |

**Gate Result: PASS**

---

## Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | COMPLETE | PASS | `01_ROLE_PERMISSION_MAP_AUDIT.md` |
| 03 — Route Navigation | COMPLETE | PASS | `02_ROUTE_NAVIGATION_AUDIT.md` |
| 04 — Frontend Interaction Integrity | COMPLETE | PASS | `03_FRONTEND_INTERACTION_INTEGRITY_AUDIT.md` |
| 05 — Form/Modal/Table Action | COMPLETE | PASS | `04_FORM_MODAL_TABLE_ACTION_AUDIT.md` |
| 06 — Backend API Contract Alignment | COMPLETE | PASS | `05_BACKEND_API_CONTRACT_ALIGNMENT_AUDIT.md` |
| 07 — Role-Based Journey Map | PENDING | — | — |
| 08 — Test Confidence Gap | PENDING | — | — |
| 09 — Prioritized Stabilization Plan | PENDING | — | — |

**Cumulative:** P0: 1 (CD-01 missing endpoint) | P1: 18+ | P2: 16+ | P3: 5+
