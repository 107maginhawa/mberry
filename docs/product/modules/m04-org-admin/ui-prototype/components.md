<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Components: Organization Admin (M04)

---

## C01: SmartActionCard

**WAI-ARIA Pattern:** none (article)
**Used In:** S01 Org Dashboard

### TypeScript Props Interface

```typescript
interface SmartActionCardProps {
  /** Action type identifier */
  type: 'unpaid_dues' | 'pending_applications' | 'expiring_terms' | 'incomplete_onboarding' | 'upcoming_events';
  /** Number of items requiring attention */
  count: number;
  /** Human-readable label (e.g., "12 members with unpaid dues") */
  label: string;
  /** Navigation target */
  href: string;
  /** Icon identifier */
  icon: string;
  /** Urgency for visual treatment */
  urgency: 'critical' | 'warning' | 'info';
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Focus card |
| Enter / Space | Navigate to href |

### Render Contract

- Card with icon (left), label + count badge (center), arrow (right).
- Urgency border: critical=red, warning=amber, info=blue.
- Count badge: colored circle with number.
- Entire card clickable.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onClick | Card clicked | Navigation via href |

### States

| State | Visual |
|-------|--------|
| Default | Card with urgency indicator |
| Hover | Elevated shadow |
| Focus | Ring outline |
| Loading | Skeleton card |

---

## C02: OrgStatCard

**WAI-ARIA Pattern:** none (figure)
**Used In:** S01 Org Dashboard

### TypeScript Props Interface

```typescript
interface OrgStatCardProps {
  /** Metric label */
  label: string;
  /** Current value */
  value: number | string;
  /** Display format */
  format?: 'number' | 'percentage' | 'currency';
  /** Optional suffix (e.g., "members", "events") */
  suffix?: string;
  /** Optional icon */
  icon?: string;
}
```

### Render Contract

- Compact card: icon (optional, muted), label (small), value (large bold), suffix (muted).
- Percentage: formatted with 1 decimal.
- Currency: Intl.NumberFormat per org locale.

### States

| State | Visual |
|-------|--------|
| Default | Label + value |
| Loading | Skeleton text |
| No data | "—" dash placeholder |

---

## C03: OfficerTable

**WAI-ARIA Pattern:** grid (role="grid")
**Used In:** S02 Officer Management

### TypeScript Props Interface

```typescript
interface OfficerTableProps {
  /** List of officer terms */
  officers: OfficerTerm[];
  /** Whether current user is president (enables mutations) */
  isPresident: boolean;
  /** Called when assign button clicked */
  onAssign: () => void;
  /** Called when remove button clicked */
  onRemove: (termId: string) => void;
  /** Called when transition button clicked */
  onTransition: (termId: string) => void;
}

interface OfficerTerm {
  /** Term ID */
  id: string;
  /** Person info */
  person: { id: string; firstName: string; lastName: string; email: string };
  /** Position info */
  position: { id: string; title: string; isElected: boolean };
  /** Term status */
  status: 'upcoming' | 'active' | 'completed' | 'resigned' | 'removed';
  /** Start date (ISO 8601) */
  startDate: string;
  /** End date (ISO 8601, null if ongoing) */
  endDate: string | null;
  /** Assigned by person name */
  assignedBy: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between rows and action buttons |
| Enter / Space | Activate focused button |
| ArrowDown / ArrowUp | Navigate between rows |

### Render Contract

- Table with columns: Name, Position, Term Start, Term End, Status, Actions.
- Status badges: upcoming=blue, active=green, completed=grey, resigned=amber, removed=red.
- Actions column: "Transition" button (active terms only), "Remove" button.
- Actions hidden if not president.
- Elected positions: small badge/icon next to position title.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onAssign | "Assign Officer" button | — |
| onRemove | "Remove" button per row | `termId: string` |
| onTransition | "Transition" button per row | `termId: string` |

### States

| State | Visual |
|-------|--------|
| Default | Table with officer data |
| Loading | Skeleton rows (5) |
| Empty | "No officers assigned yet." |
| Error | "Failed to load officers." |

---

## C04: OfficerAssignForm

**WAI-ARIA Pattern:** dialog (modal)
**Used In:** S02 Officer Management

### TypeScript Props Interface

```typescript
interface OfficerAssignFormProps {
  /** Organization ID */
  organizationId: string;
  /** Available positions */
  positions: Position[];
  /** Called on successful assignment */
  onAssign: (data: OfficerAssignData) => void;
  /** Called when dialog dismissed */
  onCancel: () => void;
}

interface Position {
  id: string;
  title: string;
  isElected: boolean;
  currentHolder?: string;
}

interface OfficerAssignData {
  personId: string;
  positionId: string;
  startDate: string;
  endDate?: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between fields |
| Enter | Submit |
| Escape | Close dialog |

### Render Contract

- Modal with: member search (PersonSearchCombobox), position selector (dropdown), start date, end date (optional).
- Position dropdown shows current holder name if filled.
- Elected positions marked with badge.
- "Assign" + "Cancel" buttons.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onAssign | Form submitted | `OfficerAssignData` |
| onCancel | Escape or Cancel | — |

### States

| State | Visual |
|-------|--------|
| Default | Empty form with position selector |
| Loading | Spinner on assign button |
| Error | Inline validation (position conflict, invalid dates) |
| Conflict | "This position is already filled by {name}." |

---

## C05: TransitionChecklistModal

**WAI-ARIA Pattern:** dialog (role="dialog" with focus trap)
**Used In:** S02 Officer Management

### TypeScript Props Interface

```typescript
interface TransitionChecklistModalProps {
  /** Outgoing officer */
  outgoing: { name: string; position: string };
  /** Incoming officer (selected via search) */
  incoming?: { name: string; personId: string };
  /** Role-specific checklist items */
  checklistItems: ChecklistItem[];
  /** Called when transition completed */
  onComplete: (data: TransitionCompleteData) => void;
  /** Called when president overrides */
  onOverride: (reason: string) => void;
  /** Called when dismissed */
  onCancel: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  notes?: string;
}

interface TransitionCompleteData {
  incomingPersonId: string;
  officerTermId: string;
  completedItems: string[];
  notes: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between checkboxes, text areas, buttons |
| Space | Toggle checkbox |
| Escape | Close modal (cancel) |
| Enter | Submit if all complete, or focus next unchecked |

### Render Contract

- Modal header: "Officer Transition: {position}"
- Outgoing → Incoming display
- Incoming officer: PersonSearchCombobox (if not pre-selected)
- Checklist: checkboxes with labels, note textarea per item
- Progress indicator: "{N}/{total} complete"
- "Complete Transition" button (enabled at 100% or president override)
- "Override" button (president only): reveals reason textarea
- "Cancel" button

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onComplete | All items checked + submit | `TransitionCompleteData` |
| onOverride | Override button + reason | `reason: string` |
| onCancel | Escape or Cancel | — |

### States

| State | Visual |
|-------|--------|
| Default | Checklist with unchecked items |
| In progress | Some items checked, progress bar |
| Complete | All checked, "Complete" button enabled (green) |
| Override | Reason textarea visible, "Override & Complete" button |
| Loading | Spinner on complete button |
| Error | "Transition failed. Try again." |

---

## C06: DisciplinaryActionForm

**WAI-ARIA Pattern:** form with radiogroup
**Used In:** S05 Disciplinary Action

### TypeScript Props Interface

```typescript
interface DisciplinaryActionFormProps {
  /** Organization ID */
  organizationId: string;
  /** Called on successful submission */
  onSubmit: (data: DisciplinaryActionData) => void;
  /** Called when cancelled */
  onCancel: () => void;
}

interface DisciplinaryActionData {
  personId: string;
  actionType: 'warning' | 'probation' | 'suspension' | 'removal';
  reason: string;
  duration?: number;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between fields |
| Arrow keys | Navigate radio options |
| Enter | Submit form |
| Escape | Cancel |

### Render Contract

- Member search (PersonSearchCombobox)
- Action type: radio group with descriptions
  - Warning: "No access change. Recorded in audit trail."
  - Probation: "Restricted features for specified duration."
  - Suspension: "Lose org features for specified duration."
  - Removal: "Terminate membership permanently."
- Reason textarea (required, prominent)
- Duration input (visible for probation/suspension only)
- Confirmation checkbox: "I understand this action is permanent and audit-logged."
- Submit button (red for removal, amber for others)

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onSubmit | Form valid + confirmed | `DisciplinaryActionData` |
| onCancel | Cancel clicked | — |

### States

| State | Visual |
|-------|--------|
| Default | Member search + blank form |
| Member selected | Form fields visible |
| Loading | Spinner on submit |
| Error | Inline validation errors |
| Confirming | Confirmation dialog before final submit |

---

## C07: OrgPublicProfile

**WAI-ARIA Pattern:** none (presentational)
**Used In:** S04 Org Public Page

### TypeScript Props Interface

```typescript
interface OrgPublicProfileProps {
  /** Organization public data */
  org: {
    name: string;
    slug: string;
    description?: string;
    orgType: 'chapter' | 'society' | 'national' | 'clinic';
    contactEmail?: string;
    meetingSchedule?: string;
    foundingDate?: string;
    logoUrl?: string;
    activeMemberCount: number;
  };
  /** Whether current user is already a member */
  isMember?: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Called when apply button clicked */
  onApply: () => void;
}
```

### Render Contract

- Hero section: logo (or initials), org name, org type badge, description.
- Details list: contact, schedule, founded, member count.
- CTA: "Apply to Join" button (large, primary).
- If already member: "You're a member" badge instead of apply button.
- If unauthenticated: apply redirects to /auth/sign-in?returnUrl=/org/{slug}.

### States

| State | Visual |
|-------|--------|
| Default | Full public profile |
| Loading | Skeleton hero + details |
| Already member | "You're a member" badge, no apply button |
| Unauthenticated | Apply button present (redirects to sign-in) |
| Error | "Organization page unavailable." |
