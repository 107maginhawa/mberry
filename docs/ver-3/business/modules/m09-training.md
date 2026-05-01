# Module 9: Training

## Overview

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Credit-bearing professional development activities. Training programs are the primary mechanism through which members earn CPD/CE credits toward their regulatory cycle requirements. Includes training creation, enrollment with optional payment, attendance confirmation, automatic credit award, certificate generation, and CPD compliance tracking. |
| **Phase** | 1 |
| **Monetization Tier** | Premium |
| **Dependencies** | M05 (Membership) -- training enrollment requires active membership; member identity for attendance and credit records. M07 (Communications) -- training creation triggers notifications; network-wide visibility uses the activity feed. M06 (Dues & Payments) -- paid training registration requires payment processing through the org's configured gateway. M10 (Credit Tracking) -- attendance confirmation generates CreditEntry records (AUTO type); credit cycle and aggregation logic lives in M10. |

---

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 9.1 | Training creation | Officer creates a training: title, type (select from 5 platform-defined types), description (rich text), date/time (single-session or multi-session with start/end dates), location or online link, cover image, **credit value** (number of CPD credits awarded on completion), **regulatory approval status** (e.g., "PRC Approved", "Pending Approval", "Not Applicable") with optional approval reference number. | Officer (Society Officer, Secretary) | P0 |
| 9.2 | Training editing and cancellation | Officer edits training details before or after publishing. Can cancel a training -- all enrolled members are notified, no credits awarded for cancelled training. If credits were already awarded (post-attendance confirmation), cancellation does NOT revoke existing credits. Manual credit correction required via M10. | Officer | P0 |
| 9.3 | Enrollment (registration) | Member enrolls in a training. Three enrollment modes configurable per training: **Open** (any member can enroll), **Approval-required** (officer must approve each enrollment), **Invitation-only** (officer sends invitations to specific members). If free: instant confirmation (or pending approval). If paid: payment through org gateway required before enrollment is confirmed. Capacity limit optional. Waitlist when capacity reached. | Member, Officer | P0 |
| 9.4 | QR attendance check-in | For in-person trainings: officer uses QR scanner to check in attendees. Same TOTP-like rotating QR mechanism as Events (M08): 60-second rotation, +/- 1 period validation window, 30-second clock skew tolerance, offline-capable with sync. Check-in triggers automatic credit award. | Officer, Member | P0 |
| 9.5 | Completion marking | For courses/programs spanning multiple sessions: officer marks members as "completed" after the program ends. Completion triggers automatic credit award. Bulk completion supported (select multiple members). | Officer | P0 |
| 9.6 | Automatic credit award | When attendance is confirmed (QR check-in or completion marking), the system immediately creates a `CreditEntry` of type AUTO. Credits equal the training's defined credit value. No manual action required. Credit entry links back to the training record. Duplicate check-in prevention: same member cannot receive credits twice for the same training. | System | P0 |
| 9.7 | Certificate generation | After attendance is confirmed AND the training date has passed, member can download a PDF certificate. Certificate includes: member name, training title, training type, date, location, credits earned, hosting org name + logo, platform branding, and HMAC-signed verification QR code. | Member, System | P0 |
| 9.8 | Network-wide visibility | Trainings are shared to the network by default (visible to all orgs in the association). Officer can restrict a training to their org only via a toggle. Society and national body trainings appear in chapter activity feeds (subject to chapter sharing preferences per M04 capability 4.11). | Officer | P0 |
| 9.9 | Training approval workflow | For certain training types (configurable per association), publishing requires network-level approval before the training becomes visible. Draft -> Pending Approval -> Approved -> Published. National body officers review and approve/reject pending trainings. | Officer, National Admin | P0 |
| 9.10 | Training analytics | Officer views per-training analytics: enrollment count, completion rate, credits awarded total, revenue collected (if paid), member source breakdown (which orgs enrollees come from). Exportable as CSV. | Officer | P0 |

---

## Training Types

The platform defines 5 training types. These are fixed at the platform level and cannot be customized by individual organizations. Consistency enables meaningful cross-org CPD reporting.

| # | Type | Typical Use |
|---|------|-------------|
| 1 | Seminar | Single-session educational presentation or lecture |
| 2 | Workshop | Hands-on, interactive learning session |
| 3 | Convention / Conference | Multi-day, multi-session professional gathering |
| 4 | Online Course / Webinar | Online live or recorded educational session, may span multiple dates |
| 5 | Skills Training | Practical skills development session (clinical, technical) |

---

## User Journeys

### SO-1: Create and Publish Training Program

| Attribute | Detail |
|-----------|--------|
| **Actor** | Society Officer |
| **Trigger** | Society officer needs to create a new CPD training program for members. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "Training" from sidebar | Training dashboard: list of upcoming, past, drafts, and pending approval trainings | |
| 2 | Clicks "New Training" | Training creation form | |
| 3 | Selects training type | Picks from 5 platform-defined types via dropdown. If "Convention / Conference" or "Online Course / Webinar" selected: multi-session fields appear (start date, end date, schedule description). | |
| 4 | Fills in details | Title (required), description (rich text editor), date/time (required), location: venue + address OR "Online" + link. Cover image (optional, max 5 MB). | Missing required fields -> inline validation. End date before start date -> error. |
| 5 | Sets credit value | Number input: CPD credits awarded on completion. Minimum 0.5, maximum configurable per association. | Credit value 0 -> warning: "Training with 0 credits will not contribute to members' CPD requirements. Continue?" |
| 6 | Sets regulatory approval status | Dropdown: "PRC Approved" / "Pending Approval" / "Not Applicable". If approved: optional reference number field. | |
| 7 | Configures enrollment | Mode: Open (default) / Approval-required / Invitation-only. Fee: Free / Paid (amount input). Capacity limit: optional number. | Paid but no gateway -> "Connect payment gateway first." |
| 8 | Sets visibility | Network-wide (default) or Internal only. | |
| 9 | Publishes (or submits for approval) | If training type requires approval: status -> "Pending Approval." Officer notified: "Submitted for approval. You'll be notified when reviewed." If no approval required: published immediately. Appears in activity feeds. Notifications sent to members. | Approval required but no approvers configured -> "No reviewers configured for this training type. Contact your national body administrator." |

**Success criteria:** Training appears in network-wide activity feeds within 30 seconds of publishing (or approval). Credit value is prominently displayed on the training card.

---

### SO-2: Manage Training Enrollments

| Attribute | Detail |
|-----------|--------|
| **Actor** | Society Officer |
| **Trigger** | Officer needs to review and manage member enrollments for a training program. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens training detail -> "Enrollments" tab | Enrollment list: members with status (enrolled/pending_approval/pending_payment/waitlisted/completed/cancelled). Count: "35 of 50 enrolled." | |
| 2 | **If approval-required mode:** Reviews pending enrollments | Pending list with member details (name, org, license#). Approve / Reject buttons per member. Bulk approve supported. | |
| 3 | Approves enrollment | Member notified: "Your enrollment in [Training] has been approved." If paid: payment link included. | Reject with reason -> member notified: "Enrollment rejected. Reason: [text]." |
| 4 | Filters by status | Dropdown: All / Enrolled / Pending Approval / Pending Payment / Waitlisted / Completed | |
| 5 | Sends reminder to unpaid enrollees | "Send Payment Reminder" button for pending_payment members. Notification with payment link sent. | No unpaid enrollees -> button disabled. |
| 6 | Views capacity status | Progress bar: "35 / 50 spots filled." Waitlist count if applicable. | |

**Success criteria:** Enrollment status updates in real-time. Approval actions complete within 1 second.

---

### SO-3: Confirm Attendance and Award Credits

| Attribute | Detail |
|-----------|--------|
| **Actor** | Society Officer |
| **Trigger** | Training session has occurred; officer needs to confirm attendance and award credits. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1a | **Single-session (Seminar/Workshop):** Opens training -> "Check-in" | QR scanner + manual check-in (same interface as Event check-in M08). Each check-in immediately awards credits. | Camera denied -> manual fallback. Invalid QR -> rejection message. |
| 1b | **Multi-session (Course/Convention):** Opens training -> "Attendance" tab | Enrolled members list with "Mark Complete" action per member. Bulk select supported. | |
| 2 | Marks individual members as "Completed" or bulk-selects | Confirmation: "Mark N members as completed? This will award [X] credits each." | |
| 3 | Confirms | Credits auto-awarded. CreditEntry (type: AUTO) created per member. Members notified: "You completed [Training]. [X] credits awarded." | Already completed -> "Already marked complete. Credits previously awarded." |
| 4 | Views completion stats | Completion count, completion rate (completed / enrolled), total credits issued. | |
| 5 | Members' credit dashboards update | Credit entry appears with AUTO tag, linked to this training. Progress bar updates. | |

**Success criteria:** Credits appear in member's dashboard immediately after confirmation. CreditEntry correctly linked to training. No duplicate credit entries.

---

### SO-4: View Training Analytics

| Attribute | Detail |
|-----------|--------|
| **Actor** | Society Officer |
| **Trigger** | Officer wants to review performance metrics for a training program. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens training -> "Analytics" tab | Analytics dashboard for this training | |
| 2 | Views enrollment metrics | Total enrolled, enrollment over time (chart), enrollment by source org (which chapters sent members) | No enrollments -> "No enrollments yet." |
| 3 | Views completion metrics | Completion count, completion rate, average time to completion (for courses) | Training not yet completed -> "Completion data available after training ends." |
| 4 | Views credit metrics | Total credits issued, credits per member (should be uniform), any corrections applied | |
| 5 | Views revenue metrics (if paid) | Total revenue, payments by method (online/manual), outstanding payments | |
| 6 | Exports report | CSV download: enrollee list with name, org, enrollment date, completion status, credits awarded, payment status | |

**Success criteria:** Analytics load within 2 seconds. Data is accurate and consistent with enrollment and credit records.

---

### SO-7: First Training Published (First Value Moment)

| Attribute | Detail |
|-----------|--------|
| **Actor** | Society Officer |
| **Trigger** | Society officer publishes their first training program on the platform. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Publishes first training | Training appears in society member feeds AND chapter feeds (network-wide default). Confirmation: "Your training is live! Members across the network can now discover and enroll." | No chapters have sharing enabled -> "Published to your society members. Note: some chapters may have network sharing disabled." |
| 2 | First enrollments arrive | Dashboard shows enrollment count incrementing. Notification: "3 members have enrolled in [Training]." | |
| 3 | After training: confirms attendance | Credits awarded. Members' dashboards update. "You've awarded [X] credits to [N] members." | |

**Success criteria:** Training visible in chapter feeds within 30 seconds. First enrollment notification delivered to officer.

---

### M-19: Browse and Enroll in Training

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member wants to find CPD training opportunities and enroll. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens activity feed or navigates to "Training" section | List of available trainings: own org + network-shared. Each card shows: type icon, title, date, location, credit value badge (e.g., "5 CPD"), fee (if paid), approval status badge, enrollment status (Open/Full/Closed). | No trainings available -> "No upcoming trainings. Check back later or ask your society officer." |
| 2 | Filters trainings | Filter by: type (5 types), date range, credit value range, free/paid, org source, approval status | No results -> "No trainings match your filters." |
| 3 | Taps training card | Training detail page: full description, date/time, location, credit value, regulatory approval status + reference number, enrollment count ("35/50"), organizer info, certificate availability note. | |
| 4a | **Open enrollment, free:** Clicks "Enroll" | Instant confirmation: "You're enrolled! [X] credits will be awarded upon attendance confirmation." Calendar add option. | Already enrolled -> "You're already enrolled." Full -> "Training is full. Join waitlist?" |
| 4b | **Open enrollment, paid:** Clicks "Enroll" | Redirected to payment checkout. Amount pre-filled. | Gateway unavailable -> "Online payment unavailable. Contact organizer." Payment fails -> retry. |
| 4c | **Approval-required:** Clicks "Request Enrollment" | "Enrollment request submitted. You'll be notified when reviewed." Status: Pending Approval. | |
| 4d | **Invitation-only:** Cannot enroll | Enroll button hidden. Message: "This training is by invitation only." | Member received invitation -> "You've been invited. Click to accept." |
| 5 | Payment completes (paid) | Webhook confirms. Enrollment confirmed. Receipt generated. | |
| 6 | Capacity full -> joins waitlist | "You're #N on the waitlist." Promotion follows same rules as Events (M08). | |

**Success criteria:** Enrollment completes within 1 second (free). Credit value prominently visible on all training cards and detail pages.

---

### M-20: View My Training History and Credits Earned

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member wants to review their training history and CPD credits. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "My Training" from dashboard or profile | Training history: Upcoming enrollments, Completed (with credits), All history. | No history -> "No training history yet. Browse available trainings." |
| 2 | Views completed trainings | List: training title, date, type, hosting org, credits earned, certificate status (Available/Not Yet). | |
| 3 | Views credit summary | Total credits earned from trainings (AUTO type). Breakdown by training. Links to full credit dashboard (M10). | |
| 4 | Taps a completed training | Detail: training info, enrollment date, attendance confirmation date, credits awarded, certificate download link (if available). | |

**Success criteria:** Training history loads within 2 seconds. Credit totals match M10 credit dashboard.

---

### M-21: Download Training Certificate

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member needs to download a certificate for a completed training (for regulatory submission, employer, personal records). |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens completed training detail OR navigates to "My Certificates" | Certificate section visible. "Download Certificate" button. | |
| 2 | **Pre-condition check:** Training date has passed AND attendance confirmed | If both conditions met: button active. If training date not passed: "Certificate available after [date]." If attendance not confirmed: "Certificate not available. Attendance has not been confirmed. Contact your training organizer." | Training cancelled after credits awarded -> certificate still available (credits were awarded, training record preserved). |
| 3 | Clicks "Download Certificate" | PDF generated and downloaded. Certificate contains: member full name, training title, training type, date(s), location, hosting org name + logo, credits earned, certificate number (unique), platform branding ("Verified by Memberry"), HMAC-signed verification QR code. | PDF generation fails -> "Certificate generation failed. Please try again." |
| 4 | Certificate downloaded | Available in browser downloads. Also accessible from "My Certificates" list for re-download. | |
| 5 | Third party scans verification QR | Verification page shows: member name, training title, date, credits, certificate number, "Valid" status. If certificate data tampered: "Invalid certificate. This certificate could not be verified." | |

**Success criteria:** Certificate PDF generates within 5 seconds. PDF renders correctly on all devices and is print-friendly (A4/Letter). QR verification works for valid certificates. Certificates are only available when both timing and attendance conditions are met (BR-20).

---

## Business Rules

### Referenced Business Rules

| Rule ID | Summary | Relevance to This Module |
|---------|---------|--------------------------|
| BR-11 | Credit Cycle Start | Credits earned at trainings count toward the member's individual credit cycle, which starts from their registration date. Cycle logic is managed in M10. |
| BR-12 | Credit Carry-Over | If training credits push a member over their cycle requirement, the excess carries over to the next cycle (logic in M10). |
| BR-13 | Auto vs Manual Credits | Core rule for this module. Attendance confirmation (QR check-in or completion marking) triggers immediate CreditEntry creation of type AUTO. No manual action required. |
| BR-14 | Cross-Org Credit Aggregation | Credits from trainings hosted by any org in the association aggregate into the member's total cycle credits across all their orgs. |
| BR-16 | Activity Visibility | Trainings default to network-wide visibility. Officer can restrict to internal only via toggle. |
| BR-17 | Attendance Confirmation | Explicit attendance confirmation (QR check-in or completion marking) is required before credits are awarded. Enrollment alone does not trigger credit award. |
| BR-20 | Certificate Generation | Certificates only available after (1) training date has passed AND (2) attendance is confirmed. Both conditions required. |

### Module-Specific Rules

| Rule ID | Rule | Category |
|---------|------|----------|
| M9-R1 | **Training types are platform-defined and immutable.** The 5 training types cannot be added, removed, or renamed by organizations. This ensures consistency for CPD reporting across the network. | Constraint |
| M9-R2 | **Credit value is set at creation and applies uniformly.** The credit value defined for a training applies equally to all attendees. There is no per-member credit variation for the same training. Credit value can be edited before any attendance is confirmed. After the first attendance confirmation, credit value is locked. | Constraint |
| M9-R3 | **Cancellation does not revoke awarded credits.** If a training is cancelled after some members have already been marked as attended and received credits, those credits remain. The officer must use the manual credit correction workflow (M10, M9-R11) to adjust if needed. This prevents automated data loss. | Constraint |
| M9-R4 | **Enrollment mode determines access.** Open: any member can enroll. Approval-required: officer must explicitly approve each enrollment request. Invitation-only: only members who received an invitation can enroll. Mode is set at creation and cannot be changed after the first enrollment. | Configuration |
| M9-R5 | **Network-wide training registration goes through the hosting org.** Even though a training is visible network-wide, all registrations, payments, and attendance records are managed by the hosting org. The hosting org's payment gateway processes fees. The hosting org's officers manage check-in. | Constraint |
| M9-R6 | **Training approval workflow (when enabled).** For training types that require approval (configurable per association), the flow is: Draft -> Pending Approval -> Approved/Rejected -> Published. Only national body officers or designated approvers can approve. Rejected trainings return to draft with feedback. Approved trainings can be published by the hosting officer. | Access / Configuration |
| M9-R7 | **Certificate uniqueness.** Each certificate has a unique certificate number (format: `CERT-[YEAR]-[SEQUENTIAL]`). Certificates are regenerable (same content, same number) but not duplicatable (one certificate per member per training). | Constraint |
| M9-R8 | **Credit award respects org credit tracking toggle.** If the hosting org has credit tracking disabled, attendance can still be recorded but no CreditEntry is created. If the member's primary org has credit tracking enabled, they can still earn credits from trainings hosted by OTHER orgs that have credit tracking enabled. The toggle applies to the hosting org, not the member's org. | Configuration |
| M9-R9 | **Waitlist and paid promotion rules.** Same as Events (M08): first waitlisted member promoted on cancellation. For paid trainings, promoted member has 24 hours to pay. If unpaid, next waitlisted member is offered the spot. | Time-based |
| M9-R10 | **Duplicate check-in prevention.** The same member cannot be checked in or marked complete twice for the same training. A second check-in attempt is rejected and no duplicate CreditEntry is created. If an officer attempts to mark an already-completed member as complete again, the system displays "Already marked complete. Credits previously awarded." | Constraint |
| M9-R11 | **Documented credit deductions.** If credits need correction after a training cancellation or error (e.g., training cancelled after some members already received credits), manual deduction via M10 is required. The deduction must include a documented reason. This module triggers the correction need; M10 handles execution. No automated credit revocation occurs. | Constraint |

---

## UX Specification

### Screen Inventory

| Route | Page Name | Description | Desktop | Mobile |
|-------|-----------|-------------|---------|--------|
| `/org/[id]/officer/training` | Training Dashboard (Officer) | List of all org trainings: upcoming, past, drafts, pending approval. Filters, search, stats. | Sidebar + main content with table/card view | Full-width card list |
| `/org/[id]/officer/training/new` | Create Training | Training creation form: type, details, credit value, approval status, enrollment config, visibility | Multi-section form with preview | Stepped single-column form |
| `/org/[id]/officer/training/[id]` | Training Detail (Officer) | Full training info + enrollment list + attendance/completion + analytics + edit/cancel | Main content + tabs (Details / Enrollments / Attendance / Analytics) | Full-width with tabs |
| `/org/[id]/officer/training/[id]/attendance` | Training Attendance | QR scanner (for in-person) + completion marking (for courses) + attendance list | Split: scanner/marking left, list right | Full-screen scanner or completion list |
| `/org/[id]/training/[id]` | Public/Network Training Page | Training detail visible to network members (or public if configured). Enroll button. | Centered content, max-width 720px | Full-width responsive |
| `/my/training` | My Training (Member) | Member's enrolled/completed trainings, credits earned, certificate access | Card list grouped by status | Card list grouped by status |
| `/my/certificates/[id]` | Certificate View/Download | Certificate preview + download PDF + verification QR | Certificate preview with download button | Certificate preview with download button |

### Screen Details

#### Training Dashboard (`/org/[id]/officer/training`)

**Layout:**
- Header: "Training Programs" title + "New Training" primary button
- Filter bar: Status tabs (Upcoming / Past / Drafts / Pending Approval), Type filter, Date range, Search
- Training list: Card view

**Components:**
- Training card: Cover image thumbnail, title, type badge, date(s), credit value badge (prominent, e.g., "5 CPD"), approval status badge (Approved/Pending/N/A), enrollment count ("35/50"), visibility badge (Network/Internal), status badge
- Quick actions: Edit, Cancel, View Attendance, Duplicate
- Stats summary: Total trainings this quarter, total credits issued, total enrollments, average completion rate

**States:**
- Loading: Skeleton cards
- Empty: "No training programs yet. Create your first training to help members earn CPD credits." + "New Training" CTA
- Populated: Paginated (20 per page)
- Pending approval: Yellow badge, "Awaiting network approval" subtitle

#### Create Training (`/org/[id]/officer/training/new`)

**Layout:**
- Desktop: Multi-section form. Sections: Basic Info, Schedule, Credits & Compliance, Enrollment, Visibility.
- Mobile: Stepped form with progress indicator.

**Components:**
- Type selector: Dropdown with 5 types. Icon + label. Selecting Convention/Conference or Online Course shows multi-session date fields.
- Title: Required, max 200 characters.
- Description: Rich text editor (Tiptap).
- Schedule: Single-session: date + start time + end time. Multi-session: start date, end date, schedule description (text area for "Every Saturday, 9AM-12PM").
- Location: Radio -- "In-person" (venue + address) or "Online" (link).
- Cover image: Upload, max 5 MB, JPEG/PNG/WebP, crop to 16:9.
- Credit value: Number input with 0.5 increments. Label: "CPD Credits Awarded." Helper text: "Credits will be automatically awarded to members upon attendance confirmation."
- Regulatory approval: Dropdown (PRC Approved / Pending Approval / Not Applicable). If approved: reference number text input.
- Enrollment mode: Radio -- Open / Approval-required / Invitation-only. Fee: Free / Paid (amount). Capacity: optional number.
- Visibility: Network-wide (default, with explanation) / Internal only.
- Action buttons: "Save Draft", "Publish" (or "Submit for Approval" if approval required for this type).

**States:**
- Validation errors: Inline per field
- Credit value locked warning: "Credit value cannot be changed after attendance has been confirmed for any member."
- Approval required notice: "This training type requires network approval before publishing."

#### Training Attendance (`/org/[id]/officer/training/[id]/attendance`)

**Layout:**
- For single-session trainings: Same as Event Check-in (M08) -- QR scanner + manual check-in + live list. Each check-in shows "X credits awarded" confirmation.
- For multi-session trainings: Enrolled members list with "Mark Complete" checkbox per member + "Mark Selected as Complete" bulk action.

**Components (single-session):**
- QR scanner: Camera viewfinder. On successful scan: "Checked in: [Name]. [X] credits awarded." green confirmation.
- Manual check-in: Search + "Check in" button. On success: "[Name] checked in. [X] credits awarded."
- Attendance counter: "23 / 50 attended. [X total credits awarded]."

**Components (multi-session):**
- Enrolled members table: Columns -- Name, Org, Enrollment Date, Payment Status, Completion Status (Pending/Complete), Actions
- "Mark Complete" per row or bulk selection
- Confirmation dialog: "Mark N members as completed? This will award [X] credits to each member."
- Post-confirmation: Status changes to "Complete." Credits awarded count shown.

**States:**
- Pre-training: "Attendance tracking opens on [training date]."
- Active: Scanner/marking available
- Post-completion: Read-only attendance list with stats
- Offline (QR): Same offline behavior as Events (M08)

#### Network Training Page (`/org/[id]/training/[id]`)

**Layout:**
- Centered single-column, max-width 720px

**Components:**
- Cover image hero
- Training type badge + Credit value badge (prominent)
- Title (h1)
- Regulatory approval status: Green "PRC Approved (Ref: XXX)" or yellow "Pending Approval" or grey "N/A"
- Date/time, location
- Description (rich text)
- Hosting org: Name + logo
- Enrollment section: "Enroll" button. Capacity: "X of Y spots." Fee (if paid). Enrollment mode note (if approval-required: "Enrollment requires approval").
- Certificate note: "Certificate of completion with [X] CPD credits will be available after the training."

**States:**
- Open enrollment: Green "Enroll" button
- Full with waitlist: Orange "Join Waitlist"
- Approval required: "Request Enrollment" button
- Invitation only: "By Invitation Only" label, no button (unless invited)
- Cancelled: "This training has been cancelled" banner
- Past: "This training has ended" banner

#### My Training (`/my/training`)

**Layout:**
- Grouped sections: Upcoming Enrollments, Completed, All History
- Card list within each

**Components:**
- Training card: Title, date, type, hosting org, credit value badge, enrollment status (Enrolled/Waitlisted/Pending Approval/Completed), certificate status (Available/Not Yet/N/A)
- For upcoming: "Show QR" button on training day
- For completed with certificate: "Download Certificate" button
- Credit summary: "You've earned [X] credits from [N] trainings" at top

#### Certificate View (`/my/certificates/[id]`)

**Layout:**
- Certificate preview (rendered as it will appear in PDF)
- Action bar: "Download PDF" primary button, "Share" button (copy link to verification page)

**Components:**
- Certificate content: Member name, training title, training type, date(s), location, credits earned, hosting org name + logo, certificate number, platform branding ("Verified by Memberry"), verification QR code
- Verification QR: Encodes URL to verification page. When scanned: shows certificate validity, member name, training, date, credits.

### Empty States

| Screen | Empty State Message | CTA |
|--------|-------------------|-----|
| Training Dashboard (Officer) | "No training programs yet. Create your first training to help members earn CPD credits and advance their professional development." | "Create Training" button |
| My Training (Member) | "You haven't enrolled in any trainings. Browse available CPD opportunities to start earning credits." | "Browse Trainings" link |
| Attendance List | "No attendance recorded yet. Use the QR scanner or manual check-in to record attendance." | Scanner active / "Start Check-in" |
| My Certificates | "No certificates yet. Complete a training to receive your certificate of attendance." | "Browse Trainings" link |
| Training Analytics | "Analytics will be available once members start enrolling." | None |

### Error States

| Screen | Error Condition | Message | Recovery |
|--------|----------------|---------|----------|
| Create Training | Cover image upload fails | "Image upload failed. Max 5 MB, JPEG/PNG/WebP only." | Retry upload |
| Create Training | Paid training, no gateway | "Online payment is not configured. Set up your payment gateway in Org Settings." | Link to Org Settings |
| Enrollment | Payment fails | "Payment failed. Please try again or use a different payment method." | Retry payment |
| Enrollment | Capacity reached | "This training is full. Would you like to join the waitlist?" | "Join Waitlist" button |
| QR Check-in | Camera denied | "Camera access required for QR scanning. Enable in device settings." | Manual check-in fallback |
| QR Check-in | Invalid QR | "Invalid code. Ask the member to refresh their QR code." | Member refreshes |
| QR Check-in | Already checked in | "Already checked in at [time]. [X] credits were previously awarded." | No action needed |
| Completion Marking | Member not enrolled | "This member is not enrolled in this training." | Verify enrollment first |
| Certificate | Training date not passed | "Certificate available after [date]." | Wait |
| Certificate | Attendance not confirmed | "Certificate not available. Attendance has not been confirmed. Contact your training organizer." | Contact organizer |
| Certificate | PDF generation fails | "Certificate generation failed. Please try again." | Retry |
| Approval | No approvers configured | "No reviewers configured for this training type. Contact your national body administrator." | Contact admin |

---

## Acceptance Criteria Patterns

- Credit auto-award fires only after attendance is confirmed (QR check-in or completion marking), not on enrollment alone.
- Training cancellation after credits are awarded requires manual credit correction -- no auto-revoke of existing credits.
- Network-wide trainings are visible to members of other orgs, but enrollment and payment go through the hosting org.
- Training types are platform-defined (5 types) and cannot be customized by organizations.
- Credit value is locked after the first attendance confirmation for any member.
- Certificate generation requires both conditions: training date has passed AND member attendance is confirmed.
- Certificate PDF renders correctly on all devices, is print-friendly (A4/Letter), and includes HMAC-signed verification QR.
- QR verification returns valid/invalid status. Tampered certificates are detected.
- Duplicate check-in for the same member at the same training is prevented. No duplicate CreditEntry records.
- Enrollment mode (open/approval/invitation) is enforced. Uninvited members cannot enroll in invitation-only trainings.
- Waitlist follows FIFO order. Paid promotions expire after 24 hours.
- Training approval workflow (when configured) prevents unapproved trainings from being visible to members.
- Credit tracking toggle (M9-R8): if hosting org has credit tracking disabled, no credits are awarded even if attendance is confirmed.
- Cross-org credit aggregation (BR-14): credits from a society training appear in the member's aggregate total across all orgs.

---

## Data Entities

| Entity | Description | Key Fields | Relationships |
|--------|-------------|------------|---------------|
| **Training** | A credit-bearing professional development activity. | `id`, `org_id`, `created_by`, `title`, `type` (enum: 5 platform types), `description_html`, `description_text`, `start_date`, `end_date`, `schedule_description` (for multi-session), `location_type` (in_person/online), `venue_name`, `venue_address`, `online_link`, `cover_image_url`, `credit_value` (decimal), `credit_value_locked` (boolean), `approval_status` (prc_approved/pending_approval/not_applicable), `approval_reference`, `enrollment_mode` (open/approval_required/invitation_only), `fee_type` (free/paid), `fee_amount`, `fee_currency`, `capacity_limit`, `visibility` (internal/network), `requires_network_approval` (boolean), `network_approval_status` (draft/pending/approved/rejected), `network_approval_by`, `network_approval_at`, `network_approval_feedback`, `status` (draft/pending_approval/published/cancelled/completed), `published_at`, `cancelled_at`, `completed_at`, `created_at`, `updated_at` | Belongs to Org. Belongs to Officer (creator). Has many TrainingEnrollments. Has many TrainingAttendances. Has many CreditEntries (via attendance). Has many Certificates. |
| **TrainingEnrollment** | A member's enrollment in a training program. | `id`, `training_id`, `member_id`, `status` (enrolled/pending_approval/pending_payment/waitlisted/completed/cancelled), `enrollment_mode_at_time` (snapshot of mode at enrollment), `waitlist_position`, `payment_id` (nullable), `approved_by` (nullable), `approved_at`, `rejected_reason`, `enrolled_at`, `completed_at`, `cancelled_at`, `payment_deadline` | Belongs to Training. Belongs to Member. Optionally belongs to Payment. |
| **TrainingAttendance** | A record of attendance confirmation for a member at a training. Triggers credit award. | `id`, `training_id`, `member_id`, `confirmation_method` (qr_checkin/manual_checkin/completion_marking), `confirmed_by` (officer ID), `confirmed_at`, `credits_awarded` (decimal, snapshot of training credit value at time of confirmation), `credit_entry_id` (link to CreditEntry), `synced_at` (for offline), `offline` (boolean) | Belongs to Training. Belongs to Member. Has one CreditEntry. |
| **TrainingInvitation** | An invitation for a member to enroll in an invitation-only training. | `id`, `training_id`, `member_id`, `invited_by`, `invited_at`, `accepted_at`, `declined_at`, `status` (pending/accepted/declined/expired), `expires_at` | Belongs to Training. Belongs to Member. |
| **Certificate** | A PDF certificate of training completion. One per member per training. | `id`, `training_id`, `member_id`, `certificate_number` (unique, format: CERT-YYYY-NNNNNN), `credits_earned` (decimal), `generated_at`, `hmac_signature`, `pdf_url` | Belongs to Training. Belongs to Member. |
| **TrainingApprovalConfig** | Per-association configuration of which training types require network-level approval. | `id`, `association_id`, `training_type` (enum), `requires_approval` (boolean), `approver_role` (national_admin/designated), `updated_at` | Belongs to Association. |

---

*End of Module 9: Training*
