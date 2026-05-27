# 03 — Route & Navigation Audit
## Module: Documents / Certificates / Storage

---

## Backend Route Inventory

### Documents Routes (via generated OpenAPI — `services/api-ts/src/generated/openapi/routes.ts`)

| Method | Path | OperationId | Handler |
|--------|------|-------------|---------|
| POST | `/association/document-tags` | createDocumentTag | createDocumentTag.ts |
| GET | `/association/document-tags` | listDocumentTags | listDocumentTags.ts |
| GET | `/association/document-tags/:tagId` | getDocumentTag | getDocumentTag.ts |
| PATCH | `/association/document-tags/:tagId` | updateDocumentTag | updateDocumentTag.ts |
| DELETE | `/association/document-tags/:tagId` | deleteDocumentTag | deleteDocumentTag.ts |
| POST | `/association/documents` | createDocument | createDocument.ts |
| GET | `/association/documents` | searchDocuments | searchDocuments.ts |
| GET | `/association/documents/:documentId` | getDocument | getDocument.ts |
| PATCH | `/association/documents/:documentId` | updateDocument | updateDocument.ts |
| DELETE | `/association/documents/:documentId` | deleteDocument | deleteDocument.ts |
| GET | `/association/documents/:documentId/access-log` | getDocumentAccessLog | getDocumentAccessLog.ts |
| POST | `/association/documents/:documentId/archive` | archiveDocument | archiveDocument.ts |
| POST | `/association/documents/:documentId/versions` | uploadNewDocumentVersion | uploadNewDocumentVersion.ts |
| GET | `/association/documents/:documentId/versions` | listDocumentVersions | listDocumentVersions.ts |
| GET | `/association/documents/:documentId/versions/:versionId` | getDocumentVersion | getDocumentVersion.ts |

### Certificates Routes

| Method | Path | OperationId | Handler | Auth |
|--------|------|-------------|---------|------|
| GET | `/association/member/certificates` | listCertificates | listCertificates.ts | authMiddleware |
| GET | `/association/member/certificates/:certificateId` | getCertificate | getCertificate.ts | authMiddleware |
| POST | `/certificates/bulk-issue` | bulkIssueCertificates | bulkIssueCertificates.ts | authMiddleware + orgContextMiddleware + requirePosition |
| GET | `/certificates/verify/:certificateNumber` | verifyCertificatePublic | verifyCertificatePublic.ts | **Public** |
| POST | `/association/documents/:documentId/versions` (reused) | batchGenerateCertificates | batchGenerateCertificates.ts | authMiddleware |
| POST | `generateCertificatePdf` | generateCertificatePdf | generateCertificatePdf.ts | authMiddleware |

**Note**: `batchGenerateCertificates` and `generateCertificatePdf` route registration not found in `app.ts` grep — likely registered via generated OpenAPI routes or missing from app. Needs verification.

### Storage Routes (generated OpenAPI)

| Method | Path | OperationId | Handler |
|--------|------|-------------|---------|
| GET | `/storage/files` | listFiles | listFiles.ts (inside completeFileUpload.ts) |
| POST | `/storage/files/upload` | uploadFile | uploadFile.ts (inside completeFileUpload.ts) |
| GET | `/storage/files/:file` | getFile | getFile.ts (inside completeFileUpload.ts) |
| DELETE | `/storage/files/:file` | deleteFile | deleteFile.ts (inside completeFileUpload.ts) |
| POST | `/storage/files/:file/complete` | completeFileUpload | completeFileUpload.ts |
| GET | `/storage/files/:file/download` | getFileDownload | getFileDownload.ts (inside completeFileUpload.ts) |

All `/storage/*` routes pass through `authMiddleware()` via the blanket prefix guard in `app.ts` line 255.

---

## Frontend Route Inventory

### Memberry App (`apps/memberry/src/routes/`)

#### Member-facing routes

| Route File | URL Pattern | Component | Notes |
|-----------|-------------|-----------|-------|
| `_authenticated/my/certificates/index.tsx` | `/my/certificates` | `MyCertificates` → `CertificateList` | Members only, own certs |
| `_authenticated/my/certificates/$certificateId.tsx` | `/my/certificates/:certificateId` | `CertificateDetail` → `CertificatePreview` | Members only |
| `_authenticated/org/$orgSlug/documents/index.tsx` | `/org/:orgSlug/documents` | Document browser | Member read-only view |
| `_authenticated/org/$orgSlug/documents/$documentId.tsx` | `/org/:orgSlug/documents/:documentId` | Document detail | Member read-only |

#### Officer-facing routes

| Route File | URL Pattern | Notes |
|-----------|-------------|-------|
| `_authenticated/org/$orgSlug/officer/documents` (directory) | `/org/:orgSlug/officer/documents` | Officer document management — DocumentLibrary component |

**No storage/file management frontend routes found.** Storage is an internal backend service only — no direct upload UI routes in memberry outside of document upload within the document library.

**No admin app routes for documents, certificates, or storage.** Admin app (`apps/admin/src/routes/`) has no document/certificate/storage management pages.

---

## Navigation Gaps

| Gap | Description | Severity |
|-----|-------------|----------|
| No admin UI for documents | Admin app cannot view/manage org documents | P2 |
| No frontend storage file browser | No UI for viewing uploaded files outside of document context | P2 |
| Certificate download action missing from frontend | `CertificatePreview` has Download PDF button in UI but calls `generateCertificatePdf` — the actual PDF binary download endpoint (`GET /my/certificates/:id/download` from spec) has no matching route in generated OpenAPI routes | P1 |
| Officer document route path mismatch | Frontend uses `/org/:orgSlug/officer/documents` but backend uses `/association/documents` (no org slug in path) — routing bridge is via `orgId` header | P3 |
| No route for `verifyCertificatePublic` in frontend | Public verification endpoint exists at `/certificates/verify/:certificateNumber` but no frontend UI route surfaces it | P2 |
| `batchGenerateCertificates` not wired in app.ts | Handler exists but route registration in `app.ts` not confirmed | P1 |
