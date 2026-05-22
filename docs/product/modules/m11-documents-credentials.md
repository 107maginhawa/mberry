# Module 11: Documents and Credentials

| Attribute | Value |
|-----------|-------|
| **Module** | M11 |
| **Phase** | 1 |
| **Wave** | 3 |
| **Priority** | P1 |
| **Monetization** | Premium |
| **Category** | Credentials |
| **Dependencies** | M05 (Membership), M09 (Training), M10 (Credit Tracking) |

---

## Purpose

Generate verifiable digital credentials for members: ID cards and training certificates. Documents include tamper-proof QR codes for authenticity verification. A public verification page and API allow third parties (employers, regulators) to confirm membership status.

---

## Capabilities

### 11.1 Member ID Card (Digital + PDF)

Members can generate a digital ID card per organization they belong to. The card contains:

- Member photo
- Full name
- License number
- Organization name and logo
- Membership category
- Membership status (at time of generation)
- Dues expiry date
- Generation date
- HMAC-signed QR code (see 11.2)
- Platform branding (footer: "Verified by Memberry")

The card is downloadable as PDF. It regenerates on demand when the member requests it -- the generation date updates to reflect the current state.

### 11.2 HMAC-Signed QR Codes

QR codes on ID cards and certificates are cryptographically signed using HMAC (per BR-18).

**QR Payload:**
- Member ID
- Document type (ID_CARD or CERTIFICATE)
- Organization ID
- Issue/generation date
- HMAC signature

**Security properties:**

| Property | Capability |
|----------|-----------|
| **Authenticity** | QR proves the document was issued by the platform and data has not been tampered with. Works offline -- HMAC validation does not require a server call for basic authenticity checks. |
| **Currency** | QR does NOT prove current membership status. It proves status at time of generation only. |

**Staleness window:** When a QR code is scanned and verified online, the verification result displays:

- "Verified as of [generation date]"
- If the card is older than 30 days: "This card was generated on [date]. For current status, recommend regenerating or checking the online verification page."

**HMAC secret:** Stored securely server-side. Never exposed to clients. Rotated per platform security policy.

### 11.3 Training Certificate (PDF)

After a training is completed and attendance is confirmed, members can download a certificate. The certificate contains:

- Member name
- Training title
- Training type
- Date(s) of training
- Location (venue or "Online")
- Number of credits earned
- Hosting organization name and logo
- Regulatory approval status (e.g., "PRC Approved")
- HMAC-signed QR code
- Certificate number (unique identifier)
- Platform branding (footer: "Verified by Memberry")

### 11.4 Certificate Availability Rules

Per BR-20, certificates are only available when BOTH conditions are met:

1. The training's scheduled date has passed (no pre-event certificates).
2. The member's attendance is confirmed (QR check-in recorded or completion marked by officer).

Members who registered but did not attend cannot download certificates.

### 11.5 Public Verification Page

A public (no login required) verification page at `/verify/[token]` (HMAC-signed QR code token):

> **Note:** License-based verification is not supported. The platform uses HMAC token QR codes only (`/verify/[token]`). There is no `/verify/[license]` route.

- Displays: member name, license number, organization(s), membership status, and generation date (accessed via QR scan).
- Validates HMAC signature first. If signature is invalid, displays "This document could not be verified. The QR code may have been modified."
- No personal data beyond name, license number, org, and status is displayed.

### 11.6 Member Verification API

Public, read-only API endpoint for programmatic verification:

> **Note:** API key management is deferred to platform engineering — no UI screen for this in PRD v3 scope (see journey PA-15 below for the intended workflow). The API itself is in scope; only the admin UI screen for key management is deferred.

| Attribute | Detail |
|-----------|--------|
| **Endpoint** | `GET /api/verify/[token]` (HMAC token from QR code) |
| **Authentication** | API key required (issued to employers, regulators, partner systems) |
| **Response** | Member name, license number, active membership status (yes/no), organization(s) |
| **Rate limit** | 100 requests/minute per API key |
| **Data scope** | Current status only. No personal data beyond status fields. No payment history, no credit data, no contact info. |
| **Privacy** | Returns only what is necessary for verification. Does not confirm non-existence (returns generic "not found" for both non-members and non-existent tokens). |

### 11.7 Platform Branding on Documents

All generated documents (ID cards and certificates) include platform branding:

- Footer: "Verified by Memberry" with platform logo
- Non-removable in v1
- Serves as growth feature -- recipients and verifiers see the platform brand

### 11.8 Organization Logo Handling

Organization logos appear on ID cards and certificates. Security requirements:

- SVG uploads accepted for org logos (per BR-31) but MUST be sanitized -- not just header/magic-byte validation.
- SVG sanitization strips: `<script>` tags, event handlers (onclick, onload, etc.), external references, embedded data URIs containing scripts, CSS expressions.
- Raster formats (JPEG, PNG, WebP) are also accepted and preferred for maximum PDF rendering compatibility.

---

## Business Rules

| Rule | ID | Summary |
|------|----|---------|
| HMAC-signed QR | BR-18 | QR codes are cryptographically signed. Modified QR codes are rejected on scan. |
| Certificate timing | BR-20 | Certificates only available after event date AND attendance confirmation. |
| SVG upload security | BR-31 | SVG uploads for org logos must be sanitized at DOM level (not just header validation). |
| File upload constraints | M11-R1 | Non-SVG images under 5 MB. Accepted formats: JPEG, PNG, WebP. |
| Audit trail | M11-R2 | Document generation, verification requests, and API usage are audit-logged. |

---

## User Journeys

### Member Journeys

#### M-25: Download/View My Member ID Card

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "My ID Card" from dashboard or profile | If member belongs to one org: shows card preview. If multiple orgs: shows org selector. | No active memberships -> "You need an active membership to generate an ID card" |
| 2 | Selects organization (if multi-org) | ID card preview: photo, name, license number, org name + logo, category, status, expiry, QR | |
| 3 | Views digital card | Card displayed on screen with QR code prominently visible | |
| 4 | Downloads PDF | PDF generated with current data and new generation date | |
| 5 | Status is Lapsed | Card shows "LAPSED" status clearly. Still downloadable but marked. | |

#### M-26: Download Training Certificate

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens completed training from activity history or certificates page | Training detail with "Download Certificate" button | Training not yet ended -> "Certificate available after [date]" |
| 2 | Clicks "Download Certificate" | Certificate PDF generated: name, training, date, credits, org + logo, QR | Attendance not confirmed -> "Certificate not available. Contact your training organizer." |
| 3 | Views certificate | PDF opens or downloads | |

#### M-27: Share Verification Link

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens ID card or certificate | "Share Verification" button visible | |
| 2 | Clicks share | Copies verification URL to clipboard: `memberry.com/verify/[token]` (HMAC-signed QR token URL) | |
| 3 | Recipient opens link | Public verification page shows: name, license number, org, status at generation date. HMAC signature validated first. | Invalid token -> "This document could not be verified. The QR code may have been modified." |

### Platform Admin Journeys

#### PA-15: Member Verification API Management

> **Note:** API key management UI (`/admin/system/api-keys`) is deferred to platform engineering — no UI screen in PRD v3 scope. API key issuance and revocation are handled directly by platform engineering in v3. The journey below describes the intended future workflow.

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens API management in platform admin | List of issued API keys with usage stats | |
| 2 | Creates new API key | Form: requester name, organization, contact email, purpose | |
| 3 | Issues key | Key generated and displayed once. Usage tracked. Rate limits applied. | |
| 4 | Reviews usage | Per-key: request count, last used, rate limit hits | |
| 5 | Revokes key | Key immediately invalidated. All subsequent requests return 401. | |

---

## Screens

| Route | Page | Key Functions | Access |
|-------|------|---------------|--------|
| `/my/id-card` | My ID Card (org selector if multi-org) | View digital card, download PDF | Member |
| `/my/certificates` | My Certificates | List of available certificates | Member |
| `/my/certificates/[id]` | Certificate Detail | View and download certificate PDF (screen spec being added to inventory separately) | Member |
| `/verify/[token]` | Public Verification Page | Name, license, org, status, generation date — accessed via HMAC-signed QR code token only. **License-based verification not supported — QR code verification via `/verify/[token]` only.** | Public (no login) |

---

## Data Entities

### MemberCard

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| member_id | UUID | FK to Member |
| org_id | UUID | FK to Organization |
| generation_date | Timestamp | When the card was last generated |
| pdf_url | String | URL to generated PDF |
| qr_payload | String | Encoded QR data (member ID, org ID, doc type, date) |
| qr_hmac | String | HMAC signature of the QR payload |
| status_at_generation | Enum | Membership status at time of generation (Active, Grace, Lapsed, Suspended) |
| expiry_at_generation | Date | Dues expiry date at time of generation |

### Certificate

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| certificate_number | String | Unique, human-readable certificate number (e.g., CERT-2026-04821) |
| member_id | UUID | FK to Member |
| training_id | UUID | FK to Training |
| org_id | UUID | FK to Organization (hosting org) |
| generation_date | Timestamp | When the certificate was generated |
| pdf_url | String | URL to generated PDF |
| qr_payload | String | Encoded QR data |
| qr_hmac | String | HMAC signature |
| credits_awarded | Decimal | Credits shown on certificate |

### VerificationRequest

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| request_type | Enum: QR_SCAN, WEB_LOOKUP, API_CALL | How the verification was initiated |
| license_number | String | License number being verified |
| api_key_id | UUID (nullable) | FK to API key (for API_CALL requests) |
| requester_ip | String | IP address of requester |
| timestamp | Timestamp | When the request was made |
| result | Enum: VERIFIED, NOT_FOUND, INVALID_SIGNATURE, RATE_LIMITED | Outcome |
| response_data | JSON (nullable) | What was returned (for audit purposes) |

### ApiKey

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| key_hash | String | Hashed API key (key itself shown once at creation) |
| requester_name | String | Organization or individual name |
| requester_email | String | Contact email |
| purpose | String | Stated use case |
| created_at | Timestamp | When issued |
| revoked_at | Timestamp (nullable) | When revoked (null if active) |
| request_count | Integer | Total requests made with this key |
| last_used_at | Timestamp (nullable) | Last request timestamp |

---

## Security Considerations

### QR Code Authenticity vs. Currency

This is a critical distinction that must be communicated in the UI:

- **Authenticity (offline-verifiable):** The HMAC signature proves the document was issued by Memberry and the encoded data has not been tampered with. This works without a network connection.
- **Currency (online-only):** To confirm a member's CURRENT status, the verifier must check the online verification page or API. The QR code only proves status at the time of document generation.

**UI messaging on verification results:**
- Offline scan: "Document authentic. Data verified as of [generation date]. For current status, visit memberry.com/verify/[token]."
- Online scan (card < 30 days old): "Verified. [Name] is [status] in [org]. Card generated [date]."
- Online scan (card > 30 days old): "Verified. [Name] was [status] in [org] as of [generation date]. This card is older than 30 days. Recommend regenerating for current status."

### SVG Sanitization

Organization logo SVG uploads must be sanitized beyond header validation:

1. Parse the SVG DOM.
2. Strip all `<script>` elements.
3. Strip all event handler attributes (`on*`).
4. Strip all `<foreignObject>` elements.
5. Strip external resource references (`xlink:href` pointing to external URLs).
6. Strip CSS `expression()` and `url()` referencing `javascript:`.
7. Re-serialize the cleaned SVG.

This prevents stored XSS attacks through logo uploads that render on member cards and certificates viewed by other users.

### Verification API Privacy

The verification API is intentionally minimal:
- Returns only: name, license number, status (active/inactive), organization name(s).
- Does NOT return: email, phone, address, payment history, credit data, photo.
- For non-existent license numbers, returns a generic "not found" -- does not distinguish between "not a member" and "license number does not exist" to prevent enumeration.

---

## Acceptance Criteria Summary

- QR verification works offline for basic authenticity (HMAC validation does not require a server call).
- Certificate PDF renders correctly on all devices and is print-friendly (A4/Letter).
- Certificates cannot be generated before the training date.
- Certificates cannot be generated without confirmed attendance.
- ID cards show current status at time of generation, including "LAPSED" when applicable.
- Verification page shows generation date and recommends regeneration if card is older than 30 days.
- SVG logos are sanitized (DOM-level, not just header check) before storage.
- Verification API requires API key and is rate-limited to 100 requests/minute per key.
- Verification API returns no personal data beyond status fields.
- Platform branding appears on all generated documents and is non-removable.
- All document generation and verification events are audit-logged.

---

*Module 11 -- Memberry v3*
