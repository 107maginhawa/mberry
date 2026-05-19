# Module Specification: Professional Feed (M13)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Give healthcare professionals a curated, professional content feed within their association. Enables officers to share org updates and members to engage with community content. Not a social network — a professional communication channel.

### Users
- Member, Officer

### Related Modules
- M01 (Auth), M02 (Member Profile — author display), M05 (Membership — access gating)
- M16 (Advertising — sponsored content)

### In Scope
- Feed browsing (chronological, org-scoped, network-wide)
- Post creation (officers: announcements, event highlights, training opportunities, achievements, clinical updates)
- Post moderation (officer can hide/remove posts), post types
- Feed muting (member mutes an org), image attachments
- "Share to network" (cross-chapter visibility for officers)

### Out of Scope
- Direct messaging (M07 comms), job postings (M15), advertising management (M16)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Post | Content item in the professional feed. Types: Announcement, Event Highlight, Training Opportunity, Achievement, Clinical Update. |
| Feed | Chronological list of posts visible to a member based on org membership. |
| Network Feed | Posts shared across all chapters in an association. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Browse Feed | Member | View chronological feed | P0 |
| Create Post | Officer | Compose and publish org post | P0 |
| Mute Organization | Member | Hide posts from specific org | P0 |
| Moderate Post | Officer | Hide or remove inappropriate posts | P0 |

## 4. Workflow Details

### Workflow: Browse Feed (Journey 13A)

Actor: Member
Steps:
1. Opens /org/[id]/feed.
2. Sees chronological feed: org posts + network posts (if shared).
3. Each post shows: author, post type icon, text, images, timestamp.
4. Scrolls for more (infinite scroll or pagination).
5. Taps post for detail view with full content.

### Workflow: Create Post (Journey 13B)

Actor: Officer
Steps:
1. Clicks "New Post" on feed or org dashboard.
2. Selects post type (Announcement, Event Highlight, etc.).
3. Enters text (max 2000 chars), attaches up to 4 images.
4. Selects org to post as (if multi-org officer).
5. Optionally checks "Share to network" (officer only).
6. Posts or saves as draft.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M13-R1 | IF post visibility = org-only THEN only org members see it | Feed visibility | Default for member posts |
| M13-R2 | IF "Share to network" checked THEN visible to all association members | Network posts | Officer only |
| M13-R3 | IF member mutes org THEN hide that org's posts from feed | Muting | Per-member preference |
| BR-35 | IF post flagged/reported THEN officer reviews and can hide/remove | Moderation | Flagged posts enter review queue |
| M13-R4 | IF post hidden by officer THEN not visible to members, visible to officers with "hidden" badge | Moderation | Soft-hide |
| M13-R5 | IF text body empty THEN block post creation | Validation | Required field |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Browse feed | Active members | non-members | GA |
| Create post | Officers | member [INFERRED — PRD mentions officer creates posts] | GA+HG |
| Moderate (hide/remove) | Officers | member | GA+HG |
| Mute org | All authenticated | — | GA |

## 7. Data Requirements

### Entity: Post

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Source org | — |
| authorId | Yes | Person FK | — |
| postType | Yes | Announcement/EventHighlight/TrainingOpportunity/Achievement/ClinicalUpdate | Enum |
| body | Yes | Text content | Max 2000 chars |
| imageUrls | No | Up to 4 images | JSONB array |
| visibility | Yes | org/network | Enum |
| status | Yes | published/draft/hidden/removed | Enum |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Post | — | ImageAttachments | Body required. Max 4 images. |

## 8. State Transitions

### Post Status
```txt
Draft → Published → Hidden (moderation)
Draft → Published → Removed (moderation)
Published → Hidden → Published (restored)
```

## 9. UI / UX Requirements

### Screen: Feed Main (/org/[id]/feed)
Purpose: Professional content feed
Components: Post cards (author, type icon, text, images, timestamp), infinite scroll, "New Post" button (officers), filter by type

### Screen: Create Post (inline on feed)
Purpose: Compose and publish
Components: Type selector, textarea (2000 char limit), image upload (up to 4), org selector, "Share to network" checkbox, Post/Save Draft/Cancel

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id/feed | Get feed posts | pagination, filters | Post list | 403 |
| POST /org/:id/feed | Create post | postType, body, images, visibility | postId | 403, 400 |
| PUT /org/:id/feed/:id/moderate | Moderate post | action (hide/remove) | Updated post | 403 |
| POST /my/feed/mute | Mute org | orgId | muted: true | — |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| PostPublished | Post created | postId, orgId, visibility | M16 (ad insertion) |
| PostModerated | Post hidden/removed | postId, action | Audit |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| EventPublished | M08 | Auto-create event highlight post [INFERRED] | Feed entry |
| TrainingPublished | M09 | Auto-create training opportunity post [INFERRED] | Feed entry |

## 11. Acceptance Criteria

### AC-M13-001: Feed Visibility
Org-only posts visible only to org members. Network posts visible to all association members.

### AC-M13-002: Muting
Muted org's posts hidden from member's feed. Unmuting restores visibility.

### AC-M13-003: Moderation
Officer can hide a post. Hidden post invisible to members, visible to officers with badge.

## 12. Test Expectations

Required tests:
- Feed visibility: org-only vs network, muting
- Post creation: validation (body required, max 2000 chars, max 4 images)
- Moderation: hide, remove, restore
- Feed ordering: chronological, cross-org
- Permission: only officers can create/moderate

## 13. Edge Cases

- Member belongs to 3 orgs: feed shows posts from all 3 + network posts.
- Officer shares to network but association has only 1 chapter: behaves same as org-only.
- All posts from an org hidden by moderation: org feed appears empty.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth), M02 (Profile — author display), M05 (Membership — access gating)

### External Dependencies
- Image storage service

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Empty post body | Block | "Post text is required." |
| Too many images | Block | "Maximum 4 images per post." |
| Image upload fails | Toast | "Image upload failed. Try again." |

## 16. Performance Expectations

- Expected data volume: 100+ posts per org per month
- Acceptable response times: Feed load < 500ms, post creation < 1s

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| feed.post.created | INFO | Post published | postId, orgId, type | No |
| feed.post.moderated | WARN | Post hidden/removed | postId, action, moderatorId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| feed_posts_total | counter | type, visibility | Posts created |
| feed_moderation_actions_total | counter | action | Moderation count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| feed_enabled | release | false | Gates professional feed | — |
| feed_network_sharing | release | false | Cross-chapter sharing | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M13-S1 | Feed Display | Chronological feed view | M01, M05 | P0 |
| M13-S2 | Post Creation | Officers create posts | M13-S1 | P0 |
| M13-S3 | Moderation | Hide/remove posts | M13-S2 | P0 |
| M13-S4 | Network Sharing | Cross-chapter visibility | M13-S1 | P1 |
| M13-S5 | Muting | Per-member org muting | M13-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
