# Module 13: Professional Feed

**Version:** 3.0
**Updated:** 2026-04-21
**Phase:** 2 -- Professional Identity Platform
**Monetization Tier:** Add-on
**Status:** Draft

---

## 1. Overview

### Purpose

Professional Feed gives healthcare professionals a curated stream of organization announcements, professional news, training opportunities, and peer-generated content. It replaces the fragmented experience of checking multiple Viber groups, Facebook pages, and email inboxes to stay informed about their profession.

### Why This Module Exists

Healthcare professionals belong to multiple organizations but have no single place to see what is happening across all of them. A dentist in PDA Metro Manila, a specialty society, and a study club currently checks three Viber groups, two Facebook pages, and a WhatsApp thread to stay current. Important announcements get buried in chat noise. Training opportunities from other organizations are invisible unless someone happens to forward a screenshot.

The Professional Feed creates a single, filterable stream that aggregates content from a member's organizations, their broader network, and curated professional news -- without requiring them to join additional groups or check additional apps.

### Dependencies

| Module | Relationship |
|--------|-------------|
| **M05: Membership** | Feed content visibility is scoped by membership. A member sees posts from organizations they belong to. Membership status determines posting privileges (Active members only). |
| **M07: Communications** | Announcements created in M07 can optionally be cross-posted to the feed. Feed is a distribution channel, not a replacement for targeted communications. |
| **M16: Advertising** | Sponsored content from M16 appears inline in the feed, clearly labeled. Feed provides the delivery surface; M16 provides the ad inventory and targeting. |

---

## 2. Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 13.1 | Unified feed view | Single chronological feed aggregating content from all organizations the member belongs to, plus opted-in network-wide content. Reverse chronological by default. | Member | P1 |
| 13.2 | Post types | Structured post types: Announcement (official org communications), Event Highlight (recap of a completed event with photos), Training Opportunity (upcoming training with registration link), Achievement (member recognition, award, milestone), Clinical Update (professional knowledge sharing). Each type has a distinct visual treatment and icon. | Member, Officer | P1 |
| 13.3 | Org-level posts | Officers create posts within their org's feed. These posts are visible to all members of that organization. Officers can optionally flag a post as "share to network" to make it visible to members of other organizations within the same association. | Officer | P1 |
| 13.4 | Network-wide posts | Association-level administrators (national body officers) can publish posts visible to all members across all organizations within that association. Used for national announcements, regulatory updates, profession-wide news. | National Body Officer | P1 |
| 13.5 | Member-generated posts | Active members can create posts within their org's feed. Posts are text-based with optional image attachment (max 4 images, max 5MB each). Member posts are visible to org members only (not shareable to network). | Member (Active) | P2 |
| 13.6 | Content visibility rules | Org posts: visible to org members only (unless shared to network). Network posts: visible to all association members. Member-generated posts: visible to the originating org only. Sponsored posts: visible per targeting rules defined in M16. | System | P0 |
| 13.7 | Org feed filter | Member can filter their feed to show posts from a single organization (e.g., "Show only PDA Metro Manila posts"). Filter is accessible via a dropdown or tab at the top of the feed. | Member | P1 |
| 13.8 | Muting | Member can mute a specific organization from their feed. Muted org's posts are hidden. Muting does not affect membership status or communications (M07 announcements still delivered). Mute is reversible. | Member | P2 |
| 13.9 | Officer moderation | Officers can hide or remove posts from their org's feed. Hidden posts are no longer visible to members but remain in the audit trail. Officers can also pin a post to the top of their org's feed (max 1 pinned post per org). | Officer | P1 |
| 13.10 | Platform moderation | Platform admin can remove any post from any feed (network-wide moderation). Used for content policy violations, spam, or inappropriate content. Removal is logged in the audit trail with reason. | Platform Admin | P1 |
| 13.11 | Sponsored content label | All sponsored or advertising content must display a "Sponsored" label at all times. The label must not be removable, hideable, or obscurable by the advertiser. Visual treatment: distinct background color and "Sponsored" text above the post. | System | P0 |
| 13.12 | Reactions | Members can react to posts with a single reaction (like/thumbs-up). Reaction count is visible. No comments in v1 -- this is a broadcast feed, not a discussion forum. | Member | P2 |
| 13.13 | Post detail view | Tapping a post opens a full-screen detail view with: full text, all images (swipeable), author info, timestamp, reaction count, and org attribution. | Member | P1 |

---

## 3. User Journeys

### Journey 13A: Member Browses Their Feed

**Persona:** Dr. Garcia (Active Member, belongs to PDA Metro Manila and PDA Orthodontics Society)
**Trigger:** Opens the app during morning commute.

1. Dr. Garcia taps "Feed" in the bottom tab bar -- navigates to `/org/[id]/feed`.
2. Sees a reverse-chronological stream of posts from both her organizations.
3. First post: an Announcement from PDA Metro Manila about the upcoming general assembly.
4. Second post: a Training Opportunity from PDA Orthodontics Society for a weekend seminar (with "Register" link to M09).
5. Third post: labeled "Sponsored" -- a dental equipment company promoting a new product. Distinct visual treatment.
6. Fourth post: an Achievement post -- a fellow Metro Manila member received a national award.
7. Dr. Garcia taps the Training Opportunity to see details, then taps "Register" which navigates to the training enrollment screen.
8. Scrolls back to the feed. Taps the filter dropdown and selects "PDA Orthodontics Society" to see only society posts.

### Journey 13B: Officer Creates an Org Post

**Persona:** Dr. Santos (Chapter Secretary, PDA Metro Manila)
**Trigger:** Wants to share photos from last week's induction ceremony.

1. Dr. Santos navigates to the feed (inline post creation on `/org/[id]/feed`, via "New Post" button on the feed or org dashboard).
2. Selects post type: "Event Highlight."
3. Enters text: "Great turnout at our 2026 Induction Ceremony! Welcome to our 15 new members."
4. Attaches 3 photos from the event.
5. Selects visibility: "PDA Metro Manila members" (default). Optionally checks "Share to network" to make visible to other PDA chapters.
6. Clicks "Post." The post appears at the top of the PDA Metro Manila feed and, if shared, in the network feed.

### Journey 13C: Member Mutes an Organization

**Persona:** Dr. Cruz (Active Member, belongs to 4 organizations)
**Trigger:** One of her organizations posts too frequently and clutters her feed.

1. Dr. Cruz sees a post from "PDA Southern Tagalog Dental Society" and taps the three-dot menu on the post.
2. Selects "Mute PDA Southern Tagalog."
3. Confirmation: "Posts from PDA Southern Tagalog will be hidden from your feed. You will still receive direct announcements. You can unmute anytime in Settings."
4. Dr. Cruz confirms. The org's posts disappear from her feed.
5. Later, she goes to Settings > Feed Preferences and unmutes the org.

### Journey 13D: Officer Moderates a Post

**Persona:** Dr. Lim (Chapter President, PDA Metro Manila)
**Trigger:** A member posted an off-topic political opinion in the org feed.

1. Dr. Lim sees the post in the feed.
2. Taps the three-dot menu and selects "Remove Post."
3. System asks for a reason: selects "Off-topic / not relevant to the organization."
4. Confirms removal. The post is hidden from all members. An audit log entry is created.
5. The post author receives a notification: "Your post was removed by an officer. Reason: Off-topic."

---

## 4. Business Rules

### M13-R1: Feed Content Visibility

- **Rule:** A member's feed must only display content they are authorized to see based on their org memberships and the content's visibility scope. Org-scoped posts are visible only to members of that org. Network-scoped posts are visible to all members of the association. Member-generated posts are always org-scoped (never network). Sponsored posts follow targeting rules from M16 but must never be shown to members who have opted out of targeted ads (they see generic ads instead). A muted org's posts must not appear in the member's feed regardless of the post's scope.
- **Category:** Access / Constraint
- **Why this matters:** Content leakage across org boundaries would violate the trust model. A chapter's internal discussions should not be visible to other chapters unless the officer explicitly shares to network. Muting is a member's right to control their information diet without affecting their membership standing.
- **Examples:**
  1. Dr. Garcia belongs to PDA Metro Manila and PDA Orthodontics Society. She sees posts from both orgs. She does not see posts from PDA Cebu Chapter (she is not a member), even if those posts are org-scoped.
  2. The PDA national body publishes a network-wide post about a regulatory change. All PDA members across all chapters see this post, including Dr. Garcia.
  3. Dr. Garcia mutes PDA Orthodontics Society. Network-wide posts from the PDA national body still appear. Org-scoped posts from PDA Orthodontics Society are hidden.
  4. A member-generated post by a PDA Metro Manila member is visible only to PDA Metro Manila members, even if the member also belongs to other orgs. The post author cannot share it to network -- only officers can share official posts to network.
- **Impact if wrong:** Members see content from orgs they don't belong to (privacy breach). Members cannot control feed noise (drives disengagement). Sponsored content appears without labels (regulatory and trust violation).
- **Approval:** [ ] Stakeholder sign-off

### BR-35: Feed Content Moderation

- **Rule:** Platform-level content policies apply to all posts in all feeds. Officer moderation (hide or remove) must take effect within 5 minutes of the officer action. Platform admin (Memberry) may remove any post from any feed at any time without org officer involvement. All removals are logged in the audit trail with actor, reason, and timestamp.
- **Category:** Constraint
- **Relevance to this module:** The 5-minute SLA for officer moderation is a product commitment, not a real-time guarantee — it reflects the cache invalidation and feed refresh window. Platform admin removal is immediate and bypasses org-level controls.

---

## 5. UX Specification

### Screen Inventory

| Screen | Route | Persona | Device |
|--------|-------|---------|--------|
| Feed (Main) | `/org/[id]/feed` | Member | Mobile-first, both |
| Post Detail | `/org/[id]/feed/post/[id]` | Member | Both |
| Create Post | Inline on `/org/[id]/feed` | Member (Active), Officer | Both |

### Screen Details

#### Feed Main (`/org/[id]/feed`)

**Layout:** Infinite-scroll card list, reverse chronological. Pull-to-refresh on mobile.

**Top bar:**
- Org filter dropdown: "All Organizations" (default), then list of member's orgs
- "New Post" button (for Active members and officers)

**Content per card:**
- Post type icon + label (e.g., calendar icon + "Event Highlight")
- Author name + org attribution ("Dr. Santos -- PDA Metro Manila")
- Timestamp (relative: "2h ago", "Yesterday", "Apr 15")
- Post text (truncated to 3 lines with "Read more" link)
- Image thumbnail (if attached, first image shown, "+2" overlay if multiple)
- Reaction count (thumbs-up icon + count)
- Sponsored label (if applicable): amber background, "Sponsored" text above post content
- Pinned indicator (if pinned by officer): pin icon + "Pinned" label

**Actions per card:**
- Tap card: navigate to post detail
- Tap reaction: toggle reaction
- Three-dot menu: "Mute this org" (member), "Remove post" (officer), "Report" (member)

**Empty state:** "Your feed is empty. Join an organization to start seeing posts from your professional community."

**Loading state:** Skeleton cards (3 placeholders) while feed loads.

#### Post Detail (`/org/[id]/feed/post/[id]`)

**Layout:** Full-screen view.

**Content:**
- Post type badge
- Author: name, photo, position (if officer), org name
- Full post text (no truncation)
- All images (horizontal swipe gallery on mobile, grid on desktop)
- Timestamp (absolute: "April 15, 2026 at 2:30 PM")
- Reaction count with react button
- Sponsored label (if applicable)

**Navigation:** Back arrow returns to feed at previous scroll position.

#### Create Post (inline on `/org/[id]/feed`)

**Layout:** Single-screen form.

**Fields:**
- Post type selector: dropdown with icons (Announcement, Event Highlight, Training Opportunity, Achievement, Clinical Update)
- Text body: textarea (required, max 2000 characters, character counter)
- Image attachments: up to 4 images, drag-to-reorder, preview thumbnails
- Org selector: which org to post as (dropdown of member's orgs where they are Active)
- Share to network: checkbox (officers only), "Make this post visible to all members in [Association Name]"

**Validation:**
- Text body required
- At least one image recommended for Event Highlight type (warning, not blocking)
- Post type required

**Actions:**
- "Post" button (primary)
- "Save Draft" (secondary, officer only)
- "Cancel" (tertiary, with unsaved changes confirmation)

### States

| State | Trigger | UI Behavior |
|-------|---------|-------------|
| **Feed loading** | Screen opens | Skeleton cards. Cached content shown immediately if available. |
| **Feed empty** | Member has no org memberships or no posts exist | Empty state illustration + message. |
| **Feed populated** | Posts exist | Card list with infinite scroll. |
| **Post removed** | Officer or admin removes post | Post fades out of feed. Author sees "removed" notice. |
| **Org muted** | Member mutes an org | Posts from that org removed from feed. Toast confirmation with "Undo" (5 seconds). |
| **Offline** | No network connection | Cached feed shown with "You're offline" banner. New post button disabled. |

---

## 6. Acceptance Criteria Patterns

- Feed loads within 2 seconds on a 3G connection (mobile optimization critical for PH market).
- Org-scoped posts are never visible to non-members of that org, regardless of how the member navigates (direct URL, deep link, search).
- Sponsored content always displays "Sponsored" label -- no exceptions, no configuration to hide it.
- Muting an org does not affect M07 communications (announcements, dues reminders still delivered).
- Member-generated posts cannot be shared to network (only officer posts have the "Share to network" option).
- Officer moderation actions (remove, pin) are logged in the audit trail with officer identity, timestamp, and reason.
- Reactions are anonymous (members can see the count but not who reacted).
- Feed pagination: initial load returns 20 posts, scroll loads 20 more per page.
- Images are compressed client-side before upload (target: under 1MB per image after compression).
- Post creation requires Active membership status in the selected org.

---

## 7. Data Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **Feed Post** | `id`, `org_id`, `author_member_id`, `post_type` (announcement/event_highlight/training_opportunity/achievement/clinical_update), `body_text`, `visibility` (org/network), `is_sponsored`, `is_pinned`, `is_removed`, `removed_by`, `removed_reason`, `created_at`, `updated_at` | Core post record. Soft-deleted via `is_removed` flag for audit trail. |
| **Post Image** | `id`, `post_id`, `image_url`, `sort_order`, `width_px`, `height_px`, `file_size_bytes`, `created_at` | Up to 4 images per post. Stored in object storage with CDN delivery. |
| **Post Reaction** | `id`, `post_id`, `member_id`, `reaction_type` (like), `created_at` | One reaction per member per post. Unique constraint on `(post_id, member_id)`. |
| **Feed Mute** | `id`, `member_id`, `org_id`, `created_at` | When present, the org's posts are filtered out of the member's feed. Deletion unmutes. |
| **Feed Preference** | `id`, `member_id`, `opt_out_targeted_ads`, `created_at`, `updated_at` | Member-level feed preferences. `opt_out_targeted_ads` controls whether the member sees targeted vs. generic ads. |

---

*Module 13: Professional Feed -- Memberry v3*
