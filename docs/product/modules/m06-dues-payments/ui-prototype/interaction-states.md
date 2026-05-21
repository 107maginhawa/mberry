<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Interaction States: Dues & Payments (M06)

> Module-wide interaction state patterns. Each screen implements all 9 states.

---

## State 1: Loading

**Trigger:** Initial data fetch, report generation, payment processing.

| Aspect | Implementation |
|--------|---------------|
| Visual | Skeleton UI. Stat cards: gray rectangles. Tables: row skeletons. Payment card: pulsing amount. |
| Duration | Dashboard: 200-500ms. Reports: up to 5s (show progress). Payment processing: polling with spinner. |
| ARIA | `aria-busy="true"`. `aria-live="polite"` announces "Loading financial data..." |
| Interaction | Filter/action controls disabled during load. Navigation functional. |
| Fallback | > 5s: "Generating report... This may take a moment." |

**Per-screen variants:**
- Dashboard: 3 skeleton stat cards + 5-row skeleton table
- Pay Dues: centered card skeleton with pulsing amount area
- Dues Config: skeleton form fields + skeleton fund table
- Payment History: 5-row skeleton table

---

## State 2: Empty

**Trigger:** No records for current view.

| Aspect | Implementation |
|--------|---------------|
| Visual | Centered illustration + message + CTA. |
| ARIA | `role="status"` |
| Interaction | CTA buttons functional. |

**Per-screen messages:**
- Dashboard (no gateway): "Configure your payment gateway to start collecting dues online." CTA: Set Up Payments
- Dashboard (no payments): "No payments recorded yet." CTAs: Record Payment, Configure Gateway
- Dues Config (first time): Setup wizard with step-by-step guide
- Payment History: "No payment history yet."

---

## State 3: Success

**Trigger:** Data loaded or mutation completed.

| Aspect | Implementation |
|--------|---------------|
| Visual | Populated UI. Color-coded metrics. |
| ARIA | `aria-busy="false"`. Stat cards accessible with values. |
| Interaction | All controls enabled. |

**Mutation feedback (via sonner):**
- Manual payment recorded: "Payment of PHP [amount] recorded. Receipt: [number]." (green, persistent with receipt link)
- Refund processed: "Refund of PHP [amount] processed. Membership expiry adjusted." (blue, 5s)
- Config saved: "Dues configuration saved." (green, 3s)
- Fund allocation saved: "Fund allocation saved." (green, 3s)

---

## State 4: Validation Error

**Trigger:** Invalid form input.

| Aspect | Implementation |
|--------|---------------|
| Visual | Red border on field. Error text below. Live sum indicator for funds. |
| ARIA | `aria-invalid="true"`. `aria-describedby` to error. `aria-errormessage` for detail. |
| Interaction | Submit remains enabled. Focus to first error. |

**Per-screen errors:**
- Dues Config: "Fund percentages must total exactly 100%." (live sum indicator, M06-010). "Amount must be positive." "Grace period must be 0-90 days."
- Manual Payment Form: "Amount must be positive." (M06-001). "Payment method is required." "Reference number is required for manual payments." (M06-011)
- Gateway Config: "Invalid credentials format."

---

## State 5: Permission Error

**Trigger:** User lacks treasurer/president role or 2FA.

| Aspect | Implementation |
|--------|---------------|
| Visual | Full-page 403 with message. |
| ARIA | `role="alert"`, `aria-live="assertive"`. |
| Interaction | Back button + link to permitted area. |

**Per-screen messages:**
- Dashboard: "Financial data requires Treasurer or President role with two-factor authentication."
- Dues Config: Same as dashboard.
- Manual Payment: "Recording payments requires Treasurer or President role."
- Payment History: N/A (own data always visible)

---

## State 6: Unexpected Error

**Trigger:** API 5xx, network failure, gateway timeout.

| Aspect | Implementation |
|--------|---------------|
| Visual | Error boundary. Warning icon + message + retry. Page chrome preserved. |
| ARIA | `role="alert"`. |
| Interaction | Retry re-fetches. |

**Per-screen messages:**
- Dashboard: "Couldn't load financial data. Please try again."
- Pay Dues: "Payment service temporarily unavailable. Please try again." (M06 error: gateway unreachable)
- Dues Config: "Couldn't save configuration. Your changes are preserved."
- Reports: "Report generation failed. Try again or narrow your date range."

**Gateway-specific errors:**
- Gateway unreachable (502): "Payment service temporarily unavailable."
- Gateway refund failure (502): "Refund failed. Gateway error: [msg]. Retry available."
- Webhook timeout (24h): treasurer notification only (no member-facing error)

---

## State 7: Conflict/Duplicate

**Trigger:** Duplicate payment detection (M6-R4), idempotency key conflict (M06-014).

| Aspect | Implementation |
|--------|---------------|
| Visual | Amber alert dialog with existing payment details. |
| ARIA | `role="alertdialog"`. Focus trapped. |
| Interaction | Cancel or Continue (with explicit confirmation). |

**Scenarios:**
- Duplicate manual recording: "A payment of PHP 5,000 was recorded for this member 3 minutes ago by [officer]. Continue?" (M6-R4, 5-min window)
- Idempotency key conflict: "This request was already submitted with different data." (M06-014, silent retry with same key)
- Life member payment: "Life members are exempt from dues." (M06-006, blocked)

---

## State 8: Confirmation/Warning

**Trigger:** Financial mutations requiring acknowledgment.

| Aspect | Implementation |
|--------|---------------|
| Visual | Alert dialog with clear description. Destructive uses red button. |
| ARIA | `role="alertdialog"`. |
| Interaction | Cancel/Confirm. Escape = cancel. |

**Confirmations:**
- Record manual payment: "Record payment of PHP [amount] for [member]? This will extend their dues through [date]." [Cancel] [Record Payment]
- Process refund: "Refund PHP [amount] for [member]? Their dues expiry will be adjusted to [date]." [Cancel] [Process Refund] (red)
- Send overdue reminders: "Send overdue reminder to N members?" [Cancel] [Send]
- Dues config change: "Changing dues configuration will affect future invoices only. Existing invoices are not modified." [Cancel] [Save]

---

## State 9: Offline/Sync

**Trigger:** Network lost.

| Aspect | Implementation |
|--------|---------------|
| Visual | Amber banner. |
| ARIA | `role="status"`. |
| Interaction | Read from cache. Writes disabled. |

**Per-screen behavior:**
- Dashboard: "You're offline. Financial data may be stale." Read-only.
- Pay Dues: "Payment requires an internet connection." Pay button disabled.
- Dues Config: "Configuration changes require an internet connection." Form read-only.
- Payment History: Cached list shown. Receipt downloads disabled.

**Financial data note:** Payment data is never cached for accuracy (per spec Section 16). Only gateway config and reminder schedules are cached. When offline, stale dashboard data is shown with clear staleness indicator.
