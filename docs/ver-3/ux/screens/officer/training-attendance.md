# Training Attendance

- **Route:** `/org/[id]/officer/training/[id]/attendance`
- **Module:** M09 Training
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Secretary confirm attendance for a training program — via QR scanner for in-person single-session trainings, or via completion marking for multi-session programs — with automatic credit award on confirmation.

## Layout

### Desktop
Sidebar navigation visible. For single-session trainings: two-column split — left column holds QR scanner viewfinder or manual search (switchable via tabs), right column holds the live attendance list with credits-awarded counter. For multi-session trainings: full-width enrolled members table with completion marking controls.

### Mobile
For single-session: full-screen QR scanner as default. Bottom drawer (swipe up) for attendance list. "Manual" tab at top switches to manual search. For multi-session: full-width scrollable completion table with sticky "Mark Selected as Complete" bulk action bar at the bottom.

## Components

### Single-Session Components (Seminar, Workshop, Skills Training)

| Component | Type | Description |
|-----------|------|-------------|
| Mode tabs | Tab strip | "QR Scanner" (default) / "Manual". |
| QR scanner viewfinder | Camera component | Camera viewfinder with QR-code scan overlay. Instructions: "Point camera at member's QR code." Camera permission denied shows: "Camera access required for QR scanning. Enable in device settings." with "Use Manual Check-in" fallback. |
| Scan success feedback | Animated overlay | Green flash + member name + member photo (if available) + "Checked in. [X] credits awarded." displayed for 2 seconds. Sound/haptic feedback. Counter increments. |
| Scan failure feedback | Animated overlay | Red flash + specific error for 2 seconds: "Invalid code. Ask the member to refresh their QR code." / "Already checked in at [time]. [X] credits were previously awarded." / "This member is not enrolled in this training." |
| Manual check-in search | Search input | Search enrolled members by name or license number. Filtered list with check-in status. "Check in" button per row. On success: inline confirmation "[Name] checked in. [X] credits awarded." Already-checked-in rows show "Already checked in" label; "Check in" button disabled. |
| Credits counter | Prominent stat | "23 / 50 attended. 115 CPD credits awarded." Updates live. The credits figure = attended count x training credit value. |
| Attendance list | Scrollable list | Checked-in members in reverse chronological order. Each row: member name, org (for network enrollees), check-in time, method badge (QR / Manual). |
| Offline indicator | Yellow banner | "Offline -- check-ins will sync when connected. N pending." QR validation continues using cached HMAC secret. Check-ins queued locally. Credit awards queued pending sync. |
| Sync success banner | Green banner (transient) | "Synced N check-ins. Credits awarded." shown 3 seconds after reconnect and successful sync. |

### Multi-Session Components (Convention/Conference, Online Course/Webinar)

| Component | Type | Description |
|-----------|------|-------------|
| Enrolled members table | Data table | Columns: Member name (linked to roster detail), Org, Enrollment date, Payment status, Completion status (Pending / Complete). Checkbox per row for bulk selection. |
| Mark Complete button | Button per row | Single-member completion. Triggers confirmation: "Mark [Name] as completed? This will award [X] credits." On confirm: row status changes to "Complete"; credits awarded. If already complete: "Already marked complete. [X] credits were previously awarded." |
| Bulk select + Mark Complete | Checkbox + bulk action | Select multiple rows (or "Select All"). Sticky bulk action bar at bottom: "Mark N Selected as Complete?" Confirmation dialog: "Mark N members as completed? This will award [X] credits to each member." On confirm: all selected rows update; aggregate credits counter updates. |
| Completion summary | Stat row | "23/50 completed. 115 total credits awarded." Updates after each marking action. |
| Export CSV button | Secondary button | Downloads completion list: member name, org, enrollment date, completion date, credits awarded. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Camera initializing (single-session) or table skeleton (multi-session) |
| Pre-training | Accessed before training start date | "Attendance tracking opens on [training date]." Scanner/marking disabled. |
| Active: no attendance | Training day / post-training, 0 confirmed | "No attendance recorded yet. Use the QR scanner or manual check-in to record attendance." Scanner active. |
| In progress | Confirmations occurring | Counter incrementing; list or table updating |
| Offline (single-session) | Network lost | Yellow offline banner; QR validation uses cached key; check-ins queued locally |
| Reconnected | Network restored | Queued check-ins sync; credits awarded; sync success banner; attendance list updates |
| All complete | All enrolled members confirmed | Completion summary shows 100%; optional confetti or positive feedback message: "All enrolled members have been confirmed. [X] total credits awarded." |
| Post-completion: read-only | Training completed and closed | Attendance list is read-only; Export CSV available; stats visible; no new check-ins accepted unless late-entry mode is explicitly enabled |
| Error: camera denied | Camera permission refused | Red message + "Use Manual Check-in" button |
| Error: invalid QR | HMAC validation fails | Red flash + "Invalid code. Ask the member to refresh their QR code." |
| Error: already confirmed | Duplicate check-in attempt | Red flash (QR) or disabled button (manual/completion) + "Already checked in at [time]. [X] credits were previously awarded." |
| Error: member not enrolled | QR valid but not enrolled | Red flash + "This member is not enrolled in this training." |
| Error: completion marking failed | API error on mark complete | Toast (error): "Failed to mark [Name] as completed. Please try again." Row state unchanged. |

## Interactions

- QR scanner activates camera on page load. The scan overlay appears immediately. On successful scan: green flash + member name + photo + "[X] CPD credit(s) will be awarded to [Name]" displayed for 2 seconds, then the scanner resets automatically. On failure: red flash + specific error ("Invalid code. Ask the member to refresh their QR code." / "Already checked in at [time]. [X] credits were previously awarded." / "This member is not enrolled in this training.") displayed for 3 seconds, then the scanner resets.
- Manual check-in: search triggers after 2 characters are entered (300ms debounce). Results show member name, photo, enrollment status, and current check-in status. Tapping "Check in" immediately marks the member as attended (optimistic update), adds them to the attendance list, and increments the credits counter. Already-checked-in members show a disabled "Already checked in" label.
- Credits counter ("N / N attended. X CPD credits awarded.") updates in real time as each check-in occurs — both QR and manual check-ins update without a page refresh.
- Switching between QR Scanner mode and Manual mode via the mode tabs preserves the attendance list, counter, and all credits-awarded data. Camera pauses in Manual mode and resumes on returning to QR Scanner.
- Offline mode: if network is lost, a yellow banner appears. QR check-ins continue to work locally using the cached HMAC secret. Check-ins and their associated credit awards are queued. A pending badge shows the count ("3 pending sync"). On reconnect, pending check-ins sync automatically, credits are server-confirmed, and the sync success banner shows "Synced N check-ins. Credits awarded."
- For multi-session trainings (completion marking mode): clicking "Mark Complete" on a single row shows a confirmation dialog ("Mark [Name] as completed? This will award [X] credits.") — confirming updates the row status in place and increments the completion summary. Selecting multiple rows via checkboxes and clicking the bulk action bar's "Mark N Selected as Complete" triggers a single confirmation dialog before processing all selected rows.
- Bulk completion: if any selected member is already marked complete, the dialog notes this and those members are skipped with no duplicate credit award.
- "Export CSV" triggers an immediate download of the completion/attendance list including member name, org, enrollment date, confirmation date, credits awarded, and confirmation method.
