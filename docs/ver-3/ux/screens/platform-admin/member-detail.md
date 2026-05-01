# Member Detail

- **Route:** `/admin/members/[id]`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Support)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a full profile of a single member — identity, org memberships, account status, payment history, and audit trail — to support troubleshooting, duplicate detection, and DPA compliance requests.

## Layout

Full-width page with a profile header and four tabs below: Overview, Memberships, Payments, and Activity. The header shows the member's name, email, license number, profile photo (if available), and admin action buttons. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Profile header | Display section | Name, email, license number, profile photo thumbnail, account created date, last login date. |
| Status badge | Badge | Active, Grace, Lapsed, Suspended, Pending — reflects the member's current status across their primary org. |
| "View As" button | Primary button | Launches impersonation for this member. Opens confirmation dialog before proceeding (same dialog as in `/admin/members`). |
| "Merge Duplicate" button | Secondary button (Super only) | Opens the member merge tool. Visible only if the platform has flagged this account as a potential duplicate. |
| Tab: Overview | Tab | Identity details (name, email, phone, license number, specialty, location). MFA status (enrolled/not enrolled). Account flags (e.g., opted out of targeted ads). DPA request status if one is active. |
| Tab: Memberships | Tab | Table of all org memberships: Org Name, Association, Role, Membership Category, Status, Joined Date. Multiple rows if the member belongs to more than one org. |
| Tab: Payments | Tab | Payment history across all orgs: date, org, invoice reference, amount, status (paid/failed/refunded). Read-only. |
| Tab: Activity | Tab | Admin-visible audit trail for this account: login events, password resets, role changes, impersonation sessions, officer actions taken. Filterable by date and event type. |
| DPA request panel | Conditional section (Overview) | Shown when an active data export or deletion request exists for this member. Shows request type, submission date, compliance deadline, current status (pending/processing/completed). "Process Request" button for Super Admins. |
| Impersonation history | Sub-section (Activity tab) | Collapsed sub-section showing all past impersonation sessions for this member: admin who impersonated, session start/end, pages visited. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for header and tab content. |
| No memberships | Memberships tab empty | "This member has no org memberships." |
| No payments | Payments tab empty | "No payment history found for this member." |
| No activity | Brand new account | "No activity recorded yet." |
| Active DPA request | Data export/deletion in progress | Overview tab shows a yellow DPA alert panel with deadline countdown. |
| Error | Any tab fetch fails | Inline error per tab with retry. |

## Interactions

- "View As" triggers the impersonation flow; on confirmation, redirects to the member's dashboard with the orange banner. Cannot be used on other platform admins.
- "Merge Duplicate" opens the merge tool pre-populated with this account as one of the two candidates. Admin selects which account is canonical; preview shows what data will be combined; confirmation executes the merge. The merged (deactivated) account is marked with a note linking to the canonical account.
- DPA "Process Request" (data export): generates a JSON/CSV package with PII encrypted; admin downloads and delivers to the member.
- DPA "Process Request" (deletion): shows a warning — "A 30-day hold is enforced. Financial records are retained for 7 years per regulation. PII will be anonymized after the hold period." Requires explicit confirmation.
- Activity tab entries for impersonation sessions are expandable to show the list of pages visited during that session.
