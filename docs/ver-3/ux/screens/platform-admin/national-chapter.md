# National Dashboard — Chapter Drill-Down

- **Route:** `/admin/national/[id]/orgs/[id]`
- **Module:** M14 National Dashboard
- **Access:** Platform Admin (all roles); National Officers (designated for the parent association)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give national officers and platform admins a read-only aggregate view of a single chapter's health — membership composition, dues collection trend, CPD compliance, and recent activity — without exposing individual member records.

## Layout

Full-width single-chapter detail page. A breadcrumb at the top links back to the association view. A header band shows the chapter name, region, org type, and four quick stats. Below the header, four data sections stacked vertically: Membership Composition, Dues Collection Performance, CPD Credit Compliance, and Activity Summary. An "Export Chapter Summary" button is in the top-right. All content is read-only — no edit controls anywhere. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | "National Dashboard > [Association Name] > [Chapter Name]." Links back to `/admin/national/[id]`. |
| Header: chapter name | Display | Large chapter name, region sub-label, org type badge (e.g., "Chapter"). |
| Header quick stats | Four stat pills | Total Members, Active %, Dues Collection Rate, CPD Compliance Rate. |
| Officer roster | Read-only list | Chapter President and Secretary: name and contact info (email/phone). Visible for coordination purposes only. No individual member data beyond officer roster. |
| Section 1: Membership Composition | Charts | Donut chart: members by status (Active, Grace, Lapsed, Suspended, Pending). Bar chart: members by membership category (Regular, Life, Associate, Student, Honorary) if categories are configured. Total member count and active % as large numbers above the charts. |
| Section 2: Dues Collection Performance | Charts + stats | Large percentage: current cycle collection rate. 12-month trend line chart (collection rate per month). Total collected vs. total expected (currency amounts, current cycle). |
| Section 3: CPD Credit Compliance | Charts + stats | Large percentage: members meeting cycle requirement. Association average shown alongside for comparison. Distribution bar chart: members grouped by credit completion range (0–25%, 25–50%, 50–75%, 75–100%, > 100%). |
| Section 4: Activity Summary | List + stats | Total events and training sessions in the last 90 days. List of the 5 most recent events/training sessions: date, title, attendance count. Last announcement date. Last payment received date. |
| "Export Chapter Summary" button | Secondary button | Generates a PDF of aggregate data for this chapter. PDF is watermarked with the exporting officer's name and the generation timestamp. No individual member data is included. Logged in the audit trail. |
| "Back to Association Overview" | Navigation link | Returns to `/admin/national/[id]`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton per section. Header quick stats load first, then each section sequentially. |
| No activity | Chapter has no events logged | Activity section shows: "No events or training sessions recorded in this period." Last event date = "—". |
| No CPD data | No credit records exist | CPD section shows distribution with all zeros and a note: "No CPD credit records found for this chapter." |
| No dues data | New chapter, no payment records | Dues section: "No dues collection data available yet." |
| Access denied | User is not a National Officer for this association, or is a chapter-level officer | 403: "You do not have access to this page. If you believe this is an error, contact your platform administrator." |
| Org not found | Invalid org [id] or org not in this association | 404: "Chapter not found." |
| Export generating | Export button clicked | Button spinner. If generation takes > 3 seconds: "Generating export..." inline label beside the button. File downloads when ready. |
| Error | Any section fetch fails | Inline error per section with individual retry buttons. Other sections remain visible. |

## Interactions

- This screen is strictly read-only. There are no edit controls, no member management buttons, no payment actions, and no posting or messaging functions. National officers observe; they do not manage.
- "Export Chapter Summary" triggers an audit log entry: exported_by, association_id, org_id, report_type = chapter_summary, output_format = pdf, created_at, and the exporting officer's name (used for the watermark).
- CSV export is not available for chapter drill-down; only PDF (to limit raw data extraction at the individual chapter level).
- The officer roster shown (president and secretary names/contact info) is limited to publicly available officer role data — this is not individual member PII.
- Navigating directly to this URL while logged in as a chapter-level officer returns a 403 at the API level, regardless of URL construction or direct API calls (rule BR-36).
