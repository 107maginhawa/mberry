<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M19 Committee Management -- Interaction States

## Module-Wide 9 State Patterns

### 1. Empty State

| Screen | Trigger | Display |
|--------|---------|---------|
| M19-S01 (Committee List) | No committees in org | "No committees yet." + Create CTA (officers) |
| M19-S01 (filtered tab) | No committees match filter | "No {status} committees." |
| M19-S02 (Detail, tasks) | Committee has no tasks | "No tasks yet." + Create CTA (chairperson) |
| M19-S02 (Detail, meetings) | No upcoming meetings | "No upcoming meetings." + Schedule CTA (chairperson) |
| M19-S05 (Task Board) | No tasks | "No tasks yet. Create a task to get started." + CTA |
| M19-S07 (My Committees) | Member not in any committees | "You are not a member of any committees." |

**ARIA:** `role="status"` with `aria-live="polite"`.

### 2. Loading State

| Context | Skeleton Pattern |
|---------|-----------------|
| Committee list (M19-S01) | 6 skeleton cards in grid |
| Committee detail (M19-S02) | Skeleton overview + member table + task table + meeting list |
| Committee form (M19-S03) | N/A (static form) |
| Task board (M19-S05) | 3 skeleton columns with 2 cards each |
| Meeting detail (M19-S06) | Skeleton header + agenda block + minutes block |
| My committees (M19-S07) | 3 skeleton cards |

**ARIA:** `aria-busy="true"` on container. `aria-live="polite"` announces completion.

### 3. Loaded State

Standard render. All data available, interactive elements enabled per role.

- Committee cards clickable
- Member table with role badges and actions (per permissions)
- Task board with kanban columns, drag not implemented (button-based status changes)
- Meeting list with upcoming/past grouping
- Action buttons contextually enabled per role, committee status, and leaderless state

### 4. Error State

| Error Type | Display | Recovery |
|------------|---------|----------|
| Network error | "Failed to load. Check your connection." | Retry button |
| Server error (5xx) | "Something went wrong. Try again." | Retry button |
| Not found (404) | "Committee not found." with back navigation | Navigate back |

**Error Code Mapping:**

| API Error Code | User Message |
|----------------|-------------|
| M19-002 | "This person is already a member of this committee." |
| M19-004 | "Selected person is not an active organization member." |
| M19-005 | "Committee term has ended. Renew or dissolve." |
| M19-006 | "Committee has no chairperson. Assign one before making changes." |
| M19-007 | "This committee has been dissolved." |
| VALIDATION-001 | Field-level inline errors |
| NOT_FOUND-001 | "Not found." |
| AUTHZ-001 | "You don't have permission to perform this action." |
| AUTH-001 | Redirect to `/auth/sign-in` |

**ARIA:** `role="alert"` with `aria-live="assertive"`.

### 5. Partial / Paginated State

| Context | Pattern |
|---------|---------|
| Committee list | Cards + "Load more" button at bottom |
| Member table | Full list (committees typically < 50 members, no pagination) |
| Task board | Full list per column (pagination per status if > 20) |
| Meeting list | Recent 5 shown, "View all meetings" link |

**ARIA:** "Load more" includes count.

### 6. Submitting / Mutating State

| Mutation | Optimistic? | UI |
|----------|-------------|-----|
| Create committee | No | Button spinner, fields disabled |
| Update committee | No | Button spinner, fields disabled |
| Dissolve committee | No | Dialog button spinner. Dialog stays open. |
| Add member | No | Dialog button spinner |
| Remove member | No | Confirmation dialog, then spinner |
| Create task | No | Panel button spinner |
| Update task status | Yes | Card moves to new column immediately. Reverts on error. |
| Schedule meeting | No | Dialog button spinner |
| Save minutes | No | Button spinner, textarea disabled |

**ARIA:** `aria-disabled="true"` on submit buttons. `aria-busy="true"` on forms/dialogs.

### 7. Success State

All success feedback via **sonner** toasts.

| Action | Toast Message | Post-Action |
|--------|--------------|-------------|
| Committee created | "Committee created." | Redirect to committee detail |
| Committee updated | "Committee updated." | Redirect to committee detail |
| Committee dissolved | "Committee dissolved." | Dialog closes. Detail shows dissolved state. |
| Member added | "Member added to committee." | Dialog closes. Table updates. |
| Member removed | "Member removed from committee." | Row removed from table. |
| Task created | "Task created." | Panel closes. Board updates. |
| Task status updated | No toast (optimistic visual feedback). | Card moves to new column. |
| Meeting scheduled | "Meeting scheduled." | Dialog closes. Meeting list updates. |
| Minutes saved | "Minutes saved." | Stay on meeting detail. |

### 8. Validation Error State

| Form | Validation Approach |
|------|---------------------|
| Committee form | Client: name required, chairperson required (M19-R1). Ad-hoc: termEnd required. Server: M19-004. |
| Add member | Client: person required. Server: M19-002 (duplicate), M19-004 (not org member), M19-007 (dissolved). |
| Create task | Client: title required. DueDate must be future. Server: M19-007. |
| Schedule meeting | Client: scheduledAt required, must be future. Server: M19-005, M19-007. |
| Dissolution | Client: reason required. Server: M19-007. |
| Minutes | Client: minutes text required. Server: AUTHZ-001. |

**Pattern:**
- Inline errors below fields: `<p id="error-{field}" role="alert">{message}</p>`
- Field: `aria-describedby="error-{field}"`, `aria-invalid="true"`
- Focus moves to first invalid field on submit
- Dialog errors shown inline within dialog (not behind it)

### 9. Unauthorized / Forbidden State

| Condition | Behavior |
|-----------|----------|
| No session (AUTH-001) | Redirect to `/auth/sign-in` with return URL |
| Not org member | "You must be an organization member to view committees." |
| Not officer (create) | Create button hidden. Direct URL: "Officers can create committees." |
| Not chairperson (manage members/tasks/meetings) | Action buttons hidden. Direct URL: "Only the chairperson can manage this." |
| Not president/chairperson (dissolve) | Dissolve button hidden |
| Dissolved committee (mutation attempt) | "This committee has been dissolved. No changes allowed." (M19-007) |
| Leaderless committee (mutation attempt, M19-006) | "Committee has no chairperson. All changes are blocked." LeaderlessBanner shown. |

**Leaderless state is the critical module-specific guard:**
- Triggered when chairperson removed from org (M19-R4 cascade)
- All POST/PUT/DELETE endpoints return M19-006
- UI pre-disables all action buttons when `isLeaderless` flag is true
- Only "Assign Chairperson" action remains available (for president/officers)
- Committee data stays visible and readable

**Dissolved state:**
- All sections render but in read-only mode
- Historical data preserved per M19-R5
- No action buttons rendered
- Gray visual treatment
- Officers and platform admin retain read access to dissolved committees
