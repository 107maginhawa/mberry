# Module Specification: Documents & Credentials (M11)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Generate, manage, and verify digital credentials — member ID cards, training certificates, and official documents. Provides HMAC-signed QR codes for tamper-proof offline verification and a public verification API.

### Users
- **Member** — downloads ID card, downloads certificates, views documents
- **Officer (Secretary/President)** — uploads/manages org documents, manages credential templates
- **Public** — scans QR code or visits verification URL to verify credentials
- **Platform Administrator** — manages platform-level branding and template defaults

### Related Modules
- **M02 (Member Profile)** — upstream: profile changes trigger ID card regeneration
- **M05 (Membership)** — upstream: membership status changes trigger ID card regeneration
- **M09 (Training)** — upstream: training completion triggers certificate availability
- **M10 (Credit Tracking)** — upstream: credit data appears on certificates
- **Storage handlers** — downstream: S3/MinIO file storage for uploads

### In Scope
- Member ID Card (digital + PDF) with HMAC-signed QR
- Training certificates (PDF with QR), certificate availability rules
- Public verification page, member verification API
- Platform branding on documents, organization logo handling
- Document management (upload, version, tag, access log)
- SVG sanitization for logos
- Credential template management

### Out of Scope
- Training management (M09)
- Credit tracking (M10)
- Real-time membership status lookup (verification proves authenticity at generation time only)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|------------|
| **Member ID Card** | Generated PDF credential with name, photo, org, membership status, and QR code. |
| **QR Code** | HMAC-signed code in member cards and certificates. Verifies authenticity (data not tampered). Does NOT verify real-time status — offline scans prove authenticity only. |
| **Certificate** | Generated PDF certifying completion of a Training activity. Includes credits earned and QR code. |
| **License Number** | Professional regulatory license identifier (e.g., PRC license). Used for cross-org matching and verification. |
| **Credential Template** | Configurable design template for digital credentials (ID cards, certificates). |
| **Document** | Uploaded file (PDF, image, etc.) associated with an organization, with version history and access logging. |
| **HMAC** | Hash-based Message Authentication Code. Used for QR code signing. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-071: Download Member ID Card | Member | PDF with QR, auto-regenerated on profile change | P0 |
| WF-072: Public Verification | Public | Scan QR code, verify membership/credential status | P0 |
| WF-073: Document Management | Officer | Upload, publish, archive org documents | P1 |
| WF-074: Certificate Download | Member | Download training certificates | P0 |
| WF-075: Credential Template Management | Officer/Admin | Design digital credential templates | P2 |

## 4. Workflow Details

### Workflow: Download Member ID Card (WF-071)

**Actor:** Member
**Preconditions:** Authenticated, active membership in at least one org
**Steps:**
1. Opens `/my/id-card`.
2. Selects org (if multi-org).
3. Views card preview: photo, name, license number, org, status, expiry, QR.
4. Downloads PDF (credit card size, landscape).
**Alternate Flows:** If member has no photo, use default avatar. If membership expired, card shows expired status.
**Exception Flows:** If no active membership in any org, show empty state: "No active membership found."
**Postconditions:** PDF downloaded with HMAC-signed QR code.

### Workflow: Public Verification (WF-072)

**Actor:** Public (anyone with QR/link)
**Preconditions:** None (public endpoint)
**Steps:**
1. Scans QR or opens verification URL (`memberry.com/verify/[token]`).
2. HMAC signature validated server-side.
3. Page shows: name, license number, org, status at generation date.
4. Invalid token: "This document could not be verified."
**Alternate Flows:** Expired token — show "This credential was valid when issued but may not reflect current status."
**Exception Flows:** Tampered token — HMAC mismatch — "This document could not be verified."
**Postconditions:** VerificationRequested event logged.

### Workflow: Document Management (WF-073)

**Actor:** Officer (Secretary, President)
**Preconditions:** Authenticated, officer role in org
**Steps:**
1. Opens `/org/[id]/documents`.
2. Uploads document (file + title + tags).
3. Document created in draft status.
4. Publishes document — visible to all org members.
5. Can archive published documents.
**Alternate Flows:** Upload new version of existing document — creates new DocumentVersion, preserves history.
**Exception Flows:** File too large or unsupported type — validation error.
**Postconditions:** Document stored with version history and access logging enabled.

### Workflow: Certificate Download (WF-074)

**Actor:** Member
**Preconditions:** Authenticated, training completed, attendance confirmed
**Steps:**
1. Opens `/my/certificates` or navigates from training detail.
2. Views list of available certificates.
3. Downloads certificate PDF (includes credits earned, QR code, org branding).
**Exception Flows:** Training not completed — certificate not available. "Complete the training to receive your certificate."
**Postconditions:** Certificate PDF downloaded, CredentialGenerated event logged.

### Workflow: Credential Template Management (WF-075)

**Actor:** Officer or Platform Admin
**Preconditions:** Authenticated, admin or officer role
**Steps:**
1. Opens credential template designer.
2. Configures layout: logo, colors, fields, QR placement.
3. Uploads org logo (SVG sanitized).
4. Saves template. Applied to future ID cards and certificates.
**Exception Flows:** SVG with embedded scripts — sanitized (scripts, event handlers, external refs stripped).
**Postconditions:** CredentialTemplate saved, future credentials use new template.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-18 | IF QR scanned THEN validate HMAC signature | Verification | Proves authenticity, not real-time status |
| BR-19 | IF profile/status changes THEN regenerate ID card | ID card | Auto-regeneration on PersonUpdated or MembershipStatusChanged |
| BR-20 | IF training completed + attendance confirmed THEN certificate available | Certificate | No certificate for non-attendees |
| M11-R1 | IF certificate requested THEN training must be completed + member attended | Certificate availability | No certificate for non-attendees |
| M11-R2 | IF SVG logo uploaded THEN full sanitization | Logo handling | Strip scripts, event handlers, external refs |
| M11-R3 | IF verification API key generated THEN track usage and rate limit | API | Per-key rate limiting |
| M11-R4 | IF document uploaded THEN version history maintained | Documents | Immutable versions |
| M11-R5 | IF document accessed (view/download) THEN access log entry created | Access logging | Audit trail for all document access |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List documents | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member | user | GA auth |
| Download document | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member | user | GA auth |
| Upload document | super, admin, president, VP, secretary, officer, staff | member, user, support, treasurer, board-member | GA+HG auth |
| Delete document | super, admin, president | All others | GA+HG auth |
| Download own ID card | member (Own) | user | GA auth |
| Download own certificate | member (Own) | user | GA auth |
| Public verification | public | — | No auth required |

## 7. Data Requirements

### Entity: Document

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| organizationId | Yes | Org FK | References organization |
| title | Yes | Document name | Non-empty string |
| status | Yes | Document status | Enum: draft, published, archived |
| fileUrl | Yes | Storage URL | S3/MinIO path |
| uploadedBy | Yes | Person FK | References person |
| mimeType | Yes | File MIME type | Validated on upload |
| fileSize | Yes | File size in bytes | — |
| createdAt | Yes | Upload timestamp | Auto-generated |
| updatedAt | Yes | Last modified | Auto-updated |

### Entity: DocumentVersion

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| documentId | Yes | Parent document FK | References document |
| versionNumber | Yes | Sequential version | Auto-incremented |
| fileUrl | Yes | Storage URL for this version | S3/MinIO path |
| uploadedBy | Yes | Person FK | References person |
| createdAt | Yes | Version timestamp | Auto-generated |

### Entity: DocumentTag

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| documentId | Yes | Parent document FK | References document |
| tag | Yes | Tag value | Non-empty string |

### Entity: DocumentAccessLog

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| documentId | Yes | Document FK | References document |
| personId | Yes | Accessor FK | References person |
| action | Yes | Access type | Enum: view, download |
| accessedAt | Yes | Timestamp | Auto-generated |

### Entity: Certificate

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| personId | Yes | Member FK | References person |
| trainingId | Yes | Training FK | References training |
| certificateNumber | Yes | Unique certificate number | Generated, unique |
| creditsEarned | Yes | Credits on certificate | From training |
| fileUrl | No | Generated PDF URL | Populated on first download |
| qrPayload | Yes | HMAC-signed QR data | — |
| createdAt | Yes | Generation timestamp | Auto-generated |

### Entity: MemberCard

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| personId | Yes | Member FK | References person |
| organizationId | Yes | Org FK | References organization |
| status | Yes | Membership status at generation | Snapshot |
| expiryDate | No | Membership expiry at generation | Snapshot |
| fileUrl | Yes | Generated PDF URL | S3/MinIO path |
| qrPayload | Yes | HMAC-signed QR data | — |
| generatedAt | Yes | Generation timestamp | Auto-generated |

### Entity: VerificationRequest

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| token | Yes | QR/URL token | — |
| valid | Yes | Whether verification passed | Boolean |
| requestedAt | Yes | Timestamp | Auto-generated |
| ipAddress | No | Requester IP | For rate limiting |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Document | DocumentVersion, DocumentTag, DocumentAccessLog | — | Version history immutable. |
| Certificate | — | — | One per person per training. Certificate number unique. |
| MemberCard | — | QRPayload | Regenerated on profile/status change. One active card per person per org. |

## 8. State Transitions

### Document Status

```
draft ──► published ──► archived
```

| From | Allowed Targets | Guard |
|------|----------------|-------|
| draft | published | Officer auth |
| published | archived | Officer auth |
| archived | _(none — terminal)_ | — |

### Certificate (no state machine — generated once, immutable)

Certificates are generated on training completion and are immutable. No state transitions.

### MemberCard (no explicit state machine — regenerated)

Member cards are regenerated (replaced) when profile or status changes. The old card is superseded, not transitioned.

## 9. UI/UX Requirements

### Screen: My ID Card (/my/id-card)

**Purpose:** Member views and downloads their digital ID card
**Users:** Member
**Components:** Card preview (photo, name, license, org, status, expiry, QR), org selector (multi-org), download PDF button
**States:**
- Loading: Skeleton card preview
- Empty: "No active membership found. Join an organization to get your ID card."
- Success: Card preview with download button
- PermissionError: N/A (all members can view own)
- UnexpectedError: "Unable to generate your ID card. Please try again."

### Screen: My Certificates (/my/certificates)

**Purpose:** Member views and downloads training certificates
**Users:** Member
**Components:** Certificate list (training name, date, credits, download button)
**States:**
- Loading: Skeleton list
- Empty: "No certificates yet. Complete a training to earn your certificate."
- Success: Certificate list with download buttons
- UnexpectedError: "Unable to load certificates."

### Screen: Verification Page (memberry.com/verify/[token])

**Purpose:** Public verification of credential authenticity
**Users:** Public (no auth)
**Components:** Verification result (name, license, org, status, generation date), valid/invalid indicator
**States:**
- Loading: "Verifying..."
- Success (valid): Green checkmark, credential details displayed
- Success (invalid): Red X, "This document could not be verified."
- UnexpectedError: "Verification service unavailable. Please try again."

### Screen: Org Documents (/org/[id]/documents)

**Purpose:** Officer manages org documents
**Users:** Officer, President, Secretary
**Components:** Document list (title, status, tags, actions), upload form, version history drawer
**States:**
- Loading: Skeleton table
- Empty: "No documents yet. Upload your first document."
- Success: Document table with actions
- ValidationError: Inline errors on upload form
- PermissionError: "You don't have permission to manage documents."
- UnexpectedError: "Unable to load documents."

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /my/id-card | Download ID card PDF | orgId (optional) | PDF file | 401, 404 |
| GET /my/certificates | List available certificates | — | Certificate[] | 401 |
| GET /my/certificates/{id}/download | Download certificate PDF | certificateId | PDF file | 401, 404 |
| GET /verify/{token} | Public verification | token | VerificationResult | 404 |
| GET /orgs/{id}/documents | List org documents | orgId, filters | Document[] | 401, 403 |
| POST /orgs/{id}/documents | Upload document | file, title, tags | Document | 400, 401, 403 |
| DELETE /orgs/{id}/documents/{id} | Delete document | documentId | — | 401, 403, 404 |
| PATCH /orgs/{id}/documents/{id}/status | Update document status | status | Document | 400, 401, 403 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CredentialGenerated | ID card or certificate created | personId, type (card/certificate), documentId | Audit |
| VerificationRequested | QR scanned or URL visited | token, valid, timestamp | Audit |
| DocumentUploaded | New document or version uploaded | documentId, orgId, uploadedBy | Audit |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PersonUpdated | M02 (Member Profile) | Regenerate ID card | Card re-created with new data |
| MembershipStatusChanged | M05 (Membership) | Regenerate ID card | Status updated on card |
| TrainingCompleted | M09 (Training) | Make certificate available | Certificate record created, downloadable |
| AccountDeletionProcessed | M02 (Person) | Revoke active credentials | Cards and certificates invalidated |

## 11. Acceptance Criteria

### AC-M11-001: QR Authenticity
**Given** a member downloads their ID card
**When** the QR code is scanned
**Then** HMAC validation confirms the data has not been tampered with.

### AC-M11-002: Certificate Availability
**Given** a member completes a training with confirmed attendance
**When** the member opens `/my/certificates`
**Then** a certificate for that training is available for download.

### AC-M11-003: SVG Sanitization
**Given** an officer uploads an SVG logo containing `<script>` tags
**When** the upload is processed
**Then** all script tags, event handlers, and external references are stripped.

### AC-M11-004: Auto-Regeneration
**Given** a member's profile name changes
**When** PersonUpdated event is received
**Then** the member's ID card is regenerated with the new name.

### AC-M11-005: Document Access Logging
**Given** a member downloads an org document
**When** the download completes
**Then** a DocumentAccessLog entry is created with personId, documentId, action=download.

### AC-M11-006: Version History
**Given** an officer uploads a new version of a document
**When** the upload succeeds
**Then** the previous version is preserved and a new DocumentVersion is created.

## 12. Test Expectations

Required test categories:
- **Unit:** QR HMAC sign/verify/tamper detection, SVG sanitization (script removal, event handler removal, external ref removal)
- **Integration:** ID card generation + PDF output, certificate generation with unique number, auto-regeneration on PersonUpdated event, document upload with version history, access log creation
- **Contract:** GET /verify/{token} valid/invalid/tampered, POST /orgs/{id}/documents validation
- **E2E:** Member downloads ID card, scans QR, verification page shows valid; officer uploads document, member downloads it

## 13. Edge Cases

- Member with no photo — default avatar used on ID card
- Member in multiple orgs — separate ID cards per org
- QR code scanned years after generation — still validates (HMAC doesn't expire), but status may be stale
- Certificate for training with 0 credits — still generate certificate? [VERIFY]
- SVG logo with nested `<svg>` elements — sanitize recursively
- Very large document upload — enforce max file size at API gateway level
- Concurrent ID card regeneration (profile + status change simultaneously) — last write wins

## 14. Dependencies

### Internal Dependencies
- M02 (Member Profile) — PersonUpdated event for card regeneration
- M05 (Membership) — membership status for card content
- M09 (Training) — TrainingCompleted event for certificate availability
- Storage handlers — S3/MinIO for file storage

### External Dependencies
- S3/MinIO — file storage for PDFs, uploads
- PDF generation library (e.g., PDFKit or Puppeteer) — ID cards and certificates
- HMAC library (Node.js crypto) — QR code signing

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|----------------|-------------------|---------------------|
| Invalid QR token | 404 on verification | "This document could not be verified." |
| Tampered QR (HMAC mismatch) | 404 on verification | "This document could not be verified." |
| Certificate not available (training incomplete) | 404 | "Certificate not available. Complete the training first." |
| No active membership for ID card | 404 | "No active membership found." |
| SVG with malicious content | Sanitize and proceed | — (transparent to user) |
| File upload too large | 400 Bad Request | "File exceeds the maximum allowed size." |
| Storage service unavailable | 503 | "Document service temporarily unavailable. Please try again." |

## 16. Performance Expectations

- **Data volume:** ~2 ID cards per member (multi-org), ~10 certificates per member per year
- **Concurrent users:** Up to 200 concurrent certificate downloads post-training
- **Response times:** ID card generation <2s, certificate download <1s, verification <100ms
- **Caching:** Generated PDFs cached in S3; regenerated only on change events

## 17. Observability Hooks

**Log Events:**

| Event | Level | Fields |
|-------|-------|--------|
| credential.card.generated | info | personId, organizationId |
| credential.card.regenerated | info | personId, organizationId, trigger (profile/status) |
| credential.certificate.generated | info | personId, trainingId, certificateNumber |
| credential.verification.valid | info | token (truncated) |
| credential.verification.invalid | warn | token (truncated), reason |
| document.uploaded | info | documentId, orgId, uploadedBy, mimeType |
| document.accessed | info | documentId, personId, action |

**Metrics:**

| Metric | Type | Labels |
|--------|------|--------|
| credentials_generated_total | counter | type (card/certificate), orgId |
| verifications_total | counter | result (valid/invalid) |
| documents_uploaded_total | counter | orgId |
| document_access_total | counter | action (view/download), orgId |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|-------------|
| credentials_enabled | per-org | true | Enable/disable credential generation | — (permanent) |
| public_verification | global | true | Enable/disable public verification page | — (permanent) |
| credential_templates | per-org | false | Enable custom credential template designer | After M11 GA |
| verification_api_keys | per-org | false | Enable API key-based verification endpoint | After M11 GA |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M11-S1 | Member ID Card | Generate + download ID card PDF with QR | M02, M05 | P0 |
| M11-S2 | Public Verification | Verify QR token via public page | M11-S1 | P0 |
| M11-S3 | Certificate Download | Generate + download training certificate | M09 | P0 |
| M11-S4 | Document Upload | Upload, version, tag org documents | Storage handlers | P1 |
| M11-S5 | Document Access Log | Log all document views/downloads | M11-S4 | P1 |
| M11-S6 | Auto-Regeneration | Regenerate cards on PersonUpdated/MembershipStatusChanged | M11-S1 | P1 |
| M11-S7 | Credential Templates | Custom template designer | M11-S1 | P2 |

## 20. AI Instructions

- **Schema locations:** `services/api-ts/src/handlers/documents/repos/documents.schema.ts` (document, document_version, document_tag, document_access_log), `services/api-ts/src/handlers/certificates/repos/certificates.schema.ts` (certificate), `services/api-ts/src/handlers/storage/repos/file.schema.ts` (stored_file)
- **Handler locations:** `services/api-ts/src/handlers/documents/` (15 handlers, TypeSpec), `services/api-ts/src/handlers/certificates/` (3 handlers, TypeSpec), `services/api-ts/src/handlers/storage/` (6 handlers, TypeSpec)
- **Bounded context:** Content Context — owns document, document_version, document_tag, document_access_log, certificate, stored_file
- **HMAC signing:** Use Node.js `crypto.createHmac('sha256', secret)` for QR payload signing
- **SVG sanitization:** Strip `<script>`, `on*` attributes, `<foreignObject>`, external `xlink:href` references
- **PDF generation:** Use consistent library across ID cards and certificates; consider Puppeteer for HTML-to-PDF
- **Vertical TDD:** Follow VERTICAL_TDD.md — write failing tests first for each slice

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | — |
| 3. Workflows | COMPLETE | |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | — |
| 6. Permissions | COMPLETE | Matches ROLE_PERMISSION_MATRIX |
| 7. Data Requirements | COMPLETE | VerificationRequest entity not in DOMAIN_MODEL |
| 7b. Aggregate Boundaries | COMPLETE | — |
| 8. State Transitions | COMPLETE | Only Document has state machine |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | COMPLETE | — |
| 11. Acceptance Criteria | COMPLETE | — |
| 12. Test Expectations | COMPLETE | — |
| 13. Edge Cases | PARTIAL | Zero-credit certificate needs [VERIFY] |
| 14. Dependencies | COMPLETE | — |
| 15. Error Handling | COMPLETE | — |
| 16. Performance | COMPLETE | — |
| 17. Observability | COMPLETE | — |
| 18. Feature Flags | COMPLETE | — |
| 19. Vertical Slice Plan | COMPLETE | — |
| 20. AI Instructions | COMPLETE | — |

## 22. Downstream Impact

- **M02 (Member Profile):** PersonUpdated event contract must include fields needed for card regeneration (name, photo, license number)
- **M05 (Membership):** MembershipStatusChanged event contract must include orgId and new status for card regeneration
- **M09 (Training):** TrainingCompleted event contract must include trainingId, personId, creditValue, orgName for certificate generation
- **Audit:** All verification requests logged; changes to verification endpoint affect audit trail completeness
