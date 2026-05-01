# Memberry UI States Specification

**Platform**: Healthcare Association Management Platform
**Version**: 3.0
**Audience**: Frontend engineers, QA team
**Last Updated**: 2026-04-21

---

## Overview

This document defines the complete state specification for all UI states across Memberry. Engineers must implement these consistently across all modules. States cover loading, empty, error, success, confirmation, and mobile-specific behaviors.

### User Context
- **Platform Admins**: Desktop-only. Full-page states acceptable.
- **Officers** (President, Treasurer, Secretary): Desktop + mobile. All states must render correctly on both.
- **Members**: Mobile-first. Loading states, empty states, and offline behavior are highest priority.

### Network Baseline
The platform targets 3G mobile users in the Philippines (est. ~1–5 Mbps). Design and implement all loading states assuming a 1–3 second data fetch baseline. **Never use a spinner as the primary loading indicator for data fetches. Use skeleton screens.**

---

## 1. Loading States

### 1.1 Skeleton Loading (3G-Aware)

**Rule**: Any data fetch that takes > 300ms must show a skeleton screen. Spinners are only permitted for transient micro-actions (e.g., button press feedback lasting < 300ms).

Skeleton elements use a shimmer animation: background transitions left-to-right from `#E5E7EB` to `#F3F4F6` and back, on a 1.5-second loop. No pulse. No opacity flash. Shimmer only.

All skeleton screens must match the final layout dimensions as closely as possible so the page does not reflow when data loads in.

---

#### List Skeleton

**Used for**: Member roster, event list, payment history, training session list, job board list

**Structure**:
```
[ Avatar circle 40px ]  [ Wide rect ~60% width, 16px tall ]
                         [ Narrow rect ~35% width, 12px tall, mt-4 ]
─────────────────────────────────────────────────────────────
[ Avatar circle 40px ]  [ Wide rect ~55% width, 16px tall ]
                         [ Narrow rect ~40% width, 12px tall, mt-4 ]
─────────────────────────────────────────────────────────────
[ Avatar circle 40px ]  [ Wide rect ~65% width, 16px tall ]
                         [ Narrow rect ~30% width, 12px tall, mt-4 ]
─────────────────────────────────────────────────────────────
(repeat 5–7 rows total)
```

- Row height: 64px with 1px separator between rows
- Avatar circle: 40×40px, border-radius 50%
- Text rects: border-radius 4px
- Vary widths slightly per row so it doesn't look mechanical
- On mobile: remove avatar, show two stacked rects per row

---

#### Card Skeleton

**Used for**: Dashboard summary cards, module landing pages (e.g., Payments overview card, Events overview card)

**Structure**:
```
┌────────────────────────────────┐
│  [ Rect 50% width, 12px ]      │  ← card label / title
│                                │
│  [ Rect 30% width, 32px ]      │  ← large metric / number
│                                │
│  [ Rect 45% width, 12px ]      │  ← subtitle / secondary stat
│                                │
│  [ Rect 80px × 32px ]          │  ← CTA button shape
└────────────────────────────────┘
```

- Card: standard border-radius (8px), no shadow during skeleton
- Min card height: 140px
- On dashboard grids, all skeleton cards render simultaneously

---

#### Profile Skeleton

**Used for**: Member profile page, officer profile page

**Structure**:
```
         [ Circle 80px ]               ← avatar
    [ Rect 40% width, 20px ]           ← full name
    [ Rect 25% width, 14px ]           ← role / license number
    [ Rect 60% width, 12px ]           ← org affiliation

─────────────────────────────────────────

[ Rect 20% width, 12px ]               ← section label
[ Rect 90% width, 12px ]               ← field value
[ Rect 70% width, 12px ]               ← field value
[ Rect 80% width, 12px ]               ← field value

─────────────────────────────────────────

[ Rect 20% width, 12px ]               ← section label
[ Rect 90% width, 12px ]
[ Rect 55% width, 12px ]
```

- Avatar circle centered on mobile, left-aligned on desktop
- Show 2–3 section blocks to match typical profile layout depth

---

#### Table Skeleton

**Used for**: Financial reports, attendance records, audit logs, export previews

**Structure**:
```
┌──────────┬──────────────┬───────────┬────────────┐
│ [██ 70%] │ [██ 60%]     │ [██ 50%]  │ [██ 40%]   │  ← header row (12px rects)
├──────────┼──────────────┼───────────┼────────────┤
│ [██ 80%] │ [██ 55%]     │ [██ 65%]  │ [██ 45%]   │
│ [██ 75%] │ [██ 70%]     │ [██ 50%]  │ [██ 60%]   │
│ [██ 65%] │ [██ 60%]     │ [██ 75%]  │ [██ 35%]   │
│ [██ 80%] │ [██ 45%]     │ [██ 55%]  │ [██ 50%]   │
│ [██ 70%] │ [██ 65%]     │ [██ 60%]  │ [██ 40%]   │
└──────────┴──────────────┴───────────┴────────────┘
```

- Header row: slightly darker rect color (#D1D5DB) to distinguish from data rows
- 5–6 data rows
- Row height: 48px, with 1px row dividers
- On mobile: collapse to 2 visible columns + horizontal scroll indicator

---

#### Single Record Skeleton

**Used for**: Payment detail view, event detail view, training session detail, member dues record

**Structure**:
```
[ Wide rect 100% width, 24px ]         ← record title / heading

[ Rect 45% width, 14px ]               ← field label + value pair
[ Rect 60% width, 14px ]               ← field label + value pair
[ Rect 50% width, 14px ]               ← field label + value pair

[ Wide rect 100% width, 1px ]          ← section divider

[ Rect 30% width, 12px ]               ← section sub-label
[ Rect 85% width, 12px ]
[ Rect 70% width, 12px ]
[ Rect 75% width, 12px ]
```

- Top block represents the primary record identifier (e.g., payment amount or event title)
- Two stacked narrow blocks represent the detail fields
- No action buttons in skeleton — they appear only after data loads

---

### 1.2 Progress Indicators

These are shown when the system is processing a user-initiated action. They are not skeleton screens — the data is already known; the system is working.

---

#### Payment Processing

**Trigger**: User submits a payment and awaits gateway response
**Duration**: Up to 10 seconds (gateway timeout threshold)

**Behavior**:
- Disable the submit button immediately on tap/click
- Replace button label with: "Processing payment..."
- Show shimmer animation on the button background (left-to-right sweep, 1.2s loop)
- Show an animated bank/card icon (SVG, simple stroke style) to the left of the copy — icon does a slow pulse at 0.8s intervals
- Do NOT show a full-page overlay unless the gateway response exceeds 5 seconds, at which point show a non-dismissible modal: "Still processing... please don't close this page."
- On completion: transition directly to success or error state

**Copy**:
```
[card icon]  Processing payment...
```

---

#### PDF Generation

**Trigger**: User requests a membership ID card or a CPD certificate
**Duration**: Up to 3 seconds

**Behavior**:
- Show an inline progress bar below the trigger button (not a spinner)
- Progress bar: indeterminate fill animation (bar slides across from left to right continuously)
- Bar width: full width of the parent card or modal
- Bar color: brand primary
- Below the bar, show copy:

For ID card:
```
Generating your ID card...
```

For CPD certificate:
```
Generating your certificate...
```

- Do not disable navigation during generation — this happens in the background
- On completion: see Success State — Training Certificate Generated

---

#### Data Export

**Trigger**: User initiates CSV or PDF export from a report or roster screen
**Duration**: Up to 5 seconds depending on dataset size

**Behavior**:
- Show a persistent toast at the bottom of the screen (not a modal)
- Toast contains an indeterminate progress bar (thin, 3px, inside the toast)
- Toast is non-dismissible until export completes or fails

**Copy**:
```
Preparing export...
```

On completion, toast transitions to success style:
```
Export ready. Download
```
"Download" is an underlined link that triggers the file download.

---

#### Bulk Actions

**Trigger**: Officer sends bulk communication (SMS/email) to a subset of members, or performs a bulk status update
**Duration**: Variable — depends on count

**Behavior**:
- Show a non-dismissible modal overlay
- Modal contains: action description, animated progress bar (determinate), and count copy
- Do not allow the user to navigate away while in progress

**Copy** (updates in real time):
```
Processing 14 of 87 members...
[████████░░░░░░░░░░░░░░░░░░░]  16%
```

On completion:
```
Done. 87 members notified.
[Close]
```

If partial failures occur (e.g., 3 of 87 failed):
```
Completed with issues. 84 members notified. 3 failed.
[View failed]  [Close]
```

---

## 2. Empty States

All empty states follow this structure:
1. **Illustration**: Simple, friendly SVG. Stroke-based, not filled. No detailed imagery. Max 160×160px on desktop, 120×120px on mobile.
2. **Headline**: Warm, plain language. No jargon.
3. **Description**: One sentence. Actionable context.
4. **CTA Button(s)**: Primary action always present unless specified. Secondary action is a text link or ghost button below the primary.

Empty states are centered vertically and horizontally in their container. They do not use cards or bordered containers — they sit directly in the page body.

---

### 2.1 Roster Empty State

**When**: No members have been added to the organization yet

**Illustration**: Group of three people outlines — simple stroke figures, no faces

**Headline**: No members yet

**Description**: Import your existing roster or invite your first members.

**CTAs**:
- Primary button: "Import Roster"
- Secondary (text link below): "Invite Members"

---

### 2.2 Payments Empty State

**When**: No payment records exist for the organization or for the viewed filter

**Illustration**: A simple receipt or document outline with a small coin or peso symbol

**Headline**: No payments recorded

**Description**: Record your first dues payment or set up online collection.

**CTAs**:
- Primary button: "Record Payment"

---

### 2.3 Events Empty State

**When**: No events have been created in the organization

**Illustration**: A simple calendar outline with a small star or spark on one date

**Headline**: No events scheduled

**Description**: Create your first event to start tracking attendance.

**CTAs**:
- Primary button: "Create Event"

---

### 2.4 Training Empty State

**When**: No training sessions have been created

**Illustration**: A simple open book or graduation cap outline

**Headline**: No training sessions yet

**Description**: Create a training to start tracking CPD credits.

**CTAs**:
- Primary button: "Create Training"

---

### 2.5 Credit History Empty State

**When**: A member's CPD credit log is empty — no entries from training attendance or manual logs

**Illustration**: A simple star or badge outline with a plus sign

**Headline**: No credits yet

**Description**: Credits are added automatically when you attend a training, or you can log your own.

**CTAs**:
- Primary button: "Log Manual Credit"

---

### 2.6 Job Board Empty State

**When**: No job postings exist in the organization's job board

**Illustration**: A simple briefcase outline

**Headline**: No openings posted

**Description**: Be the first to post an opportunity for your fellow members.

**CTAs**:
- Primary button: "Post a Job"

---

### 2.7 Feed Empty State

**When**: A member's professional feed has no posts (new account or org has posted nothing)

**Illustration**: A simple speech bubble or network of dots outline

**Headline**: Nothing here yet

**Description**: Your network is just getting started. Posts from your organizations will appear here.

**CTAs**: None. Members do not create posts from the empty state. The empty state is informational only.

---

### 2.8 Notifications Empty State

**When**: User has no unread or recent notifications

**Illustration**: A simple bell outline with a small checkmark

**Headline**: You're all caught up

**Description**: New notifications will appear here.

**CTAs**: None.

---

### 2.9 Search No Results

**When**: A search query returns zero matching records

**Illustration**: A magnifying glass with a small question mark or empty circle inside it

**Headline**: No results for "[search term]"

Note: Interpolate the actual search term in quotes. If the search term is longer than 30 characters, truncate with an ellipsis: No results for "Dr. Maria Santos Reye..."

**Description**: Try a different name, email, or license number.

**CTAs**: "Clear search" — text link (not a button), triggers clearing the search input and restoring the full list

---

## 3. Error States

### 3.1 Network Error (Full Page)

**When**: A page-level API call fails on first load — no data can be displayed at all

**Behavior**:
- Replace the page body content with the error state
- Preserve the navigation header so the user is not fully stranded
- Do not log the user out

**Illustration**: A simple broken link or disconnected plug outline

**Headline**: Something went wrong

**Description**: We couldn't load this page. Check your connection and try again.

**CTAs**:
- Primary button: "Try again" — triggers a page-level data refetch (not a full browser reload)

---

### 3.2 Inline API Error (Widget-Level)

**When**: A specific widget or card on a dashboard fails to load — other widgets loaded successfully

**Behavior**:
- Show an error micro-card in place of the failed widget
- Match the exact dimensions of the widget it replaces (no layout shift)
- Do not show an illustration — space is too small

**Copy inside the micro-card**:
```
Couldn't load [widget name]. Retry
```

"Retry" is a clickable link (not a button) that re-triggers the fetch for that widget only.

Example: "Couldn't load Dues Summary. Retry"

The micro-card background: light red tint (`#FEF2F2`), border: `#FECACA`, text: `#991B1B`.

---

### 3.3 Form Validation Errors

**Behavior**:
- Validate on submit, not on blur (except for email format, which can validate on blur)
- Each invalid field gets: red border (`#EF4444`), and an error message in red text directly below the field (`text-sm`, `#DC2626`)
- Error messages are specific — never use "This field is required" alone. Write what is expected: "Enter a valid PRC license number (7 digits)" or "Email address is required."
- The form does not reset or scroll to top on error. The user stays where they are.
- Screen readers: associate error messages with their input using `aria-describedby`

**Summary banner** (shown only if more than 3 fields have errors):
- Appears at the top of the form, above the first field
- Background: `#FEF2F2`, border-left: 4px solid `#EF4444`
- Copy: "Please fix [N] errors before continuing."
- Clicking a field name in the banner (if listed) scrolls to and focuses that field

---

### 3.4 Payment Error States

Payment errors are critical — users must clearly understand whether money was charged.

#### Gateway Timeout

**When**: The payment gateway does not respond within 10 seconds

**Display**: Full-width error banner above the payment form (not a toast — it must persist)

**Copy**:
```
The payment gateway is taking too long. Your payment was NOT charged. Please try again.
```

"NOT charged" is rendered in bold. The word "NOT" should never be ambiguous.

**CTA**: "Try again" button resets the payment form to its pre-submission state.

---

#### Card Declined

**When**: The payment gateway returns a decline response

**Display**: Inline error banner within the payment modal or form

**Copy**:
```
Your payment was declined. Please check your details or use a different payment method.
```

**CTA**: No explicit CTA button — user can edit payment details directly in the form and resubmit.

---

#### Duplicate Payment Detected

**When**: The system detects a payment record already exists for this member and period

**Display**: Inline warning banner (yellow, not red — this is a warning, not a failure)

**Copy**:
```
A payment was already recorded for this member. Review before continuing.
```

"Review" is a link that opens the existing payment record in a side panel or new tab.

**Behavior**: The submit button remains enabled. The officer can proceed if they confirm the duplicate is intentional (e.g., a corrective entry). The warning does not block submission.

---

### 3.5 Permission Error (403)

**When**: A user navigates to a route or resource they do not have access to

**Behavior**:
- Full page state (below navigation header)
- Do not show the URL or any technical details

**Illustration**: A simple lock outline

**Headline**: You don't have access to this page

**Description**: Contact your officer if you think this is a mistake.

**CTAs**:
- Primary button: "Go to dashboard" — navigates to the user's role-appropriate dashboard

---

### 3.6 Not Found (404)

**When**: A URL resolves to a resource that does not exist (deleted record, bad link)

**Illustration**: A simple compass or map with an X

**Headline**: Page not found

**Description**: This page may have been moved or deleted.

**CTAs**:
- Primary button: "Go to dashboard"

---

### 3.7 Session Expired

**When**: The user's session has been inactive for 8 hours and the token has expired

**Display**: Modal overlay on top of the current page. Do NOT redirect to the login page. This preserves the user's current location so they can resume after re-authenticating.

**Behavior**:
- Modal is non-dismissible (no X button, no backdrop click to close)
- Background page content is visible but blurred and non-interactive
- After successful re-login, the modal closes and the user is back exactly where they were

**Headline**: Your session has expired

**Description**: Please log in again to continue.

**CTAs**:
- Primary button: "Log in" — opens the login flow inline (within the modal) or redirects to login with a return URL parameter

---

## 4. Success States

Success states confirm that a user's action completed. They must be specific enough that the user doesn't need to verify the result manually.

### 4.1 Payment Recorded

**Trigger**: Officer successfully records a dues payment (manual or online)

**Display**: Replace the form/modal content with a success confirmation. Do not dismiss automatically.

**Animation**: Green checkmark SVG draws itself in 0.4 seconds (stroke animation, not a fade)

**Headline**: Payment recorded!

**Detail block below headline**:
```
₱ [amount]  ·  [Member Name]  ·  Due: [due date]
```

Example: ₱1,500.00  ·  Dr. Maria Santos  ·  Due: Dec 31, 2026

**Next action links** (below the detail block):
- "Record another payment" — resets the form for a new entry
- "View member profile" — navigates to that member's profile

---

### 4.2 Invitation Sent

**Trigger**: Officer sends invitations to one or more members

**Display**: Toast notification at top of screen (not a modal)

**Copy**:
```
Invitation sent to [N] member[s]
```

Example: "Invitation sent to 3 members" or "Invitation sent to 1 member"

**Behavior**:
- Auto-dismiss after 5 seconds
- User can manually dismiss by clicking the X on the toast
- If the invitation list was very long (> 20 members), add: "This may take a few minutes to deliver."

---

### 4.3 Event Created

**Trigger**: Officer creates a new event

**Display**: Full-page success state or modal success state (depending on whether creation was in a modal or a full page form)

**Headline**: Event created!

**Next action links**:
- "View event" — navigates to the new event's detail page
- "Create another" — resets the event creation form

---

### 4.4 Training Certificate Generated

**Trigger**: Member or officer requests a CPD certificate for a completed training

**Display**: Inline success card (replaces the generation progress state)

**Headline**: Certificate ready!

**Behavior**:
- The file download begins automatically 2 seconds after this state is shown
- A "Download certificate" button is also shown immediately so the user can trigger it manually without waiting
- If automatic download is blocked by the browser, show: "Your download should start automatically. If it doesn't, click Download."
- The button label changes to "Downloaded" (with a checkmark) after the file is successfully downloaded

---

### 4.5 Profile Saved

**Trigger**: Any user saves changes to their profile

**Display**: Toast at top of the form (not a banner, not a modal)

**Copy**:
```
Profile updated
```

**Behavior**:
- Auto-dismiss after 3 seconds
- No CTA needed — user is already on the profile page
- If the save failed silently (race condition, etc.), the toast does NOT appear — instead the form shows an inline API error per section 3.2

---

## 5. Confirmation Dialogs

### 5.1 Destructive Action Confirmation

**Used before**: Suspend member, remove member from organization, cancel/void a dues record, delete an event, delete a training session

**Behavior**:
- Always a modal dialog, never an inline inline confirmation
- Modal is non-dismissible by clicking the backdrop — user must explicitly click Cancel or the action button
- No auto-dismiss under any circumstances
- Keyboard: Escape key triggers Cancel. Enter key does NOT trigger the destructive action (prevent accidental confirm)

**Dialog structure**:

```
Title:  [Action] [Full Name or Record]?

Body:   [Plain-language explanation of consequence]

        [Action button — danger red]   [Cancel button — secondary]
```

**Title examples**:
- "Suspend Dr. Maria Santos?"
- "Remove Dr. Juan dela Cruz from PNA Manila?"
- "Void this payment record?"
- "Delete Annual Convention 2026?"

**Body examples** (one sentence each):
- Suspend: "This member will lose access to all organization features until restored."
- Remove: "This member will be removed from the organization and lose access to member resources."
- Void payment: "This payment record will be permanently voided. The member's balance will be updated."
- Delete event: "This event and all its attendance records will be permanently deleted."

**Button labels**:
- Destructive action button: matches the action verb — "Suspend", "Remove", "Void", "Delete" — never "OK" or "Confirm"
- Destructive button color: `#DC2626` (red-600) background, white text
- Cancel button: secondary/ghost style, no color

---

### 5.2 Bulk Action Confirmation

**Used before**: Bulk SMS, bulk email, bulk status update

**Dialog structure**:

```
Title:  [Action] [N] members?

Body:   You're about to [action] [N] members. This cannot be undone.

        [large, prominent number: N]

        [Action button]   [Cancel button]
```

**Title examples**:
- "Send SMS to 87 members?"
- "Archive 12 inactive members?"

**Body example**:
- "You're about to send an SMS to 87 members. This cannot be undone."

**N** is rendered large (24px, semibold) and visually prominent — officers must clearly register the scale of what they are about to do.

**Behavior**:
- Non-dismissible via backdrop
- Cancel closes the dialog without action
- Confirming opens the Bulk Action progress indicator (see section 1.2)

---

## 6. Mobile-Specific States

### 6.1 Pull-to-Refresh

**Supported on**: All list screens (roster, events, payments, training sessions, notifications, feed, job board)

**Behavior**:
- Native pull-to-refresh gesture (overscroll down triggers refresh)
- While fetching: show a standard refresh indicator (spinning arc, brand primary color) at the top of the list
- On complete: display a brief auto-dismissing toast at the top of the screen

**Toast copy**: "Updated"

**Toast behavior**: Appears for 2 seconds, then fades out. Not dismissible manually (too brief).

**Do not** show a full skeleton screen on pull-to-refresh if content is already displayed — keep existing content visible during the refresh so the page doesn't go blank.

---

### 6.2 Offline State

**When**: The device has no internet connection (detected via the browser's `navigator.onLine` event and network request failures)

**Banner behavior**:
- A persistent banner appears at the very top of the screen, below the navigation bar
- Banner is NOT dismissible — it remains until connectivity is restored
- When connectivity is restored, the banner auto-dismisses and a brief toast reads: "You're back online."
- The banner does not stack or repeat — only one instance shown at a time

**Banner copy**:
```
You're offline. Some features may not be available.
```

**Banner styling**: Amber/yellow background (`#FEF3C7`), dark amber text (`#92400E`), full-width

**Behavior for cached content**:
- Data that was already loaded remains visible and scrollable
- No skeleton screens are shown for cached content

**Behavior for actions requiring internet**:
- Buttons and interactive elements that require a network call are visually disabled (opacity 0.5, not-allowed cursor)
- On hover or tap, show a tooltip: "You're offline"
- Do not show the tooltip on passive content (text, images) — only on interactive elements

**Behavior for navigation**:
- Users can navigate to already-cached pages
- Navigation to an uncached page shows the Network Error state (section 3.1) with copy adjusted: "You're offline. Connect to the internet to load this page."

---

## Appendix: State Timing Reference

| State | Trigger Delay | Auto-Dismiss |
|---|---|---|
| Skeleton screen | > 300ms data fetch | On data load |
| Payment processing shimmer | Immediate on submit | On gateway response |
| PDF generation progress bar | Immediate on request | On file ready |
| Data export toast | Immediate on request | On file ready |
| Success: Payment recorded | Immediate | No (manual dismiss) |
| Success: Invitation sent | Immediate | 5 seconds |
| Success: Profile saved | Immediate | 3 seconds |
| Success: Updated (pull-to-refresh) | On refresh complete | 2 seconds |
| Offline banner | On disconnect detected | On reconnect |
| Session expired modal | On token expiry | No (requires login) |
| Bulk action progress modal | On bulk action start | On completion |

---

## Appendix: Copy Tone Guidelines

- **Headlines**: Short, plain, no punctuation except for questions in confirmation dialogs.
- **Descriptions**: One sentence. Active voice. Tell the user what they can do, not just what happened.
- **Errors**: Never blame the user. Avoid technical language. Always say whether money was or was not charged in payment errors.
- **Empty states**: Warm and encouraging. Avoid "Oops" or corporate-speak.
- **Confirmations**: Name the specific person or record being affected. Never say "Are you sure?"
