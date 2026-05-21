<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M18 Surveys & Polls -- Interaction States

## Module-Wide 9 State Patterns

### 1. Empty State

| Screen | Trigger | Display |
|--------|---------|---------|
| M18-S01 (Survey List) | No surveys exist | "No surveys yet. Create your first survey." + CTA |
| M18-S01 (filtered tab) | No surveys match filter | "No {status} surveys." |
| M18-S04 (Results) | Survey has 0 responses | "No responses yet." (active: "Waiting for member responses.") |
| M18-S05 (My Surveys) | No surveys for member | "No surveys available." |
| M18-S05 (pending section) | All surveys completed | "All caught up! No pending surveys." |

**ARIA:** `role="status"` with `aria-live="polite"`.

### 2. Loading State

| Context | Skeleton Pattern |
|---------|-----------------|
| Survey table (M18-S01) | 5 skeleton rows matching column widths |
| Survey builder (M18-S03 edit) | Skeleton for title, type, deadline, question blocks |
| Results dashboard (M18-S04) | Skeleton overview bar + 3 question result blocks |
| My surveys (M18-S05) | 3 skeleton cards |
| Response form (M18-S06) | Skeleton survey info + question fieldsets |
| Quick poll (M18-S07) | Skeleton question + option radio placeholders |

**ARIA:** `aria-busy="true"` on container. `aria-live="polite"` announces completion.

### 3. Loaded State

Standard render. All data available, interactive elements enabled.

- Tables sortable and filterable
- Forms accept input
- Quick polls show vote or results state
- Results charts render with animations
- Export button enabled

### 4. Error State

| Error Type | Display | Recovery |
|------------|---------|----------|
| Network error | "Failed to load. Check your connection." | Retry button |
| Server error (5xx) | "Something went wrong. Try again." | Retry button |
| Not found (404) | "Survey not found." with back link | Navigate back |

**Error Code Mapping:**

| API Error Code | User Message |
|----------------|-------------|
| M18-001 | "This survey is closed. Responses are no longer accepted." |
| M18-002 | "You have already responded to this survey." |
| M18-003 | "The deadline for this survey has passed." |
| VALIDATION-001 | Field-level inline errors |
| VALIDATION-002 | "Please answer all required questions." |
| NOT_FOUND-001 | "Survey not found." |
| AUTHZ-001 | "You are not eligible for this survey." or "You don't have permission." |
| AUTH-001 | Redirect to `/auth/sign-in` |

**ARIA:** `role="alert"` with `aria-live="assertive"`.

### 5. Partial / Paginated State

| Context | Pattern |
|---------|---------|
| Survey table | Rows + "Load more" button. Tab filters independent of pagination. |
| My surveys list | Cards + "Load more" at bottom of each section (pending/completed). |
| Text responses in results | First 10 shown, "Show all {n} responses" expand button. |

**ARIA:** "Load more" includes count: `aria-label="Load more surveys ({n} shown)"`.

### 6. Submitting / Mutating State

| Mutation | Optimistic? | UI |
|----------|-------------|-----|
| Save draft | No | Button spinner, fields disabled |
| Publish survey | No | Confirmation dialog, then spinner. "Publish survey? Members will be notified." |
| Close survey | No | Confirmation dialog. "Close survey? No more responses accepted." |
| Delete draft | No | Confirmation dialog (destructive). "Delete this draft survey?" |
| Submit response | No | Button spinner, question inputs disabled |
| Edit response | No | Button spinner, inputs disabled |
| Vote on poll | No | Button spinner, radio disabled. Results appear on success. |
| Export CSV | No | Spinner on export button. Browser download on success. |

**ARIA:** `aria-disabled="true"` on submit. `aria-busy="true"` on form.

### 7. Success State

All success feedback via **sonner** toasts.

| Action | Toast Message | Post-Action |
|--------|--------------|-------------|
| Draft saved | "Survey saved as draft." | Stay on editor |
| Survey published | "Survey published. Members will be notified." | Redirect to results |
| Survey closed | "Survey closed." | Status badge updated inline |
| Draft deleted | "Survey deleted." | Redirect to survey list |
| Response submitted | "Response submitted. Thank you!" | Redirect to `/my/surveys` |
| Response updated | "Response updated." | Redirect to `/my/surveys` |
| Poll vote | No toast. Results animate in immediately (M18-R4). | Inline result bars |
| CSV exported | "Export complete." | Browser download triggered |

### 8. Validation Error State

| Form | Validation Approach |
|------|---------------------|
| Survey builder | Client: title required. Publish gate: >= 1 question + deadline. Server: 400/409. |
| Response form | Client: required questions answered. Server: M18-001 (closed), M18-002 (duplicate), M18-003 (deadline). |
| Poll creator | Client: question required, min 2 unique options. Server: 400. |
| Poll vote | Client: option must be selected. Server: M18-001, M18-002, M18-003. |

**Pattern:**
- Inline errors below fields: `<p id="error-{field}" role="alert">{message}</p>`
- Field: `aria-describedby="error-{field}"`, `aria-invalid="true"`
- Publish gate: alert banner at top of form listing missing requirements
- Focus moves to first invalid field on submit attempt
- Required question indicators: red asterisk with `aria-label="Required"`

### 9. Unauthorized / Forbidden State

| Condition | Behavior |
|-----------|----------|
| No session (AUTH-001) | Redirect to `/auth/sign-in` with return URL |
| Not officer (survey management) | "Officers can create and manage surveys." |
| Not active member (response) | "Active membership required to participate in surveys." |
| Not targeted (AUTHZ-001) | "You are not eligible for this survey." back link |
| Platform admin (identified results) | Aggregate only, no individual responses (M18-R2) |

**Anonymous survey guarantee (BR-40):**
- No respondent IDs stored or displayed for anonymous surveys
- Results screen shows aggregate only
- No "View individual responses" link for anonymous type
- Type badge always visible: purple "Anonymous" badge
