<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M18 Surveys & Polls -- Screen Specifications

## Screen Index

| Screen ID | Name | Route | Primary Actor | Workflow |
|-----------|------|-------|---------------|----------|
| M18-S01 | Survey List (Officer) | `/org/:orgId/surveys` | Officer | WF-100 |
| M18-S02 | Survey Builder | `/org/:orgId/surveys/new` | Officer | WF-100 |
| M18-S03 | Survey Editor | `/org/:orgId/surveys/:surveyId/edit` | Officer | WF-100 |
| M18-S04 | Survey Results | `/org/:orgId/surveys/:surveyId/results` | Officer | WF-102 |
| M18-S05 | My Surveys (Member) | `/my/surveys` | Member | WF-101 |
| M18-S06 | Survey Response Form | `/my/surveys/:surveyId/respond` | Member | WF-101 |
| M18-S07 | Quick Poll (Inline) | Embedded component | Officer/Member | WF-103 |
| M18-S08 | Poll Creator | `/org/:orgId/polls/new` | Officer | WF-103 |

---

## M18-S01: Survey List (Officer)

**Route:** `/org/:orgId/surveys`
**Workflow:** WF-100 (Create Survey)
**Auth:** GA+HG (president, secretary, officer)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Surveys
<main role="main">
  <section aria-label="Survey management">
    <div role="toolbar" aria-label="Survey actions">
      <button>Create Survey</button>
      <button>Create Poll</button>
    <div role="tablist" aria-label="Survey status filter">
      <button role="tab">All</button>
      <button role="tab">Draft</button>
      <button role="tab">Active</button>
      <button role="tab">Closed</button>
    <table role="table" aria-label="Surveys">
<footer role="contentinfo">
```

### Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Title | title (linked to results or editor) | Yes |
| Type | Badge: anonymous / identified | No |
| Status | Badge: draft / active / closed | Yes |
| Responses | totalResponses count | Yes |
| Deadline | formatted date or "No deadline" | Yes |
| Created | createdAt | Yes |
| Actions | Edit (draft) / Results (active/closed) / Close (active) | -- |

### Action Rules per Status

| Status | Available Actions |
|--------|-------------------|
| draft | Edit, Publish, Delete |
| active | View Results, Close |
| closed | View Results, Export CSV |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| President/Secretary | Full CRUD, publish, close | -- | -- |
| Officer | Full CRUD, publish, close | -- | -- |
| Member | -- | Entire screen (use M18-S05 instead) | -- |
| Platform admin | Read-only list | Create/edit/publish actions | -- |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Full table with all columns |
| 768-1023px | Hide Created column, compact actions |
| < 768px | Card list: title, status badge, response count, action menu |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No surveys yet. Create your first survey." + CTA |
| Loading | Skeleton table rows (5) |
| Loaded | Survey table rendered with tab filters |
| Error | "Failed to load surveys." retry |
| Partial | Paginated with "Load more" |
| Tab filtering | Skeleton overlay, tabs stay interactive |
| Publishing | Confirmation dialog: "Publish survey? Members will be notified." |
| Closing | Confirmation dialog: "Close survey? No more responses will be accepted." |
| Unauthorized | Redirect to `/auth/sign-in` |

---

## M18-S02: Survey Builder

**Route:** `/org/:orgId/surveys/new`
**Workflow:** WF-100
**Auth:** GA+HG (president, secretary, officer)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Surveys > New Survey
<main role="main">
  <form aria-label="Create survey">
    <section aria-label="Survey settings">
    <section aria-label="Questions">
      <div role="list" aria-label="Question list">
        <div role="listitem">     -- Repeatable question blocks
    <section aria-label="Distribution settings">
<footer role="contentinfo">
```

### Survey Settings Fields

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Title | `<input type="text">` | `aria-required="true"` | Yes | 1-300 chars | title |
| Type | Radio group | `aria-required="true"`, `role="radiogroup"` | Yes | anonymous, identified | type |
| Deadline | `<input type="datetime-local">` | -- | No | Must be future | deadline |

### Question Builder Fields

| Element | Type | ARIA | Required | Constraints |
|---------|------|------|----------|-------------|
| Question label | `<input type="text">` | `aria-required="true"` | Yes | 1-500 chars |
| Question type | `<select>` | `aria-label="Question type"` | Yes | multiple_choice, rating, text, checkbox |
| Required toggle | `<switch>` | `aria-label="Required question"` | No | Default: true |
| Options (MC/checkbox) | Dynamic list | `role="list"` | Yes (for MC/checkbox) | Min 2 options |
| Rating scale | `<select>` | `aria-label="Rating scale"` | Yes (for rating) | 1-5, 1-10 |
| Add option | `<button>` | `aria-label="Add option"` | -- | -- |
| Remove option | `<button>` | `aria-label="Remove option {n}"` | -- | Min 2 |
| Add question | `<button>` | `aria-label="Add question"` | -- | -- |
| Remove question | `<button>` | `aria-label="Remove question {n}"` | -- | Min 1 for publish |
| Reorder | Drag handle | `aria-label="Reorder question"`, `aria-roledescription="sortable"` | -- | -- |

### Distribution Settings Fields

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Target audience | `<select>` | `aria-label="Target audience"` | No | all_members, category_filter, manual | distribution |
| Category filter | `<select>` (multi) | `aria-label="Member categories"` | Conditional | If category_filter selected | distributionFilter |

### Form Actions

| Button | Behavior |
|--------|----------|
| Save as Draft | POST /surveys with status: draft |
| Save & Publish | POST /surveys then POST /surveys/:id/publish |
| Cancel | Navigate back with unsaved changes warning |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | Blank form with defaults (type: anonymous, 1 empty question) |
| Loading | N/A (new form) |
| Building | Form in progress, questions being added |
| Submitting | Button spinner, all fields disabled |
| Save success | sonner toast "Survey saved as draft." or "Survey published." |
| Validation error | Inline errors: title required, min 1 question for publish, deadline required for publish |
| Publish validation | "Survey must have at least 1 question and a deadline to publish." |
| Unsaved changes | Browser beforeunload + in-app dialog on navigation |
| Unauthorized | Redirect to `/auth/sign-in` |

---

## M18-S03: Survey Editor

**Route:** `/org/:orgId/surveys/:surveyId/edit`
**Workflow:** WF-100
**Auth:** GA+HG (president, secretary, officer)

Identical layout to M18-S02 with differences:

### Differences from Builder

| Aspect | Builder (S02) | Editor (S03) |
|--------|---------------|--------------|
| Initial state | Empty form | Populated from GET survey |
| API call | POST | PUT |
| Publish button | Save & Publish | Publish (if still draft) |
| Status guard | N/A | Only draft surveys editable |

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton form fields |
| Loaded | Populated form, all fields editable |
| Not draft | "This survey can no longer be edited." with redirect to results |
| Not found | "Survey not found." back link |
| Submitting | Button spinner, fields disabled |
| Save success | sonner toast "Survey updated." |
| Publish success | sonner toast "Survey published. Members notified." redirect to results |
| Validation error | Same as S02 |
| Unauthorized | Redirect |

---

## M18-S04: Survey Results

**Route:** `/org/:orgId/surveys/:surveyId/results`
**Workflow:** WF-102
**Auth:** GA+HG (president, secretary, officer -- own org)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Surveys > {title} > Results
<main role="main">
  <section aria-label="Survey overview">
    <div role="status" aria-live="polite">  -- Response count
  <section aria-label="Question results">
    <div role="list" aria-label="Per-question results">
      <article role="listitem">   -- Per question
  <section aria-label="Export">
    <button>Export CSV</button>
<footer role="contentinfo">
```

### Survey Overview

| Element | Content |
|---------|---------|
| Title | Survey title |
| Type badge | anonymous / identified |
| Status badge | draft / active / closed |
| Response count | "{totalResponses} responses" (with eligibleCount if available) |
| Deadline | Formatted date or "No deadline" |

### Per-Question Result Display

| Question Type | Visualization |
|---------------|---------------|
| multiple_choice | Horizontal bar chart with percentages + option labels |
| checkbox | Horizontal bar chart (multiple selections allowed) |
| rating | Average score display + star rating + distribution histogram |
| text | Scrollable list of text responses (truncated, expandable) |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| Officer (own org) | Full results + export | Individual respondent IDs (for anonymous) | -- |
| Officer (identified survey) | Full results + individual response links | -- | -- |
| Platform admin | -- | Individual identified responses (M18-R2) | Aggregate only |
| Member | -- | Entire screen | -- |

### 9 States

| State | Behavior |
|-------|----------|
| Empty (no responses) | "No responses yet." (if active: "Waiting for member responses.") |
| Loading | Skeleton for overview + question result blocks |
| Loaded | Full results dashboard |
| Error | "Failed to load results." retry |
| Exporting | "Generating CSV..." spinner on export button |
| Export success | Browser download triggered, sonner toast "Export complete." |
| Export error | sonner error toast "Export failed." |
| Survey active | Live counter with `aria-live="polite"`, auto-refresh option |
| Unauthorized | Redirect |

---

## M18-S05: My Surveys (Member)

**Route:** `/my/surveys`
**Workflow:** WF-101
**Auth:** GA (active member)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > My Surveys
<main role="main">
  <section aria-label="Pending surveys">
    <ul role="list" aria-label="Surveys awaiting response">
  <section aria-label="Completed surveys">
    <ul role="list" aria-label="Surveys you've completed">
<footer role="contentinfo">
```

### Survey Card Layout

| Zone | Content |
|------|---------|
| Title | Survey title (linked to respond form) |
| Type badge | anonymous / identified |
| Deadline | "Due {date}" or "No deadline" |
| Status indicator | "Pending" / "Completed" |
| Description | Brief survey description if available |

### 9 States

| State | Behavior |
|-------|----------|
| Empty (no surveys) | "No surveys available." |
| Loading | Skeleton cards (3) |
| Loaded | Pending section + completed section |
| Error | "Failed to load surveys." retry |
| No pending | "All caught up! No pending surveys." |
| Deadline approaching | Warning badge: "Due in {n} days" (amber when < 3 days) |
| Deadline passed | "Deadline passed" badge, link disabled |
| Already responded | Card shows "Completed" with checkmark, links to view (if editable) |
| Unauthorized | Redirect to `/auth/sign-in` |

---

## M18-S06: Survey Response Form

**Route:** `/my/surveys/:surveyId/respond`
**Workflow:** WF-101
**Auth:** GA (active member, targeted)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > My Surveys > {title}
<main role="main">
  <section aria-label="Survey information">
    <h1>{title}</h1>
    <p>Type badge, deadline</p>
  <form aria-label="Survey response">
    <fieldset> per question
      <legend>{question label}</legend>
      -- question-type-specific input
    <div role="group" aria-label="Form actions">
      <button>Submit</button>
<footer role="contentinfo">
```

### Question Type Inputs

| Question Type | Input | ARIA |
|---------------|-------|------|
| multiple_choice | `<fieldset>` with `<input type="radio">` per option | `role="radiogroup"`, `aria-required` if required |
| checkbox | `<fieldset>` with `<input type="checkbox">` per option | `role="group"`, `aria-required` if required |
| rating | Star rating or number selector | `role="radiogroup"`, `aria-label="Rating from 1 to {max}"` |
| text | `<textarea>` | `aria-label="{question label}"`, `aria-required` if required |

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton for survey info + question blocks |
| Loaded | Full form with all questions rendered |
| Filling | Form in progress, partial answers |
| Submitting | Button spinner, fields disabled |
| Success | sonner toast "Response submitted." redirect to `/my/surveys` |
| Validation error | Inline: "This question is required." on unanswered required questions |
| Already responded (edit allowed) | Pre-populated form, "Update Response" button |
| Already responded (edit disabled, M18-002) | "You have already responded to this survey." read-only |
| Survey closed (M18-001) | "This survey is closed. Responses are no longer accepted." |
| Deadline passed (M18-003) | "The deadline for this survey has passed." |
| Not targeted (AUTHZ-001) | "You are not eligible for this survey." |
| Unauthorized | Redirect to `/auth/sign-in` |

---

## M18-S07: Quick Poll (Inline Component)

**Workflow:** WF-103
**Auth:** GA (active member to vote), GA+HG (officer to create)

### ARIA Landmark Structure

```
<article aria-label="Poll: {question}">
  <h3>{question}</h3>
  <form aria-label="Vote on poll">     -- Before voting
    <fieldset>
      <legend class="sr-only">Select an option</legend>
      <div role="radiogroup">
        <label><input type="radio"> {option}</label>
    <button>Vote</button>
  <div aria-label="Poll results">      -- After voting
    <div role="list">                  -- Result bars
    <p role="status">{totalVotes} votes</p>
</article>
```

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton question + option placeholders |
| Ready to vote | Radio options visible, Vote button enabled |
| Voting | Button spinner, radios disabled |
| Voted (results) | Options replaced with bar chart + percentages (M18-R4) |
| Already voted | Results shown immediately on load |
| Poll closed | Results shown, "Poll closed" badge |
| Error | "Failed to submit vote." retry inline |
| Validation | "Please select an option." if none selected |
| Unauthorized | "Sign in to vote." link |

---

## M18-S08: Poll Creator

**Route:** `/org/:orgId/polls/new`
**Workflow:** WF-103
**Auth:** GA+HG (officer)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">
<main role="main">
  <form aria-label="Create poll">
    <section aria-label="Poll question">
    <section aria-label="Poll options">
      <div role="list">
    <section aria-label="Poll settings">
<footer role="contentinfo">
```

### Fields & Controls

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Question | `<input type="text">` | `aria-required="true"` | Yes | 1-500 chars | question |
| Options | Dynamic list of `<input>` | `aria-label="Option {n}"` | Yes | Min 2, max 10 | options[] |
| Add option | `<button>` | `aria-label="Add option"` | -- | Max 10 | -- |
| Remove option | `<button>` | `aria-label="Remove option {n}"` | -- | Min 2 | -- |
| Deadline | `<input type="datetime-local">` | -- | No | Must be future | deadline |
| Create | `<button type="submit">` | -- | -- | -- | POST poll |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | Blank form with 2 empty option fields |
| Building | Adding/removing options |
| Submitting | Button spinner, fields disabled |
| Success | sonner toast "Poll created." redirect to survey list |
| Validation error | Inline: question required, min 2 options |
| Option limit | Add button disabled at 10 options |
| Duplicate options | "Options must be unique." inline error |
| Unauthorized | Redirect |
| Error | sonner error toast |
