# Advertiser Detail

- **Route:** `/admin/advertising/advertisers/[id]`
- **Module:** M16 Advertising
- **Access:** Platform Admin (all roles)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete view of a single advertiser account — their approval status, campaign history, and payment records — and the controls to approve, suspend, or reinstate the account.

## Layout

Full-width profile page. A profile header section at the top displays company identity, status, and account action buttons. Below the header, two tabs: Campaigns and Payment History. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Header: company name | Display | Large company name, company type sub-label. |
| Status badge | Badge | Pending (amber), Approved (green), Suspended (red). |
| Contact details | Display section | Contact name, email, phone. |
| Registration date | Display | Date the application was submitted. |
| Approval info | Display (if approved) | "Approved on [date] by [admin name]." |
| Suspension info | Display (if suspended) | "Suspended on [date]. Reason: [suspension reason]." |
| "Approve" button | Primary button (Pending state only) | Approves the advertiser. Confirmation: "Approve [Company Name]? They will receive account credentials and can create campaigns." Saves approval with admin ID and timestamp. |
| Rejection during review | Secondary button (Pending state only) | "Reject Application." Opens a modal with a required reason field. Rejection reason is sent to the applicant. |
| "Suspend" button | Destructive button (Approved state only) | Opens a modal with a required reason field. Confirms: "Suspending this advertiser will immediately pause all [N] active campaigns. Continue?" On confirm: advertiser status = Suspended, all active campaigns paused. |
| "Reinstate" button | Secondary button (Suspended state only) | Confirmation: "Reinstate [Company Name]? Their account will be reactivated. Paused campaigns will not automatically resume — they must be manually restarted." |
| Tab: Campaigns | Tab | Table of all campaigns for this advertiser. Columns: Campaign Name, Association, Format, Date Range, Status, Impressions (delivered), Spend. Status badges color-coded. Row links to campaign detail. |
| Tab: Payment History | Tab | Invoice table: Invoice Number (downloadable PDF link), Billing Period, Amount (PHP), Status (Paid / Outstanding / Overdue). Overdue rows highlighted in red. Total lifetime spend shown at the bottom. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for header and tab content. |
| Pending | Status = Pending | "Approve" and "Reject" buttons prominent in header. Campaigns tab may be empty. |
| Approved | Status = Approved | "Suspend" button visible. Campaigns tab shows any campaigns created. |
| Suspended | Status = Suspended | Red status badge. Amber banner: "This advertiser is suspended. All campaigns are paused." "Reinstate" button prominent. |
| No campaigns | Campaigns tab, no campaigns yet | "This advertiser has not created any campaigns yet." |
| No payment history | Payment tab, new advertiser | "No invoices yet. Payment history will appear once campaigns are billed." |
| Error | Fetch fails | Inline error per section with retry. |

## Interactions

- "Approve" triggers an automated email to the advertiser with their account credentials and a link to the advertiser portal.
- "Reject" sends the rejection reason to the applicant via email. The advertiser record is retained with status "Rejected" for audit purposes.
- "Suspend" cascades immediately to all campaigns: each campaign's status changes to "Paused — Advertiser Suspended."
- "Reinstate" does not auto-resume campaigns; the admin or advertiser must manually restart individual campaigns.
- All account status changes are logged in the platform audit trail with admin ID and timestamp.
- Invoice PDF links open the document in a new tab (hosted by the payment gateway).
