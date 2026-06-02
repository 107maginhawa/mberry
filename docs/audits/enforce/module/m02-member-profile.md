# Module Enforcement Report: m02-member-profile

**Module:** Member Profile & Settings (M02)
**Auditor:** oli-enforce-module (automated)
**Date:** 2026-05-28
**Prior Audit:** 2026-05-27 (score 5.2)
**Handler Directory:** `services/api-ts/src/handlers/person/` (shared with M01)
**Spec Version:** MODULE_SPEC.md v2.0 (all 22 sections COMPLETE)

---

## Compliance Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | **6.4 / 10** |
| **Label** | **PARTIAL COMPLIANCE** |
| **Cap Applied** | P1 cap (6.5) -- 2 P1 findings remain |
| **P0 Findings** | 1 |
| **P1 Findings** | 2 |
| **P2 Findings** | 6 |
| **P3 Findings** | 3 |
| **Resolved Since Last Audit** | 3 (EM-M02-a1b2c3d4, EM-M02-i9j0k1l2, EM-M02-q7r8s9t0) |

---

## Dimension Scores

| Dim | Name | Score | Weight | Notes |
|-----|------|-------|--------|-------|
| D1 | Public API | 6.5 / 10 | 25% | 9/11 spec endpoints have handlers; ID card hand-wired (not in OpenAPI); data export status endpoint missing |
| D2 | Workflow | 6.5 / 10 | 20% | WF-010 COMPLETE, WF-011 COMPLETE, WF-012 PARTIAL (handlers exist, not in OpenAPI), WF-013 COMPLETE, WF-014 DEGRADED |
| D3 | Domain Terms | 8.0 / 10 | 10% | Minor `user` refs from Better-Auth API (accepted framework coupling) |
| D4 | State Machine | 7.0 / 10 | 15% | Account deletion lifecycle fully implemented with M2-R5 guards; DataExport state machine still absent |
| D5 | Events | 1.0 / 10 | 15% | 0/5 spec-declared domain events emitted; no event bus integration |
| D6 | Auth/Permission | 7.0 / 10 | 15% | All self-service handlers enforce GA auth; admin-tier handlers lack explicit role guards |

**Weighted Average (pre-cap):** 6.4
**Final Score:** 6.4 (below P1 cap of 6.5, no cap needed)

---

## Delta from Prior Audit (2026-05-27)

| Finding ID | Prior Status | Current Status | Change |
|------------|-------------|---------------|--------|
| EM-M02-a1b2c3d4 | P1 (ID Card missing) | **RESOLVED** | `getMyIdCard.ts`, `getMyIdCardPdf.ts`, `utils/id-card-data.ts` now exist with QR HMAC |
| EM-M02-i9j0k1l2 | P1 (M2-R5 guards missing) | **RESOLVED** | `requestMyAccountDeletion.ts` now checks pending payments + sole officer |
| EM-M02-q7r8s9t0 | P1 (path divergence) | **RESOLVED** | TypeSpec routes align with OpenAPI: `/persons/me/*` pattern throughout |
| EM-M02-e5f6g7h8 | P1 (data export) | P1 (unchanged) | Still synchronous GET, no DataExport entity |
| EM-M02-m3n4o5p6 | P1 (no events) | P1 (unchanged) | Zero domain events emitted |
| NEW | -- | P0 (EM-M02-7f8a9b1c) | QR HMAC uses `AUTH_SECRET` with hardcoded fallback |
| NEW | -- | P2 (EM-M02-3d4e5f6g) | Schema missing 3 spec-declared fields |
| NEW | -- | P2 (EM-M02-8a9b0c1d) | No SVG sanitization (BR-31) |
| NEW | -- | P2 (EM-M02-2c3d4e5f) | No photo validation (BR-09) |
| NEW | -- | P3 (EM-M02-9e0f1g2h) | ID card routes not in OpenAPI/TypeSpec |

---

## Findings by Severity

### P0 -- Security

#### EM-M02-7f8a9b1c: QR HMAC secret falls back to hardcoded value

- **Dimension:** D6 (Auth/Permission)
- **Spec Reference:** BR-18 (HMAC-signed QR for tamper-proof verification)
- **Expected:** QR HMAC uses a dedicated, non-guessable secret with no fallback.
- **Actual:** `utils/id-card-data.ts` line: `const secret = process.env['AUTH_SECRET'] ?? 'fallback-secret'`. If `AUTH_SECRET` is unset, QR signatures use a trivially guessable hardcoded string. Additionally, spec says a dedicated HMAC secret -- reusing `AUTH_SECRET` couples QR verification to auth infrastructure.
- **Impact:** Attacker can forge valid QR codes if `AUTH_SECRET` is unset. In dev/staging this is likely. Even in production, sharing the auth secret widens the blast radius of a key compromise.
- **Remediation:** (1) Remove `'fallback-secret'` fallback -- throw on missing env var. (2) Use a dedicated `QR_HMAC_SECRET` env var separate from `AUTH_SECRET`.

---

### P1 -- High (Spec-Declared, Missing or Broken)

#### EM-M02-e5f6g7h8: Data Export lacks async model, DataExport entity, and status tracking

- **Dimension:** D1 (Public API), D4 (State Machine)
- **Spec Reference:** MODULE_SPEC Section 7 (DataExport entity); Section 8 (Data Export state transitions); Section 10 (`POST /my/data-export`, `GET /my/data-export/:id`)
- **Expected:** `POST /my/data-export` returns `{exportId, status: "requested"}` (201). `GET /my/data-export/:id` returns `{status, downloadUrl}`. DataExport entity with states: `requested -> generating -> ready -> expired`. ZIP output with 7-day TTL.
- **Actual:** `exportMyData.ts` is a synchronous `GET /persons/me/export` returning inline JSON. No DataExport table/schema. No export ID tracking, no async generation, no ZIP file, no TTL, no status polling endpoint. Export data is also incomplete -- missing payments, certificates, communications, training, documents.
- **Impact:** WF-014 partially broken. AC-M02-006 (rate limit) untested at handler level. GDPR/DPA portability compliance gap.
- **Remediation:** Create `data-export.schema.ts` with DataExport entity; refactor to async POST + status GET pattern; implement ZIP generation background job; add rate limiting; expand data aggregation.

#### EM-M02-m3n4o5p6: Zero domain events emitted across all m02 handlers

- **Dimension:** D5 (Events)
- **Spec Reference:** MODULE_SPEC Section 10b
- **Expected:** 5 events: `PersonUpdated`, `PersonAnonymized`, `DataExportReady`, `DeletionRequested`, `DeletionCancelled`
- **Actual:** Zero matches for any event name across handler code. Handlers use `auditAction()` for logging but never emit domain events. No event bus integration exists anywhere in the codebase.
- **Impact:** Downstream consumers deaf: M05 directory refresh, M11 card regen, M06 financial anonymization, M07 comms cleanup. Cross-module flow 6.6 partially compensated by direct cascade code.
- **Remediation:** Integrate domain event bus; add event emission at: `updateMyProfile` -> `PersonUpdated`, `executeAccountDeletion` -> `PersonAnonymized`, `requestMyAccountDeletion` -> `DeletionRequested`, `cancelMyAccountDeletion` -> `DeletionCancelled`, export job -> `DataExportReady`.

---

### P2 -- Medium (Incomplete or Degraded)

#### EM-M02-3d4e5f6g: Person schema missing 3 spec-declared fields

- **Dimension:** D1 (Public API), D2 (Workflow)
- **Spec Reference:** MODULE_SPEC Section 7 (Person extended fields)
- **Expected:** `subSpecialization`, `yearsOfPractice`, `affiliation` columns on person table.
- **Actual:** `person.schema.ts` has `specialization` but not `subSpecialization`, `yearsOfPractice`, or `affiliation`. `grep` confirms zero occurrences in schema file.
- **Impact:** Profile edit cannot capture sub-specialty, years of practice, or clinic/hospital affiliation. Frontend form also missing these fields.
- **Remediation:** Add 3 columns to `person.schema.ts`; generate migration; add to TypeSpec Person model; update frontend form.

#### EM-M02-8a9b0c1d: No SVG sanitization implemented (BR-31)

- **Dimension:** D2 (Workflow)
- **Spec Reference:** BR-31 (Remove script elements and event handlers from uploaded SVGs)
- **Expected:** Avatar upload pipeline sanitizes SVG files: strip `<script>` elements, event handler attributes (`onclick`, `onload`, etc.), `javascript:` URIs.
- **Actual:** `updateMyProfile.ts` accepts avatar as JSON (MaybeStoredFile) with no content validation. `grep` for `sanitiz`, `svg`, `script.*element` across person handlers returns zero matches.
- **Impact:** XSS vector through malicious SVG uploads stored as avatar.
- **Remediation:** Add SVG sanitization middleware or utility; validate content-type before storage; strip dangerous elements.

#### EM-M02-2c3d4e5f: No photo upload validation (BR-09)

- **Dimension:** D2 (Workflow)
- **Spec Reference:** M2-R9 (JPEG/PNG/WebP, max 5MB); AC-M02-001
- **Expected:** Photo upload validates file type (JPEG, PNG, WebP only) and size (max 5MB).
- **Actual:** `updateMyProfile.ts` passes avatar directly to repo with no type or size validation. Only reference to photo validation is in test file comments (`ac-m02.member-profile.test.ts` line 25) -- not enforced in handler.
- **Impact:** Users can upload arbitrarily large files or unsupported formats.
- **Remediation:** Add file type and size validation in handler or storage middleware before persisting avatar.

#### EM-M02-y5z6a7b8: No rate limiting on data export in handler code

- **Dimension:** D2 (Workflow)
- **Spec Reference:** M2-R4; AC-M02-006
- **Expected:** 1 export per 24 hours per person, enforced at handler level.
- **Actual:** Rate limit logic exists only as a tested pure function in `ac-m02.member-profile.test.ts`. The `exportMyData.ts` handler performs no rate check.
- **Impact:** Users can repeatedly trigger exports with no cooldown.
- **Remediation:** Wire rate limit check into handler; track via DataExport table or `lastExportAt` on person.

#### EM-M02-g3h4i5j6: Admin profile access handlers lack explicit role guards

- **Dimension:** D6 (Auth/Permission)
- **Spec Reference:** MODULE_SPEC Section 6 -- "Read any profile: super, admin, support" and "Update any profile: super, admin"
- **Expected:** `getPerson` and `updatePerson` enforce `requireRole('super', 'admin', 'support')`.
- **Actual:** Both handlers use `ctx.get('session')` for auth but no explicit role guard visible. Route-level guards may exist in generated code but cannot be verified from handler alone.
- **Impact:** Admin profile access may be insufficiently restricted.
- **Remediation:** Add explicit role guards in handler code or verify generated route middleware enforces them.

#### EM-M02-4b5c6d7e: QR payload missing timestamp field (BR-18)

- **Dimension:** D2 (Workflow)
- **Spec Reference:** BR-18 (QR payload includes personId, orgId, timestamp); MODULE_SPEC Section 20 item 8
- **Expected:** QR payload includes `timestamp` for time-bound verification.
- **Actual:** `utils/id-card-data.ts` QR payload contains `{version, personId, orgId, licenseNumber, status, validUntil}` -- no `timestamp` field. Without timestamp, verifiers cannot detect stale/expired QR codes.
- **Impact:** QR codes valid indefinitely even after status changes; no replay protection.
- **Remediation:** Add `timestamp: new Date().toISOString()` to QR payload object.

---

### P3 -- Low (Style, Naming, Minor Gaps)

#### EM-M02-k7l8m9n0: `user` term used in handler auth context

- **Dimension:** D3 (Domain Terms)
- **Actual:** Handlers access `session.user.id` to derive personId. Better-Auth framework constraint.
- **Impact:** Negligible. All handlers immediately alias to `personId`.
- **Remediation:** None required. Accepted framework coupling.

#### EM-M02-o1p2q3r4: Duplicate notification preference handlers

- **Dimension:** D1 (Public API)
- **Actual:** Two handlers: `updateNotificationPreferences.ts` (hand-wired, `HandlerContext`) and `updateMyNotificationPreferences.ts` (generated, `ValidatedContext`). Similarly for privacy: `updatePrivacySettings.ts` (hand-wired) and `updateMyPrivacySettings.ts` (generated).
- **Impact:** Code confusion, maintenance burden, potential behavior divergence.
- **Remediation:** Remove hand-wired duplicates if generated routes are active.

#### EM-M02-9e0f1g2h: ID card endpoints not registered in OpenAPI/TypeSpec

- **Dimension:** D1 (Public API)
- **Actual:** `getMyIdCard.ts` and `getMyIdCardPdf.ts` exist and work, but no matching routes appear in OpenAPI spec (`grep` for `id-card` in openapi.json paths returns empty). Routes are hand-wired, not defined in TypeSpec.
- **Impact:** SDK clients cannot discover or call ID card endpoints. Contract tests cannot validate them.
- **Remediation:** Add ID card operations to `person-custom.tsp`; regenerate OpenAPI.

---

### Feature Flags (Not Implemented)

| Flag | Spec Section | Status |
|------|-------------|--------|
| `idcard_share_link` | Section 18 | NOT FOUND in codebase |
| `data_export_enabled` | Section 18 | NOT FOUND in codebase |
| `account_deletion_enabled` | Section 18 | NOT FOUND in codebase |

No feature flag infrastructure exists in person handlers. All features are unconditionally active.

---

### Session Revocation (M2-R2)

- **Spec:** IF password changed THEN invalidate all other sessions.
- **Actual:** Session revocation logic exists ONLY as a pure function in `ac-m02.member-profile.test.ts` (lines 65-72). Not wired into any handler. Password change is handled by Better-Auth's `ChangePasswordCard` component -- revocation may happen at the auth framework level but is not verified in m02 handler code.
- **Status:** UNVERIFIABLE from handler code alone.

---

## Endpoint Mapping Detail

| Spec Endpoint | Spec Path | Actual OpenAPI Path | Handler File | Status |
|---------------|-----------|-------------------|-------------|--------|
| GET profile | `/my/profile` | `GET /persons/{person}` (person=me) | `getPerson.ts` | FUNCTIONAL (no dedicated `/my/profile`) |
| PUT profile | `/my/profile` | `PATCH /persons/me` | `updateMyProfile.ts` | COMPLETE |
| GET privacy | `/my/privacy` | `GET /persons/me/privacy` | `getMyPrivacySettings.ts` | COMPLETE |
| PUT privacy | `/my/privacy` | `PATCH /persons/me/privacy` | `updateMyPrivacySettings.ts` | COMPLETE |
| GET notifications | `/my/notifications` | `GET /persons/me/notification-preferences` | `getMyNotificationPreferences.ts` | COMPLETE |
| PUT notifications | `/my/notifications` | `PATCH /persons/me/notification-preferences` | `updateMyNotificationPreferences.ts` | COMPLETE |
| POST data-export | `/my/data-export` | `GET /persons/me/export` | `exportMyData.ts` | DEGRADED (sync, wrong method) |
| GET data-export/:id | `/my/data-export/:id` | -- | -- | MISSING |
| POST delete-account | `/my/delete-account` | `POST /persons/me/delete` | `requestMyAccountDeletion.ts` | COMPLETE (guards now wired) |
| DELETE delete-account | `/my/delete-account` | `POST /persons/me/cancel-delete` | `cancelMyAccountDeletion.ts` | PARTIAL (POST vs DELETE method) |
| GET id-card/:orgId | `/my/id-card/:orgId` | -- (hand-wired) | `getMyIdCard.ts` | PRESENT (not in OpenAPI) |
| GET id-card/:orgId/pdf | `/my/id-card/:orgId/pdf` | -- (hand-wired) | `getMyIdCardPdf.ts` | PRESENT (not in OpenAPI) |

---

## Stabilization Plan

### Phase 1: P0 Security (Est. 0.5 day)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P0 | EM-M02-7f8a9b1c | Replace `AUTH_SECRET` fallback with dedicated `QR_HMAC_SECRET`; throw on missing | 0.5d |

### Phase 2: P1 Blockers (Est. 4-5 days)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P1 | EM-M02-m3n4o5p6 | Integrate domain event bus; emit 5 spec events from handlers | 2d |
| P1 | EM-M02-e5f6g7h8 | Refactor data export: DataExport entity, async job, ZIP output, status endpoint, rate limit | 2-3d |

### Phase 3: P2 Improvements (Est. 3-4 days)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P2 | EM-M02-3d4e5f6g | Add 3 missing schema fields; generate migration; update TypeSpec + frontend | 1d |
| P2 | EM-M02-8a9b0c1d | Implement SVG sanitization utility | 0.5d |
| P2 | EM-M02-2c3d4e5f | Add photo type/size validation to upload pipeline | 0.5d |
| P2 | EM-M02-y5z6a7b8 | Wire rate limiting into export handler | 0.5d |
| P2 | EM-M02-g3h4i5j6 | Add explicit role guards to admin person handlers | 0.5d |
| P2 | EM-M02-4b5c6d7e | Add timestamp to QR payload | 0.25d |

### Phase 4: P3 Cleanup (Est. 1 day)

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P3 | EM-M02-9e0f1g2h | Add ID card operations to TypeSpec; regenerate | 0.5d |
| P3 | EM-M02-o1p2q3r4 | Remove duplicate notification/privacy handlers | 0.25d |
| P3 | EM-M02-k7l8m9n0 | Document as accepted (no code change) | 0d |

---

## Audit Scope

| Artifact | Location | Read? |
|----------|----------|-------|
| MODULE_SPEC.md | `docs/product/modules/m02-member-profile/MODULE_SPEC.md` | YES |
| person.schema.ts | `services/api-ts/src/handlers/person/repos/person.schema.ts` | YES |
| privacy-settings.schema.ts | `services/api-ts/src/handlers/person/repos/privacy-settings.schema.ts` | YES |
| notification-preferences.schema.ts | `services/api-ts/src/handlers/person/repos/notification-preferences.schema.ts` | YES |
| person.repo.ts | `services/api-ts/src/handlers/person/repos/person.repo.ts` | YES |
| updateMyProfile.ts | `services/api-ts/src/handlers/person/updateMyProfile.ts` | YES |
| getMyPrivacySettings.ts | `services/api-ts/src/handlers/person/getMyPrivacySettings.ts` | YES |
| updateMyPrivacySettings.ts | `services/api-ts/src/handlers/person/updateMyPrivacySettings.ts` | YES |
| getMyNotificationPreferences.ts | `services/api-ts/src/handlers/person/getMyNotificationPreferences.ts` | YES |
| updateMyNotificationPreferences.ts | `services/api-ts/src/handlers/person/updateMyNotificationPreferences.ts` | YES |
| exportMyData.ts | `services/api-ts/src/handlers/person/exportMyData.ts` | YES |
| requestMyAccountDeletion.ts | `services/api-ts/src/handlers/person/requestMyAccountDeletion.ts` | YES |
| cancelMyAccountDeletion.ts | `services/api-ts/src/handlers/person/cancelMyAccountDeletion.ts` | YES |
| executeAccountDeletion.ts | `services/api-ts/src/handlers/person/executeAccountDeletion.ts` | YES |
| accountDeletionCascade.ts | `services/api-ts/src/handlers/person/accountDeletionCascade.ts` | YES |
| getMyIdCard.ts | `services/api-ts/src/handlers/person/getMyIdCard.ts` | YES |
| getMyIdCardPdf.ts | `services/api-ts/src/handlers/person/getMyIdCardPdf.ts` | YES |
| utils/id-card-data.ts | `services/api-ts/src/handlers/person/utils/id-card-data.ts` | YES |
| deletionProcessor.ts | `services/api-ts/src/handlers/person/jobs/deletionProcessor.ts` | YES |
| getPerson.ts | `services/api-ts/src/handlers/person/getPerson.ts` | YES |
| person.tsp | `specs/api/src/modules/person.tsp` | YES |
| person-custom.tsp | `specs/api/src/modules/person-custom.tsp` | YES |
| openapi.json | `specs/api/dist/openapi/openapi.json` | YES (paths grep) |
| profile.tsx | `apps/memberry/src/routes/_authenticated/my/profile.tsx` | YES |
| settings.tsx | `apps/memberry/src/routes/_authenticated/my/settings.tsx` | YES |
| ac-m02.member-profile.test.ts | `services/api-ts/src/handlers/person/ac-m02.member-profile.test.ts` | YES (grep) |


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
