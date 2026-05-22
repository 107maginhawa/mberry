# Module 14: National Dashboard

**Version:** 3.0
**Updated:** 2026-04-21
**Phase:** 2 -- Professional Identity Platform
**Monetization Tier:** Premium
**Status:** Draft

---

## 1. Overview

### Purpose

National Dashboard gives national association officers a real-time, cross-chapter view of association health -- membership totals, dues collection performance, CPD compliance, and activity levels -- aggregated from all chapters under the national body. It replaces the current practice of calling individual chapter treasurers and secretaries for manual, self-reported numbers and consolidates them into a single, authoritative dashboard that national leadership can use for planning, reporting, and intervention.

### Why This Module Exists

National associations in the Philippines have no systematic view into what is happening across their chapters. A national PDA president cannot answer "What is our total active membership across all chapters?" without calling dozens of chapter officers and manually reconciling spreadsheets. The numbers arrive inconsistently, the definitions differ (some chapters count Grace-period members as Active, others do not), and by the time the data is assembled, it is already weeks out of date.

With Memberry, every chapter already maintains structured, real-time membership and financial records. The National Dashboard surfaces these records at the aggregate level -- without exposing individual member data -- so that national leadership can see the true state of the association at any moment.

### Access Model

Access to the National Dashboard is tightly controlled per BR-36:

- **Platform Admins** have access to the dashboard for all associations on the platform.
- **Designated National Officers** of an association are granted access by the platform admin on behalf of that association. The platform admin configures which national-level roles can see cross-chapter data. No officer can grant themselves or peers access to this module.
- **Chapter-level officers cannot see data from other chapters.** A chapter secretary can see only her own chapter's data. She cannot see the dashboard, the chapter comparison table, or any other chapter's metrics, regardless of her seniority within her chapter.

### Device Constraint

**Desktop-primary.** The National Dashboard is designed for national association officers conducting structured planning sessions at a computer. Information density (sortable tables, trend charts, cross-chapter comparisons, export controls) is not suited to mobile screens. The module renders on mobile with a reduced view directing users to use a desktop for the full experience.

### Dependencies

| Module | Relationship |
|--------|-------------|
| **M05: Membership** | Aggregate membership counts, status breakdowns, and retention rates are sourced from chapter membership records. |
| **M06: Dues and Payments** | Aggregate dues collection rates, total revenue collected, and payment trend data are sourced from chapter financial records. |
| **M09: Training** | Event and training session counts, attendance totals, and activity recency are sourced from chapter training records. |
| **M10: Credit Tracking** | CPD compliance rates and average credits per member are sourced from chapter credit records. |

---

## 2. Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 14.1 | Association-wide member count | Total members across all chapters, broken down by status (Active, Grace, Lapsed, Suspended) and by chapter. Single summary view with supporting breakdown table. | National Officer, Platform Admin | P1 |
| 14.2 | Dues collection rate | Association-wide percentage of members current on dues. Trend chart showing collection rate month-by-month for the past 12 months. Chapter-level collection rates available in the chapter comparison view. | National Officer, Platform Admin | P1 |
| 14.3 | CPD credit compliance | Percentage of members meeting their current CPD cycle requirement. Average CPD credits earned per member across the association. Trend over time (monthly for the current cycle). | National Officer, Platform Admin | P1 |
| 14.4 | Activity metrics | Count of events and training sessions held across all chapters in a selected period. Average attendance per event. Chapter-level activity counts. | National Officer, Platform Admin | P2 |
| 14.5 | Chapter health comparison | Side-by-side table of all chapters with columns: member count, active percentage, dues collection rate, activity count. Sortable by any column. Designed for national planning and identifying chapters that need support or recognition. | National Officer, Platform Admin | P1 |
| 14.6 | Chapter drill-down | National officer clicks a chapter in the comparison table to see that chapter's detailed metrics: membership composition by status and category, dues collection trend, CPD compliance distribution, recent activity list. Read-only. Individual member records are not shown. | National Officer, Platform Admin | P1 |
| 14.7 | Export | All reports exportable to PDF (formatted for presentation) and CSV (raw data for further analysis). Exports include aggregate data only -- no individual member PII. | National Officer, Platform Admin | P1 |
| 14.8 | Association selector | Platform admins managing multiple associations can switch between associations from the dashboard. National officers see only their association. | Platform Admin | P1 |

---

## 3. User Journeys

### Journey 14A: National Officer Reviews Association Health Before a Board Meeting

**Persona:** Dr. Aquino (PDA National President, designated National Officer)
**Trigger:** Preparing for the quarterly national board meeting.

1. Dr. Aquino logs in on her desktop and navigates to `/admin/national/[id]`.
2. The association selector is not shown -- she has access to only one association (PDA). She sees the metrics overview for PDA immediately.
3. Summary cards show: 4,200 total members, 71% active (2,982 active, 486 grace, 504 lapsed, 228 suspended), 45 chapters.
4. Dues collection rate: 68% (below target). Trend chart shows a dip starting 3 months ago.
5. CPD compliance: 62% of members meeting cycle requirement, average 14.3 credits per member.
6. Activity metrics: 38 events and training sessions across all chapters in the past 90 days, 47 average attendance per event.
7. Dr. Aquino navigates to the chapter health comparison table. Sorts by dues collection rate ascending. Identifies 5 chapters below 50%.
8. Clicks on the lowest-performing chapter -- navigates to the chapter drill-down view (read-only). Sees membership breakdown, dues trend, and CPD distribution. No individual member names or records.
9. Returns to the main dashboard and clicks "Export" -- downloads a PDF summary with all association metrics and the chapter comparison table, formatted for the board presentation.

### Journey 14B: Platform Admin Configures Dashboard Access for a New Association

**Persona:** Memberry Platform Admin
**Trigger:** A new association (PNA, Philippine Nurses Association) has onboarded and their national president needs dashboard access.

1. Platform admin navigates to M03 Platform Administration.
2. Locates the PNA association record and selects "National Dashboard Access."
3. Adds Dr. Santos (PNA National President) as a designated National Officer for the National Dashboard.
4. Dr. Santos can now access `/admin/national/[id]` and sees only PNA data.
5. Platform admin also adds the PNA Executive Director as a second designated officer.
6. Chapter presidents and secretaries within PNA are unaffected -- they retain access only to their own chapter's data.

### Journey 14C: Platform Admin Reviews All Associations

**Persona:** Memberry Platform Admin
**Trigger:** Monthly platform health review.

1. Platform admin navigates to `/admin/national`.
2. Sees an association selector dropdown: PDA, PNA, PMA, PCCP (all associations on the platform).
3. Selects PDA -- sees PDA's aggregate metrics and chapter comparison. URL updates to `/admin/national/[id]`.
4. Switches to PNA -- sees PNA's aggregate metrics. URL updates to `/admin/national/[id]`.
5. Clicks the Export button on `/admin/national` and generates a cross-association summary CSV covering total members, dues collection rate, and CPD compliance for all associations. This report is for internal Memberry use (billing, customer success, platform health monitoring). (Note: report exports are triggered from the main dashboard via the Export button — no separate reports page.)

### Journey 14D: National Officer Drills Into a Specific Chapter

**Persona:** Dr. Aquino (PDA National President)
**Trigger:** Concerned about Metro Manila chapter's declining dues collection.

1. From the chapter comparison table, Dr. Aquino clicks "PDA Metro Manila."
2. Navigates to `/admin/national/[id]/orgs/[id]` -- the chapter drill-down.
3. Sees membership breakdown: 250 members total, 205 Active (82%), 18 Grace, 20 Lapsed, 7 Suspended.
4. Dues collection trend: 12-month chart. Collection was at 94% six months ago, has declined to 81% this month.
5. CPD compliance: 78% meeting cycle requirement, average 16.1 credits per member.
6. Recent activity: 4 events in the past 90 days, most recent 12 days ago.
7. Officer roster is visible (chapter president and secretary names and contact info) for coordination purposes.
8. Dr. Aquino takes note and plans to contact the chapter president about the dues decline. She does not see which specific members are lapsed.
9. Clicks "Export Chapter Summary" -- downloads a PDF of this chapter's aggregate data for her records.

---

## 4. Business Rules

### BR-36: National Dashboard Access Control

- **Rule:** Access to the National Dashboard and all cross-chapter aggregate data is restricted to (a) Platform Admins and (b) individuals explicitly designated as National Officers for their association by a Platform Admin. Chapter-level officers -- regardless of their seniority, tenure, or role within their chapter -- cannot access the National Dashboard, cannot view the chapter comparison table, and cannot view data from any chapter other than their own. No officer can self-grant, or grant to peers, access to this module. National officer access is configured per association by the platform admin and can be revoked at any time.
- **Category:** Access / Constraint
- **Why this matters:** The trust model of Memberry depends on chapters believing their data is protected. If a chapter secretary in Cebu could see the membership and financial records of the Metro Manila chapter, inter-chapter tensions would undermine platform adoption. National officers have a legitimate governance need for aggregate data -- but that need is for totals and trends, not individual chapter's internal records accessed without the chapter's knowledge. The platform admin gatekeeping ensures that national bodies cannot unilaterally grant themselves unfettered access to chapter data; there is an institutional check via the platform operator.
- **Examples:**
  1. Dr. Aquino is designated as a National Officer for PDA by the platform admin. She can access `/admin/national/[id]` and see all 45 PDA chapters' aggregate data.
  2. Dr. Santos is the Metro Manila Chapter Secretary (a chapter-level role). She can access her chapter's own officer dashboard but cannot access `/admin/national/[id]` and sees no data from other chapters.
  3. Dr. Santos attempts to navigate directly to `/admin/national/[id]/orgs/[id]` (another chapter's URL). The platform returns a 403 Forbidden response. She sees: "You do not have access to this page."
  4. A national officer attempts to grant dashboard access to a colleague through the officer management screen. The option does not exist -- access grants are controlled exclusively through M03 Platform Administration by platform admins.
- **Impact if wrong:** Chapter officers see other chapters' membership lists and financial records (severe trust breach). Chapters leave the platform or refuse to enter accurate data. Data protection violations if member data is accessed without consent.
- **Approval:** [ ] Stakeholder sign-off

---

## 5. UX Specification

### Screen Inventory

| Screen | Route | Persona | Device |
|--------|-------|---------|--------|
| National Dashboard Home | `/admin/national` | National Officer, Platform Admin | Desktop-primary |
| Association Drill-Down | `/admin/national/[id]` | National Officer, Platform Admin | Desktop-primary |
| Chapter Drill-Down | `/admin/national/[id]/orgs/[id]` | National Officer, Platform Admin | Desktop-primary |

> **Note on Reports:** Report exports are triggered from `/admin/national` via the Export button — generates PDF or CSV downloads directly. There is no separate `/admin/national/reports` page in PRD v3 scope. The report configuration options (format, date range, scope) appear as a modal/panel on the main dashboard.

### Screen Details

#### National Dashboard Home (`/admin/national`)

**Layout:** Summary cards at top, trend charts below, chapter health comparison table at the bottom.

**Association selector (Platform Admins only):**
- Dropdown at the top of the page: lists all associations on the platform.
- National officers do not see this dropdown -- they land directly on their association's data.
- Selecting an association reloads the page with that association's metrics.

**Summary cards (row of 6):**
- Total Members (number)
- Active Members (number + percentage of total)
- Chapters (total count)
- Dues Collection Rate (percentage, current cycle + month-over-month trend arrow)
- CPD Compliance Rate (percentage of members meeting cycle requirement)
- Total Events and Training Sessions (count, configurable period: last 30, 60, or 90 days)

**Trend charts (2 charts):**
- Membership by Status Over Time: stacked area chart, 12-month rolling, showing Active, Grace, Lapsed, and Suspended member counts month by month.
- Dues Collection Rate Trend: line chart, 12-month rolling, showing the association-wide collection rate per month.

**Chapter health comparison table:**
- Columns: Chapter Name (linked to chapter drill-down), Region, Members, Active %, Dues Collection Rate, Activity Count (last 90 days).
- Sortable by any column header.
- Color coding: Active % and Dues Collection Rate cells are green (>70%), amber (50-70%), or red (<50%).
- Default sort: alphabetical by chapter name.
- Pagination: 25 chapters per page, or virtual scroll for larger associations.
- Filterable by region (dropdown) and by status threshold (toggle: "Show all" / "Needs attention" -- chapters where any metric is red).

**Actions:**
- "Export" button (top right): generates PDF or CSV of the current view, including summary cards and full chapter table. Prompts for format choice.
- Date range selector for trend charts (3, 6, 12, or 24 months).

#### Association Drill-Down (`/admin/national/[id]`)

This screen is the same as the National Dashboard Home when filtered to a single association. For Platform Admins, it provides a permalink to a specific association's view independent of the association selector. National officers are redirected here automatically from `/admin/national`.

#### Chapter Drill-Down (`/admin/national/[id]/orgs/[id]`)

**Access:** National Officers and Platform Admins. Read-only.

**Layout:** Full-page detail view with sections.

**Header:**
- Chapter name, region, org type.
- Quick stats: total members, active percentage, dues collection rate, CPD compliance rate.
- Officer roster: chapter president and secretary names and contact info (publicly available by role).

**Section 1: Membership Composition**
- Donut chart: members by status (Active, Grace, Lapsed, Suspended, Pending).
- Bar chart: members by membership category (Regular, Life, Associate, Student, Honorary) if applicable.
- Total count and active percentage as large numbers.

**Section 2: Dues Collection Performance**
- Collection rate (current cycle): large percentage.
- 12-month collection trend line chart.
- Total collected vs. total expected (currency amounts, current cycle).

**Section 3: CPD Credit Compliance**
- Compliance rate (large percentage): members meeting cycle requirement.
- Average CPD credits per member (association average shown alongside for comparison).
- Distribution breakdown: members grouped by credit completion range (0-25%, 25-50%, 50-75%, 75-100%, >100%).

**Section 4: Activity Summary**
- Total events and training sessions in the past 90 days.
- List of the 5 most recent events/training sessions with: date, title, and attendance count.
- Last announcement date.
- Last payment received date.

**Actions:**
- "Export Chapter Summary" (PDF, aggregate data only, watermarked with exporting officer name and timestamp).
- "Back to Association Overview" link.

**Read-only enforcement:**
- No edit controls appear on this screen. No officer management, no posting, no messaging functions. National officers observe; they do not manage.

#### Reports (Export panel within `/admin/national`)

> **Note:** Report exports are triggered from `/admin/national` via the Export button — not a separate page. The following options are presented as a modal or panel on the main dashboard.

**Layout:** Report builder with options panel and preview/download area.

**Report types available:**
- Association Summary: top-level metrics for one or all associations (platform admin only for multi-association). Includes summary cards and chapter comparison table.
- Dues Collection Report: chapter-by-chapter dues collection rates, amounts collected vs. expected, trend data.
- CPD Compliance Report: chapter-by-chapter compliance rates, average credits, distribution by completion range.
- Activity Report: event and training session counts by chapter, attendance totals, date range configurable.

**Options for each report:**
- Association (dropdown, platform admin only).
- Date range (default: current cycle or last 12 months, configurable).
- Output format: PDF (formatted with headers, charts, branding) or CSV (raw data, importable to spreadsheet tools).
- Scope: All chapters or specific chapters (multi-select).

**Download behavior:**
- Clicking "Generate Report" produces the file and immediately downloads it.
- For large associations (>50 chapters), a "Report is being generated" spinner is shown for up to 10 seconds before the download begins.
- All exports are logged in the audit trail: who generated it, which report type, which association, date, format, and scope.

### States

| State | Trigger | UI Behavior |
|-------|---------|-------------|
| **Loading** | Dashboard opens | Skeleton cards and chart placeholders. Summary cards load first; charts and table load sequentially. |
| **No chapters** | Association has no chapters yet | Empty state: "No chapters have been added to this association yet. Add chapters through Platform Administration." |
| **Single chapter** | Association has only one chapter | Chapter comparison table shows one row. No sorting applied. Export still available. |
| **Insufficient access** | Non-authorized officer navigates to a national route | 403 page: "You do not have access to this page. If you believe this is an error, contact your platform administrator." |
| **No activity data** | Chapter has no events logged | Activity count shows 0. Activity summary section shows "No events or training sessions recorded in this period." |
| **Mobile access** | Dashboard accessed on a mobile viewport | Banner: "The National Dashboard is designed for desktop use. For the full experience, please open this page on a computer." Metrics overview cards are shown in a stacked mobile layout; charts and full comparison table are hidden. |

---

## 6. Acceptance Criteria Patterns

- National Dashboard access is denied with a 403 response to any user who is not a Platform Admin or a designated National Officer for the association. This check is enforced at the API layer, not only the UI.
- Chapter-level officers cannot retrieve cross-chapter aggregate data via any API endpoint, regardless of direct URL access or API calls.
- Association-wide summary metrics (member count, dues rate, CPD compliance rate) load within 3 seconds for associations with up to 100 chapters.
- Chapter comparison table is sortable by any column; sort state persists during the session.
- Chapter drill-down shows read-only aggregate data only. No individual member records (names, license numbers, contact info, individual payment records) are returned by the API endpoints serving this screen.
- All exports are logged in the audit trail with exporting officer identity, report type, association scope, and timestamp.
- PDF exports include a watermark with the exporting officer's name and the date and time of generation.
- CSV exports contain only aggregate-level columns. No columns for individual member names, license numbers, emails, or phone numbers.
- Trend charts default to 12-month rolling window and support user-configurable ranges of 3, 6, 12, and 24 months.
- Platform admin association selector populates all active associations within 2 seconds.

---

## 7. Data Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **National Dashboard Access** | `id`, `association_id`, `member_id`, `granted_by` (platform admin member ID), `granted_at`, `revoked_at` (nullable) | Records which individuals are designated National Officers for each association. Rows without `revoked_at` are active grants. Only platform admins can insert or update rows. |
| **Association Snapshot** | `id`, `association_id`, `snapshot_month` (YYYY-MM), `total_members`, `active_members`, `grace_members`, `lapsed_members`, `suspended_members`, `collection_rate`, `total_collected`, `total_expected`, `cpd_compliance_rate`, `avg_credits_per_member`, `total_events`, `total_training_sessions`, `created_at` | Monthly aggregate snapshot for trend charts. Computed overnight from chapter records. Prevents expensive real-time re-aggregation for historical months. |
| **Chapter Snapshot** | `id`, `org_id`, `association_id`, `snapshot_month` (YYYY-MM), `total_members`, `active_members`, `grace_members`, `lapsed_members`, `suspended_members`, `collection_rate`, `total_collected`, `total_expected`, `cpd_compliance_rate`, `avg_credits_per_member`, `activity_count_90d`, `last_event_date`, `last_payment_date`, `created_at` | Monthly aggregate per chapter. Used for chapter comparison table and drill-down views. |
| **Dashboard Export Log** | `id`, `exported_by` (member ID), `association_id`, `report_type` (association_summary/dues_collection/cpd_compliance/activity), `scope` (all_chapters or list of org IDs), `date_range_start`, `date_range_end`, `output_format` (pdf/csv), `created_at` | Immutable audit record of every export action. Never deleted. |

---

*Module 14: National Dashboard -- Memberry v3*
