<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Components: Platform Administration (M03)

---

## C01: ActionCard

**WAI-ARIA Pattern:** none (article)
**Used In:** S01 Platform Dashboard

### TypeScript Props Interface

```typescript
interface ActionCardProps {
  /** Card title describing the issue */
  title: string;
  /** Urgency level for sorting and visual treatment */
  urgency: 'critical' | 'warning' | 'info';
  /** Number of items requiring attention */
  count: number;
  /** Description text */
  description: string;
  /** Navigation target when card clicked */
  href: string;
  /** Icon name from icon set */
  icon: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Focus card |
| Enter / Space | Navigate to href |

### Render Contract

- Card with colored left border: critical=red, warning=amber, info=blue.
- Icon (top-left), title, count badge, description.
- Entire card is clickable (`<a>` wrapper).
- Count badge: circle with number, colored by urgency.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onClick | Card clicked | Navigation via href |

### States

| State | Visual |
|-------|--------|
| Default | Card with urgency border |
| Hover | Subtle shadow elevation |
| Focus | Ring outline |
| Loading | Skeleton card |

---

## C02: StatCard

**WAI-ARIA Pattern:** none (figure with caption)
**Used In:** S01 Platform Dashboard

### TypeScript Props Interface

```typescript
interface StatCardProps {
  /** Label for the metric */
  label: string;
  /** Current value */
  value: string | number;
  /** Optional trend indicator */
  trend?: {
    direction: 'up' | 'down' | 'flat';
    percentage: number;
    period: string;
  };
  /** Format type for display */
  format?: 'number' | 'currency' | 'percentage';
  /** Currency code (if format is currency) */
  currency?: string;
}
```

### Render Contract

- Compact card: label (small text), value (large text), trend arrow + percentage.
- Currency formatted with Intl.NumberFormat.
- Trend: green up arrow (positive), red down arrow (negative), grey flat.

### States

| State | Visual |
|-------|--------|
| Default | Label + value + trend |
| Loading | Skeleton text blocks |
| No trend | Label + value only |

---

## C03: ActivityFeedItem

**WAI-ARIA Pattern:** none (list item)
**Used In:** S01 Platform Dashboard

### TypeScript Props Interface

```typescript
interface ActivityFeedItemProps {
  /** Event type */
  eventType: string;
  /** Human-readable description */
  description: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Actor who performed the action */
  actor?: { name: string; role: string };
  /** Link to related resource */
  href?: string;
}
```

### Render Contract

- Timeline layout: timestamp (left), event dot, description + actor (right).
- Clickable if href provided.
- Relative time display ("5 minutes ago", "Yesterday").
- Actor shown as "{name} ({role})" in muted text.

### States

| State | Visual |
|-------|--------|
| Default | Timeline item |
| Loading | Skeleton timeline items |
| Empty | "No recent activity." |

---

## C04: AssociationForm

**WAI-ARIA Pattern:** dialog (modal form for create/edit)
**Used In:** S02 Associations Management

### TypeScript Props Interface

```typescript
interface AssociationFormProps {
  /** Existing association data for edit mode (null for create) */
  association?: {
    id: string;
    name: string;
    country: string;
    licenseFormatRegex: string;
    creditCyclePeriod: number;
    creditCycleRequired: number;
    carryoverEnabled: boolean;
    localeSettings?: Record<string, unknown>;
  };
  /** Called on successful save */
  onSave: (data: AssociationFormData) => void;
  /** Called when dialog dismissed */
  onCancel: () => void;
}

interface AssociationFormData {
  name: string;
  country: string;
  licenseFormatRegex: string;
  creditCyclePeriod: number;
  creditCycleRequired: number;
  carryoverEnabled: boolean;
  localeSettings?: Record<string, unknown>;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between form fields |
| Enter | Submit form |
| Escape | Close dialog (cancel) |

### Render Contract

- Modal dialog with form fields.
- Name input + country selector + license regex input (with live test area).
- Credit cycle: period selector (1/2/3 years) + required units input.
- Carryover toggle switch.
- Locale settings: JSONB editor (collapsible advanced section).
- Footer: Cancel + Save buttons.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onSave | Form submitted, valid | `AssociationFormData` |
| onCancel | Escape or Cancel clicked | — |

### States

| State | Visual |
|-------|--------|
| Create | Empty form, title "New Association" |
| Edit | Pre-filled form, title "Edit {name}" |
| Loading | Spinner on save button |
| Error | Inline field errors |
| Conflict | "Name already exists" on name field |

---

## C05: OrgProvisionForm

**WAI-ARIA Pattern:** dialog (modal)
**Used In:** S02 Associations Management

### TypeScript Props Interface

```typescript
interface OrgProvisionFormProps {
  /** Parent association ID */
  associationId: string;
  /** Association name for display */
  associationName: string;
  /** Called on successful creation */
  onSave: (data: OrgProvisionData) => void;
  /** Called when dialog dismissed */
  onCancel: () => void;
}

interface OrgProvisionData {
  name: string;
  slug: string;
  orgType: 'chapter' | 'society' | 'national' | 'clinic';
  adminEmail: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between fields |
| Enter | Submit |
| Escape | Cancel |

### Render Contract

- Modal with: org name, slug (auto-generated from name, editable), org type selector, admin email.
- Slug preview: "{slug}.memberry.app"
- Org type: radio group with descriptions.
- Admin email: sends onboarding invite to this officer.

### States

| State | Visual |
|-------|--------|
| Default | Empty form |
| Loading | Spinner on save |
| Error | Inline validation errors |
| Slug conflict | "This URL is taken. Try another." |

---

## C06: FeatureFlagToggle

**WAI-ARIA Pattern:** switch (role="switch")
**Used In:** S03 Feature Flags

### TypeScript Props Interface

```typescript
interface FeatureFlagToggleProps {
  /** Module name */
  moduleName: string;
  /** Target type */
  targetType: 'tier' | 'org';
  /** Target identifier */
  targetId: string;
  /** Target display name */
  targetLabel: string;
  /** Current state */
  enabled: boolean;
  /** Called when toggled */
  onToggle: (enabled: boolean) => void;
  /** Whether toggle is read-only */
  readOnly?: boolean;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Space | Toggle switch |
| Tab | Move to next toggle |

### Render Contract

- Switch element: `role="switch"`, `aria-checked`, `aria-label="{moduleName} for {targetLabel}"`.
- Label text: "{moduleName}" above or beside switch.
- Read-only: switch visible but not interactive, muted color.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onToggle | Switch flipped | `enabled: boolean` |

### States

| State | Visual |
|-------|--------|
| Enabled | Green track, white thumb right |
| Disabled | Grey track, white thumb left |
| Read-only | Muted colors, no hover cursor |
| Updating | Subtle pulse animation |
| Error | Red outline, revert to previous |

---

## C07: PersonSearchCombobox

**WAI-ARIA Pattern:** combobox (role="combobox" with listbox)
**Used In:** S04 Impersonation

### TypeScript Props Interface

```typescript
interface PersonSearchComboboxProps {
  /** Called when user selected */
  onSelect: (person: PersonSearchResult) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum characters before search */
  minChars?: number;
}

interface PersonSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| ArrowDown | Open listbox / move to next result |
| ArrowUp | Move to previous result |
| Enter | Select highlighted result |
| Escape | Close listbox |
| Tab | Close listbox, move focus out |

### Render Contract

- Input with `role="combobox"`, `aria-expanded`, `aria-controls`.
- Dropdown listbox: `role="listbox"` with `role="option"` items.
- Each option: name, email, license number in multi-line layout.
- Debounced search (300ms).
- Min 2 characters before search triggers.

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onSelect | Option selected | `PersonSearchResult` |

### States

| State | Visual |
|-------|--------|
| Default | Empty input |
| Typing | Input with text, no results yet |
| Results | Dropdown with person cards |
| No results | "No users found" message in dropdown |
| Loading | Spinner in dropdown |
| Selected | Input shows "{name} ({email})", dropdown closed |

---

## C08: ImpersonationBanner

**WAI-ARIA Pattern:** alert (role="alert")
**Used In:** Global (all admin pages during impersonation)

### TypeScript Props Interface

```typescript
interface ImpersonationBannerProps {
  /** Impersonated user info */
  targetUser: { name: string; email: string };
  /** Time remaining (ISO duration or minutes) */
  expiresIn: number;
  /** Called when end button clicked */
  onEnd: () => void;
}
```

### Render Contract

- Fixed top banner (above all other content), yellow/amber background.
- Text: "Viewing as {name} ({email}) — {N} minutes remaining"
- "End Impersonation" button (right side).
- Countdown timer updates every minute.
- Auto-disappears when impersonation expires.

### States

| State | Visual |
|-------|--------|
| Active | Amber banner with countdown |
| Expiring soon (<5 min) | Red banner, "Ending soon" |
| Ending | Spinner on end button |
| Ended | Banner disappears, redirect to /admin |
