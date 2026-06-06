# Per-File Spec Traceability: M11 — Documents & Credentials

> oli-enforce-file v2.0 | Generated: 2026-05-27
> Specs: MODULE_SPEC.md v2.0, API_CONTRACTS.md, ERROR_TAXONOMY.md
> Directories: `documents/` (32 files), `certificates/` (22 files), `storage/` (12 files)

---

## 1. File Inventory & Classification

### 1.1 documents/ (32 files)

| File | Role | Spec Trace |
|------|------|------------|
| `createDocument.ts` | Handler | WF-073, POST /orgs/:orgId/documents |
| `createDocument.test.ts` | Test | — |
| `getDocument.ts` | Handler | WF-073 |
| `getDocument.test.ts` | Test | — |
| `deleteDocument.ts` | Handler | WF-073, DELETE endpoint |
| `deleteDocument.test.ts` | Test | — |
| `archiveDocument.ts` | Handler | WF-073, PATCH status |
| `archiveDocument.test.ts` | Test | — |
| `searchDocuments.ts` | Handler | WF-073, GET /association/documents |
| `getDocumentAccessLog.ts` | Handler | WF-073, M11-R5 |
| `getDocumentAccessLog.test.ts` | Test | — |
| `getDocumentVersion.ts` | Handler | WF-073, M11-R4 |
| `getDocumentVersion.test.ts` | Test | — |
| `listDocumentVersions.ts` | Handler | WF-073, M11-R4 |
| `listDocumentVersions.test.ts` | Test | — |
| `createDocumentTag.ts` | Handler | Tag management |
| `createDocumentTag.test.ts` | Test | — |
| `deleteDocumentTag.ts` | Handler | Tag management |
| `deleteDocumentTag.test.ts` | Test | — |
| `getDocumentTag.ts` | Handler | Tag management |
| `getDocumentTag.test.ts` | Test | — |
| `listDocumentTags.ts` | Handler | Tag management |
| `listDocumentTags.test.ts` | Test | — |
| `repos/documents.schema.ts` | Schema | Sec 7 entities |
| `repos/documents.repo.ts` | Repository | Data access |
| `repos/documents.repo.test.ts` | Test | — |
| `ac-m11.documents.test.ts` | Test (AC) | AC-M11-005, AC-M11-006 |
| `auth-enforcement.test.ts` | Test (Auth) | Sec 6 permissions |
| `permission-enforcement.test.ts` | Test (Perm) | Sec 6 permissions |
| `documents-handlers.test.ts` | Test (Integration) | — |
| `documents.test.ts` | Test (Integration) | — |

### 1.2 certificates/ (22 files)

| File | Role | Spec Trace |
|------|------|------------|
| `verifyCertificatePublic.ts` | Handler (PUBLIC) | WF-072, GET /verify/:token |
| `verifyCertificatePublic.test.ts` | Test | — |
| `getCertificate.ts` | Handler | WF-074 |
| `getCertificate.test.ts` | Test | — |
| `listCertificates.ts` | Handler | WF-074, GET /my/certificates |
| `listCertificates.test.ts` | Test | — |
| `generateCertificatePdf.ts` | Handler | WF-074, GET /my/certificates/:id/download |
| `generateCertificatePdf.test.ts` | Test | — |
| `batchGenerateCertificates.ts` | Handler | Batch PDF gen (officer) |
| `batchGenerateCertificates.test.ts` | Test | — |
| `bulkIssueCertificates.ts` | Handler | Bulk issue (officer) |
| `bulkIssueCertificates.test.ts` | Test | — |
| `repos/certificates.schema.ts` | Schema | Sec 7 Certificate entity |
| `repos/certificates.repo.ts` | Repository | Data access |
| `repos/certificates.repo.test.ts` | Test | — |
| `utils/certificate-numbering.ts` | Utility | Certificate numbering |
| `utils/certificate-numbering.test.ts` | Test | — |
| `utils/certificate-template.ts` | Utility | HTML template rendering |
| `utils/certificate-template.test.ts` | Test | — |
| `auth-enforcement.test.ts` | Test (Auth) | Sec 6 permissions |
| `permission-enforcement.test.ts` | Test (Perm) | Sec 6 permissions |
| `flow-09.certificate-retrieval.test.ts` | Test (Flow) | WF-074 |

### 1.3 storage/ (12 files)

| File | Role | Spec Trace |
|------|------|------------|
| `uploadFile.ts` | Handler | File upload, M11-R2 |
| `uploadFile.test.ts` | Test | — |
| `completeFileUpload.ts` | Handler | Upload completion |
| `getFile.ts` | Handler | File metadata |
| `getFileDownload.ts` | Handler | Presigned download |
| `deleteFile.ts` | Handler | File deletion |
| `listFiles.ts` | Handler | File listing |
| `repos/file.schema.ts` | Schema | Sec 7 StoredFile entity |
| `repos/file.repo.ts` | Repository | Data access |
| `auth-enforcement.test.ts` | Test (Auth) | Sec 6 permissions |
| `br-31.svg-upload-security.test.ts` | Test (BR) | M11-R2 |
| `storage-handlers.test.ts` | Test (Integration) | — |

---

## 2. Findings

### P0

#### EF-M11-e1f2a3b4 — PII Leak in verifyCertificatePublic.ts (CONFIRMED)

- **File:** `certificates/verifyCertificatePublic.ts`
- **Checks failed:** Data shape, Import boundaries
- **Severity:** P0
- **Spec Ref:** API_CONTRACTS.md GET `/verify/:token`, MODULE_SPEC Sec 15
- **Confidence:** 95%

The public (unauthenticated) endpoint joins `persons` table selecting `firstName` and `lastName`, constructs `holderName` and returns it to any caller with a certificate number.

```typescript
const results = await db.select({
  firstName: persons.firstName,
  lastName: persons.lastName,
}).from(certificates)
  .leftJoin(persons, eq(certificates.personId, persons.id))
```

Returns: `holderName: [cert.firstName, cert.lastName].filter(Boolean).join(' ')`

**API_CONTRACTS.md** verify endpoint response defines only: `certificateNumber`, `issuedAt`, `status`, `creditHours`, `cpdActivityType`, `isValid`. No `holderName` field.

Certificate numbers follow predictable pattern `ORG-YEAR-NNNN` — enumerable. Any person can extract full legal names of all certificate holders.

**Also crosses import boundary:** imports `persons` from `../person/repos/person.schema` — direct cross-context schema coupling.

**Remediation:** Remove `holderName` from response. If name is needed for verification display, mask it ("J*** D***") and document in spec.

---

### P1

#### EF-M11-a1b2c3d4 — Missing GET /my/id-card handler

- **File:** MISSING
- **Checks failed:** Domain terms
- **Severity:** P1
- **Spec Ref:** MODULE_SPEC WF-071, API_CONTRACTS 2.1
- **Confidence:** 95%

No handler file exists for Member ID Card download. WF-071 and API Contract 2.1 require `GET /my/id-card` with QR code, photo, membership status.

#### EF-M11-e5f6a7b8 — verifyCertificatePublic uses certificateNumber, not opaque token

- **File:** `certificates/verifyCertificatePublic.ts`
- **Checks failed:** Domain terms, Naming
- **Severity:** P1
- **Spec Ref:** MODULE_SPEC WF-072, API_CONTRACTS 2.3
- **Confidence:** 90%

Spec requires `GET /verify/:token` (opaque HMAC token). Implementation uses `GET /public/verify/:certificateNumber` (predictable number). Token-based verification prevents enumeration; number-based allows it.

#### EF-M11-a5b6c7d8 — createDocument.ts missing DocumentUploaded event

- **File:** `documents/createDocument.ts`
- **Checks failed:** Domain terms
- **Severity:** P1
- **Spec Ref:** MODULE_SPEC 10b, API_CONTRACTS 3
- **Confidence:** 95%

Only calls `auditAction()`. Spec requires `DocumentUploaded` event with `{documentId, orgId, uploadedBy}`.

#### EF-M11-c3d4e5f6 — generateCertificatePdf returns HTML, no QR code

- **File:** `certificates/generateCertificatePdf.ts`
- **Checks failed:** Domain terms, Data shape
- **Severity:** P1
- **Spec Ref:** MODULE_SPEC WF-074, AC-M11-001
- **Confidence:** 85%

Returns `Content-Type: text/html`, not PDF. No QR code generation anywhere in the template. Spec WF-074 requires downloadable PDF with HMAC-signed QR for verification. AC-M11-001: "QR validates on scan."

#### EF-M11-a7b8c9d0 — generateCertificatePdf missing CredentialGenerated event

- **File:** `certificates/generateCertificatePdf.ts`
- **Checks failed:** Domain terms
- **Severity:** P1
- **Spec Ref:** MODULE_SPEC 10b, API_CONTRACTS 3
- **Confidence:** 95%

Spec requires `CredentialGenerated` event with `{personId, type: "certificate", documentId}`.

#### EF-M11-e7f8a9b0 — createDocument accepts JSON instead of multipart/form-data

- **File:** `documents/createDocument.ts`
- **Checks failed:** Data shape
- **Severity:** P1
- **Spec Ref:** API_CONTRACTS 2.4 POST
- **Confidence:** 85%

Accepts JSON body (title, fileName, mimeType, size, storageKey) but spec requires `multipart/form-data` with file binary. Architectural divergence from contract.

#### EF-M11-i9j0k1l2 — Missing org-scope check in deleteDocumentTag and getDocumentTag

- **File:** `documents/deleteDocumentTag.ts`, `documents/getDocumentTag.ts`
- **Checks failed:** Data shape (authorization)
- **Severity:** P1
- **Spec Ref:** MODULE_SPEC Sec 6
- **Confidence:** 95%

`deleteDocumentTag` finds by ID and deletes without checking `organizationId`. Compare `deleteDocument.ts` which checks `existing.organizationId !== orgId`. User in org A can delete tags in org B.

Same issue in `getDocumentTag.ts` — reads cross-org without scope check.

**Remediation:** Add `if (existing.organizationId !== orgId) throw new ForbiddenError(...)`.

---

### P2

#### EF-M11-c9d0e1f2 — createDocument hardcodes status to 'published'

- **File:** `documents/createDocument.ts`
- **Checks failed:** Domain terms (state machine)
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 8
- **Confidence:** 95%

Hardcodes `status: 'published'`. Schema default is `draft`. Spec state machine: `draft -> published -> archived`. Bypasses draft review workflow.

#### EF-M11-c5d6e7f8 — archiveDocument allows archiving from any non-archived status

- **File:** `documents/archiveDocument.ts`
- **Checks failed:** Domain terms (state machine)
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 8
- **Confidence:** 90%

Allows archiving from `draft`. Spec defines `draft -> published -> archived` — draft must be published first.

#### EF-M11-e5f6g7h8 — archiveDocument uses ad-hoc error code ALREADY_ARCHIVED

- **File:** `documents/archiveDocument.ts`
- **Checks failed:** Error taxonomy
- **Severity:** P2
- **Spec Ref:** ERROR_TAXONOMY.md M11-007
- **Confidence:** 90%

Uses `BusinessLogicError('...', 'ALREADY_ARCHIVED')`. Taxonomy defines `M11-007` for archive-related errors. "Already archived" is semantically distinct from "active references" — needs new code `M11-008` or use `M11-007`.

#### EF-M11-c9d0e1f2b — generateCertificatePdf allows body overrides for security-sensitive fields

- **File:** `certificates/generateCertificatePdf.ts`
- **Checks failed:** Data shape
- **Severity:** P2
- **Spec Ref:** API_CONTRACTS 2.2
- **Confidence:** 90%

Request body can override `recipientName`, `trainingTitle`, `organizationName`. A certificate owner can generate a PDF with arbitrary names and titles carrying a valid certificate number.

```typescript
recipientName: body.recipientName ?? user.name ?? 'Member',
trainingTitle: body.trainingTitle ?? 'Training Event',
```

**Remediation:** Use authoritative data from certificate record and associated training/person records.

#### EF-M11-g3h4i5j6 — No HMAC QR code in certificate template

- **File:** `certificates/utils/certificate-template.ts`
- **Checks failed:** Domain terms
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 2, BR-18, AC-M11-001
- **Confidence:** 95%

No QR code rendering in template HTML. Spec: "HMAC-signed code in member cards and certificates." AC-M11-001: "Given certificate with QR code, When scanned, Then HMAC validates."

#### EF-M11-a9b0c1d2 — Missing MemberCard table in schema

- **File:** `documents/repos/documents.schema.ts`
- **Checks failed:** Data shape
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 7 Entity: MemberCard
- **Confidence:** 95%

Spec defines MemberCard entity with fields: personId, organizationId, qrToken, issuedAt, expiresAt, status, pdfUrl. Not present in schema.

#### EF-M11-e3f4a5b6 — Missing VerificationRequest table in schema

- **File:** `documents/repos/documents.schema.ts`
- **Checks failed:** Data shape
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 7 Entity: VerificationRequest
- **Confidence:** 95%

Spec defines VerificationRequest entity with fields: token, valid, requestedAt, ipAddress, userAgent. Not present.

#### EF-M11-u1v2w3x4 — Cross-bounded-context import in certificates schema

- **File:** `certificates/repos/certificates.schema.ts`
- **Checks failed:** Import boundaries
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 20 (Content bounded context)
- **Confidence:** 85%

Imports `cpdActivityTypeEnum` from `association:operations/repos/events.schema` — couples Content context to Association context enum. If enum changes, certificates schema breaks.

```typescript
import { cpdActivityTypeEnum } from '../../association:operations/repos/events.schema';
```

**Remediation:** Move shared enums to `@/core/enums` or define locally.

#### EF-M11-k7l8m9n0 — uploadFile.ts uses ad-hoc MIME validation instead of M11-002

- **File:** `storage/uploadFile.ts`
- **Checks failed:** Error taxonomy
- **Severity:** P2
- **Spec Ref:** ERROR_TAXONOMY.md M11-002
- **Confidence:** 90%

Throws `ValidationError("File type '${body.mimeType}' is not allowed")`. Taxonomy reserves `M11-002` ("File type not allowed") for this scenario.

#### EF-M11-o1p2q3r4 — completeFileUpload.ts uses ad-hoc error code

- **File:** `storage/completeFileUpload.ts`
- **Checks failed:** Error taxonomy
- **Severity:** P2
- **Spec Ref:** ERROR_TAXONOMY.md
- **Confidence:** 85%

Uses `UPLOAD_VERIFICATION_FAILED` — not registered in taxonomy.

#### EF-M11-a1c2e3a4 — searchDocuments uses binary officer check instead of granular roles

- **File:** `documents/searchDocuments.ts`
- **Checks failed:** Domain terms (permissions)
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC Sec 6
- **Confidence:** 80%

Uses `requireOfficerTerm()` binary check for privileged access levels. Spec defines granular role matrix.

#### EF-M11-c9e0a1c2 — No consumed event handlers

- **File:** MISSING
- **Checks failed:** Domain terms
- **Severity:** P2
- **Spec Ref:** MODULE_SPEC 10b Consumed Events
- **Confidence:** 90%

No handlers for `PersonUpdated`, `MembershipStatusChanged`, `TrainingCompleted`, or `AccountDeletionProcessed`. Spec requires regenerating ID card on profile/status changes and making certificates available on training completion.

#### EF-M11-q7r8s9t0 — Inconsistent auth pattern across document handlers

- **File:** Multiple (documents/)
- **Checks failed:** Naming
- **Severity:** P2
- **Confidence:** 85%

Two auth patterns used:
1. `ctx.get('user'); if (!user) return ctx.json(...)` — createDocument, archiveDocument, getDocumentAccessLog
2. `ctx.get('session'); if (!session) throw new UnauthorizedError()` — deleteDocument, getDocumentTag, etc.

Different error response shapes for the same 401 scenario.

---

### P3

#### EF-M11-s5t6u7v8 — Missing access log side-effect in searchDocuments

- **File:** `documents/searchDocuments.ts`
- **Checks failed:** Data shape
- **Severity:** P3
- **Spec Ref:** API_CONTRACTS GET /orgs/:orgId/documents, M11-R5
- **Confidence:** 75%

Spec says "DocumentAccessLog entry created (action: view)" for list endpoint. Not implemented. May be intentional — listing vs viewing are different.

#### EF-M11-w9x0y1z2 — listDocumentVersions missing org-scope filter

- **File:** `documents/listDocumentVersions.ts`, `documents/getDocumentVersion.ts`
- **Checks failed:** Data shape
- **Severity:** P3
- **Spec Ref:** MODULE_SPEC Sec 6
- **Confidence:** 85%

Filters by `documentId` only, not `organizationId`. Cross-org version history visible with known document ID.

#### EF-M11-a3b4c5d6b — certificate-numbering.ts raw SQL with type casting

- **File:** `certificates/utils/certificate-numbering.ts`
- **Checks failed:** Naming
- **Severity:** P3
- **Confidence:** 80%

Uses `(existing as any).rows ?? existing` — `any` cast bypasses type safety. `FOR UPDATE` lock is correct.

#### EF-M11-e7f8g9h0 — Storage handlers use BaseContext instead of ValidatedContext

- **File:** `storage/*.ts` (all handlers)
- **Checks failed:** Naming
- **Severity:** P3
- **Confidence:** 80%

All storage handlers use `BaseContext` with manual `ctx.req.param()`. Documents handlers use `ValidatedContext<Body, Query, Params>` with `ctx.req.valid()`. Storage lacks compile-time type safety on request parameters.

#### EF-M11-b5d6f7b8 — getDocumentAccessLog meta-logs access (informational)

- **File:** `documents/getDocumentAccessLog.ts`
- **Severity:** P3 (informational)
- **Confidence:** 70%

Meta-logs the act of viewing access logs. Not in spec but good compliance practice.

---

## 3. Summary

### Finding Counts by Severity

| Severity | Count | Key Finding IDs |
|----------|-------|----------------|
| **P0** | 1 | EF-M11-e1f2a3b4 (PII leak) |
| **P1** | 7 | EF-M11-a1b2c3d4 (missing ID card), EF-M11-e5f6a7b8 (token vs number), EF-M11-a5b6c7d8 (no event), EF-M11-c3d4e5f6 (HTML not PDF), EF-M11-a7b8c9d0 (no event), EF-M11-e7f8a9b0 (multipart), EF-M11-i9j0k1l2 (org-scope) |
| **P2** | 13 | Error taxonomy, state machine, cross-context imports, missing schema entities, body overrides, no QR code |
| **P3** | 5 | Access log, org-scope, type safety |

### Per-Directory Health

| Directory | Files | Handlers | Tests | P0 | P1 | P2 | P3 |
|-----------|-------|----------|-------|----|----|----|----|
| documents/ | 32 | 12 | 14 | 0 | 4 | 6 | 2 |
| certificates/ | 22 | 6 | 10 | 1 | 3 | 5 | 1 |
| storage/ | 12 | 6 | 3 | 0 | 0 | 2 | 2 |

### 5-Check Matrix

| Check | documents/ | certificates/ | storage/ |
|-------|-----------|---------------|----------|
| Error taxonomy | WARN (ad-hoc codes) | OK | WARN (ad-hoc codes) |
| Domain terms | WARN (no events, wrong status) | FAIL (no QR, no HMAC) | OK |
| Data shape | WARN (missing entities) | FAIL (PII leak, body overrides) | OK |
| Naming | WARN (mixed auth patterns) | WARN (number vs token) | WARN (BaseContext) |
| Import boundaries | OK | WARN (cross-context) | OK |

### Recommended Fix Order

1. **P0 EF-M11-e1f2a3b4** — Remove/mask holderName from verifyCertificatePublic
2. **P1 EF-M11-i9j0k1l2** — Add org-scope to deleteDocumentTag/getDocumentTag
3. **P1 EF-M11-a5b6c7d8** — Emit DocumentUploaded event in createDocument
4. **P1 EF-M11-c3d4e5f6** — Add QR generation + PDF output to generateCertificatePdf
5. **P1 EF-M11-a1b2c3d4** — Implement GET /my/id-card handler (WF-071)
6. **P1 EF-M11-e5f6a7b8** — Switch to opaque HMAC token verification
7. **P2** items: state machine fixes, error taxonomy alignment, missing schema entities
8. **P3** items: org-scope filters, type safety, access logging


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
