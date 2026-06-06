# 04 — Frontend Interaction Integrity
## Module: Documents / Certificates / Storage

---

## Documents

### Component: `DocumentBrowser`
**File**: `apps/memberry/src/features/documents/components/document-browser.tsx`
**Used on**: `/org/:orgSlug/documents` (member-facing)

| Interaction | Implementation | Gap |
|-------------|---------------|-----|
| Search by title/tag | Input with debounced state → `searchDocumentsOptions(orgId, query)` | OK |
| Category tab filtering | Client-side filter on returned data (tabs: all/bylaws/minutes/policies/etc.) | OK |
| accessLevel filtering | **Client-side only** — DocumentBrowser filters `['public','tenantOnly']` locally | P0: backend `searchDocuments` passes `accessLevel` as caller-supplied query param — frontend could be bypassed |
| Click to document detail | `Link` to `/org/:orgSlug/documents/:documentId` | OK |
| Empty state | Renders `EmptyState` when no docs | OK |

**P0 Finding — Access level enforcement is client-side only:**
```tsx
// document-browser.tsx (inferred from test)
// filters = data filtered to ['public','tenantOnly'] client-side
// If member bypasses frontend and calls API directly with accessLevel=privileged, they get privileged docs
// Backend searchDocuments does NOT enforce: accessLevel: query.accessLevel (caller controls)
```

### Component: `DocumentLibrary`
**File**: `apps/memberry/src/features/documents/components/document-library.tsx`
**Used on**: `/org/:orgSlug/officer/documents` (officer-facing)

| Interaction | Implementation | Gap |
|-------------|---------------|-----|
| Upload document | Drag-drop + file picker → creates document record then calls storage upload | OK flow |
| Publish draft | Dropdown menu → `updateDocumentMutation` sets status=published | OK |
| Archive document | Dropdown menu → `archiveDocumentMutation` | OK (backend has no role check) |
| Delete document | Dropdown menu → `deleteDocumentMutation` | OK (backend has no role check) |
| Status filter | Client-side tab: draft/published/archived | OK |
| Category filter | Client-side tabs | OK |
| Access level selector in upload | Dropdown with public/tenantOnly/unitOnly/restricted/privileged | OK |
| View Details | Link to `/org/:orgSlug/officer/documents/:documentId` | OK |

**P1 Finding — No frontend officer guard on DocumentLibrary:**
The route `/org/:orgSlug/officer/documents` is under `_authenticated` but there is no documented frontend guard verifying the user is an officer before mounting the component. Archive/delete/publish mutations fire against the backend which also lacks role checks.

### Component: `CertificateList`
**File**: `apps/memberry/src/features/certificates/components/certificate-list.tsx`
**Used on**: `/my/certificates`

| Interaction | Implementation | Gap |
|-------------|---------------|-----|
| List own certificates | `listMyCertificatesOptions` with `x-org-id` header | OK |
| Link to certificate detail | `Link to="/my/certificates/$certificateId"` | OK |
| Empty state | Renders `EmptyState` when no certs | OK |
| Org context required | `enabled: !!orgId` guard | OK |

### Component: `CertificatePreview`
**File**: `apps/memberry/src/features/certificates/components/certificate-preview.tsx`
**Used on**: `/my/certificates/:certificateId`

| Interaction | Implementation | Gap |
|-------------|---------------|-----|
| Fetch certificate | `getCertificateOptions` by ID | P1: backend `getCertificate` has no owner check — IDOR |
| Download PDF button | Exists in UI | P1: calls `generateCertificatePdf` (HTML response, not binary PDF) — spec expects binary PDF download |
| Copy Verification Link | Button renders | P2: verification URL format unconfirmed |
| Error state | "Certificate not found or you do not have permission" | OK (error boundary) |

---

## Storage

**No storage-specific frontend components found.**

Storage interactions are embedded inside:
1. `DocumentLibrary` — upload flow creates document metadata + initiates presigned PUT
2. No standalone file manager UI

**P2 Finding — No file upload progress feedback:**
The upload flow generates a presigned URL (`POST /storage/files/upload`) and expects the client to PUT directly to S3/MinIO. No frontend progress tracking component exists. Uploads could silently fail without user feedback.

**P2 Finding — `completeFileUpload` call from frontend unclear:**
After PUT to presigned URL, `POST /storage/files/:file/complete` must be called to mark file available. No frontend code confirms this step is reliably triggered.

---

## Interactive Element Summary

| Element | File | Works End-to-End | Gap |
|---------|------|-----------------|-----|
| Member document browser | document-browser.tsx | Partial | accessLevel enforced client-side only |
| Officer document library | document-library.tsx | Partial | No role gate, archive/delete unprotected |
| Document upload form | document-library.tsx | Partial | Complete-upload step unclear |
| Certificate list | certificate-list.tsx | Yes | OK |
| Certificate detail/preview | certificate-preview.tsx | Partial | IDOR on backend, PDF download incomplete |
| Certificate download PDF | certificate-preview.tsx | No | Backend returns HTML not binary PDF |
| Certificate verify link | certificate-preview.tsx | Partial | Frontend UI only |
| Storage file browser | — | Missing | No UI |
