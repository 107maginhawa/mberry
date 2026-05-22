<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M11 Documents & Credentials -- Interaction States

## 9-State Pattern

All screens in the Documents & Credentials module implement these 9 interaction states consistently.

---

### 1. Loading

**Trigger:** Initial data fetch on screen mount.
**Visual:**
- My ID Card: skeleton card placeholder (credit-card ratio)
- My Certificates: skeleton table rows
- Verification Page: skeleton verification card with spinner
- Org Documents: skeleton table rows
- `aria-busy="true"` on main container
**Duration:** < 500ms typical.
**Transition:** Resolves to Empty, Success, Error, or specific result state.

---

### 2. Empty

**Trigger:** No data available for the primary entity.
**Visual by screen:**
- My ID Card: "No ID card available. Complete your profile to generate one." (missing required profile fields)
- My Certificates: "No certificates yet. Complete a training to earn your first certificate."
- Verification Page: N/A (uses NotFound instead)
- Org Documents (member): "No documents published yet."
- Org Documents (officer): "No documents yet. Upload your first document." + Upload CTA
**ARIA:** `aria-live="polite"` region.

---

### 3. Success

**Trigger:** Data loaded with content to display.
**Visual by screen:**
- My ID Card: rendered card with member details and QR
- My Certificates: populated certificate table
- Verification (valid): green checkmark card with credential details
- Verification (invalid): red X card with "could not be verified" message
- Org Documents: document table with actions

**Sub-variants for Verification:**
- Valid: green theme, checkmark, full credential details
- Invalid: red theme, X icon, no details revealed
- Both are "success" states of the verification process (different outcomes)

---

### 4. Refreshing

**Trigger:** Background refetch or data invalidation.
**Visual:**
- Subtle spinner in header
- Existing content remains visible
- My ID Card: may show "Updating your ID card..." if regenerating after profile change
- Verification Page: N/A (one-shot, no refresh)
**ARIA:** `aria-busy="true"` only on updating region.

---

### 5. Error (UnexpectedError)

**Trigger:** API 5xx, network failure, storage service unavailable (EXT-003).
**Visual:**
- Alert banner with error message and retry button
- Screen-specific messages:
  - ID Card: "Unable to load your ID card."
  - Certificates: "Unable to load certificates."
  - Verification: "Verification service unavailable. Please try again."
  - Documents: "Unable to load documents."
**ARIA:** `role="alert"`, focus moved to alert.
**Special:** Certificate template rendering failure (M11-004): "Unable to generate certificate. Please try again later."

---

### 6. PermissionError

**Trigger:** Accessing a resource owned by another user, or accessing officer features without role.
**Visual:**
- My ID Card / My Certificates: 404 page if attempting to access another's data (no information leak)
- Org Documents: members see only published documents (role-based filtering, not redirect)
- Officer document actions: hidden for non-officers
**Note:** Never reveal resource existence to unauthorized users.

---

### 7. ValidationError

**Trigger:** Invalid form submission in document upload or version upload.
**Visual:**
- Inline error messages below fields in upload dialog
- Red border on invalid fields
- `aria-invalid="true"`, `aria-errormessage`
- Focus on first invalid field

**Module-specific validation errors:**

| Context | Error Code | Message |
|---------|------------|---------|
| File upload | VALIDATION-006 | "File too large (max 50MB)" |
| File upload | VALIDATION-006 | "Unsupported file type" |
| Document title | VALIDATION-001 | "Title is required" |
| Tag | -- | "Tag too long (max 50 characters)" |
| Certificate download | M11-004 | "Certificate template rendering failed" |

---

### 8. Mutating

**Trigger:** File upload, document status change, or document deletion in progress.
**Visual:**
- Upload: progress bar with percentage and cancel button
- Publish/Archive: action button spinner, "Publishing..." / "Archiving..."
- Delete: confirmation dialog, then spinner
- Certificate download: download button spinner, "Generating..."
**ARIA:** `aria-disabled="true"` on other actions, `aria-busy="true"` on active element.
**Success:** Toast via sonner, list refetches.
**Failure:** Toast with error, controls re-enabled.

---

### 9. Contextual State (varies by screen)

Each screen has a unique 9th state:

**My ID Card -- Regenerating:**
- Triggered by PersonUpdated or MembershipStatusChanged event (BR-19)
- "Updating your ID card with new information..."
- Brief overlay on card, auto-resolves to Success

**My Certificates -- Pending:**
- Certificate exists but training attendance not yet confirmed
- Shows "Certificate Pending" label, download button disabled
- Resolves to downloadable when attendance confirmed

**Verification Page -- NotFound:**
- Token not recognized in system
- Gray card: "No credential found for this verification code."
- No retry (dead end), link back to home

**Org Documents -- Uploading:**
- File upload in progress with progress bar
- Cancel button available
- Other document actions remain available

---

## State Transition Diagram

```
Loading ──────► Empty (no data)
    │                │
    │                └──► Mutating (upload/create) ──► Success
    │
    ├────────► Success
    │              │
    │              ├──► Refreshing (background) ──► Success
    │              │
    │              ├──► Mutating (upload, publish, archive, delete, download)
    │              │         │
    │              │         ├──► Success + toast
    │              │         └──► Error toast ──► Success
    │              │
    │              └──► ValidationError (form) ──► Success (corrected)
    │
    ├────────► Error (API/network/storage)
    │              │
    │              └──► Loading (retry)
    │
    └────────► PermissionError (404 / role filter)

Verification-specific:
Loading ──► Valid | Invalid | NotFound | Error
```

---

## Cross-Module State Dependencies

| Event | Source | Effect on M11 Screens |
|-------|--------|-----------------------|
| `PersonUpdated` | M01 Person | My ID Card regenerates (BR-19) |
| `MembershipStatusChanged` | M04 Membership | My ID Card regenerates (BR-19) |
| `TrainingCompleted` + `AttendanceConfirmed` | M09 Training | New certificate appears in My Certificates |
| `CredentialGenerated` | M11 (self) | First certificate download triggers event + access log |
