# 05 — Form / Modal / Table / Action Audit
## Module: Documents / Certificates / Storage

---

## Forms

### Document Upload Form
**File**: `apps/memberry/src/features/documents/components/document-library.tsx`
**Trigger**: Upload button in officer document library

| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| Title | Input text | Required (implicit) | No max-length visible in form |
| File | File picker | Drag-drop or click | Client hint: PDF/DOC/DOCX/XLS/XLSX/PNG/JPG up to 25MB |
| Category | Select | Optional | Categories: bylaws/minutes/policies/forms/announcements/election_results/financial_reports/other |
| Access Level | Select | Optional | public/tenantOnly/unitOnly/restricted/privileged |

**Gaps:**
- P1: Frontend says "up to 25MB" but backend enforces 50MB — inconsistent limits
- P2: No MIME type enforcement in form — file picker has no `accept` attribute confirmed
- P2: Title field missing `maxLength` enforcement (backend schema: varchar 300)
- P2: No field validation error display pattern — unclear if Zod errors propagate to UI

### Document Search Form
**File**: `apps/memberry/src/features/documents/components/document-browser.tsx`

| Field | Notes |
|-------|-------|
| Search input | Debounced text search → `q` query param |
| Category tabs | Filter: All/Bylaws/Minutes/etc. |

No validation required — search form, all optional.

---

## Modals

### Document Publish Confirm Dialog
**File**: `apps/memberry/src/features/documents/components/document-library.tsx` (test confirms)
**Trigger**: "Publish" in document card dropdown

| Element | Status |
|---------|--------|
| Dialog renders on click | Confirmed (test: `screen.getByRole('dialog')`) |
| Title "Publish Document" | Confirmed |
| Confirm/Cancel actions | Confirmed via test |

### Document Archive / Delete Confirm
Not explicitly tested but inferred from `onArchive`/`onDelete` callbacks in `DocumentCard`. No dedicated test for archive confirm dialog found.

---

## Tables / Lists

### Document Library (Officer View)
**File**: `apps/memberry/src/features/documents/components/document-library.tsx`

| Column/Field | Rendered | Notes |
|-------------|---------|-------|
| Document title | Yes | Link to detail |
| Status badge | Yes | draft/published/archived with color coding |
| Category badge | Yes | |
| Access level icon | Yes | Globe/Users/Shield/Lock icons |
| File size | Yes | Human-readable (KB/MB) |
| Last updated | Yes | `toLocaleDateString` |
| Actions dropdown | Yes | View/Publish/Archive/Delete |
| File type icon | Yes | FileText icon |

**Stat cards** (top of library):
- Total documents count
- (Other stats inferred from test `getByText('Total')`)

### Document Browser (Member View)
**File**: `apps/memberry/src/features/documents/components/document-browser.tsx`

| Element | Rendered | Notes |
|---------|---------|-------|
| Document title | Yes | |
| Category badge | Yes | |
| Public badge for public docs | Yes | |
| Search input | Yes | Placeholder: "Search documents by title or tag..." |
| Category tabs | Yes | All/Bylaws/Minutes/Policies/Forms/Announcements/Election Results/Financial Reports/Other |

### Certificate List (Member View)
**File**: `apps/memberry/src/features/certificates/components/certificate-list.tsx`

| Element | Rendered | Notes |
|---------|---------|-------|
| Certificate card | Yes | GlassCard with primary accent bar |
| "Training Certificate" label | Yes | Static label (no training title rendered from data) |
| Certificate number | Yes | `cert.certificateNumber` |
| Issued date | Yes | `cert.issuedAt` formatted |
| Link to detail | Yes | `/my/certificates/:id` |
| Empty state | Yes | Award icon + message |
| Loading skeleton | Yes | 3x CardSkeleton |

**P2 Gap**: Certificate card shows generic "Training Certificate" label — training title from `trainingId` is not resolved/displayed. Members cannot identify which training issued which cert without clicking through.

### Certificate Detail (CertificatePreview)
**File**: `apps/memberry/src/features/certificates/components/certificate-preview.tsx`

| Element | Rendered | Notes |
|---------|---------|-------|
| "Certificate of Completion" heading | Yes | Static, not cert-type-aware |
| Certificate number | Yes | |
| Training ID (raw UUID) | Yes | P2: Shows raw UUID not human-readable training name |
| Organization ID (raw UUID) | Yes | P2: Shows raw org UUID not org name |
| Issued date | Yes | |
| Download PDF button | Yes | P1: Returns HTML not binary PDF |
| Copy Verification Link button | Yes | |

---

## Action Inventory

| Action | Trigger | API Call | Role Guard Frontend | Role Guard Backend | Status |
|--------|---------|----------|--------------------|--------------------|--------|
| Create document | Upload form submit | `createDocumentMutation` | Officer route only | User auth only | P1 gap |
| Publish document | Dropdown → Publish | `updateDocumentMutation` | Officer route only | User auth only | P1 gap |
| Archive document | Dropdown → Archive | `archiveDocumentMutation` | Officer route only | User auth only | P1 gap |
| Delete document | Dropdown → Delete | `deleteDocumentMutation` | Officer route only | User auth only | P1 gap |
| Download certificate PDF | Button in CertificatePreview | `generateCertificatePdf` | Member route | Owner check | P1: HTML not PDF |
| Copy verification link | Button | Client-side copy | None required | N/A | P2 |
| Bulk issue certificates | Officer action (no frontend found) | `POST /certificates/bulk-issue` | — | requirePosition(PRESIDENT, SECRETARY) | P2: no frontend |
| Upload file | DocumentLibrary drag-drop | `POST /storage/files/upload` | Officer route | User auth | OK |
| Complete file upload | Post-PUT callback | `POST /storage/files/:file/complete` | Officer route | No ownership check | P0 backend |
