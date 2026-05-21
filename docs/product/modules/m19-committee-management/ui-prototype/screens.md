<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M19 Committee Management -- Screen Specifications

## Screen Index

| Screen ID | Name | Route | Primary Actor | Workflow |
|-----------|------|-------|---------------|----------|
| M19-S01 | Committee List | `/org/:orgId/committees` | Officer/Member | WF-104 |
| M19-S02 | Committee Detail | `/org/:orgId/committees/:committeeId` | Chairperson/Member | WF-105, WF-106, WF-107 |
| M19-S03 | Create Committee | `/org/:orgId/committees/new` | President/Officer | WF-104 |
| M19-S04 | Edit Committee | `/org/:orgId/committees/:committeeId/edit` | President/Chairperson | WF-104 |
| M19-S05 | Task Board | `/org/:orgId/committees/:committeeId/tasks` | Chairperson/Member | WF-106 |
| M19-S06 | Meeting Detail | `/org/:orgId/committees/:committeeId/meetings/:meetingId` | Chairperson | WF-107 |
| M19-S07 | My Committees | `/my/committees` | Member | -- |
| M19-S08 | Committee Dissolution | Dialog overlay on M19-S02 | President/Chairperson | WF-108 |

---

## M19-S01: Committee List

**Route:** `/org/:orgId/committees`
**Workflow:** WF-104 (Create Committee)
**Auth:** GA (all org members can view)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Committees
<main role="main">
  <section aria-label="Committee management">
    <div role="toolbar" aria-label="Committee actions">
      <button>Create Committee</button>  -- Officers only
    <div role="tablist" aria-label="Committee filter">
      <button role="tab">Active</button>
      <button role="tab">Expired</button>
      <button role="tab">Dissolved</button>
    <div role="list" aria-label="Committees">
      <article role="listitem">   -- Committee cards
<footer role="contentinfo">
```

### Committee Card Layout

| Zone | Content |
|------|---------|
| Header | Committee name + type badge (standing/ad-hoc/special) |
| Status | Status badge (active/expired/dissolved) |
| Chairperson | Name + avatar (or "No chairperson" warning) |
| Members | Member count + avatar stack |
| Stats | Open tasks count, next meeting date |
| Actions | View detail link |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| President | Full list + Create button | -- | -- |
| Officer | Full list + Create button | -- | -- |
| Member (active) | Active committees | Dissolved (officers only, INFERRED), Create button | -- |
| Chairperson | Full list | Create button (unless also officer) | Own committee highlighted |
| Platform admin | -- | All (org-scoped) | -- |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | 3-column card grid |
| 768-1023px | 2-column card grid |
| < 768px | 1-column card stack |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No committees yet." + Create CTA (for officers) |
| Loading | Skeleton cards (6) in grid |
| Loaded | Committee cards rendered with tab filters |
| Error | "Failed to load committees." retry |
| Tab filtering | Skeleton overlay, tabs stay interactive |
| Partial | Paginated with "Load more" |
| Leaderless warning | Card shows amber warning: "No chairperson assigned" on affected committees |
| Unauthorized | Redirect to `/auth/sign-in` |
| Forbidden | "You must be an org member to view committees." |

---

## M19-S02: Committee Detail

**Route:** `/org/:orgId/committees/:committeeId`
**Workflow:** WF-105, WF-106, WF-107
**Auth:** GA (members view), GA+HG (chairperson/president manage)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Committees > {name}
<main role="main">
  <section aria-label="Committee overview">
    <div role="status" aria-live="polite">  -- Leaderless warning
  <section aria-label="Committee members">
    <div role="toolbar" aria-label="Member actions">
    <table role="table" aria-label="Members">
  <section aria-label="Recent tasks">
    <div role="toolbar" aria-label="Task actions">
    <table role="table" aria-label="Tasks">
  <section aria-label="Upcoming meetings">
    <div role="toolbar" aria-label="Meeting actions">
    <ul role="list" aria-label="Meetings">
  <section aria-label="Committee actions">
    <div role="toolbar">
<footer role="contentinfo">
```

### Committee Overview Fields

| Field | Display |
|-------|---------|
| name | `<h1>` |
| type | Badge: standing / ad-hoc / special |
| status | Badge: active / expired / dissolved |
| purpose | `<p>` |
| chairperson | Name + role badge, or leaderless warning |
| termStart / termEnd | Formatted date range |
| memberCount | "{n} members" |

### Members Table

| Column | Content |
|--------|---------|
| Name | Person name (linked) |
| Role | Badge: chairperson / vice_chair / secretary / member |
| Joined | joinedAt formatted |
| Actions | Remove (chairperson/president only) |

### Tasks Table (Recent 5)

| Column | Content |
|--------|---------|
| Title | task title |
| Assignee | Person name or "Unassigned" |
| Due date | Formatted, overdue in red |
| Priority | Badge: low / medium / high |
| Status | Badge: pending / in_progress / completed |
| Actions | View / Update status |

### Meetings List (Upcoming 3)

| Field | Content |
|-------|---------|
| Date/time | scheduledAt formatted |
| Agenda | Truncated, expandable |
| Minutes | "Minutes available" link or "Pending" |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| President | Full detail + all actions + dissolve | -- | -- |
| Chairperson | Full detail + member/task/meeting management | Dissolve (unless also president) | -- |
| Committee member | Full detail + own task status updates | Add/remove members, schedule meetings, dissolve | -- |
| Regular member | Overview + member list + tasks (read-only) | All action buttons | -- |
| Dissolved committee | All sections read-only | All action buttons | Gray overlay, "Dissolved" banner |

### Leaderless State (M19-R1)

When chairperson is removed from org:
- Amber banner: "This committee has no chairperson. All changes are blocked until a new chairperson is assigned."
- All mutation buttons disabled (`aria-disabled="true"`)
- "Assign Chairperson" button shown for president/officers
- Committee data remains visible (read-only)

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton for all sections |
| Loaded | Full committee detail with all sections |
| Error | "Failed to load committee." retry |
| Not found | "Committee not found." back link |
| Leaderless | Amber banner, all mutations blocked, assign CTA |
| Dissolved | Gray "Dissolved" banner, all sections read-only, history preserved (M19-R5) |
| Expired | "Term ended" banner with renewal option (standing) or dissolve prompt (ad-hoc) |
| Adding member | Dialog with person search, role selector |
| Unauthorized | Redirect |

---

## M19-S03: Create Committee

**Route:** `/org/:orgId/committees/new`
**Workflow:** WF-104
**Auth:** GA+HG (president, officers)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Committees > New Committee
<main role="main">
  <form aria-label="Create committee">
    <section aria-label="Committee details">
    <section aria-label="Chairperson assignment">
<footer role="contentinfo">
```

### Fields & Controls

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Name | `<input type="text">` | `aria-required="true"` | Yes | 1-300 chars | name |
| Description | `<textarea>` | -- | No | Max 5000 chars | description |
| Type | Radio group | `role="radiogroup"`, `aria-required="true"` | Yes | standing, ad-hoc, special | type |
| Purpose | `<textarea>` | -- | No | Max 5000 chars | purpose |
| Chairperson | Person search combobox | `role="combobox"`, `aria-required="true"` | Yes | Must be active org member | chairpersonId |
| Term start | `<input type="date">` | -- | No | -- | termStart |
| Term end | `<input type="date">` | -- | No (required for ad-hoc) | Must be after termStart | termEnd |
| Create | `<button type="submit">` | -- | -- | -- | POST committee |

### Chairperson Search Combobox

- `role="combobox"` with `aria-autocomplete="list"`
- Dropdown: `role="listbox"` with `role="option"` items
- Shows person name, membership status
- Only active org members selectable
- `aria-label="Search for chairperson"`

### 9 States

| State | Behavior |
|-------|----------|
| Empty | Blank form, type defaults to "standing" |
| Loading (chairperson search) | Spinner in combobox dropdown |
| Filling | Form in progress |
| Submitting | Button spinner, fields disabled |
| Success | sonner toast "Committee created." redirect to committee detail |
| Validation error | Inline errors: name required, chairperson required (M19-R1), termEnd required for ad-hoc |
| No chairperson found | "No matching members found." in combobox dropdown |
| Person not org member (M19-004) | "Selected person is not an active organization member." |
| Unauthorized | Redirect |

---

## M19-S04: Edit Committee

**Route:** `/org/:orgId/committees/:committeeId/edit`
**Workflow:** WF-104
**Auth:** GA+HG (president, chairperson)

Same layout as M19-S03 with differences:

| Aspect | Create (S03) | Edit (S04) |
|--------|--------------|------------|
| Initial state | Empty form | Populated from GET committee |
| API call | POST | PUT |
| Chairperson | Required selection | Pre-populated, changeable |
| Type | Selectable | Read-only (cannot change type after creation) |
| Dissolved guard | N/A | Dissolved committees not editable (M19-007) |

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton form fields |
| Loaded | Populated form |
| Submitting | Button spinner, fields disabled |
| Success | sonner toast "Committee updated." redirect to detail |
| Validation error | Inline errors |
| Dissolved (M19-007) | Redirect with "Dissolved committees cannot be edited." |
| Expired (M19-005) | Warning: "Committee term has ended. Renew or dissolve." |
| Not found | "Committee not found." back link |
| Unauthorized | Redirect |

---

## M19-S05: Task Board

**Route:** `/org/:orgId/committees/:committeeId/tasks`
**Workflow:** WF-106
**Auth:** GA (committee members view), GA+HG (chairperson manage)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Committees > {name} > Tasks
<main role="main">
  <section aria-label="Task board">
    <div role="toolbar" aria-label="Task actions">
      <button>Create Task</button>  -- Chairperson only
      <select aria-label="Filter by status">
      <select aria-label="Filter by assignee">
    <div role="region" aria-label="Task columns">
      <section aria-label="Pending tasks">
        <h2>Pending</h2>
        <ul role="list">
      <section aria-label="In Progress tasks">
        <h2>In Progress</h2>
        <ul role="list">
      <section aria-label="Completed tasks">
        <h2>Completed</h2>
        <ul role="list">
<footer role="contentinfo">
```

### Task Card (within columns)

| Field | Content |
|-------|---------|
| Title | Task title |
| Assignee | Avatar + name, or "Unassigned" |
| Due date | Formatted, overdue highlight |
| Priority | Color-coded badge: low (gray), medium (amber), high (red) |
| Status actions | Move to next status button |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| Chairperson | Full board + Create + assign + all status changes | -- | -- |
| Committee member | Full board + own task status changes | Create, assign to others | Can only update own tasks |
| Regular member | Read-only board | All action buttons | -- |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No tasks yet." + Create CTA (chairperson) |
| Loading | Skeleton cards in 3 columns |
| Loaded | Kanban-style columns with task cards |
| Error | "Failed to load tasks." retry |
| Creating task | Slide-over panel with task form |
| Updating status | Optimistic card movement between columns |
| Update error | Card reverts to original column, sonner error |
| Overdue highlight | Red border on overdue task cards (M19-R3) |
| Dissolved/Leaderless | Read-only board, no actions |

### Create Task Panel Fields

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Title | `<input type="text">` | `aria-required="true"` | Yes | 1-300 chars | title |
| Description | `<textarea>` | -- | No | Max 5000 chars | description |
| Assignee | `<select>` | `aria-label="Assign to"` | No | Committee members only | assigneeId |
| Due date | `<input type="date">` | -- | No | Must be future | dueDate |
| Priority | Radio group | `role="radiogroup"` | No | low, medium, high | priority |
| Create | `<button type="submit">` | -- | -- | -- | POST task |

---

## M19-S06: Meeting Detail

**Route:** `/org/:orgId/committees/:committeeId/meetings/:meetingId`
**Workflow:** WF-107
**Auth:** GA (committee members view), chairperson (manage)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Committees > {name} > Meetings > {date}
<main role="main">
  <section aria-label="Meeting details">
    <h1>Meeting - {formatted date}</h1>
  <section aria-label="Agenda">
  <section aria-label="Minutes">
    <form aria-label="Record meeting minutes">  -- Chairperson only
<footer role="contentinfo">
```

### Fields

| Element | Type | ARIA | Editable By |
|---------|------|------|-------------|
| Scheduled date | `<time>` | `aria-label="Meeting date"` | Read-only (set at creation) |
| Agenda | `<div>` or `<textarea>` | `aria-label="Meeting agenda"` | Chairperson (before meeting) |
| Minutes | `<textarea>` | `aria-label="Meeting minutes"` | Chairperson (after meeting) |
| Save minutes | `<button>` | -- | Chairperson |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| Chairperson | Full detail + edit minutes | -- | -- |
| Committee member | Full detail (read-only) | Edit controls | -- |
| Regular member | -- | Entire screen (redirect to committee) | -- |

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton for all fields |
| Loaded (upcoming) | Agenda displayed, minutes section: "Minutes will be available after the meeting." |
| Loaded (past, no minutes) | Agenda + empty minutes form for chairperson |
| Loaded (past, with minutes) | Full detail, minutes read-only (or editable for chairperson) |
| Saving minutes | Button spinner, textarea disabled |
| Save success | sonner toast "Minutes saved." |
| Save error | sonner error toast |
| Not found | "Meeting not found." back link |
| Dissolved committee | Read-only, no edit controls |

---

## M19-S07: My Committees

**Route:** `/my/committees`
**Auth:** GA (active member)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > My Committees
<main role="main">
  <section aria-label="My committee assignments">
    <ul role="list" aria-label="Committees">
      <article role="listitem">   -- Committee cards
<footer role="contentinfo">
```

### Committee Card Layout

| Zone | Content |
|------|---------|
| Name | Committee name (linked to detail) |
| Role badge | My role in committee (chairperson/vice_chair/secretary/member) |
| Type badge | standing / ad-hoc / special |
| My tasks | "N open tasks assigned to you" |
| Next meeting | Date or "No upcoming meetings" |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "You are not a member of any committees." |
| Loading | Skeleton cards (3) |
| Loaded | Committee cards with personal task summaries |
| Error | "Failed to load committees." retry |
| Has overdue tasks | Red badge: "{n} overdue tasks" on relevant committee card |
| Meeting today | Highlight: "Meeting today at {time}" |
| Unauthorized | Redirect to `/auth/sign-in` |
| Removed from committee | Card disappears on next refresh (M19-R4 cascade) |
| Partial | Paginated with "Load more" |

---

## M19-S08: Committee Dissolution (Dialog)

**Trigger:** "Dissolve Committee" button on M19-S02
**Workflow:** WF-108
**Auth:** GA+HG (president, chairperson)

### ARIA Landmark Structure

```
<div role="alertdialog" aria-labelledby="dissolve-title" aria-describedby="dissolve-desc">
  <h2 id="dissolve-title">Dissolve Committee</h2>
  <p id="dissolve-desc">Warning text</p>
  <form aria-label="Dissolution form">
    <textarea aria-label="Reason for dissolution" aria-required="true">
    <div role="alert">  -- Open tasks warning
    <button>Cancel</button>
    <button>Dissolve</button>  -- Destructive
</div>
```

### Warning Messages

| Condition | Warning |
|-----------|---------|
| Standing committee | "This is a standing committee. Dissolution is permanent and cannot be undone. The committee will not auto-renew." |
| Ad-hoc committee | "Dissolving this committee will archive all data. Members will lose access." |
| Has open tasks | "This committee has {n} open tasks. They will be archived." |

### Fields

| Element | Type | ARIA | Required | Maps To |
|---------|------|------|----------|---------|
| Reason | `<textarea>` | `aria-required="true"`, `aria-label="Reason for dissolution"` | Yes | reason |
| Cancel | `<button>` | -- | -- | Close dialog |
| Dissolve | `<button>` (destructive) | `aria-label="Confirm dissolution"` | -- | POST dissolve |

### 9 States

| State | Behavior |
|-------|----------|
| Open | Dialog visible with warning + reason field |
| Submitting | Dissolve button spinner, fields disabled |
| Success | sonner toast "Committee dissolved." Dialog closes. Detail page shows dissolved state. |
| Error | sonner error toast. Dialog stays open. |
| Validation | "Reason is required." inline error |
| Already dissolved (M19-007) | Should not reach here (button hidden), but: "Committee is already dissolved." |
| Cancelled | Dialog closes, no changes |
| Keyboard trap | Focus trapped in dialog until dismissed |
| Escape | Close dialog (same as Cancel) |
