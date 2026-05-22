# Admin Team (Operators)

- **Route:** `/admin/operators`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Allow Super Admins to manage the Memberry platform admin team — invite new admins, assign roles, and revoke access — while enforcing the rule that the last Super Admin cannot be removed.

## Layout

Full-width list page. Top bar: page title on the left, "Invite Admin" primary button on the right. Main area: a table of all platform admins with role, status, and last active date. Clicking a row opens an edit drawer on the right for role changes or revocation. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Admin table | Table | Columns: Name, Email, Role (Super Admin / Support Admin / Analyst), Status (Active / Invited / Revoked), MFA Status (Enrolled / Not Enrolled), Last Active Date. |
| Role badge | Inline badge | Color-coded by role: Super = purple, Support = blue, Analyst = grey. |
| MFA status | Inline indicator | Green checkmark = enrolled. Red warning = not enrolled (should not occur; MFA is mandatory on setup). |
| Edit row drawer | Slide-in panel | Shows the selected admin's name, email, current role, and status. Actions: "Change Role" (role dropdown, Save), "Revoke Access" (destructive, confirmation required). |
| "Invite Admin" button | Primary button | Opens an invite modal. |
| Invite modal | Modal form | Fields: Email address (text input), Role (radio: Super Admin / Support Admin / Analyst). "Send Invitation" button. |
| Revoke confirmation dialog | Modal | "Are you sure? [Name] will lose all admin access immediately." Confirm / Cancel. |
| Last Super Admin protection | System block | If the admin being removed or downgraded is the last Super Admin, the action is blocked: "Cannot remove the last Super Admin. Assign another Super Admin first." Confirm button disabled. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Default | Page loaded | Table of all admins visible. |
| Drawer open | Row clicked | Drawer slides in; row highlighted. Background table remains visible. |
| Invite sent | Invitation submitted | Modal closes; new row appears in table with Status = "Invited." Toast: "Invitation sent to [email]." |
| Invite bounce | Invitation email bounces | Status changes to "Invite Failed." Toast or email alert to the Super Admin who invited: "Invitation could not be delivered. Check the email address." |
| Role changed | Role dropdown saved | Row updates in place. Toast: "Role updated." Audit trail entry created. |
| Revoked | Revocation confirmed | Row status changes to "Revoked." If the revoked admin is currently logged in, their session is terminated immediately. |
| Self-revocation | Admin revokes themselves | Allowed only if at least one other Super Admin exists. On confirmation, the admin is logged out immediately. |
| Last Super Admin block | Revoke or downgrade of the only Super Admin | Action blocked. Dialog: "Cannot remove the last Super Admin. Assign another Super Admin first." |
| Error | API error on any action | Toast: "Action could not be completed. Please try again." |

## Interactions

- Role changes take effect immediately.
- All role changes and revocations are logged in the platform audit trail per rule M3-R13.
- MFA enrollment is mandatory; the invite flow requires MFA setup as part of first login. If a newly invited admin has not enrolled in MFA after 48 hours, an amber "MFA Pending" status is shown on their row.
- The invite link in the invitation email expires after 72 hours; after expiry, the row shows "Invite Expired" with a "Resend" button.
- Revoked admins' rows remain in the table with "Revoked" status for audit purposes; they can be filtered out with a status filter.
