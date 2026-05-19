# Module Specification: Documents & Credentials (M11)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Generate, manage, and verify digital credentials — member ID cards, training certificates, and official documents. Provides HMAC-signed QR codes for tamper-proof offline verification and a public verification API.

### Users
- Member, Officer, Platform Admin, Public (verification)

### Related Modules
- M05 (Membership — status for ID cards), M09 (Training — certificates), M10 (Credit Tracking — transcript)

### In Scope
- Member ID Card (digital + PDF) with HMAC-signed QR
- Training certificates (PDF with QR), certificate availability rules
- Public verification page, member verification API
- Platform branding on documents, organization logo handling
- Document management (upload, version, tag, access log)
- SVG sanitization for logos

### Out of Scope
- Payment receipts (M06), credit cycle computation (M10)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Member ID Card | Generated PDF with name, photo, org, status, HMAC-signed QR. |
| QR Code | HMAC-signed code verifying document authenticity. Offline check proves authenticity only. |
| Certificate | PDF certifying training completion with credits and QR. |
| License Number | PRC license identifier shown on credentials. |
| HMAC | Hash-based Message Authentication Code for QR signing. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Download Member ID Card | Member | View and download PDF with QR | P0 |
| Download Training Certificate | Member | PDF certificate post-training | P0 |
| Share Verification Link | Member | Copy/share verification URL | P0 |
| Public Verification | Public | Scan QR or visit URL to verify | P0 |
| Manage Verification API | Platform Admin | API key management for 3rd party verification | P0 |

## 4. Workflow Details

### Workflow: Download Member ID Card (M-25)

Actor: Member
Steps:
1. Opens /my/id-card.
2. Selects org (if multi-org).
3. Views card: photo, name, license, org, status, expiry, QR.
4. Downloads PDF (credit card size, landscape).

### Workflow: Public Verification

Actor: Public (anyone with QR/link)
Steps:
1. Scans QR or opens verification URL (memberry.com/verify/[token]).
2. HMAC signature validated.
3. Page shows: name, license number, org, status at generation date.
4. Invalid token: "This document could not be verified."

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-18 | IF QR scanned THEN validate HMAC signature | Verification | Proves authenticity, not real-time status |
| BR-19 | IF profile/status changes THEN regenerate ID card | ID card | Auto-regeneration |
| M11-R1 | IF certificate requested THEN training must be completed + member attended | Certificate availability | No certificate for non-attendees |
| M11-R2 | IF SVG logo uploaded THEN full sanitization | Logo handling | Strip scripts, event handlers, external refs |
| M11-R3 | IF verification API key generated THEN track usage and rate limit | API | Per-key rate limiting |
| M11-R4 | IF document uploaded THEN version history maintained | Documents | Immutable versions |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List/download documents | All authenticated | — | GA |
| Upload documents | president, VP, secretary, officer, staff | member | GA+HG |
| Delete documents | president | All others | GA+HG |
| Generate certificate | president, secretary, officer | member | GA+HG |
| View own certificates | All authenticated | — | GA |
| Public verification | Public (no auth) | — | Public route |

## 7. Data Requirements

### Entity: MemberCard

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | — |
| organizationId | Yes | Org FK | — |
| pdfUrl | No | Generated PDF | — |
| qrPayload | Yes | HMAC-signed data | member ID, org ID, status, expiry |
| generatedAt | Yes | Generation timestamp | Regenerated on change |

### Entity: Certificate

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| trainingId | Yes | Training FK | — |
| personId | Yes | Person FK | Unique with trainingId |
| certificateNumber | Yes | Unique number | Globally unique |

### Entity: Document

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| title | Yes | Document name | — |
| status | Yes | draft/published/archived | Enum |
| fileUrl | Yes | Storage URL | — |

### Entity: VerificationRequest

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| token | Yes | HMAC-signed token | — |
| verifiedAt | Yes | Verification timestamp | — |
| valid | Yes | Signature valid? | Boolean |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Document | DocumentVersion, DocumentTag, DocumentAccessLog | — | Version history immutable. |
| Certificate | — | — | One per person per training. Number unique. |
| MemberCard | — | QRPayload | Regenerated on profile/status change. |

## 8. State Transitions

### Document Status
```txt
Draft → Published → Archived
```

### Certificate (no state machine — generated once, immutable)

## 9. UI / UX Requirements

### Screen: Verification Page (memberry.com/verify/[token])
Purpose: Public credential verification
Components: Verification result (name, license, org, status), HMAC validation indicator
States: Valid (green check), Invalid ("Document could not be verified"), Loading

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /my/id-card/:orgId | Get ID card data | orgId | Card data + QR | 404 |
| GET /my/id-card/:orgId/pdf | Download PDF | orgId | PDF binary | 500 |
| GET /my/certificates/:id/pdf | Download certificate | — | PDF binary | 404, 500 |
| GET /verify/:token | Public verification | token | Verification result | 400 invalid |
| POST /admin/verification-api/keys | Create API key | — | apiKey | 403 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CredentialGenerated | ID card or certificate created | personId, type, documentId | — |
| VerificationRequested | QR scanned or URL visited | token, valid, timestamp | Audit |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PersonUpdated | M02 | Regenerate ID card | Card re-created with new data |
| MembershipStatusChanged | M05 | Regenerate ID card | Status updated on card |
| TrainingCompleted | M09 | Make certificate available | Certificate downloadable |

## 11. Acceptance Criteria

### AC-M11-001: QR Authenticity
HMAC-signed QR code proves document was generated by Memberry and data hasn't been tampered.

### AC-M11-002: Certificate Availability
Certificate only available after training completed AND member marked as attended.

### AC-M11-003: SVG Sanitization
All script elements, event handlers, and external references stripped from SVG logos.

### AC-M11-004: Auto-Regeneration
ID card regenerates when profile data or membership status changes.

## 12. Test Expectations

Required tests:
- QR HMAC: sign, verify, tamper detection
- ID card: generation, PDF output, multi-org, auto-regeneration
- Certificate: generation, unique number, availability rules
- SVG sanitization: script removal, event handler removal, external ref removal
- Public verification: valid token, invalid token, expired token
- Document management: upload, version history, access logging

## 13. Edge Cases

- Member with no photo: default avatar on ID card.
- Lapsed member downloads ID card: "LAPSED" prominently displayed.
- QR code scanned offline: HMAC validates authenticity but cannot check real-time status.
- SVG with nested scripts in CSS: sanitization must catch CSS-based XSS.

## 14. Dependencies

### Internal Dependencies
- M02 (Profile — photo, name), M05 (Membership — status), M09 (Training — certificates), M10 (Credits — transcript)

### External Dependencies
- PDF generation library, HMAC signing library, file storage service

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| PDF generation fails | Retry available | "Could not generate. Try again." |
| Invalid QR token | Show error | "Document could not be verified." |
| SVG sanitization strips all content | Reject upload | "Logo file appears invalid after security processing." |

## 16. Performance Expectations

- PDF generation: < 3 seconds
- Verification page load: < 1 second
- Document upload: < 5 seconds for 10MB file

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| credential.idcard.generated | INFO | PDF created | personId, orgId | No |
| credential.certificate.generated | INFO | Cert PDF created | personId, trainingId | No |
| credential.verification | INFO | QR/URL verified | token_hash, valid | No |
| document.uploaded | INFO | File uploaded | orgId, docId, size | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| credential_generation_seconds | histogram | type | Generation time |
| verification_requests_total | counter | valid | Verification count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| credentials_verification_api | release | false | 3rd party verification API | — |
| credentials_qr_v2 | release | false | Enhanced QR payload | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M11-S1 | Member ID Card | Card generation + PDF + QR | M02, M05 | P0 |
| M11-S2 | Training Certificates | Certificate PDF with QR | M09 | P0 |
| M11-S3 | Public Verification | Verification page + HMAC | M11-S1 | P0 |
| M11-S4 | Document Management | Upload, version, tag | M04 | P1 |
| M11-S5 | SVG Sanitization | Logo security processing | M11-S1 | P0 |
| M11-S6 | Verification API | API key management + rate limiting | M11-S3 | P2 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
