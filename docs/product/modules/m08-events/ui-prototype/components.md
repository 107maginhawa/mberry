<!-- oli:ui-blueprint v2.0 | generated 2026-05-23 | source: MODULE_SPEC.md, Wave 2a design doc -->
<!-- supersedes: v1.0 (2026-05-21) — adds Wave 2a components (CPD badge, price badge, cover image, calendar download, public event card) -->

# UI Blueprint — Components: Events (M08) — Wave 2a

> Reusable components for the Events module. Built on Radix UI (shadcn) primitives.
> Design tokens from globals.css: `--color-primary`, `--color-success`, `--color-warning`, `--color-error`

---

## Component 1: EventStatusBadge

### TypeScript Props Interface

```typescript
interface EventStatusBadgeProps {
  status: "draft" | "published" | "cancelled" | "completed" | "registration_open" | "in_progress";
  size?: "sm" | "md";
}
```

### WAI-ARIA Pattern
- `role="status"`, `aria-label="Event status: {status}"`

### Render Contract

| Status | Background | Text | Label |
|--------|-----------|------|-------|
| draft | `var(--color-surface-warm)` | `var(--color-muted)` | "draft" |
| published | `var(--color-success-bg)` | `var(--color-success)` | "published" |
| registration_open | `var(--color-success-bg)` | `var(--color-success)` | "registration open" |
| in_progress | `var(--color-warning-bg)` | `var(--color-warning)` | "in progress" |
| completed | `var(--color-surface-warm)` | `var(--color-muted)` | "completed" |
| cancelled | `var(--color-error-bg)` | `var(--color-error)` | "cancelled" |

### Implementation Status: ✅ Inline in EventCard (STATUS_COLORS map)

---

## Component 2: PriceBadge

### TypeScript Props Interface

```typescript
interface PriceBadgeProps {
  /** Fee in cents (bigint from API) */
  fee: number | bigint | null | undefined;
  /** ISO 4217 currency code */
  currency?: string | null;
  size?: "sm" | "md";
}
```

### WAI-ARIA Pattern
- `aria-label="Registration fee: {formatted price}"`

### Render Contract

| Condition | Display | Style |
|-----------|---------|-------|
| fee = 0 or null | "Free" | `var(--color-success-bg)` + `var(--color-success)` |
| fee > 0 | "PHP 500" (formatted) | `var(--color-surface-warm)` + `var(--color-foreground)` |

### Implementation Status: ✅ Inline in EventCard + EventDetail

---

## Component 3: CpdBadge

### TypeScript Props Interface

```typescript
interface CpdBadgeProps {
  /** Whether event is credit-bearing */
  creditBearing: boolean;
  /** Number of CPD hours */
  creditAmount: number | null | undefined;
  /** Activity type for tooltip */
  cpdActivityType?: string | null;
  /** Whether member is registered (shows "pending check-in") */
  isRegistered?: boolean;
  size?: "sm" | "md";
}
```

### WAI-ARIA Pattern
- `aria-label="{creditAmount} CPD hours{isRegistered ? ', pending check-in' : ''}"`

### Render Contract

| Condition | Display | Style |
|-----------|---------|-------|
| Not credit-bearing or creditAmount=0 | Hidden | — |
| Credit-bearing + not registered | "4 CPD hrs" | `var(--color-primary-bg)` + `var(--color-primary)` |
| Credit-bearing + registered | "4 CPD hours (pending check-in)" | Same + suffix |

### Implementation Status: ✅ Inline in EventCard + EventDetail + MyEvents

---

## Component 4: EventCard (Officer)

### TypeScript Props Interface

```typescript
interface EventCardProps {
  event: {
    id: string;
    title: string;
    status: string;
    startDate: string | Date;
    endDate: string | Date;
    location?: string | null;
    registrationCount?: number;
    capacity?: number | null;
    registrationFee?: number | bigint | null;
    currency?: string | null;
    creditBearing?: boolean;
    creditAmount?: number | null;
    cpdActivityType?: string | null;
    coverImageUrl?: string | null;
    visibility?: string | null;
    eventSlug?: string | null;
  };
  orgId: string;
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  linkBase?: string;
}
```

### WAI-ARIA Pattern
- Card: `role="article"`, title is a link
- Actions menu: dropdown with `aria-label="Actions"`

### Render Contract

```
┌─────────────────────────────────┐
│ [Cover Image] (h-40, optional)  │
│  ┌──────┐                       │
│  │ JUN  │ ← date badge overlay  │
│  │  15  │                       │
│  └──────┘                       │
├─────────────────────────────────┤
│ [status] [PHP 500] [4 CPD hrs] … │ ← badge row
│                                 │
│ Event Title (h4, line-clamp-2)  │
│                                 │
│ 📅 Jun 15, 2026 · 09:00–17:00  │
│ 📍 Manila Hotel Ballroom        │
│ 👥 42 / 100 registered          │
└─────────────────────────────────┘
```

### Implementation Status: ✅ Implemented at `features/events/components/event-card.tsx`

---

## Component 5: PublicEventCard

### TypeScript Props Interface

```typescript
interface PublicEventCardProps {
  event: {
    id: string;
    title: string;
    startDate: string | Date;
    location?: string | null;
    coverImageUrl?: string | null;
    registrationFee?: number | bigint | null;
    currency?: string | null;
    creditBearing?: boolean;
    creditAmount?: number | null;
    eventSlug?: string | null;
  };
}
```

### WAI-ARIA Pattern
- Entire card is a link (`<Link>`)
- `aria-label="Event: {title}"`

### Render Contract

```
┌─────────────────────────────────┐
│ [Cover Image] (h-36, optional)  │
├─────────────────────────────────┤
│ [Free] [4 CPD hrs]              │ ← badges
│ Event Title (h4, line-clamp-2)  │
│ 📅 Sat, Jun 15, 2026           │
│ 📍 Manila Hotel Ballroom        │
└─────────────────────────────────┘
```

### Implementation Status: ✅ Inline in `/discover/events` route

---

## Component 6: QRScannerView

### TypeScript Props Interface

```typescript
interface QRScannerViewProps {
  /** Called when a valid QR code is scanned */
  onScan: (data: string) => void;
  /** Called on scan error */
  onError?: (error: Error) => void;
  /** Whether scanner is active */
  active: boolean;
  /** Toggle scanner visibility */
  onToggle: () => void;
}
```

### WAI-ARIA Pattern
- Container: `role="region"`, `aria-label="QR Code Scanner"`
- Toggle button: `aria-expanded="{active}"`, `aria-controls="qr-scanner"`
- Camera: `role="img"`, `aria-label="Camera viewfinder"`

### Keyboard Interaction
- Space/Enter: toggle scanner
- Escape: close scanner

### Render Contract

```
┌─────────────────────────────────┐
│ [Open Scanner] button           │ ← collapsed state
├─────────────────────────────────┤
│ ┌─────────────────────────┐     │ ← expanded state
│ │                         │     │
│ │     Camera Viewfinder   │     │
│ │                         │     │
│ └─────────────────────────┘     │
│ Point camera at attendee's QR   │
│ [Close Scanner]                 │
└─────────────────────────────────┘
```

### States

| State | Display |
|-------|---------|
| Collapsed | "Open Scanner" button only |
| Active | Camera viewfinder + close button |
| Permission denied | "Camera access required" message + manual fallback |
| Scan success | Green flash overlay |
| Scan error | Red flash overlay + error message |

### Library: `html5-qrcode` (npm)

### Implementation Status: ❌ **Not yet implemented** — manual search is primary check-in path

---

## Component 7: RegistrationStatusBadge

### TypeScript Props Interface

```typescript
interface RegistrationStatusBadgeProps {
  status: "confirmed" | "waitlisted" | "cancelled" | "refunded" | "noShow" | "pendingPayment";
  waitlistPosition?: number;
  size?: "sm" | "md";
}
```

### Render Contract

| Status | Background | Text | Label |
|--------|-----------|------|-------|
| confirmed | success-bg | success | "Confirmed" |
| waitlisted | warning-bg | warning | "Waitlisted" or "Waitlisted (#N)" |
| cancelled | error-bg | error | "Cancelled" |
| pendingPayment | warning-bg | warning | "Pending Payment" |
| refunded | surface-warm | muted | "Refunded" |
| noShow | surface-warm | muted | "No Show" |

### Implementation Status: ✅ Inline in MyEvents (REG_STATUS_STYLES map)

---

## Component 8: AttendanceCounter

### TypeScript Props Interface

```typescript
interface AttendanceCounterProps {
  attendeeCount: number;
  totalRegistered: number;
  percentage: number;
}
```

### WAI-ARIA Pattern
- `role="meter"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`
- `aria-label="Attendance: {attendeeCount} of {totalRegistered} checked in"`

### Render Contract

```
42 / 100 checked in (42%)
[████████░░░░░░░░░░░░] ← progress bar
```

### Implementation Status: ✅ Inline in attendance page (stats from repo)

---

## Component 9: CalendarDownloadButton

### TypeScript Props Interface

```typescript
interface CalendarDownloadButtonProps {
  event: {
    title: string;
    description?: string;
    location?: string;
    startDate: string | Date;
    endDate: string | Date;
  };
  variant?: "default" | "outline";
  size?: "sm" | "md" | "lg";
}
```

### Render Contract
- Button: CalendarPlus icon + "Add to Calendar"
- Click: generates .ics file client-side, triggers browser download

### Implementation Status: ✅ Implemented at `features/events/utils/generate-ics.ts`, inline button in EventDetail

---

## Component 10: EventRegistrationCard (My Events)

### TypeScript Props Interface

```typescript
interface EventRegistrationCardProps {
  item: {
    registration: {
      id: string;
      status: string;
      checkedIn?: boolean;
    };
    event: {
      id: string;
      title: string;
      startDate: string;
      location?: string | null;
      organizationId: string;
      orgSlug?: string;
      creditBearing?: boolean;
      creditAmount?: number | null;
    };
  };
}
```

### Render Contract

```
┌─────────────────────────────────┐
│ [Confirmed] [4 CPD pending]  →  │ ← status + CPD + countdown
│ Event Title (h4)                │
│ 📅 Sat, Jun 15 09:00           │
│ 🏢 Manila Hotel                │
├─────────────────────────────────┤
│ You're registered    [Cancel]   │ ← action row (upcoming only)
│ --- or ---                      │
│ Attended / Did not attend       │ ← result row (past only)
└─────────────────────────────────┘
```

### Implementation Status: ✅ Inline in `/my/events` route

---

## Component Inventory — Implementation Status

| # | Component | Status | File |
|---|-----------|--------|------|
| 1 | EventStatusBadge | ✅ Inline | `event-card.tsx` |
| 2 | PriceBadge | ✅ Inline | `event-card.tsx`, `$eventId.tsx` |
| 3 | CpdBadge | ✅ Inline | `event-card.tsx`, `$eventId.tsx`, `events.tsx` |
| 4 | EventCard | ✅ Component | `event-card.tsx` |
| 5 | PublicEventCard | ✅ Inline | `discover/events.tsx` |
| 6 | QRScannerView | ❌ Not built | — |
| 7 | RegistrationStatusBadge | ✅ Inline | `my/events.tsx` |
| 8 | AttendanceCounter | ✅ Inline | attendance page |
| 9 | CalendarDownloadButton | ✅ Inline | `$eventId.tsx` |
| 10 | EventRegistrationCard | ✅ Inline | `my/events.tsx` |
