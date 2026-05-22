<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Interaction States: Membership (M05)

> Module-wide interaction state patterns. Each screen implements all 9 states.

---

## State 1: Loading

**Trigger:** Initial data fetch, navigation, filter change, pagination.

| Aspect | Implementation |
|--------|---------------|
| Visual | Skeleton UI matching final layout shape. Pulse animation on gray rectangles. |
| Duration | Typical: 200-500ms. Skeleton shows after 100ms delay to avoid flash. |
| ARIA | Container: `aria-busy="true"`. Live region: `aria-live="polite"` announces "Loading members..." |
| Interaction | Search/filter inputs rendered but disabled. Navigation functional. |
| Fallback | If > 5s: show "Taking longer than expected..." with cancel option. |

**Per-screen variants:**
- Roster: 10-row skeleton table with 6 columns
- Import wizard: step-specific loading (upload = spinner overlay, validation = progress bar)
- Directory: 6-card skeleton grid (3x2)
- Application review: 5-row skeleton list + blank detail panel

---

## State 2: Empty

**Trigger:** Zero records match current view (no filters active).

| Aspect | Implementation |
|--------|---------------|
| Visual | Centered illustration + heading + description + primary CTA. Muted colors. |
| ARIA | `role="status"`, `aria-label="No [entity] found"` |
| Interaction | CTA buttons fully functional. Filters hidden or collapsed. |

**Per-screen messages:**
- Roster: "No members yet. Import your roster or invite members." CTAs: Import CSV, Invite Members
- Import: N/A (always has upload zone)
- Directory: "No members in this organization's directory."
- Applications: "No pending applications." Illustration of happy members.

---

## State 3: Success

**Trigger:** Data loaded, records present.

| Aspect | Implementation |
|--------|---------------|
| Visual | Fully populated UI with all interactive elements enabled. |
| ARIA | `aria-busy="false"`. Table: `aria-rowcount` for total. Pagination: `aria-label` with page info. |
| Interaction | All search, filter, sort, selection, and action controls enabled. |
| Transitions | Smooth skeleton-to-content fade (150ms). |

**Success feedback (mutations):**
- Application approved: sonner toast "Application approved. Welcome email sent." (green, 5s auto-dismiss)
- Import complete: sonner toast "Import complete! X imported, Y linked, Z skipped." (green, persistent)
- Bulk action done: sonner toast "N members updated." (green, 3s auto-dismiss)

---

## State 4: Validation Error

**Trigger:** Invalid user input on forms or mutations.

| Aspect | Implementation |
|--------|---------------|
| Visual | Red border on invalid fields. Error text below field (text-destructive). Field icon changes to AlertCircle. |
| ARIA | `aria-invalid="true"` on field. `aria-describedby` links to error message. `aria-errormessage` for detailed errors. |
| Interaction | Submit button remains enabled. Focus moves to first error field. |
| Persistence | Errors clear on field change (optimistic). Re-validate on blur. |

**Per-screen errors:**
- Import: "Please upload a CSV file." (wrong type), "CSV missing required columns: email, firstName" (format), per-row errors in preview table
- Applications: "Please provide a reason for rejection." (reject without reason)
- Roster: N/A (read-only)
- Directory: N/A (read-only)

**Field-level format:**
```
[Label]
[Input with red border]
[AlertCircle icon] Error message text
```

---

## State 5: Permission Error

**Trigger:** User lacks required role or 2FA for the action.

| Aspect | Implementation |
|--------|---------------|
| Visual | Full-page 403 for page-level denial. Inline disabled state for action-level denial with tooltip. |
| ARIA | Page: `role="alert"`, `aria-live="assertive"`. Action: `aria-disabled="true"`, `title="[reason]"`. |
| Interaction | Page-level: back button and link to authorized area. Action-level: button appears grayed, hover shows reason. |

**Per-screen behavior:**
- Roster (member role): redirect to `/org/[id]/members` (directory, which members can access)
- Roster (user role): 403 page "You don't have access to the member roster."
- Import: "Importing members requires President or Secretary role with two-factor authentication."
- Applications: "Only the President or Secretary can review applications."
- Directory (non-member): "You must be a member of this organization to view the directory."

---

## State 6: Unexpected Error

**Trigger:** API 5xx, network failure, unhandled exception.

| Aspect | Implementation |
|--------|---------------|
| Visual | Error boundary component. Warning icon + message + retry button. Preserves page chrome (nav, sidebar). |
| ARIA | `role="alert"`, `aria-live="assertive"`. Retry button: `aria-label="Retry loading [content]"`. |
| Interaction | Retry button triggers re-fetch. Navigation still functional. |
| Logging | Error logged to console and observability (correlation ID). |

**Message template:** "Something went wrong loading [the roster | applications | the directory]. Please try again."

**Recovery:** Retry button calls `queryClient.invalidateQueries()` for the failed query. Exponential backoff on repeated failures (1s, 2s, 4s, max 3 retries before showing "persistent error" message with support link).

---

## State 7: Conflict/Duplicate

**Trigger:** Business rule violation on mutation (409, 422 with conflict semantics).

| Aspect | Implementation |
|--------|---------------|
| Visual | Yellow/amber alert banner within context. Not a full-page error. |
| ARIA | `role="alert"`, `aria-live="polite"`. Alert describes conflict and resolution options. |
| Interaction | Action blocked or requires confirmation to override. |

**Per-screen conflicts:**
- Application review: "This person already has an active membership in this organization." (M5-R5). Approve button disabled.
- Import preview: "N members matched existing accounts." Already-linked tab with match method (email or license).
- Import: ambiguous match (email -> PersonA, license -> PersonB): "This person matches two different accounts. Please resolve manually."
- Roster: manual add -> "Person already has membership in this organization." (M05-001, 409)

---

## State 8: Confirmation/Warning

**Trigger:** Destructive or irreversible actions requiring user acknowledgment.

| Aspect | Implementation |
|--------|---------------|
| Visual | Alert dialog (Radix AlertDialog) with clear description. Destructive actions use red confirm button. |
| ARIA | `role="alertdialog"`, `aria-labelledby`, `aria-describedby`. Focus trapped in dialog. |
| Interaction | Cancel returns to previous state. Confirm executes action. Escape = cancel. |

**Per-screen confirmations:**
- Import confirm (step 3): "Import X new members and link Y existing accounts? This action cannot be undone." [Cancel] [Confirm Import]
- Bulk approve: "Approve N applications? Each member will receive a welcome email and dues invoice." [Cancel] [Approve All]
- Bulk category change: "Change category for N members to [category]?" [Cancel] [Change Category]
- Reject application: "Reject [Name]'s application? They will be notified with your reason." [Cancel] [Reject]

**Dialog structure:**
```
[Title: Action confirmation]
[Description: what will happen]
[Cancel button (left)]  [Confirm button (right, red if destructive)]
```

---

## State 9: Offline/Sync

**Trigger:** Network connectivity lost (navigator.onLine === false or fetch timeout).

| Aspect | Implementation |
|--------|---------------|
| Visual | Amber banner at top of content area: "You're offline. [context-specific message]." |
| ARIA | `role="status"`, `aria-live="polite"`. Banner: `aria-label="Network status: offline"`. |
| Interaction | Read operations use cached TanStack Query data. Write operations disabled with tooltip "Requires internet connection." |
| Recovery | Banner auto-dismisses when connectivity restored. Stale queries refetch. |

**Per-screen behavior:**
- Roster: "You're offline. Roster data may be stale." Read-only mode with cached data. Bulk actions disabled.
- Import: "Import requires an internet connection." Upload and confirm disabled. Template download may work from cache.
- Directory: Cached cards shown. Search disabled (requires API).
- Applications: "Application review requires an internet connection." Review actions disabled. Cached list shown.

**Sync on reconnect:**
1. Banner updates: "Back online. Refreshing..."
2. Active queries invalidated and refetched
3. Banner dismissed after successful refetch
4. Any pending optimistic mutations retried (if applicable)
