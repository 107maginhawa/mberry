<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Components: Member Profile & Settings (M02)

---

## C01: OrgMembershipCard

**WAI-ARIA Pattern:** none (article landmark)
**Used In:** S01 Profile Overview

### TypeScript Props Interface

```typescript
interface OrgMembershipCardProps {
  /** Organization name */
  orgName: string;
  /** Organization ID for navigation */
  orgId: string;
  /** Membership status computed from duesExpiryDate (BR-01) */
  status: 'active' | 'grace' | 'lapsed' | 'pending';
  /** Membership category */
  category: string;
  /** Dues expiry date (ISO 8601) */
  duesExpiryDate: string;
  /** Organization logo URL */
  orgLogoUrl?: string;
  /** Called when card clicked */
  onClick?: (orgId: string) => void;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Focus on card (if clickable) |
| Enter / Space | Navigate to org detail or ID card |

### Render Contract

- Card container with org logo (or initials fallback), org name, category, status badge
- Status badge colors: active=green, grace=amber, lapsed=red, pending=blue
- Expiry date formatted per locale
- Click navigates to /my/id-card?org={orgId}

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onClick | Card clicked | `orgId: string` |

### States

| State | Visual |
|-------|--------|
| Default | Card with status badge |
| Loading | Skeleton card |
| Active | Green badge "Active" |
| Grace | Amber badge "Grace Period" |
| Lapsed | Red badge "Lapsed" |
| Pending | Blue badge "Pending" |

---

## C02: PhotoCropUpload

**WAI-ARIA Pattern:** dialog (crop modal)
**Used In:** S02 Profile Edit

### TypeScript Props Interface

```typescript
interface PhotoCropUploadProps {
  /** Current photo URL */
  currentPhotoUrl?: string;
  /** Called with cropped image blob */
  onUpload: (blob: Blob) => Promise<string>;
  /** Called when photo removed */
  onRemove: () => void;
  /** Maximum file size in bytes (default: 5MB per M2-R9) */
  maxFileSize?: number;
  /** Accepted formats */
  acceptedFormats?: string[];
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Focus upload button / remove button |
| Enter / Space | Open file picker or crop dialog |
| Escape | Close crop dialog without saving |
| Arrow keys | Move crop area within dialog |

### Render Contract

- Circular preview of current photo (or default avatar)
- "Upload Photo" button (opens file picker)
- "Remove" button (if photo exists)
- On file select: crop dialog modal with circular mask
- Crop dialog: zoom slider, rotate button, "Save" / "Cancel" buttons
- Format validation: JPEG, PNG, WebP only (M2-R9)
- Size validation: max 5MB (M2-R9)
- SVG sanitization: strip scripts and event handlers (BR-31)

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onUpload | Crop saved | `Blob` (returns URL string) |
| onRemove | Remove clicked | — |
| onError | Invalid format/size | `Error` |

### States

| State | Visual |
|-------|--------|
| Default | Current photo or default avatar |
| Uploading | Spinner overlay on avatar |
| Cropping | Modal with crop controls |
| Error | "File too large" / "Unsupported format" text |
| Success | New photo preview shown |

---

## C03: PrivacyToggleGrid

**WAI-ARIA Pattern:** grid (role="grid" with switch cells)
**Used In:** S04 Settings (Privacy tab)

### TypeScript Props Interface

```typescript
interface PrivacyToggleGridProps {
  /** Per-org privacy settings */
  settings: OrgPrivacySetting[];
  /** Called when any toggle changes */
  onChange: (orgId: string, field: PrivacyField, enabled: boolean) => void;
  /** Whether save is in progress */
  saving?: boolean;
}

interface OrgPrivacySetting {
  organizationId: string;
  orgName: string;
  emailVisible: boolean;
  phoneVisible: boolean;
  photoVisible: boolean;
  addressVisible: boolean;
}

type PrivacyField = 'emailVisible' | 'phoneVisible' | 'photoVisible' | 'addressVisible';
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between toggle switches |
| Space | Toggle current switch |
| Arrow keys | Navigate grid cells |

### Render Contract

- Grid with org names as row headers
- Columns: Email, Phone, Photo, Address
- Each cell: toggle switch (`role="switch"`, `aria-checked`)
- Header row explains what each toggle controls
- Per-org grouping if multiple orgs

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onChange | Toggle flipped | `orgId, field, enabled` |

### States

| State | Visual |
|-------|--------|
| Default | Toggles at current values |
| Loading | Skeleton toggle grid |
| Saving | Toggles disabled, subtle spinner |
| Error | "Failed to save" per-row |
| Success | sonner toast "Privacy updated" |

---

## C04: NotificationPreferenceMatrix

**WAI-ARIA Pattern:** grid (role="grid" with switch cells)
**Used In:** S04 Settings (Notifications tab)

### TypeScript Props Interface

```typescript
interface NotificationPreferenceMatrixProps {
  /** Per-org notification preferences */
  preferences: OrgNotificationPreference[];
  /** Called when any toggle changes */
  onChange: (orgId: string, category: NotificationCategory, channel: 'push' | 'email', enabled: boolean) => void;
  /** Whether save is in progress */
  saving?: boolean;
}

interface OrgNotificationPreference {
  organizationId: string;
  orgName: string;
  categories: CategoryPreference[];
}

interface CategoryPreference {
  /** Category name */
  category: NotificationCategory;
  /** Push notification enabled */
  pushEnabled: boolean;
  /** Email notification enabled */
  emailEnabled: boolean;
}

type NotificationCategory = 'dues' | 'events' | 'trainings' | 'announcements' | 'credits';
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between toggle switches |
| Space | Toggle current switch |
| Arrow keys | Navigate grid cells |

### Render Contract

- Grid: categories as rows, channels (Push, Email) as columns
- Per-org section if multiple orgs
- In-app column: always on, disabled toggle with tooltip "In-app notifications cannot be disabled" (M2-R8)
- Each toggle: `role="switch"`, `aria-checked`, `aria-label="{category} {channel} notifications"`

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onChange | Toggle flipped | `orgId, category, channel, enabled` |

### States

| State | Visual |
|-------|--------|
| Default | Toggles at current values |
| Loading | Skeleton grid |
| Saving | Disabled toggles |
| Error | "Failed to save" banner |
| Success | sonner toast "Notification preferences updated" |

---

## C05: IdCardPreview

**WAI-ARIA Pattern:** none (presentational)
**Used In:** S03 Digital ID Card

### TypeScript Props Interface

```typescript
interface IdCardPreviewProps {
  /** Member's full name */
  fullName: string;
  /** License number */
  licenseNumber: string;
  /** Organization name */
  orgName: string;
  /** Membership status */
  membershipStatus: 'active' | 'grace' | 'lapsed';
  /** Membership category */
  membershipCategory: string;
  /** Dues expiry date (ISO 8601) */
  duesExpiryDate: string;
  /** Photo URL (optional, falls back to default avatar) */
  photoUrl?: string;
  /** QR code URL (HMAC-signed per BR-18) */
  qrCodeUrl: string;
  /** Organization logo URL */
  orgLogoUrl?: string;
}
```

### Render Contract

- Card-shaped container (aspect ratio ~1.586:1, credit card proportions)
- Top section: org logo + org name
- Left: circular photo (or default avatar)
- Right: name, license number, category
- Bottom: status badge (colored), expiry date
- QR code: bottom-right corner
- Lapsed overlay: semi-transparent red "LAPSED" stamp diagonal

### States

| State | Visual |
|-------|--------|
| Active | Green "ACTIVE" badge |
| Grace | Amber "GRACE PERIOD" badge |
| Lapsed | Red "LAPSED" badge + diagonal stamp |
| No photo | Default avatar silhouette |
| Loading | Skeleton card shape |

---

## C06: DataExportSection

**WAI-ARIA Pattern:** none (section)
**Used In:** S04 Settings (Data & Security tab)

### TypeScript Props Interface

```typescript
interface DataExportSectionProps {
  /** Current export status (null if no active export) */
  activeExport?: {
    exportId: string;
    status: 'requested' | 'processing' | 'ready' | 'expired';
    downloadUrl?: string;
    expiresAt?: string;
  };
  /** Called when export requested */
  onRequestExport: () => void;
  /** Whether request is in progress */
  requesting?: boolean;
}
```

### Render Contract

- "Export My Data" button
- If active export: status indicator + download link (when ready)
- Rate limit notice: "One export per 24 hours" (M2-R4)
- Ready state: "Download" button + expiry countdown "Expires in {N} days"
- Processing state: spinner + "Generating your export..."

### States

| State | Visual |
|-------|--------|
| Default | "Export My Data" button enabled |
| Requesting | Spinner on button |
| Processing | Progress indicator, button disabled |
| Ready | "Download" link + expiry date |
| Expired | "Export expired. Request a new one." |
| Rate limited | "You can request one export per 24 hours." button disabled |

---

## C07: AccountDeletionSection

**WAI-ARIA Pattern:** dialog (confirmation modal)
**Used In:** S04 Settings (Data & Security tab)

### TypeScript Props Interface

```typescript
interface AccountDeletionSectionProps {
  /** Whether deletion is already scheduled */
  deletionScheduled?: {
    scheduledDate: string;
  };
  /** Called when deletion requested */
  onRequestDeletion: (password: string) => void;
  /** Called when deletion cancelled */
  onCancelDeletion: () => void;
  /** Blocking reasons (if any) */
  blockers?: ('pending_payments' | 'sole_officer')[];
}
```

### Render Contract

- "Delete My Account" destructive button (red)
- If scheduled: countdown banner "Account will be deleted on {date}" + "Cancel" button
- Confirmation modal: password input, warning text, "Permanently Delete" button
- Blockers: list of reasons why deletion is blocked

### States

| State | Visual |
|-------|--------|
| Default | Red "Delete My Account" button |
| Blocked | Button disabled, blockers listed |
| Confirming | Modal open with password input |
| Scheduled | Countdown banner + "Cancel Deletion" button |
| Cancelling | Spinner on cancel button |
| Error | "Deletion request failed." |
