<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Screens: Professional Feed (M13)

## Blueprint Purpose

This UI Blueprint provides comprehensive UI specification for the Professional Feed module.

Based on:
- Module Spec: docs/product/modules/m13-professional-feed/MODULE_SPEC.md
- Domain Glossary: docs/product/DOMAIN_GLOSSARY.md
- Role Permission Matrix: docs/product/ROLE_PERMISSION_MATRIX.md
- API Contracts: docs/product/modules/m13-professional-feed/API_CONTRACTS.md

**This blueprint is not the source of product truth.** Final implementation must follow the PRD, module spec, slice spec, test plan, and architecture.

---

## Screen: Feed Main

**Purpose:** Professional content feed for organization members
**Route:** `/org/[id]/feed`
**Primary Users/Roles:** Active members (browse), Officers — Secretary, President, VP (create/moderate)
**Related Workflow:** WF-080 (Browse Feed), WF-082 (Content Moderation), WF-083 (Mute/Unmute)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Feed Main

### ARIA Landmark Structure

```
<header role="banner">              -- app header, org name, breadcrumb
<nav role="navigation">             -- primary nav, org-level tabs
<main role="main">
  <section aria-label="Feed filters">     -- post type filter chips
  <section aria-label="Feed posts">       -- infinite scroll post list
    <article aria-label="Post by {authorName}"> -- each post card
  <aside role="complementary">            -- "New Post" CTA (officers), mute controls
<footer role="contentinfo">         -- load more indicator, scroll-to-top
```

### Focus Management

- **Initial focus on load:** First post card in the feed list
- **Focus after create action:** Newly created post card at top of feed
- **Focus after delete/hide action:** Next post card in the list
- **Focus after modal close:** Return to trigger element (post action menu)
- **Focus trap:** Report post modal
- **Skip link:** "Skip to feed posts"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Author avatar | Yes | data.author.avatarUrl | Fallback to initials |
| Author name | Yes | data.author.displayName | Full name |
| Post type icon | Yes | data.postType | Enum badge: Announcement, EventHighlight, etc. |
| Post body | Yes | data.body | Max 2000 chars, truncated at 280 with "Read more" |
| Post images | No | data.imageUrls | Up to 4, lightbox on click |
| Timestamp | Yes | data.createdAt | Relative time ("2h ago"), tooltip shows absolute |
| Visibility badge | Yes | data.visibility | "Network" badge if visibility=network |
| Post status | Officers only | data.status | Badge for hidden/draft posts |
| Like count | Yes | data.likeCount | [INFERRED] |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Filter by post type | Filter chips for post type enum | All authenticated | -- |
| New Post | Open create post form/modal | Officers (Secretary, President) only | -- |
| Like/Bookmark | Toggle engagement on post | Active members only (M13-R1) | Enter on focused post action |
| Mute author | Hide author's posts from feed | Any authenticated member | -- |
| Unmute author | Restore muted author's posts | Any authenticated member | -- |
| Report post | Flag post for moderation | Any authenticated member | -- |
| Hide post | Moderate — hide post (reversible) | Officers (Secretary, President) | -- |
| Remove post | Moderate — remove post (terminal) | Officers (Secretary, President) | -- |
| Unhide post | Restore hidden post | Officers (Secretary, President) | -- |
| Infinite scroll | Load next page of posts | All | -- |

### Role-Variant Matrix

| UI Element | Platform Admin | National Officer | Secretary/President | Treasurer/Board/Officer/Staff | Active Member | Grace/Lapsed Member |
|---|---|---|---|---|---|---|
| Feed post list | visible | visible | visible | visible | visible | visible (read-only) |
| New Post button | visible | visible | visible | hidden | hidden | hidden |
| Post action menu (hide/remove) | visible | visible | visible | hidden | hidden | hidden |
| Like/Bookmark buttons | visible | visible | visible | visible | visible | disabled + tooltip |
| Mute/Unmute | visible | visible | visible | visible | visible | visible |
| Report post | visible | visible | visible | visible | visible | visible |
| Hidden post indicator | visible | visible | visible | hidden | hidden | hidden |
| Draft post indicator | visible | visible | visible | hidden | hidden | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Two-column: feed list center (max-w-2xl), sidebar right with filters and CTA |
| Tablet (768-1024px) | Single column, filters collapse to horizontal scroll chips above feed |
| Mobile (<768px) | Full-width cards, sticky filter bar at top, FAB for "New Post" (officers) |

### Layout Notes
- Feed uses infinite scroll with intersection observer
- Post cards are full-width within content column
- Image grid: 1 image = full width, 2 = side-by-side, 3-4 = 2x2 grid
- Post type filter is sticky below header on scroll

### States

- **Default:** Paginated post list, newest first, filtered by selected org
- **Loading:** Skeleton cards (3-4) with shimmer animation, matching post card layout
- **Empty:** Illustration + "No posts yet" message. Officers see "Create the first post" CTA. Members see "Check back soon."
- **Success:** After post creation — sonner toast "Post published" + new post appears at top
- **Validation Error:** N/A (read-only screen; validation errors on create post form)
- **Permission Error:** Grace/Lapsed members see banner: "Upgrade membership to engage with posts" with renewal CTA
- **Unexpected Error:** "Unable to load feed. Try again." with retry button
- **Conflict/Duplicate Warning:** N/A
- **Offline/Sync:** "You're offline. Showing cached posts." banner with last-synced timestamp

### Validation Behavior
- Post type filter: client-side only, no validation needed
- Infinite scroll: automatic, no user validation

### Permission-Based UI Behavior
- Non-active members (M13-R1): feed is read-only, like/bookmark buttons disabled with tooltip
- Non-officers: "New Post" button hidden, moderation actions hidden
- Muted authors: posts hidden from muter's feed only (M13-R3)

### Edge Cases
- Member belongs to multiple orgs: feed shows selected org's posts only
- Network-visibility posts (M13-R2): visible across all orgs in association
- Post with 4 images on mobile: 2x2 grid, tap to expand

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.

---

## Screen: Create Post

**Purpose:** Compose and publish a new feed post
**Route:** Inline on feed page or modal overlay
**Primary Users/Roles:** Officers (Secretary, President)
**Related Workflow:** WF-081 (Create Post)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Create Post

### ARIA Landmark Structure

```
<dialog role="dialog" aria-label="Create new post" aria-modal="true">
  <header>                          -- modal title "New Post"
  <main role="main">
    <form role="form" aria-label="Create post form">
      <section aria-label="Post content">    -- type selector, body, images
      <section aria-label="Post settings">   -- visibility toggle
  <footer>                          -- publish/draft buttons, cancel
</dialog>
```

### Focus Management

- **Initial focus on load:** Post type selector
- **Focus after create action:** Redirect focus to new post card in feed
- **Focus after cancel:** Return to "New Post" trigger button
- **Focus trap:** Yes, within modal dialog
- **Skip link:** N/A (modal)

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Post type | Yes | postType | Enum select: Announcement, EventHighlight, TrainingOpportunity, Achievement, ClinicalUpdate |
| Body text | Yes | body | Textarea, max 2000 chars with live counter |
| Images | No | imageUrls | Upload up to 4, drag-drop or file picker |
| Visibility | Yes | visibility | Toggle: "Org only" (default) or "Network" |
| Status | Yes | status | "Publish" (default) or "Save as Draft" |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Select post type | Choose content category | Officers only | Arrow keys in selector |
| Upload images | Add up to 4 images | Officers only | Enter on upload zone |
| Remove image | Remove uploaded image | Officers only | Delete/Backspace on image |
| Toggle visibility | Switch org/network scope | Officers only | Space on toggle |
| Publish | Submit as published | Officers only | Ctrl+Enter |
| Save as Draft | Submit as draft | Officers only | -- |
| Cancel | Discard and close | Officers only | Escape |

### Role-Variant Matrix

| UI Element | Secretary/President | All Other Roles |
|---|---|---|
| Entire form | visible + editable | hidden (button not rendered) |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Centered modal (max-w-lg), image upload grid |
| Tablet (768-1024px) | Full-width modal with padding |
| Mobile (<768px) | Full-screen sheet, camera option added to image upload |

### Layout Notes
- Character counter changes color: green (<1500), yellow (1500-1900), red (>1900)
- Image preview thumbnails in 2x2 grid within form
- Publish button is primary CTA, draft is secondary

### States

- **Default:** Blank compose form with post type selector focused
- **Loading:** Submitting spinner on publish button, form fields disabled
- **Empty:** Blank form (initial state)
- **Success:** Post published — sonner toast "Post published successfully", modal closes, new post appears in feed
- **Validation Error:** Inline field errors — "Body is required", "Body exceeds 2000 characters" (M13-R4), "Maximum 4 images allowed" (M13-R5)
- **Permission Error:** Button hidden for non-officers; if somehow reached, "Only officers can create posts"
- **Unexpected Error:** "Failed to publish. Draft saved." with retry option
- **Conflict/Duplicate Warning:** N/A
- **Offline/Sync:** "You're offline. Post saved as draft." with auto-publish on reconnect option

### Validation Behavior
- Body: required, max 2000 chars (M13-R4) — live counter, error on blur if empty
- Images: max 4 (M13-R5) — upload button disabled after 4, error toast if drag-drop exceeds
- Post type: required — error on submit if not selected
- All validation client-side + server-side

### Permission-Based UI Behavior
- Only officers see the "New Post" button that opens this form
- Non-officers cannot access this screen

### Edge Cases
- Large image upload: show progress bar per image
- Network timeout during publish: auto-save as draft, retry prompt
- Body exactly 2000 chars: counter shows "0 remaining" in red, no error

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.
