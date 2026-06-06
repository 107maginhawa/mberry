# 08 — Test Confidence Gap
## Module: Documents / Certificates / Storage

---

## Backend Unit Tests

### Documents (`services/api-ts/src/handlers/documents/`)

| Test File | What It Tests | Coverage Quality |
|-----------|--------------|-----------------|
| `documents.test.ts` | Auth guards for all CRUD ops (401/403 without session/orgId) | Good — 8 auth scenarios |
| `documents-handlers.test.ts` | createDocument, updateDocument, deleteDocument, archiveDocument, listVersions, uploadVersion, searchDocuments happy paths | Good — 20+ cases |
| `createDocument.test.ts` | createDocument happy path + validation | OK |
| `updateDocument.test.ts` | updateDocument session + not-found | OK |
| `deleteDocument.test.ts` | deleteDocument session guard | OK |
| `archiveDocument.test.ts` | archiveDocument auth + already-archived | OK |
| `createDocumentTag.test.ts` | tag create with auth | OK |
| `deleteDocumentTag.test.ts` | tag delete auth | OK |
| `getDocument.test.ts` | getDocument session guard | Minimal |
| `getDocumentAccessLog.test.ts` | Access log pagination | Partial |
| `getDocumentTag.test.ts` | Tag get | Minimal |
| `getDocumentVersion.test.ts` | Version get | Minimal |
| `listDocumentTags.test.ts` | Tag list | Minimal |
| `listDocumentVersions.test.ts` | Version list | Minimal |
| `searchDocuments.test.ts` | Search with session | Minimal |
| `uploadNewDocumentVersion.test.ts` | Version upload auth | OK |
| `docs/repos/documents.repo.test.ts` | Repository CRUD | Good |
| `ac-m11.documents.test.ts` | Module-level acceptance tests | Good |
| `slice-023-documents-credentials.test.ts` | Slice test for docs + creds | Present |

**Critical test gaps:**
- No test for cross-org IDOR on `getDocument` (fetch doc from different org)
- No test for `accessLevel` filtering enforcement on `searchDocuments` (privileged docs should not be returned to members)
- No test verifying only officers can `deleteDocument`, `archiveDocument`, or `updateDocument`
- No test for `getDocumentAccessLog` officer-only restriction
- `getDocumentAccessLog` tests cover pagination but not auth restriction

### Certificates (`services/api-ts/src/handlers/certificates/`)

| Test File | What It Tests | Coverage Quality |
|-----------|--------------|-----------------|
| `listCertificates.test.ts` | List by session user | OK |
| `getCertificate.test.ts` | Get by ID | Minimal — no IDOR test |
| `batchGenerateCertificates.test.ts` | Batch generate happy path | Partial |
| `bulkIssueCertificates.test.ts` | Bulk issue with position check? | Unclear |
| `generateCertificatePdf.test.ts` | PDF generation | OK |
| `verifyCertificatePublic.test.ts` | Public verify | OK |
| `flow-09.certificate-retrieval.test.ts` | End-to-end flow | Present |
| `repos/certificates.repo.test.ts` | Repo CRUD | Good |

**Critical test gaps:**
- No test for `getCertificate` IDOR — any user fetching another user's certificate
- No test confirming `batchGenerateCertificates` is officer-restricted
- No test for `bulkIssueCertificates` with non-officer (should 403)
- No test for `bulkIssueCertificates` cross-org: body.organizationId != ctx organizationId
- `generateCertificatePdf` returns HTML — no test verifying it should return binary PDF

### Storage (`services/api-ts/src/handlers/storage/`)

| Test File | What It Tests | Coverage Quality |
|-----------|--------------|-----------------|
| `storage-handlers.test.ts` | Handler suite | Present |
| `uploadFile.test.ts` | Upload initiation | Present |
| `br-31.svg-upload-security.test.ts` | SVG upload security (XSS in SVG) | Good — targeted security test |

**Critical test gaps:**
- No test for `completeFileUpload` ownership check (anyone can complete another user's upload)
- No test for `completeFileUpload` without authenticated user
- No test for `listFiles` admin vs. regular user scoping
- No test for `deleteFile` cross-user access (should be owner-only or admin)

---

## E2E Tests

| Test File | Path | What It Tests |
|-----------|------|--------------|
| `member/certificates.spec.ts` | `/my/certificates` | Page renders, heading visible, can click through |
| `member/documents.spec.ts` | `/org/:orgId/documents` | Heading visible, category nav, member sees only published, click-through |
| `officer/documents.spec.ts` | `/org/:orgId/officer/documents` | Heading, categories, upload button visible, status badges, search |

**E2E coverage gaps:**
- No E2E test for certificate PDF download action
- No E2E test for document create (upload form submission end-to-end)
- No E2E test for document publish/archive/delete
- No E2E test for bulk certificate issuance
- No E2E test for storage file operations
- No E2E test for certificate verification (public endpoint)
- No E2E test confirming member CANNOT access officer document routes
- No E2E test confirming member CANNOT see restricted/privileged documents
- `member/documents.spec.ts` test "member sees only published documents" is a frontend-only check (checks no `draft` badge) — does not verify API-level filtering

---

## Contract Tests (Hurl)

| File | Scenarios Covered | Gaps |
|------|------------------|------|
| `assoc-certificates-flow.hurl` | List certs (auth), GET by fake ID (404), 401 without cookie | No create, bulk issue, verify |
| `assoc-document-tags-flow.hurl` | Tags CRUD | OK for basic flow |
| `assoc-documents-flow.hurl` | Documents CRUD | Need details |
| `storage.hurl` | Storage happy path | Need details |
| `storage-edge.hurl` | Storage edge cases (SVG, large file?) | Need details |
| `certificates-flow.hurl` | Certs flow | Need details |

**No contract test for:**
- Cross-org IDOR on document GET
- `getDocumentAccessLog` without officer role → expect 403
- `searchDocuments` with `accessLevel=privileged` as member → expect filtered results
- `batchGenerateCertificates` without officer position → expect 403
- `completeFileUpload` by non-owner → expect 403

---

## Confidence Scores by Area

| Area | Test Depth | Auth Coverage | Integration | Overall Confidence |
|------|-----------|--------------|------------|-------------------|
| Document CRUD (auth) | High | Medium — session only, no role | Medium | 6/10 |
| Document access control (accessLevel) | Low | Very Low — not tested | Low | 2/10 |
| Document RBAC (officer mutations) | None | None | None | 1/10 |
| Certificate list/view | Medium | Low (no IDOR test) | Medium | 4/10 |
| Certificate bulk issue | Medium | Medium (requirePosition tested) | Low | 5/10 |
| Certificate PDF download | Low | Medium | None | 2/10 |
| Storage upload flow | Medium | Medium | Medium | 5/10 |
| Storage ownership enforcement | Low | Low | None | 3/10 |
| E2E coverage overall | Low | None | Low | 2/10 |

**Module overall confidence: 3.5/10**

Core auth (401/403 without session) is well-tested. Role-based restrictions, accessLevel enforcement, cross-org isolation, and PDF download are undertested or broken.
