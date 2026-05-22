<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Screens: National Dashboard (M14)

## Blueprint Purpose

This UI Blueprint provides comprehensive UI specification for the National Dashboard module.

Based on:
- Module Spec: docs/product/modules/m14-national-dashboard/MODULE_SPEC.md
- Domain Glossary: docs/product/DOMAIN_GLOSSARY.md
- Role Permission Matrix: docs/product/ROLE_PERMISSION_MATRIX.md
- API Contracts: docs/product/modules/m14-national-dashboard/API_CONTRACTS.md

**This blueprint is not the source of product truth.** Final implementation must follow the PRD, module spec, slice spec, test plan, and architecture.

---

## Screen: National Dashboard Home

**Purpose:** Cross-chapter KPI overview for national officers and platform admins
**Route:** `/admin/national`
**Primary Users/Roles:** National Officers (President), Platform Admins (super, admin, support)
**Related Workflow:** WF-084 (Review Association Health), WF-086 (National Data Export)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — National Dashboard Home

### ARIA Landmark Structure

```
<header role="banner">              -- app header, "National Dashboard" title
<nav role="navigation">             -- admin nav, dashboard tabs
<main role="main">
  <section aria-label="Date range controls">    -- date range selector
  <section aria-label="KPI summary">            -- KPI summary cards
  <section aria-label="Trend charts">           -- line/bar charts
  <section aria-label="Chapter comparison">     -- chapter comparison table
  <aside role="complementary">                  -- export button, filters
<footer role="contentinfo">         -- data freshness timestamp
```

### Focus Management

- **Initial focus on load:** Date range selector
- **Focus after export action:** Sonner toast notification (auto-dismiss)
- **Focus after drill-down:** Chapter drill-down screen
- **Focus after modal close:** Return to trigger element
- **Focus trap:** Export options modal (if used)
- **Skip link:** "Skip to KPI summary"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Total members | Yes | data.totalMembers | KPI card, number format with thousands separator |
| Active members % | Yes | data.activePercent | KPI card, percentage with trend arrow |
| Collection rate | Yes | data.collectionRate | KPI card, percentage |
| Compliance % | Yes | data.compliancePercent | KPI card, percentage |
| Chapter count | Yes | data.chapterCount | KPI card |
| Association name | Yes | data.associationName | Header context |
| Trend data | Yes | data.trends | Monthly/quarterly line charts |
| Chapter comparison | Yes | /admin/national/chapters response | Table with per-chapter metrics |
| Snapshot date | Yes | data.snapshotDate | Footer: "Data as of {date}" |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Select date range | Filter dashboard by date period | National officers, platform admins | -- |
| Export CSV | Download aggregated data as CSV | National officers, platform admins (M14-R4) | -- |
| Export PDF | Download report as PDF | National officers, platform admins (M14-R4) | -- |
| Drill-down to chapter | Navigate to chapter detail | National officers, platform admins | Enter on table row |
| Compare chapters | Side-by-side chapter metrics | National officers, platform admins | -- |
| Switch association | Platform admin views different association | Platform admins only | -- |

### Role-Variant Matrix

| UI Element | Platform Admin (super/admin) | Support | National Officer (President) | All Other Roles |
|---|---|---|---|---|
| Dashboard view | visible — all associations | visible — all associations | visible — own association only | hidden (403 redirect) |
| Association switcher | visible | visible | hidden | hidden |
| KPI cards | visible | visible | visible | hidden |
| Trend charts | visible | visible | visible | hidden |
| Chapter table | visible | visible | visible | hidden |
| Export button | visible | visible | visible | hidden |
| Configure access | visible | visible | hidden | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | KPI cards in 4-column row, charts side-by-side, full table |
| Tablet (768-1024px) | KPI cards in 2x2 grid, charts stacked, table horizontal scroll |
| Mobile (<768px) | KPI cards stacked vertically, charts full-width, table card view |

### Layout Notes
- KPI cards at top with trend indicator arrows (up/down/neutral)
- Trend charts: line chart for membership over time, bar chart for collection rates by chapter
- Chapter comparison table: sortable columns, clickable rows for drill-down
- Date range selector: preset options (This Month, This Quarter, This Year, Custom)

### States

- **Default:** Dashboard populated with KPI cards, charts, and chapter table
- **Loading:** Skeleton KPI cards (4), skeleton chart placeholders, skeleton table rows
- **Empty:** "No chapter data available yet. Chapters must have active members to appear." No CTA (admin-only screen).
- **Success:** After export — sonner toast "Export downloaded" (CSV) or "Report generated" (PDF). For large datasets (202 Accepted): "Export is being prepared. You'll be notified when it's ready."
- **Validation Error:** Invalid date range — inline error "Start date must be before end date" (M14-002)
- **Permission Error:** "National officer or platform admin access required" (M14-001). Redirect to /admin with error toast.
- **Unexpected Error:** "Unable to load dashboard. Please try again." with retry button. Aggregation timeout (M14-003): "Data aggregation timed out. Try a smaller date range."
- **Conflict/Duplicate Warning:** N/A (read-only dashboard)
- **Offline/Sync:** "You're offline. Dashboard data may be stale." with last-loaded timestamp

### Validation Behavior
- Date range: start < end, both valid dates
- Association ID: validated server-side for platform admins

### Permission-Based UI Behavior
- National officers: see only their association's data; no association switcher
- Platform admins: see association switcher dropdown; can view all associations
- Cross-association access denied (AUTHZ-006): "You don't have access to this association's data"
- All other roles: redirect to /admin with 403 toast

### Edge Cases
- Association with zero chapters: empty state for chapter table, KPI cards show zeros
- Very large associations (100+ chapters): table uses virtual scrolling
- Export of large dataset: async job with polling (202 Accepted response)

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.

---

## Screen: Chapter Drill-Down

**Purpose:** Detailed metrics for a specific chapter/organization
**Route:** `/admin/national/[associationId]/orgs/[orgId]`
**Primary Users/Roles:** National Officers (President), Platform Admins
**Related Workflow:** WF-085 (Chapter Drill-Down)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Chapter Drill-Down

### ARIA Landmark Structure

```
<header role="banner">              -- app header, breadcrumb: National Dashboard > {Chapter Name}
<nav role="navigation">             -- admin nav, back to dashboard link
<main role="main">
  <section aria-label="Chapter overview">       -- chapter name, member count, status
  <section aria-label="Chapter metrics">        -- detailed KPI cards
  <section aria-label="Member status breakdown"> -- pie/donut chart
  <section aria-label="Recent activity">        -- recent events, credit compliance
  <aside role="complementary">                  -- export chapter data, chapter navigation
<footer role="contentinfo">         -- data freshness timestamp
```

### Focus Management

- **Initial focus on load:** Chapter name heading (h1)
- **Focus after export:** Sonner toast
- **Focus after navigation to next chapter:** Chapter name heading
- **Focus trap:** None (standard page)
- **Skip link:** "Skip to chapter metrics"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Chapter name | Yes | data.organizationName | Page heading |
| Member count | Yes | data.memberCount | KPI card |
| Active members | Yes | data.activeMembers | KPI card with percentage |
| Collection rate | Yes | data.collectionRate | KPI card with trend |
| Credit compliance | Yes | data.creditCompliance | KPI card with percentage |
| Status breakdown | Yes | data.statusBreakdown | Donut chart: active, grace, lapsed, suspended |
| Recent events | Yes | data.recentEvents | List of recent chapter events |
| Officer list | Yes | data.officers | Current officer roster |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Back to dashboard | Return to national dashboard | All authorized | Alt+Left |
| Export chapter data | Download chapter-specific report | National officers, platform admins | -- |
| Navigate to next/prev chapter | Cycle through chapters | National officers, platform admins | Arrow keys in chapter nav |

### Role-Variant Matrix

| UI Element | Platform Admin | National Officer (President) | All Other Roles |
|---|---|---|---|
| Chapter metrics | visible | visible | hidden |
| Export button | visible | visible | hidden |
| Chapter navigation | visible | visible | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Two-column: metrics left, charts right, activity below |
| Tablet (768-1024px) | Single column, metrics cards in 2x2 grid |
| Mobile (<768px) | Stacked layout, charts full-width |

### Layout Notes
- Breadcrumb navigation: National Dashboard > {Association} > {Chapter}
- Chapter navigation sidebar: list of chapters for quick switching
- Status breakdown chart: interactive donut with tooltips showing counts

### States

- **Default:** Chapter detail populated with metrics and charts
- **Loading:** Skeleton layout matching content dimensions
- **Empty:** Newly created chapter — "This chapter has no data yet. Data will appear once members are added."
- **Success:** Export downloaded — sonner toast "Chapter report exported"
- **Validation Error:** N/A (read-only)
- **Permission Error:** "National officer or platform admin access required"
- **Unexpected Error:** "Unable to load chapter data. Please try again." with retry
- **Conflict/Duplicate Warning:** N/A
- **Offline/Sync:** "You're offline. Showing last loaded data."

### Validation Behavior
- No user input validation (read-only screen)

### Permission-Based UI Behavior
- Same as dashboard home: national officers see own association, platform admins see all

### Edge Cases
- Chapter with zero members: all KPI cards show 0, charts empty
- Navigate between chapters: sidebar list, arrow key support

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.
