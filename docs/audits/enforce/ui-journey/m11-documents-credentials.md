# UI Journey Report: m11-documents-credentials

**Generated:** 2026-05-27
**Module:** Documents & Credentials (M11)
**Workflows:** WF-071 through WF-075
**Spec version:** MODULE_SPEC v2.0 (2026-05-21)

## Files Scanned

| File | Role | Purpose |
|------|------|---------|
| `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | Member | Digital ID card view with QR placeholder |
| `apps/memberry/src/routes/_authenticated/my/certificates/index.tsx` | Member | Certificate list (delegates to CertificateList component) |
| `apps/memberry/src/routes/_authenticated/my/certificates/$certificateId.tsx` | Member | Certificate detail (delegates to CertificatePreview component) |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/documents/index.tsx` | Member | Org document browser (delegates to DocumentBrowser component) |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/documents/$documentId.tsx` | Member | Document detail with download + version history |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/documents/index.tsx` | Officer | Document library management (delegates to DocumentLibrary) |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/documents/$documentId.tsx` | Officer | Document detail with versions, access log, tags, status management |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/certificates.tsx` | Officer | Bulk certificate issuance + verification |
| `apps/memberry/src/routes/verify/$certificateNumber.tsx` | Public | Certificate QR verification page |
| `apps/memberry/src/routes/verify/$credentialNumber.tsx` | Public | Credential QR verification page |
| `apps/memberry/src/features/certificates/components/certificate-list.tsx` | Member | Certificate list component with SDK query |
| `apps/memberry/src/features/certificates/components/certificate-preview.tsx` | Member | Certificate card with Download PDF + Copy Verification Link |
| `apps/memberry/src/features/documents/components/document-browser.tsx` | Member | Document search/filter for members (public + tenantOnly access) |
| `apps/memberry/src/features/documents/components/document-library.tsx` | Officer | Full CRUD document library with upload, publish, archive, delete |
| `apps/memberry/src/features/membership/components/credential-list.tsx` | Member | Professional license/credential list (separate from certificates) |

---

## Registry 1: Action Registry

Every interactive element mapped to its handler, API call, and completion state.

### WF-071: Download Member ID Card

| ID | Element | Type | Handler/Action | API Call | Completion |
|----|---------|------|----------------|----------|------------|
| J-M11-001 | "Download PDF" button | Button | disabled (always) | None | STUB -- button rendered disabled with no onClick handler |
| J-M11-002 | QR Code placeholder | Display | Static 24x24 div with text "QR Code" | None | STUB -- no actual QR generation, placeholder only |
| J-M11-003 | Member info display | Display | Reads from useOrg() + membership context | GET membership data via useOrg hook | COMPLETE -- renders name, license, status, valid-until |
| J-M11-004 | Status badge | Display | Maps membership status to color classes | None (derived) | COMPLETE -- color-coded badge rendering |

### WF-072: Public Verification

| ID | Element | Type | Handler/Action | API Call | Completion |
|----|---------|------|----------------|----------|------------|
| J-M11-010 | Certificate verification page | Page | Fetches verification data by certificateNumber | GET `/api/public/verify/${certificateNumber}` | COMPLETE -- renders valid/invalid states |
| J-M11-011 | Credential verification page | Page | Fetches credential lookup by credentialNumber | GET `/api/association/member/credentials/lookup/${credentialNumber}` | COMPLETE -- renders valid/expired/revoked/notFound states |
| J-M11-012 | "Print this verification" button | Button | `window.print()` | None | COMPLETE -- triggers browser print dialog |
| J-M11-013 | QR scan-to-verify display | Display | Shows current URL as text (no actual QR image) | None | PARTIAL -- text-only, no QR code image rendered |
| J-M11-014 | Valid status badge | Display | Green badge for valid, red for invalid/revoked | None (derived) | COMPLETE |
| J-M11-015 | Holder details display | Display | Shows holder name, photo, specialty, membership status | From verification API response | COMPLETE |

### WF-073: Document Management (Officer)

| ID | Element | Type | Handler/Action | API Call | Completion |
|----|---------|------|----------------|----------|------------|
| J-M11-020 | Upload drop zone | DropZone | onDragOver/onDragLeave/onDrop + file input | Storage upload (implicit) | COMPLETE -- drag-and-drop + browse file picker |
| J-M11-021 | Upload form (title, category, access level) | Form | State-managed form with title/category/accessLevel fields | POST via createDocumentMutation | COMPLETE -- full form with validation |
| J-M11-022 | "Upload" submit button | Button | Calls createDocumentMutation | POST `/orgs/:orgId/documents` | COMPLETE |
| J-M11-023 | "Publish" action (from card menu) | MenuItem | Opens ConfirmDialog, then calls updateDocumentMutation | PATCH `/orgs/:orgId/documents/:id/status` with `{status: 'published'}` | COMPLETE |
| J-M11-024 | "Archive" action (from card menu) | MenuItem | Opens ConfirmDialog, then calls archiveDocumentMutation | POST archive endpoint | COMPLETE |
| J-M11-025 | "Delete" action (from card menu) | MenuItem | Opens ConfirmDialog, then calls deleteDocumentMutation | DELETE `/orgs/:orgId/documents/:id` | COMPLETE |
| J-M11-026 | Status filter select | Select | Filters documents by draft/published/archived | Client-side filter on query params | COMPLETE |
| J-M11-027 | Category filter select | Select | Filters by category (bylaws, minutes, forms, etc.) | Client-side filter on query params | COMPLETE |
| J-M11-028 | Search input | Input | Debounced search with server-side query | `q` param in searchDocumentsOptions | COMPLETE |
| J-M11-029 | "Load More" button | Button | Increments offset for pagination | Same query with new offset | COMPLETE |
| J-M11-030 | Document card link | Link | Navigates to officer document detail | Router navigation | COMPLETE |
| J-M11-031 | Access level editor (detail page) | Select + Save | Inline edit access level on detail page | PATCH via updateDocumentMutation | COMPLETE |
| J-M11-032 | Tag manager (detail page) | Input + Chips | Add/remove tags on document | POST createDocumentTag / DELETE | COMPLETE |
| J-M11-033 | Version history tab (detail page) | Tab | Lists all document versions in table | GET listDocumentVersionsOptions | COMPLETE |
| J-M11-034 | Upload new version (detail page) | Form | File input + change notes, uploads new version | POST uploadNewDocumentVersionMutation | COMPLETE |
| J-M11-035 | Access log tab (detail page) | Tab | Lists access log entries with action/user/date/IP | GET getDocumentAccessLogOptions | COMPLETE |

### WF-074: Certificate Download (Member)

| ID | Element | Type | Handler/Action | API Call | Completion |
|----|---------|------|----------------|----------|------------|
| J-M11-040 | Certificate list | List | Queries certificates via SDK | GET listMyCertificates via getCertificateOptions | COMPLETE -- renders list with training details |
| J-M11-041 | Certificate detail card | Display | Shows certificate number, date, training title, credits | GET getCertificateOptions by certificateId | COMPLETE |
| J-M11-042 | "Download PDF" button | Button | `alert('PDF download will be available in a future update.')` | None | STUB -- shows alert, no actual PDF generation |
| J-M11-043 | "Copy Verification Link" button | Button | `navigator.clipboard.writeText(verificationUrl)` + alert | None | COMPLETE -- constructs URL and copies to clipboard |

### WF-075: Credential Template Management (Officer/Admin)

| ID | Element | Type | Handler/Action | API Call | Completion |
|----|---------|------|----------------|----------|------------|
| J-M11-050 | Template designer | -- | No UI exists | -- | MISSING -- no route or component for credential template management |
| J-M11-051 | Logo upload (SVG) | -- | No UI exists | -- | MISSING -- no SVG upload with sanitization |
| J-M11-052 | Template preview | -- | No UI exists | -- | MISSING -- no template preview |

### Officer Certificate Management

| ID | Element | Type | Handler/Action | API Call | Completion |
|----|---------|------|----------------|----------|------------|
| J-M11-060 | Bulk issue form (training title, date, person IDs) | Form | State-managed with text inputs | POST `/certificates/bulk-issue` | COMPLETE |
| J-M11-061 | "Issue Certificates" button | Button | Calls bulkMutation | POST bulk-issue endpoint | COMPLETE |
| J-M11-062 | Verify single certificate form | Form | Certificate number input + verify button | POST or GET verify endpoint | COMPLETE |
| J-M11-063 | Verification result display | Display | Shows valid/invalid result with details | From verify response | COMPLETE |

---

## Registry 2: Journey Completion Matrix

| WF-ID | Description | Steps | UI Entry | Elements Found | Handlers OK | API Verified | Completable | Severity |
|-------|-------------|-------|----------|----------------|-------------|--------------|-------------|----------|
| WF-071 | Download Member ID Card | 4 | /my/id-card | ID card display with QR placeholder, disabled Download PDF button | PARTIAL (no PDF generation) | No download API wired | PARTIAL | P1 |
| WF-072 | Public Verification | 3 | /verify/$certificateNumber, /verify/$credentialNumber | Full verification pages for both cert + credential | YES | GET /api/public/verify/*, GET /api/association/member/credentials/lookup/* | COMPLETE | -- |
| WF-073 | Document Management | 6 | /org/$orgSlug/officer/documents/ | Upload, publish, archive, delete, versions, access log, tags | YES | searchDocuments, createDocument, archiveDocument, deleteDocument, updateDocument, listVersions, getAccessLog | COMPLETE | -- |
| WF-074 | Certificate Download | 4 | /my/certificates, /my/certificates/$certificateId | Certificate list + detail with stub PDF download | PARTIAL (PDF stub) | GET listMyCertificates, GET getCertificate | PARTIAL | P1 |
| WF-075 | Credential Template Management | 4 | None | No UI exists | NO | API endpoints defined (GET/POST/PATCH/DELETE /orgs/:id/credential-templates) but no frontend | MISSING | P2 |

### Journey Notes

- **WF-071 (ID Card):** The ID card page renders member info and a QR placeholder (static div, no actual QR image). The "Download PDF" button is permanently disabled. Spec requires PDF generation with QR and auto-regeneration on profile changes -- none of this is wired.
- **WF-072 (Public Verification):** Two separate verification routes exist -- one for certificate numbers and one for credential numbers. Both are fully functional with loading/error/result states. The QR "scan to verify" section shows URL text but no actual QR code image.
- **WF-073 (Document Management):** Most complete workflow. Officer document library supports full CRUD, drag-and-drop upload, publish/archive lifecycle, status/category/search filtering, version history with upload, access log viewing, tag management, and access level editing. Uses generated SDK hooks throughout.
- **WF-074 (Certificate Download):** List and detail views work via SDK hooks. PDF download is stubbed with an alert. Verification link copy works. No actual PDF generation exists.
- **WF-075 (Credential Templates):** Entirely missing from frontend. API contracts define 4 endpoints. Feature-flagged (`credential_templates`) per spec -- intentionally deferred (P2).

---

## Registry 3: Element->Action Binding Map

| Element ID | Element Description | Bound Action | API/SDK Hook | Error Handling | Loading State |
|------------|---------------------|--------------|--------------|----------------|---------------|
| J-M11-001 | ID Card Download PDF btn | None (disabled) | None | N/A | N/A |
| J-M11-002 | ID Card QR placeholder | None (display) | None | N/A | N/A |
| J-M11-003 | ID Card member info | useOrg() data display | Org context hook | Error alert div | IdCardSkeleton |
| J-M11-010 | Certificate verify page | useQuery fetch | GET `/api/public/verify/*` | Error card with "not found" | Spinner + text |
| J-M11-011 | Credential verify page | useQuery fetch | GET `/api/association/member/credentials/lookup/*` | Error card + notFound state | Spinner + text |
| J-M11-012 | Print verification btn | window.print() | None | N/A | N/A |
| J-M11-020 | Upload drop zone | onDrop -> setUploadFile | None (client state) | N/A | N/A |
| J-M11-021 | Upload form | State form fields | None (client state) | N/A | N/A |
| J-M11-022 | Upload submit btn | createDocumentMutation | POST document | toast.error on failure | Mutation pending state |
| J-M11-023 | Publish action | updateDocumentMutation | PATCH status | toast.error on failure | ConfirmDialog |
| J-M11-024 | Archive action | archiveDocumentMutation | POST archive | toast.error on failure | ConfirmDialog |
| J-M11-025 | Delete action | deleteDocumentMutation | DELETE document | toast.error on failure | ConfirmDialog |
| J-M11-026 | Status filter | Client state (setStatusFilter) | Query re-fetch | N/A | Skeleton grid |
| J-M11-027 | Category filter | Client state (setCategory) | Query re-fetch | N/A | Skeleton grid |
| J-M11-028 | Search input | Debounced state | Query re-fetch | N/A | Skeleton grid |
| J-M11-031 | Access level editor | updateDocumentMutation | PATCH document | toast.error | Inline spinner |
| J-M11-032 | Tag manager | createDocumentTagMutation | POST tag | toast.error | N/A |
| J-M11-033 | Version history tab | useQuery | GET listDocumentVersions | EmptyState | TableSkeleton |
| J-M11-034 | Upload new version | uploadNewDocumentVersionMutation | POST version | toast.error | Mutation pending |
| J-M11-035 | Access log tab | useQuery | GET getDocumentAccessLog | EmptyState | TableSkeleton |
| J-M11-040 | Certificate list | useQuery (getCertificateOptions) | GET listMyCertificates | Error message | CardSkeleton |
| J-M11-041 | Certificate detail | useQuery (getCertificateOptions) | GET getCertificate by ID | "Not found" card | CardSkeleton |
| J-M11-042 | Certificate Download PDF | alert() stub | None | N/A | N/A |
| J-M11-043 | Copy verification link | navigator.clipboard.writeText | None | N/A | N/A |
| J-M11-060 | Bulk issue form | State-managed form | None (client) | N/A | N/A |
| J-M11-061 | Issue Certificates btn | bulkMutation | POST /certificates/bulk-issue | Error handling | Mutation pending |
| J-M11-062 | Verify cert form | State + verifymutation | Verify endpoint | Error display | Loading state |

---

## Registry 4: Role Journey Completion

| Role | Assigned Journeys | Completable | Blocked By |
|------|-------------------|-------------|------------|
| Member | WF-071 (Download ID Card) | PARTIAL | Download PDF disabled; QR is placeholder only; no actual PDF generation |
| Member | WF-074 (Certificate Download) | PARTIAL | PDF download stubbed with alert(); list + detail views work |
| Member | WF-073 (View Documents) | COMPLETE | Member document browser + detail page fully functional |
| Officer (Secretary/President) | WF-073 (Document Management) | COMPLETE | Full CRUD with upload, publish, archive, delete, versions, access log, tags |
| Officer | WF-075 (Credential Templates) | MISSING | No UI exists; P2 feature-flagged |
| Officer | Certificate Issuance | COMPLETE | Bulk issue + verify forms on officer/certificates route |
| Public (unauthenticated) | WF-072 (Public Verification) | COMPLETE | Both certificate and credential verification pages work |
| Platform Admin | WF-075 (Credential Templates) | MISSING | No UI exists |

---

## Registry 5: Dead Interaction Report

| ID | Element | File | Issue | Severity | Notes |
|----|---------|------|-------|----------|-------|
| J-M11-001 | Download PDF button (ID Card) | `my/id-card.tsx` | Button rendered `disabled` with no onClick -- permanently non-functional | P1 | Spec WF-071 requires PDF download; button exists but does nothing |
| J-M11-002 | QR Code placeholder (ID Card) | `my/id-card.tsx` | Static div with text "QR Code" -- no QR image generation | P1 | Spec requires HMAC-signed QR code for verification |
| J-M11-042 | Download PDF button (Certificate) | `certificate-preview.tsx` | onClick shows `alert('PDF download will be available in a future update.')` | P1 | Spec WF-074 requires downloadable certificate PDF |
| J-M11-013 | QR scan-to-verify (Certificate verify page) | `verify/$certificateNumber.tsx` | Shows `window.location.href` as text, no actual QR code image | P2 | Nice-to-have: render actual QR for re-scanning |
| -- | unitOnly access label mismatch | `org/$orgSlug/documents/$documentId.tsx` | `accessLevelLabel('unitOnly')` returns "Officers Only" but document-library.tsx maps it to "Unit Only" | P3 | Inconsistent labeling between member and officer views |

---

## Registry 6: Navigation Integrity

| From | To | Link Element | Route Exists | Params Correct | Notes |
|------|----|--------------|--------------|----------------|-------|
| /my/certificates (list) | /my/certificates/$certificateId | CertificateList item link | YES | YES (certificateId) | -- |
| /my/certificates/$certificateId | /verify/certificate/$certNumber | Constructed URL (clipboard copy) | PARTIAL | -- | URL constructed as `/verify/certificate/${cert.certificateNumber}` but route is `/verify/$certificateNumber` -- path mismatch |
| /org/$orgSlug/documents (list) | /org/$orgSlug/documents/$documentId | DocumentBrowser item Link | YES | YES (orgSlug, documentId) | -- |
| /org/$orgSlug/documents/$documentId | /org/$orgSlug/documents (back) | Back button Link | YES | YES | -- |
| /org/$orgSlug/documents/$documentId | Download href | `<a>` tag to `/api/association/documents/${documentId}/download` | API route | YES | Direct download link, not SPA nav |
| /org/$orgSlug/officer/documents (list) | /org/$orgSlug/officer/documents/$documentId | DocumentCard Link | YES | YES (orgSlug, documentId) | -- |
| /org/$orgSlug/officer/documents/$documentId | /org/$orgSlug/officer/documents (back) | Back button Link | YES | YES | -- |
| /org/$orgSlug/officer/documents/$documentId | Download href | `<a>` tag to `/api/association/documents/${documentId}/download` | API route | YES | Same download pattern as member view |
| /dashboard | /my/id-card | Sidebar/nav link | YES | -- | -- |
| /dashboard | /my/certificates | Sidebar/nav link | YES | -- | -- |
| /org/$orgSlug/officer/dashboard | /org/$orgSlug/officer/documents | Sidebar/nav link | YES | YES (orgSlug) | -- |
| /org/$orgSlug/officer/dashboard | /org/$orgSlug/officer/certificates | Sidebar/nav link | YES | YES (orgSlug) | -- |

---

## Findings Summary

### P0 Findings (Blockers)

None.

### P1 Findings (High)

| Finding | WF | Details | Affected Elements |
|---------|----|---------|-------------------|
| **ID Card PDF download non-functional** | WF-071 | Download PDF button is permanently `disabled`. No PDF generation backend wired. Spec requires PDF with HMAC-signed QR code. | J-M11-001 |
| **ID Card QR code is placeholder** | WF-071 | QR code section renders a static colored div with text "QR Code". No actual QR generation (e.g., qrcode.js or server-side). Spec requires HMAC-signed QR for public verification. | J-M11-002 |
| **Certificate PDF download stubbed** | WF-074 | onClick fires `alert()` instead of downloading. No PDF generation endpoint connected. Spec requires downloadable training certificate. | J-M11-042 |
| **Verification URL path mismatch** | WF-074 | CertificatePreview constructs URL as `/verify/certificate/${cert.certificateNumber}` but actual route file is `/verify/$certificateNumber.tsx` (no `/certificate/` segment). Clicking "Copy Verification Link" produces a broken URL. | J-M11-043 |

### P2 Findings (Medium)

| Finding | WF | Details | Affected Elements |
|---------|----|---------|-------------------|
| **Credential Template Management missing** | WF-075 | No frontend routes or components exist. API contracts define 4 endpoints under `/orgs/:id/credential-templates`. Feature-flagged as P2. | J-M11-050 through J-M11-052 |
| **No actual QR image on verify pages** | WF-072 | Certificate verify page shows URL text where QR code should be. No QR rendering library used. | J-M11-013 |
| **No auto-regeneration UI feedback** | WF-071 | Spec BR-19 requires ID card regeneration on profile/status change. No UI indicator shows when card was last generated or if regeneration is pending. | -- |

### P3 Findings (Low)

| Finding | WF | Details |
|---------|----|---------|
| **Access level label inconsistency** | WF-073 | Member document detail maps `unitOnly` to "Officers Only"; officer document library maps it to "Unit Only". Should be consistent. |
| **Certificate verify page uses non-SDK fetch** | WF-072 | `verify/$certificateNumber.tsx` uses raw `api.get()` instead of generated SDK hook. `verify/$credentialNumber.tsx` same pattern. Both work but bypass SDK type safety. |
| **Alert-based UX for clipboard + PDF stub** | WF-074 | Uses `alert()` for both clipboard success and PDF stub. Should use `sonner` toast per project conventions. |

---

## Architecture Notes

- **Component architecture is well-structured:** Routes delegate to feature components (`DocumentBrowser`, `DocumentLibrary`, `CertificateList`, `CertificatePreview`), maintaining separation.
- **SDK usage is strong in document management:** Officer document library uses generated SDK mutations (`createDocumentMutation`, `archiveDocumentMutation`, `deleteDocumentMutation`, `updateDocumentMutation`, `uploadNewDocumentVersionMutation`). Query hooks from `@monobase/sdk-ts/generated/@tanstack/react-query.gen` are used correctly.
- **Verification pages bypass SDK:** Both `/verify/$certificateNumber` and `/verify/$credentialNumber` use raw `api.get()` calls. This is acceptable for public (unauthenticated) routes where SDK auth headers aren't needed, but loses type safety.
- **Document access log is officer-only:** Correctly scoped -- only visible on officer detail page (`/officer/documents/$documentId`), not on member document detail.
- **Member document browser enforces access levels:** Client-side filter restricts to `public` + `tenantOnly` documents. Server-side should also enforce this.
- **Credential list component is separate from certificates:** `credential-list.tsx` in `features/membership/` handles professional licenses (PRC licenses), not training certificates. Distinct bounded context correctly maintained.
