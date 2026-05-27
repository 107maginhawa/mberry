# 06 — Backend API Contract Alignment
## Module: Documents / Certificates / Storage

---

## TypeSpec → OpenAPI → Handler Alignment

### Documents

Source of truth: `specs/api/src/association/core/documents.tsp`

| TypeSpec Endpoint | OpenAPI Route | Handler | Aligned? | Notes |
|------------------|--------------|---------|----------|-------|
| POST `/association/documents` | Yes (line 246) | createDocument.ts | Yes | |
| GET `/association/documents` | Yes (line 253) | searchDocuments.ts | Yes | |
| GET `/association/documents/:documentId` | Yes (line 260) | getDocument.ts | Yes | |
| PATCH `/association/documents/:documentId` | Yes (line 267) | updateDocument.ts | Yes | |
| DELETE `/association/documents/:documentId` | Yes (line 275) | deleteDocument.ts | Yes | |
| GET `/association/documents/:documentId/access-log` | Yes (line 282) | getDocumentAccessLog.ts | Yes | |
| POST `/association/documents/:documentId/archive` | Yes (line 290) | archiveDocument.ts | Yes | |
| POST `/association/documents/:documentId/versions` | Yes (line 297) | uploadNewDocumentVersion.ts | Yes | |
| GET `/association/documents/:documentId/versions` | Yes (line 305) | listDocumentVersions.ts | Yes | |
| GET `/association/documents/:documentId/versions/:versionId` | Yes (line 313) | getDocumentVersion.ts | Yes | |
| POST `/association/document-tags` | Yes (line 210) | createDocumentTag.ts | Yes | |
| GET `/association/document-tags` | Yes (line 217) | listDocumentTags.ts | Yes | |
| GET `/association/document-tags/:tagId` | Yes (line 224) | getDocumentTag.ts | Yes | |
| PATCH `/association/document-tags/:tagId` | Yes (line 231) | updateDocumentTag.ts | Yes | |
| DELETE `/association/document-tags/:tagId` | Yes (line 239) | deleteDocumentTag.ts | Yes | |

**Document coverage: 15/15 handlers wired. Fully aligned.**

### Contract Misalignments

**P1 — `getDocument` missing org-scope enforcement**
- TypeSpec intent: documents scoped to `organizationId`
- Handler: queries by `documentId` only, no org check
- Risk: Cross-org IDOR

**P1 — `searchDocuments` `accessLevel` filter is caller-controlled**
- TypeSpec defines `accessLevel` as a document property
- Handler: `accessLevel: query.accessLevel` — client controls which levels are returned
- Expected: Server enforces role-based max access level

**P1 — `deleteDocument`, `archiveDocument`, `updateDocument` missing RBAC**
- M11 spec / API contract requires `president/admin/super` for delete/archive
- Handlers: check session only

**P0 — `getDocumentAccessLog` spec requires officer access**
- API contract: officer-only endpoint
- Handler: any authenticated user

---

### Certificates

Source of truth: `specs/api/src/association/` (certificates TypeSpec)

| TypeSpec Endpoint | OpenAPI Route | Handler | Aligned? | Notes |
|------------------|--------------|---------|----------|-------|
| GET `/association/member/certificates` | Yes (line 650) | listCertificates.ts | Yes | |
| GET `/association/member/certificates/:certificateId` | Yes (line 657) | getCertificate.ts | Partial | Missing IDOR guard |
| POST `/certificates/bulk-issue` | app.ts line 308 | bulkIssueCertificates.ts | Partial | org from body, not context |
| GET `/certificates/verify/:certificateNumber` | app.ts line 194 | verifyCertificatePublic.ts | Yes | Public by design |
| POST batch generate | Not found in generated routes | batchGenerateCertificates.ts | Unknown | Route registration unconfirmed |
| POST generate PDF | Not found in generated routes | generateCertificatePdf.ts | Unknown | Route registration unconfirmed |
| GET `/my/certificates/:id/download` | **Missing from OpenAPI** | No handler | Gap | Spec M11 requires binary PDF download |

**Certificate contract gaps:**
- `batchGenerateCertificates` and `generateCertificatePdf` routes not found in `services/api-ts/src/generated/openapi/routes.ts` — either dark routes or not yet TypeSpec-defined
- M11 spec `GET /my/certificates/:certificateId/download` binary PDF endpoint has no matching handler
- `generateCertificatePdf` returns HTML (`text/html`), not binary PDF — spec requires `application/pdf`

---

### Storage

Source of truth: TypeSpec (storage.tsp assumed)

| OpenAPI Route | Handler | Aligned? | Notes |
|--------------|---------|----------|-------|
| GET `/storage/files` | listFiles.ts | Yes | |
| POST `/storage/files/upload` | uploadFile.ts | Yes | |
| GET `/storage/files/:file` | getFile.ts | Yes | |
| DELETE `/storage/files/:file` | deleteFile.ts | Yes | |
| POST `/storage/files/:file/complete` | completeFileUpload.ts | Yes | |
| GET `/storage/files/:file/download` | getFileDownload.ts | Yes | |

**Storage coverage: 6/6 routes wired.**

**P2 — File size limit inconsistency:**
- Frontend UI: "up to 25MB"
- Backend `uploadFile.ts`: `MAX_FILE_SIZE = 50 * 1024 * 1024` (50MB)
- Contract should define one canonical limit

**P2 — MIME type allowlist:**
- `uploadFile.ts` has MIME type validation (allowlist set)
- Frontend form has no `accept` attribute enforcing same types
- User could attempt disallowed types before server rejects

---

## Contract Test Coverage

### Hurl Test Files (found in `specs/api/tests/contract/`)

| File | Coverage |
|------|---------|
| `assoc-certificates-flow.hurl` | List certs (auth + 401), GET by fake ID (404) |
| `assoc-document-tags-flow.hurl` | Document tags CRUD |
| `assoc-documents-flow.hurl` | Documents CRUD |
| `assoc-org-profile-flow.hurl` | Org profile (not docs) |
| `certificates-flow.hurl` | Certificates flow |
| `storage-edge.hurl` | Storage edge cases |
| `storage.hurl` | Storage happy path |

**Contract test gaps:**
- `assoc-certificates-flow.hurl` content is minimal: list + 404 + 401. No create/update/delete/bulk scenarios
- No contract test for `getDocumentAccessLog` officer restriction
- No contract test for `batchGenerateCertificates` or `generateCertificatePdf`
- No cross-org IDOR test for `getDocument`
- No `accessLevel` filtering enforcement test in `searchDocuments`
