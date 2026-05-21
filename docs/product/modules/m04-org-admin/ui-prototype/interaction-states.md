<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Interaction States: Organization Admin (M04)

---

## Module-Wide State Patterns

All screens in M04 follow these 9 interaction state patterns. Screen-specific overrides are documented in `screens.md`.

---

## 1. Loading

**Trigger:** Initial data fetch, form submission, transition processing.

### Visual Pattern
- Dashboard: skeleton action cards (3) + skeleton stat cards (3).
- Officer table: skeleton rows (5 rows matching column widths).
- Org settings: skeleton form fields.
- Public page: skeleton hero + details.
- Disciplinary form: spinner in member search dropdown.

### ARIA Behavior
- `aria-busy="true"` on `<main>` or relevant `<section>`.
- Screen reader: "Loading dashboard..." / "Loading officers..." via `aria-live="polite"`.

### Duration Rules
- Skeleton after 200ms (debounce).
- > 5s: "Loading is taking longer than expected..."
- > 15s: transition to Unexpected Error.

---

## 2. Empty

**Trigger:** No data for the requested view.

### Visual Pattern
- **Dashboard, no actions:** "Everything is on track!" with green checkmark. Stats still shown. New orgs get: "Welcome! Complete your setup to get started." + link to onboarding wizard.
- **Officers, zero:** "No officers assigned yet. Assign your first officer to get started." + "Assign Officer" CTA.
- **Public page:** Always has at least a name (never truly empty).
- **Disciplinary history:** "No disciplinary actions recorded." (read-only view, not in M04 scope).

### ARIA Behavior
- Empty messages: `role="status"`.
- CTA buttons properly labeled.

---

## 3. Success

**Trigger:** Mutation completed (assign, remove, transition, save settings, discipline).

### Visual Pattern
- **Officer assigned:** sonner toast "Officer assigned: {name} as {position}." New row highlighted in table.
- **Officer removed:** sonner toast "Officer removed." Row removed from table.
- **Transition complete:** sonner toast "Officer transition complete. {newName} is now {position}." Modal closes. Table refreshes.
- **Transition override:** sonner toast "Transition completed via president override."
- **Org settings saved:** sonner toast "Organization settings saved." Public page updated.
- **Disciplinary action:** sonner toast "Disciplinary action recorded." Navigate to dashboard.
- **Logo uploaded:** New logo appears immediately.

### ARIA Behavior
- sonner toasts: `role="status"`, auto-dismiss 4s.
- Table row highlight: 2s amber flash on new/updated rows.
- Modal close: focus returns to triggering button.

### Optimistic Updates
- Logo upload: show immediately, revert on error.
- Org settings: wait for server confirmation (form stays on page).
- Officer mutations: wait for server, then refresh table.

---

## 4. Validation Error

**Trigger:** Client-side validation or 400 response.

### Visual Pattern
- **Org settings:** Inline red text below invalid fields.
- **Officer assign:** Position conflict, invalid dates.
- **Disciplinary:** Empty reason, missing duration for suspension/probation.
- **Transition:** Incomplete checklist without override.

### ARIA Behavior
- `aria-invalid="true"` on invalid inputs.
- Error text: `<p role="alert">`.
- Focus: first invalid field.

### Error Messages

| Context | Validation | Message |
|---------|-----------|---------|
| Org name | Empty | "Organization name is required." |
| Org name | Too short | "Name must be at least 2 characters." |
| Org name | Too long | "Name must be 100 characters or fewer." |
| Description | Too long | "Description must be 2,000 characters or fewer." |
| Founding date | Future | "Founding date cannot be in the future." |
| Contact email | Invalid | "Please enter a valid email address." |
| Logo | Invalid format | "Logo must be SVG, PNG, or JPEG." |
| Officer start date | Past end date | "Start date must be before end date." |
| Discipline reason | Empty | "Reason is required and cannot be modified after submission." |
| Discipline duration | Missing | "Duration is required for suspension and probation." |
| Transition checklist | Incomplete | "Complete all checklist items or use president override." |

---

## 5. Permission Error

**Trigger:** Insufficient role for the action.

### Visual Pattern
- **Non-officer on officer pages:** Redirect to member view (/org/{id}).
- **Non-president on mutations:** Mutation buttons hidden (not rendered in DOM).
- **Non-president on discipline:** Redirect to officer dashboard with sonner: "Only the President can issue disciplinary actions."
- **Public page:** No permission errors (public route).

### ARIA Behavior
- Redirect: announce "Insufficient permissions. Redirecting."
- Hidden elements: not in accessibility tree.

### M04 Permission Matrix (UI)

| Screen | President | Secretary | Treasurer | Other Officers | Member |
|--------|-----------|-----------|-----------|----------------|--------|
| Dashboard | Full | Full | Partial (no collection rate) | Partial | No access |
| Officers | Full CRUD | Read-only | Read-only | Read-only | No access |
| Settings | Full edit | Full edit | Full edit | Full edit | No access |
| Discipline | Full | No access | No access | No access | No access |
| Public page | Full (public) | Full (public) | Full (public) | Full (public) | Full (public) |

---

## 6. Unexpected Error

**Trigger:** 500, network failure, timeout.

### Visual Pattern
- **Dashboard fail:** "Failed to load dashboard. Try again." banner + retry.
- **Officers fail:** "Failed to load officers. Try again." above table area.
- **Settings save fail:** "Save failed. Your changes are preserved. Try again." banner.
- **Transition fail:** "Transition could not be completed. Try again." in modal. Checklist state preserved.
- **Discipline fail:** "Action could not be submitted. Try again." Form data preserved.

### ARIA Behavior
- Error banners: `role="alert"`, `aria-live="assertive"`.
- Focus: retry button.

### Recovery
- Retry re-fetches / re-submits.
- Form data always preserved.
- Modal state preserved on error.
- After 3 retries: "Persistent error. Please try again later."

---

## 7. Conflict / Duplicate

**Trigger:** 409 or 422 response.

### Visual Pattern
- **Officer position filled:** "This position is already held by {name}. Remove them first or choose a different position."
- **Last officer removal:** "Cannot remove the last officer from this organization." (M04-001, 422)
- **President self-removal:** "The President role cannot be self-removed. Contact Platform Admin." (BR-09)
- **Discipline self-target:** "You cannot take disciplinary action against yourself."

### ARIA Behavior
- Conflict messages: `role="alert"`.
- Inline on the relevant field or as modal message.

---

## 8. Confirmation / Warning

**Trigger:** Destructive or high-impact action.

### Visual Pattern
- **Remove officer:** Dialog: "Remove {name} from {position}? They will become a regular member. This action is logged."
  - Buttons: "Cancel" + "Remove" (red destructive).
- **Disciplinary action (warning):** Inline: "This will be recorded in the member's permanent audit trail."
- **Disciplinary action (suspension):** Dialog: "Suspend {name} for {N} days? They will lose access to organization features."
  - Buttons: "Cancel" + "Suspend" (amber).
- **Disciplinary action (removal):** Dialog: "Permanently remove {name} from the organization? This terminates their membership."
  - Buttons: "Cancel" + "Remove Member" (red destructive).
  - Additional checkbox: "I confirm this action is irreversible."
- **Transition override:** Inline in modal: "Override requires a documented reason. This will be audit-logged."
- **Accidental transfer reversal:** Within 24 hours, new president sees: "Reverse this transition? Available for 24 hours."

### ARIA Behavior
- Dialogs: `role="alertdialog"`, focus trapped.
- Escape: cancel action.
- Destructive buttons: red color, `aria-label` includes consequence.

### M04 Confirmation Matrix

| Action | Confirmation | Destructive | Reversible |
|--------|-------------|-------------|------------|
| Assign officer | None | No | Yes (remove) |
| Remove officer | Modal dialog | Yes | No (audit logged) |
| Transition (normal) | Checklist completion | No | 24h reversal window |
| Transition (override) | Reason required | Medium | 24h reversal window |
| Discipline: warning | Inline text | Low | No (immutable) |
| Discipline: probation | Dialog | Medium | No (immutable) |
| Discipline: suspension | Dialog | High | No (immutable) |
| Discipline: removal | Dialog + checkbox | Critical | No (immutable, M4-R4) |
| Save org settings | None | No | Yes (edit again) |

---

## 9. Offline / Sync

**Trigger:** `navigator.onLine === false` or network error.

### Visual Pattern
- **Banner:** Amber fixed bar: "You appear to be offline."
- **Dashboard:** Cached data from TanStack Query. Badge: "Last updated {time}."
- **Officers table:** Cached data. All assign/remove/transition buttons disabled.
- **Settings:** Form viewable but save disabled. "Can't save while offline."
- **Public page:** Cached if visited before. "Apply" button disabled.
- **Discipline:** Completely blocked. "Disciplinary actions require internet."

### ARIA Behavior
- Banner: `role="status"`, `aria-live="polite"`.
- Disabled buttons: `aria-disabled="true"`.
- When back online: "Back online. Refreshing..." + auto-refetch.

### Data Strategy
- TanStack Query cache: dashboard 2 min, officers 5 min, settings 10 min.
- Offline mutations: completely blocked. Governance actions are too sensitive for queuing.
- Public page: browser cache only (no service worker).
