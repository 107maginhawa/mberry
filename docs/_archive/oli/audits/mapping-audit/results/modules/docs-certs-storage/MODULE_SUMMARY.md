# MODULE SUMMARY — Documents / Certificates / Storage
## Audit Date: 2026-05-26

---

## Module Confidence Score: 4/10

**Rationale**: Backend wiring is complete and basic auth guards (401/403 without session) are well-tested. However, role-based access control for document mutations is absent, the `accessLevel` filtering is not server-enforced, the certificate IDOR gap allows any member to fetch any other member's certificate, the PDF download endpoint returns HTML not binary PDF, and two certificate handlers have unconfirmed route registration. E2E coverage exists but tests presentation only, not data integrity or security boundaries.

---

## What Works Well

- All 15 document routes are TypeSpec-defined, OpenAPI-generated, and wired to handlers
- All 6 storage routes are wired with presigned URL flow and audit logging
- `bulkIssueCertificates` correctly uses `requirePosition([PRESIDENT, SECRETARY])`
- `generateCertificatePdf` correctly enforces IDOR protection (owner only)
- `listFiles` correctly scopes: admins see all, regular users see own files
- `getFileDownload` and `deleteFile` correctly check owner or admin
- Document access log tracking is implemented (meta-logging on access log views)
- MIME type allowlist enforced in `uploadFile.ts`
- Filename sanitization in `uploadFile.ts` (path traversal protection)
- Storage audit logging with HIPAA category tagging
- `verifyCertificatePublic` correctly public (no auth)
- Basic auth tests pass: 401/403 for session/orgId missing

---

## Critical Findings (P0)

| ID | Finding | File | Fix |
|----|---------|------|-----|
| P0-01 | `getDocument` no org-scope check — cross-org IDOR | `documents/getDocument.ts` | Add `if (document.organizationId !== orgId) throw new ForbiddenError()` |
| P0-02 | `getDocumentAccessLog` no officer restriction — any member can view audit trail | `documents/getDocumentAccessLog.ts` | Add `requirePosition(ctx, [PRESIDENT, SECRETARY, ADMIN])` |
| P0-03 | `completeFileUpload` no ownership check — any user can mark another's upload complete | `storage/completeFileUpload.ts` | Add `const user = ctx.get('user'); if (file.owner !== user.id && !isAdmin) throw ForbiddenError` |
| P0-04 | `searchDocuments` `accessLevel` is caller-controlled — members can request privileged docs | `documents/searchDocuments.ts` | Enforce max accessLevel based on user role server-side |

---

## Major Gaps (P1)

| ID | Finding | File | Fix |
|----|---------|------|-----|
| P1-01 | `deleteDocument`, `archiveDocument`, `updateDocument` no officer role check | documents/ | Add `requirePosition` for officer mutations |
| P1-02 | `getCertificate` no IDOR protection — member can fetch any cert by ID | `certificates/getCertificate.ts` | Add `if (cert.personId !== user.id && !isAdmin) throw ForbiddenError` |
| P1-03 | `batchGenerateCertificates` no position check (unlike `bulkIssueCertificates`) | `certificates/batchGenerateCertificates.ts` | Add `requirePosition([PRESIDENT, SECRETARY])` |
| P1-04 | `bulkIssueCertificates` uses `body.organizationId` not `ctx.get('organizationId')` | `certificates/bulkIssueCertificates.ts` | Replace with `ctx.get('organizationId')` |
| P1-05 | `generateCertificatePdf` returns HTML JSON, not binary PDF | `certificates/generateCertificatePdf.ts` | Implement actual PDF generation or change content-type/contract |
| P1-06 | `batchGenerateCertificates` and `generateCertificatePdf` route registration unconfirmed | app.ts | Verify routes registered; if not, add to TypeSpec or register manually |
| P1-07 | No frontend UI for bulk certificate issuance (officer action missing) | apps/memberry | Implement officer bulk-issue UI |
| P1-08 | File size limit inconsistency: frontend 25MB vs backend 50MB | document-library.tsx | Align to backend limit (50MB) in UI hint |

---

## Minor Gaps (P2)

| ID | Finding | Severity |
|----|---------|----------|
| P2-01 | Certificate card shows generic "Training Certificate" — training title not resolved | P2 |
| P2-02 | Certificate detail shows raw UUIDs for trainingId and organizationId | P2 |
| P2-03 | No frontend public certificate verification page (endpoint exists, no UI) | P2 |
| P2-04 | No admin UI for document or storage management | P2 |
| P2-05 | No E2E test for document upload, publish, archive, delete flows | P2 |
| P2-06 | `createDocumentTag`, `updateDocumentTag`, `deleteDocumentTag` missing officer restriction | P2 |
| P2-07 | Document upload form missing `accept` attribute (MIME types unenforced client-side) | P2 |
| P2-08 | `completeFileUpload` call after S3 PUT not confirmed wired in frontend | P2 |
| P2-09 | No E2E test for certificate PDF download or copy verification link | P2 |
| P2-10 | Contract tests for docs/certs/storage are minimal (happy path + 401 only) | P2 |

---

## Fix Priority Queue

**Immediate (block release):**
1. P0-01: Add org-scope check to `getDocument`
2. P0-02: Add officer restriction to `getDocumentAccessLog`
3. P0-03: Add ownership check to `completeFileUpload`
4. P0-04: Enforce server-side `accessLevel` based on role in `searchDocuments`

**Before officer features go live:**
5. P1-01: Add `requirePosition` to deleteDocument/archiveDocument/updateDocument
6. P1-02: Add IDOR protection to `getCertificate`
7. P1-03: Add `requirePosition` to `batchGenerateCertificates`
8. P1-04: Fix `bulkIssueCertificates` to use context org not body org

**Before certificate download ships:**
9. P1-05: Implement actual PDF binary response in `generateCertificatePdf`
10. P1-06: Confirm/add route registration for `batchGenerateCertificates` and `generateCertificatePdf`

---

## Files Audited

### Backend
- `services/api-ts/src/handlers/documents/` — 15 handlers + repos
- `services/api-ts/src/handlers/certificates/` — 6 handlers + repos + utils
- `services/api-ts/src/handlers/storage/` — 6 handlers + repos
- `services/api-ts/src/generated/openapi/routes.ts` — route registration
- `services/api-ts/src/app.ts` — app-level route wiring

### Frontend
- `apps/memberry/src/routes/_authenticated/my/certificates/` — 2 routes
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/documents/` — 2 routes
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/documents/` — officer docs
- `apps/memberry/src/features/documents/components/` — document-browser, document-library
- `apps/memberry/src/features/certificates/components/` — certificate-list, certificate-preview

### Tests
- `services/api-ts/src/handlers/documents/` — 18 test files
- `services/api-ts/src/handlers/certificates/` — 7 test files
- `services/api-ts/src/handlers/storage/` — 3 test files
- `apps/memberry/tests/e2e/member/certificates.spec.ts`
- `apps/memberry/tests/e2e/member/documents.spec.ts`
- `apps/memberry/tests/e2e/officer/documents.spec.ts`
- `specs/api/tests/contract/assoc-certificates-flow.hurl`
- `specs/api/tests/contract/assoc-documents-flow.hurl` (+ tags, storage, certificates variants)

### Spec
- `specs/api/src/association/core/documents.tsp`
- `specs/api/src/association/*/certificates.tsp`
