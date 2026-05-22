# Feed Post Detail

- **Route:** `/org/[id]/feed/post/[id]`
- **Module:** M13 Professional Feed
- **Access:** Member (must be active member of the org that owns the post, or of any org in the association if the post is network-visible)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show the full content of a single feed post — untruncated text, all attached images, full attribution — so members can read content that was cut off in the feed and share or react to it.

## Layout

### Desktop
Centered single-column view (max-width 680px). A back arrow at the top-left returns to the feed at the previous scroll position (preserved in history state, not a full page reload). Content flows from top to bottom: author block, post type badge, timestamp, full body text, image gallery (if any), reaction section.

### Mobile
Full-screen view. Back arrow in the top-left. Content is the same top-to-bottom flow as desktop but full-width. Image gallery is horizontally swipeable. The reaction button and count are fixed in a bottom bar so they are always accessible.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Back Arrow | Navigation | Returns to feed at previous scroll position. Does not reload the feed. |
| Sponsored Label | Amber banner | If `is_sponsored = true`, a full-width amber header "Sponsored" appears above the post content. Never hideable. |
| Pinned Indicator | Label | If the post is pinned, "Pinned by [Org Name]" shown with a pin icon below the author block. |
| Author Block | Profile row | Member photo (or initials). Author name. Officer role label if the author is an officer (e.g., "Secretary, PDA Metro Manila"). Org name and org logo (tapping the org name does nothing — org navigation is via the sidebar/tab bar, not this link). Absolute timestamp ("April 15, 2026 at 2:30 PM"). |
| Post Type Badge | Chip | Post type icon + label (Announcement, Event Highlight, Training Opportunity, Achievement, Clinical Update). |
| Post Body | Rich text | Full untruncated text. No "Read more" truncation on this screen. |
| Image Gallery | Horizontal swipe (mobile) / Grid (desktop) | All attached images displayed. Mobile: swipeable full-width images with a dot indicator for position. Desktop: 2-column grid for 2+ images, full-width for single image. Tapping an image opens a full-screen lightbox with pinch-to-zoom. |
| Reaction Section | Reaction bar | Thumbs-up icon + current count. Tapping toggles the member's reaction (optimistic update). Count is the only thing visible — no list of who reacted. |
| Training Register CTA | Button | Shown only if post type is "Training Opportunity" and the linked training is still open for enrollment. "Register for this training" button navigates to the training detail screen. |
| Event Register CTA | Button | Shown only if post type is "Event Highlight" referencing an upcoming event still open for registration. "Register for this event" navigates to the event detail screen. |
| Three-dot Menu | Context menu | Same options as on the feed card: "Mute this org" (member), "Remove post" (officer), "Report" (member). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton: author block placeholder, body text placeholder, image placeholders. |
| Loaded | Post exists and member has access | Full post content rendered. |
| Post removed | Post was removed by officer or admin before this member opened it | "This post is no longer available." with a back button. |
| No access | Member navigates directly to a post from an org they don't belong to | "You don't have access to this post." with a back button to their own feed. |
| Sponsored | Post is a sponsored post | Amber "Sponsored" banner at top. All other content renders normally. |
| Error | API failure | "Unable to load this post. Try again." with retry button. |

## Interactions

- **Back navigation:** The back arrow uses browser/app history to return to the feed at the exact scroll position the member was at before tapping the post. This is critical — members browse the feed, open a post, and expect to land back in the same place when they close it.
- **Image lightbox:** Tapping any image in the gallery opens a full-screen black lightbox. Mobile: horizontal swipe between images. Desktop: left/right arrows. Tap outside or press Escape to close. Pinch-to-zoom on mobile.
- **Reaction toggle:** Tapping the reaction icon is an optimistic update — the count increments immediately in the UI while the API call fires in the background. On API failure, the count reverts with a silent retry. No error message shown for reaction failures (low stakes action).
- **Direct URL access:** Members who receive a deep link to a post (e.g., from a notification) and are not logged in are redirected to login, then returned to this URL after authentication. Members who are logged in but not members of the relevant org see the "no access" state.
- **No comments in Phase 2:** This is a broadcast feed, not a discussion forum. There is no comment input, no thread, no replies. The only social interaction is the reaction count.
