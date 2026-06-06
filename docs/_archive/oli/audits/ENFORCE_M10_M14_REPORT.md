# Enforcement Report: Modules M10-M14 (Phase 1)

**Date:** 2026-05-29
**Auditor:** oli-enforce-module + oli-enforce-file
**Modules:** m10-credit-tracking, m11-documents-credentials, m12-elections-governance, m13-professional-feed, m14-national-dashboard

---

## Summary

| Module | Spec Sections | Findings | P0 | P1 | P2 | P3 |
|--------|--------------|----------|----|----|----|----|
| M10 — Credit Tracking | 22/22 COMPLETE | 9 | 1 | 3 | 3 | 2 |
| M11 — Documents & Credentials | 22/22 COMPLETE | 12 | 2 | 4 | 4 | 2 |
| M12 — Elections & Governance | 21/22 (13 PARTIAL) | 8 | 1 | 2 | 3 | 2 |
| M13 — Professional Feed | 17/22 (5 STUB) | 1 | 0 | 1 | 0 | 0 |
| M14 — National Dashboard | 20/22 (2 STUB) | 6 | 1 | 2 | 2 | 1 |
| **TOTAL** | | **36** | **5** | **12** | **12** | **7** |

---

## M10 — Credit Tracking

### A. Module-Level Enforcement (oli-enforce-module)

**Spec:** `docs/product/modules/m10-credit-tracking/MODULE_SPEC.md`
**Handler dir:** `services/api-ts/src/handlers/training/` (shared with M09)
**Section Completeness:** All 22 sections COMPLETE per spec self-report

#### Spec-vs-Code Verification

| Check | Status | Details |
|-------|--------|---------|
| API Endpoints | PARTIAL | Spec declares `GET /my/credits`, `POST /my/credits` (manual entry), `PATCH /credits/:id` (officer adjust), `GET /org/:id/credits/compliance`, `GET /my/credits/transcript`. None exist as dedicated handlers. Credit tracking piggybacks on `markComplete` in training module. |
| Domain Events | PASS | `credit.awarded` emitted in `markComplete.ts`. `training.completed`, `training.published`, `training.cancelled` all emitted. |
| Business Rules | PARTIAL | BR-11 (cycle config) enforced in `markComplete`. BR-13 (auto-credit) enforced. BR-12 (carryover) computed but no excess-carry handler. M10-R2 (duplicate guard) enforced via `findByTrainingAndPerson`. M10-R4 (mandatory reason for adjustment) — no adjustment handler exists. |
| State Machine | PASS | `TRAINING_VALID_TRANSITIONS` in `completeTraining.ts` matches spec (draft→published→completed/cancelled). |

### B. File-Level Enforcement (oli-enforce-file)

#### EM-M10-001 — Missing dedicated credit tracking endpoints (P1)
**Finding:** Spec §10 declares 5 credit-specific endpoints (`GET /my/credits`, `POST /my/credits`, `PATCH /credits/:id`, `GET /org/:id/credits/compliance`, `GET /my/credits/transcript`). None exist as handlers. Credit tracking is embedded in `markComplete.ts` only. No standalone credit CRUD.
**Impact:** Members cannot view credit summary, add manual credits, or export transcripts.

#### EM-M10-002 — Missing credit.adjusted domain event (P2)
**Finding:** Spec §10b declares `CreditAdjusted` event for officer manual adjustments. No adjustment handler exists, so this event is never emitted.
**Impact:** Downstream consumers (audit, notifications) won't be notified of manual credit changes.

#### EM-M10-003 — Missing carryover enforcement (P2)
**Finding:** Spec BR-12 says excess credits carry over to next cycle. `markComplete.ts` computes cycle bounds but never implements carryover logic for credits exceeding the cycle requirement.
**Impact:** Members with excess credits lose them at cycle boundary.

#### EF-M10-001 — listMyTrainings: no pagination (P3)
**File:** `services/api-ts/src/handlers/training/listMyTrainings.ts`
**Finding:** Returns all trainings for a person with no limit/offset. `repo.listByPerson()` has no pagination parameter visible in handler.
**Impact:** Performance degradation for members with many trainings.

#### EF-M10-002 — enroll: waitlisted status mapped to 'cancelled' (P2)
**File:** `services/api-ts/src/handlers/training/enroll.ts`
**Finding:** When capacity is full, enrollment status is set to `'cancelled'` instead of a dedicated `'waitlisted'` status. This loses semantic meaning — the member isn't cancelled, they're waiting.
**Impact:** Cannot distinguish between intentional cancellations and waitlist entries.

#### EF-M10-003 — createTraining: no domain event emitted (P3)
**File:** `services/api-ts/src/handlers/training/createTraining.ts`
**Finding:** No `training.created` domain event emitted. Other handlers (publish, cancel, complete) all emit events.
**Impact:** Downstream consumers miss training creation notifications.

#### EF-M10-004 — markComplete: swallowed errors on credit creation (P1)
**File:** `services/api-ts/src/handlers/training/markComplete.ts`
**Finding:** The entire credit creation block is wrapped in `try/catch` with empty catch: `catch { // Credit creation failure should not block marking complete }`. If credit creation fails silently, the member won't receive their CPD credits and nobody is notified.
**Impact:** Silent credit loss. Should at minimum log the error and emit a failure event.

#### EF-M10-005 — training.repo: SQL injection via LIKE pattern (P0)
**File:** `services/api-ts/src/handlers/training/repos/training.repo.ts`
**Finding:** `like(trainings.title, \`%${filters.search}%\`)` — the search string is interpolated directly into a LIKE pattern without escaping `%` and `_` wildcards. While Drizzle parameterizes the value, the LIKE wildcards in user input can cause unintended pattern matching (e.g., `%` matches everything). This is SQL wildcard injection, not full SQL injection due to Drizzle parameterization.
**Impact:** Attacker can craft search strings with `%` to bypass intended search behavior. Low severity due to Drizzle but still a violation.

#### EF-M10-006 — Missing audit logging on training mutations (P1)
**Files:** `createTraining.ts`, `updateTraining.ts`, `cancelTraining.ts`, `completeTraining.ts`, `publishTraining.ts`
**Finding:** None of these handlers call `auditAction()`. Only `markComplete` has audit-adjacent logging via domain events. Spec §17 requires observability hooks including audit trails.
**Impact:** No audit trail for training lifecycle changes.

---

## M11 — Documents & Credentials

### A. Module-Level Enforcement (oli-enforce-module)

**Spec:** `docs/product/modules/m11-documents-credentials/MODULE_SPEC.md`
**Handler dirs:** `services/api-ts/src/handlers/documents/` (15 handlers), `services/api-ts/src/handlers/certificates/` (6 handlers)
**Section Completeness:** All 22 sections COMPLETE per spec self-report

#### Spec-vs-Code Verification

| Check | Status | Details |
|-------|--------|---------|
| API Endpoints | PARTIAL | Documents CRUD fully implemented. Certificates have list/get/verify/batchGenerate/bulkIssue/generatePdf. Missing: `GET /my/id-card`, `POST /verify` (QR-based member verification), ID card generation/regeneration. |
| Domain Events | FAIL | Spec §10b declares `DocumentUploaded`, `CertificateIssued`, `CredentialGenerated`, `VerificationRequested`. NONE are emitted in any handler. Zero domain event usage across all 21 document+certificate handlers. |
| Business Rules | PARTIAL | BR-18 (HMAC QR validation) — not implemented. BR-19 (auto-regenerate ID card) — no ID card handler. BR-20 (cert requires completion+attendance) — enforced indirectly via training flow. M11-R2 (SVG sanitization) — not implemented. M11-R5 (access logging) — implemented in `getDocumentAccessLog`. |
| State Machine | PASS | Document status `draft→published→archived` enforced in archiveDocument. Certificates immutable (no state machine needed per spec). |

### B. File-Level Enforcement (oli-enforce-file)

#### EF-M11-001 — Zero domain events emitted across all handlers (P1)
**Files:** All 21 handler files in `documents/` and `certificates/`
**Finding:** Spec §10b declares 4 published events (DocumentUploaded, CertificateIssued, CredentialGenerated, VerificationRequested). None are emitted anywhere. No `domainEvents.emit()` calls in any documents or certificates handler.
**Impact:** Cross-module consumers (notifications, audit, credit tracking) receive no signals from this module.

#### EF-M11-002 — Missing HMAC QR signing for certificate verification (P0)
**File:** `services/api-ts/src/handlers/certificates/verifyCertificatePublic.ts`
**Finding:** Spec BR-18 requires QR payloads signed with HMAC-SHA256 for authenticity verification. The `verifyCertificatePublic` handler does a plain DB lookup by certificate number with no signature validation. Anyone who guesses/enumerates certificate numbers can verify arbitrary certificates.
**Impact:** No cryptographic proof of authenticity. Certificate verification can be spoofed.

#### EF-M11-003 — verifyCertificatePublic: no rate limiting (P2)
**File:** `services/api-ts/src/handlers/certificates/verifyCertificatePublic.ts`
**Finding:** Spec M11-R3 requires per-key rate limiting on the verification API. The public endpoint has no rate limiting, enabling certificate number enumeration.
**Impact:** Attacker can enumerate all certificate numbers via brute force.

#### EF-M11-004 — Missing SVG sanitization (P0)
**Files:** `certificates/utils/certificate-template.ts`, `documents/uploadNewDocumentVersion.ts`
**Finding:** Spec M11-R2 requires SVG sanitization (strip `<script>`, `on*` attributes, `<foreignObject>`, external `xlink:href`). No sanitization logic exists anywhere in the documents or certificates modules.
**Impact:** XSS via malicious SVG uploads in document versions or certificate templates.

#### EF-M11-005 — uploadNewDocumentVersion: missing org-scope check (P0)
**File:** `services/api-ts/src/handlers/documents/uploadNewDocumentVersion.ts`
**Finding:** Handler fetches document by ID but does not verify `document.organizationId === orgId`. The `getDocument` handler has this check, but `uploadNewDocumentVersion` does not.
**Impact:** IDOR — user in org A can upload a version to a document belonging to org B.

#### EF-M11-006 — listDocumentVersions: missing org-scope check (P2)
**File:** `services/api-ts/src/handlers/documents/listDocumentVersions.ts`
**Finding:** Queries versions by `documentId` only, without verifying the document belongs to the caller's organization.
**Impact:** Cross-org data leak — versions from other orgs' documents can be listed.

#### EF-M11-007 — getDocumentVersion: missing org-scope check (P2)
**File:** `services/api-ts/src/handlers/documents/getDocumentVersion.ts`
**Finding:** Verifies `version.documentId === params.documentId` but never checks the document's organization ownership.
**Impact:** Cross-org data leak via direct version ID access.

#### EF-M11-008 — getDocumentTag: missing org-scope check (P2)
**File:** `services/api-ts/src/handlers/documents/getDocumentTag.ts`
**Finding:** Fetches tag by ID only, no organization scoping. Tags from other orgs accessible.
**Impact:** Minor data leak of tag names/colors from other organizations.

#### EF-M11-009 — Missing ID card handlers (P1)
**Finding:** Spec declares `GET /my/id-card` screen and ID card generation workflow (WF-071). No handler exists for ID card generation, download, or QR code embedding.
**Impact:** Core M11 feature (member ID cards with QR) entirely unimplemented.

#### EF-M11-010 — Missing public verification page handler (P1)
**Finding:** Spec declares `GET /verify/[token]` public verification workflow (WF-072). While `verifyCertificatePublic` exists for certificate verification, there is no member/credential verification endpoint.
**Impact:** Public credential verification workflow incomplete.

#### EF-M11-011 — createDocument: no role restriction (P1)
**File:** `services/api-ts/src/handlers/documents/createDocument.ts`
**Finding:** Spec §6 says document creation requires `member` or `officer` role. Handler only checks `user` exists, no membership or role validation. Any authenticated user can create documents in any org.
**Impact:** Unauthorized document creation across organizations.

#### EF-M11-012 — deleteDocumentTag: missing org-scope check (P3)
**File:** `services/api-ts/src/handlers/documents/deleteDocumentTag.ts`
**Finding:** Deletes tag by ID without verifying it belongs to the caller's organization.
**Impact:** Cross-org tag deletion.

---

## M12 — Elections & Governance

### A. Module-Level Enforcement (oli-enforce-module)

**Spec:** `docs/product/modules/m12-elections-governance/MODULE_SPEC.md`
**Handler dir:** `services/api-ts/src/handlers/elections/` (9 handlers)
**Section Completeness:** 21/22 COMPLETE, §13 (Edge Cases) PARTIAL

#### Spec-vs-Code Verification

| Check | Status | Details |
|-------|--------|---------|
| API Endpoints | PASS | All declared endpoints exist: createElection, listElections, getElection, updateElectionStatus, createNominee, updateNomineeStatus, castVote, certifyElection, deleteElection. |
| Domain Events | PASS | `election.created`, `election.status.changed`, `election.deleted`, `nomination.submitted` all emitted. |
| Business Rules | PASS | BR-33 (voter must be active member) enforced in `castVote`. BR-34 (nominee eligibility: active + 6mo tenure + not suspended) enforced in `createNominee`. M12-R1 (one vote per position) enforced via `hasVoted` + unique constraint. M12-R6 (min 2 candidates) enforced in `updateElectionStatus`. |
| State Machine | PASS | `ELECTION_VALID_TRANSITIONS` imported from `@/utils/status-transitions` and enforced via `assertValidTransition`. Nominee transitions enforced in `updateNomineeStatus`. |

### B. File-Level Enforcement (oli-enforce-file)

#### EF-M12-001 — getElection: no org-scope check or auth (P0)
**File:** `services/api-ts/src/handlers/elections/getElection.ts`
**Finding:** No authentication check (no `session` validation). No organization scoping — any user (even unauthenticated if route middleware is permissive) can view any election by ID, including nominees with person names and vote tallies.
**Impact:** Information disclosure. Election data (nominees, vote counts) from any org accessible without auth.

#### EF-M12-002 — getElection: N+1 query for person names (P3)
**File:** `services/api-ts/src/handlers/elections/getElection.ts`
**Finding:** Iterates `personIds` array and queries `persons` table one-by-one in a loop: `for (const pid of personIds) { const [person] = await db.select()... }`. Should use `IN` query.
**Impact:** Performance degradation proportional to nominee count.

#### EF-M12-003 — listElections: no org-scope enforcement from handler (P1)
**File:** `services/api-ts/src/handlers/elections/listElections.ts`
**Finding:** Handler reads `organizationId` from route param and passes to repo.list(), but does not verify the caller is a member of that org. Any authenticated user could list elections for any org.
**Impact:** Cross-org election data leak.

#### EF-M12-004 — createNominee: raw DB query instead of repo (P3)
**File:** `services/api-ts/src/handlers/elections/createNominee.ts`
**Finding:** Uses `db.select().from(memberships)` directly instead of going through MembershipRepository. Not a security issue but violates the module pattern (Router→Validators→Handlers→Repositories).
**Impact:** Convention violation. Harder to mock in tests, bypasses any repo-level hooks.

#### EF-M12-005 — Missing bylaw ratification workflow (P1)
**Finding:** Spec declares WF-078 (Bylaw Ratification) with `passageThreshold` field on election entity. Schema has the field but no handler logic differentiates officer elections from bylaw votes. `certifyElection` only handles officer transitions.
**Impact:** Bylaw ratification workflow declared in spec but not enforced.

#### EF-M12-006 — castVote: no audit logging (P2)
**File:** `services/api-ts/src/handlers/elections/castVote.ts`
**Finding:** Vote casting has no `auditAction()` call. `updateElectionStatus` and `deleteElection` both have audit logging, but vote casting does not.
**Impact:** No audit trail for individual votes (spec §17 requires observability).

#### EF-M12-007 — certifyElection: no domain event emitted (P2)
**File:** `services/api-ts/src/handlers/elections/certifyElection.ts`
**Finding:** Performs officer transitions but emits no domain events. Spec §10b declares `ElectionPublished` event. The `updateElectionStatus` handler emits `election.status.changed` when publishing, but `certifyElection` (which also sets `published` status) does not.
**Impact:** Downstream consumers miss the certification event.

#### EF-M12-008 — certifyElection: no audit logging (P2)
**File:** `services/api-ts/src/handlers/elections/certifyElection.ts`
**Finding:** Creates officer terms, ends old terms, generates checklists — significant governance action with no `auditAction()` call.
**Impact:** Critical governance action has no audit trail.

---

## M13 — Professional Feed

### A. Module-Level Enforcement (oli-enforce-module)

**Spec:** `docs/product/modules/m13-professional-feed/MODULE_SPEC.md`
**Handler dir:** No dedicated handler directory. Only test stubs in `communication/`.
**Section Completeness:** 17/22 COMPLETE, 5 sections STUB (per §21)

**Stub sections:** §7b Aggregate Boundaries (stub rationale: simple domain), §12 Test Expectations (awaiting implementation), §16 Performance (stub until impl), §17 Observability (stub until impl), §18 Feature Flags (stub until impl).

#### Spec-vs-Code Verification

| Check | Status | Details |
|-------|--------|---------|
| API Endpoints | FAIL | None implemented. Zero handlers. Only test files exist: `ac-m13.professional-feed.test.ts`, `m13.professional-feed.test.ts` in `communication/`. |
| Domain Events | FAIL | None implemented. |
| Business Rules | FAIL | None implemented. |
| State Machine | FAIL | None implemented. |

### B. File-Level Enforcement (oli-enforce-file)

#### EM-M13-001 — Future module: no implementation to enforce (P1)
**Finding:** M13 Professional Feed has a complete spec but zero implementation. No handler directory, no schema, no routes. Only acceptance test stubs exist in the `communication/` directory. This is a future module.
**Impact:** Entire module is spec-only. Cannot enforce file-level compliance on nonexistent code.

---

## M14 — National Dashboard

### A. Module-Level Enforcement (oli-enforce-module)

**Spec:** `docs/product/modules/m14-national-dashboard/MODULE_SPEC.md`
**Handler dir:** `services/api-ts/src/handlers/association:operations/` (shared, 54+ handlers)
**Section Completeness:** 20/22 COMPLETE, 2 sections STUB (§8 State Transitions — "no entity state machine, dashboard is computed view"; §13 Edge Cases has [VERIFY] items)

#### Spec-vs-Code Verification

| Check | Status | Details |
|-------|--------|---------|
| API Endpoints | PARTIAL | Spec declares `GET /admin/national/summary`, `GET /admin/national/:assocId/orgs/:orgId`, `POST /admin/national/export`. Only `exportNationalDashboard` exists. Missing: summary dashboard endpoint, chapter drill-down endpoint. |
| Domain Events | PARTIAL | Spec §10b declares `DashboardExported` event. The export handler logs audit but does not emit a domain event. Consumed events (MembershipStatusChanged, DuesPaymentCompleted, etc.) — no event listener/handler found. |
| Business Rules | PARTIAL | BR-36 (access control: platform admin or national officer) enforced in `exportNationalDashboard`. BR-37 (aggregation accuracy) — no explicit accuracy validation. BR-38 (privacy: no individual PII in dashboard) — export uses aggregate fields only, appears compliant. |
| State Machine | N/A | No entity state machine per spec §8 (computed view). |

### B. File-Level Enforcement (oli-enforce-file)

#### EF-M14-001 — Missing summary dashboard endpoint (P1)
**Finding:** Spec declares `GET /admin/national/summary` as the primary dashboard view (WF-084). No handler exists. Only `exportNationalDashboard` is implemented.
**Impact:** Core M14 feature (national dashboard summary) unimplemented.

#### EF-M14-002 — Missing chapter drill-down endpoint (P1)
**Finding:** Spec declares `GET /admin/national/:assocId/orgs/:orgId` for chapter-level drill-down (WF-085). No handler exists.
**Impact:** Cannot drill into individual chapter details from national dashboard.

#### EF-M14-003 — exportNationalDashboard: missing DashboardExported domain event (P2)
**File:** `services/api-ts/src/handlers/association:operations/exportNationalDashboard.ts`
**Finding:** Spec §10b declares `DashboardExported` event. Handler calls `auditAction()` but does not emit the domain event via `domainEvents.emit()`.
**Impact:** Downstream consumers won't receive export notifications.

#### EF-M14-004 — exportNationalDashboard: CSV injection vulnerability (P0)
**File:** `services/api-ts/src/handlers/association:operations/exportNationalDashboard.ts`
**Finding:** The `snapshotsToCsv` function only escapes values containing commas. Values starting with `=`, `+`, `-`, `@` are not escaped. If chapter names contain formula characters, the exported CSV can execute formulas when opened in Excel.
**Impact:** CSV injection — malicious chapter names could execute arbitrary formulas in spreadsheet applications.

#### EF-M14-005 — exportNationalDashboard: no input validation on snapshotMonth (P2)
**File:** `services/api-ts/src/handlers/association:operations/exportNationalDashboard.ts`
**Finding:** `body.snapshotMonth` is used directly with no format validation. Malformed dates like `2026-99` would be passed to `new Date('2026-99-01')` producing invalid date objects.
**Impact:** Invalid date parsing could cause unexpected behavior in data queries.

#### EF-M14-006 — No consumed event handlers (P3)
**Finding:** Spec §10b lists 6 consumed events (MembershipStatusChanged, DuesPaymentCompleted, TrainingCompleted, CreditEntryCreated, ElectionPublished, EventCreated). No event listeners or handlers exist to refresh dashboard snapshots.
**Impact:** Dashboard data would be stale — no reactive refresh mechanism.

---

## P0 Findings Summary (Immediate Action Required)

| ID | Module | Finding | File |
|----|--------|---------|------|
| EF-M10-005 | M10 | SQL wildcard injection in LIKE search | training/repos/training.repo.ts |
| EF-M11-004 | M11 | Missing SVG sanitization — XSS via uploads | certificates/utils + documents/ |
| EF-M11-005 | M11 | IDOR in uploadNewDocumentVersion — missing org-scope | documents/uploadNewDocumentVersion.ts |
| EF-M12-001 | M12 | getElection: no auth + no org-scope — full data leak | elections/getElection.ts |
| EF-M14-004 | M14 | CSV injection in national dashboard export | association:operations/exportNationalDashboard.ts |

---

## Methodology

- **Module enforcement:** Read MODULE_SPEC.md §1-§22, verified PRESENT/STUB/MISSING for each section, then cross-referenced declared API endpoints, domain events, business rules, and state machines against actual handler code.
- **File enforcement:** Read every non-test `.ts` file in each handler directory. Checked for: auth/role checks, org-scope validation (IDOR), input validation, error handling, audit logging, domain event emission, dead code, PII exposure, SQL injection.
- **Finding IDs:** `EM-{MODULE}-{NNN}` for module-level, `EF-{MODULE}-{NNN}` for file-level.
- **Severity:** P0=security/data leak, P1=missing section/unrouted/no events, P2=incomplete/validation gap, P3=convention.
