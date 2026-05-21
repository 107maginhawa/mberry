<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Interaction States: Professional Feed (M13)

---

## Loading State

**When it appears:** Initial feed load, infinite scroll next page, post creation submission, mute/unmute API call
**Expected UI behavior:**
- Feed load: 3-4 skeleton post cards with shimmer animation matching PostCard dimensions (avatar circle, text lines, image placeholder)
- Infinite scroll: single skeleton card appended at bottom with "Loading more..." aria-live region
- Post submission: publish button shows spinner, form fields disabled
- Mute toggle: button icon replaced with spinner

---

## Empty State

**When it appears:** No posts in organization feed, filter returns zero results
**Expected UI behavior:**
- No posts at all:
  - Illustration (empty feed graphic)
  - Officers: "No posts yet. Create the first post for your organization." + "New Post" CTA button
  - Members: "No posts yet. Check back soon for updates from your organization."
- Filter returns nothing: "No {postType} posts found. Try a different filter." with "Clear filters" link
- aria-live="polite" announces empty state to screen readers

---

## Success State

**When it appears:** Post published, post saved as draft, post hidden, post removed, post unhidden, author muted/unmuted, post reported
**Expected UI behavior:**
- Post published: sonner toast "Post published successfully" (3s), new post appears at top of feed with brief highlight animation
- Draft saved: sonner toast "Post saved as draft" (3s), modal closes
- Post hidden: sonner toast "Post hidden" (3s) with "Undo" action (5s window)
- Post removed: sonner toast "Post removed" (3s), post fades out of feed
- Post unhidden: sonner toast "Post restored" (3s), post reappears
- Author muted: sonner toast "Author muted. Their posts are hidden from your feed." (4s)
- Author unmuted: sonner toast "Author unmuted" (3s)
- Post reported: sonner toast "Post reported. We'll review it shortly." (4s)

---

## Validation Error State

**When it appears:** Create post form submission with invalid data
**Expected UI behavior:**
- Field-level errors displayed inline below each invalid field
- Error fields highlighted with red border and error icon
- Focus moves to first invalid field
- Error messages:
  - Body empty: "Post body is required"
  - Body > 2000 chars (M13-R4): "Post body must be 2000 characters or fewer"
  - Images > 4 (M13-R5): "Maximum 4 images allowed"
  - Post type not selected: "Please select a post type"
- Character counter turns red and shows negative count
- aria-invalid="true" on invalid fields
- aria-describedby links field to error message
- Error summary announced via aria-live="assertive"

---

## Permission Error State

**When it appears:** Non-active member attempts engagement action, non-officer attempts moderation
**Expected UI behavior:**
- Grace/Lapsed member on feed (M13-R1):
  - Feed is read-only
  - Like/bookmark buttons disabled with tooltip: "Active membership required to engage"
  - Banner at top: "Your membership is inactive. Renew to engage with posts." + "Renew" CTA
- Non-officer attempts to reach create post:
  - "New Post" button not rendered (server-side permission check)
  - If URL directly accessed: redirect to feed with sonner toast "Only officers can create posts"
- AUTHZ-001 (403): "You don't have permission to perform this action"
- AUTHZ-002 (403): "You must be a member of this organization"

---

## Unexpected Error State

**When it appears:** Network failure, server 500, timeout during feed load or post actions
**Expected UI behavior:**
- Feed load failure: "Unable to load feed. Please try again." with "Retry" button centered in content area
- Post creation failure: "Failed to publish post. Your draft has been saved." with "Try Again" and "Close" buttons
- Mute/report failure: sonner toast (error variant, 5s) "Something went wrong. Please try again."
- All errors log correlation ID for support
- Retry button re-triggers the failed request
- aria-live="assertive" announces error

---

## Conflict / Duplicate Warning State

**When it appears:** Attempt to mute an already-muted author (M13-005), attempt to remove an already-removed post (M13-003)
**Expected UI behavior:**
- Already muted (M13-005): sonner toast "You've already muted this author" (info variant, 3s)
- Already removed (M13-003): sonner toast "This post has already been removed" (info variant, 3s)
- UI refreshes to reflect current state

---

## Confirmation / Warning State

**When it appears:** Remove post (terminal action), report post
**Expected UI behavior:**
- Remove post: AlertDialog with "Remove this post? This action cannot be undone." + "Remove" (destructive) and "Cancel" buttons
- Report post: Dialog with reason textarea and "Submit Report" / "Cancel" buttons
- Focus trapped in confirmation dialog
- Escape key dismisses (cancel)
- Consequences clearly stated before destructive action

---

## Offline / Sync State

**When it appears:** Network unavailable while browsing feed or composing post
**Expected UI behavior:**
- Browsing: Banner at top "You're offline. Showing cached posts." with last-synced timestamp
- Composing: "You're offline. Post will be saved as draft and published when you reconnect."
- Draft auto-saved to local storage
- Engagement actions (like/mute) queued and synced on reconnect
- Online restore: banner dismissed, feed refreshed, queued actions processed
- aria-live="polite" announces connectivity changes

---

## Per-Screen Completeness Score

| Screen | States Defined | States Missing | Score |
|--------|---------------|---------------|-------|
| Feed Main | 9/9 | none | COMPLETE |
| Create Post | 9/9 | none | COMPLETE |
