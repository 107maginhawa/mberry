# Event Check-in

- **Route:** `/org/[id]/officer/events/[id]/attendance`
- **Module:** M08 Events
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Secretary check in attendees at an event using a QR scanner or manual search, with live attendance counting and offline support.

## Layout

### Desktop
Sidebar navigation visible. Two-column split: left column holds the QR scanner viewfinder (or manual search, switchable via tabs), right column holds the live attendance list with counter and timestamps. Attendance counter is always visible at the top of the right column.

### Mobile
Full-screen QR scanner as default view with the camera viewfinder occupying most of the screen. A bottom drawer (swipe up) reveals the attendance list. A "Manual" tab at the top switches to the manual check-in search view. Attendance counter is fixed at the top of the screen in both views.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Mode tabs | Tab strip | "QR Scanner" (default) / "Manual". Switching modes does not reset attendance data. |
| QR scanner viewfinder | Camera component | Activates device camera with a QR-code scan overlay (targeting square). Instructions: "Point camera at member's QR code." Camera permission denied triggers prompt: "Camera access is required for QR scanning. Please enable camera permission in your device settings." with a "Use Manual Check-in" fallback button. |
| Scan success feedback | Animated overlay | Green flash over the entire viewfinder + member name + member photo (if available) displayed for 2 seconds. Sound/haptic feedback. Attendance counter increments. |
| Scan failure feedback | Animated overlay | Red flash + specific error message for 2 seconds: "Invalid code. Ask the member to refresh their QR code." / "Code expired. Ask member to refresh." / "Not registered for this event." / "Already recorded at [time]. No duplicate." |
| Manual check-in search | Search input | Searches registered members by name or license number. Filtered list appears below with check-in status per member (not checked in / already checked in). "Check in" button per row; disabled for already-checked-in members with label "Already checked in." |
| Manual check-in confirmation | Inline confirmation | Tapping "Check in" next to a member name shows: "Check in [Name]?" with Confirm / Cancel. On confirm: member added to attendance list; counter increments. |
| Attendance counter | Prominent stat | "23 / 50 checked in" with a progress bar. Updates live. Denominator is the registered count (or the total enrolled org members if registration is disabled). |
| Attendance list | Scrollable list | Checked-in members in reverse chronological order (most recent first). Each row: member name, check-in time, method badge (QR / Manual). |
| Offline indicator | Yellow banner | "Offline -- check-ins will sync when connected. N pending." Shown whenever the device has no network. QR validation continues using cached HMAC secret (EventQRSecret) stored locally. Check-ins queued in local storage. |
| Sync success banner | Green banner (transient) | "Synced N check-ins." shown for 3 seconds after reconnection and successful sync. Auto-dismisses. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton on attendance list; camera initializing |
| Pre-event | Accessed before event start date | "Check-in opens on [event date at start time]." Scanner disabled. |
| Active: no check-ins | Event day, 0 attended | "No one has checked in yet. Start scanning member QR codes or use manual check-in." Scanner active. Counter shows "0 / N". |
| In progress | Check-ins occurring | Counter incrementing; list populating; scanner stays active |
| Offline | Network lost | Yellow offline banner; check-ins stored locally; QR validation uses cached key; counter still increments locally |
| Reconnected | Network restored | Queued check-ins sync automatically; sync success banner flashes; list updates with any server-side changes |
| Sync conflict | Same member checked in offline and online by different officers | Earliest timestamp wins; no duplicate created; conflict log entry created for officer review (accessible from event detail) |
| Post-event | Accessed after event end time | Scanner still active for late entries. Banner: "Event ended. Late check-in mode." |
| Error: camera denied | Browser/OS camera permission refused | Red message: "Camera access is required for QR scanning. Enable in device settings." + "Use Manual Check-in" button switches to manual tab. |
| Error: invalid QR | HMAC validation fails | Red flash + "Invalid code. This QR code is not recognized. Ask the member to refresh their code." |
| Error: member not registered | QR valid but member not on registration list | Red flash + "This member is not registered for this event." Officer can switch to manual tab and add the member manually. |
| Already checked in | Duplicate scan or manual attempt | Red flash (QR) or disabled row (manual) + "Already recorded at [time]. No duplicate." |

## Interactions

- QR scanner activates camera on page load. The scan overlay appears immediately. On successful scan: green flash + member name + photo displayed for 2 seconds, then the scanner resets automatically and is ready for the next scan. On failure: red flash + specific error ("Invalid code. Ask the member to refresh their QR code." / "Code expired. Ask member to refresh." / "Not registered for this event." / "Already recorded at [time]. No duplicate.") displayed for 3 seconds, then the scanner resets.
- Manual check-in: search triggers after 2 characters are entered (300ms debounce). Results show member name, photo, and current check-in status. Tapping "Check in" on a result shows an inline confirmation ("Check in [Name]?") — confirming immediately marks them as checked in (optimistic update) and adds them to the attendance list. Already-checked-in members show a disabled "Already checked in" label instead of the button.
- Attendance counter updates in real time as check-ins occur — both QR and manual check-ins increment the counter without a page refresh.
- Switching between QR Scanner mode and Manual mode via the mode tabs preserves the attendance list, counter, and all existing check-in data. The camera feed pauses when Manual mode is active and resumes when QR Scanner mode is re-selected.
- Offline mode: if network is lost, a yellow banner appears at the top of the screen. QR check-ins continue to work locally using the cached HMAC secret (EventQRSecret). A pending count badge appears on the offline banner ("3 pending sync"). On reconnect, pending check-ins sync automatically, the sync success banner appears ("Synced N check-ins."), and the badge clears.
- If a sync conflict is detected (same member checked in offline by this officer and online by another officer simultaneously), the earliest timestamp wins, no duplicate is created, and a conflict log entry is noted in the event detail's Attendance tab for later review.
- On mobile, swiping up on the bottom drawer reveals the full attendance list without leaving the scanner view. The attendance counter remains fixed at the top of the screen in both QR and Manual modes.
