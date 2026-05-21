# Module Specification: Professional Feed (M13)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose

Give healthcare professionals a curated, professional content feed within their association. Officers share org updates and members engage with community content. Not a social network — a professional communication channel.

### Users

- **Member** — Browses feed, mutes authors, engages with posts
- **Officer (Secretary/President)** — Creates posts, moderates content
- **Platform Administrator** — Configures feed feature flags, monitors abuse

### Related Modules

| Module | Relationship |
|--------|-------------|
| M01 (Onboarding) | Membership status gates feed access |
| M02 (Person) | Author identity from Person entity |
| M05 (Membership) | Active membership required to browse/interact |
| M07 (Communications) | Announcements may surface in feed |
| M08 (Events) | Event highlights surface as feed posts |
| M09 (Training) | Training opportunities surface as feed posts |
| M16 (Advertising) | Sponsored content injected into feed |

### In Scope

- Org-scoped feed with infinite scroll
- Officer post creation (text + up to 4 images)
- Post types: Announcement, EventHighlight, TrainingOpportunity, Achievement, ClinicalUpdate
- Content moderation (hide/remove posts)
- Mute/unmute specific authors
- Visibility scoping (org-only vs network-wide)
- Engagement actions (like, bookmark) [INFERRED]

### Out of Scope

- Comments/threaded replies (future consideration)
- Direct messaging (handled by M07)
- Cross-association feed aggregation
- Rich media embedding (video, documents)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant organization. Scoped by `association_id`. |
| **Organization** | Operational unit within an association (chapter, society, national body, clinic). |
| **Person** | Central PII hub. The identity record for any individual. |
| **Member** | Healthcare professional using the platform. One account, multiple org memberships. |
| **Officer** | Member assigned an administrative role (President, Treasurer, Secretary). |
| **Post** | A feed content item authored by an officer, typed and scoped. [INFERRED — no DOMAIN_GLOSSARY entry] |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Browse Feed | WF-080 | Member | Infinite scroll, org-scoped, engagement actions | P1 |
| Create Post | WF-081 | Officer | Compose, attach media, publish | P1 |
| Content Moderation | WF-082 | Officer | Hide/remove posts, report handling | P1 |
| Mute/Unmute | WF-083 | Member | Mute specific authors | P2 |

## 4. Workflow Details

### Workflow: Browse Feed (WF-080)

- **Actor:** Member (active)
- **Preconditions:** Authenticated, active membership in at least one org
- **Steps:**
  1. Member navigates to feed page
  2. System loads org-scoped posts, newest first, paginated (infinite scroll)
  3. Member scrolls; system loads next page on threshold
  4. Member can filter by post type
  5. Member can engage (like/bookmark) [INFERRED]
- **Alternate Flows:** Member belongs to multiple orgs — feed shows selected org
- **Exception Flows:** Non-active member sees read-only feed with banner prompting renewal
- **Postconditions:** Feed view logged

### Workflow: Create Post (WF-081)

- **Actor:** Officer (Secretary, President)
- **Preconditions:** Active officer term, authenticated
- **Steps:**
  1. Officer taps "New Post" button
  2. Selects post type from enum
  3. Enters body text (max 2000 chars)
  4. Optionally attaches up to 4 images
  5. Selects visibility (org / network)
  6. Publishes post
- **Alternate Flows:** Save as draft for later publishing
- **Exception Flows:** Image upload fails — post saved without images, error shown
- **Postconditions:** Post visible in feed, PostCreated event emitted

### Workflow: Content Moderation (WF-082)

- **Actor:** Officer
- **Preconditions:** Officer role in the org
- **Steps:**
  1. Officer views a post and selects "Moderate"
  2. Chooses action: Hide (reversible) or Remove (permanent)
  3. System updates post status
  4. Author notified of action
- **Alternate Flows:** Officer un-hides a hidden post
- **Exception Flows:** Post already removed — no action available
- **Postconditions:** Post status updated, PostModerated event emitted

### Workflow: Mute/Unmute (WF-083)

- **Actor:** Member
- **Preconditions:** Authenticated
- **Steps:**
  1. Member views author profile or post
  2. Taps "Mute" / "Unmute"
  3. System filters muted authors from feed
- **Postconditions:** Mute preference persisted per member-author pair

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-35 | IF post reported by N members THEN auto-hide for officer review | Moderation | Threshold configurable per org |
| M13-R1 | IF member status != Active THEN feed is read-only | Access | Grace/Lapsed can browse but not engage |
| M13-R2 | IF post visibility = "network" THEN visible to all orgs in association | Visibility | Default is org-only |
| M13-R3 | IF author muted THEN posts hidden from muter's feed only | Muting | Does not affect other members |
| M13-R4 | IF post body > 2000 chars THEN reject | Validation | Client and server enforce |
| M13-R5 | IF post images > 4 THEN reject | Validation | Max 4 images per post |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Browse feed | All active members | Non-members | GA |
| Create post | Officers (Secretary, President) | Member, Treasurer [INFERRED] | GA+HG |
| Moderate (hide/remove) | Officers (Secretary, President) | Member | GA+HG |
| Mute/unmute author | All authenticated | — | GA |
| View hidden posts | Officers, Platform Admin | Member | GA+HG / PA |

> **Note:** No explicit ROLE_PERMISSION_MATRIX section exists for M13. Permissions derived from PRD and v1 spec. [VERIFY]

## 7. Data Requirements

### Entity: Post

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Source org | FK to organization |
| authorId | Yes | Person FK | FK to person |
| postType | Yes | Content type | Enum: Announcement, EventHighlight, TrainingOpportunity, Achievement, ClinicalUpdate |
| body | Yes | Text content | Max 2000 chars |
| imageUrls | No | Up to 4 images | JSONB array |
| visibility | Yes | Scope | Enum: org, network |
| status | Yes | Lifecycle state | Enum: draft, published, hidden, removed |
| createdAt | Yes | Timestamp | Auto |
| updatedAt | Yes | Timestamp | Auto |

### Entity: MutePreference [INFERRED]

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| personId | Yes | Member who muted | FK to person |
| mutedPersonId | Yes | Author who is muted | FK to person |
| organizationId | Yes | Org scope | FK to organization |
| createdAt | Yes | Timestamp | Auto |

> **Note:** No `feed_post` table in DOMAIN_MODEL.md. Entity schema inferred from PRD and v1 spec. [VERIFY]

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---------------|---------------|--------------------|-----------------| 
| Post | — | imageUrls (JSONB) | Max 4 images; body <= 2000 chars; status transitions enforced |
| MutePreference [INFERRED] | — | — | Unique per (personId, mutedPersonId, organizationId) |

## 8. State Transitions

### Post Status

```
draft --> published    [Officer publishes]
published --> hidden   [Officer moderates — reversible]
hidden --> published   [Officer un-hides]
published --> removed  [Officer removes — terminal]
hidden --> removed     [Officer removes — terminal]
```

Terminal states: `removed`
Source: DOMAIN_MODEL.md state inventory — "Post (M13): Draft -> Published -> Hidden/Removed. Hidden is reversible."

## 9. UI/UX Requirements

### Screen: Feed Main (/org/[id]/feed)

- **Purpose:** Professional content feed
- **Users:** Active members, officers
- **Components:** Post cards (author avatar, type icon, body text, images, timestamp), infinite scroll, "New Post" button (officers only), filter by post type
- **States:**
  - Loading: Skeleton cards
  - Empty: "No posts yet" with CTA for officers
  - Success: Paginated post list
  - ValidationError: N/A (read-only)
  - PermissionError: "Upgrade membership to access feed"
  - UnexpectedError: "Unable to load feed. Try again."

### Screen: Create Post (inline on feed or modal)

- **Purpose:** Compose new post
- **Users:** Officers
- **Components:** Post type selector, text area (char counter), image upload (max 4), visibility toggle, publish/draft buttons
- **States:**
  - Loading: Submitting spinner
  - Empty: Blank compose form
  - Success: Post published, toast confirmation (sonner)
  - ValidationError: Inline field errors (body too long, too many images)
  - PermissionError: Button hidden for non-officers
  - UnexpectedError: "Failed to publish. Draft saved."

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /orgs/{orgId}/feed | List feed posts | orgId, cursor, postType filter | Paginated posts | 403 not member |
| POST /orgs/{orgId}/feed | Create post | orgId, body, postType, imageUrls, visibility | Created post | 403 not officer, 422 validation |
| PATCH /orgs/{orgId}/feed/{postId} | Update post | postId, body/status | Updated post | 403, 404 |
| DELETE /orgs/{orgId}/feed/{postId} | Remove post | postId | 204 | 403, 404 |
| POST /orgs/{orgId}/feed/mute | Mute author | mutedPersonId | 201 | 409 already muted |
| DELETE /orgs/{orgId}/feed/mute/{personId} | Unmute | mutedPersonId | 204 | 404 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|------------|---------|---------|-----------|
| PostCreated | Post published | { postId, orgId, authorId, postType } | M07 (notification) |
| PostModerated | Post hidden/removed | { postId, orgId, action, moderatorId } | Audit log |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|------------|-------------|---------|-------------|
| AnnouncementCreated | M07 | createFeedPost | Auto-creates Announcement-type feed post [INFERRED] |
| EventCreated | M08 | createFeedPost | Auto-creates EventHighlight post [INFERRED] |
| TrainingPublished | M09 | createFeedPost | Auto-creates TrainingOpportunity post [INFERRED] |

## 11. Acceptance Criteria

### AC-M13-001: Feed Visibility
**Given** an active member in an org  
**When** they navigate to the feed  
**Then** they see published posts scoped to their org, newest first

### AC-M13-002: Muting
**Given** a member has muted an author  
**When** they browse the feed  
**Then** muted author's posts are excluded

### AC-M13-003: Moderation
**Given** an officer selects "Hide" on a post  
**When** the action completes  
**Then** the post status changes to hidden and is no longer visible to members

### AC-M13-004: Post Creation
**Given** an officer composes a post with valid content  
**When** they publish  
**Then** the post appears in the feed and a PostCreated event is emitted

### AC-M13-005: Read-Only for Non-Active
**Given** a member with Grace/Lapsed status  
**When** they view the feed  
**Then** they can read posts but cannot create, like, or bookmark

## 12. Test Expectations

- **Unit:** Post creation validation (body length, image count), mute filtering logic, state transition enforcement
- **Integration:** Feed pagination with cursor, moderation state transitions, mute persistence
- **Contract:** GET /feed returns paginated results, POST /feed requires officer auth, PATCH /feed/{id} enforces state machine
- **E2E:** Officer creates post visible to member; member mutes author and post disappears; officer hides post

## 13. Edge Cases

- Member belongs to multiple orgs — feed only shows selected org's posts
- Officer term expires mid-session — new post creation fails gracefully
- Network-visibility post visible to members in other orgs within same association
- Post with all 4 images, one fails upload — partial upload handling
- Muted author becomes officer — mute still applies
- Concurrent moderation by two officers on same post
- Feed empty state for brand-new org with zero posts

## 14. Dependencies

### Internal Dependencies

- M02 (Person): Author identity
- M05 (Membership): Status check for access gating
- Storage module: Image upload for post attachments

### External Dependencies

- None (no third-party services)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Non-member accesses feed | 403 Forbidden | "Join this organization to access the feed" |
| Non-officer creates post | 403 Forbidden | "Only officers can create posts" |
| Body exceeds 2000 chars | 422 Validation | "Post body must be 2000 characters or fewer" |
| Post not found | 404 Not Found | "Post not found" |
| Image upload failure | Partial save | "Some images failed to upload. Post saved without them." |

## 16. Performance Expectations

- **Data volume:** ~100 posts/org/month, ~10K posts/association/year
- **Concurrent users:** Up to 500 members browsing feed simultaneously
- **Response times:** Feed page load < 500ms (p95), post creation < 1s
- **Caching:** Feed list cached per org with 60s TTL; invalidated on new post

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|-------|-------|------|--------|------|
| feed.viewed | INFO | Feed page loaded | orgId, personId, page | No |
| post.created | INFO | Post published | postId, orgId, postType | No |
| post.moderated | WARN | Post hidden/removed | postId, action, moderatorId | No |
| post.reported | WARN | Member reports post | postId, reporterId | No |

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| feed_posts_total | counter | orgId, postType | Total posts created |
| feed_views_total | counter | orgId | Feed page views |
| feed_moderation_total | counter | orgId, action | Moderation actions |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|--------------|
| feed_enabled | boolean | false | Enable professional feed module | Post Phase 2 GA |
| feed_network_visibility | boolean | false | Allow network-wide post visibility | Post validation |
| feed_engagement_actions | boolean | false | Enable like/bookmark actions | Post validation |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M13-S1 | Browse Feed | GET feed with pagination, org scoping | M02, M05 | P0 |
| M13-S2 | Create Post | Officer creates text post | M13-S1 | P0 |
| M13-S3 | Post Images | Add image attachments to posts | M13-S2, Storage | P1 |
| M13-S4 | Moderation | Hide/remove posts | M13-S2 | P1 |
| M13-S5 | Mute/Unmute | Member mutes authors | M13-S1 | P2 |
| M13-S6 | Network Visibility | Cross-org post visibility | M13-S2 | P2 |
| M13-S7 | Engagement | Like/bookmark actions | M13-S1 | P2 |

## 20. AI Instructions

When implementing this module:
1. No existing handler code — scaffold `handlers/feed/` from scratch following `handlers/person/createPerson.ts` pattern.
2. Convert workflows into vertical slice specs. Implement one slice at a time.
3. Post entity has no DOMAIN_MODEL table definition — use the spec above as schema source. [VERIFY — no `feed_post` table in DOMAIN_MODEL.md]
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md (Bun, Hono, Drizzle, TypeSpec-first), CONTRIBUTING.md, and CLAUDE.md.
7. Feed pagination should use cursor-based approach (keyset pagination on createdAt + id).
8. Image storage integrates with existing Storage module (S3/MinIO).
9. Use `sonner` for toast notifications, not shadcn `useToast`.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | "Post" not in DOMAIN_GLOSSARY |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP WF-080 to WF-083 |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | BR-35 from WORKFLOW_MAP + module-specific rules |
| 6. Permissions | PARTIAL | No explicit ROLE_PERMISSION_MATRIX section for M13; derived from PRD |
| 7. Data Requirements | PARTIAL | No `feed_post` table in DOMAIN_MODEL.md — entity inferred from PRD |
| 7b. Aggregate Boundaries | PARTIAL | MutePreference is [INFERRED] |
| 8. State Transitions | COMPLETE | From DOMAIN_MODEL state inventory |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | PARTIAL | Consumed events are [INFERRED] |
| 11. Acceptance Criteria | COMPLETE | — |
| 12. Test Expectations | COMPLETE | — |
| 13. Edge Cases | COMPLETE | — |
| 14. Dependencies | COMPLETE | — |
| 15. Error Handling | COMPLETE | — |
| 16. Performance | COMPLETE | — |
| 17. Observability | COMPLETE | — |
| 18. Feature Flags | COMPLETE | — |
| 19. Vertical Slice Plan | COMPLETE | — |
| 20. AI Instructions | COMPLETE | — |
| 21. Section Completeness | COMPLETE | — |
| 22. Downstream Impact | COMPLETE | — |

## 22. Downstream Impact

- **M16 (Advertising):** Sponsored content injection depends on feed rendering — ad slot `feed_banner` targets this module
- **MODULE_MAP.md:** M13 dependencies (M01, M02, M05) must be reflected
- **ROLE_PERMISSION_MATRIX.md:** Missing section 3.x for Professional Feed — needs addition [VERIFY]
- **DOMAIN_MODEL.md:** No `feed_post` table defined — needs addition for schema consistency
