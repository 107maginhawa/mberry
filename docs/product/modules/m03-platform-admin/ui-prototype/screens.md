<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint — Screens: Platform Administration (M03)

---

## S01: Platform Dashboard (`/admin`)

**Purpose:** Actionable items first, vanity metrics secondary (WF-017).
**Primary Users:** All platform admins (super, admin, support).
**Related Workflow:** WF-017 (Dashboard).
**App:** admin (port 3003).

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Admin navigation">
    <a href="/admin" aria-current="page">Dashboard</a>
    <a href="/admin/associations">Associations</a>
    <a href="/admin/feature-flags">Feature Flags</a>
    <a href="/admin/impersonate">Impersonate</a>
    <a href="/admin/team">Team</a>
  </nav>
</header>
<main role="main" aria-label="Platform dashboard">
  <section aria-label="Action required">
    <h2>Action Required</h2>
    <ul role="list" aria-label="Actionable items">
      <!-- ActionCard components -->
    </ul>
  </section>
  <section aria-label="Platform metrics">
    <h2>Overview</h2>
    <div role="group" aria-label="Key statistics">
      <!-- StatCard components -->
    </div>
  </section>
  <aside aria-label="Recent activity">
    <h2>Activity Feed</h2>
    <ol role="list" aria-label="Recent platform events">
      <!-- ActivityFeedItem components -->
    </ol>
  </aside>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | First actionable card (if any) or "All clear" message |
| All clear | "No items requiring attention" status message |
| Card action | Navigate to relevant detail page |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| pendingSetups | No | Dashboard aggregate | Orgs in trial with incomplete onboarding |
| paymentFailures | No | Dashboard aggregate | Orgs with failed payments |
| expiringTrials | No | Dashboard aggregate | Trials expiring within 7 days |
| totalAssociations | Yes | `GET /admin/analytics/health` → data.totalAssociations | Stat card |
| totalOrgs | Yes | Same | Stat card |
| totalMembers | Yes | Same | Stat card |
| mrr | Yes | `GET /admin/analytics/revenue` → data.mrr | Stat card, formatted currency |
| activityFeed | No | Dashboard aggregate | Recent events list |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| View association | Navigate to association detail | PA (all) | — |
| View org | Navigate to org detail | PA (all) | — |
| Resolve action | Navigate to relevant management page | PA (admin, super) | — |

### Role-Variant Matrix

| Element | Super Admin | Admin | Support |
|---------|-------------|-------|---------|
| All action cards | Visible | Visible | Visible (read-only actions) |
| MRR stat | Visible | Visible | Hidden |
| Revenue analytics | Visible | Visible | Hidden |
| Activity feed | Full | Full | Limited (no financial events) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | 3-column: actions (span 2) + activity feed (aside right) |
| Tablet (768-1024px) | 2-column: actions + stats; activity feed below |
| Mobile (<768px) | Single column, stacked sections |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton cards (action + stat + feed) |
| Empty (All Clear) | "No items requiring attention" with green checkmark icon |
| Success | Cards sorted by urgency (payment failures > expiring trials > pending setups) |
| Validation Error | N/A (read-only dashboard) |
| Permission Error | Redirect to /auth/sign-in (no admin session) |
| Unexpected Error | "Failed to load dashboard. Refresh to try again." banner |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | "Dashboard requires internet. Showing last known data." |

---

## S02: Associations Management (`/admin/associations`)

**Purpose:** CRUD for associations (WF-015, WF-016).
**Primary Users:** Super Admin, Admin.
**Related Workflow:** WF-015 (Onboard Association), WF-016 (Provision Organization).
**App:** admin (port 3003).

### ARIA Landmark Structure

```
<main role="main" aria-label="Associations management">
  <section aria-label="Associations toolbar">
    <input aria-label="Search associations" type="search" />
    <button aria-label="Create association">+ New Association</button>
  </section>
  <table role="grid" aria-label="Associations list">
    <thead>
      <tr><th>Name</th><th>Country</th><th>Orgs</th><th>Members</th><th>Status</th><th>Actions</th></tr>
    </thead>
    <tbody>
      <!-- AssociationRow components -->
    </tbody>
  </table>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Search input |
| Create success | New row in table |
| Delete success | Next row or search input |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| id | Yes | `GET /admin/associations` → data[].id | UUID |
| name | Yes | Same → data[].name | Unique globally |
| country | Yes | Same → data[].country | ISO country code |
| licenseFormatRegex | Yes | Same → data[].licenseFormatRegex | Displayed in edit form |
| creditCyclePeriod | Yes | Same → data[].creditCyclePeriod | 1, 2, or 3 years |
| creditCycleRequired | Yes | Same → data[].creditCycleRequired | Credit units |
| carryoverEnabled | Yes | Same → data[].carryoverEnabled | Boolean |
| localeSettings | No | Same → data[].localeSettings | JSONB |
| orgCount | Yes | Computed | Number of orgs |
| memberCount | Yes | Computed | Total members across orgs |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Search | Filter associations | PA (all) | Ctrl/Cmd+K |
| Create association | POST /admin/associations | PA (super, admin) | — |
| Edit association | PUT /admin/associations/:id | PA (super, admin) | — |
| Delete association | DELETE /admin/associations/:id | PA (super only) | — |
| Add organization | POST /admin/associations/:id/orgs | PA (super, admin) | — |

### Role-Variant Matrix

| Element | Super Admin | Admin | Support |
|---------|-------------|-------|---------|
| Create button | Visible | Visible | Hidden |
| Edit button | Visible | Visible | Hidden |
| Delete button | Visible | Hidden | Hidden |
| Add org button | Visible | Visible | Hidden |
| Table (read) | Full | Full | Full |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Full data table with all columns |
| Tablet (768-1024px) | Table with horizontal scroll, fewer visible columns |
| Mobile (<768px) | Card list replacing table (name, country, org count, action menu) |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton table rows |
| Empty | "No associations yet. Create your first association." + CTA |
| Success | Table populated, sorted by name |
| Validation Error | Inline in create/edit form (name unique, valid regex) |
| Permission Error | Create/edit/delete buttons hidden for unauthorized roles |
| Unexpected Error | "Failed to load associations. Try again." |
| Conflict/Duplicate | Create: "An association with this name already exists." (409) |
| Confirmation/Warning | Delete: "Delete {name}? This cannot be undone." (only if no active orgs) |
| Offline/Sync | Table shows cached data, mutation buttons disabled |

---

## S03: Feature Flags (`/admin/feature-flags`)

**Purpose:** Toggle module features per tier or per org (WF-018).
**Primary Users:** Super Admin, Admin.
**Related Workflow:** WF-018 (Feature Flag Management).
**App:** admin (port 3003).

### ARIA Landmark Structure

```
<main role="main" aria-label="Feature flags management">
  <section aria-label="Feature flags toolbar">
    <select aria-label="Filter by target type">
      <option>All</option><option>By Tier</option><option>By Org</option>
    </select>
  </section>
  <div role="grid" aria-label="Feature flags matrix">
    <!-- FeatureFlagRow for each module -->
  </div>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Filter selector |
| Toggle change | Same toggle (stays in place) |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| moduleName | Yes | `GET /admin/feature-flags` → data[].moduleName | e.g., "M01", "M05" |
| targetType | Yes | Same → data[].targetType | "tier" or "org" |
| targetId | Yes | Same → data[].targetId | Tier name or org UUID |
| enabled | Yes | Same → data[].enabled | Boolean toggle |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Toggle flag | PUT /admin/feature-flags | PA (super, admin) | Space on focused toggle |
| Filter | Client-side filter by target type | PA (all) | — |

### Role-Variant Matrix

| Element | Super Admin | Admin | Support |
|---------|-------------|-------|---------|
| Toggles | Enabled | Enabled | Disabled (read-only) |
| Filter | Visible | Visible | Visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Grid: modules as rows, targets as columns |
| Tablet (768-1024px) | Scrollable grid |
| Mobile (<768px) | Accordion: module name expands to show targets + toggles |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton toggle grid |
| Empty | "No feature flags configured." (unlikely in production) |
| Success | Optimistic toggle update, sonner toast "Flag updated" |
| Validation Error | N/A (toggles only) |
| Permission Error | Toggles disabled for support role |
| Unexpected Error | Revert toggle, "Failed to update. Try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | Disabling a flag: "Disabling {module} will affect {N} organizations. Continue?" |
| Offline/Sync | All toggles disabled, "Feature flags require internet." |

---

## S04: Impersonation (`/admin/impersonate`)

**Purpose:** Support tool to view platform as a specific user (WF-019).
**Primary Users:** Super Admin, Admin.
**Related Workflow:** WF-019 (User Impersonation).
**App:** admin (port 3003).

### ARIA Landmark Structure

```
<main role="main" aria-label="User impersonation">
  <section aria-label="Impersonation search">
    <h1>Impersonate User</h1>
    <div role="combobox" aria-label="Search for a user">
      <input aria-label="Search by name or email" />
      <ul role="listbox" aria-label="Search results">
        <!-- PersonSearchResult items -->
      </ul>
    </div>
    <p>Reason (required): <input aria-required="true" /></p>
    <button>Start Impersonation</button>
  </section>
  <section aria-label="Active impersonation" hidden>
    <div role="alert" aria-label="Impersonation active banner">
      Viewing as {userName}. <button>End Impersonation</button>
    </div>
  </section>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Search input |
| User selected | Reason input |
| Impersonation started | Banner with end button |
| Impersonation ended | Search input |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| targetPersonId | Yes | `POST /admin/impersonate` → body.targetPersonId | UUID from search |
| reason | Yes | `POST /admin/impersonate` → body.reason | Mandatory, audit-logged |
| maxDuration | No | `POST /admin/impersonate` → body.maxDuration | Default 60 min |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Search user | Client-side filter / server search | PA (super, admin) | — |
| Start impersonation | POST /admin/impersonate | PA (super, admin) with 2FA | — |
| End impersonation | DELETE /admin/impersonate | PA (current impersonator) | Escape (global) |

### Role-Variant Matrix

| Element | Super Admin | Admin | Support |
|---------|-------------|-------|---------|
| Search | Available | Available | Hidden (no impersonation) |
| Start button | Available (2FA) | Available (2FA) | Hidden |
| Active banner | Shown during impersonation | Same | N/A |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Centered form, search results dropdown |
| Tablet (768-1024px) | Same |
| Mobile (<768px) | Full-width form, full-screen search results |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on search results |
| Empty | Search input with placeholder "Search by name or email" |
| Success | Impersonation banner shown globally across all admin pages |
| Validation Error | "Reason is required." inline error |
| Permission Error | Page hidden for support role (redirect to /admin) |
| Unexpected Error | "Impersonation failed. Try again." |
| Conflict/Duplicate | "You are already impersonating {user}. End current session first." |
| Confirmation/Warning | "You will view the platform as {name} ({email}). All actions will be audit-logged." |
| Offline/Sync | "Impersonation requires internet." Start button disabled. |

### Edge Cases

- Auto-terminate: impersonation auto-ends after maxDuration (default 60 min).
- Admin impersonating another admin: blocked per security policy.
- Banner persistence: impersonation banner shown on ALL pages until ended.

---

## S05: Admin Team (`/admin/team`)

**Purpose:** Manage platform admin accounts (WF-022).
**Primary Users:** Super Admin.
**Related Workflow:** WF-022 (Admin Team Management).
**App:** admin (port 3003).

### ARIA Landmark Structure

```
<main role="main" aria-label="Admin team management">
  <section aria-label="Admin team toolbar">
    <h1>Admin Team</h1>
    <button aria-label="Invite admin">+ Invite Admin</button>
  </section>
  <table role="grid" aria-label="Admin team list">
    <thead>
      <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Active</th><th>Actions</th></tr>
    </thead>
    <tbody>
      <!-- AdminRow components -->
    </tbody>
  </table>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Invite button (super) or table (admin/support) |
| Invite sent | sonner toast, focus returns to invite button |
| Remove admin | Next row or invite button |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| name | Yes | Admin list | Display name |
| email | Yes | Admin list | Email address |
| role | Yes | Admin list | super/admin/support |
| lastActive | No | Admin list | ISO datetime |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Invite admin | POST /admin/team/invite | PA (super only) | — |
| Change role | PUT /admin/team/:id/role | PA (super only) | — |
| Remove admin | DELETE /admin/team/:id | PA (super only) | — |

### Role-Variant Matrix

| Element | Super Admin | Admin | Support |
|---------|-------------|-------|---------|
| Invite button | Visible | Hidden | Hidden |
| Role selector | Enabled | Disabled | Hidden |
| Remove button | Visible | Hidden | Hidden |
| Table (read) | Full | Full | Full |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Full table |
| Tablet (768-1024px) | Table with fewer columns |
| Mobile (<768px) | Card list (name, role, action menu) |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton table |
| Empty | "No admin team members." (impossible — at least 1 super admin) |
| Success | Admin list with roles |
| Validation Error | Invite form: "Valid email required." |
| Permission Error | Invite/remove/role-change hidden for non-super |
| Unexpected Error | "Failed to load team. Try again." |
| Conflict/Duplicate | Invite: "This person is already an admin." |
| Confirmation/Warning | Remove: "Remove {name}? They will lose all admin access." / Last super: "Cannot remove the last Super Admin." (M3-R6) |
| Offline/Sync | Table shows cached, mutation buttons disabled |

---

## S06: Analytics (`/admin/analytics`)

**Purpose:** Revenue and health analytics for platform.
**Primary Users:** Super Admin, Admin.
**Related Workflow:** N/A (informational).
**App:** admin (port 3003).

### ARIA Landmark Structure

```
<main role="main" aria-label="Platform analytics">
  <section aria-label="Revenue analytics">
    <h2>Revenue</h2>
    <!-- Revenue charts and stats -->
  </section>
  <section aria-label="Health analytics">
    <h2>Organization Health</h2>
    <table role="grid" aria-label="Organization health scores">
      <!-- Health score rows -->
    </table>
  </section>
</main>
```

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| mrr | Yes | `GET /admin/analytics/revenue` → data.mrr | Monthly recurring revenue |
| arr | Yes | Same → data.arr | Annual recurring revenue |
| churnRate | Yes | Same → data.churnRate | Percentage |
| trialConversionRate | Yes | Same → data.trialConversionRate | Percentage |
| orgHealthScores | Yes | `GET /admin/analytics/health` → data.organizations[] | Per-org 0-100 score |

### Role-Variant Matrix

| Element | Super Admin | Admin | Support |
|---------|-------------|-------|---------|
| Revenue section | Visible | Visible | Hidden |
| Health scores | Visible | Visible | Visible |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton charts and table |
| Empty | "No data yet. Analytics populate after first organization is active." |
| Success | Charts and tables with data |
| Validation Error | N/A (read-only) |
| Permission Error | Revenue hidden for support; redirect for unauthenticated |
| Unexpected Error | "Failed to load analytics. Try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | "Analytics require internet." Show last cached snapshot. |
