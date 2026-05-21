<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint — Screens: Organization Admin (M04)

---

## S01: Org Dashboard (`/org/[id]/officer/dashboard`)

**Purpose:** Officer home with smart action cards and key metrics (WF-027).
**Primary Users:** All officers (president, VP, secretary, treasurer, board-member, officer, staff).
**Related Workflow:** WF-027 (Org Dashboard).
**App:** memberry (port 3004).
**API Endpoints:** `GET /org/:id/dashboard`, `GET /org/:id`

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Organization navigation">
    <a href="/org/{id}/officer/dashboard" aria-current="page">Dashboard</a>
    <a href="/org/{id}/officer/officers">Officers</a>
    <a href="/org/{id}/officer/settings">Settings</a>
  </nav>
</header>
<main role="main" aria-label="Organization dashboard">
  <h1>{orgName} Dashboard</h1>
  <section aria-label="Smart actions">
    <h2>Action Required</h2>
    <ul role="list" aria-label="Actionable items">
      <!-- SmartActionCard components -->
    </ul>
  </section>
  <section aria-label="Key metrics">
    <h2>Overview</h2>
    <div role="group" aria-label="Organization statistics">
      <!-- OrgStatCard components -->
    </div>
  </section>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | First smart action card (or empty state CTA) |
| No actions | "Everything is on track" status message |
| Card action | Navigate to relevant detail page |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| orgName | Yes | `GET /org/:id/dashboard` → data.orgName | Organization name |
| activeMemberCount | Yes | Same → data.activeMemberCount | Stat card |
| duescollectionRate | Yes | Same → data.duescollectionRate | Stat card (percentage) |
| upcomingActivities | No | Same → data.upcomingActivities | Count |
| smartActions | Array | Same → data.smartActions[] | Action cards |
| smartActions[].type | Yes | Nested | e.g., "unpaid_dues", "pending_applications" |
| smartActions[].count | Yes | Nested | Number of items |
| smartActions[].label | Yes | Nested | e.g., "12 members with unpaid dues" |
| smartActions[].href | Yes | Nested | Navigation target |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| View action detail | Navigate to relevant management page | Officer (all) | — |
| Refresh dashboard | Re-fetch data | Officer (all) | — |

### Role-Variant Matrix

| Element | President | Secretary | Treasurer | Other Officers |
|---------|-----------|-----------|-----------|----------------|
| All action cards | Visible + actionable | Visible + actionable | Visible + actionable | Visible (subset) |
| Member count | Visible | Visible | Visible | Visible |
| Collection rate | Visible | Visible | Visible | Hidden |
| Governance actions | Visible | Hidden | Hidden | Hidden |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | 2-column: actions (left, span 2) + stats (right sidebar) |
| Tablet (768-1024px) | Actions (full width) + stats below (2-col grid) |
| Mobile (<768px) | Single column, stacked: stats summary bar, then action cards |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton action cards (3) + skeleton stat cards (3) |
| Empty | "Everything is on track!" with green checkmark + onboarding prompt if new org |
| Success | Cards sorted by urgency, stats displayed |
| Validation Error | N/A (read-only) |
| Permission Error | Non-officer redirect to member view (/org/{id}) |
| Unexpected Error | "Failed to load dashboard. Try again." banner + retry |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | Cached dashboard data, "Showing last updated data" badge |

---

## S02: Officer Management (`/org/[id]/officer/officers`)

**Purpose:** View and manage officer assignments and transitions (WF-025).
**Primary Users:** President (full management), other officers (view).
**Related Workflow:** WF-025 (Officer Transition).
**App:** memberry (port 3004).
**API Endpoints:** `POST /org/:id/officers`, `DELETE /org/:id/officers/:termId`, `POST /org/:id/officers/:termId/transition`

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Organization navigation">...</nav>
</header>
<main role="main" aria-label="Officer management">
  <section aria-label="Officers toolbar">
    <h1>Officers</h1>
    <button aria-label="Assign new officer">+ Assign Officer</button>
  </section>
  <table role="grid" aria-label="Officer list">
    <thead>
      <tr><th>Name</th><th>Position</th><th>Term Start</th><th>Term End</th><th>Status</th><th>Actions</th></tr>
    </thead>
    <tbody>
      <!-- OfficerRow components -->
    </tbody>
  </table>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | "Assign Officer" button (president) or first table row (others) |
| Assignment success | New row in table |
| Transition complete | Updated row, sonner toast |
| Removal | Next row or assign button |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| personId | Yes | Officer list | Person reference |
| personName | Yes | Officer list | Display name |
| positionTitle | Yes | Officer list | president, vice-president, secretary, etc. |
| termStatus | Yes | Officer list | upcoming/active/completed/resigned/removed |
| startDate | Yes | Officer list | Term start date |
| endDate | No | Officer list | Term end date (null if ongoing) |
| assignedBy | Yes | Officer list | Assigning officer name |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Assign officer | POST /org/:id/officers | President (2FA) | — |
| Remove officer | DELETE /org/:id/officers/:termId | President (2FA) | — |
| Start transition | POST /org/:id/officers/:termId/transition | President (2FA) | — |
| View checklist | Open transition checklist modal | President | — |

### Role-Variant Matrix

| Element | President | Other Officers | Member |
|---------|-----------|----------------|--------|
| Assign button | Visible | Hidden | Hidden |
| Remove button | Visible (per row) | Hidden | Hidden |
| Transition button | Visible (active terms) | Hidden | Hidden |
| Table (read) | Full | Full | No access (redirect) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Full data table with all columns |
| Tablet (768-1024px) | Table with horizontal scroll |
| Mobile (<768px) | Card list (name, position, status, action menu) |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton table rows (5) |
| Empty | "No officers assigned yet. Assign your first officer." + CTA |
| Success | Officer table with status badges |
| Validation Error | Assignment form: role conflict or duplicate position |
| Permission Error | "Only the President can manage officers." message for non-presidents |
| Unexpected Error | "Failed to load officers. Try again." |
| Conflict/Duplicate | "This position is already filled. Remove the current officer first." |
| Confirmation/Warning | Remove: "Remove {name} from {position}? They will become a regular member." / Transition: checklist modal |
| Offline/Sync | Table cached, all mutation buttons disabled |

### Transition Checklist Modal

When transitioning an officer role, a modal opens with a role-specific checklist:

```
<div role="dialog" aria-label="Officer transition checklist">
  <h2>Transition: {position}</h2>
  <p>Outgoing: {outgoingName} → Incoming: {incomingName}</p>
  <ul role="list" aria-label="Handoff checklist">
    <li><input type="checkbox" /> Pending applications reviewed</li>
    <li><input type="checkbox" /> Outstanding payments reconciled</li>
    <li><input type="checkbox" /> Upcoming events assigned</li>
    <li><input type="checkbox" /> Notes for successor</li>
  </ul>
  <textarea aria-label="Transition notes" />
  <button>Complete Transition</button>
  <button>Override (President)</button>
</div>
```

- Checklist items are role-specific (generated by server).
- 100% completion required unless President overrides with documented reason.
- Override: requires reason text input.

---

## S03: Org Settings (`/org/[id]/officer/settings`)

**Purpose:** Update org profile, logo, branding, public page (WF-024).
**Primary Users:** Officers (any with active term).
**Related Workflow:** WF-024 (Org Settings).
**App:** memberry (port 3004).
**API Endpoints:** `GET /org/:id`, `PUT /org/:id`

### ARIA Landmark Structure

```
<main role="main" aria-label="Organization settings">
  <form aria-label="Organization settings form">
    <fieldset aria-label="Organization profile">
      <input aria-label="Organization name" aria-required="true" />
      <textarea aria-label="Description" />
      <input aria-label="Contact email" type="email" />
      <input aria-label="Meeting schedule" />
      <input aria-label="Founding date" type="date" />
    </fieldset>
    <fieldset aria-label="Branding">
      <!-- LogoUpload component -->
    </fieldset>
    <button type="submit">Save Changes</button>
  </form>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Organization name input |
| Save success | sonner toast, stay on page |
| Validation error | First invalid field |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| name | Yes | `PUT /org/:id` → body.name | 2-100 chars |
| description | No | Same → body.description | Max 2000 chars |
| contactEmail | No | Same → body.contactEmail | Standard email |
| meetingSchedule | No | Same → body.meetingSchedule | Free text |
| foundingDate | No | Same → body.foundingDate | Must not be future |
| logoUrl | No | Same → body.logoUrl | SVG sanitized (BR-31) |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Save changes | PUT /org/:id | Officer (any active) | Ctrl/Cmd+S |
| Upload logo | Storage upload | Officer (any active) | — |
| Remove logo | Clear logo URL | Officer (any active) | — |

### Role-Variant Matrix

| Element | President | Secretary | Other Officers | Non-officer |
|---------|-----------|-----------|----------------|-------------|
| All fields | Editable | Editable | Editable | No access |
| Org type | Read-only (set at creation) | Same | Same | — |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Two-column: logo left, form right |
| Tablet (768-1024px) | Single column, logo at top |
| Mobile (<768px) | Single column, sticky save at bottom |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton form fields |
| Empty | Form pre-filled with current org data |
| Success | sonner toast "Organization settings saved." Public page updated. |
| Validation Error | Inline errors: name length, future founding date, invalid email |
| Permission Error | Non-officers redirected to /org/{id} |
| Unexpected Error | "Save failed. Try again." Data preserved. |
| Conflict/Duplicate | N/A (name is within-association unique, handled at provisioning) |
| Confirmation/Warning | N/A |
| Offline/Sync | Save disabled, "You're offline" banner |

---

## S04: Org Public Page (`/org/[slug]`)

**Purpose:** Public-facing org profile with "Apply to Join" CTA (WF-028).
**Primary Users:** Public (unauthenticated + authenticated).
**Related Workflow:** WF-028 (Org Public Page).
**App:** memberry (port 3004).
**API Endpoints:** `GET /org/:slug/public`

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Public navigation">
    <a href="/">Home</a>
    <a href="/auth/sign-in">Sign In</a>
  </nav>
</header>
<main role="main" aria-label="{orgName} public profile">
  <section aria-label="Organization header">
    <img alt="{orgName} logo" />
    <h1>{orgName}</h1>
    <p>{description}</p>
  </section>
  <section aria-label="Organization details">
    <dl>
      <dt>Type</dt><dd>{orgType}</dd>
      <dt>Contact</dt><dd>{contactEmail}</dd>
      <dt>Meeting Schedule</dt><dd>{meetingSchedule}</dd>
      <dt>Founded</dt><dd>{foundingDate}</dd>
    </dl>
  </section>
  <section aria-label="Join this organization">
    <button aria-label="Apply to join {orgName}">Apply to Join</button>
  </section>
</main>
<footer role="contentinfo">
  <p>Powered by Memberry</p>
</footer>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | "Apply to Join" button |
| Apply click (unauthenticated) | Redirect to /auth/sign-in with returnUrl |
| Apply click (authenticated) | Application form or redirect to membership module |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| name | Yes | `GET /org/:slug/public` → data.name | — |
| description | No | Same → data.description | Rendered as markdown-safe text |
| orgType | Yes | Same → data.orgType | "Chapter", "Society", etc. |
| contactEmail | No | Same → data.contactEmail | Mailto link |
| meetingSchedule | No | Same → data.meetingSchedule | Free text |
| foundingDate | No | Same → data.foundingDate | Formatted date |
| logoUrl | No | Same → data.logoUrl | Fallback to initials |
| activeMemberCount | Yes | Same → data.activeMemberCount | Public metric |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Apply to join | Navigate to application flow | Public | — |
| Contact org | Mailto link | Public | — |

### Role-Variant Matrix

| Element | Public (unauth) | Authenticated member | Existing member |
|---------|-----------------|---------------------|-----------------|
| Apply button | Visible (→ sign-in) | Visible (→ application) | Hidden ("You're a member") |
| Contact email | Visible | Visible | Visible |
| Member count | Visible | Visible | Visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Hero header with logo + details sidebar |
| Tablet (768-1024px) | Stacked: header, details, CTA |
| Mobile (<768px) | Full-width stacked, sticky "Apply" button at bottom |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton header + details |
| Empty | N/A (all orgs have at least a name) |
| Success | Full public page rendered |
| Validation Error | N/A (read-only) |
| Permission Error | N/A (public route) |
| Unexpected Error | "This organization page is temporarily unavailable." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | Cached page if available, "Apply" button disabled |

---

## S05: Disciplinary Action (`/org/[id]/officer/discipline`)

**Purpose:** President takes disciplinary action against a member (WF-026).
**Primary Users:** President.
**Related Workflow:** WF-026 (Disciplinary Action).
**App:** memberry (port 3004).
**API Endpoints:** `POST /org/:id/discipline`

### ARIA Landmark Structure

```
<main role="main" aria-label="Disciplinary action">
  <h1>Disciplinary Action</h1>
  <form aria-label="Disciplinary action form">
    <div role="combobox" aria-label="Select member">
      <!-- PersonSearchCombobox -->
    </div>
    <fieldset aria-label="Action details">
      <div role="radiogroup" aria-label="Action type">
        <input type="radio" name="actionType" value="warning" /> Warning
        <input type="radio" name="actionType" value="probation" /> Probation
        <input type="radio" name="actionType" value="suspension" /> Suspension
        <input type="radio" name="actionType" value="removal" /> Removal
      </div>
      <textarea aria-label="Reason (required)" aria-required="true" />
      <input aria-label="Duration in days" type="number" min="1" />
    </fieldset>
    <button type="submit">Submit Action</button>
  </form>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Member search input |
| Member selected | Action type radio group |
| Submit success | sonner toast, navigate to officer dashboard |
| Validation error | First invalid field |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| personId | Yes | `POST /org/:id/discipline` → body.personId | From member search |
| actionType | Yes | Same → body.actionType | warning/probation/suspension/removal |
| reason | Yes | Same → body.reason | Non-empty, immutable after creation (M4-R4) |
| duration | Conditional | Same → body.duration | Days, required for suspension/probation |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Search member | Filter org members | President (2FA) | — |
| Submit action | POST /org/:id/discipline | President (2FA) | — |

### Role-Variant Matrix

| Element | President | Other Officers | Member |
|---------|-----------|----------------|--------|
| Full form | Visible | Hidden (no access) | No access |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Centered form (max-w-lg) |
| Tablet (768-1024px) | Same |
| Mobile (<768px) | Full-width form |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on member search |
| Empty | Form with member search and blank fields |
| Success | sonner toast "Disciplinary action recorded." Navigate to dashboard. |
| Validation Error | "Reason is required." / "Duration required for suspension/probation." |
| Permission Error | Non-presidents: redirect to officer dashboard with "Only the President can issue disciplinary actions." |
| Unexpected Error | "Action could not be submitted. Try again." Data preserved. |
| Conflict/Duplicate | N/A (actions are additive, not unique) |
| Confirmation/Warning | "This action is permanent and cannot be modified. {actionType}: {effect description}. Continue?" |
| Offline/Sync | "Disciplinary actions require internet." Submit disabled. |

### Edge Cases

- Removal action: additional warning "This will permanently terminate membership."
- Duration field: only visible for probation and suspension types.
- Reason field: cannot be edited after submission (M4-R4 — immutable).
- Self-discipline: server rejects — president cannot discipline themselves.
