# Training Detail + Enrollment (Member View)

- **Route:** `/org/[id]/training/[id]`
- **Module:** M09 Training
- **Access:** Member (must be active member of this org or of an org that can see the network-wide training)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Give a member everything they need to evaluate a training and enroll — with CPD credit amount and regulatory approval status surfaced prominently since these are the primary decision factors.

## Layout

### Desktop
Single main column (max-width 720px, centered). Cover image hero. Below it: a structured info block with the credit value badge and regulatory approval status as the most visually dominant elements after the title. Description (rich text) follows. Enrollment section at the bottom. Hosting org card at the very bottom.

### Mobile
Full-width cover image hero. All content single-column. The enrollment section is a floating bottom action bar (credit value + button) that persists while scrolling, so the member always sees how many credits this training awards and can enroll without scrolling back to the top.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Cover Image | Hero image | 16:9 crop, or training type icon on a colored background if no image. |
| Training Type Badge | Chip | One of the 5 types: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training. |
| Title | Heading (h1) | Training title. |
| CPD Credit Badge | Prominent badge | **"X CPD Credits"** — displayed immediately below the title in a large, colored badge (e.g., blue pill with white text). This is the most important decision factor for members. "0 credits" shown in gray with a note: "This training does not contribute to your CPD requirements." |
| Regulatory Approval Status | Status row | Green "PRC Approved" with optional reference number (e.g., "Ref: PRC-2026-0412"), or yellow "Pending Approval", or gray "Not Applicable". Full line: e.g., "PRC Approved — Ref: PRC-2026-0412". |
| Schedule | Metadata row | Single-session: "April 28, 2026 · 8:00 AM – 5:00 PM". Multi-session (course/convention): "April 28 – May 5, 2026" with schedule description below (e.g., "Every Saturday, 9 AM – 12 PM"). |
| Location | Metadata row | Venue name + address with map deep-link, or "Online" with meeting link (shown only to enrolled members after enrollment is confirmed). |
| Enrollment Mode Notice | Inline notice | Shown only for non-Open modes. Approval-required: "Enrollment requires officer approval. Submit a request and you'll be notified." Invitation-only: "This training is by invitation only." |
| Enrollment Section | Action block | Capacity display ("35 of 50 spots"), fee (if paid), primary action button, certificate availability note. |
| Certificate Note | Info line | "A certificate of attendance worth X CPD credits will be available for download after the training." |
| Primary Action Button | Button (prominent) | Context-sensitive (see States). |
| My Enrollment Info | Info block | Visible once enrolled. Enrollment date, payment status, enrollment mode status (pending approval if applicable), QR button (on training day). |
| QR Code Display | Full-screen overlay | Same rotating QR mechanism as events. Shown on training day for confirmed enrolled members. "X CPD credits will be awarded upon check-in." |
| Hosting Org Card | Card | Org logo, org name, link to org public page. Always shown — important for network-wide trainings. |
| Description | Rich text | Full training description. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton: hero, credit badge placeholder, description block. |
| Open enrollment — not enrolled | Open mode, spots available, not enrolled | Button: green "Enroll". Capacity count visible. |
| Open — free, enroll | Member taps Enroll on free open training | Inline confirmation: "You're enrolled! X CPD credits will be awarded upon attendance confirmation." Calendar link offered. Button becomes "Enrolled" (disabled). |
| Open — paid, enroll | Member taps Enroll on paid training | Redirect to payment checkout. On webhook confirmation: "Enrollment confirmed. Receipt sent." |
| Approval required — not submitted | Approval-required mode, member not yet requested | Button: "Request Enrollment". Tapping shows confirmation: "Send an enrollment request to the training organizer?" On confirm: "Request submitted. You'll be notified when reviewed." Button becomes "Request Pending." |
| Approval required — pending | Officer has not yet reviewed the request | Info block shows "Enrollment pending officer approval." Amber status chip. |
| Invitation only — no invite | Member was not invited | No enroll button. Message: "This training is by invitation only." |
| Invitation only — invited | Member has a pending invitation | Button: "Accept Invitation." On tap: enrolled immediately (or payment flow if paid). |
| Pending payment | Paid enrollment awaiting payment | Amber button: "Complete Payment." Notice: "Your spot is reserved for 24 hours. Complete payment to confirm." |
| Enrolled — before training day | Enrollment confirmed, training in the future | My Enrollment block with enrollment date and payment receipt. No QR yet. Calendar link. "Cancel enrollment" link (cancellation policy note if paid). |
| Enrolled — training day | Today is the training date | "Show QR Code" button appears prominently. On tap: full-screen rotating QR overlay with "X CPD credits will be awarded upon check-in." |
| Attended — credits awarded | Attendance confirmed by officer | "You attended this training. X CPD credits have been added to your record." Green confirmation. "Download Certificate" button appears if training date has passed (may take a moment for certificate generation). |
| Certificate ready | Training date passed and attendance confirmed | "Download Certificate" button active. Tapping navigates to `/my/certificates/[id]`. |
| Certificate not yet ready | Training date not yet passed or attendance not confirmed | "Certificate available after [date]" or "Certificate available once your attendance is confirmed." |
| Waitlisted | Capacity full, member joined waitlist | Waitlist position shown. Button: "Leave Waitlist." |
| Full — no waitlist | Capacity full, no waitlist configured | Button grayed out: "Training Full." |
| Cancelled | Officer cancelled the training | Red "Cancelled" banner. All enrollment actions disabled. "This training has been cancelled. No credits will be awarded." |
| Past | Training date has passed | "This training has ended." No new enrollments. Enrolled members see their attendance and credit status. |
| Lapsed member | Member's dues lapsed | All enrollment actions disabled. Banner: "Renew your dues to enroll in training." |
| Error | API failure | "Unable to load training details. Try again." with retry. |

## Interactions

- **Free open enrollment:** Single tap → inline confirmation. No navigation away. No modal interruption.
- **Paid enrollment:** Tap → checkout page. On success: redirect back with enrolled state. On failure: "Payment failed. Try again or contact the organizer."
- **Approval-required enrollment:** Tap "Request Enrollment" → confirmation dialog → request sent. Member stays on this page; the button state updates to reflect pending status.
- **Cancel enrollment:** Link opens a confirmation dialog. Paid cancellations surface the org's refund policy (text string set by the org). On confirm: enrollment cancelled, spot released, waitlist auto-promoted if applicable.
- **QR code display:** Same behavior as events (rotating every 60 seconds, screen wake lock, close button). On check-in: officer's scanner confirms attendance. Credits are awarded immediately. Member's screen does not auto-update until they close and reopen the training detail.
- **Certificate download:** Tapping "Download Certificate" navigates to the certificate detail/download screen at `/my/certificates/[id]`. The PDF includes the CPD credit amount, hosting org logo, and an HMAC-signed verification QR code.
- **Credit badge always visible:** On mobile, the floating bottom bar shows the credit count next to the action button so the member always sees "5 CPD — Enroll" as a unit.
