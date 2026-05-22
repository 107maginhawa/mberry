<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M09 Training -- Interaction States

## 9-State Pattern

All screens in the Training module implement these 9 interaction states consistently.

---

### 1. Loading

**Trigger:** Initial data fetch, navigation to screen.
**Visual:**
- Skeleton loaders matching content layout (table rows, cards, form fields)
- No interactive elements visible until data loads
- `aria-busy="true"` on container
**Duration:** Typical < 500ms. If > 2s, show progress indicator.
**Transition:** Resolves to Empty, Success, Error, or PermissionError.

---

### 2. Empty

**Trigger:** API returns 0 results for the primary data set.
**Visual:**
- Centered illustration (training-related)
- Primary message varies by screen:
  - Dashboard: "No trainings yet. Create your first one."
  - My Training: "No training history yet."
  - Attendance: "No enrollments for this training."
- CTA button where applicable (e.g., "Create Training" on dashboard)
**ARIA:** `aria-live="polite"` region announces empty state message.

---

### 3. Success

**Trigger:** API returns data successfully with >= 1 record.
**Visual:**
- Full content rendered (tables, cards, forms with values)
- All interactive elements enabled
- `aria-busy="false"` on container
**Sub-variants:**
- Dashboard: populated table + analytics summary
- Attendance (Active): checkboxes enabled, Confirm & Award available
- Attendance (Locked): checkboxes disabled, "Already confirmed" banner
- My Training: tabbed card grid with credits summary
- Certificate: rendered certificate preview

---

### 4. Refreshing

**Trigger:** Background data refetch (TanStack Query stale-while-revalidate) or pull-to-refresh on mobile.
**Visual:**
- Subtle spinner in page header or table header
- Existing content remains visible and interactive
- No layout shift
**ARIA:** `aria-busy="true"` only on the updating region, not the whole page.

---

### 5. Error (UnexpectedError)

**Trigger:** API returns 5xx, network failure, or unexpected client error.
**Visual:**
- Alert banner (destructive variant): "Unable to load [resource]. Please try again."
- Retry button
- If partial data was cached, show stale data below the error banner
**ARIA:** `role="alert"` on error banner, focus moved to banner.
**Recovery:** Retry button calls refetch. If persistent, link to support.

---

### 6. PermissionError

**Trigger:** User lacks required role (e.g., member accessing officer-only screen), or 403 from API.
**Visual:**
- Redirect to appropriate parent screen (org dashboard for officers, /my for members)
- Toast: "You need officer access to manage trainings." or similar
**ARIA:** Toast announced via `aria-live="assertive"`.
**Note:** Never reveal the existence of a resource the user cannot access (return 404-like experience).

---

### 7. ValidationError

**Trigger:** Form submission with invalid data, or inline validation on blur.
**Visual:**
- Inline error messages below each invalid field
- Red border on invalid fields
- `aria-invalid="true"` on the field
- `aria-errormessage="{error-id}"` pointing to the error message element
- Error summary at top of form for multi-error cases
**Focus:** Moves to the first invalid field after submit attempt.
**Recovery:** Errors clear as user corrects individual fields.

**Module-specific validation errors:**
- M09-005: "Credit hours must be non-negative" (creditAmount < 0)
- M09-006: "Accredited provider not found or inactive"
- M09-009: "Non-credit-bearing flag conflicts with credit amount"

---

### 8. Mutating

**Trigger:** POST/PUT/DELETE request in flight after user action.
**Visual:**
- Action button shows spinner, text changes to "Publishing...", "Saving...", etc.
- Form fields disabled during mutation
- Other action buttons disabled to prevent double-submission
**ARIA:** `aria-disabled="true"` on disabled controls, `aria-busy="true"` on form.
**Duration:** Typical < 2s. If > 5s, show "This is taking longer than expected..." message.
**Recovery on failure:** Re-enable controls, show error toast via sonner, preserve form state.

---

### 9. ConfirmAction

**Trigger:** Destructive or significant actions requiring user confirmation.
**Visual:** Modal dialog (Radix AlertDialog) with:
- Description of the action
- Consequences (e.g., "Members will be notified", "This cannot be undone")
- Cancel and Confirm buttons

**Module-specific confirmations:**

| Action | Dialog Title | Body | Confirm Label |
|--------|-------------|------|---------------|
| Publish training | "Publish Training?" | "This training will be visible to all members. They will be notified." | "Publish" |
| Cancel training | "Cancel Training?" | "All enrolled members will be notified. Paid registrations will be refunded via the dues system." | "Cancel Training" |
| Award credits | "Confirm Attendance?" | "Award {n} CPD credits to {count} attendees? This action cannot be undone." | "Award Credits" |
| Cancel enrollment | "Cancel Enrollment?" | "You will be removed from this training." | "Cancel Enrollment" |
| Delete draft | "Delete Draft?" | "This training will be permanently deleted." | "Delete" |

**ARIA:**
- `role="alertdialog"` with `aria-modal="true"`
- Focus trapped within dialog
- Escape key closes dialog (cancels action)
- Focus returns to trigger button on close

---

## State Transition Diagram

```
Loading ──────► Empty (0 results)
    │
    ├────────► Success (data loaded)
    │              │
    │              ├──► Refreshing (background refetch) ──► Success
    │              │
    │              ├──► Mutating (user action) ──► Success + toast
    │              │         │
    │              │         └──► Error + toast (mutation failed)
    │              │
    │              └──► ConfirmAction (destructive action) ──► Mutating
    │                       │
    │                       └──► Success (cancelled)
    │
    ├────────► Error (API/network failure)
    │              │
    │              └──► Loading (retry)
    │
    └────────► PermissionError (403 / role check)
                   │
                   └──► Redirect + toast

ValidationError occurs within Success state (form context only).
```
