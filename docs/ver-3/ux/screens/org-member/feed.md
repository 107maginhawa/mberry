# Professional Feed

- **Route:** `/org/[id]/feed`
- **Module:** M13 Professional Feed
- **Access:** Member (must be active member of this org)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓ (mobile-first)

## Purpose

Give members a single scrollable stream of announcements, event highlights, training opportunities, and peer posts from all their organizations so they can stay informed without checking multiple group chats or apps.

## Layout

### Desktop
Left sidebar carries the org navigation. Main content is a centered single-column card feed (max-width 680px). Above the feed: an org filter dropdown on the left and a "New Post" button on the right. The feed does not use a multi-column grid — the linear reading experience is intentional.

### Mobile
No sidebar. Org navigation in the bottom tab bar. The org filter dropdown and "New Post" button appear in a top bar below the org header. The feed is a full-width card list. Pull-to-refresh. "New Post" button also accessible as a floating action button at the bottom right.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org Filter | Dropdown | "All Organizations" (default, shows content from all orgs the member belongs to) or a single org name to filter to that org's content only. Only orgs the member actively belongs to appear in this list. |
| New Post Button | Button | Available to Active members and officers. Navigates to the post creation form (inline sheet on mobile, modal on desktop). Disabled and hidden for Lapsed/Grace members. |
| Post Card | Card | Post type icon + label. Author name + org name ("Dr. Santos — PDA Metro Manila"). Relative timestamp ("2h ago", "Yesterday", "Apr 15"). Post text body (truncated to 3 lines, "Read more" link). Image thumbnail if attached (first image shown, "+N" overlay if multiple). Reaction count (thumbs-up + count). Three-dot overflow menu (context-sensitive actions). |
| Pinned Post Indicator | Label | Pin icon + "Pinned" label above the card for org-pinned posts. At most one pinned post per org. Pinned posts appear above chronological content for that org's content scope. |
| Sponsored Post Label | Amber badge | Posts with `is_sponsored = true` show a distinct amber background header with "Sponsored" text above the post body. This label is never removable or configurable. |
| Post Type Icons | Icon set | Distinct icon per type: megaphone (Announcement), calendar-check (Event Highlight), graduation cap (Training Opportunity), trophy (Achievement), medical cross (Clinical Update). |
| Reaction Button | Toggle button | Thumbs-up icon. Tapping toggles the member's reaction. Count increments/decrements immediately (optimistic update). |
| Three-dot Menu | Context menu | Member options: "Mute this org," "Report." Officer options: "Remove post," "Pin post" (if allowed), "Report." Platform admin: "Remove post." |
| Mute Confirmation | Toast + Undo | "Posts from [Org] hidden from your feed." with a 5-second "Undo" action. |
| Offline Banner | Info banner | "You're offline. Showing cached content." Appears at top of feed when no network. New Post button disabled. |
| Load More | Button | Feed loads 20 posts initially. "Load more" button at the bottom loads 20 more. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Screen opens | 3 skeleton cards with shimmer. If cached content is available, cached feed renders immediately underneath the skeleton overlay and is replaced when fresh data loads. |
| Populated | Posts exist | Card list, reverse chronological. Pull-to-refresh on mobile. |
| Empty — no orgs | Member has no org memberships | "Your feed is empty. Join an organization to start seeing posts from your professional community." CTA to browse orgs. |
| Empty — no posts | Member has orgs but no one has posted | "Nothing in your feed yet. Your organizations' announcements and highlights will appear here." |
| Filtered — org muted | Member mutes an org | Posts from that org disappear from the feed. Toast with 5-second Undo. The feed re-renders without the muted org's content. |
| Post removed | Officer or admin removes a post | Post fades out of the feed. Author receives a notification (handled by M07). No visible change to other members beyond the post disappearing. |
| Offline | No network connectivity | Cached feed displayed (last known state). New Post button disabled. Banner at top of feed. |
| Error | API failure, no cache | "Unable to load your feed. Pull down to retry." |

## Interactions

- **Infinite scroll:** Feeds load 20 posts at a time. When the member scrolls near the bottom, the next 20 are fetched automatically (true infinite scroll on desktop; "Load more" button on mobile to preserve scroll position after navigating to post detail and back).
- **Pull-to-refresh (mobile):** Fetches new posts since last load and prepends them to the top of the feed.
- **Tap card body:** Navigates to the post detail screen at `/org/[id]/feed/post/[id]`.
- **Tap reaction:** Toggles the member's reaction. Anonymous to other members (only the count is visible, not who reacted).
- **Mute:** Available in the three-dot menu on any post from an org the member belongs to. Muting hides that org's posts immediately. M07 announcements (dues reminders, event notifications) are not affected by muting — only feed posts are hidden.
- **Officer moderation:** Officers see a "Remove post" option in the three-dot menu for any post in their org's feed. Tapping requires a reason selection (Off-topic / Inappropriate / Spam / Other). Post is removed on confirm and the author notified. Action is logged in the audit trail.
- **"Share to network" posts:** Posts from other orgs in the same association (flagged as network-visible by their officer) appear with the hosting org's name and logo. Members cannot share these posts further; only officers can create network-visible content.
- **Training Opportunity post type:** If the post includes a link to a training, a "Register" button appears on the card (not just in the post detail). Tapping navigates to the training detail screen.
- **Reactions are anonymous:** Members can see the total count. There is no "who reacted" list in v1.
