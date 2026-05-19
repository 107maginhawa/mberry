---
# Module 3: Platform Administration

## Overview
- **Purpose:** Give the platform operations team (your company) full control over the multi-tenant platform: association provisioning, subscription billing, pricing management, feature flags, operator analytics, user impersonation for support, and team management. This module is the commercial backbone of the SaaS business.
- **Phase:** 1
- **Monetization tier:** Platform internal (not sold -- this is the operator's own tooling)
- **Dependencies:** M1 Auth & Onboarding (admin authentication required)

**Important:** This module is DESKTOP ONLY. Platform administration involves complex data tables, configuration matrices, analytics dashboards, and multi-step workflows that are not suited for mobile screens. No mobile layouts are specified.

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 3.1 | Association provisioning | Platform admin creates a new association (top-level tenant). Configures: name, country, locale (currency, date format, language), license format regex, credit cycle defaults (period, required credits, carryover policy). Each association gets fully isolated data. | Platform Admin (Super) | P0 |
| 3.2 | Organization provisioning | Platform admin creates organizations within an association. Sets: org name, org type (chapter/society/national/clinic), region. Assigns initial officer via email invitation. Sets trial period. Can also delegate org creation to association-level admins. | Platform Admin (Super) | P0 |
| 3.3 | Subscription billing management | Platform charges each association/org via the platform's own payment gateway (separate from org-level member payments). View subscription status, payment history, manage billing. Handle failed payments with retry logic and admin notification. Trial-to-paid conversion tracking. | Platform Admin (Super) | P0 |
| 3.4 | Pricing & plan management | Platform admin defines subscription tiers by member count brackets (e.g., 1-50, 51-200, 201-500). Each tier has: name, member range, monthly price, included modules, trial duration. Pricing changes apply to new subscriptions only; existing subs stay on current tier until renewal. | Platform Admin (Super) | P0 |
| 3.5 | Feature flag management | Module-level feature flags configurable per tier and per individual org. Matrix UI: modules (rows) x tiers (columns) with toggles. Per-org overrides for enabling/disabling specific modules regardless of tier. Changes take effect immediately. Warning when disabling a module that has active data in an org. | Platform Admin (Super) | P0 |
| 3.6 | Country/locale management | Configure per-country settings: currency, date format, language, regulatory requirements (license format regex, CPD rules). New countries added without code changes. Warning when modifying settings for a country with active associations. | Platform Admin (Super) | P0 |
| 3.7 | Actionable platform dashboard | Dashboard leads with ACTIONABLE items, not vanity metrics. Primary cards: new associations pending setup, active support tickets (with SLA countdown), payment failures requiring attention, feature flag rollout status, orgs with expiring trials. Secondary area: summary metrics (total associations, total orgs, total members, MRR). | Platform Admin (All roles) | P0 |
| 3.8 | Revenue dashboard | MRR, ARR, ARPU, LTV with trend charts. Revenue breakdown by association, country, plan tier. Churn metrics: churn rate, churned orgs list, reasons. Growth metrics: new orgs this month, net revenue growth, projected ARR. Exportable as CSV/PDF for accounting or investor reporting. | Platform Admin (Super, Analyst) | P0 |
| 3.9 | Operator analytics | Advanced analytics: association conversion funnel (trial to paid), feature adoption rates per module, churn signals (orgs with declining login activity, zero payments in 60+ days), support ticket volume and SLA compliance. Designed to inform platform team decisions. | Platform Admin (Super, Analyst) | P0 |
| 3.10 | Org health scoring | Automated health score (0-100) per org based on: member login rate, payment activity, event creation, feature adoption. At-risk orgs flagged: "200 members imported, only 5 logged in" or "No activity in 30 days." Drill-down to specific org with detailed breakdown. | Platform Admin (All roles) | P0 |
| 3.11 | User impersonation (support access) | Admin searches for a specific member or org, then clicks "View as this user." Platform shows exactly what that user sees. Visible orange banner at all times: "[Admin name] is viewing as [member name]." All navigation during impersonation is logged to the audit trail with the impersonator's admin ID. Impersonation is READ-ONLY -- no writes permitted. Session auto-terminates after 30 minutes. Exit button always visible in the banner. | Platform Admin (Super, Support) | P0 |
| 3.12 | Support ticket workflow | Inbox of tickets submitted by org officers. Sorted by priority and age. Ticket detail shows: officer message, org context, account details, activity history. Admin can respond (reply sent to officer), add internal notes, and change status (Open, In Progress, Resolved, Escalated). SLA tracking with auto-escalation alerts. | Platform Admin (Super, Support) | P0 |
| 3.13 | Multi-admin role management | Manage platform admin team. Three roles: Super Admin (full access), Support Admin (tickets + impersonation, read-only dashboards), Analyst (read-only dashboards and reports). Invite new admins via email. Edit or revoke access. Cannot remove the last Super Admin. All role changes logged. | Platform Admin (Super) | P0 |
| 3.14 | Platform-wide announcements | Compose and send announcements to all orgs or filtered audiences (by association, country). Types: Maintenance Window, New Feature, Policy Change, General. Delivery via in-app + email to all org officers. Schedule for future send or send immediately. Delivery stats: sent, delivered, opened. | Platform Admin (Super) | P0 |
| 3.15 | Org lifecycle management | State machine for org lifecycle: Trial, Active, Suspended, Cancelled. Trial to Active requires payment. Suspended: read-only for members/officers, data preserved. Cancelled: data preserved for 90 days, then eligible for deletion. Reactivation from Suspended or Cancelled (within 90 days) restores full access. All transitions logged. Officers notified of state changes. | Platform Admin (Super) | P0 |
| 3.16 | Member account merge | Identify and merge duplicate accounts (different emails, same license number -- or vice versa). Merge tool: select canonical record, preview what will be combined, execute merge. Duplicate deactivated. All history (payments, credits, activities) consolidated. Audit trail preserved. Affected member and org officers notified. | Platform Admin (Super) | P0 |
| 3.17 | Data breach notification (DPA 2012) | Breach reporting workflow. Breach form: scope, affected data, discovery date. Generates NPC (National Privacy Commission) notification draft. Triggers member notification for all affected users. Tracks breach response timeline (72-hour NPC notification requirement). | Platform Admin (Super) | P0 |
| 3.18 | Data export/deletion processing | Process DPA compliance requests from members. Data export: generate JSON/CSV package with PII encrypted. Deletion: enforce 30-day hold, then anonymize PII while retaining financial records for 7 years. Track request status and compliance deadlines. | Platform Admin (Super, Support) | P0 |

## User Journeys

### PA-1: Onboard a New Association
**Actor:** Platform Admin (Super)
**Trigger:** Business decision to onboard a new healthcare association (e.g., a new country or specialty group signs up)

**Steps:**
1. Admin opens /admin/associations and clicks "Create Association."
2. Form appears: association name, country (select from configured countries), currency (auto-populated from country, editable), locale settings.
3. Admin configures the license format regex with a test field ("Enter a sample license number to validate your pattern").
4. Admin sets credit cycle defaults: period (1/2/3 years), required credits per cycle, excess carryover policy (on/off).
5. Admin saves. Association is created with status "Active."
6. Admin can immediately provision organizations within the association (PA-2).

**Success outcome:** New association tenant is fully provisioned and ready for organizations.
**Error paths:**
- Duplicate association name: "An association with this name already exists."
- Invalid regex pattern: "The license format pattern is invalid. Check your regular expression syntax."
- Country not configured: "Configure country settings first." Link to /admin/locale.

---

### PA-2: Provision a New Organization
**Actor:** Platform Admin (Super)
**Trigger:** New org needs to be set up within an existing association

**Steps:**
1. Admin opens association detail (/admin/associations/[id]) and clicks "Add Organization."
2. Selects org type: chapter, society, national body, clinic.
3. Enters org details: name, region/location, contact info.
4. Assigns initial officer by entering their email address.
5. Sets trial period (start and end dates, or duration in days).
6. Saves. Organization is created with status "Trial."
7. Initial officer receives an invitation email with setup instructions.
8. Org appears on the association detail page with status "Trial" and a countdown to trial expiry.

**Success outcome:** Org is provisioned. Founding officer has been invited.
**Error paths:**
- Duplicate org name within association: "An organization with this name already exists in [Association]."
- Invalid officer email: Email format validation. If email bounces after send: logged, retry option available.
- Trial duration too short/long: Validation: minimum 7 days, maximum 180 days.

---

### PA-3: Manage Subscription (Trial to Paid)
**Actor:** Platform Admin (Super)
**Trigger:** Org trial approaching expiry, or admin proactively managing conversions

**Steps:**
1. Admin opens /admin/associations/[id] or the subscription dashboard.
2. Views list of orgs with trial expiry dates, sorted by soonest expiring.
3. For an approaching-expiry org: system has already sent automated reminders to the org officer (14, 7, 3 days before expiry).
4. If officer converts self-service: payment processed via platform gateway. Subscription active. Status changes to Active.
5. If trial expires without conversion: org enters read-only mode. Data preserved. Officer notified.
6. Admin can manually extend a trial: clicks "Extend Trial," enters new end date and reason. Extension logged in audit trail.

**Success outcome:** Org converts to paid subscription or trial is managed appropriately.
**Error paths:**
- Payment fails during self-service conversion: Retry with different payment method. Grace period (7 days) before read-only mode.
- Admin extends trial without reason: Reason field is required.

---

### PA-4: Monitor Platform Health (Dashboard)
**Actor:** Platform Admin (any role)
**Trigger:** Admin logs into /admin

**Steps:**
1. Dashboard loads with actionable items first:
   - "3 associations pending initial setup" (orgs created but wizard not started)
   - "5 active support tickets (2 approaching SLA)" (ticket count with urgency)
   - "2 payment failures this week" (failed subscription payments)
   - "Feature flag rollout: 'Documents' module at 60% of Standard tier orgs"
   - "4 orgs with trials expiring this week"
2. Below actionable items: summary metrics in a secondary row -- total associations, total orgs, total members, MRR.
3. Admin clicks any actionable card to navigate directly to the relevant management page.

**Success outcome:** Admin sees what needs attention right now and can act on it immediately.
**Error paths:**
- No actionable items: Dashboard shows "All clear -- no items requiring attention." with the summary metrics more prominent.
- Data loading error: Banner: "Some dashboard data could not be loaded. Refresh to try again."

---

### PA-5: Feature Flag Management
**Actor:** Platform Admin (Super)
**Trigger:** Need to enable/disable modules for specific tiers or individual orgs

**Steps:**
1. Admin opens /admin/feature-flags.
2. Matrix view: rows are modules (M1-M11), columns are subscription tiers (Free, Standard, Premium). Each cell is a toggle (on/off).
3. Admin toggles a module for a tier. Change takes effect immediately.
4. Below the matrix: "Org-Level Overrides" section. Admin searches for a specific org and can enable/disable any module regardless of their tier.
5. When disabling a module for an org that has active data (e.g., disabling Events for an org with 15 upcoming events), a warning dialog appears: "This org has 15 events in the Events module. Disabling will hide these from users. Data is preserved and will reappear if re-enabled."

**Success outcome:** Feature flags updated. Affected orgs see/hide modules immediately.
**Error paths:**
- Disabling Auth (M1): Blocked. "Auth & Onboarding cannot be disabled."
- Conflicting override: If an org-level override conflicts with a tier change, the override takes precedence. Admin is notified.

---

### PA-6: User Impersonation
**Actor:** Platform Admin (Super or Support)
**Trigger:** Support ticket requires seeing what a specific user sees to diagnose an issue

**Steps:**
1. Admin opens /admin/impersonate or searches for a user from any admin page.
2. Admin finds the specific member or org officer by name, email, or license number.
3. Admin clicks "View as [user name]."
4. Confirmation dialog: "You will see the platform exactly as [user name] sees it. All navigation will be logged. This session will auto-terminate after 30 minutes. No changes can be made."
5. Platform switches to the impersonated user's view. A persistent orange banner appears at the top of every page: "[Admin name] is viewing as [user name] -- [Org name]. Read-only. [Exit] [Time remaining: 29:45]"
6. Admin navigates the platform, seeing the user's dashboard, profile, payment history, etc.
7. Admin clicks "Exit" in the banner or the session auto-terminates after 30 minutes.
8. Platform returns to the admin view. Full navigation log is available in the audit trail.

**Success outcome:** Admin has diagnosed the user's issue by seeing exactly what they see.
**Error paths:**
- User not found: "No user found matching '[query]'. Check the spelling or try a different identifier."
- Impersonation of another admin: Blocked. "Cannot impersonate other platform administrators."
- 30-minute timeout: Banner shows countdown. At timeout: "Impersonation session expired. Returning to admin view." Auto-redirect to /admin.
- Attempting to write during impersonation: Action is blocked. Toast: "Changes cannot be made during impersonation. Exit to your admin account to take action."

---

### PA-7: Revenue Dashboard
**Actor:** Platform Admin (Super or Analyst)
**Trigger:** Admin opens /admin/analytics or navigates to revenue section

**Steps:**
1. Admin opens /admin/analytics. Revenue dashboard shows:
   - MRR (Monthly Recurring Revenue) with trend line (past 12 months)
   - ARR (Annual Recurring Revenue) projection
   - ARPU (Average Revenue Per User/Org)
   - LTV (Lifetime Value) estimate
2. Revenue breakdown: filterable by association, country, plan tier.
3. Churn metrics: monthly churn rate, list of churned orgs with last activity date and reason (if captured).
4. Growth metrics: new orgs this month, net revenue growth, projected ARR.
5. Admin can export any view as CSV or PDF.

**Success outcome:** Admin has a complete picture of revenue health and can identify trends.
**Error paths:**
- No revenue data yet: "No subscriptions active yet. Revenue data will appear once orgs convert from trial."
- Export fails: "Export could not be generated. Please try again."

---

### PA-8: Support Ticket Resolution
**Actor:** Platform Admin (Super or Support)
**Trigger:** Support ticket submitted by an org officer

**Steps:**
1. Admin opens /admin/support. Inbox shows tickets sorted by priority (high first) and age (oldest first within each priority level).
2. Admin opens a ticket. Ticket detail shows: officer message, org name and details, the officer's account info, recent activity log for the org.
3. Admin can:
   a. Reply to the officer (message sent via in-app + email).
   b. Add internal notes visible only to the admin team.
   c. Change status: Open, In Progress, Resolved, Escalated.
   d. Initiate impersonation to see the officer's view (PA-6).
4. Admin resolves the ticket with a final message.
5. SLA metrics tracked: response time, resolution time.

**Success outcome:** Ticket resolved. Officer notified.
**Error paths:**
- SLA breach approaching: Ticket card shows a red countdown. Auto-escalation alert sent to all Super Admins after SLA breach.
- Officer replies to a resolved ticket: Ticket re-opens automatically.

---

### PA-9: Org Health Assessment and Outreach
**Actor:** Platform Admin (Super or Support)
**Trigger:** Admin reviewing org health scores or responding to churn signals

**Steps:**
1. Admin opens /admin/analytics and selects "Org Health" view.
2. All orgs displayed with health scores (0-100), color-coded: green (70-100), amber (40-69), red (0-39).
3. Admin clicks a red-scored org to drill down. Detail shows: which modules are used, last officer login date, member login rate, payment activity, event creation frequency.
4. Admin takes action: sends personalized outreach email to the org's officers, schedules an onboarding call, extends trial, or flags for follow-up.
5. Outreach action is logged. A follow-up reminder can be set.

**Success outcome:** At-risk org receives proactive support before churning.
**Error paths:**
- Org has no activity at all: "This org has not completed onboarding. Consider reaching out to the founding officer." Contact info displayed.

---

### PA-10: Admin Team Management
**Actor:** Platform Admin (Super)
**Trigger:** Need to add, modify, or remove a platform admin

**Steps:**
1. Admin opens /admin/operators.
2. List of all platform admins with their roles and last active date.
3. To add: clicks "Invite Admin." Enters email, selects role (Super Admin, Support Admin, Analyst). Sends invitation.
4. New admin accepts invitation, creates account with MFA enrollment (mandatory for all platform admins).
5. To modify: clicks an admin's row. Can change role or revoke access. Changes take effect immediately.
6. To remove: clicks "Remove." Confirmation: "Are you sure? [Name] will lose all admin access immediately."
7. Cannot remove the last Super Admin. System blocks with: "Cannot remove the last Super Admin. Assign another Super Admin first."

**Success outcome:** Admin team is properly managed with appropriate access levels.
**Error paths:**
- Invite email bounces: "Invitation could not be delivered. Check the email address."
- Removing last Super Admin: Blocked with explanation.
- Admin removes themselves: Allowed (if other Super Admins exist). Immediate logout.

## Business Rules

This module references the following global business rules:

| Rule | Relevance to this module |
|------|--------------------------|
| BR-04 | Dues Amount per Org -- admin configures association-level dues and membership category defaults |
| BR-10 | Platform Admin Impersonation -- admin user impersonation is governed by BR-10; read-only, logged, and subject to the constraints defined therein |
| BR-30 | Payment Gateway Isolation -- platform billing uses a separate gateway from org-level member payment gateways; admin ensures platform never touches org member funds |

**Module-specific rules:**

| Code | Rule |
|------|------|
| M3-R1 | Impersonation must display a visible orange banner on every page: "[Admin name] is viewing as [user name]." Banner cannot be dismissed or hidden. |
| M3-R2 | All actions taken during impersonation are logged to the audit trail with both the impersonator's admin ID and the impersonated user's ID. |
| M3-R3 | Impersonation sessions auto-terminate after 30 minutes. No extension without re-initiating. |
| M3-R4 | Impersonation is strictly read-only. Any attempt to perform a write operation (create, update, delete) must be blocked at the API level, not just the UI level. |
| M3-R5 | Cannot impersonate another platform administrator. Blocked at the API level. |
| M3-R6 | The last Super Admin cannot be removed or downgraded. System must always have at least one Super Admin. |
| M3-R7 | All platform admins must have MFA enabled. MFA enrollment is mandatory during account setup and cannot be disabled. |
| M3-R8 | Pricing changes apply only to new subscriptions. Existing subscriptions remain on their current pricing until renewal. |
| M3-R9 | Feature flag changes take effect immediately. Disabling a module hides it from the org's UI but preserves all data. Re-enabling restores access to preserved data. |
| M3-R10 | Org lifecycle transitions follow a strict state machine: Trial can transition to Active or Cancelled. Active can transition to Suspended or Cancelled. Suspended can transition to Active or Cancelled. Cancelled data is preserved for 90 days before eligible for deletion. |
| M3-R11 | Data breach notification must be initiated within 72 hours of discovery per DPA 2012. The platform must track the timeline and alert if the 72-hour window is approaching. |
| M3-R12 | Support ticket SLA: first response within 4 hours (business hours). Resolution within 24 hours for high-priority, 72 hours for standard. Auto-escalation on breach. |
| M3-R13 | All admin actions are recorded in an immutable audit trail, including impersonation sessions, role changes, org state transitions, feature flag changes, and configuration updates. |

## UX Specification

### Screen Inventory

| Route | Page Name | Description | Desktop | Mobile |
|-------|----------|-------------|---------|--------|
| /admin | Platform Dashboard | Actionable items + summary metrics | Yes | No |
| /admin/associations | Association List | All associations with status and org count | Yes | No |
| /admin/associations/[id] | Association Detail | Orgs within association, config, billing | Yes | No |
| /admin/pricing | Pricing & Plans | Subscription tier configuration | Yes | No |
| /admin/feature-flags | Feature Flags | Module x tier matrix with per-org overrides | Yes | No |
| /admin/operators | Admin Team | Platform admin management | Yes | No |
| /admin/support | Support Inbox | Ticket list with SLA tracking | Yes | No |
| /admin/support/[id] | Ticket Detail | Individual ticket with conversation thread | Yes | No |
| /admin/analytics | Analytics Hub | Revenue, health, adoption dashboards | Yes | No |
| /admin/impersonate | Impersonate | User search + impersonation launch | Yes | No |

### Screen Details

#### Platform Dashboard (/admin)
**Route:** /admin
**Desktop layout:** Full-width page. Top section: row of 4-5 actionable item cards (each with a count, brief description, and a direct action link). Cards are sorted by urgency. Below: secondary metrics row showing total associations, total orgs, total members, MRR in compact stat cards. Below metrics: recent activity feed (last 10 significant platform events).
**Components:**
- Actionable card: "N associations pending setup" with "View" link to /admin/associations?status=pending
- Actionable card: "N support tickets (M approaching SLA)" with "View" link to /admin/support
- Actionable card: "N payment failures this week" with "View" link to /admin/associations?billing=failed
- Actionable card: "N trials expiring this week" with "View" link to /admin/associations?trial=expiring
- Actionable card: "Feature rollout: [module] at N% of [tier]" with "View" link to /admin/feature-flags
- Stat cards: Total associations (number + trend arrow), Total orgs, Total members, MRR (currency formatted)
- Activity feed: timestamped list of recent events (new org created, subscription converted, ticket resolved)
**States:**
- Loading: Skeleton cards
- All clear: "No items requiring attention right now." Stat cards and activity feed still visible.
- Error: Banner: "Dashboard data could not be loaded. Refresh to try again."
**Interactions:**
- Clicking any actionable card navigates to the relevant management page with appropriate filters pre-applied
- Stat cards are non-interactive (display only)
- Activity feed items link to their detail pages

#### Association List (/admin/associations)
**Route:** /admin/associations
**Desktop layout:** Full-width data table with search, filters, and "Create Association" button. Columns: name, country, org count, member count, status, MRR, created date. Row click navigates to detail.
**Components:**
- Search bar: search by association name
- Filters: country, status (Active/Suspended/Cancelled), date range
- Data table with sortable columns
- "Create Association" primary button (top right)
- Pagination (20 rows per page)
**States:**
- Loading: Table skeleton
- Empty: "No associations yet. Create your first association to get started."
- Error: "Could not load associations. Retry."
- Filtered with no results: "No associations match your filters. Try adjusting your search."
**Interactions:**
- Row click opens association detail
- Column headers are sortable (click to sort ascending, click again for descending)
- Bulk actions: none (associations are managed individually)

#### Association Detail (/admin/associations/[id])
**Route:** /admin/associations/[id]
**Desktop layout:** Header: association name, country flag, status badge, edit button. Tabs: Overview, Organizations, Billing, Configuration. Overview tab: summary stats (orgs, members, revenue). Organizations tab: org table within this association. Billing tab: subscription history. Configuration tab: license regex, credit cycle, locale settings.
**Components:**
- Header with association name, country, status pill
- Tab navigation: Overview | Organizations | Billing | Configuration
- Overview: stat cards (org count, member count, active rate, MRR)
- Organizations: data table (name, type, status, member count, trial expiry, health score). "Add Organization" button.
- Billing: payment history table, current plan, next billing date, payment method. "Extend Trial" button for trial orgs.
- Configuration: editable form for license regex (with test input), credit cycle settings, locale
**States:**
- Loading: Skeleton per tab
- Tab-specific empty states (e.g., no orgs yet, no billing history)
- Error: per-tab error messages

#### Pricing & Plans (/admin/pricing)
**Route:** /admin/pricing
**Desktop layout:** Table of subscription tiers. Each row: tier name, member count range (e.g., 1-50), monthly price, trial duration, included modules. Add/edit/delete tiers. Below: default free trial duration setting.
**Components:**
- Tier table: name, member range (from-to), monthly price (currency-aware), trial days, included modules (tags)
- "Add Tier" button
- Edit modal: name, member range, price, trial duration, module selection (checkboxes)
- Default trial duration input
- "Save Changes" button
**States:**
- Loading: Skeleton
- Empty: "No pricing tiers configured. Add your first tier."
- Validation error: Overlapping member ranges highlighted in red. "Member ranges cannot overlap."
**Interactions:**
- Editing a tier opens a modal form
- Deleting a tier with active subscribers: "This tier has N active subscriptions. They will be migrated to [next tier] at renewal."

#### Feature Flags (/admin/feature-flags)
**Route:** /admin/feature-flags
**Desktop layout:** Matrix table. Rows: modules (M1 Auth, M2 Profile, ... M11 Documents). Columns: subscription tiers (Free, Standard, Premium). Each cell: toggle switch. Below the matrix: "Org-Level Overrides" section with search and per-org module toggles.
**Components:**
- Matrix table with toggle switches per cell
- Module names in row headers with brief descriptions
- Tier names in column headers
- "Org Overrides" section: search bar to find an org, then a list of modules with toggle overrides
- Warning dialog when disabling a module with active data
**States:**
- Loading: Matrix skeleton
- Default: All toggles show current state (on/off)
- Warning: Modal when disabling a module: "This module has active data in N orgs. Data will be hidden but preserved."
**Interactions:**
- Toggle changes save immediately (optimistic update with server confirmation)
- Auth module (M1) toggle is disabled and always on
- Hover over a cell shows a tooltip: "Events module for Standard tier: currently ON for N orgs"

#### Support Inbox (/admin/support)
**Route:** /admin/support
**Desktop layout:** Two-panel layout. Left panel: ticket list with priority color coding, SLA countdown, subject, org name, status badge. Right panel: selected ticket detail with conversation thread, internal notes, and action buttons.
**Components:**
- Ticket list: priority indicator (color bar), subject line, org name, officer name, status pill, SLA timer (time remaining in green/amber/red), created date
- Filters: status (Open/In Progress/Resolved/Escalated), priority, date range
- Ticket detail: conversation thread (admin replies + officer messages), internal notes section (collapsible), action bar (Reply, Add Note, Change Status, Impersonate User)
- SLA metrics bar at top: avg response time, avg resolution time, open ticket count, SLA compliance rate
**States:**
- Loading: Skeleton
- Empty inbox: "No support tickets. Enjoy the quiet."
- Ticket selected: Detail panel populated
- SLA breach: Ticket card turns red. Timer shows "OVERDUE: [time past SLA]."
**Interactions:**
- Clicking a ticket in the left panel loads its detail in the right panel
- "Reply" opens a rich text editor inline
- "Impersonate" button launches impersonation (PA-6) in a new tab
- Status changes are instant with confirmation toast

#### Analytics Hub (/admin/analytics)
**Route:** /admin/analytics
**Desktop layout:** Tab navigation: Revenue | Adoption | Health | Churn. Each tab is a full dashboard with charts and tables. Global filters at top: date range, association, country.
**Components:**
- Revenue tab: MRR line chart, ARR projection, ARPU trend, revenue by association (bar chart), revenue by tier (pie chart), export buttons
- Adoption tab: module usage heatmap (orgs x modules, color intensity = usage level), feature adoption funnel, time-to-first-value metrics
- Health tab: org health score distribution (histogram), at-risk org list (table with scores, last activity, signals), drill-down per org
- Churn tab: monthly churn rate trend, churned org details (name, last activity, tenure, reason), churn cohort analysis
**States:**
- Loading: Chart skeletons
- No data: Per-tab empty messages (e.g., "Not enough data for churn analysis. Requires 3+ months of data.")
- Error: Per-chart error with individual retry
**Interactions:**
- Charts are interactive: hover for tooltips, click segments to filter
- Export buttons generate CSV or PDF per visible data
- "Health" tab at-risk orgs have an "Outreach" button that creates a draft email or a follow-up task

#### Impersonate (/admin/impersonate)
**Route:** /admin/impersonate
**Desktop layout:** Search-focused page. Large search bar at center: "Search for a member by name, email, or license number." Results appear below as a list. Each result shows: name, email, org memberships, role. "View As" button per result.
**Components:**
- Search bar (auto-complete, debounced 300ms)
- Result list: avatar, name, email, org membership badges, "View As" button
- Recent impersonation history: "Previously viewed" list for quick re-access
- Impersonation rules reminder: "Read-only. 30-minute limit. All actions logged."
**States:**
- Default: Search bar focused, recent history below
- Searching: Loading indicator in search bar
- Results: List of matching users
- No results: "No users found matching '[query]'."
- Impersonation active: Redirect to user's dashboard with orange banner
**Interactions:**
- "View As" triggers confirmation dialog, then redirects to the impersonated user's dashboard
- During impersonation, the orange banner is persistent and cannot be scrolled away (fixed position at top)

### Empty States

| Screen | Empty State | Message | Action |
|--------|------------|---------|--------|
| Dashboard -- Actionable Items | No items need attention | "All clear -- no items requiring attention right now." Summary metrics shown more prominently. | None |
| Association List | No associations | "No associations created yet. Start by creating your first association." | "Create Association" button |
| Association Detail -- Orgs | No orgs in association | "No organizations in this association yet. Add the first organization." | "Add Organization" button |
| Support Inbox | No tickets | "No support tickets. All quiet on the support front." | None |
| Analytics -- Revenue | No revenue data | "No subscription revenue yet. Revenue data will appear once organizations convert from trial to paid plans." | None |
| Analytics -- Health | No orgs to score | "Health scoring requires at least one active organization with imported members." | None |
| Feature Flags -- Overrides | No org overrides | "No per-organization overrides configured. Use the matrix above for tier-wide settings, or search for a specific org to add an override." | Search bar |

### Error States

| Scenario | UI Treatment |
|----------|-------------|
| Association provisioning fails | Form shows inline error. "Could not create association. [specific error]. Please try again." |
| Subscription payment retry fails | Billing tab shows: "Payment retry failed. Error: [gateway message]. Contact the org's payment provider or try a manual retry." |
| Feature flag toggle fails | Toggle reverts. Toast: "Could not update feature flag. Please try again." |
| Impersonation session dropped (network) | Orange banner changes to: "Impersonation session interrupted. Reconnecting..." Auto-retry for 10 seconds, then: "Session lost. Returning to admin view." |
| Export generation fails (analytics) | "Export failed. The data set may be too large. Try narrowing your date range or filters." |
| Ticket reply fails to send | Reply text preserved. Error: "Reply could not be sent. Check your connection and try again." |
| Breach notification timeline exceeded | Dashboard shows a red alert card: "DATA BREACH: NPC notification deadline approaching/exceeded. [time remaining/overdue]. Immediate action required." Links to breach workflow. |
| Org state transition blocked | Dialog: "Cannot transition [Org] from [current state] to [target state]. Reason: [e.g., outstanding balance of [amount]]." |

## Acceptance Criteria Patterns

**Given** a platform admin initiates user impersonation for a specific member,
**When** the impersonation session is active,
**Then** a visible orange banner reading "[Admin name] is viewing as [member name]" must appear on every page, all navigation must be logged with the admin's ID, no write operations must be permitted (blocked at API level), and the session must auto-terminate after exactly 30 minutes.

**Given** a platform admin disables a module via feature flags for a tier that includes orgs with active data,
**When** the toggle is switched off,
**Then** a warning dialog must show the count of affected orgs and their active records, the module UI must be hidden from those orgs immediately after confirmation, and all data must be preserved and accessible if the module is re-enabled.

**Given** the platform dashboard loads for a platform admin,
**When** there are pending setup tasks, active support tickets, payment failures, and expiring trials,
**Then** each actionable item appears as a card with a count, brief description, and direct link to the management page, sorted by urgency, and vanity metrics are displayed in a secondary row below.

**Given** a support ticket has been open for longer than the SLA threshold (4 hours for first response),
**When** the SLA is breached,
**Then** the ticket card turns red with an "OVERDUE" indicator, all Super Admins receive an auto-escalation notification, and the SLA compliance rate on the dashboard decreases.

**Given** the last remaining Super Admin attempts to remove or downgrade their own account,
**When** the action is confirmed,
**Then** the system blocks the action with the message "Cannot remove the last Super Admin. Assign another Super Admin first."

## Data Entities

| Entity | Description | Key Fields | Relationships |
|--------|-------------|------------|---------------|
| Association | Top-level tenant | id, name, country_code, currency, locale_settings (jsonb), license_format_regex, credit_cycle_period, credit_cycle_required, carryover_enabled, status, created_at, updated_at | Has many Organizations, has many SubscriptionPlans |
| Organization | Operational unit within an association | id, association_id, name, org_type (chapter/society/national/clinic), region, status (trial/active/suspended/cancelled), trial_start, trial_end, health_score, created_at, updated_at | Belongs to Association, has many MemberOrganizations, has one Subscription |
| Subscription | Org's platform subscription | id, org_id, plan_id, status (trial/active/past_due/cancelled), current_period_start, current_period_end, gateway_subscription_id, created_at | Belongs to Organization, belongs to PricingTier |
| PricingTier | Subscription plan definition | id, name, member_range_min, member_range_max, monthly_price_cents, trial_duration_days, included_modules (jsonb), created_at, updated_at | Has many Subscriptions |
| FeatureFlag | Module toggle per tier or per org | id, module_name, tier_id (nullable), org_id (nullable), enabled, created_at, updated_at | Belongs to PricingTier (optional), belongs to Organization (optional) |
| PlatformAdmin | Admin team member | id, member_id, role (super/support/analyst), invited_by, mfa_enforced, created_at, updated_at | Belongs to Member |
| SupportTicket | Officer-submitted support request | id, org_id, submitted_by, subject, status (open/in_progress/resolved/escalated), priority (high/standard), sla_response_due, sla_resolution_due, created_at, resolved_at | Belongs to Organization, has many TicketMessages |
| TicketMessage | Message in a support ticket thread | id, ticket_id, author_id, body, is_internal_note, created_at | Belongs to SupportTicket |
| ImpersonationLog | Record of admin impersonation sessions | id, admin_id, impersonated_member_id, started_at, ended_at, pages_visited (jsonb), termination_reason (manual/timeout) | References PlatformAdmin and Member |
| PlatformAnnouncement | Platform-wide announcement | id, author_id, title, body, type (maintenance/feature/policy/general), audience_filter (jsonb), scheduled_at, sent_at, delivery_stats (jsonb) | Belongs to PlatformAdmin |
| BreachReport | DPA breach tracking | id, reported_by, scope, affected_data_types, discovery_date, npc_notification_due, npc_notified_at, member_notification_sent_at, status, created_at | Belongs to PlatformAdmin |
