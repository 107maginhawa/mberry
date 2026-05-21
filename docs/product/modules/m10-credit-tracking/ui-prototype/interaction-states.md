<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M10 Credit Tracking -- Interaction States

## 9-State Pattern

All screens in the Credit Tracking module implement these 9 interaction states consistently.

---

### 1. Loading

**Trigger:** Initial data fetch on screen mount.
**Visual:**
- Skeleton progress bar (My Credits)
- Skeleton table rows (both screens)
- `aria-busy="true"` on main container
**Duration:** < 500ms typical. Progress indicator if > 2s.
**Transition:** Resolves to Empty, Success, or Error.

---

### 2. Empty

**Trigger:** Zero credit entries for the selected cycle (My Credits) or zero members (Org Compliance, unlikely).
**Visual:**
- My Credits: Progress bar at 0%, message "No credits yet. Complete a training or add manual credits.", "Add Manual Credit" CTA button
- Org Compliance: "No members found." (edge case for newly created org)
**ARIA:** `aria-live="polite"` region announces empty state.

---

### 3. Success

**Trigger:** API returns data with >= 1 record.
**Visual:**
- My Credits: Populated progress bar + credit entry table + active cycle info
- Org Compliance: Member compliance table with status badges
**Sub-variants:**
- Compliant cycle: green progress bar, checkmark
- At-risk: amber progress bar, warning icon
- Non-compliant: red progress bar, attention needed

---

### 4. Refreshing

**Trigger:** Background TanStack Query refetch or org/cycle selector change.
**Visual:**
- Subtle spinner in header area
- Existing data remains visible and interactive
- No layout shift
**ARIA:** `aria-busy="true"` only on data region being refreshed.

---

### 5. Error (UnexpectedError)

**Trigger:** API 5xx, network failure, or unexpected client error.
**Visual:**
- Alert banner: "Unable to load credits. Please try again."
- Retry button
- Cached data shown below if available
**ARIA:** `role="alert"`, focus moved to error banner.
**Recovery:** Retry button refetches.

---

### 6. PermissionError

**Trigger:** Non-officer accessing `/org/[id]/officer/credits`.
**Visual:**
- Redirect to org dashboard
- Toast: "Officer access required to view compliance data."
**ARIA:** Toast via `aria-live="assertive"`.
**Note:** My Credits screen has no PermissionError state (all members can view own).

---

### 7. ValidationError

**Trigger:** Invalid manual credit form submission or credit adjustment dialog.
**Visual:**
- Inline error messages below invalid fields
- Red border, `aria-invalid="true"`, `aria-errormessage`
- Focus on first invalid field

**Module-specific validation errors:**

| Context | Error | Message |
|---------|-------|---------|
| Manual credit | activityName empty | "Activity name is required" |
| Manual credit | future activityDate | "Activity date cannot be in the future" |
| Manual credit | credits <= 0 | "Credits must be a positive number" |
| Adjustment | reason too short | "Reason required (min 10 characters)" |
| Adjustment | credits = 0 | "Credit amount must be non-zero" |
| API | M10-003 | "Compliance cycle not found" |

---

### 8. Mutating

**Trigger:** POST request in flight (manual credit add or officer credit adjustment).
**Visual:**
- Action button shows spinner
- Form fields disabled
- Text: "Adding credit..." or "Adjusting credits..."
**ARIA:** `aria-disabled="true"`, `aria-busy="true"` on form.
**Success:** Toast "Credit entry added" or "Credits adjusted for {name}", data refetches.
**Failure:** Toast with error, form re-enabled, data preserved.

---

### 9. Downloading / Exporting

**Trigger:** Transcript download (PDF/CSV) or compliance CSV export.
**Visual:**
- Download button shows spinner
- Text changes: "Generating transcript..." or "Generating export..."
- Other UI remains interactive
**ARIA:** `aria-busy="true"` on the download button only.
**Success:** Browser download dialog opens, button resets.
**Failure:** Toast "Unable to generate transcript. Please try again."

---

## State Transition Diagram

```
Loading ──────► Empty (0 entries)
    │                │
    │                └──► Mutating (add manual credit) ──► Success
    │
    ├────────► Success (data loaded)
    │              │
    │              ├──► Refreshing (org/cycle change) ──► Success / Empty
    │              │
    │              ├──► Mutating (add credit / adjust) ──► Success + toast
    │              │         │
    │              │         └──► Error toast (mutation failed) ──► Success
    │              │
    │              ├──► Downloading (transcript) ──► Success + file download
    │              │
    │              └──► ValidationError (form errors) ──► Success (corrected)
    │
    ├────────► Error (API failure)
    │              │
    │              └──► Loading (retry)
    │
    └────────► PermissionError (officer screen, non-officer)
                   │
                   └──► Redirect + toast
```

---

## Cross-Module State Dependencies

| Event | Source | Effect on M10 Screens |
|-------|--------|-----------------------|
| `CreditAwarded` | M09 Training attendance | My Credits auto-refreshes, new auto entry appears |
| `CreditAdjusted` | Officer adjustment | Compliance table row updates |
| `MembershipStatusChanged` | M04 Membership | Compliance table may add/remove member |

These events trigger TanStack Query invalidation for real-time UI updates.
