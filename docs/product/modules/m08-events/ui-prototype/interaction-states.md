<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Interaction States: Events (M08)

> Module-wide interaction state patterns. Each screen implements all 9 states.

---

## State 1: Loading

**Trigger:** Initial fetch, event list, registration, check-in attendee list.

| Aspect | Implementation |
|--------|---------------|
| Visual | Skeleton UI. Tables: row skeletons. Cards: gray rectangles. Scanner: camera loading indicator. |
| Duration | 200-500ms typical. Check-in: < 1s (critical path per spec Section 16). |
| ARIA | `aria-busy="true"`. `aria-live="polite"` announces "Loading events..." |
| Interaction | Controls disabled. Scanner deactivated during load. Navigation functional. |
| Fallback | > 3s: text indicator. Check-in > 2s: "Verifying..." text beside scanner. |

**Per-screen variants:**
- Events Dashboard: 5-row skeleton table + skeleton stats
- Create/Edit: skeleton form fields (edit mode)
- Check-In: scanner camera loading + skeleton attendee list
- Event Detail: skeleton hero + detail placeholders
- My Events: 4 skeleton event cards

---

## State 2: Empty

**Trigger:** Zero records for current view.

| Aspect | Implementation |
|--------|---------------|
| Visual | Centered illustration + heading + CTA. |
| ARIA | `role="status"` |
| Interaction | CTA functional. |

**Per-screen messages:**
- Dashboard: "No events yet. Create your first one." CTA: Create Event
- Check-In: "No registrations for this event." (event with 0 registrations)
- My Events: "No events yet. Browse your organization's events to get started." Link to browse.
- Event Detail: N/A (always has data if event exists; 404 otherwise)

---

## State 3: Success

**Trigger:** Data loaded or mutation completed.

| Aspect | Implementation |
|--------|---------------|
| Visual | Populated UI. Status and type badges colored. Capacity indicators functional. |
| ARIA | `aria-busy="false"`. |
| Interaction | All controls enabled. Scanner active for check-in. |

**Mutation feedback (via sonner):**
- Event created: "Event saved as draft." (gray, 3s)
- Event published: "Event published! Members will be notified." (green, 5s)
- Registration: "Registered! Check your email for details." (green, 5s)
- Waitlisted: "Added to waitlist (position N). You'll be notified when a spot opens." (blue, 5s)
- Check-in (QR): Green flash with member name (1.5s). No toast (visual flash is primary feedback).
- Check-in (manual): sonner: "[Name] checked in." (green, 3s)
- Event cancelled: "Event cancelled. N members will be notified." (amber, persistent)
- Event completed: "Event marked as completed. N attended, M no-shows." (blue, persistent)
- Registration cancelled: "Registration cancelled." (gray, 3s)

---

## State 4: Validation Error

**Trigger:** Invalid form input or business rule violation.

| Aspect | Implementation |
|--------|---------------|
| Visual | Red border + inline error text. |
| ARIA | `aria-invalid="true"`. `aria-describedby` to error. |
| Interaction | Submit enabled. Focus on first error. |

**Per-screen errors:**
- Create Event: "Title is required." "Start date must be in the future." (M08-003). "End date must be after start date." "Fee requires payment gateway configuration."
- Registration: "Event at full capacity." (M08-001, if waitlist disabled). "Registration deadline passed." (M08-002). "You are already registered for this event." (M08-005).
- Check-In: "Person not registered for this event." (M08-005). "Event completed -- check-ins locked." (M08-006).

---

## State 5: Permission Error

**Trigger:** Insufficient role.

| Aspect | Implementation |
|--------|---------------|
| Visual | 403 page or redirect. |
| ARIA | `role="alert"`. |
| Interaction | Back button or alternative link. |

**Per-screen messages:**
- Dashboard (non-officer): redirect to public event list `/org/[id]/events`
- Create (non-officer): "Creating events requires an officer role."
- Check-In (non-officer): "Check-in requires an officer role." (BR-17)
- Event Detail (internal, non-member): "This event is only available to organization members." (M8-R4)
- My Events: N/A (own data, all authenticated)

---

## State 6: Unexpected Error

**Trigger:** API failure, camera error, network timeout.

| Aspect | Implementation |
|--------|---------------|
| Visual | Error boundary with retry. Camera error: fallback message. |
| ARIA | `role="alert"`. |
| Interaction | Retry button. Manual check-in as fallback for camera errors. |

**Per-screen messages:**
- Dashboard: "Couldn't load events. Please try again."
- Create: "Couldn't save event. Your changes are preserved."
- Check-In (camera): "Camera not available. Use manual check-in below."
- Check-In (API): "Check-in failed. Please try again."
- Event Detail: "Couldn't load event details." + Retry
- Registration: "Registration failed. Please try again."

---

## State 7: Conflict/Duplicate

**Trigger:** Business rule conflict.

| Aspect | Implementation |
|--------|---------------|
| Visual | Inline alert or modified UI state. |
| ARIA | `role="alert"` or `role="status"`. |
| Interaction | Alternative action offered. |

**Scenarios:**
- Event full: Register button changes to "Join Waitlist" (M8-R1, BR-27)
- Already registered: "You are already registered for this event." (M08-005). Register button disabled.
- Duplicate QR scan: Blue flash "Already checked in." (idempotent, not an error)
- Edit completed event: "This event has ended. No further changes allowed." (M8-R6)
- Cancel completed event: "Cannot cancel a completed event." (M08-006)

---

## State 8: Confirmation/Warning

**Trigger:** Destructive or significant actions.

| Aspect | Implementation |
|--------|---------------|
| Visual | Alert dialog with description. Destructive uses red button. |
| ARIA | `role="alertdialog"`. Focus trapped. |
| Interaction | Cancel/Confirm. Escape = cancel. |

**Confirmations:**
- Publish event: "Publish [title]? Members will be notified and registration will open." [Cancel] [Publish]
- Cancel event: "Cancel [title]? All registered members (N) will be notified. Paid registrations will be refunded." [Keep Event] [Cancel Event] (red)
- Complete event: "Mark [title] as completed? Check-in and registration will be locked." [Cancel] [Complete]
- Register (paid): "This event has a registration fee of PHP [amount]. You'll be redirected to payment." [Cancel] [Continue to Payment]
- Cancel registration: "Cancel your registration for [title]?" [Keep Registration] [Cancel Registration]
- Leave create form: "You have unsaved changes. Leave anyway?" [Stay] [Leave]

---

## State 9: Offline/Sync

**Trigger:** Network lost.

| Aspect | Implementation |
|--------|---------------|
| Visual | Amber banner. |
| ARIA | `role="status"`. |
| Interaction | Read from cache. Writes disabled. QR codes work offline. |

**Per-screen behavior:**
- Dashboard: Cached event list. "You're offline." Create disabled.
- Create: "Creating events requires an internet connection." Save disabled. Local form state preserved.
- Check-In: "Check-in requires an internet connection." Scanner disabled. Cached attendee list shown. Note: future enhancement could support offline check-in queue.
- Event Detail: Cached event data. Register disabled.
- My Events: Cached cards. QR codes still work (generated client-side from registrationId). Cancel disabled.

**Recovery:**
1. Banner: "Back online. Refreshing..."
2. Active queries invalidated
3. Banner dismissed
4. Scanner reactivated (check-in screen)

**QR code offline note:** QR codes for check-in are generated client-side from the registration ID. The QR image displays correctly offline. However, the check-in action (API call) requires connectivity.
