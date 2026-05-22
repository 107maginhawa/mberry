<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Interaction States: Platform Administration (M03)

---

## Module-Wide State Patterns

All screens in M03 follow these 9 interaction state patterns. Screen-specific overrides are documented in `screens.md`.

---

## 1. Loading

**Trigger:** Initial data fetch, form submission, analytics computation.

### Visual Pattern
- Dashboard: skeleton action cards (3), skeleton stat cards (4), skeleton feed items (5).
- Associations table: skeleton rows (5 rows, matching column widths).
- Feature flags grid: skeleton toggle rows.
- Impersonation: spinner in search dropdown.
- Admin team: skeleton table rows.

### ARIA Behavior
- `aria-busy="true"` on `<main>` or relevant `<section>`.
- Screen reader: "Loading admin dashboard..." / "Loading associations..." via `aria-live="polite"`.

### Duration Rules
- Skeleton shown after 200ms (debounce).
- > 5s: "Loading is taking longer than expected..."
- > 15s: transition to Unexpected Error.
- Analytics: may take up to 10s for aggregation — show progress indicator with "Calculating...".

---

## 2. Empty

**Trigger:** No data for the requested view.

### Visual Pattern
- **Dashboard, all clear:** Green checkmark icon + "No items requiring attention. All systems operational." Stat cards still shown.
- **Associations, zero:** "No associations configured. Create your first." + "New Association" CTA. (Only possible on fresh platform install.)
- **Feature flags, zero:** "No feature flags configured." (Unlikely in production.)
- **Admin team, zero:** Impossible — at least 1 super admin required (M3-R6).
- **Analytics, no data:** "Analytics will populate once organizations are active."

### ARIA Behavior
- Empty messages: `role="status"`.
- CTA buttons: properly labeled for action.

---

## 3. Success

**Trigger:** Mutation completed (create, update, delete, toggle).

### Visual Pattern
- **Association created:** sonner toast "Association created." Table refreshes with new row highlighted briefly.
- **Association updated:** sonner toast "Association updated."
- **Association deleted:** sonner toast "Association deleted." Row removed from table.
- **Org provisioned:** sonner toast "Organization created. Onboarding invite sent to {email}."
- **Feature flag toggled:** Optimistic toggle, sonner toast "Feature flag updated."
- **Impersonation started:** Global banner appears, redirect to impersonated user's context.
- **Impersonation ended:** Banner removed, sonner toast "Impersonation ended." Redirect to /admin.
- **Admin invited:** sonner toast "Invitation sent to {email}."
- **Admin removed:** sonner toast "Admin removed." Row removed from table.
- **Admin role changed:** sonner toast "Role updated."

### ARIA Behavior
- sonner toasts: `role="status"`, auto-dismiss 4s.
- Table row highlight: 2s amber flash on new/updated rows.

### Optimistic Updates
- Feature flag toggles: immediate visual update, revert on error.
- Other mutations: wait for server confirmation before updating table.

---

## 4. Validation Error

**Trigger:** Invalid form input or 400 response.

### Visual Pattern
- **Association form:** Inline errors below each invalid field.
- **Org provision form:** Inline errors (slug uniqueness server-checked).
- **Impersonation:** "Reason is required." below reason input.
- **Admin invite:** "Valid email required." below email input.

### ARIA Behavior
- `aria-invalid="true"` on invalid inputs.
- Error text: `<p role="alert">`.
- Focus: first invalid field.

### Error Messages

| Context | Validation | Message |
|---------|-----------|---------|
| Association name | Empty | "Association name is required." |
| Association name | Duplicate | "An association with this name already exists." |
| License regex | Invalid | "Invalid regular expression syntax." |
| Credit cycle required | Zero/negative | "Required credits must be greater than zero." |
| Org name | Duplicate within assoc | "An organization with this name already exists in this association." |
| Org slug | Taken | "This URL is already taken. Try another." |
| Admin email | Invalid | "Please enter a valid email address." |
| Impersonation reason | Empty | "Reason is required for audit logging." |

---

## 5. Permission Error

**Trigger:** Insufficient admin role for the action.

### Visual Pattern
- **No PA session:** Redirect to /auth/sign-in.
- **Support on mutation pages:** Mutation buttons hidden (not disabled). No error message — the buttons simply do not render.
- **Admin attempting super-only action:** Button not rendered.
- **Support on impersonation:** Entire page redirects to /admin (support cannot impersonate).

### ARIA Behavior
- Hidden elements: not in DOM (not just `display: none`).
- Redirect: announce "Insufficient permissions. Redirecting."

### M03 Permission Matrix (UI)

| Screen | Super | Admin | Support |
|--------|-------|-------|---------|
| Dashboard | Full | Full | No revenue |
| Associations | Full CRUD | Create/Edit | Read-only |
| Feature flags | Toggle | Toggle | Read-only |
| Impersonation | Full | Full | No access |
| Admin team | Full manage | Read-only | Read-only |
| Analytics | Full | Full | No revenue |

---

## 6. Unexpected Error

**Trigger:** 500, network failure, timeout.

### Visual Pattern
- **Dashboard fail:** Banner: "Failed to load dashboard. Refresh to try again." Retry button.
- **Table fail:** "Failed to load {resource}. Try again." above table area.
- **Modal fail:** Error text inside modal, save button re-enabled. Form data preserved.
- **Toggle fail:** Toggle reverts to previous state. sonner toast: "Failed to update flag. Try again."

### ARIA Behavior
- Error banners: `role="alert"`, `aria-live="assertive"`.
- Focus: retry button.

### Recovery
- Retry re-fetches via TanStack Query `refetch()`.
- Modal form data: preserved in React state.
- After 3 retries: "Persistent error. Contact engineering team."

---

## 7. Conflict / Duplicate

**Trigger:** 409 response.

### Visual Pattern
- **Association name conflict:** Inline on name field: "An association with this name already exists."
- **Org slug conflict:** Inline: "This URL is already taken."
- **Delete association with active orgs:** Modal: "Cannot delete. This association has {N} active organizations. Suspend or cancel them first."
- **Admin already exists:** Inline: "This person is already a platform admin."
- **Impersonation already active:** Banner: "End your current impersonation session before starting a new one."

### ARIA Behavior
- Inline conflicts: `role="alert"` on the error text.
- Modal conflicts: `role="alertdialog"`.

---

## 8. Confirmation / Warning

**Trigger:** Destructive or high-impact action.

### Visual Pattern
- **Delete association:** Dialog: "Delete {name}? This cannot be undone. All configuration will be lost."
  - Buttons: "Cancel" + "Delete" (red destructive).
  - Only shown if association has NO active orgs (otherwise conflict state).
- **Disable feature flag:** Dialog: "Disabling {module} will affect {N} organizations. Are you sure?"
  - Buttons: "Cancel" + "Disable" (amber).
- **Remove admin:** Dialog: "Remove {name} from the admin team? They will lose all platform admin access."
  - Buttons: "Cancel" + "Remove" (red).
- **Remove last super admin:** No dialog — button disabled with tooltip: "Cannot remove the last Super Admin." (M3-R6)
- **Start impersonation:** Inline warning: "All actions during impersonation are audit-logged. Session expires in {N} minutes."
- **Org status transition (suspend):** Dialog: "Suspend {orgName}? Members will lose access to org features."

### ARIA Behavior
- Dialogs: `role="alertdialog"`, focus trapped.
- Escape: cancel action, close dialog.
- Destructive buttons: `aria-label` includes action and target.

### M03 Confirmation Matrix

| Action | Confirmation | Destructive |
|--------|-------------|-------------|
| Delete association | Modal dialog | Yes |
| Disable feature flag | Inline confirm | Medium |
| Remove admin | Modal dialog | Yes |
| Start impersonation | Inline warning | No |
| Suspend org | Modal dialog | Yes (reversible) |
| Cancel org | Modal dialog | Yes |

---

## 9. Offline / Sync

**Trigger:** `navigator.onLine === false` or network error.

### Visual Pattern
- **Banner:** Amber fixed bar: "You appear to be offline. Admin functions require internet."
- **Dashboard:** Show last cached stats (from TanStack Query cache). Badge: "Last updated {time}."
- **Tables:** Show cached data. All create/edit/delete buttons disabled.
- **Feature flags:** All toggles disabled.
- **Impersonation:** Completely unavailable offline.

### ARIA Behavior
- Banner: `role="status"`, `aria-live="polite"`.
- Disabled buttons: `aria-disabled="true"`.
- When back online: "Back online. Refreshing data..." + auto-refetch.

### Data Strategy
- TanStack Query cache: associations, feature flags, admin team cached for 5 min `staleTime`.
- Dashboard stats: cached for 1 min.
- Analytics: cached for 10 min (expensive queries).
- Offline mutations: completely blocked (no queue). Admin operations are too sensitive for offline queueing.
