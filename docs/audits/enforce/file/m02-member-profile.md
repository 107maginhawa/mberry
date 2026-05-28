# Per-File Spec Traceability: M02 Member Profile & Settings

**Audit Date:** 2026-05-28
**Module:** M02 -- Member Profile & Settings
**Handler Directory:** `services/api-ts/src/handlers/person/` (shared with M01)
**Spec Artifacts:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md
**Previous Audit:** 2026-05-27

---

## 1. File Classification

### 1.1 M02-Scoped Source Files (Profile, Settings, Data Export, Account Deletion, ID Card)

| # | File | Role | M02 Workflow | Spec Trace |
|---|------|------|-------------|------------|
| 1 | `getPerson.ts` | controller | WF-010 (profile view) | API: `GET /persons/{person}` |
| 2 | `updatePerson.ts` | controller | WF-010 (profile edit) | API: `PATCH /persons/{person}` |
| 3 | `updateMyProfile.ts` | controller | WF-010 (self-service edit) | API: `PUT /my/profile` (mapped) |
| 4 | `getMyPrivacySettings.ts` | controller | WF-010 (privacy read) | API: `GET /privacy` |
| 5 | `updateMyPrivacySettings.ts` | controller | WF-010 (privacy write) | API: `PUT /my/privacy` (mapped) |
| 6 | `updatePrivacySettings.ts` | controller | WF-010 (privacy, legacy) | Pre-migration route `/persons/me/privacy` |
| 7 | `getMyNotificationPreferences.ts` | controller | WF-013 | API: `GET /notification-preferences` |
| 8 | `updateMyNotificationPreferences.ts` | controller | WF-013 | API: `PATCH /notification-preferences` |
| 9 | `updateNotificationPreferences.ts` | controller | WF-013 (legacy) | Pre-migration route `/persons/me/notification-preferences` |
| 10 | `exportMyData.ts` | controller | WF-014 | API: `POST /my/data-export` (partial impl) |
| 11 | `requestMyAccountDeletion.ts` | controller | WF-011 | API: `POST /my/delete-account` |
| 12 | `cancelMyAccountDeletion.ts` | controller | WF-011 | API: `DELETE /my/delete-account` |
| 13 | `executeAccountDeletion.ts` | controller/service | WF-011 | Internal only (not HTTP-exposed) |
| 14 | `accountDeletionCascade.ts` | service | WF-011 / Flow 6.6 | WORKFLOW_MAP 6.6 |
| 15 | `getMyIdCard.ts` | controller | WF-012 | API: `GET /my/id-card/:orgId` |
| 16 | `getMyIdCardPdf.ts` | controller | WF-012 | API: `GET /my/id-card/:orgId/pdf` |
| 17 | `utils/id-card-data.ts` | utility | WF-012 | Shared ID card data + QR HMAC (BR-18) |
| 18 | `repos/person.schema.ts` | entity | All M02 | DOMAIN_MODEL: `person` table |
| 19 | `repos/person.repo.ts` | repository | All M02 | PersonRepository class |
| 20 | `repos/privacy-settings.schema.ts` | entity | WF-010 | DOMAIN_MODEL: `person_privacy_setting` |
| 21 | `repos/notification-preferences.schema.ts` | entity | WF-013 | DOMAIN_MODEL: `notification_preference` |
| 22 | `jobs/deletionProcessor.ts` | service (cron) | WF-011 | DPA-06, BR-32 |
| 23 | `jobs/index.ts` | utility (job registry) | WF-011 | Job scheduler registration |

### 1.2 M02 Test Files

| # | File | Role | Coverage Target |
|---|------|------|----------------|
| 24 | `ac-m02.member-profile.test.ts` | test (AC) | AC-M02-001 through AC-M02-008 |
| 25 | `getPerson.test.ts` | test (unit) | getPerson handler |
| 26 | `updateMyProfile.test.ts` | test (unit) | updateMyProfile handler |
| 27 | `getMyPrivacySettings.test.ts` | test (unit) | getMyPrivacySettings handler |
| 28 | `updateMyPrivacySettings.test.ts` | test (unit) | updateMyPrivacySettings handler |
| 29 | `getMyNotificationPreferences.test.ts` | test (unit) | getMyNotificationPreferences handler |
| 30 | `updateMyNotificationPreferences.test.ts` | test (unit) | updateMyNotificationPreferences handler |
| 31 | `exportMyData.test.ts` | test (unit) | exportMyData handler |
| 32 | `requestMyAccountDeletion.test.ts` | test (unit) | requestMyAccountDeletion handler |
| 33 | `cancelMyAccountDeletion.test.ts` | test (unit) | cancelMyAccountDeletion handler |
| 34 | `executeAccountDeletion.test.ts` | test (unit) | executeAccountDeletion handler |
| 35 | `accountDeletionCascade.test.ts` | test (unit) | Cascade deletion |
| 36 | `jobs/deletionProcessor.test.ts` | test (unit) | Cron processor |
| 37 | `profile-spec-compliance.test.ts` | test (compliance) | Spec conformance |
| 38 | `repos/person.repo.test.ts` | test (unit) | PersonRepository |

### 1.3 M02 Frontend Files

| # | File | Role | M02 Workflow | Spec Trace |
|---|------|------|-------------|------------|
| 39 | `apps/memberry/src/routes/_authenticated/my/profile.tsx` | page | WF-010 | Screen: Profile Overview + Edit |
| 40 | `apps/memberry/src/routes/_authenticated/my/settings.tsx` | page | WF-013 | Screen: Settings |
| 41 | `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | page | WF-012 | Screen: Digital ID Card |
| 42 | `apps/memberry/src/routes/_authenticated/settings/account.tsx` | page | WF-010/WF-011 | Account settings (photo, deletion) |
| 43 | `apps/memberry/src/routes/_authenticated/settings/security.tsx` | page | WF-010 | Security settings |

### 1.4 Non-M02 Files (Shared Directory -- Out of M02 Scope)

| # | File | Role | Module Owner |
|---|------|------|-------------|
| 44 | `createPerson.ts` + test | controller | M01 (Auth & Onboarding) |
| 45 | `listPersons.ts` + test | controller | M01/M03 (admin listing) |
| 46 | `getMyMemberships.ts` + test | controller | M05 (Membership) |
| 47 | `getMyOfficerRole.ts` + test | controller | M04 (Org Admin) |
| 48 | `getMyCredits.ts` + test | controller | M10 (Credit Tracking) |
| 49 | `getMyCreditSummary.ts` + test | controller | M10 (Credit Tracking) |
| 50 | `createMyCreditEntry.ts` + test | controller | M10 (Credit Tracking) |
| 51 | `listMyCreditEntries.ts` + test | controller | M10 (Credit Tracking) |
| 52 | `ac-m01.auth-onboarding.test.ts` | test | M01 |

---

## 2. Findings

### 2.1 Error Taxonomy

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-a1b2c3d4 | P2 | `updateNotificationPreferences.ts` | Returns raw `{ error: 'Unauthorized' }` with 401 instead of throwing `UnauthorizedError`. Inconsistent error shape: all other M02 handlers throw typed errors that the global error handler formats as `{ code, message }`. | API_CONTRACTS error response shape | HIGH |
| EF-M02-e5f6g7h8 | P2 | `updatePrivacySettings.ts` | Same raw error pattern: `return ctx.json({ error: 'Unauthorized' }, 401)` bypasses error taxonomy. Uses `HandlerContext` + manual `ctx.req.json()` instead of `ValidatedContext`. | API_CONTRACTS error response shape | HIGH |
| EF-M02-i9j0k1l2 | P3 | `updatePerson.ts` | Uses inline `audit.logEvent()` with 15-line parameter block instead of `auditAction()` utility. Functionally identical but inconsistent with newer handlers. | MODULE_SPEC 17 (Observability) | MEDIUM |
| EF-M02-m3n4o5p6 | P3 | `getPerson.ts` | Imports `BusinessLogicError` but never uses it. Dead import. | N/A (code quality) | HIGH |

### 2.2 Domain Terms

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-q7r8s9t0 | OK | `repos/person.schema.ts` | All domain terms match DOMAIN_MODEL: `person`, `gender`, `contactInfo`, `primaryAddress`, `deletionRequestedAt/ScheduledAt/CompletedAt`, `licenseNumber`, `prcId`, `specialization`. | DOMAIN_MODEL 1.Identity | HIGH |
| EF-M02-u1v2w3x4 | OK | `repos/privacy-settings.schema.ts` | Table `person_privacy_setting` with 7 visibility fields. Defaults match M02-C2.3 (email hidden, phone hidden, photo visible, address hidden). Per-org scoping correct. | DOMAIN_MODEL 1.Identity, MODULE_SPEC 7 | HIGH |
| EF-M02-y5z6a7b8 | OK | `repos/notification-preferences.schema.ts` | Table `notification_preference`, categories `['dues','events','trainings','announcements','credits']`. In-app always-on (M02-R8) implemented in getter not schema -- correct design. Multi-tenant scoped via `organizationId`. | DOMAIN_MODEL 1.Identity, MODULE_SPEC 7 | HIGH |
| EF-M02-c9d0e1f2 | P1 | N/A (missing file) | `data_export` table declared in DOMAIN_MODEL (6 columns) has no schema file. `repos/data-export.schema.ts` does not exist. MODULE_SPEC 7 declares DataExport entity with fields: `id, personId, status, requestedAt, completedAt, downloadUrl`. | DOMAIN_MODEL 1.Identity, MODULE_SPEC 7 | HIGH |

### 2.3 Data Shape

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-g3h4i5j6 | P1 | `exportMyData.ts` | Returns synchronous `{ exportedAt, personId, person, memberships, creditEntries }`. API_CONTRACTS specifies async: `POST /my/data-export` creates request (returns `{ id, status: "requested", requestedAt }`), `GET /my/data-export/:id` polls status. Current path is `GET /export`, spec declares `POST /my/data-export`. Both method and path diverge. No rate limiting (AC-M02-006: 1 per 24h). | API_CONTRACTS 2.4, AC-M02-006, MODULE_SPEC 8 (DataExport states) | HIGH |
| EF-M02-s5t6u7v8 | P2 | `updateMyProfile.ts` | No field-level validation. Uses `as Record<string, unknown>` and copies fields without checks. `updatePerson.ts` calls `validateDateOfBirth()` but `updateMyProfile.ts` does not. No license regex validation (BR-23). | MODULE_SPEC 5 rule 4 (BR-23) | HIGH |
| EF-M02-w9x0y1z2 | OK | `accountDeletionCascade.ts` | Covers 19 modules with per-module ANONYMIZE/DELETE/SOFT-DELETE strategy. Financial records preserved per BR-32. Sessions killed before PII scrub. Per-module try/catch for resilience. | WORKFLOW_MAP 6.6, BR-32, DPA 2012 | HIGH |
| EF-M02-b1000001 | P2 | `updatePrivacySettings.ts` | Only processes 4 of 7 privacy fields (emailVisible, phoneVisible, photoVisible, addressVisible). Missing: `credentialsVisible`, `duesStatusVisible`, `ceComplianceVisible`. Schema has all 7 but handler ignores 3. Note: `updateMyPrivacySettings.ts` handles all 7 correctly. | MODULE_SPEC 7.Entity.PersonPrivacySetting | HIGH |
| EF-M02-e1000003 | P2 | `requestMyAccountDeletion.ts` | Does not require confirmation string `"DELETE"` in request body. API_CONTRACTS 2.5 declares `confirmation: "DELETE"` as required input for safety. | API_CONTRACTS 2.5 POST /my/delete-account | MEDIUM |

### 2.4 ID Card Traceability (NEW -- previously missing, now implemented)

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-d4e5f6a1 | OK | `getMyIdCard.ts` | Returns structured ID card JSON for authenticated member + orgId. Delegates to `utils/id-card-data.ts`. Auth check present. 404 on missing person. | API: `GET /my/id-card/:orgId`, WF-012 | HIGH |
| EF-M02-d4e5f6a2 | OK | `getMyIdCardPdf.ts` | Generates PDF binary from ID card data. Uses `utils/id-card-data.ts` for data assembly. Content-Type set to `application/pdf`. | API: `GET /my/id-card/:orgId/pdf`, WF-012 | HIGH |
| EF-M02-d4e5f6a3 | OK | `utils/id-card-data.ts` | Shared utility: assembles card data (photo, name, license, org, status, QR). QR payload includes personId, orgId, licenseNumber, status, validUntil. HMAC-SHA256 signature with `AUTH_SECRET`. Uses `duesExpiryDate` from membership for status (BR-01). | BR-18 (QR HMAC), BR-01 (status from dues) | HIGH |
| EF-M02-d4e5f6a4 | P3 | `utils/id-card-data.ts` | QR payload does not include `timestamp` field. MODULE_SPEC 20.8 states: "QR payload includes personId, orgId, timestamp." Current payload has `version, personId, orgId, licenseNumber, status, validUntil` but no generation timestamp for replay attack prevention. | MODULE_SPEC 20.8 (AI Instructions) | MEDIUM |
| EF-M02-d4e5f6a5 | P3 | `utils/id-card-data.ts` | Falls back to `'fallback-secret'` if `AUTH_SECRET` env var is missing. In production this would be a security weakness -- QR signatures verifiable with known default secret. | BR-18 security | MEDIUM |
| EF-M02-d4e5f6a6 | OK | `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | Frontend route exists for ID card display. | Screen: Digital ID Card (/my/id-card), WF-012 | HIGH |

### 2.5 Deletion Guards (UPDATED -- previously missing, now implemented)

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-d4e5f6b1 | OK | `requestMyAccountDeletion.ts` | Now checks pending dues payments (status: pending/submitted/underReview) and blocks with `PENDING_PAYMENTS` error code. Implements M2-R5 / AC-M02-007. | AC-M02-007, M2-R5 | HIGH |
| EF-M02-d4e5f6b2 | OK | `requestMyAccountDeletion.ts` | Now checks sole active officer status per org with count query. Blocks with `SOLE_OFFICER` error code. Correctly iterates all orgs where person holds active term. | M2-R5 | HIGH |
| EF-M02-d4e5f6b3 | OK | `requestMyAccountDeletion.ts` | Schedules deletion 30 days from now (`now + 30d`). Stores `deletionRequestedAt` and `deletionScheduledAt`. | M2-R5 (30-day grace) | HIGH |

### 2.6 Naming Convention

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-a2b3c4d5 | P3 | `updateNotificationPreferences.ts` | Legacy duplicate of `updateMyNotificationPreferences.ts`. Legacy uses `HandlerContext` + raw `ctx.req.json()`. New uses `ValidatedContext` + `ctx.req.valid('json')`. Both coexist, both functional. | Convention: `My` prefix = self-service + generated validators | MEDIUM |
| EF-M02-e6f7g8h9 | P3 | `updatePrivacySettings.ts` | Legacy duplicate of `updateMyPrivacySettings.ts`. Legacy at `/persons/me/privacy`, new at `/privacy`. Legacy missing 3 of 7 fields (see EF-M02-b1000001). | Same convention | MEDIUM |
| EF-M02-i0j1k2l3 | OK | `repos/*.schema.ts` | All schema files follow `{entity}.schema.ts` naming. Types exported as PascalCase. Enums use camelCaseEnum. | CONTRIBUTING.md | HIGH |

### 2.7 Import Boundaries

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-m4n5o6p7 | OK | `getMyPrivacySettings.ts` | Imports only from own `repos/` and `@/core/`. Clean boundary. | MODULE_MAP (M02 depends on M01 only) | HIGH |
| EF-M02-q8r9s0t1 | OK | `updateMyPrivacySettings.ts` | Cross-module import: `@/handlers/association:member/repos/membership.schema` to verify org membership. Authorization check -- acceptable cross-boundary read. | ROLE_PERMISSION_MATRIX 3.1 | HIGH |
| EF-M02-u2v3w4x5 | P2 | `exportMyData.ts` | Imports `MembershipRepository` and `CreditEntryRepository` from `association:member`. Direct cross-module repo instantiation creates tight coupling. Should use ID-based queries or a dedicated DataExportService. | DOMAIN_MODEL 12 (Anti-Corruption Layers) | MEDIUM |
| EF-M02-y6z7a8b9 | OK | `accountDeletionCascade.ts` | Imports schema tables from 12+ modules. Acceptable for cascade deletion -- documented as Flow 6.6 cross-cutting concern. Each import is schema-only (not repo classes). | WORKFLOW_MAP 6.6 | HIGH |
| EF-M02-c0d1e2f3 | OK | `getMyNotificationPreferences.ts` | Imports only from own `repos/` and `@/core/`. Clean. | MODULE_MAP | HIGH |
| EF-M02-d4e5f6c1 | OK | `utils/id-card-data.ts` | Cross-module imports: `person.schema`, `membership.schema`, `platform-admin.schema`. Reads only -- acceptable for ID card data assembly. | MODULE_MAP | HIGH |

### 2.8 Domain Events (Cross-Check with MODULE_SPEC 10b)

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-d4e5f6d1 | OK | `updatePerson.ts` | Now emits `person.updated` domain event via `domainEvents.emit()` after successful update. | MODULE_SPEC 10b Published: PersonUpdated | HIGH |
| EF-M02-a1000002 | P2 | `updateMyProfile.ts` | Does not emit `PersonUpdated` domain event after successful update. Only audit logging via `auditAction()`. Spec declares M05/M07 as consumers of this event. Self-service path silently skips event. | MODULE_SPEC 10b Published: PersonUpdated | HIGH |
| EF-M02-e1000004 | P2 | `requestMyAccountDeletion.ts` | Does not emit `DeletionRequested` domain event. Spec declares M05 (officer notification) as consumer. | MODULE_SPEC 10b Published: DeletionRequested | HIGH |
| EF-M02-f1000002 | P2 | `cancelMyAccountDeletion.ts` | Does not emit `DeletionCancelled` domain event. | MODULE_SPEC 10b Published: DeletionCancelled | HIGH |
| EF-M02-g1000002 | P2 | `executeAccountDeletion.ts` | Does not emit `PersonAnonymized` domain event after anonymization. Spec declares M05, M06, M07 as consumers. | MODULE_SPEC 10b Published: PersonAnonymized | HIGH |

### 2.9 SVG Sanitization (BR-31)

| ID | Sev | File | Finding | Spec Reference | Confidence |
|----|-----|------|---------|----------------|------------|
| EF-M02-d4e5f6e1 | P2 | N/A (no sanitization logic) | No SVG sanitization exists anywhere in M02 handlers. BR-31 requires removing script elements and event handlers from uploaded SVGs. Photo upload goes through `updateMyProfile.ts` (avatar field) or `settings/account.tsx` (file upload) with no server-side sanitization step. | BR-31, MODULE_SPEC 5 | HIGH |

---

## 3. Review Required

### P1 -- Must Fix Before Ship (2 findings)

| ID | File | Issue | Remediation |
|----|------|-------|-------------|
| EF-M02-c9d0e1f2 | (missing) `repos/data-export.schema.ts` | DataExport entity declared in DOMAIN_MODEL and MODULE_SPEC but no schema file exists. | Create `repos/data-export.schema.ts` with fields: id, personId, status (enum: requested/processing/ready/expired), requestedAt, completedAt, downloadUrl. |
| EF-M02-g3h4i5j6 | `exportMyData.ts` | Sync data dump; no async export, no tracking, no rate limit, wrong HTTP method and path. | Refactor to async: POST creates DataExport request (202), background job aggregates data, GET polls status. Add 24h rate limit per AC-M02-006. |

### P2 -- Should Fix (11 findings)

| ID | File | Issue | Remediation |
|----|------|-------|-------------|
| EF-M02-a1b2c3d4 | `updateNotificationPreferences.ts` | Raw `{ error }` response bypasses error taxonomy. | Replace with `throw new UnauthorizedError()`. |
| EF-M02-e5f6g7h8 | `updatePrivacySettings.ts` | Same raw error pattern. | Same fix. Consider deprecating in favor of `updateMyPrivacySettings.ts`. |
| EF-M02-s5t6u7v8 | `updateMyProfile.ts` | No field validation (dateOfBirth, license). | Add `validateDateOfBirth()` call and BR-23 license regex. |
| EF-M02-b1000001 | `updatePrivacySettings.ts` | Only 4/7 privacy fields handled. | Add credentialsVisible, duesStatusVisible, ceComplianceVisible. Or deprecate handler. |
| EF-M02-e1000003 | `requestMyAccountDeletion.ts` | Missing `confirmation: "DELETE"` body check. | Add body validation requiring exact string. |
| EF-M02-u2v3w4x5 | `exportMyData.ts` | Direct cross-module repo imports (tight coupling). | Extract to DataExportService or use ID-based queries. |
| EF-M02-a1000002 | `updateMyProfile.ts` | No `PersonUpdated` domain event. | Add `domainEvents.emit('person.updated', ...)` after successful update (match `updatePerson.ts` pattern). |
| EF-M02-e1000004 | `requestMyAccountDeletion.ts` | No `DeletionRequested` domain event. | Emit event for officer notification consumer. |
| EF-M02-f1000002 | `cancelMyAccountDeletion.ts` | No `DeletionCancelled` domain event. | Emit event. |
| EF-M02-g1000002 | `executeAccountDeletion.ts` | No `PersonAnonymized` domain event. | Emit event for M05/M06/M07 consumers. |
| EF-M02-d4e5f6e1 | N/A (missing) | No SVG sanitization for BR-31. | Add server-side SVG sanitization in upload path (remove script elements, event handlers). |

### P3 -- Nice to Have (6 findings)

| ID | File | Issue | Remediation |
|----|------|-------|-------------|
| EF-M02-i9j0k1l2 | `updatePerson.ts` | Inline audit instead of `auditAction()` utility. | Refactor to use utility for consistency. |
| EF-M02-m3n4o5p6 | `getPerson.ts` | Unused `BusinessLogicError` import. | Remove dead import. |
| EF-M02-a2b3c4d5 | `updateNotificationPreferences.ts` | Legacy duplicate of `updateMyNotificationPreferences.ts`. | Mark deprecated; plan migration to `updateMy*` variant. |
| EF-M02-e6f7g8h9 | `updatePrivacySettings.ts` | Legacy duplicate of `updateMyPrivacySettings.ts`. | Same -- mark deprecated. |
| EF-M02-d4e5f6a4 | `utils/id-card-data.ts` | QR payload missing `timestamp` field for replay prevention. | Add `generatedAt: Date.now()` to QR payload. |
| EF-M02-d4e5f6a5 | `utils/id-card-data.ts` | Fallback to `'fallback-secret'` for HMAC key. | Throw startup error if `AUTH_SECRET` missing, or log warning. |

---

## 4. Delta from Previous Audit (2026-05-27)

### Resolved Findings

| ID | Previous Sev | Resolution |
|----|-------------|------------|
| EF-M02-k7l8m9n0 | P1 | **RESOLVED.** Digital ID Card handlers implemented: `getMyIdCard.ts`, `getMyIdCardPdf.ts`, `utils/id-card-data.ts`. WF-012 now covered. BR-18 (QR HMAC) and BR-01 (status from dues_expiry_date) implemented in `id-card-data.ts`. Frontend route at `/my/id-card.tsx`. |
| EF-M02-o1p2q3r4 | P2 | **RESOLVED.** `requestMyAccountDeletion.ts` now checks pending payments (PENDING_PAYMENTS) and sole officer role (SOLE_OFFICER) before scheduling deletion. M2-R5 / AC-M02-007 satisfied. |
| EF-M02-a1000003 | P2 | **RESOLVED.** `updatePerson.ts` now imports `domainEvents` and emits `person.updated` event after successful update. |
| EF-M02-c1000002 | P2 | **DROPPED.** `updateNotificationPreferences.ts` middleware concern -- low signal, covered by legacy deprecation finding. |

### New Findings

| ID | Sev | Summary |
|----|-----|---------|
| EF-M02-d4e5f6a4 | P3 | QR payload missing timestamp (replay attack vector). |
| EF-M02-d4e5f6a5 | P3 | HMAC fallback secret in id-card-data.ts. |
| EF-M02-d4e5f6e1 | P2 | No SVG sanitization for BR-31 (was noted but no finding ID assigned previously). |

---

## 5. Spec Artifacts Used

| Artifact | Path | Version | Sections Referenced |
|----------|------|---------|-------------------|
| MODULE_SPEC | `docs/product/modules/m02-member-profile/MODULE_SPEC.md` | 2.0 | 1 (Overview), 3 (Workflows), 5 (Business Rules), 6 (Permissions), 7 (Data Requirements), 8 (State Transitions), 10 (API Expectations), 10b (Domain Events), 11 (Acceptance Criteria), 15 (Error Handling), 17 (Observability), 20 (AI Instructions) |
| API_CONTRACTS | `docs/product/modules/m02-member-profile/API_CONTRACTS.md` | -- | 2.1 (Profile), 2.2 (Privacy), 2.3 (Notifications), 2.4 (Data Export), 2.5 (Account Deletion), 2.6 (Digital ID Card), 3 (Domain Events) |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | 1.0 | 1.Identity (tables: person, notification_preference, person_privacy_setting, data_export), 12 (Anti-Corruption Layers) |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | 1.0 | 1.2 (M02 workflows WF-010 through WF-014), 6.6 (Account Deletion Cascade) |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | -- | 3.1 (Person Module permissions) |
| MODULE_MAP | `docs/product/MODULE_MAP.md` | -- | Dependency Matrix (M02 depends on M01), Handler Cross-Reference |

---

## 6. Summary Statistics

| Metric | Count |
|--------|-------|
| Total files in `person/` | 52 (29 source + 23 test) |
| Files in M02 scope | 23 source + 15 test + 5 frontend = 43 |
| Files in M01/other scope | 8 source + 2 test = 10 |
| P1 findings (must fix) | 2 (down from 3) |
| P2 findings (should fix) | 11 (down from 13) |
| P3 findings (nice to have) | 6 (up from 4) |
| Total findings | 19 (down from 20) |
| OK checks | 18 (up from 12) |
| Resolved since last audit | 4 |
| New findings | 3 |
| Spec-declared endpoints implemented | 8/10 (80%, up from 60%) |
| Spec-declared entities with schema | 3/4 (75% -- still missing `data_export`) |
| Domain events emitted | 1/4 (25%, up from 0% -- `person.updated` in updatePerson.ts) |
| Legacy duplicate handlers | 2 (`updateNotificationPreferences`, `updatePrivacySettings`) |

### Endpoint Coverage Matrix

| API_CONTRACTS Endpoint | Handler File | Status |
|----------------------|-------------|--------|
| `GET /my/profile` | `getPerson.ts` (via `?person=me`) | IMPLEMENTED (route differs) |
| `PUT /my/profile` | `updateMyProfile.ts` | IMPLEMENTED |
| `PUT /my/privacy` | `updateMyPrivacySettings.ts` | IMPLEMENTED |
| `PUT /my/notifications` | `updateMyNotificationPreferences.ts` | IMPLEMENTED |
| `POST /my/data-export` | `exportMyData.ts` | PARTIAL (sync, wrong method/path, no tracking) |
| `GET /my/data-export/:id` | -- | MISSING |
| `POST /my/delete-account` | `requestMyAccountDeletion.ts` | IMPLEMENTED |
| `DELETE /my/delete-account` | `cancelMyAccountDeletion.ts` | IMPLEMENTED |
| `GET /my/id-card/:orgId` | `getMyIdCard.ts` | IMPLEMENTED |
| `GET /my/id-card/:orgId/pdf` | `getMyIdCardPdf.ts` | IMPLEMENTED |

### Business Rule Coverage

| BR | Description | Handler Coverage | Status |
|----|-------------|-----------------|--------|
| BR-01 | Status computed from dues_expiry_date | `utils/id-card-data.ts` reads `duesExpiryDate` from membership | IMPLEMENTED |
| BR-18 | QR HMAC signing for ID card | `utils/id-card-data.ts` HMAC-SHA256 with AUTH_SECRET | IMPLEMENTED |
| BR-21 | Multi-org independent statuses | `getMyPrivacySettings`, `getMyIdCard` support per-org | IMPLEMENTED |
| BR-23 | License validation regex | `updatePerson.ts` partial; `updateMyProfile.ts` missing | PARTIAL |
| BR-31 | SVG sanitization | No upload handler with sanitization | MISSING |
| BR-32 | Deletion cascade, 7yr financial retention | `accountDeletionCascade.ts` fully implements | COMPLETE |
| M2-R1 | Email change requires OTP | Handled by Better-Auth (external) | DELEGATED |
| M2-R2 | Password change invalidates sessions | Handled by Better-Auth (external) | DELEGATED |
| M2-R3 | Privacy toggle -> directory cache invalidation | `updateMyPrivacySettings.ts` updates DB; no explicit cache invalidation | PARTIAL |
| M2-R4 | Data export rate limit 1/24h | Not implemented in `exportMyData.ts` | MISSING |
| M2-R5 | Deletion blocked by payments/sole officer | `requestMyAccountDeletion.ts` checks both | COMPLETE |
| M2-R7 | Profile/status change -> regenerate ID card | No regeneration trigger | MISSING |
| M2-R8 | In-app notifications cannot be disabled | Enforced in getter, not schema | IMPLEMENTED |
| M2-R9 | Photo: JPEG/PNG/WebP, max 5MB | No server-side validation | MISSING |
| M2-R10 | Profile change -> audit trail | `auditAction()` in handlers | IMPLEMENTED |
| M2-R14 | Multi-org independent display | Per-org scoping in privacy/notifications | IMPLEMENTED |
