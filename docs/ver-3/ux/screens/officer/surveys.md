# Surveys & Polls List

- **Route:** `/org/[id]/officer/surveys`
- **Module:** M18 Surveys & Polls
- **Access:** President, Officers
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives officers a view of all surveys and polls created for the organization — active, draft, and closed — with quick status visibility and a path to create new surveys or polls.

## Layout

### Desktop
Sidebar with Surveys active. Main content: a filter tab strip (All / Active / Draft / Closed) and a card list below. "Create Survey" button in the top right.

### Mobile
Full-screen scrollable card list. Tab strip at top for filtering. "Create Survey" is a floating action button at the bottom right.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Filter tabs | Tab strip | All / Active / Draft / Closed. Defaults to "All." |
| Survey card | Card | Shows: title, type badge (Survey or Poll), anonymity badge (Anonymous / Identified), status badge (Draft / Active / Closed), response count, response deadline (if set), distribution scope. |
| Type badge | Badge | Survey (blue) or Poll (teal). |
| Anonymity badge | Badge | Anonymous (gray) or Identified (amber). |
| Status badge | Colored badge | Draft (gray), Active (green), Closed (red). |
| Response count | Text | "X responses" for active/closed surveys. Hidden for drafts. |
| Response deadline | Text | "Closes [date]" for active surveys with a deadline. "Open-ended" if no deadline. |
| Create Survey button | Primary button | Navigates to /org/[id]/officer/surveys/new. |
| Quick actions | Three-dot menu per card | Edit (drafts only), View Results, Close Survey (active only). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton survey cards with shimmer. |
| Empty | No surveys created | Empty state: "No surveys or polls yet. Create one to gather structured feedback from your members." CTA: "Create Survey." |
| Empty — filtered | Filter returns no results | "No surveys match this filter." |
| Populated | Surveys exist | Card list per filter. Sorted by most recently created first. |
| Survey closed | Deadline passed or officer closed | Status badge changes to Closed (red). Response count frozen. "View Results" is the only available action. |

## Interactions

- Clicking a survey card navigates to /org/[id]/officer/surveys/[id] (the survey detail/management view).
- "View Results" from the quick actions menu navigates directly to /org/[id]/officer/surveys/[id]/results, skipping the detail page.
- "Close Survey" from the quick actions triggers a confirmation dialog: "Close this survey? Members will no longer be able to respond. This cannot be undone." Confirm / Cancel.
- Polls appear in the same list alongside surveys, distinguished by the type badge.
- Draft surveys are only visible to officers. Members cannot see or respond to draft surveys.
- Active surveys with a response deadline show a countdown for the final 24 hours: "Closes in X hours."
