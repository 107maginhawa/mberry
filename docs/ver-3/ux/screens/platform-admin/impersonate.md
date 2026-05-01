# Impersonate

- **Route:** `/admin/impersonate`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Support)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Let operators find any member by name, email, or license number and launch a read-only impersonation session to diagnose exactly what that member sees on the platform.

## Layout

Search-focused page. A large centered search bar dominates the upper half. Below the search bar, results render as a vertical card list. In the default state (no query), a "Previously viewed" section shows the last 5 impersonation sessions for quick re-access. A rules reminder panel appears at the bottom: "Read-only. 30-minute session limit. All navigation is logged to the audit trail." No sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search bar | Auto-complete input | Searches simultaneously by full name, email address, and license number. Debounced 300ms. Minimum 2 characters before querying. |
| Result cards | List of cards | Each card: profile avatar, full name, email address, org membership badges (org name + association), role label, "View As" button. |
| "View As" button | Primary button per card | Triggers the confirmation dialog before launching impersonation. |
| Confirmation dialog | Modal | "You will see the platform exactly as [member name] sees it. All navigation will be logged. This session will auto-terminate after 30 minutes. No changes can be made. [Confirm] [Cancel]" |
| Recently viewed | List | Up to 5 most recent impersonation sessions by this admin. Each entry: member name + org, session date, session duration. "View As" button re-launches. |
| Rules reminder | Static text panel | Non-dismissible reminder at page bottom: "Impersonation is read-only (M3-R4). Sessions are limited to 30 minutes (M3-R3). Every page visited is logged with your admin ID (M3-R2). You cannot impersonate other platform administrators (M3-R5)." |
| Orange impersonation banner | Fixed top banner (post-launch) | Appears on every page during the session: "[Admin name] is viewing as [member name] — [Org name]. Read-only. [Exit] [Time remaining: MM:SS]" Cannot be scrolled away; fixed position. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Default | Page load, no query | Search bar focused. Recently viewed sessions shown below if any exist. |
| Searching | Query entered (≥ 2 chars) | Loading spinner inside the search bar. Results replace the default content. |
| Results | Search returns matches | Card list renders below the search bar. |
| No results | Search returns empty | "No users found matching '[query]'. Check the spelling or try a different identifier." |
| Admin blocked | Search returns an admin account | "View As" button is disabled. Tooltip: "Cannot impersonate platform administrators." |
| Impersonation active | Session launched | Redirect to the member's dashboard. Orange fixed banner appears at top. Timer counts down from 30:00. |
| Session timeout | 30 minutes elapsed | Banner message changes: "Impersonation session expired. Returning to admin view." Auto-redirect to `/admin` after 3 seconds. |
| Session interrupted | Network error during session | Banner: "Impersonation session interrupted. Reconnecting..." Auto-retry 10 seconds; if failed: "Session lost. Returning to admin view." Auto-redirect. |
| Write blocked | Admin attempts to perform a write action during impersonation | API blocks the action. Toast: "Changes cannot be made during impersonation. Exit to your admin account to take action." |
| Error | Search API fails | "Search is temporarily unavailable. Please try again." |

## Interactions

- "Confirm" in the confirmation dialog launches impersonation: the session is created in ImpersonationLog, and the browser navigates to the impersonated member's home dashboard.
- "Exit" in the orange banner: ends the impersonation session immediately, logs the termination in ImpersonationLog with `termination_reason = manual`, and returns to `/admin/impersonate`.
- Timer in the banner counts down in real time; at 5 minutes remaining, the timer text turns amber. At 1 minute remaining, it turns red and pulses.
- During the session, the admin navigates the platform normally; every page load is recorded in `ImpersonationLog.pages_visited`.
- Recently viewed list is personal to the logged-in admin; it is not shared across the admin team.
