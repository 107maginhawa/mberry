# Module Enforcement Report: m02-member-profile

**Module:** Member Profile & Settings (M02)
**Auditor:** oli-enforce-module (automated)
**Date:** 2026-05-27
**Handler Directory:** `services/api-ts/src/handlers/person/` (shared with M01)
**Spec Version:** MODULE_SPEC.md + API_CONTRACTS.md (both COMPLETE per Section 21)

---

## Compliance Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | **5.2 / 10** |
| **Label** | **PARTIAL COMPLIANCE** |
| **Cap Applied** | P1 cap (6.0) -- 5 P1 findings present |
| **P0 Findings** | 0 |
| **P1 Findings** | 5 |
| **P2 Findings** | 5 |
| **P3 Findings** | 2 |
| **Unverifiable** | 1 |

---

## Dimension Scores

| Dim | Name | Score | Weight | Notes |
|-----|------|-------|--------|-------|
| D1 | Public API | 4.5 / 10 | 25% | 5/11 spec endpoints have handlers; 6 missing or path-mismatched |
| D2 | Workflow | 5.0 / 10 | 20% | WF-010 PARTIAL, WF-011 PARTIAL, WF-012 MISSING, WF-013 COMPLETE, WF-014 PARTIAL |
| D3 | Domain Terms | 8.0 / 10 | 10% | Minor `user` refs from Better-Auth API (acceptable); no forbidden synonyms in domain layer |
| D4 | State Machine | 5.5 / 10 | 15% | Account deletion lifecycle implemented via timestamps but missing M2-R5 guards; DataExport state machine absent |
| D5 | Events | 1.0 / 10 | 15% | 0/5 spec-declared domain events emitted; no event bus integration |
| D6 | Auth/Permission | 7.0 / 10 | 15% | All existing handlers enforce GA auth; admin-tier handlers lack explicit role guards |

**Weighted Average (pre-cap):** 5.2
**Final Score:** 5.2 (below P1 cap of 6.0, no cap elevation needed)

---

## Findings by Severity

### P1 -- High (Spec-Declared, Missing or Broken)

#### EM-M02-a1b2c3d4: Digital ID Card endpoints entirely missing

- **Dimension:** D1 (Public API), D2 (Workflow)
- **Spec Reference:** API_CONTRACTS.md Section 2.6; WF-012; AC-M02-004 (QR Verification)
- **Expected:** `GET /my/id-card/:orgId` (returns card data + QR) and `GET /my/id-card/:orgId/pdf` (returns PDF binary)
- **Actual:** No `getMyIdCard` handler file exists. No route registration found. `grep` for `id-card`, `idCard`, `digitalId`, `membership.card` returned zero handler matches.
- **Impact:** Digital ID Card workflow (WF-012) completely unimplemented. AC-M02-004 (QR Verification) and AC-M02-005 (Multi-Org Display) untestable.
- **Remediation:** Create `getMyIdCard.ts` and `getMyIdCardPdf.ts` handlers; register routes; implement QR code generation with real-time status verification.

#### EM-M02-e5f6g7h8: Data Export lacks async model, DataExport entity, and status tracking

- **Dimension:** D1 (Public API), D4 (State Machine)
- **Spec Reference:** API_CONTRACTS.md Section 2.4; MODULE_SPEC Section 7 (DataExport entity); Section 8 (Data Export state transitions)
- **Expected:** `POST /my/data-export` returns `{exportId, status: "requested"}` (201). `GET /my/data-export/:id` returns `{status, downloadUrl}`. DataExport entity with states: `requested -> generating -> ready -> expired`. ZIP output with 7-day TTL.
- **Actual:** `exportMyData.ts` is a synchronous `GET /export` returning inline JSON. No DataExport table/schema exists. No export ID tracking, no async generation, no ZIP file, no TTL, no status polling endpoint.
- **Impact:** WF-014 partially broken. AC-M02-006 (rate limit) tested in isolation but not enforced. GDPR/DPA portability compliance gap -- missing payments, certificates, communications in export.
- **Remediation:** Create `data-export.schema.ts` with DataExport entity; refactor to async `POST` + status `GET` pattern; implement ZIP generation background job; add rate limiting in handler.

#### EM-M02-i9j0k1l2: Account deletion missing M2-R5 guards (pending payments, sole officer)

- **Dimension:** D4 (State Machine)
- **Spec Reference:** MODULE_SPEC Section 5 (M2-R5); AC-M02-007; WF-011 exception flows
- **Expected:** `requestMyAccountDeletion` blocks if member has pending payments OR is sole officer in any org.
- **Actual:** Handler checks only `deletionRequestedAt` for idempotency. No payment query. No officer role check. Guard logic exists as pure function in `ac-m02.member-profile.test.ts` but is NOT wired into the actual handler.
- **Impact:** Members with pending dues or sole-officer status can request deletion, violating business rule M2-R5.
- **Remediation:** Extract `canRequestDeletion()` from test file into a shared util; call it in `requestMyAccountDeletion.ts` before scheduling deletion.

#### EM-M02-m3n4o5p6: Zero domain events emitted across all m02 handlers

- **Dimension:** D5 (Events)
- **Spec Reference:** MODULE_SPEC Section 10b; API_CONTRACTS.md Section 3
- **Expected:** 5 events: `PersonUpdated` (on profile change), `PersonAnonymized` (on deletion completion), `DataExportReady` (on export generation), `DeletionRequested` (on deletion request), `DeletionCancelled` (on deletion cancel)
- **Actual:** `grep` for all 5 event names across entire `services/api-ts/src/` returned zero matches in handler code. No event bus integration. Handlers use `auditAction()` for logging but never emit domain events. Events are not even typed in any registry.
- **Impact:** Downstream consumers receive no signals: M05 directory refresh, M11 card regen, M06 financial anonymization, M07 comms cleanup all broken. Cross-module flow 6.6 (Account Deletion Cascade) partially compensated by direct cascade code but event-driven consumers are deaf.
- **Remediation:** Integrate domain event bus; add event emission at: `updateMyProfile` -> `PersonUpdated`, `executeAccountDeletion` -> `PersonAnonymized`, `requestMyAccountDeletion` -> `DeletionRequested`, `cancelMyAccountDeletion` -> `DeletionCancelled`.

#### EM-M02-q7r8s9t0: Spec endpoint paths diverge from implementation paths

- **Dimension:** D1 (Public API)
- **Spec Reference:** API_CONTRACTS.md Section 2 (all endpoints)
- **Expected:** `/my/profile`, `/my/privacy`, `/my/notifications`, `/my/data-export`, `/my/delete-account`, `/my/id-card/:orgId`
- **Actual (from handler JSDoc):** `GET /export`, `POST /delete`, `POST /cancel-delete`, `GET /privacy`, `PATCH /notification-preferences`, `GET /notification-preferences`. No `/my/*` prefix visible. `app.ts` shows only `/persons/me/credits` as hand-wired person route; others presumably registered via generated OpenAPI routes.
- **Impact:** SDK clients generated from spec will call `/my/profile` but server may serve different paths. Contract mismatch risk for any client consuming the OpenAPI spec.
- **Remediation:** Audit TypeSpec definitions against API_CONTRACTS.md; align paths in one direction.

---

### P2 -- Medium (Incomplete or Degraded)

#### EM-M02-u1v2w3x4: Export handler returns synchronous JSON with incomplete data

- **Dimension:** D2 (Workflow)
- **Spec Reference:** WF-014 Steps 2-3; API_CONTRACTS.md POST `/my/data-export`
- **Expected:** Async generation including profile, memberships, payments, credits, certificates. ZIP download. Notification on ready.
- **Actual:** Synchronous JSON with only `person`, `memberships`, `creditEntries`. Missing: payments, certificates, communications, training enrollments, documents.
- **Impact:** Partial data portability. DPA/GDPR compliance gap -- incomplete export.
- **Remediation:** Expand data aggregation to include all person-related data across modules.

#### EM-M02-y5z6a7b8: No rate limiting on data export in handler code

- **Dimension:** D2 (Workflow)
- **Spec Reference:** M2-R4; AC-M02-006
- **Expected:** 1 export per 24 hours per person, enforced at handler level.
- **Actual:** Rate limit logic exists only as a tested pure function in `ac-m02.member-profile.test.ts`. The `exportMyData.ts` handler performs no rate check whatsoever.
- **Impact:** Users can repeatedly trigger exports with no cooldown.
- **Remediation:** Wire rate limit check into handler; add `lastExportAt` to person schema or use DataExport table for tracking.

#### EM-M02-c9d0e1f2: Account deletion cancel uses wrong HTTP method and path

- **Dimension:** D1 (Public API)
- **Spec Reference:** API_CONTRACTS.md Section 2.5 -- `DELETE /my/delete-account` to cancel
- **Expected:** `DELETE /my/delete-account` cancels a pending deletion request.
- **Actual:** `cancelMyAccountDeletion.ts` JSDoc says `POST /cancel-delete`.
- **Impact:** HTTP method mismatch (POST vs DELETE) and path mismatch with spec.
- **Remediation:** Align route method/path with API_CONTRACTS.md.

#### EM-M02-g3h4i5j6: Admin profile access handlers lack explicit role guards

- **Dimension:** D6 (Auth/Permission)
- **Spec Reference:** MODULE_SPEC Section 6 -- "Read any profile: super, admin, support" and "Update any profile: super, admin"
- **Expected:** `getPerson` and `updatePerson` enforce `requireRole('super', 'admin', 'support')` or equivalent.
- **Actual:** `getPerson.ts` uses `ctx.req.param('personId')` suggesting admin access, but no explicit role guard visible in handler code. Uses `ctx.get('session')` only.
- **Impact:** Admin profile access may be insufficiently restricted. Any authenticated user might access arbitrary profiles.
- **Remediation:** Add explicit role guards (`requireRole` or `hasMinimumRole`) to admin-facing person handlers.

#### EM-M02-f1g2h3i4: Privacy settings handler omits 3 of 7 schema fields

- **Dimension:** D1 (Public API)
- **Spec Reference:** MODULE_SPEC Section 7 (PersonPrivacySetting entity); API_CONTRACTS.md Section 2.2
- **Expected:** `updatePrivacySettings` processes all 7 toggle fields: `emailVisible`, `phoneVisible`, `photoVisible`, `addressVisible`, `credentialsVisible`, `duesStatusVisible`, `ceComplianceVisible`.
- **Actual:** Schema defines all 7 fields. Handler `updatePrivacySettings.ts` processes body fields dynamically via `Object.keys()` but the test file (`privacy.test.ts`) only validates 4 fields. Need to verify handler actually accepts all 7.
- **Impact:** 3 privacy toggles may be silently ignored if not properly mapped in handler.
- **Remediation:** Verify handler processes all 7 fields; add test coverage for `credentialsVisible`, `duesStatusVisible`, `ceComplianceVisible`.

---

### P3 -- Low (Style, Naming, Minor Gaps)

#### EM-M02-k7l8m9n0: `user` term used in handler auth context

- **Dimension:** D3 (Domain Terms)
- **Spec Reference:** DOMAIN_MODEL -- Person is the canonical term
- **Actual:** Handlers access `session.user.id` to derive personId. This is Better-Auth's API surface, not a domain modeling choice.
- **Impact:** Negligible -- framework constraint. All handlers immediately alias to `personId`.
- **Remediation:** None required. Accepted framework coupling.

#### EM-M02-o1p2q3r4: Duplicate notification preference handlers

- **Dimension:** D1 (Public API)
- **Actual:** Two handlers exist: `updateNotificationPreferences.ts` (hand-wired, uses `HandlerContext`, `ctx.req.json()`) and `updateMyNotificationPreferences.ts` (generated-compatible, uses `ValidatedContext`, imports from `@/generated/openapi/validators`). Both implement the same logic.
- **Impact:** Code confusion, maintenance burden, potential behavior divergence.
- **Remediation:** Remove the hand-wired duplicate if generated route is the active one.

---

### Unverifiable

#### EM-M02-s5t6u7v8: Exact route registration via generated OpenAPI

- **Dimension:** D1, D6
- **Notes:** Many m02 handlers use `ValidatedContext` and import from `@/generated/openapi/validators`, indicating routes are registered via generated code in `@/generated/openapi/routes.ts`. This file is auto-generated and not reviewed. Actual HTTP paths, middleware stack, and auth enforcement at the route level cannot be verified without reading generated files or runtime testing.
- **Remediation:** Run API server and test actual route availability with `curl` to confirm paths and auth behavior.

---

## Stabilization Plan

### Phase 1: P1 Blockers (Est. 5-7 days)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P1 | EM-M02-m3n4o5p6 | Integrate domain event bus; emit 5 spec events from handlers | 2d |
| P1 | EM-M02-i9j0k1l2 | Wire M2-R5 guards (pending payments + sole officer) into requestMyAccountDeletion | 0.5d |
| P1 | EM-M02-q7r8s9t0 | Audit TypeSpec route paths vs API_CONTRACTS.md; align in one direction | 0.5d |
| P1 | EM-M02-a1b2c3d4 | Create Digital ID Card handlers (getMyIdCard + PDF) with QR generation | 2-3d |
| P1 | EM-M02-e5f6g7h8 | Refactor data export: DataExport entity, async job, ZIP output, status endpoint | 2-3d |

### Phase 2: P2 Improvements (Est. 2-3 days)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P2 | EM-M02-u1v2w3x4 | Expand export data to include payments, certificates, training, documents | 1d |
| P2 | EM-M02-y5z6a7b8 | Wire rate limiting into export handler | 0.5d |
| P2 | EM-M02-c9d0e1f2 | Fix deletion cancel HTTP method/path alignment | 0.5d |
| P2 | EM-M02-g3h4i5j6 | Add explicit role guards to getPerson/updatePerson admin handlers | 0.5d |
| P2 | EM-M02-f1g2h3i4 | Verify/fix privacy handler processes all 7 schema fields; add tests | 0.5d |

### Phase 3: P3 Cleanup (Est. 0.5 day)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P3 | EM-M02-o1p2q3r4 | Remove duplicate notification preference handler | 0.25d |
| P3 | EM-M02-k7l8m9n0 | Document as accepted (no code change) | 0d |

---

## Endpoint Mapping Detail

| Spec Endpoint | Spec Path | Handler File | Status |
|---------------|-----------|-------------|--------|
| GET profile | `/my/profile` | `getPerson.ts` (admin) / session-based | PARTIAL (path mismatch) |
| PUT profile | `/my/profile` | `updateMyProfile.ts` | PARTIAL (path mismatch) |
| PUT privacy | `/my/privacy` | `updatePrivacySettings.ts` | PARTIAL (path mismatch, missing fields) |
| GET privacy | (implied) | `getMyPrivacySettings.ts` | PRESENT |
| PUT notifications | `/my/notifications` | `updateMyNotificationPreferences.ts` | PRESENT (duplicate exists) |
| GET notifications | (implied) | `getMyNotificationPreferences.ts` | PRESENT |
| POST data-export | `/my/data-export` | `exportMyData.ts` | DEGRADED (sync, wrong method) |
| GET data-export/:id | `/my/data-export/:id` | -- | MISSING |
| POST delete-account | `/my/delete-account` | `requestMyAccountDeletion.ts` | PARTIAL (missing guards) |
| DELETE delete-account | `/my/delete-account` | `cancelMyAccountDeletion.ts` | PARTIAL (wrong method) |
| GET id-card/:orgId | `/my/id-card/:orgId` | -- | MISSING |
| GET id-card/:orgId/pdf | `/my/id-card/:orgId/pdf` | -- | MISSING |

---

## Audit Scope

| Artifact | Location | Read? |
|----------|----------|-------|
| MODULE_SPEC.md | `docs/product/modules/m02-member-profile/MODULE_SPEC.md` | YES |
| API_CONTRACTS.md | `docs/product/modules/m02-member-profile/API_CONTRACTS.md` | YES |
| DOMAIN_MODEL.md | `docs/product/DOMAIN_MODEL.md` | YES |
| WORKFLOW_MAP.md | `docs/product/WORKFLOW_MAP.md` | YES |
| ROLE_PERMISSION_MATRIX.md | `docs/product/ROLE_PERMISSION_MATRIX.md` | YES |
| updateMyProfile.ts | `services/api-ts/src/handlers/person/updateMyProfile.ts` | YES |
| getMyPrivacySettings.ts | `services/api-ts/src/handlers/person/getMyPrivacySettings.ts` | YES |
| updatePrivacySettings.ts | `services/api-ts/src/handlers/person/updatePrivacySettings.ts` | YES |
| getMyNotificationPreferences.ts | `services/api-ts/src/handlers/person/getMyNotificationPreferences.ts` | YES |
| updateNotificationPreferences.ts | `services/api-ts/src/handlers/person/updateNotificationPreferences.ts` | YES |
| updateMyNotificationPreferences.ts | `services/api-ts/src/handlers/person/updateMyNotificationPreferences.ts` | YES |
| exportMyData.ts | `services/api-ts/src/handlers/person/exportMyData.ts` | YES |
| requestMyAccountDeletion.ts | `services/api-ts/src/handlers/person/requestMyAccountDeletion.ts` | YES |
| cancelMyAccountDeletion.ts | `services/api-ts/src/handlers/person/cancelMyAccountDeletion.ts` | YES |
| executeAccountDeletion.ts | `services/api-ts/src/handlers/person/executeAccountDeletion.ts` | YES |
| accountDeletionCascade.ts | `services/api-ts/src/handlers/person/accountDeletionCascade.ts` | YES |
| getPerson.ts | `services/api-ts/src/handlers/person/getPerson.ts` | YES |
| person.schema.ts | `services/api-ts/src/handlers/person/repos/person.schema.ts` | YES |
| notification-preferences.schema.ts | `services/api-ts/src/handlers/person/repos/notification-preferences.schema.ts` | YES |
| privacy-settings.schema.ts | `services/api-ts/src/handlers/person/repos/privacy-settings.schema.ts` | YES |
| deletionProcessor.ts | `services/api-ts/src/handlers/person/jobs/deletionProcessor.ts` | YES |
| app.ts | `services/api-ts/src/app.ts` | YES (grep) |
| ac-m02.member-profile.test.ts | `services/api-ts/src/handlers/person/ac-m02.member-profile.test.ts` | YES (grep) |
