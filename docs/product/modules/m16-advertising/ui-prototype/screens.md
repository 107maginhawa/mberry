<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Screens: Advertising (M16)

## Blueprint Purpose

This UI Blueprint provides comprehensive UI specification for the Advertising module.

Based on:
- Module Spec: docs/product/modules/m16-advertising/MODULE_SPEC.md
- Domain Glossary: docs/product/DOMAIN_GLOSSARY.md
- Role Permission Matrix: docs/product/ROLE_PERMISSION_MATRIX.md
- API Contracts: docs/product/modules/m16-advertising/API_CONTRACTS.md

**This blueprint is not the source of product truth.** Final implementation must follow the PRD, module spec, slice spec, test plan, and architecture.

---

## Screen: Advertising Dashboard

**Purpose:** Campaign management and performance overview
**Route:** `/admin/advertising`
**Primary Users/Roles:** Platform Admin (super, admin)
**Related Workflow:** WF-096 (Advertising Dashboard), WF-092 (Campaign Creation)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Advertising Dashboard

### ARIA Landmark Structure

```
<header role="banner">              -- app header, "Advertising" title
<nav role="navigation">             -- admin nav, advertising sub-tabs (Campaigns, Creatives, Advertisers)
<main role="main">
  <section aria-label="Campaign filters">      -- status filter, advertiser filter
  <section aria-label="Campaign list">         -- campaign table
  <aside role="complementary">                 -- create campaign CTA, advertiser management link
<footer role="contentinfo">         -- pagination, summary metrics
```

### Focus Management

- **Initial focus on load:** Status filter or first table row
- **Focus after create action:** New campaign in table (highlighted)
- **Focus after status change:** Updated row in table
- **Focus trap:** None (standard page)
- **Skip link:** "Skip to campaign list"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Campaign name | Yes | data[].name | Table column, clickable link to detail |
| Advertiser name | Yes | data[].advertiserName | Table column |
| Status | Yes | data[].status | Badge: draft, pending_review, active, paused, completed, rejected |
| Budget | Yes | data[].budgetCents | Formatted as currency (cents to PHP) |
| Spent | Yes | data[].spentCents | Formatted as currency |
| Impressions | Yes | data[].impressions | Number format |
| Clicks | Yes | data[].clicks | Number format |
| CTR | Yes | data[].ctr | Percentage format |
| Ad slot | Yes | data[].adSlot | Badge: feed_banner, sidebar, email_footer, event_sponsor |
| Schedule | No | data[].startsAt / data[].endsAt | Date range display |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Create campaign | Navigate to campaign creation flow | Platform admin only | -- |
| Filter by status | Filter campaign table by status enum | Platform admin | -- |
| Filter by advertiser | Filter by advertiser | Platform admin | -- |
| View campaign detail | Navigate to campaign detail | Platform admin | Enter on table row |
| Manage advertisers | Navigate to advertiser management | Platform admin | -- |
| Review creatives | Navigate to creative review queue | Platform admin | -- |
| Sort columns | Sort table by any column | Platform admin | Click column header |

### Role-Variant Matrix

| UI Element | Platform Admin (super/admin) | All Other Roles |
|---|---|---|
| Campaign table | visible | hidden (403 redirect) |
| Create campaign button | visible | hidden |
| Advertiser management link | visible | hidden |
| Creative review link | visible | hidden |
| All actions | enabled | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Full table with all columns, sidebar with actions |
| Tablet (768-1024px) | Table with horizontal scroll, collapsed sidebar |
| Mobile (<768px) | Card view replacing table, stacked metrics |

### Layout Notes
- Campaign table is the primary content area
- Status badges color-coded: draft (gray), pending_review (yellow), active (green), paused (orange), completed (blue), rejected (red)
- Budget gauge: visual bar showing spent/total ratio
- Sub-navigation tabs: Campaigns (default), Creative Review, Advertisers

### States

- **Default:** Campaign list table with sortable columns and metrics
- **Loading:** Skeleton table with 5-8 rows
- **Empty:** "No campaigns yet. Create your first advertising campaign." + "Create Campaign" CTA
- **Success:** After campaign creation — redirect to detail with sonner toast "Campaign created"
- **Validation Error:** N/A (list view)
- **Permission Error:** "Platform admin access required" (AUTHZ-004). Redirect to /admin.
- **Unexpected Error:** "Unable to load advertising dashboard. Please try again." with retry
- **Conflict/Duplicate Warning:** N/A
- **Offline/Sync:** "You're offline. Data may be stale." with last-loaded timestamp

### Validation Behavior
- Filters: client-side, instant
- Sort: client-side for current page

### Permission-Based UI Behavior
- Only platform admins (super, admin) can access this screen
- All other roles redirected with 403 error

### Edge Cases
- Campaign with zero impressions: CTR shows "--" instead of 0%
- Budget fully spent: budget gauge shows red, "Budget exhausted" label
- Large number of campaigns: server-side pagination

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.

---

## Screen: Campaign Detail

**Purpose:** Campaign management, creative review, and analytics
**Route:** `/admin/advertising/campaigns/[id]`
**Primary Users/Roles:** Platform Admin (super, admin)
**Related Workflow:** WF-092 (Campaign Creation), WF-093 (Creative Approval), WF-094 (Campaign Lifecycle)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Campaign Detail

### ARIA Landmark Structure

```
<header role="banner">              -- app header, breadcrumb: Advertising > {Campaign Name}
<nav role="navigation">             -- admin nav, back to dashboard
<main role="main">
  <section aria-label="Campaign configuration">  -- name, advertiser, budget, schedule, targeting, slot
  <section aria-label="Campaign creatives">       -- creative list with approval status
  <section aria-label="Performance metrics">      -- impressions, clicks, CTR charts
  <section aria-label="Campaign actions">         -- pause/resume/complete buttons
  <aside role="complementary">                    -- budget gauge, status indicator
<footer role="contentinfo">         -- last updated timestamp
```

### Focus Management

- **Initial focus on load:** Campaign name heading (h1)
- **Focus after creative approval:** Next pending creative in list
- **Focus after status change:** Status badge (announces change)
- **Focus after config save:** Sonner toast
- **Focus trap:** Creative rejection reason dialog
- **Skip link:** "Skip to campaign creatives"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Campaign name | Yes | data.name | Editable heading |
| Advertiser name | Yes | data.advertiserName | Read-only, linked to advertiser |
| Status | Yes | data.status | Badge with transition buttons |
| Description | No | data.description | Editable text |
| Budget | Yes | data.budgetCents | Editable, displayed as currency |
| Spent | Yes | data.spentCents | Read-only, budget gauge |
| Target segment | No | data.targetSegmentId | Display targeting criteria |
| Target segment size | No | data.targetSegmentSize | Audience size (no PII — M16-R2) |
| Ad slot | Yes | data.adSlot | Badge: feed_banner, sidebar, email_footer, event_sponsor |
| Start date | No | data.startsAt | Date display/picker |
| End date | No | data.endsAt | Date display/picker |
| Impressions | Yes | data.impressions | Number with chart |
| Clicks | Yes | data.clicks | Number with chart |
| CTR | Yes | data.ctr | Percentage with chart |
| Creatives list | Yes | data.creatives[] | Cards with preview, status, actions |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Edit config | Update campaign name, description, budget, schedule, targeting | Platform admin | -- |
| Save config | Persist configuration changes | Platform admin | Ctrl+S |
| Add creative | Upload new creative to campaign | Platform admin | -- |
| Approve creative | Approve pending creative (M16-R1) | Platform admin | -- |
| Reject creative | Reject with reason (M16-R1) | Platform admin | -- |
| Activate campaign | Transition draft -> active | Platform admin, requires approved creative | -- |
| Pause campaign | Transition active -> paused | Platform admin | -- |
| Resume campaign | Transition paused -> active | Platform admin | -- |
| Complete campaign | Transition to completed (terminal) | Platform admin | -- |

### Role-Variant Matrix

| UI Element | Platform Admin (super/admin) | All Other Roles |
|---|---|---|
| Campaign config (edit) | visible + editable | hidden |
| Creative list | visible + actionable | hidden |
| Performance charts | visible | hidden |
| Status transition buttons | visible (context-dependent) | hidden |
| Add creative button | visible | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Two-column: config + creatives left, charts + budget right |
| Tablet (768-1024px) | Single column, charts below config |
| Mobile (<768px) | Stacked sections, charts full-width |

### Layout Notes
- Campaign config is an inline-editable form (click to edit, save on blur/button)
- Creative list shows preview cards: thumbnail, title, status badge, approve/reject buttons
- Performance charts: line chart for impressions/clicks over time, CTR percentage
- Budget gauge: horizontal progress bar (spent/total), red when >90%
- Status transition buttons: contextual — only valid transitions shown (e.g., "Activate" on draft, "Pause" on active)
- "Sponsored" label (M16-R5): shown on creative preview as it will appear to members

### States

- **Default:** Full campaign detail with config, creatives, and charts
- **Loading:** Skeleton layout matching page structure
- **Empty:** N/A (detail always has campaign data)
- **Success:** Config saved — sonner toast "Campaign updated" (3s). Creative approved — toast "Creative approved" + status badge updates. Campaign activated — toast "Campaign is now active"
- **Validation Error:** Config changes — inline errors: "Budget must be greater than 0" (M16-R6), "End date must be after start date", "Campaign name is required"
- **Permission Error:** "Platform admin access required"
- **Unexpected Error:** "Unable to load campaign. Please try again." with retry
- **Conflict/Duplicate Warning:** Cannot activate without approved creatives — "At least one creative must be approved before activating the campaign"
- **Offline/Sync:** "You're offline. Changes will be saved when you reconnect."

### Validation Behavior
- Budget: must be > 0 (M16-R6), integer cents
- Schedule: endsAt > startsAt
- Name: required, max 255 chars
- Creative title: required, max 255 chars
- Creative bodyText: required, max 500 chars
- Rejection reason: required when rejecting a creative

### Permission-Based UI Behavior
- Only platform admins can access
- Status transitions enforce business rules (cannot activate without approved creative)

### Edge Cases
- Budget exhausted (M16-R6): system auto-pauses, "Budget exhausted — campaign auto-paused" banner
- Campaign completed (terminal): all edit actions disabled, read-only view
- No creatives yet: "Add your first creative to this campaign" CTA in creatives section
- All creatives rejected: "No approved creatives. Campaign cannot be activated." warning

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.

---

## Screen: Creative Review Queue

**Purpose:** Review and approve/reject pending ad creatives
**Route:** `/admin/advertising/creatives`
**Primary Users/Roles:** Platform Admin (super, admin)
**Related Workflow:** WF-093 (Creative Approval)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Creative Review Queue

### ARIA Landmark Structure

```
<header role="banner">              -- app header, "Creative Review" title
<nav role="navigation">             -- admin nav, advertising sub-tabs
<main role="main">
  <section aria-label="Pending creatives">     -- creative review cards
    <article aria-label="{creative title} for {campaign name}">  -- each creative
<footer role="contentinfo">         -- queue count
```

### Focus Management

- **Initial focus on load:** First pending creative card
- **Focus after approve:** Next pending creative in queue
- **Focus after reject:** Rejection reason dialog, then next creative
- **Focus trap:** Rejection reason dialog
- **Skip link:** "Skip to pending creatives"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Creative title | Yes | creative.title | Card heading |
| Body text | Yes | creative.bodyText | Preview text |
| Image | No | creative.imageUrl | Thumbnail preview |
| Click URL | No | creative.clickUrl | Link preview |
| Campaign name | Yes | campaign.name | Context label |
| Advertiser name | Yes | advertiser.companyName | Context label |
| Sponsored label | Yes | creative.sponsoredLabel | Always "Sponsored" badge preview |
| Submitted date | Yes | creative.createdAt | Relative time |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Approve | Approve creative (M16-R1) | Platform admin | -- |
| Reject | Reject with required reason (M16-R1) | Platform admin | -- |
| Preview | View creative as it would appear to members | Platform admin | -- |

### Role-Variant Matrix

| UI Element | Platform Admin (super/admin) | All Other Roles |
|---|---|---|
| Creative cards | visible | hidden |
| Approve/Reject buttons | visible | hidden |
| Preview | visible | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Card grid (2-3 columns), preview beside card |
| Tablet (768-1024px) | Two-column card grid |
| Mobile (<768px) | Single column, stacked cards |

### Layout Notes
- Each creative card shows full preview (title, body, image, "Sponsored" label)
- Approve (green) and Reject (red) buttons prominently placed on each card
- Badge showing queue count in navigation tab: "Creatives (3)"
- Rejected creatives can be viewed in a "Rejected" tab for reference

### States

- **Default:** Queue of pending creative cards
- **Loading:** Skeleton creative cards (3-4)
- **Empty:** "No creatives pending review. All caught up!" with checkmark illustration
- **Success:** Approved — card fades out, sonner toast "Creative approved" (3s). Rejected — card fades out, toast "Creative rejected" (3s)
- **Validation Error:** Rejection without reason — "Rejection reason is required" inline error in dialog
- **Permission Error:** "Platform admin access required"
- **Unexpected Error:** "Unable to load review queue. Please try again." with retry
- **Conflict/Duplicate Warning:** Creative already reviewed (concurrent admin): "This creative has already been reviewed" info toast, card removed
- **Offline/Sync:** "You're offline. Review actions will be submitted when you reconnect."

### Validation Behavior
- Rejection reason: required, non-empty string
- No other form validation (approve is a single action)

### Permission-Based UI Behavior
- Only platform admins can access

### Edge Cases
- Concurrent review: another admin approves/rejects while queue is open — real-time update or stale indicator
- Creative with no image: card shows text-only preview layout
- Very long body text: truncated at 200 chars with "Show more"

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.
