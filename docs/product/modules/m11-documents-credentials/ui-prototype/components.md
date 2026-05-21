<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M11 Documents & Credentials -- Component Specifications

## Table of Contents
1. [MemberIdCard](#memberidcard)
2. [CertificateListItem](#certificatelistitem)
3. [VerificationResult](#verificationresult)
4. [DocumentRow](#documentrow)
5. [DocumentUploadDialog](#documentuploaddialog)
6. [DocumentVersionList](#documentversionlist)
7. [DocumentAccessLogTable](#documentaccesslogtable)
8. [TagChip](#tagchip)
9. [QrCodeDisplay](#qrcodedisplay)
10. [FileUploadProgress](#fileuploadprogress)

---

## MemberIdCard

**Purpose:** Renders the digital member ID card with organization branding.
**Used in:** My ID Card screen

### TypeScript Props

```typescript
interface MemberIdCardProps {
  card: {
    memberName: string;
    memberPhoto: string | null;
    membershipNumber: string;
    organizationName: string;
    organizationLogo: string | null;
    memberSince: string; // ISO 8601
    membershipStatus: "active" | "suspended" | "expired" | "revoked";
    expiryDate: string | null;
    qrCodeUrl: string;
  };
  onDownloadPdf: () => void;
  onDownloadImage: () => void;
  onShare?: () => void;
  isDownloading: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Image with descriptive content
- **Implementation:** `<article aria-label="Member ID card for {memberName}">`, photo has `alt="{memberName} photo"`, QR has `alt="Verification QR code"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between download and share buttons |
| Enter | Activate focused button |

### Render Contract

- Credit-card ratio container (85.6mm x 53.98mm aspect)
- Organization logo and name header
- Member photo (left) + details (right): name, membership number, member since, status
- QR code in bottom-right
- Expired status: "EXPIRED" watermark overlay at 45deg rotation, reduced opacity
- Missing photo: initials avatar (first letter of first + last name)
- Sanitized SVG logo per M11-R2

### Events

| Event | Payload | When |
|-------|---------|------|
| onDownloadPdf | -- | Download PDF clicked |
| onDownloadImage | -- | Download Image clicked |
| onShare | -- | Share clicked |

### States

- Loaded: full card rendered
- Downloading: button spinner
- Expired: watermark overlay
- Missing photo: initials fallback

---

## CertificateListItem

**Purpose:** Single certificate entry in the certificate list.
**Used in:** My Certificates screen

### TypeScript Props

```typescript
interface CertificateListItemProps {
  certificate: {
    id: string;
    certificateNumber: string;
    trainingTitle: string;
    trainingDate: string;
    creditAmount: number;
    organizationName: string;
    issuedAt: string;
  };
  onDownload: (id: string) => void;
  onView: (id: string) => void;
  isDownloading: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Row / List item
- **Implementation:** `<tr>` or `<li>` with `aria-label="Certificate: {trainingTitle}"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter | View certificate detail |
| Tab | Move between view and download actions |

### Render Contract

- Columns/fields: training title, date, credits, org, certificate number
- Download button with PDF icon
- View link navigates to certificate detail page
- Downloading state: spinner on download button

### Events

| Event | Payload | When |
|-------|---------|------|
| onDownload | `(id: string)` | Download clicked |
| onView | `(id: string)` | View clicked |

---

## VerificationResult

**Purpose:** Displays the outcome of a credential verification check.
**Used in:** Verification Page screen

### TypeScript Props

```typescript
interface VerificationResultProps {
  status: "valid" | "invalid" | "not-found" | "loading" | "error";
  credential?: {
    memberName: string;
    credentialType: "certificate" | "member-id";
    organizationName: string;
    issuedDate: string;
    trainingTitle?: string;
    creditAmount?: number;
    membershipNumber?: string;
  };
}
```

### WAI-ARIA Pattern

- **Pattern:** Alert (result announcement)
- **Implementation:** `<div role="alert" aria-live="assertive">` wrapping the result

### Keyboard Spec

Not interactive (read-only result).

### Render Contract

| Status | Visual |
|--------|--------|
| valid | Green card: large checkmark icon, "This credential is verified.", credential details below |
| invalid | Red card: X icon, "This document could not be verified. It may have been tampered with." |
| not-found | Gray card: question icon, "No credential found for this verification code." |
| loading | Skeleton card with spinner |
| error | Amber card: warning icon, "Verification service unavailable. Please try again." |

- Valid result shows: member name, credential type, org name, issue date
- Certificate: also shows training title and credit amount
- Member ID: also shows membership number
- Organization logo displayed if available

### Events

None (presentational).

### States

Matches the `status` prop -- single-state rendering.

---

## DocumentRow

**Purpose:** Single document row in the organization documents table.
**Used in:** Org Documents screen

### TypeScript Props

```typescript
interface DocumentRowProps {
  document: {
    id: string;
    title: string;
    status: "draft" | "published" | "archived";
    tags: string[];
    currentVersion: number;
    uploadedByName: string;
    updatedAt: string;
    fileSize: number; // bytes
    mimeType: string;
  };
  role: "member" | "officer";
  isExpanded: boolean;
  onToggleVersions: (id: string) => void;
  onPublish?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUploadVersion?: (id: string) => void;
  onViewAccessLog?: (id: string) => void;
  onDownload: (id: string) => void;
  onTagClick: (tag: string) => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Expandable row (disclosure)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- **Implementation:** Version history toggle uses `aria-expanded`, `aria-controls` pointing to version panel

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter | Expand/collapse version history |
| Tab | Move between row actions |
| Space | Activate focused button |

### Render Contract

- File type icon based on mimeType (PDF, DOC, XLS, image)
- Status badge: draft (gray), published (green), archived (amber)
- Tag chips (clickable for filtering)
- Version number: "v{n}"
- File size formatted: KB/MB
- Officer actions: publish, archive, delete, upload version, access log
- Member: download only
- Archived: dimmed row, download still available for officers

### Events

| Event | Payload | When |
|-------|---------|------|
| onToggleVersions | `(id)` | Expand clicked |
| onPublish | `(id)` | Publish clicked |
| onArchive | `(id)` | Archive clicked |
| onDelete | `(id)` | Delete clicked (shows confirmation) |
| onUploadVersion | `(id)` | Upload New Version clicked |
| onViewAccessLog | `(id)` | Access Log clicked |
| onDownload | `(id)` | Download clicked |
| onTagClick | `(tag)` | Tag chip clicked |

---

## DocumentUploadDialog

**Purpose:** Dialog for uploading a new document or a new version of an existing document.
**Used in:** Org Documents screen

### TypeScript Props

```typescript
interface DocumentUploadDialogProps {
  open: boolean;
  mode: "new" | "version";
  documentTitle?: string; // pre-filled for version mode
  onSubmit: (values: DocumentUploadValues) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  uploadProgress: number; // 0-100
}

interface DocumentUploadValues {
  file: File;
  title: string;
  tags: string[];
  versionNotes?: string; // version mode only
}
```

### WAI-ARIA Pattern

- **Pattern:** Dialog (modal)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **Implementation:** `<dialog aria-label="Upload document" aria-modal="true">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Escape | Close dialog (with unsaved changes warning if file selected) |
| Tab | Trap focus within dialog |
| Enter | Submit (on submit button) |

### Render Contract

- File drop zone with drag-and-drop support
- Title input (pre-filled in version mode, readonly)
- Tags input (comma-separated or chips)
- Version notes textarea (version mode only)
- Upload progress bar during submission
- File type validation before upload starts

### Validation

| Field | Rule | Error |
|-------|------|-------|
| file | required, max 50MB, allowed MIME types | "Select a file" / "File too large" / "Unsupported type" |
| title | required, max 300 chars | "Title is required" |
| tags | each max 50 chars, max 10 tags | "Tag too long" / "Maximum 10 tags" |

### Events

| Event | Payload | When |
|-------|---------|------|
| onSubmit | `DocumentUploadValues` | Valid form submitted |
| onClose | -- | Cancel or Escape |

### States

- Empty: drop zone with "Drag & drop or click to upload"
- FileSelected: file name + size shown, ready to submit
- Uploading: progress bar, cancel button
- Error: inline validation errors
- Success: auto-close, toast

---

## DocumentVersionList

**Purpose:** Expandable list of document versions with download links.
**Used in:** DocumentRow (expanded state)

### TypeScript Props

```typescript
interface DocumentVersionListProps {
  versions: DocumentVersion[];
  onDownload: (versionId: string) => void;
}

interface DocumentVersion {
  id: string;
  versionNumber: number;
  uploadedByName: string;
  createdAt: string;
  fileSize: number;
  notes?: string;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<ul aria-label="Version history">` within a disclosure panel

### Render Contract

- List of versions in reverse chronological order (newest first)
- Each version: "v{n} -- {date} -- {uploadedBy} -- {fileSize}" with download link
- Version notes shown if present
- Current (latest) version highlighted

---

## DocumentAccessLogTable

**Purpose:** Audit log of who accessed a document and when.
**Used in:** Org Documents screen (officer view)

### TypeScript Props

```typescript
interface DocumentAccessLogTableProps {
  logs: AccessLogEntry[];
  isLoading: boolean;
}

interface AccessLogEntry {
  id: string;
  personName: string;
  action: "view" | "download";
  timestamp: string;
  ipAddress: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** Table
- **Implementation:** `<table aria-label="Document access log">`

### Render Contract

- Columns: Person, Action (badge), Timestamp, IP Address
- Sorted by timestamp descending
- Paginated if > 50 entries

---

## TagChip

**Purpose:** Clickable tag chip for document categorization and filtering.
**Used in:** DocumentRow, DocumentUploadDialog

### TypeScript Props

```typescript
interface TagChipProps {
  tag: string;
  onClick?: (tag: string) => void;
  onRemove?: (tag: string) => void;
  variant: "display" | "editable";
}
```

### WAI-ARIA Pattern

- **Implementation:** Display: `<span role="button" aria-label="Filter by tag: {tag}">`. Editable: includes `<button aria-label="Remove tag: {tag}">`.

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter / Space | Click (filter) or remove |

---

## QrCodeDisplay

**Purpose:** Renders a QR code linking to a verification URL.
**Used in:** MemberIdCard, CertificatePreview

### TypeScript Props

```typescript
interface QrCodeDisplayProps {
  url: string;
  size?: number; // px, default 128
  alt: string;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<img role="img" alt="{alt}" />` or SVG with `aria-label`

### Render Contract

- QR code generated client-side from URL
- High error correction level (QR code may be printed/scanned from paper)
- Minimum 128px for scanability

---

## FileUploadProgress

**Purpose:** Progress indicator for file uploads.
**Used in:** DocumentUploadDialog

### TypeScript Props

```typescript
interface FileUploadProgressProps {
  progress: number; // 0-100
  fileName: string;
  fileSize: number;
  onCancel: () => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Progressbar
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/meter/
- **Implementation:** `<div role="progressbar" aria-valuenow="{progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Uploading {fileName}">`

### Render Contract

- Progress bar fill
- "{progress}%" text
- File name and size
- Cancel button (X icon)
- Completed: green checkmark, auto-dismiss after 1s
