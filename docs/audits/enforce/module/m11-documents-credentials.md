# Module Enforcement: Documents & Credentials (M11)

**Score: 4.7/10 — NON-COMPLIANT (capped by P0)**
**Audit date:** 2026-05-27
**Auditor:** oli-enforce-module (Claude Opus 4.6)
**Source:** `services/api-ts/src/handlers/documents/` (15 handlers) + `services/api-ts/src/handlers/certificates/` (7 handlers) + `services/api-ts/src/handlers/storage/` (6 handlers)
**Specs:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md

## Scoring Method

Raw average of 6 dimensions, capped by worst severity: P0 present → cap at 3.0.

**Raw average:** (5.0 + 4.0 + 7.0 + 6.0 + 2.0 + 7.0) / 6 = **5.2**
**P0 cap applied:** 3.0 (P0 PII leak in verifyCertificatePublic.ts confirmed)
**Final score:** 3.0/10

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 5/10 | 0 | 4 | 2 | 0 |
| 2. Workflow Implementation | 4/10 | 0 | 3 | 1 | 0 |
| 3. Domain Term Consistency | 7/10 | 0 | 0 | 2 | 1 |
| 4. State Machine Enforcement | 6/10 | 0 | 1 | 1 | 0 |
| 5. Event Publishing | 2/10 | 0 | 3 | 0 | 0 |
| 6. Auth/Permission Enforcement | 7/10 | 1 | 0 | 1 | 0 |

**Totals:** P0: 1, P1: 11, P2: 7, P3: 1

---

## Findings

### Dimension 1: Public API Completeness

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M11-71f0d8a2 | P1 | **GET /my/id-card endpoint missing.** Spec WF-071 declares member ID card download as P0 priority. No handler in documents/, certificates/, or storage/. MemberCard concept partially lives in `association:member/repos/credentials.schema.ts` but no download handler exists. Spec entity "MemberCard" has no implementation. | N/A (missing) | 95% |
| EM-M11-72e1b943 | P1 | **GET /verify/:token mismatch.** Spec declares token-based HMAC verification (WF-072, BR-18). Implementation (`verifyCertificatePublic.ts`) looks up by certificate number, not by cryptographic token. No HMAC validation. Response shape diverges from spec (returns `holderName` + `creditHours` + `cpdActivityType` instead of spec's `valid`, `type`, `memberName`, `licenseNumber`, `organizationName`, `status`, `generatedAt`, `details`). No `VerificationRequest` record created. | certificates/verifyCertificatePublic.ts | 95% |
| EM-M11-75c3d4e5 | P1 | **Credential template CRUD endpoints missing from m11 scope.** Spec 2.7 declares GET/POST/PATCH/DELETE `/orgs/:id/credential-templates` (feature-flagged). These live in `association:member/` instead of documents/certificates module. Module boundary mismatch — spec assigns them to M11. | association:member/*.ts | 85% |
| EM-M11-74a5b6c7 | P1 | **PATCH /orgs/:id/documents/:id/status not implemented.** Spec declares a status update endpoint. Code has `archiveDocument.ts` (POST .../archive) for archived-only transition, and `updateDocument.ts` which allows arbitrary field updates without status validation. No dedicated status transition endpoint per spec. | documents/archiveDocument.ts, documents/updateDocument.ts | 90% |
| EM-M11-73d8e9f0 | P2 | **Route path mismatch.** Spec uses `/orgs/:organizationId/documents/...` paths. Code uses `/association/documents/...`. URL structure diverges from API contract. | documents/createDocument.ts | 90% |
| EM-M11-76f1a2b3 | P2 | **GET /my/certificates self-service path ambiguous.** `listCertificates.ts` does person-based listing but route path unclear. Spec expects `/my/certificates` self-service endpoint. | certificates/listCertificates.ts | 80% |

### Dimension 2: Workflow Implementation

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M11-81a2b3c4 | P1 | **WF-071 (Download Member ID Card) unimplemented.** No ID card generation handler. No QR code embedding. No PDF generation for member cards. No auto-regeneration on PersonUpdated/MembershipStatusChanged events (BR-19). Entire P0-priority workflow missing. | N/A (missing) | 95% |
| EM-M11-82d5e6f7 | P1 | **WF-072 (Public Verification) incomplete.** Certificate verification exists but uses plain DB lookup by number, not HMAC-based token verification per BR-18. No `VerificationRequest` entity tracking. No `VerificationRequested` event emission. Response body does not match spec contract. | certificates/verifyCertificatePublic.ts | 90% |
| EM-M11-83a8b9c0 | P1 | **WF-074 (Certificate Download) returns HTML, not PDF.** `generateCertificatePdf.ts` returns `Content-Type: text/html`. Spec WF-074 says "Downloads certificate PDF (includes credits earned, QR code, org branding)." No QR code embedded in output. Client-side PDF conversion is a workaround. | certificates/generateCertificatePdf.ts | 85% |
| EM-M11-84d1e2f3 | P2 | **WF-073 (Document Management) mostly implemented.** Create, update, archive, version, tag, search, access log all present. Missing: multipart file upload (code accepts JSON + storageKey, not direct upload). Document lifecycle mostly works but see state machine findings. | documents/ | 80% |

### Dimension 3: Domain Term Consistency

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M11-91c4d5e6 | P2 | **MemberCard entity missing.** Spec declares MemberCard as an entity (section 7). No table, type, or schema in documents/ or certificates/. Concept partially exists in `association:member/repos/credentials.schema.ts` as `memberCard` template type but no dedicated entity. | documents/repos/documents.schema.ts | 90% |
| EM-M11-92f7a8b9 | P2 | **VerificationRequest entity missing.** Spec declares VerificationRequest entity (section 7) with fields: id, token, certificateId, requestedAt, ipAddress, result. No table exists anywhere in the codebase. | N/A (missing) | 95% |
| EM-M11-93c0d1e2 | P3 | **DocumentVersion.fileUrl vs storageKey.** Spec uses `fileUrl` but schema uses `storageKey`. Minor semantic mismatch — storageKey is an internal reference, not a URL. | documents/repos/documents.schema.ts | 85% |

### Dimension 4: State Machine Enforcement

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M11-a1b2c3d4 | P1 | **createDocument hardcodes `status: 'published'`, bypassing draft.** Spec state machine: `draft -> published -> archived`. All documents skip the draft state entirely. No way to create a document as draft. Violates spec's initial state. | documents/createDocument.ts:L40 | 95% |
| EM-M11-a2e5f6a7 | P2 | **No explicit state transition validation.** archiveDocument.ts only checks `=== 'archived'` to reject double-archive. A draft document could be archived directly (skipping `published`). updateDocument.ts allows arbitrary status changes via body payload with no transition validation. Spec says `draft -> published -> archived` with officer guard, terminal `archived`. | documents/archiveDocument.ts, documents/updateDocument.ts | 90% |

### Dimension 5: Event Publishing

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M11-b1c2d3e4 | P1 | **CredentialGenerated event never emitted.** Spec declares emission on ID card and certificate generation. No EventBus, emit(), publish(), or domain event call exists in any certificate or document handler. `auditAction()` is used for compliance logging but is NOT a domain event bus. | certificates/generateCertificatePdf.ts, certificates/bulkIssueCertificates.ts | 95% |
| EM-M11-b2f5a6b7 | P1 | **DocumentUploaded event never emitted.** Spec requires emission on POST documents and POST document versions. createDocument.ts and uploadNewDocumentVersion.ts use `auditAction()` only. No domain event published. | documents/createDocument.ts, documents/uploadNewDocumentVersion.ts | 95% |
| EM-M11-b3c8d9e0 | P1 | **VerificationRequested event never emitted.** verifyCertificatePublic.ts returns data without emitting any event. Spec declares this event must fire on QR scan / URL visit. | certificates/verifyCertificatePublic.ts | 95% |
| EM-M11-b4a1b2c3 | P1 | **No consumed event handlers.** Spec declares 4 consumed events: PersonUpdated (regenerate ID card), MembershipStatusChanged (regenerate ID card), TrainingCompleted (make certificate available), AccountDeletionProcessed (revoke credentials). Grep finds zero matches for any of these in documents/, certificates/, or storage/ handlers. No domain-event-consumers.ts integration for M11. | N/A (missing) | 95% |

### Dimension 6: Auth/Permission Enforcement

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M11-c1d2e3f4 | **P0** | **verifyCertificatePublic.ts leaks PII to unauthenticated callers.** Handler joins `persons` table and returns `holderName` (full first + last name) to any unauthenticated caller who knows a certificate number. Spec contract says response should contain `memberName` but only after HMAC token validation (BR-18) — current implementation has NO HMAC check, making this a direct PII enumeration vector. An attacker could iterate certificate numbers to harvest member names. Additionally, spec expects only `valid`, `type`, `memberName`, `status` etc., but implementation returns `creditHours` and `cpdActivityType` as bonus PII. **This is the previously-flagged P0 and remains unfixed.** | certificates/verifyCertificatePublic.ts | 95% |
| EM-M11-c2a5b6c7 | P2 | **Binary officer check vs. granular role permissions.** Spec defines fine-grained role matrix (super, admin, president, VP, secretary, etc. for upload; super, admin, president only for delete). Code uses `requireOfficerTerm()` uniformly — a binary check that doesn't distinguish between role levels. Delete should be restricted to super/admin/president but any officer can delete. | documents/deleteDocument.ts, documents/archiveDocument.ts | 80% |

---

## Summary

### What works
- **Documents CRUD** is largely functional: create, read, update, delete, search, tag, version, access log
- **Certificates schema** is well-structured with proper unique constraints (training+person, certificate number)
- **Certificate generation** (bulk issue, batch generate) has solid officer auth guards
- **Storage handlers** have proper ownership checks, MIME type allowlisting, SVG exclusion, filename sanitization
- **Audit trail** via `auditAction()` covers most write operations
- **Org-scope IDOR prevention** present on document reads and writes

### Critical gaps
1. **P0 PII leak** in verifyCertificatePublic.ts — confirmed unfixed, full name exposed without HMAC validation
2. **Zero domain events** emitted across all 28 handlers — complete event bus gap
3. **Zero consumed events** handled — no PersonUpdated, TrainingCompleted, etc. subscribers
4. **WF-071 (ID Card)** entirely missing — P0-priority workflow
5. **State machine bypass** — documents always start as `published`, skipping `draft`
6. **Verify endpoint** implementation diverges from spec in auth model, response shape, and entity tracking

### Remediation priority
1. **P0-FIX:** Add HMAC token validation to verifyCertificatePublic, strip excess PII fields, match spec response shape
2. **P1-FIX:** Implement domain event emission (CredentialGenerated, DocumentUploaded, VerificationRequested)
3. **P1-FIX:** Add consumed event handlers for PersonUpdated, MembershipStatusChanged, TrainingCompleted, AccountDeletionProcessed
4. **P1-FIX:** Implement WF-071 member ID card generation handler
5. **P1-FIX:** Fix document initial state to `draft`, add state transition validation
6. **P1-FIX:** Generate actual PDF output for certificate download (not HTML)
