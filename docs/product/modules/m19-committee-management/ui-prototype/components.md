<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M19 Committee Management -- Component Specifications

## Component Index

| Component ID | Name | Used In |
|-------------|------|---------|
| M19-C01 | CommitteeCard | M19-S01, M19-S07 |
| M19-C02 | CommitteeOverview | M19-S02 |
| M19-C03 | CommitteeForm | M19-S03, M19-S04 |
| M19-C04 | MemberTable | M19-S02 |
| M19-C05 | AddMemberDialog | M19-S02 |
| M19-C06 | TaskCard | M19-S05 |
| M19-C07 | TaskBoard | M19-S05 |
| M19-C08 | CreateTaskPanel | M19-S05 |
| M19-C09 | MeetingCard | M19-S02, M19-S06 |
| M19-C10 | MeetingMinutesForm | M19-S06 |
| M19-C11 | DissolutionDialog | M19-S08 |
| M19-C12 | LeaderlessBanner | M19-S02, M19-S05 |
| M19-C13 | CommitteeTypeBadge | M19-S01, M19-S02, M19-S07 |
| M19-C14 | CommitteeStatusBadge | M19-S01, M19-S02 |
| M19-C15 | TaskStatusBadge | M19-S02, M19-S05 |
| M19-C16 | TaskPriorityBadge | M19-S02, M19-S05 |
| M19-C17 | PersonSearchCombobox | M19-S03, M19-S04, M19-C05, M19-C08 |
| M19-C18 | ScheduleMeetingDialog | M19-S02 |

---

## M19-C01: CommitteeCard

### TypeScript Props

```typescript
interface CommitteeCardProps {
  id: string;
  name: string;
  type: "standing" | "ad_hoc" | "special";
  status: "active" | "expired" | "dissolved";
  chairperson: { id: string; name: string } | null;
  memberCount: number;
  openTaskCount: number;
  nextMeetingAt: string | null;
  myRole?: "chairperson" | "vice_chair" | "secretary" | "member" | null;
  overdueTaskCount?: number;
}
```

### WAI-ARIA Pattern

- Card: `<article aria-labelledby="committee-name-{id}">`
- Name: `<h3 id="committee-name-{id}">`
- No chairperson: `role="alert"` amber warning inline
- Status badge: `aria-label="{status} committee"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter/Space | Navigate to committee detail |
| Tab | Move to next card |

### Render Contract

| Condition | Renders |
|-----------|---------|
| chairperson is null | Amber "No chairperson" warning |
| status is "dissolved" | Gray overlay, "Dissolved" badge |
| status is "expired" | Amber "Expired" badge |
| myRole is present | Role badge on card (for My Committees view) |
| overdueTaskCount > 0 | Red "N overdue" badge |
| nextMeetingAt is today | Green "Meeting today" indicator |
| nextMeetingAt is null | "No upcoming meetings" text |

---

## M19-C02: CommitteeOverview

### TypeScript Props

```typescript
interface CommitteeOverviewProps {
  id: string;
  name: string;
  type: "standing" | "ad_hoc" | "special";
  status: "active" | "expired" | "dissolved";
  purpose: string | null;
  chairperson: { id: string; name: string } | null;
  memberCount: number;
  termStart: string | null;
  termEnd: string | null;
  dissolvedAt: string | null;
  dissolutionReason: string | null;
  isLeaderless: boolean;
  canEdit: boolean;
  canDissolve: boolean;
}
```

### WAI-ARIA Pattern

- Section: `aria-label="Committee overview"`
- Name: `<h1>`
- Status/type: badges with `aria-label`
- Leaderless warning: `role="alert"` with `aria-live="assertive"`
- Dissolved info: `role="status"` with reason

### Render Contract

| Condition | Renders |
|-----------|---------|
| isLeaderless | LeaderlessBanner + "Assign Chairperson" CTA |
| status is "dissolved" | Dissolved banner with reason and date |
| status is "expired" | Expired banner with renewal/dissolve options |
| canEdit | "Edit Committee" button |
| canDissolve | "Dissolve Committee" button (destructive) |
| purpose is null | No purpose section |
| termEnd is null (standing) | "No end date (standing committee)" |

---

## M19-C03: CommitteeForm

### TypeScript Props

```typescript
interface CommitteeFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    type: "standing" | "ad_hoc" | "special";
    purpose: string | null;
    chairpersonId: string;
    chairpersonName: string;
    termStart: string | null;
    termEnd: string | null;
  } | null;
  onSubmit: (data: CommitteeFormData) => void;
  isSubmitting: boolean;
}

interface CommitteeFormData {
  name: string;
  description: string | null;
  type: "standing" | "ad_hoc" | "special";
  purpose: string | null;
  chairpersonId: string;
  termStart: string | null;
  termEnd: string | null;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Create committee"` or `"Edit committee"`
- Required fields: `aria-required="true"`
- Type radios: `role="radiogroup"` with `aria-label="Committee type"`
- Chairperson: PersonSearchCombobox with `aria-required="true"`
- Error summary: `role="alert"` at top

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through fields in order |
| Arrow keys | Navigate type radio group |
| Enter | Submit form |
| Escape | Cancel (navigate back with unsaved warning) |

### Render Contract

| Condition | Renders |
|-----------|---------|
| mode is "create" | Empty form, type selectable |
| mode is "edit" | Populated form, type read-only |
| type is "ad_hoc" | termEnd becomes required |
| isSubmitting | Button spinner, fields disabled |
| Chairperson validation | "Every committee must have a chairperson." (M19-R1) |

---

## M19-C04: MemberTable

### TypeScript Props

```typescript
interface MemberTableProps {
  members: Array<{
    id: string;
    personId: string;
    personName: string;
    role: "chairperson" | "vice_chair" | "secretary" | "member";
    joinedAt: string;
    leftAt: string | null;
  }>;
  canManage: boolean;
  onRemove: (memberId: string) => void;
  onAdd: () => void;
  isLoading: boolean;
  committeeStatus: "active" | "expired" | "dissolved";
  isLeaderless: boolean;
}
```

### WAI-ARIA Pattern

- Table: `role="table"` with `aria-label="Committee members"`
- Role badges: `aria-label="{role}"`
- Remove button: `aria-label="Remove {personName} from committee"`
- Add button: `aria-label="Add member to committee"`
- Chairperson row: visually distinguished (bold, icon)

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move through rows, then actions |
| Enter/Space (on remove) | Confirmation dialog |
| Enter/Space (on add) | Open AddMemberDialog |

### Render Contract

| Condition | Renders |
|-----------|---------|
| canManage is false | No action column |
| committeeStatus is "dissolved" | No action column, read-only |
| isLeaderless | Add/remove disabled (except "Assign Chairperson") |
| members.length is 0 | "No members." (should not happen -- chairperson is always a member) |
| isLoading | Skeleton rows |

---

## M19-C05: AddMemberDialog

### TypeScript Props

```typescript
interface AddMemberDialogProps {
  committeeId: string;
  existingMemberIds: string[];
  onAdd: (personId: string, role: string) => void;
  onClose: () => void;
  isAdding: boolean;
}
```

### WAI-ARIA Pattern

- Dialog: `role="dialog"` with `aria-labelledby="add-member-title"`
- Person search: PersonSearchCombobox
- Role select: `aria-label="Committee role"`
- Focus trap: focus stays within dialog

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through search, role, add, cancel |
| Escape | Close dialog |
| Enter | Add member (when Add focused) |

### Render Contract

| Condition | Renders |
|-----------|---------|
| Person already a member (M19-002) | "Already a member of this committee." inline |
| Person not org member (M19-004) | "Selected person is not an active organization member." |
| isAdding | Spinner on Add button |
| Success | sonner toast "Member added." Dialog closes. |

---

## M19-C06: TaskCard

### TypeScript Props

```typescript
interface TaskCardProps {
  id: string;
  title: string;
  description: string | null;
  assignee: { id: string; name: string } | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  isOverdue: boolean;
  canUpdateStatus: boolean;
  onStatusChange: (newStatus: string) => void;
}
```

### WAI-ARIA Pattern

- Card: `<article aria-labelledby="task-title-{id}">`
- Title: `<h4 id="task-title-{id}">`
- Overdue: `aria-label="Overdue"` with red border
- Priority: `aria-label="Priority: {priority}"`
- Status action: `aria-label="Move to {nextStatus}"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter/Space | Open task detail or trigger status change |
| Tab | Move between task cards |

### Render Contract

| Condition | Renders |
|-----------|---------|
| isOverdue | Red border + "Overdue" badge |
| assignee is null | "Unassigned" placeholder |
| canUpdateStatus is false | No status change button |
| status is "completed" | Muted styling, strikethrough title |
| description is not null | Truncated at 2 lines |

---

## M19-C07: TaskBoard

### TypeScript Props

```typescript
interface TaskBoardProps {
  tasks: Array<TaskCardProps>;
  canCreate: boolean;
  onCreate: () => void;
  isLoading: boolean;
  filterStatus: string | null;
  filterAssignee: string | null;
  onFilterChange: (filters: { status?: string; assignee?: string }) => void;
  isLeaderless: boolean;
  committeeStatus: "active" | "expired" | "dissolved";
}
```

### WAI-ARIA Pattern

- Board: `role="region"` with `aria-label="Task board"`
- Columns: `aria-label="Pending tasks"`, etc.
- Filter controls: `aria-label="Filter tasks"`
- Create button: `aria-label="Create new task"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Navigate between columns and cards |
| Arrow keys | Navigate within a column |

### Render Contract

| Condition | Renders |
|-----------|---------|
| isLoading | Skeleton columns with placeholder cards |
| tasks.length is 0 | "No tasks yet." + create CTA |
| canCreate is false | No create button |
| isLeaderless or dissolved | All mutations disabled, read-only board |
| All tasks completed (ad-hoc) | Prompt: "All tasks complete. Consider dissolving this committee." |

---

## M19-C08: CreateTaskPanel

### TypeScript Props

```typescript
interface CreateTaskPanelProps {
  committeeId: string;
  committeeMembers: Array<{ id: string; name: string }>;
  onSubmit: (data: CreateTaskData) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

interface CreateTaskData {
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
}
```

### WAI-ARIA Pattern

- Panel: `role="dialog"` with `aria-label="Create task"`
- Focus trap inside panel
- Required fields: `aria-required="true"`
- Assignee: `<select>` with committee members only

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through fields |
| Escape | Close panel |
| Enter | Submit |

### Render Contract

| Condition | Renders |
|-----------|---------|
| isSubmitting | Spinner, fields disabled |
| committeeMembers.length is 1 | Only chairperson available, auto-select or "Unassigned" |
| dueDate in past | "Due date must be in the future." validation |
| Success | sonner toast "Task created." Panel closes. Board updates. |

---

## M19-C09: MeetingCard

### TypeScript Props

```typescript
interface MeetingCardProps {
  id: string;
  committeeId: string;
  scheduledAt: string;
  agenda: string | null;
  hasMinutes: boolean;
  isPast: boolean;
}
```

### WAI-ARIA Pattern

- Card: `<article aria-labelledby="meeting-date-{id}">`
- Date: `<time datetime="{scheduledAt}">`
- Minutes indicator: `aria-label="Minutes available"` or `"Minutes pending"`

### Render Contract

| Condition | Renders |
|-----------|---------|
| isPast is false | "Upcoming" badge, agenda preview |
| isPast is true, hasMinutes is false | "Minutes pending" amber indicator |
| isPast is true, hasMinutes is true | "Minutes available" green indicator |
| agenda is null | "No agenda set." |
| agenda is long | Truncated at 3 lines with "Show more" |

---

## M19-C10: MeetingMinutesForm

### TypeScript Props

```typescript
interface MeetingMinutesFormProps {
  meetingId: string;
  existingMinutes: string | null;
  onSave: (minutes: string) => void;
  isSaving: boolean;
  canEdit: boolean;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Record meeting minutes"`
- Textarea: `aria-label="Meeting minutes"`, `aria-required="true"`
- Save: `aria-label="Save minutes"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between textarea and save button |
| Ctrl+Enter | Submit (save minutes) |

### Render Contract

| Condition | Renders |
|-----------|---------|
| canEdit is false | Read-only display of minutes |
| existingMinutes is null | Empty textarea with placeholder |
| existingMinutes is present | Pre-populated textarea |
| isSaving | Spinner on save, textarea disabled |

---

## M19-C11: DissolutionDialog

### TypeScript Props

```typescript
interface DissolutionDialogProps {
  committeeId: string;
  committeeName: string;
  committeeType: "standing" | "ad_hoc" | "special";
  openTaskCount: number;
  onDissolve: (reason: string) => void;
  onClose: () => void;
  isDissolving: boolean;
}
```

### WAI-ARIA Pattern

- Dialog: `role="alertdialog"` with `aria-labelledby="dissolve-title"` and `aria-describedby="dissolve-desc"`
- Warning: `role="alert"` for open tasks notification
- Reason: `aria-required="true"`
- Dissolve button: destructive variant
- Focus trap

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle: reason textarea -> cancel -> dissolve |
| Escape | Close dialog (same as cancel) |
| Enter (on dissolve) | Confirm dissolution |

### Render Contract

| Condition | Renders |
|-----------|---------|
| committeeType is "standing" | Extra warning: "This is a standing committee. Dissolution is permanent." |
| openTaskCount > 0 | Warning: "{n} open tasks will be archived." |
| isDissolving | Spinner on dissolve, fields disabled |
| reason is empty on submit | "Reason is required." validation |

---

## M19-C12: LeaderlessBanner

### TypeScript Props

```typescript
interface LeaderlessBannerProps {
  committeeName: string;
  canAssign: boolean;
  onAssignChairperson: () => void;
}
```

### WAI-ARIA Pattern

- Banner: `role="alert"` with `aria-live="assertive"`
- Message: "This committee has no chairperson. All changes are blocked until a new chairperson is assigned."
- Assign button: `aria-label="Assign chairperson to {committeeName}"`

### Render Contract

| Condition | Renders |
|-----------|---------|
| canAssign is true | Warning banner + "Assign Chairperson" button |
| canAssign is false | Warning banner only (no button for regular members) |

---

## M19-C13: CommitteeTypeBadge

### TypeScript Props

```typescript
interface CommitteeTypeBadgeProps {
  type: "standing" | "ad_hoc" | "special";
}
```

### Render Contract

| Type | Color | Label |
|------|-------|-------|
| standing | Blue | "Standing" |
| ad_hoc | Amber | "Ad-Hoc" |
| special | Purple | "Special" |

---

## M19-C14: CommitteeStatusBadge

### TypeScript Props

```typescript
interface CommitteeStatusBadgeProps {
  status: "active" | "expired" | "dissolved";
}
```

### Render Contract

| Status | Color | Icon |
|--------|-------|------|
| active | Green | Check |
| expired | Amber | Clock |
| dissolved | Gray | Archive |

---

## M19-C15: TaskStatusBadge

### TypeScript Props

```typescript
interface TaskStatusBadgeProps {
  status: "pending" | "in_progress" | "completed";
}
```

### Render Contract

| Status | Color | Icon |
|--------|-------|------|
| pending | Gray | Circle |
| in_progress | Blue | ArrowRight |
| completed | Green | Check |

---

## M19-C16: TaskPriorityBadge

### TypeScript Props

```typescript
interface TaskPriorityBadgeProps {
  priority: "low" | "medium" | "high";
}
```

### Render Contract

| Priority | Color | Icon |
|----------|-------|------|
| low | Gray | ChevronDown |
| medium | Amber | Minus |
| high | Red | ChevronUp |

---

## M19-C17: PersonSearchCombobox

### TypeScript Props

```typescript
interface PersonSearchComboboxProps {
  label: string;
  value: { id: string; name: string } | null;
  onChange: (person: { id: string; name: string } | null) => void;
  excludeIds?: string[];
  organizationId: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
}
```

### WAI-ARIA Pattern

- Container: `role="combobox"` with `aria-expanded`, `aria-autocomplete="list"`
- Input: `aria-label="{label}"`, `aria-required` if required
- Listbox: `role="listbox"` with `role="option"` items
- Active option: `aria-activedescendant`
- Selected: `aria-selected="true"`
- Clear: `aria-label="Clear selection"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow Down | Open dropdown / move to next option |
| Arrow Up | Move to previous option |
| Enter | Select highlighted option |
| Escape | Close dropdown / clear |
| Type characters | Filter options by name |

### Render Contract

| Condition | Renders |
|-----------|---------|
| value is null | Placeholder text |
| value is set | Selected person chip with clear button |
| isSearching | Spinner in dropdown |
| No results | "No matching members found." |
| excludeIds filter active | Excluded persons hidden from results |
| error is present | Red border + error message |

---

## M19-C18: ScheduleMeetingDialog

### TypeScript Props

```typescript
interface ScheduleMeetingDialogProps {
  committeeId: string;
  onSchedule: (data: { scheduledAt: string; agenda: string | null }) => void;
  onClose: () => void;
  isScheduling: boolean;
}
```

### WAI-ARIA Pattern

- Dialog: `role="dialog"` with `aria-labelledby="schedule-meeting-title"`
- Date/time: `aria-required="true"`, `aria-label="Meeting date and time"`
- Agenda: `aria-label="Meeting agenda (optional)"`
- Focus trap

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle: date -> agenda -> cancel -> schedule |
| Escape | Close dialog |
| Enter (on schedule) | Confirm |

### Render Contract

| Condition | Renders |
|-----------|---------|
| scheduledAt in past | "Meeting must be scheduled in the future." validation |
| isScheduling | Spinner on schedule button |
| Success | sonner toast "Meeting scheduled." Dialog closes. |
| M19-007 error | "Committee is dissolved." (should not reach here) |
