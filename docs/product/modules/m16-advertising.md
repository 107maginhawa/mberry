# Module 16: Advertising

**Version:** 3.0
**Updated:** 2026-04-21
**Phase:** 2/3 -- Professional Identity Platform / Network Effects
**Monetization Tier:** Add-on (advertiser revenue)
**Status:** Draft

---

## 1. Overview

### Purpose

Advertising gives pharmaceutical companies, medical device vendors, dental suppliers, and other B2B vendors targeting healthcare professionals a structured, platform-managed channel to reach verified professionals on Memberry. All advertising is centrally managed by platform admins, reviewed before publication, and delivered without exposing individual member data to advertisers. Revenue from advertising flows to Memberry as a platform business.

### Why This Module Exists

Healthcare professionals are a highly targeted, hard-to-reach audience for B2B vendors. Pharmaceutical companies, dental suppliers, medical device distributors, and continuing education providers spend significant budget trying to reach doctors, dentists, and nurses through general advertising channels, medical journal placements, and conference sponsorships -- all of which have high costs and uncertain targeting.

Memberry has a verified, professional, specialty-identified audience segmented by association membership and geography. This makes it uniquely valuable for B2B healthcare advertisers who want to reach, for example, "dentists in Metro Manila" or "nurses in the Visayas" with verified certainty that those individuals are licensed, active healthcare professionals. The platform can monetize this audience value while maintaining strict member privacy controls: advertisers buy access to reach a segment, not access to individual member data.

At the same time, associations benefit from having their professional communications environment remain clean and trusted. All advertising content is reviewed and approved by platform admins before appearing to members. Sponsorship labels are mandatory and non-removable. Members who find advertising intrusive have controls to manage their experience.

### Revenue Model

Advertising revenue flows to Memberry, not to individual associations. Associations may negotiate a revenue-share arrangement with Memberry through their association contract, but this is a commercial agreement between the association and Memberry -- not a platform configuration managed within this module.

### Dependencies

| Module | Relationship |
|--------|-------------|
| **M05: Membership** | Member specialty, location, membership category, and association membership are used for ad targeting. Targeting is segment-based -- individual member data is never shared with advertisers. |
| **M13: Professional Feed** | Sponsored content posts appear inline in the Professional Feed. M13 provides the feed delivery surface; M16 manages the ad inventory, creative review, targeting configuration, and performance analytics. |

---

## 2. Capabilities

### Advertiser Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 16.1 | Advertiser registration and approval | Organizations wishing to advertise submit an application: company name, type (pharmaceutical, medical device, dental supplier, education provider, other B2B vendor), contact person, billing information, and a brief description of products or services. Platform admin reviews and approves or rejects the application. Rejected applicants receive a reason. Approved advertisers receive account credentials to manage campaigns. | Platform Admin, Advertiser | P1 |
| 16.2 | Campaign creation | Approved advertisers create campaigns. Each campaign specifies: campaign name, ad format, targeting parameters, date range, budget, and one or more creative assets. The campaign cannot go live until creative is approved by a platform admin. | Advertiser | P1 |
| 16.3 | Creative submission and revision | Advertisers upload ad creative per the specifications for the chosen format. Creative is submitted for platform admin review. Campaigns cannot run until creative is approved. If creative is rejected, the advertiser receives the rejection reason and can resubmit revised creative. | Advertiser, Platform Admin | P1 |
| 16.4 | Campaign performance analytics | Advertisers see performance data for their campaigns: impressions, click-through rate (if the ad includes a link), and estimated reach (total member count in the targeted segment). No PII is shared -- reach is reported as a count, not individual identities. Advertisers cannot see which specific members viewed or clicked their ads. | Advertiser | P1 |
| 16.5 | Campaign management | Advertisers can pause a live campaign (stops delivery immediately), extend a campaign's end date (subject to slot availability), or cancel a campaign before it starts. | Advertiser | P1 |

### Ad Formats

| # | Format | Description | Placement | Priority |
|---|--------|-------------|-----------|----------|
| 16.6 | Banner ads | Display banner at the top of the feed or in the sidebar (desktop). Standard image dimensions with optional link. | Professional Feed (M13) | P1 |
| 16.7 | Sponsored content posts | A post that appears inline in the Professional Feed, visually consistent with organic posts but clearly labeled "Sponsored." Supports headline, body text, image, and a call-to-action link. | Professional Feed (M13) | P1 |
| 16.8 | Directory listing highlights | A vendor's listing in the M17 Marketplace is highlighted (colored border, "Featured" badge, positioned at the top of search results). | Marketplace (M17, when available) | P2 |

### Targeting

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 16.9 | Segment-based targeting | Advertisers define their target audience using structural membership attributes: association (which professional network), specialty, membership category, and geography (province and/or city). Targeting is always segment-based. The platform never uses individual member behavior (what posts they read, which events they attended, how often they visit) for advertising targeting. | Advertiser, Platform Admin | P0 |
| 16.10 | Estimated reach | When an advertiser configures targeting parameters during campaign creation, the system shows the estimated reach: the total member count matching those parameters. This is a count only -- no member names, emails, or profiles are revealed. | Advertiser | P1 |

### Ad Inventory and Pricing

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 16.11 | Ad slot configuration | Platform admin configures available ad slots per placement: which associations or all associations, slot type (banner top, banner sidebar, sponsored feed post, directory highlight), maximum concurrent campaigns per slot, and pricing. | Platform Admin | P1 |
| 16.12 | Pricing models | Each ad slot is priced using either CPM (cost per 1,000 impressions) or a flat monthly rate. The pricing model and rate are configured per slot by the platform admin. Different slots can use different pricing models. | Platform Admin | P1 |
| 16.13 | Slot booking | Advertisers book an available slot for a date range as part of campaign creation. If the slot's maximum concurrent campaigns is reached for a given date range, no additional campaigns can book that slot during the overlap. | Advertiser, System | P1 |

### Platform Admin Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 16.14 | Creative review | Platform admin reviews all ad creative before it goes live. Review criteria: accurate representation, no false or misleading medical claims, appropriate for a professional healthcare audience, no competitor disparagement, compliant with relevant Philippine regulations (FDA advertising rules for pharmaceutical products). Admin can approve, reject with reason, or request revision. | Platform Admin | P1 |
| 16.15 | Advertiser management | Platform admin views all advertiser accounts, their status (pending, approved, suspended), campaign history, and payment history. Admin can suspend an advertiser account, which immediately pauses all active campaigns. | Platform Admin | P1 |
| 16.16 | Revenue overview | Platform admin sees aggregate advertising revenue: total billed, total paid, total outstanding, broken down by advertiser, by association, and by time period. This is Memberry internal data -- not exposed to associations or advertisers. | Platform Admin | P1 |
| 16.17 | Slot scheduling | Platform admin views a calendar or timeline of slot bookings across all placements, identifies availability gaps, and can manually block slots (e.g., reserving a slot for a platform promotional message or an association-sponsored announcement). | Platform Admin | P2 |

### Member Experience

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 16.18 | Sponsored content visibility | Members see approved ads in the Professional Feed (inline sponsored posts, top-of-feed banners), in the sidebar on desktop, or as highlighted listings in the Marketplace. All ads are clearly labeled "Sponsored" at all times per M13 capability 13.11. The "Sponsored" label is rendered by the platform and cannot be altered, hidden, or removed by the advertiser. | Member | P1 |
| 16.19 | Ad opt-out preference | Members can opt out of targeted advertising in their profile settings. Opted-out members see generic, non-targeted ads (or no ads in that slot, depending on availability) rather than ads targeted to their specialty or location. Opting out does not guarantee an ad-free experience -- it guarantees that the member's specialty and geography are not used to select which ads they see. | Member | P2 |
| 16.20 | Ad reporting | Members can report an individual ad as inappropriate, misleading, or irrelevant via a menu on the ad card. Reports are sent to the platform admin for review. Three reports for the same creative within 7 days trigger an automatic pause of that creative and a mandatory platform admin review. | Member | P2 |

---

## 3. User Journeys

### Journey 16A: Advertiser Registers, Creates a Campaign, and Reviews Performance

**Persona:** Marketing Manager, DentalSupply Co. (dental equipment distributor)
**Trigger:** Wants to promote a new dental chair to dentists in Metro Manila and Cebu.

1. Marketing Manager visits the Memberry advertiser registration page and submits: company name (DentalSupply Co.), type (dental supplier), contact name and email, billing details, description of products.
2. Platform admin reviews the application. DentalSupply Co. is a legitimate dental equipment distributor. Admin approves.
3. Marketing Manager logs in to the advertiser portal.
4. Creates a new campaign:
   - Campaign name: "DentaChair Pro Launch -- Q2 2026"
   - Ad format: Sponsored Feed Post
   - Targeting: Association = PDA, Specialty = "General Dentistry, Prosthodontics, Orthodontics", Geography = "Metro Manila, Cebu"
   - Date range: May 1 -- June 30, 2026
   - Estimated reach shown: "Approximately 1,400 members match these criteria"
   - Pricing: flat monthly rate PHP 20,000/month for this sponsored feed slot x 2 months = PHP 40,000
5. Uploads creative: product image (1200x628px), headline "Introducing DentaChair Pro -- Lighter. Quieter. Yours.", body text (150 characters describing key features), CTA button "Learn More" linking to the product page.
6. Submits for review. Campaign status: "Pending Admin Review."
7. Three weeks after launch, Marketing Manager checks the campaign dashboard: 18,500 impressions, 3.2% CTR, estimated unique reach of 1,180 members. No individual member identities are visible.
8. Downloads a performance summary PDF for the regional sales team.

### Journey 16B: Platform Admin Reviews and Approves Creative

**Persona:** Memberry Platform Admin
**Trigger:** New creative submission from DentalSupply Co. in the review queue.

1. Platform admin navigates to `/admin/advertising` -- sees "1 creative pending review" in the dashboard alerts.
2. Opens the campaign detail: `/admin/advertising/campaigns/[id]`.
3. Reviews the creative against the checklist:
   - No misleading medical claims (product specifications are verifiable).
   - Appropriate for a professional audience (tone is professional, imagery shows the product in a clinical setting).
   - No pharmaceutical claims requiring FDA review (this is dental equipment, not a drug).
   - "Sponsored" label renders correctly in the preview.
4. Approves the creative.
5. Campaign status updates to "Scheduled -- starts May 1, 2026."
6. On May 1, the campaign goes live. The sponsored post begins appearing in the PDA Professional Feed for members matching the targeting criteria.

### Journey 16C: Platform Admin Configures Ad Slots for a New Association

**Persona:** Memberry Platform Admin
**Trigger:** PNA (Philippine Nurses Association) has onboarded with 2,000+ members. Platform admin wants to enable advertising for the PNA network.

1. Platform admin navigates to `/admin/advertising/placements`.
2. Clicks "New Placement" -- a modal/drawer opens within the placements page.
3. Creates two placements:
   - "PNA Feed Banner -- Top of Feed": Association = PNA, Format = Banner (top of feed), Pricing = CPM at PHP 180, Max concurrent campaigns = 1.
   - "PNA Sponsored Feed Post": Association = PNA, Format = Sponsored Feed Post, Pricing = Flat monthly rate PHP 15,000, Max concurrent campaigns = 2.
4. Saves both placements. They are now available for advertisers to book.
5. Views the placement list at `/admin/advertising/placements` -- sees the two new PNA slots alongside existing PDA slots.

### Journey 16D: Platform Admin Handles a Flagged Ad

**Persona:** Memberry Platform Admin
**Trigger:** Automated alert -- a creative has been reported 3 times within 7 days.

1. Platform admin receives a notification: "Ad auto-paused: 'VitaBoost Supplements -- Proven to Cure Fatigue' has received 3 member reports in 5 days."
2. Navigates to `/admin/advertising/campaigns/[id]`.
3. Campaign status shows "Auto-Paused (Member Reports)."
4. Reviews the reports: all three members flagged the ad as "Misleading or false claim." One member commented: "The claim 'proven to cure fatigue' is unsubstantiated."
5. Platform admin reviews the creative. The claim is indeed misleading -- supplements cannot claim to "cure" anything under Philippine FDA rules.
6. Rejects the creative with reason: "The claim 'proven to cure fatigue' is not permitted under FDA advertising rules. Please revise to remove cure claims."
7. The advertiser is notified. Campaign remains paused until revised creative is submitted and approved.

### Journey 16E: Member Encounters a Sponsored Post and Reports It

**Persona:** Dr. Garcia (Active Member, PDA Metro Manila, dentist)
**Trigger:** Sees a sponsored post in her Professional Feed that appears misleading.

1. Dr. Garcia scrolls her feed and sees a post with a "Sponsored" label on an amber background: "VitaBoost Supplements -- Proven to Cure Fatigue."
2. She recognizes the claim as dubious. Taps the three-dot menu on the post.
3. Selects "Report this ad."
4. Selects reason: "Misleading or false claim." Adds an optional comment: "Supplements cannot claim to cure fatigue. This is misleading."
5. Confirmation: "Thank you for your report. Our team will review this ad."
6. Her report is logged. She was the third member to report this creative within 7 days, which triggers the automatic pause (Journey 16D).

### Journey 16F: Member Opts Out of Targeted Advertising

**Persona:** Dr. Cruz (Active Member, PNA Visayas, nurse)
**Trigger:** Prefers not to see specialty-targeted ads.

1. Dr. Cruz navigates to Settings > Privacy > Advertising Preferences.
2. Sees a toggle: "Opt out of targeted advertising." Currently off (targeted ads are enabled).
3. Turns the toggle on.
4. Reads the explanation: "You will no longer see ads targeted to your specialty or location. You may still see generic advertisements."
5. Confirms. Her specialty (Nursing) and geography (Visayas) are no longer used when the system selects which ads to show her.
6. In her feed, she continues to see ads (if any non-targeted ads are running) with "Sponsored" labels, but they are not selected based on her professional profile.

---

## 4. Business Rules

There are no numbered business rules specific to advertising in the current PRD. Advertising operations are governed by the following platform-level principles:

**Creative review is mandatory.** No advertiser can publish ad creative directly to members. Every creative asset -- including revisions to running campaigns -- requires platform admin review and approval before going live. There is no auto-approval path for advertisers.

**Sponsored content is always labeled.** Every ad impression -- banner, sponsored post, or directory highlight -- displays a "Sponsored" label. The label is rendered by the platform, not by the advertiser's creative asset. It cannot be hidden, removed, restyled, or obscured. This applies to all ad formats, all placements, all devices.

**No individual member data shared with advertisers.** Targeting is defined by segment parameters (association, specialty, membership category, geography). Advertisers see reach as an estimated member count before booking and as a unique member count in performance analytics. No individual member names, contact information, license numbers, or profile data are accessible to advertisers through any screen, API, or export.

**No behavioral tracking for targeting.** The platform does not track individual member behavior (which posts they read, which events they attend, how long they spend on any screen) for advertising targeting purposes. Targeting uses only structural membership attributes: association, specialty, membership category, and geography.

**Member ad feedback triggers review.** Three member reports for the same creative asset within a rolling 7-day window automatically pause that creative and trigger a mandatory platform admin review. The advertiser is notified that their creative has been paused and the reason. The campaign cannot resume until the creative is re-approved or replaced.

**Revenue to Memberry.** All advertising revenue is invoiced and collected by Memberry. No portion of advertising revenue flows through the platform to associations unless a revenue-share arrangement exists in the association's contract with Memberry. Revenue-share is a commercial arrangement external to this module.

---

## 5. UX Specification

### Screen Inventory

| Screen | Route | Persona | Device |
|--------|-------|---------|--------|
| Advertising Dashboard | `/admin/advertising` | Platform Admin | Desktop-primary |
| Advertiser List and Approvals | `/admin/advertising/advertisers` | Platform Admin | Desktop-primary |
| Advertiser Detail | `/admin/advertising/advertisers/[id]` | Platform Admin | Desktop-primary |
| Placement Configuration | `/admin/advertising/placements` | Platform Admin | Desktop-primary |
| All Campaigns | `/admin/advertising/campaigns` | Platform Admin | Desktop-primary |
| Campaign Detail | `/admin/advertising/campaigns/[id]` | Platform Admin, Advertiser | Desktop-primary |
| Aggregate Analytics | `/admin/advertising/analytics` | Platform Admin | Desktop-primary |

> **Note on New Placement:** Creating a new placement is a modal/drawer within `/admin/advertising/placements`, not a separate standalone page. There is no distinct `/admin/advertising/placements/new` route.

Note: Advertiser-facing screens (campaign creation, performance dashboard) reuse the campaign routes with access scoped to the advertiser's own campaigns. Advertisers see only their own data; platform admins see all data across all advertisers.

### Screen Details

#### Advertising Dashboard (`/admin/advertising`)

**Layout:** Summary cards at top, alerts panel, active campaigns table below.

**Summary cards (row of 5):**
- Active Campaigns (count).
- Pending Creative Review (count, highlighted amber if >0).
- Pending Advertiser Approvals (count, highlighted amber if >0).
- Total Impressions Delivered (current month).
- Revenue This Month (total billed, current calendar month).

**Alerts panel ("Needs Attention"):**
- Advertiser applications awaiting approval (up to 5 shown, "View All" link).
- Creatives pending review (up to 5 shown, "View All" link).
- Auto-paused campaigns requiring review (up to 5 shown, "View All" link).

**Active campaigns table:**
- Columns: Campaign Name (linked), Advertiser, Association, Format, Date Range, Impressions (delivered vs. cap or budget), Status.
- Sortable by any column.
- Tap row to navigate to campaign detail.

**Actions:**
- "New Placement" button (top area).

#### Advertiser List and Approvals (`/admin/advertising/advertisers`)

**Layout:** Full-width table with search and status filter.

**Columns:**
- Company Name (linked to advertiser detail).
- Type (pharma, device, supplier, education, other).
- Status badge: Pending (amber), Approved (green), Suspended (red).
- Active Campaigns (count).
- Total Spend (lifetime).
- Application Date.

**Filters:**
- Status: All, Pending, Approved, Suspended.
- Search by company name.

**Pending section:** If any advertisers are pending approval, they appear in a highlighted section at the top of the list with "Review" buttons.

#### Advertiser Detail (`/admin/advertising/advertisers/[id]`)

**Layout:** Profile section at top, tabbed sections below.

**Profile section:**
- Company name, type, status badge.
- Contact name, email, phone.
- Registration date, approval date and approving admin (if approved).
- Account actions: "Approve" (if pending), "Suspend" (if approved, with reason field), "Reinstate" (if suspended).
- Suspension effect: all active campaigns for this advertiser are immediately paused.

**Campaigns tab:**
- Table of all campaigns: name, format, association, date range, status, impressions, spend.

**Payment history tab:**
- Invoice list: invoice number, period, amount, status (paid, outstanding, overdue).

#### Placement Configuration (`/admin/advertising/placements`)

**Layout:** Table of all configured ad placements.

**Columns:**
- Placement Name.
- Association (or "All Associations").
- Format (banner top of feed, banner sidebar, sponsored feed post, directory listing highlight).
- Pricing Model (CPM or flat monthly).
- Rate (PHP amount).
- Max Concurrent Campaigns.
- Active Campaigns (current count vs. max).
- Status (active, paused).

**Actions:**
- "New Placement" button.
- Per row: "Edit" (opens edit form), "Pause" / "Activate" toggle.

#### New Placement (modal/drawer within `/admin/advertising/placements`)

> **Note:** Creating a new placement is a modal or drawer opened from the "New Placement" button on `/admin/advertising/placements`. It is not a separate page.

**Layout:** Single-column form within modal/drawer.

**Fields:**
- Placement name (text input).
- Association (dropdown: select one association or "All Associations").
- Format (radio: Banner -- Top of Feed, Banner -- Sidebar, Sponsored Feed Post, Directory Listing Highlight).
- Pricing model (radio: CPM or Flat Monthly Rate).
- Rate (numeric input, PHP).
- Maximum concurrent campaigns (numeric input, default 1).
- Impression cap per campaign (numeric input, required if pricing model is CPM, hidden if flat monthly).
- Status (toggle: Active / Paused).

**Validation:**
- Placement name required, unique within the association.
- Rate must be greater than zero.
- Max concurrent campaigns must be at least 1.
- Impression cap required for CPM pricing.

**Actions:**
- "Save Placement" (primary).
- "Cancel" (secondary).

#### All Campaigns (`/admin/advertising/campaigns`)

**Layout:** Full-width table with filters.

**Columns:**
- Campaign Name (linked to campaign detail).
- Advertiser.
- Association.
- Format.
- Date Range.
- Status (Draft, Pending Creative, Pending Review, Scheduled, Live, Paused, Auto-Paused, Completed, Cancelled).
- Impressions (delivered / cap or budget).

**Filters:**
- Status dropdown.
- Association dropdown.
- Advertiser search.
- Date range (campaigns active during a given period).

#### Campaign Detail (`/admin/advertising/campaigns/[id]`)

**Layout:** Header with campaign metadata, then sections for targeting, creative, and analytics.

**Header:**
- Campaign name, advertiser name, association, format.
- Date range (start and end dates).
- Status badge with status change log (timestamps for each transition).
- Pricing: model, rate, total budget, spend to date.

**Targeting section:**
- Association(s) targeted.
- Specialties (list or "All").
- Membership categories (list or "All").
- Geography: provinces and/or cities (list or "All").
- Estimated reach at time of booking (member count).

**Creative section:**
- Preview of the ad as members will see it, including the mandatory "Sponsored" label.
- Current creative status (Pending Review, Approved, Rejected, Revision Requested).
- Review history: who reviewed, when, outcome, rejection reason if applicable.
- Admin actions: "Approve Creative," "Reject Creative" (reason field required), "Request Revision."
- For advertisers: "Upload Revised Creative" button (visible when current creative is rejected or revision requested).

**Analytics section (visible once campaign has delivered impressions):**
- Impressions delivered: total and daily line chart.
- Clicks (if ad includes a link): total clicks, CTR.
- Estimated unique reach (member count, never individual identities).
- Delivery pace: impressions per day vs. required pace to complete before the end date.

**Admin actions (campaign-level):**
- "Pause Campaign": stops delivery immediately.
- "Resume Campaign": restarts a paused campaign.
- "Cancel Campaign": permanently terminates. Used for advertiser non-payment or policy violations.

#### Aggregate Analytics (`/admin/advertising/analytics`)

**Layout:** Date range selector at top, summary metrics, breakdown tables and charts.

**Date range selector:** Current month (default), last 30/60/90 days, or custom date range.

**Summary metrics (row of 5):**
- Total Impressions Delivered (selected period).
- Total Clicks (selected period).
- Average CTR Across All Campaigns.
- Total Unique Estimated Reach (member count, deduplicated across campaigns).
- Total Revenue Billed (selected period).

**Breakdown tables:**
- By association: impressions, clicks, CTR, revenue.
- By ad format: impressions, clicks, CTR, revenue.
- By advertiser: impressions, clicks, CTR, revenue, active campaign count.

**Charts:**
- Impressions per day (line chart, selected period).
- Revenue per month (bar chart, last 12 months).

**Export:** "Export" button downloads a CSV of all campaign performance data for the selected period. Contains only aggregate data -- no individual member identifiers.

### States

| State | Trigger | UI Behavior |
|-------|---------|-------------|
| **Loading** | Any admin screen opens | Skeleton cards and table row placeholders. |
| **Pending creative review** | Advertiser submits creative | Campaign status: "Pending Review." Admin dashboard badge count increments. |
| **Creative approved** | Admin approves creative | Campaign status updates to "Scheduled" (if start date is in the future) or "Live" (if start date is today or past). Advertiser receives email confirmation. |
| **Creative rejected** | Admin rejects with reason | Campaign status: "Pending Creative Revision." Advertiser receives notification with the rejection reason. "Upload Revised Creative" prompt appears. |
| **Campaign live** | Start date reached and creative approved | Ads begin appearing to targeted members. Impression count starts incrementing. |
| **Campaign paused** | Admin or advertiser pauses | Ad delivery stops immediately. Campaign status: "Paused." Members no longer see the ad. |
| **Campaign auto-paused** | 3 member reports for same creative within 7 days | Campaign auto-pauses. Admin notified. Campaign detail shows: "Auto-paused due to member reports. Review required." |
| **Campaign completed** | End date reached or impression cap hit (CPM) | Campaign status: "Completed." No further delivery. Final analytics remain accessible. |
| **Advertiser suspended** | Admin suspends advertiser | All active campaigns for that advertiser are immediately paused. Status on each campaign: "Paused -- Advertiser Suspended." |
| **No placements configured** | Admin opens advertising module before any slots exist | Guidance message: "No ad placements have been configured. Set up your first placement to enable advertisers to book campaigns." |
| **No active campaigns** | No live campaigns exist | Feed shows no sponsored content. Ad slots remain empty -- no placeholder content shown to members. |

---

## 6. Acceptance Criteria Patterns

- No advertiser campaign delivers impressions without platform admin creative review and explicit approval.
- Every ad impression displayed to members includes a mandatory "Sponsored" label rendered by the platform, not by the advertiser's creative asset.
- Advertiser campaign analytics never include individual member names, contact information, license numbers, or any personally identifying information. Reach is reported as a count only.
- Targeting is restricted to structural membership attributes (association, specialty, membership category, geography). No behavioral data from member activity is used for targeting.
- Member ad opt-out preference, when enabled, excludes that member's specialty and location from targeted ad selection. Opted-out members may still see non-targeted ads.
- Three member reports for the same creative within a rolling 7-day window automatically pause the creative and generate a platform admin alert. The campaign cannot resume until the creative is re-approved or replaced.
- Advertiser suspension immediately pauses all active campaigns for that advertiser. No further impressions are delivered after suspension.
- Ad slot configuration (placement type, pricing, scheduling) is accessible only to platform admins. Advertisers cannot view or modify slot configuration.
- Platform admin aggregate analytics consolidate data across all advertisers and associations. An advertiser's performance dashboard shows only their own campaigns.
- Campaign performance analytics update within 15 minutes of impression delivery.
- CPM-priced campaigns stop delivering once the impression cap is reached. Flat-rate campaigns deliver throughout the booked date range.
- Pricing (CPM rate or flat monthly rate) is configured per ad slot by the platform admin. Advertisers see the price during campaign creation but cannot modify it.

---

## 7. Data Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **Advertiser** | `id`, `company_name`, `company_type` (pharma/device/supplier/education/other), `contact_name`, `contact_email`, `contact_phone`, `billing_details` (encrypted), `status` (pending/approved/suspended), `approved_by`, `approved_at`, `suspended_at`, `suspension_reason`, `created_at` | Root record for an advertising organization. Suspension cascades to all campaigns. |
| **Ad Placement** | `id`, `name`, `association_id` (nullable -- null means all associations), `format` (banner_top/banner_sidebar/sponsored_feed_post/directory_highlight), `pricing_model` (cpm/flat_monthly), `rate_php`, `max_concurrent_campaigns`, `impression_cap_per_campaign` (nullable, required for CPM pricing), `status` (active/paused), `created_by`, `created_at`, `updated_at` | Defines available ad inventory. Managed exclusively by platform admins. |
| **Ad Campaign** | `id`, `advertiser_id`, `placement_id`, `association_id`, `name`, `target_specialties` (array, nullable), `target_membership_categories` (array, nullable), `target_provinces` (array, nullable), `target_cities` (array, nullable), `start_date`, `end_date`, `status` (draft/pending_creative/pending_review/scheduled/live/paused/auto_paused/completed/cancelled), `total_budget_php`, `spend_to_date_php`, `estimated_reach_count`, `created_at`, `updated_at` | One campaign per advertiser booking per placement. Targeting parameters define which member segments receive the ad. |
| **Ad Creative** | `id`, `campaign_id`, `format`, `headline` (nullable), `body_text` (nullable), `image_url` (nullable), `link_url` (nullable), `review_status` (pending/approved/rejected/revision_requested), `reviewed_by`, `reviewed_at`, `rejection_reason` (nullable), `version` (integer, increments on revision), `is_current` (boolean), `created_at` | Multiple creative versions per campaign (revisions). Only one `is_current = true` at any time. Campaign activation requires an approved current creative. |
| **Ad Impression** | `id`, `campaign_id`, `creative_id`, `placement_id`, `association_id`, `targeting_segment_hash` (anonymized segment identifier for aggregate reporting), `impression_timestamp`, `was_clicked` (boolean), `clicked_at` (nullable) | One row per ad impression. No member ID is stored -- member identity is never recorded against an impression. The segment hash enables analytics aggregation without individual tracking. |
| **Member Ad Preference** | `id`, `member_id`, `opted_out_of_targeted_ads` (boolean), `opted_out_at` (nullable), `opted_back_in_at` (nullable) | When `opted_out_of_targeted_ads` is true, the member's structural attributes are excluded from targeting queries. |
| **Ad Report** | `id`, `campaign_id`, `creative_id`, `reported_by_member_id`, `reason` (misleading/inappropriate/irrelevant/other), `comment` (nullable), `created_at`, `auto_pause_triggered` (boolean) | Member-submitted ad feedback. The third report for the same `creative_id` within 7 days sets `auto_pause_triggered = true` and pauses the campaign. |

---

*Module 16: Advertising -- Memberry v3*
