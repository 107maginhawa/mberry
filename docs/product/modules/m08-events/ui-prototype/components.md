<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Components: Events (M08)

> Reusable components for the Events module. Built on Radix UI (shadcn) primitives.

---

## Component 1: EventStatusBadge

**Purpose:** Color-coded badge for event status.

### TypeScript Props Interface

```typescript
interface EventStatusBadgeProps {
  status: EventStatus;
  size?: "sm" | "md" | "lg";
}

type EventStatus = "draft" | "published" | "cancelled" | "completed";
```

### WAI-ARIA Pattern

- **Pattern:** Status indicator
- **Attributes:** `aria-label="Event status: [status]"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| N/A | Non-interactive |

### Render Contract

| Status | Color | Icon | Label |
|--------|-------|------|-------|
| draft | gray-400 | FileEdit | Draft |
| published | green-500 | Globe | Published |
| cancelled | red-500 | XCircle | Cancelled |
| completed | blue-500 | CheckCircle | Completed |

### Events

None.

### States

- **Default:** Badge with color + icon + label
- **Skeleton:** Gray rounded rectangle

---

## Component 2: EventTypeBadge

**Purpose:** Badge displaying event type classification.

### TypeScript Props Interface

```typescript
interface EventTypeBadgeProps {
  eventType: EventType;
  size?: "sm" | "md";
}

type EventType =
  | "generalAssembly"
  | "inductionCeremony"
  | "fellowship"
  | "medicalMission"
  | "boardMeeting"
  | "committeeMeeting"
  | "fundraiser"
  | "other";
```

### WAI-ARIA Pattern

- **Attributes:** `aria-label="Event type: [label]"`

### Keyboard Interaction

None (non-interactive).

### Render Contract

| Type | Color | Icon | Label |
|------|-------|------|-------|
| generalAssembly | purple-500 | Users | General Assembly |
| inductionCeremony | amber-500 | Award | Induction Ceremony |
| fellowship | green-400 | Heart | Fellowship |
| medicalMission | blue-500 | Stethoscope | Medical Mission |
| boardMeeting | gray-500 | Briefcase | Board Meeting |
| committeeMeeting | gray-400 | Users2 | Committee Meeting |
| fundraiser | emerald-500 | DollarSign | Fundraiser |
| other | slate-400 | Calendar | Other |

### Events

None.

### States

- **Default:** Badge with color + icon + label

---

## Component 3: RegistrationStatusBadge

**Purpose:** Badge for event registration status.

### TypeScript Props Interface

```typescript
interface RegistrationStatusBadgeProps {
  status: RegistrationStatus;
  waitlistPosition?: number;
  size?: "sm" | "md";
}

type RegistrationStatus = "confirmed" | "waitlisted" | "cancelled" | "refunded" | "noShow";
```

### WAI-ARIA Pattern

- **Attributes:** `aria-label="Registration: [status]"`. If waitlisted: `aria-label="Waitlisted, position [N]"`

### Keyboard Interaction

None (non-interactive).

### Render Contract

| Status | Color | Icon | Label |
|--------|-------|------|-------|
| confirmed | green-500 | CheckCircle | Confirmed |
| waitlisted | yellow-500 | Clock | Waitlisted (#N) |
| cancelled | gray-400 | XCircle | Cancelled |
| refunded | blue-400 | RotateCcw | Refunded |
| noShow | red-300 | UserX | No Show |

### Events

None.

### States

- **Default:** Badge with status. Waitlisted includes position number.

---

## Component 4: QRScannerView

**Purpose:** Camera-based QR code scanner for event check-in.

### TypeScript Props Interface

```typescript
interface QRScannerViewProps {
  /** Event ID for check-in context */
  eventId: string;
  /** Organization ID */
  organizationId: string;
  /** Scan result handler */
  onScan: (result: ScanResult) => void;
  /** Whether scanner is active */
  isActive: boolean;
  /** Whether event is locked (completed) */
  isLocked: boolean;
}

interface ScanResult {
  personId: string;
  registrationId: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** Live region for scan results
- **Attributes:**
  - Scanner: `role="application"`, `aria-label="QR code scanner"`
  - Result: `role="alert"`, `aria-live="assertive"`
  - Camera: `aria-label="Camera viewfinder for QR scanning"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Space | Toggle scanner on/off |
| Tab | Move to manual search input |
| Escape | Deactivate scanner |

### Render Contract

- Camera viewfinder with crosshair overlay
- Scan result flash: green (success), red (error), blue (duplicate)
- Result display: member name + status
- Fallback: "Camera not available. Use manual check-in."

### Events

| Event | Payload | When |
|-------|---------|------|
| onScan | `ScanResult` | Valid QR decoded |
| onError | `{ message: string }` | Invalid QR or camera error |

### States

- **Inactive:** "Tap to activate scanner" overlay
- **Active:** Camera feed with crosshair
- **Scanning:** Brief processing indicator (< 1s)
- **Success:** Green flash (1.5s) with member name
- **Error:** Red flash with error message
- **Duplicate:** Blue flash "Already checked in"
- **Locked:** "Check-in closed. Event completed." Scanner disabled.
- **No camera:** "Camera not available" with manual check-in CTA

---

## Component 5: CapacityIndicator

**Purpose:** Visual indicator of event capacity and registration count.

### TypeScript Props Interface

```typescript
interface CapacityIndicatorProps {
  /** Current confirmed registrations */
  registrationCount: number;
  /** Maximum capacity (null = unlimited) */
  capacityLimit: number | null;
  /** Current waitlist size */
  waitlistCount: number;
  /** Compact display mode */
  compact?: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Meter](https://www.w3.org/WAI/ARIA/apg/patterns/meter/) for capacity
- **Attributes:**
  - `role="meter"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="[capacity]"`
  - `aria-label="Event capacity: [count] of [capacity]"`
  - If unlimited: `aria-label="[count] registered, no capacity limit"`

### Keyboard Interaction

None (non-interactive).

### Render Contract

- Progress bar: green (< 80%), yellow (80-99%), red (100%)
- Text: "N / [capacity] spots" or "N registered (unlimited)"
- Waitlist badge: "N on waitlist" if waitlistCount > 0
- Full state: "Event Full" with waitlist option text

### Events

None.

### States

- **Available:** Green bar, spots remaining text
- **Nearly full:** Yellow bar (> 80% capacity)
- **Full:** Red bar, "Event Full" + waitlist count
- **Unlimited:** No bar, just count text
- **Skeleton:** Gray bar placeholder

---

## Component 6: EventRegistrationCard

**Purpose:** Card showing a member's event registration with QR code access.

### TypeScript Props Interface

```typescript
interface EventRegistrationCardProps {
  /** Registration data with embedded event */
  registration: {
    registrationId: string;
    status: RegistrationStatus;
    registeredAt: string;
    event: {
      id: string;
      title: string;
      eventType: EventType;
      startDate: string;
      endDate: string;
      location: string | null;
      organizationName: string;
    };
  };
  /** Show QR code handler */
  onShowQR: (registrationId: string) => void;
  /** Cancel registration handler */
  onCancel: (registrationId: string) => void;
  /** Whether cancellation is allowed */
  canCancel: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Card](https://www.w3.org/WAI/ARIA/apg/patterns/card/) (interactive)
- **Attributes:**
  - Card: `role="article"`, `aria-label="Registration for [title]"`
  - QR button: `aria-label="Show QR code for check-in"`
  - Cancel button: `aria-label="Cancel registration"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between card actions |
| Enter | Activate focused action (QR or Cancel) |
| Space | Same as Enter |

### Render Contract

- Event title (linked to detail)
- Event type badge + date + location
- Organization name
- Registration status badge
- QR code button (for confirmed registrations)
- Cancel button (if allowed)

### Events

| Event | Payload | When |
|-------|---------|------|
| onShowQR | `{ registrationId: string }` | QR button clicked |
| onCancel | `{ registrationId: string }` | Cancel clicked (after confirmation) |
| onClick | -- | Card body clicked (navigate to event) |

### States

- **Confirmed:** Full card with QR button
- **Waitlisted:** Card with position indicator, no QR
- **Cancelled:** Muted card with strike-through title
- **Completed (past):** Muted card, no actions
- **Skeleton:** Gray card placeholder

---

## Component 7: QRCodeModal

**Purpose:** Modal displaying QR code for event check-in.

### TypeScript Props Interface

```typescript
interface QRCodeModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Registration ID (encoded in QR) */
  registrationId: string;
  /** Event title for display */
  eventTitle: string;
  /** Member name for display */
  memberName: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- **Attributes:** `role="dialog"`, `aria-label="Check-in QR code for [eventTitle]"`, `aria-modal="true"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Escape | Close modal |
| Tab | Move to close button |

### Render Contract

- QR code (large, centered, high contrast)
- Event title text
- Member name text
- "Present this code to the check-in officer" instruction
- Close button

### Events

| Event | Payload | When |
|-------|---------|------|
| onClose | -- | Escape, close button, or backdrop click |

### States

- **Open:** Modal with QR code displayed. QR generated client-side from registrationId.
- **Closed:** Modal hidden.

---

## Component 8: AttendanceCounter

**Purpose:** Real-time attendance count display for check-in screen.

### TypeScript Props Interface

```typescript
interface AttendanceCounterProps {
  /** Checked-in count */
  attendeeCount: number;
  /** Total confirmed registrations */
  totalRegistered: number;
  /** Attendance percentage */
  percentage: number;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Meter](https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
- **Attributes:** `role="meter"`, `aria-valuenow`, `aria-label="Attendance: [count] of [total]"`

### Keyboard Interaction

None (non-interactive display).

### Render Contract

- Large number: "[attendeeCount] / [totalRegistered]"
- Progress bar (green fill)
- Percentage text
- Real-time update animation (count increment)

### Events

None.

### States

- **Default:** Counter with progress bar
- **Zero:** "0 / [total] checked in"
- **Complete:** Green highlight "All checked in!"
- **Updating:** Brief pulse animation on count change
