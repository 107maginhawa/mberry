<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M11 Documents & Credentials -- Screen Specifications

## Table of Contents
1. [My ID Card](#screen-my-id-card)
2. [My Certificates](#screen-my-certificates)
3. [Verification Page](#screen-verification-page)
4. [Org Documents](#screen-org-documents)

---

## Screen: My ID Card

**Route:** `/my/id-card`
**Purpose:** Member views and downloads their digital membership ID card
**Workflow:** WF-071 (Download Member ID Card)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "My ID Card" |
| `main` | `<main>` | "Member ID card" |

### Focus Management

- Page load: focus on `<h1>`
- After download: toast "ID card downloaded"
- After regeneration: toast "ID card regenerated with updated information"

### Fields Displayed

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| memberName | string | person.name | Full name with credentials |
| memberPhoto | image | person.photoUrl | Fallback to initials avatar |
| membershipNumber | string | membership.membershipNumber | Unique member ID |
| organizationName | string | org.name | Primary org |
| memberSince | date | membership.startDate | Formatted |
| membershipStatus | badge | membership.status | active / suspended / etc. |
| expiryDate | date | membership.expiryDate | If applicable |
| qrCode | image | generated | Links to verification URL |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Download PDF | `<a>` | `aria-label="Download ID card as PDF"` | Always | `GET /my/id-card` (Accept: application/pdf) |
| Download Image | `<button>` | `aria-label="Download ID card as image"` | Always | Client-side render |
| Share | `<button>` | `aria-label="Share ID card"` | Web Share API available | navigator.share() |
| Add to Wallet | `<button>` | `aria-label="Add to digital wallet"` | Mobile device | Future feature |

### Role-Variant Matrix

All authenticated members see their own ID card. No role differentiation.

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 768px | Card preview (credit-card ratio) centered, actions below |
| < 768px | Full-width card, sticky download button at bottom |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton card placeholder | Initial fetch |
| Empty | "No ID card available. Complete your profile to generate one." | Missing required profile data |
| Success | Rendered ID card with QR code | Data loaded |
| Refreshing | N/A | -- |
| Error | "Unable to load your ID card." + retry | API error |
| PermissionError | N/A (all members) | -- |
| Downloading | Download button spinner | PDF/image generation |
| Regenerating | "Updating your ID card..." overlay | Profile or status changed (auto via BR-19) |
| Offline | "ID card preview unavailable offline." + cached image if previously loaded | navigator.onLine === false |

### Permissions

- Auth: GA -- own ID card only

### Edge Cases

- Profile photo not uploaded: initials avatar used on card
- Membership expired: card shows "EXPIRED" watermark, download still allowed
- Auto-regeneration on PersonUpdated or MembershipStatusChanged events (BR-19)
- SVG org logo: sanitized per M11-R2 (strip scripts, event handlers, external refs)

---

## Screen: My Certificates

**Route:** `/my/certificates`
**Purpose:** Member views all earned certificates across organizations
**Workflow:** WF-074 (Certificate Download)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "My Certificates" |
| `main` | `<main>` | "Certificate list" |

### Focus Management

- Page load: focus on `<h1>`
- After download: toast "Certificate downloaded"

### Fields Displayed

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| certificateNumber | string | certificate.certificateNumber | Display ID |
| trainingTitle | string | training.title | What was completed |
| trainingDate | date | training.startDate | When |
| creditAmount | number | training.creditAmount | CPD credits |
| organizationName | string | org.name | Issuing org |
| issuedAt | date | certificate.issuedAt | When issued |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Download PDF | `<button>` per row | `aria-label="Download certificate for {trainingTitle}"` | Always | `GET /my/certificates/:id/download` |
| View Certificate | `<a>` on row | `aria-label="View certificate: {trainingTitle}"` | Always | Navigate to `/my/certificates/[id]` |
| Filter by org | `<select>` | `aria-label="Filter certificates by organization"` | Multi-org | Client-side filter |
| Sort | Column headers | `aria-sort` | Always | Client-side sort |

### Role-Variant Matrix

All authenticated members see their own certificates. No role differentiation.

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Table with all columns |
| 768-1023px | Table with collapsed columns (hide issueDate) |
| < 768px | Card list: training title, date, credits, download button |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton table rows | Initial fetch |
| Empty | "No certificates yet. Complete a training to earn your first certificate." | 0 certificates |
| Success | Certificate table/cards | Has certificates |
| Refreshing | Subtle spinner | Background refetch |
| Error | Alert "Unable to load certificates." + retry | API error |
| PermissionError | N/A (all members) | -- |
| Downloading | Per-row download button spinner | PDF generation |
| FilteredEmpty | "No certificates from this organization." | Org filter active, 0 results |
| Offline | Show cached list, download buttons disabled | navigator.onLine === false |

### Permissions

- Auth: GA -- own certificates only
- BR-20, M11-R1: Certificate only available if training completed + attendance confirmed

### Edge Cases

- Certificate pending (training completed, attendance not confirmed): shown as "Pending" with no download button
- First download triggers CredentialGenerated event + DocumentAccessLog entry
- Certificate template rendering failure (M11-004): "Unable to generate certificate. Please try again later."

---

## Screen: Verification Page

**Route:** `/verify/[token]` (public, no authentication required)
**Purpose:** Public credential verification via QR code or direct URL
**Workflow:** WF-072 (Public Verification)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Credential Verification" |
| `main` | `<main>` | "Verification result" |

### Focus Management

- Page load: focus on `<h1>` "Credential Verification"
- Result loaded: focus on verification status

### Fields Displayed (Valid Result)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| verificationStatus | badge | HMAC validation | "Verified" or "Invalid" |
| memberName | string | credential data | Holder name |
| credentialType | string | -- | "Training Certificate" / "Member ID" |
| organizationName | string | org.name | Issuing org |
| issuedDate | date | certificate.issuedAt | When issued |
| details | varies | credential-specific | Training title, credit amount, etc. |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| None (read-only) | -- | -- | -- | `GET /verify/:token` (public) |

### Role-Variant Matrix

Public page. No authentication or role differentiation.

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 768px | Centered card with verification result |
| < 768px | Full-width card |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton verification card | Token being validated |
| Empty | N/A | -- |
| Success (Valid) | Green checkmark, "This credential is verified.", member details | HMAC valid |
| Success (Invalid) | Red X, "This document could not be verified." | HMAC invalid |
| Refreshing | N/A (one-shot verification) | -- |
| Error | "Verification service unavailable. Please try again." | API error |
| PermissionError | N/A (public) | -- |
| Expired | Amber warning, "This credential was issued on {date}. Contact the issuing organization for current status." | Valid but old |
| NotFound | "No credential found for this verification code." | Token not recognized |

### Permissions

- Public -- no authentication required
- Rate limited per BR-18, M11-R3

### Edge Cases

- QR scanned from printed certificate: validates HMAC signature only, does not confirm real-time status (per BR-18)
- Tampered token: returns Invalid state
- Very old credential: still verifiable but shows issuance date prominently

---

## Screen: Org Documents

**Route:** `/org/[id]/documents`
**Purpose:** Officer manages organization documents; members browse published documents
**Workflow:** WF-073 (Document Management)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Organization Documents" |
| `navigation` | `<nav>` | "Document filters" |
| `main` | `<main>` | "Document list" |

### Focus Management

- Page load: focus on `<h1>`
- After upload: focus on new document in list, toast "Document uploaded"
- After status change: focus on document row, live region announces new status

### Fields Displayed

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| title | string | document.title | Document name |
| status | badge | document.status | draft / published / archived |
| tags | tag list | documentTag[] | Clickable filter tags |
| currentVersion | number | document.currentVersion | Version number |
| uploadedBy | string | person.name | Who uploaded |
| updatedAt | date | document.updatedAt | Last modified |
| fileSize | string | computed | Formatted (KB/MB) |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Upload Document | `<button>` | `aria-label="Upload new document"` | Officer | Opens upload dialog |
| Download | `<a>` per row | `aria-label="Download {title}"` | published or own draft | Direct file download |
| View Versions | `<button>` per row | `aria-label="View version history for {title}"` | Always | Expands version list |
| Upload New Version | `<button>` | `aria-label="Upload new version of {title}"` | Officer, published doc | `POST .../documents/:id/versions` |
| Publish | `<button>` per row | `aria-label="Publish {title}"` | Officer, status=draft | `PATCH .../documents/:id/status` |
| Archive | `<button>` per row | `aria-label="Archive {title}"` | Officer, status=published | `PATCH .../documents/:id/status` |
| Delete | `<button>` per row | `aria-label="Delete {title}"` | Officer, status=draft | `DELETE .../documents/:id` |
| View Access Log | `<button>` per row | `aria-label="View access log for {title}"` | Officer | `GET .../documents/:id/access-log` |
| Filter by tag | Tag clicks | `aria-label="Filter by tag: {tag}"` | Always | Client-side filter |
| Search | `<input type="search">` | `aria-label="Search documents"` | Always | Debounced filter |

### Role-Variant Matrix

| Element | Member | Officer | President | Admin | Super |
|---------|--------|---------|-----------|-------|-------|
| Published documents (read) | visible | visible | visible | visible | visible |
| Draft documents | hidden | visible (own) | visible (all) | visible | visible |
| Upload document | hidden | visible | visible | visible | visible |
| Publish / Archive | hidden | visible | visible | visible | visible |
| Delete draft | hidden | visible (own) | visible | visible | visible |
| Upload new version | hidden | visible | visible | visible | visible |
| View access log | hidden | visible | visible | visible | visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Table with all columns, tag chips inline |
| 768-1023px | Table with collapsed columns (hide uploadedBy, fileSize) |
| < 768px | Card list: title, status badge, tags, download button |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton table rows | Initial fetch |
| Empty | "No documents yet." + "Upload your first document" (officers) or "No documents published yet." (members) | 0 documents |
| Success | Document table with status badges and tags | Has documents |
| Refreshing | Subtle spinner | Background refetch |
| Error | Alert "Unable to load documents." + retry | API error |
| PermissionError | Member sees only published; officer redirect if not authorized | Role-based filtering |
| Uploading | Upload dialog with progress bar | File upload in flight |
| Mutating | Action button spinner (publish, archive, delete) | Status change in flight |
| FilteredEmpty | "No documents match your filters." + clear filters | Filters/tags active, 0 results |

### Validation (Upload Dialog)

| Field | Rule | Error |
|-------|------|-------|
| file | required, max 50MB, allowed types (pdf, doc, docx, xls, xlsx, png, jpg) | "File is required" / "File too large (max 50MB)" / "Unsupported file type" |
| title | required, max 300 chars | "Title is required" |
| tags | optional, each max 50 chars | "Tag too long (max 50 characters)" |

### Permissions

- Read (published): GA -- all authenticated org members
- Write (upload, publish, archive, delete): GA+HG -- secretary, president, officer, admin, super
- Access log: officer+
- M11-R4: version history maintained (immutable versions)
- M11-R5: all document access logged

### Edge Cases

- Large file upload: progress bar with cancel option
- Unsupported file type: validation error before upload starts
- Document with many versions: expandable version list, latest shown by default
- Archived document: greyed out, visible to officers only, download still possible
- Access log shows viewer name, timestamp, IP (officer-only)
