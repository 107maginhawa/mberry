<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Components: Communications (M07)

> Reusable components for the Communications module. Built on Radix UI (shadcn) primitives.

---

## Component 1: AnnouncementStatusBadge

**Purpose:** Color-coded badge for announcement status.

### TypeScript Props Interface

```typescript
interface AnnouncementStatusBadgeProps {
  status: AnnouncementStatus;
  size?: "sm" | "md" | "lg";
}

type AnnouncementStatus = "draft" | "scheduled" | "sent" | "archived" | "cancelled";
```

### WAI-ARIA Pattern

- **Pattern:** Status indicator
- **Attributes:** `aria-label="Announcement status: [status]"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| N/A | Non-interactive |

### Render Contract

| Status | Color | Icon | Label |
|--------|-------|------|-------|
| draft | gray-400 | FileEdit | Draft |
| scheduled | blue-500 | Calendar | Scheduled |
| sent | green-500 | CheckCircle | Sent |
| archived | gray-300 | Archive | Archived |
| cancelled | red-300 | XCircle | Cancelled |

### Events

None.

### States

- **Default:** Badge with color + icon + label
- **Skeleton:** Gray rounded rectangle

---

## Component 2: ChannelSelector

**Purpose:** Checkbox group for selecting delivery channels with in-app locked on.

### TypeScript Props Interface

```typescript
interface ChannelSelectorProps {
  /** Selected channels */
  value: DeliveryChannel[];
  /** Change handler */
  onChange: (channels: DeliveryChannel[]) => void;
  /** Whether in-app is forced (announcements: always true per M7-R1) */
  inAppForced?: boolean;
}

type DeliveryChannel = "in-app" | "email" | "push";
```

### WAI-ARIA Pattern

- **Pattern:** [Checkbox Group](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
- **Attributes:**
  - Group: `role="group"`, `aria-label="Delivery channels"`
  - In-app checkbox: `aria-checked="true"`, `aria-disabled="true"` when forced
  - Other checkboxes: standard checkbox semantics

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between checkboxes |
| Space | Toggle checkbox (except forced in-app) |

### Render Contract

- Three checkboxes in row: In-App (with lock icon if forced), Email, Push
- In-app: always checked, disabled when forced, tooltip: "In-app delivery is always enabled for announcements"
- Each with channel icon

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `DeliveryChannel[]` | Checkbox toggled |

### States

- **Default:** Checkboxes with current selection
- **Forced in-app:** In-app checkbox checked + disabled + lock icon
- **Disabled:** All checkboxes disabled (e.g., during publish)

---

## Component 3: AudienceSelector

**Purpose:** Multi-criteria audience filter for announcement targeting.

### TypeScript Props Interface

```typescript
interface AudienceSelectorProps {
  /** Current filter criteria */
  value: AudienceFilter;
  /** Change handler */
  onChange: (filter: AudienceFilter) => void;
  /** Available tiers from M05 */
  tiers: { id: string; name: string }[];
  /** Live recipient count */
  recipientCount: number | null;
  /** Loading recipient count */
  isCountLoading: boolean;
}

interface AudienceFilter {
  status?: ComputedMembershipStatus[];
  tierId?: string;
  categoryId?: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) for filters + live region for count
- **Attributes:**
  - Filter group: `role="group"`, `aria-label="Audience filters"`
  - Count: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between filter controls |
| Space/Enter | Open dropdown, toggle selection |
| Escape | Close dropdown |

### Render Contract

- Status multi-select: "All members" / specific statuses
- Tier dropdown: "All tiers" / specific tier
- Live recipient count: "N members will receive this announcement"
- Warning if 0: "No recipients match your selection" (error styling)
- Warning if > 10,000: "Recipient list exceeds maximum (10,000)" (M07-006)

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `AudienceFilter` | Any filter changed |

### States

- **Default:** "All active members" selected
- **Filtered:** Specific criteria shown as filter pills
- **No matches:** Red warning "No recipients match your selection"
- **Over limit:** Amber warning "Exceeds 10,000 recipient limit"
- **Loading count:** Spinner beside count text

---

## Component 4: RichTextEditor

**Purpose:** Announcement body editor with Handlebars variable insertion.

### TypeScript Props Interface

```typescript
interface RichTextEditorProps {
  /** HTML content */
  value: string;
  /** Change handler */
  onChange: (html: string) => void;
  /** Available Handlebars variables */
  variables: TemplateVariable[];
  /** Placeholder text */
  placeholder?: string;
  /** Read-only mode */
  readOnly?: boolean;
}

interface TemplateVariable {
  name: string;
  label: string;
  example: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) for formatting + contenteditable region
- **Attributes:**
  - Editor: `role="textbox"`, `aria-multiline="true"`, `aria-label="Announcement body"`
  - Toolbar: `role="toolbar"`, `aria-label="Text formatting"`
  - Variable button: `aria-label="Insert variable"`, `aria-haspopup="menu"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Enter/exit toolbar -> editor |
| Arrow Left/Right | Navigate toolbar buttons |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+Shift+V | Open variable picker |
| Enter | New paragraph in editor |

### Render Contract

- Toolbar: Bold, Italic, Link, Heading, List, Variable Insert button
- Variable picker: dropdown menu of available variables with example values
- Editor area: WYSIWYG with Handlebars tags rendered as styled pills
- Character count in footer

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `string` (HTML) | Content changes |
| onVariableInsert | `{ name: string }` | Variable selected from picker |

### States

- **Empty:** Placeholder text shown
- **Editing:** Content with formatting applied
- **Variable pill:** `{{firstName}}` rendered as colored pill (not raw text)
- **Read-only:** Content displayed, toolbar hidden
- **Error:** Red border if validation fails (e.g., too long)

---

## Component 5: DeliveryStatsCard

**Purpose:** Compact display of announcement delivery metrics.

### TypeScript Props Interface

```typescript
interface DeliveryStatsCardProps {
  stats: AnnouncementStats;
  /** Compact mode for list view */
  compact?: boolean;
}

interface AnnouncementStats {
  announcementId: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  failedCount: number;
  lastUpdated: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Meter](https://www.w3.org/WAI/ARIA/apg/patterns/meter/) for rates
- **Attributes:**
  - Delivery rate: `role="meter"`, `aria-valuenow`, `aria-label="Delivery rate"`
  - Open rate: `role="meter"`, `aria-valuenow`, `aria-label="Open rate"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| N/A | Non-interactive display |

### Render Contract

- Full: 4-metric layout (Sent, Delivered, Opened, Failed) with rates
- Compact: "340 sent, 98% delivered" inline
- Delivery rate bar (green)
- Open rate bar (blue)
- Failed count (red if > 0)

### Events

| Event | Payload | When |
|-------|---------|------|
| onClick | -- | Card clicked (navigate to detail) |

### States

- **Default:** Populated metrics
- **Loading:** Skeleton bars + numbers
- **Zero:** "Not yet sent" (stats all zero, announcement is draft/scheduled)

---

## Component 6: SubscriptionTopicRow

**Purpose:** Single row in notification preferences with per-channel toggles.

### TypeScript Props Interface

```typescript
interface SubscriptionTopicRowProps {
  /** Topic info */
  topic: {
    topicId: string;
    topicName: string;
    description?: string;
  };
  /** Current channel settings */
  channels: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  /** Whether in-app can be toggled */
  inAppToggleable: boolean;
  /** Change handler */
  onChange: (topicId: string, channels: { email: boolean; push: boolean; inApp: boolean }) => void;
  /** Saving state */
  isSaving: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Row with [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) controls
- **Attributes:**
  - Row: `role="row"`
  - Switch: `role="switch"`, `aria-checked`, `aria-label="[channel] for [topic]"`
  - Locked switch: `aria-disabled="true"`, `title="In-app cannot be disabled"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between switches |
| Space | Toggle switch |
| Enter | Toggle switch |

### Render Contract

- Topic name + optional description
- Three switch toggles: Email | Push | In-App
- In-App: lock icon when not toggleable
- Saving indicator: subtle spinner beside changed toggle

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `{ topicId, channels }` | Switch toggled |

### States

- **Default:** Toggles reflecting current preferences
- **Saving:** Subtle spinner on changed toggle
- **Saved:** Brief checkmark animation
- **Locked in-app:** In-app switch checked + disabled + lock icon
- **Error:** Toggle reverts with error tooltip

---

## Component 7: TemplatePreview

**Purpose:** Live preview of message template with sample data.

### TypeScript Props Interface

```typescript
interface TemplatePreviewProps {
  /** Template HTML with Handlebars */
  bodyHtml: string;
  /** Subject line with Handlebars */
  subject: string;
  /** Sample data for rendering */
  sampleData: Record<string, string>;
  /** Preview mode */
  mode: "email" | "in-app" | "push";
}
```

### WAI-ARIA Pattern

- **Pattern:** Region with tab-based mode switching
- **Attributes:** `role="region"`, `aria-label="Message preview ([mode])"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between mode tabs |
| Arrow Left/Right | Switch preview mode |

### Render Contract

- Mode tabs: Email | In-App | Push
- Email: rendered HTML in email frame mockup
- In-App: notification card mockup
- Push: push notification preview
- Unresolved variables: shown as `{{variableName}}` in amber highlight

### Events

| Event | Payload | When |
|-------|---------|------|
| onModeChange | `{ mode: string }` | Tab changed |

### States

- **Default:** Email mode with rendered template
- **Empty:** "Enter content to see preview"
- **Variable missing:** Amber-highlighted variable names (M7-R4 fallback)
