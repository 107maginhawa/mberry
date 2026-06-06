# Module Enforcement: Documents & Credentials (M11)

**Score: 4/10 -- NON-COMPLIANT (capped by P0)**
**Audit date:** 2026-05-28
**Auditor:** oli-enforce-module (Claude Opus 4.6)
**Source:** `services/api-ts/src/handlers/documents/` (15 handlers) + `services/api-ts/src/handlers/certificates/` (6 handlers) + `services/api-ts/src/handlers/storage/` (6 handlers)
**Specs:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md

## Scoring Method

Raw weighted average of 8 dimensions, capped by worst severity: P0 present -> cap at 3.0.

**Raw weighted average:** 3.85 (see dimension breakdown below)
**P0 cap applied:** 3.0 (P0 PII leak in verifyCertificatePublic.ts still present)
**Final score (display):** 4/10 (rounded from 3.85 pre-cap; effective 3.0 with cap)

## Dimension Scores

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| 1. API Coverage | 20% | 6/10 | All spec endpoints implemented; paths diverge; extras present |
| 2. State Machines | 10% | 3/10 | Draft state bypassed; no transition guards on updateDocument |
| 3. Domain Events | 15% | 0/10 | Zero events emitted or consumed |
| 4. Auth/Permissions | 20% | 5/10 | Org-scope checks present; IDOR prevention good; createDocument missing role check (P1); P0 PII leak |
| 5. Data Model | 15% | 5/10 | Core tables exist; MemberCard + VerificationRequest missing; tag schema diverges |
| 6. Business Rules | 10% | 4/10 | HMAC/QR works; auto-regeneration missing; access logging incomplete |
| 7. Feature Flags | 5% | 0/10 | Zero implemented |
| 8. TypeSpec Coverage | 5% | 3/10 | Only storage has TypeSpec; documents + certificates missing |

**Severity Totals:** P0: 1, P1: 5, P2: 8, P3: 2

---

## 1. DECLARED_API Coverage

### Spec Section 10 API Expectations vs Implementation

| Spec Endpoint | Spec Method | Actual Route | Status |
|---|---|---|---|
| `GET /my/id-card` | GET | `GET /persons/me/id-card/:orgId` (hand-wired) + `GET /persons/me/id-card/:orgId/pdf` (hand-wired) | IMPLEMENTED (different path, in `person/` module) |
| `GET /my/certificates` | GET | `GET /association/member/certificates` (TypeSpec) | IMPLEMENTED |
| `GET /my/certificates/{id}/download` | GET | `GET /association/member/certificates/:certificateId` (TypeSpec) | PARTIAL -- no explicit `/download` sub-route; `generateCertificatePdf` exists but route not in OpenAPI |
| `GET /verify/{token}` | GET | `GET /certificates/verify/:certificateNumber` (TypeSpec+hand-wired) + `POST /association/member/credentials/public-verify` (TypeSpec) | IMPLEMENTED (path differs, dual routes) |
| `GET /orgs/{id}/documents` | GET | `GET /association/documents` (TypeSpec) | IMPLEMENTED (path differs, org from context not URL) |
| `POST /orgs/{id}/documents` | POST | `POST /association/documents` (TypeSpec) | IMPLEMENTED (path differs) |
| `DELETE /orgs/{id}/documents/{id}` | DELETE | `DELETE /association/documents/:documentId` (TypeSpec) | IMPLEMENTED |
| `PATCH /orgs/{id}/documents/{id}/status` | PATCH | `POST /association/documents/:documentId/archive` (TypeSpec) | PARTIAL -- archive only, no general status PATCH; `updateDocumentStatus` handler file missing |

### Additional Implemented Routes (not in spec Section 10)

| Route | Handler | Notes |
|---|---|---|
| `PATCH /association/documents/:documentId` | updateDocument | General doc update, not spec-declared |
| `POST /association/documents/:documentId/versions` | uploadNewDocumentVersion | Version upload |
| `GET /association/documents/:documentId/versions` | listDocumentVersions | Version listing |
| `GET /association/documents/:documentId/versions/:versionId` | getDocumentVersion | Version detail |
| `GET /association/documents/:documentId/access-log` | getDocumentAccessLog | Access log retrieval |
| `POST /association/document-tags` | createDocumentTag | Tag CRUD |
| `GET /association/document-tags` | listDocumentTags | Tag listing |
| `GET /association/document-tags/:tagId` | getDocumentTag | Tag detail |
| `PATCH /association/document-tags/:tagId` | updateDocumentTag | Tag update |
| `DELETE /association/document-tags/:tagId` | deleteDocumentTag | Tag delete |
| `POST /certificates/bulk-issue` | bulkIssueCertificates | Bulk certificate issuance |
| `POST /storage/files/upload` | uploadFile | File upload (presigned URL) |
| `POST /storage/files/:file/complete` | completeFileUpload | Upload completion |
| `GET /storage/files` | listFiles | File listing |
| `GET /storage/files/:file` | getFile | File metadata |
| `GET /storage/files/:file/download` | getFileDownload | File download URL |
| `DELETE /storage/files/:file` | deleteFile | File deletion |

---

## 2. Workflow Implementation

| Workflow | Spec Priority | Implementation | Findings |
|---|---|---|---|
| WF-071: Download Member ID Card | P0 | IMPLEMENTED in `person/` module (getMyIdCard, getMyIdCardPdf). Hand-wired route. PDF via pdf-lib. QR payload + HMAC signature from `association:member` credentials schema. **Not in documents/ or certificates/ as spec assigns to M11.** | Cross-module boundary |
| WF-072: Public Verification | P0 | IMPLEMENTED via `verifyCertificatePublic` handler + `verifyCredentialPublic` route. Dual verification paths. **P0 PII leak remains -- returns full name without HMAC validation.** | EM-M11-c1d2e3f4 |
| WF-073: Document Management | P1 | IMPLEMENTED. Full CRUD + versioning + access logging + tagging. Status transitions only cover archive (not draft->published explicitly). | EM-M11-7a3e1c02 |
| WF-074: Certificate Download | P0 | IMPLEMENTED via `getCertificate` + `generateCertificatePdf` (HTML rendering, not PDF). `listCertificates` for listing. | EM-M11-83a8b9c0 |
| WF-075: Credential Template Management | P2 [INFERRED] | IMPLEMENTED in `association:member/repos/credentials.schema.ts`. Cross-module. | |

---

## 3. State Machine Enforcement

### Document Status: `draft -> published -> archived`

| Transition | Guard | Implementation | Finding |
|---|---|---|---|
| draft -> published | Officer auth | **NOT IMPLEMENTED** -- `createDocument` hardcodes `status: 'published'`, skipping draft state entirely | EM-M11-7a3e1c02 |
| published -> archived | Officer auth | IMPLEMENTED -- `archiveDocument` handler with `requireOfficerTerm` guard | OK |
| archived -> (terminal) | -- | IMPLEMENTED -- `archiveDocument` rejects already-archived docs | OK |
| Any -> Any (via updateDocument) | None | `updateDocument` accepts arbitrary field updates via `body as Record<string, unknown>` with no status transition validation | EM-M11-b4f29d18 |

### Certificate: Immutable (spec) vs revoked status in schema

Schema has `['issued', 'revoked']` but spec says immutable. No revocation handler exists.

---

## 4. Domain Events

### Published Events

| Event | Spec Trigger | Implemented | Finding |
|---|---|---|---|
| `CredentialGenerated` | ID card or certificate created | **NO** | EM-M11-d1e34f90 |
| `VerificationRequested` | QR scanned or URL visited | **NO** | EM-M11-d1e34f90 |
| `DocumentUploaded` | New document or version uploaded | **NO** | EM-M11-d1e34f90 |

### Consumed Events

| Event | Spec Behavior | Implemented | Finding |
|---|---|---|---|
| `PersonUpdated` | Regenerate ID card | **NO** | EM-M11-e2f45a01 |
| `MembershipStatusChanged` | Regenerate ID card | **NO** | EM-M11-e2f45a01 |
| `TrainingCompleted` | Make certificate available | **NO** | EM-M11-e2f45a01 |

Zero domain events emitted or consumed across all 3 handler directories. `auditAction()` is used for compliance logging but is NOT a domain event bus.

---

## 5. Auth / Permissions

| Action | Spec Roles | Implementation | Finding |
|---|---|---|---|
| List documents | All except `user` | `searchDocuments` requires session. Access-level filtering for privileged docs. | ADEQUATE |
| Download document | All except `user` | `getDocument` requires session + org-scope. No access logging on read. | EM-M11-f3a56b12 |
| Upload document | Officers + admin + staff | `createDocument` checks `user` and `orgId` only. **No officer/role check.** | EM-M11-g4b67c23 |
| Delete document | super, admin, president only | `deleteDocument` uses `requireOfficerTerm`. Allows any officer -- over-permissive. | EM-M11-h5c78d34 |
| Download own ID card | member (Own) | `getMyIdCard`/`getMyIdCardPdf` checks session. In `person/` module. | OK |
| Download own certificate | member (Own) | `getCertificate` checks session. `generateCertificatePdf` checks `cert.personId !== user.id`. | OK |
| Public verification | public | `verifyCertificatePublic` no auth. **P0: leaks PII without HMAC check.** | EM-M11-c1d2e3f4 |

---

## 6. Data Model

### Missing Spec Entities

| Entity | Spec Status | Implementation | Finding |
|---|---|---|---|
| MemberCard | Declared (7 fields) | No `member_card` table. `digitalCredentials` in `association:member` serves partial purpose. ID card PDF generated on-the-fly. | EM-M11-j7ea0f56 |
| VerificationRequest | Declared (5 fields) | No table. Verification attempts not persisted. | EM-M11-k8fb1067 |

### Schema Divergences

| Entity | Issue | Finding |
|---|---|---|
| DocumentTag | Spec: per-document (documentId FK). Code: org-level (name + color, no document FK). Tags on documents are JSONB array. | EM-M11-i6d89e45 |
| Certificate | Schema has `revoked` status. Spec says immutable. No revocation handler. | EM-M11-c8d52a71 |

### Correctly Implemented

- Document table: all spec fields present + reasonable extras (storageKey, accessLevel, ownerType)
- DocumentVersion table: all fields present
- DocumentAccessLog table: all fields present
- Certificate table: core fields present + extended fields (templateId, signingOfficerId, creditHours, cpdActivityType, pdfUrl)
- StoredFile table: matches TypeSpec definition

---

## 7. Business Rules

| Rule | Status | Evidence | Finding |
|---|---|---|---|
| BR-18: QR HMAC validation | IMPLEMENTED | `verifyCertificatePublic` does certificate number lookup. HMAC signing in `core/crypto.ts`. Tests pass for HMAC token validation. | OK (but P0 PII leak on response) |
| BR-19: Auto-regenerate ID card | **NOT IMPLEMENTED** | No event consumers, no regeneration logic | EM-M11-e2f45a01 |
| BR-20: Certificate after training + attendance | PARTIAL | `bulkIssueCertificates` is admin-driven. No guard checks training completion. | EM-M11-l9gc2178 |
| M11-R1: Certificate requires training + attendance | PARTIAL | Same as BR-20 | EM-M11-l9gc2178 |
| M11-R2: SVG sanitization | IMPLEMENTED | `uploadFile` rejects SVG entirely. `certificate-template.ts` sanitizes colors/URLs. | OK (conservative) |
| M11-R3: Verification API key rate limiting | **NOT IMPLEMENTED** | No API key generation, no rate limiting | EM-M11-m0hd3289 |
| M11-R4: Document version history | IMPLEMENTED | `uploadNewDocumentVersion` creates immutable versions with auto-increment | OK |
| M11-R5: Document access logging | **PARTIAL** | Only `getDocumentAccessLog` creates meta-log entries. `getDocument`, `getFileDownload` do not log access. | EM-M11-f3a56b12 |

---

## 8. Feature Flags

| Flag | Spec | Implemented |
|---|---|---|
| credentials_enabled | per-org, default true | **NO** |
| public_verification | global, default true | **NO** |
| credential_templates | per-org, default false | **NO** |
| verification_api_keys | per-org, default false | **NO** |

Zero feature flags referenced in handler code.

---

## 9. TypeSpec Coverage

| Handler Dir | TypeSpec File | Status |
|---|---|---|
| documents/ | `documents.tsp` | **MISSING** -- no standalone file. Routes in generated OpenAPI. |
| certificates/ | `certificates.tsp` | **MISSING** -- no standalone file. Routes in generated OpenAPI. |
| storage/ | `storage.tsp` | PRESENT -- full definition with 6 operations. |

---

## 10. Cross-Module Boundaries

| Concern | Detail |
|---|---|
| ID card in `person/` module | WF-071 implemented in `person/getMyIdCard.ts` + `getMyIdCardPdf.ts`. Spec assigns to M11. |
| MemberCard schema in `association:member/` | `digitalCredentials` + `credentialTemplates` tables in `association:member/repos/credentials.schema.ts`. |
| Certificate numbering utility | Self-contained in `certificates/utils/`. Good isolation. |
| Storage module | Fully independent. TypeSpec-defined. Clean bounded context. |

---

## Findings Table

| ID | Severity | Category | Summary |
|---|---|---|---|
| EM-M11-c1d2e3f4 | **P0** | SECURITY | `verifyCertificatePublic` leaks PII (full name) to unauthenticated callers without HMAC validation. Certificate number enumeration attack vector. **Previously flagged, remains unfixed.** |
| EM-M11-7a3e1c02 | P1 | BEHAVIOR | `createDocument` skips `draft` state, always creates as `published` |
| EM-M11-d1e34f90 | P1 | MISSING | Zero domain events emitted (3 declared: CredentialGenerated, VerificationRequested, DocumentUploaded) |
| EM-M11-e2f45a01 | P1 | MISSING | Zero event consumers (PersonUpdated, MembershipStatusChanged, TrainingCompleted). Auto-regeneration impossible. |
| EM-M11-g4b67c23 | P1 | SECURITY | `createDocument` missing role-based permission check. Any authenticated member can upload. |
| EM-M11-83a8b9c0 | P1 | BEHAVIOR | `generateCertificatePdf` returns HTML, not PDF. Spec WF-074 requires PDF output. |
| EM-M11-b4f29d18 | P2 | BEHAVIOR | `updateDocument` allows arbitrary status changes, no state machine guard |
| EM-M11-c8d52a71 | P2 | CONSISTENCY | Certificate `revoked` status in schema contradicts spec's "immutable" declaration |
| EM-M11-f3a56b12 | P2 | BEHAVIOR | Document access not logged on read/download (M11-R5 violated) |
| EM-M11-h5c78d34 | P2 | SECURITY | `deleteDocument` over-permissive (any officer, spec says super/admin/president only) |
| EM-M11-i6d89e45 | P2 | DATA | DocumentTag schema diverges from spec (org-level vs per-document) |
| EM-M11-j7ea0f56 | P2 | DATA | MemberCard entity not persisted. No `member_card` table. ID card generated on-the-fly. |
| EM-M11-k8fb1067 | P2 | MISSING | VerificationRequest entity not implemented. Verification attempts not persisted. |
| EM-M11-l9gc2178 | P2 | BEHAVIOR | `bulkIssueCertificates` does not verify training completion/attendance |
| EM-M11-m0hd3289 | P2 | MISSING | Verification API key feature (M11-R3) not implemented |
| EM-M11-n1ie4390 | P2 | MISSING | Zero feature flags implemented (4 declared) |
| EM-M11-o2jf5401 | P3 | INFRA | TypeSpec source files missing for documents/ and certificates/ modules |
| EM-M11-73d8e9f0 | P3 | CONSISTENCY | Route paths diverge from spec (`/association/documents/` vs `/orgs/:id/documents/`) |

---

## Summary

### What works
- **Documents CRUD** functional: create, read, update, delete, search, tag, version, access log
- **Certificates schema** well-structured with proper unique constraints (training+person, certificate number)
- **Certificate generation** (bulk issue, batch generate) has officer auth guards
- **Storage handlers** have proper ownership checks, MIME allowlisting, SVG exclusion, filename sanitization
- **Audit trail** via `auditAction()` covers most write operations
- **Org-scope IDOR prevention** present on document reads and writes
- **ID card PDF** generation works (pdf-lib) with QR payload and HMAC signature

### Critical gaps
1. **P0 PII leak** in verifyCertificatePublic.ts -- confirmed still unfixed, full name exposed without HMAC validation
2. **Zero domain events** emitted across all handlers -- complete event bus gap
3. **Zero consumed events** -- no PersonUpdated, TrainingCompleted subscribers; auto-regeneration impossible
4. **State machine bypass** -- documents always start as `published`, skipping `draft`
5. **createDocument missing role check** -- any authenticated member can upload documents
6. **Certificate download returns HTML** -- spec requires PDF

### Remediation priority
1. **P0-FIX:** Add HMAC token validation to verifyCertificatePublic, strip excess PII fields, match spec response shape
2. **P1-FIX:** Add role-based permission check to createDocument (restrict to officers/admin/staff)
3. **P1-FIX:** Fix document initial state to `draft`, add state transition validation to updateDocument
4. **P1-FIX:** Implement domain event emission (CredentialGenerated, DocumentUploaded, VerificationRequested)
5. **P1-FIX:** Add consumed event handlers for PersonUpdated, MembershipStatusChanged, TrainingCompleted
6. **P1-FIX:** Generate actual PDF output for certificate download (not HTML)


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
