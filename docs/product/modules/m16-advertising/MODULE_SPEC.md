# Module Specification: Advertising (M16)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose

Revenue-generating advertising module for the Memberry platform. Enables healthcare-relevant advertisers to run campaigns with admin-approved creatives displayed in configurable ad slots across the platform. Segment-based targeting only — no individual member data shared with advertisers. All ads labeled "Sponsored." Members can opt out of targeted ads.

### Users

- **Platform Administrator** — Manages advertisers, reviews creatives, configures campaigns and ad slots
- **Advertiser** — External company that registers to advertise (not a platform member)
- **Member** — Views ads in feed/sidebar, can report inappropriate ads, can opt out of targeting
- **Officer** — No special advertising role [INFERRED]

### Related Modules

| Module | Relationship |
|--------|-------------|
| M03 (Billing) | Advertising revenue tracking, campaign billing |
| M07 (Communications) | Campaign notifications, ad report alerts |
| M13 (Professional Feed) | `feed_banner` ad slot placement |
| M02 (Person) | Member opt-out preferences linked to person |

### In Scope

- Advertiser registration and management
- Campaign creation with budget, schedule, and segment targeting
- Creative submission and admin approval workflow
- Ad slot configuration per association (feed_banner, sidebar, email_footer, event_sponsor)
- Impression and click tracking
- Member ad reporting
- Member opt-out from targeted ads
- Campaign budget enforcement (auto-pause on exhaustion)
- Advertising performance dashboard (impressions, clicks, CTR, revenue)

### Out of Scope

- Self-serve campaign management by advertisers (admin-managed only)
- Real-time bidding / programmatic advertising
- Ad creative design tools
- Cross-association advertising (campaigns scoped to one association)
- Payment processing for ad spend (handled by M03)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant. Ads are scoped per association. |
| **Advertiser** | Registered company that pays to display ads. Linked to an organization. |
| **Campaign** | A time-bound advertising effort with budget, targeting, and one or more creatives. |
| **Creative** | The actual ad asset (title, body text, image, click URL) requiring admin approval before display. |
| **Ad Slot** | A placement location in the platform UI: feed_banner, sidebar, email_footer, event_sponsor. |
| **Impression** | A single display of an ad creative to a member. |
| **Click** | A member clicking through an ad to the destination URL. |
| **CTR** | Click-through rate: clicks / impressions. |
| **Segment** | An audience group defined by specialty, location, or association — no individual PII exposed. |
| **Opt-Out** | Member preference to receive only generic (non-targeted) ads. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Campaign Creation | WF-092 | Platform Admin | Create campaign with targeting and creatives | P1 |
| Creative Approval | WF-093 | Platform Admin | Approve/reject ad creatives | P1 |
| Campaign Lifecycle | WF-094 | System / Admin | Draft -> active -> paused -> completed | P1 |
| Member Reports Ad | WF-095 | Member | Flag inappropriate/misleading ads | P1 |
| Advertising Dashboard | WF-096 | Platform Admin | Impressions, clicks, revenue metrics | P1 |
| Opt Out of Targeting | — | Member | Disable targeted ads | P1 |

## 4. Workflow Details

### Workflow: Campaign Creation (WF-092)

- **Actor:** Platform Admin (on behalf of advertiser)
- **Preconditions:** Advertiser registered and active
- **Steps:**
  1. Admin selects advertiser
  2. Creates campaign: name, description, budget (cents), schedule (startsAt, endsAt)
  3. Configures targeting: segment (specialty, location, association)
  4. Selects ad slot(s): feed_banner, sidebar, email_footer, event_sponsor
  5. Uploads/creates creatives (title, body text, image, click URL)
  6. Creatives enter pending review
  7. Admin reviews and approves creatives (M16-R1)
  8. Campaign saved as draft
  9. Admin activates campaign when ready
- **Alternate Flows:** Campaign saved as draft, creatives added later
- **Exception Flows:** Budget set to 0 — validation error
- **Postconditions:** Campaign created, CampaignCreated event emitted

### Workflow: Creative Approval (WF-093)

- **Actor:** Platform Admin
- **Preconditions:** Creative submitted for campaign
- **Steps:**
  1. Admin navigates to creative review queue
  2. Reviews creative content against content policy
  3. Approves or rejects with reason
  4. If approved: creative eligible for display, `sponsoredLabel` = true (M16-R3)
  5. If rejected: advertiser/admin notified with rejection reason
- **Alternate Flows:** Multiple creatives per campaign — each reviewed independently
- **Exception Flows:** All creatives rejected — campaign cannot go active
- **Postconditions:** Creative status updated, CreativeApproved/CreativeRejected event emitted

### Workflow: Campaign Lifecycle (WF-094)

- **Actor:** System (automated) + Platform Admin
- **Preconditions:** Campaign exists with at least one approved creative
- **Steps:**
  1. Admin activates campaign (draft -> active)
  2. System serves ads in configured slots
  3. System tracks impressions and clicks
  4. If budget exhausted: system auto-pauses campaign (M16-R6)
  5. Admin can manually pause/resume
  6. At endsAt: system marks campaign completed
- **Alternate Flows:** Admin pauses for content update, then resumes
- **Exception Flows:** No approved creatives — cannot activate
- **Postconditions:** Campaign status updated; metrics recorded

### Workflow: Member Reports Ad (WF-095)

- **Actor:** Member
- **Preconditions:** Authenticated, viewing an ad
- **Steps:**
  1. Member clicks "Report" on an ad
  2. Enters reason (misleading, inappropriate, irrelevant)
  3. System creates ad_report record
  4. If report count >= threshold: auto-pause creative for review (M16-R5)
  5. Admin reviews and takes action
- **Alternate Flows:** Member has already reported same ad — 409 conflict
- **Exception Flows:** Ad already paused — report still recorded
- **Postconditions:** Report created, AdReported event emitted

### Workflow: Member Opt-Out

- **Actor:** Member
- **Preconditions:** Authenticated
- **Steps:**
  1. Member navigates to ad preferences (settings)
  2. Toggles "Opt out of targeted ads"
  3. System creates member_ad_opt_out record (M16-R4)
  4. Member now sees only generic (non-targeted) ads
- **Alternate Flows:** Member re-enables targeting — opt-out record deleted
- **Exception Flows:** None
- **Postconditions:** Opt-out preference persisted, respected immediately

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M16-R1 | IF ad creative submitted THEN require admin approval before display | Creative review | No self-serve publishing |
| M16-R2 | IF targeting configured THEN segment-based only, no individual member data shared | Privacy | Advertiser sees aggregate segment counts only |
| M16-R3 | IF sponsored content displayed THEN clearly labeled "Sponsored" | Display | `sponsoredLabel` boolean, default true |
| M16-R4 | IF member opts out THEN no targeted ads, generic ads only | Opt-out | Respected immediately upon toggle |
| M16-R5 | IF ad reported N times THEN auto-pause creative for review | Moderation | Threshold configurable per association |
| M16-R6 | IF campaign budget exhausted (spentCents >= budgetCents) THEN pause delivery | Budget | No overspend; system auto-pauses |
| M16-R7 | IF ad slot configured per association THEN admin configures which slots active | Configuration | Per-association slot activation |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Manage advertisers | Platform Admin | All others | PA |
| Create/edit campaigns | Platform Admin | All others | PA |
| Approve/reject creatives | Platform Admin | All others | PA |
| Configure ad slots | Platform Admin | All others | PA |
| View advertising dashboard | Platform Admin | All others | PA |
| Report ad | All authenticated members | Non-members | GA |
| Opt out of targeting | All authenticated members | — | GA |
| View ads | All members (unless opted out of targeting) | — | GA |

> **Note:** No explicit ROLE_PERMISSION_MATRIX section exists for M16. Permissions derived from PRD and v1 spec. [VERIFY]

## 7. Data Requirements

### Entity: Advertiser

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Association org FK | FK to organization |
| companyName | Yes | Company name | text NOT NULL |
| contactEmail | Yes | Contact email | text NOT NULL, email validation |
| contactPersonId | No | Optional link to person | FK to person |
| isActive | Yes | Active status | boolean, default true |
| createdAt | Yes | Timestamp | Auto |
| updatedAt | Yes | Timestamp | Auto |

Source: DOMAIN_MODEL.md `advertiser` table.

### Entity: AdCampaign

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Association org FK | FK to organization |
| advertiserId | Yes | Advertiser FK | FK to advertiser (cascade) |
| name | Yes | Campaign name | text NOT NULL |
| description | No | Campaign description | text |
| status | Yes | Lifecycle state | Enum: draft, pending_review, active, paused, completed, rejected |
| targetSegmentId | No | Segment-based targeting | text — no PII (M16-R2) |
| targetSegmentSize | No | Audience size | integer |
| budgetCents | Yes | Total budget in cents | integer, default 0 (M16-R6) |
| spentCents | Yes | Amount spent in cents | integer, default 0 |
| startsAt | No | Campaign start date | timestamp |
| endsAt | No | Campaign end date | timestamp |
| adSlot | Yes | Placement location | Enum: feed_banner, sidebar, email_footer, event_sponsor |
| createdAt | Yes | Timestamp | Auto |
| updatedAt | Yes | Timestamp | Auto |

Source: DOMAIN_MODEL.md `ad_campaign` table, `campaign_status` enum, `ad_slot` enum.

### Entity: AdCreative

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Association org FK | FK to organization |
| campaignId | Yes | Campaign FK | FK to ad_campaign (cascade) |
| title | Yes | Ad title | text NOT NULL |
| bodyText | Yes | Ad body copy | text NOT NULL |
| imageUrl | No | Ad image | text, URL validation |
| clickUrl | No | Destination URL | text, URL validation |
| status | Yes | Review state | Enum: pending, approved, rejected |
| reviewedBy | No | Reviewer person FK | FK to person |
| reviewedAt | No | Review timestamp | timestamp |
| rejectionReason | No | Why rejected | text |
| sponsoredLabel | Yes | "Sponsored" flag | boolean, default true (M16-R3) |
| createdAt | Yes | Timestamp | Auto |
| updatedAt | Yes | Timestamp | Auto |

Source: DOMAIN_MODEL.md `ad_creative` table, `creative_status` enum.

### Entity: AdReport

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Association org FK | FK to organization |
| creativeId | Yes | Creative FK | FK to ad_creative |
| reporterPersonId | Yes | Reporter FK | FK to person |
| reason | Yes | Report reason | text NOT NULL |
| createdAt | Yes | Timestamp | Auto |

Source: DOMAIN_MODEL.md `ad_report` table.

### Entity: MemberAdOptOut

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Association org FK | FK to organization |
| personId | Yes | Member FK | FK to person |
| optedOutAt | Yes | Opt-out timestamp | default now (M16-R4) |

Source: DOMAIN_MODEL.md `member_ad_opt_out` table.

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---------------|---------------|--------------------|-----------------| 
| Advertiser | AdCampaign (via advertiserId cascade) | — | isActive must be true to create campaigns |
| AdCampaign | AdCreative (via campaignId cascade) | — | spentCents <= budgetCents; at least one approved creative to activate; status transitions enforced |
| AdReport | — | — | One report per (creativeId, reporterPersonId) [INFERRED] |
| MemberAdOptOut | — | — | One per (organizationId, personId) |

Source: DOMAIN_MODEL.md — "Advertising Context: `advertiser` — Root aggregate. `ad_campaign` — Campaign aggregate."

## 8. State Transitions

### Campaign Status

```
draft --> pending_review   [Admin submits for review]
pending_review --> active  [Admin approves, at least one approved creative]
pending_review --> rejected [Admin rejects]
draft --> active           [Admin activates directly if creatives pre-approved]
active --> paused          [Admin pauses OR budget exhausted — M16-R6]
paused --> active          [Admin resumes, budget available]
active --> completed       [endsAt reached OR admin completes]
paused --> completed       [Admin completes while paused]
```

Terminal states: `rejected`, `completed`
Reversible: `paused` <-> `active`

Source: DOMAIN_MODEL.md `campaign_status` enum: draft, pending_review, active, paused, completed, rejected. State inventory: "Campaign (M16): Draft -> Active -> Paused/Completed. Paused is reversible."

### Creative Status

```
pending --> approved    [Admin approves — M16-R1]
pending --> rejected    [Admin rejects with reason]
```

Terminal states: `approved`, `rejected` (no re-submission — create new creative)

Source: DOMAIN_MODEL.md `creative_status` enum: pending, approved, rejected.

## 9. UI/UX Requirements

### Screen: Advertising Dashboard (/admin/advertising)

- **Purpose:** Campaign management and performance overview
- **Users:** Platform Admin
- **Components:** Campaign list table (name, advertiser, status, budget, spent, impressions, clicks, CTR), create campaign button, filter by status, advertiser management link
- **States:**
  - Loading: Skeleton table
  - Empty: "No campaigns yet" with CTA
  - Success: Campaign list with metrics
  - ValidationError: N/A (list view)
  - PermissionError: "Platform admin access required"
  - UnexpectedError: "Unable to load advertising dashboard."

### Screen: Campaign Detail (/admin/advertising/campaigns/[id])

- **Purpose:** Campaign management and analytics
- **Users:** Platform Admin
- **Components:** Campaign config form, creative list with approval status, targeting display, performance charts (impressions, clicks, CTR over time), budget gauge, pause/resume/complete buttons
- **States:**
  - Loading: Skeleton layout
  - Empty: N/A
  - Success: Full campaign detail with charts
  - ValidationError: Inline errors on config changes
  - PermissionError: "Platform admin access required"
  - UnexpectedError: "Unable to load campaign."

### Screen: Creative Review Queue (/admin/advertising/creatives)

- **Purpose:** Review and approve/reject pending creatives
- **Users:** Platform Admin
- **Components:** Pending creative cards (preview, campaign name, advertiser), approve/reject buttons, rejection reason input
- **States:**
  - Loading: Skeleton cards
  - Empty: "No creatives pending review"
  - Success: Queue of pending creatives
  - ValidationError: "Rejection reason required"
  - PermissionError: "Platform admin access required"
  - UnexpectedError: "Unable to load review queue."

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /admin/advertising/campaigns | List campaigns | status filter, cursor | Paginated campaigns | 403 not PA |
| POST /admin/advertising/campaigns | Create campaign | advertiserId, name, budget, targeting, slot | Created campaign | 403, 422 |
| GET /admin/advertising/campaigns/{id} | Campaign detail | campaignId | Full campaign + metrics | 403, 404 |
| PATCH /admin/advertising/campaigns/{id} | Update campaign | fields | Updated campaign | 403, 404, 422 |
| POST /admin/advertising/campaigns/{id}/creatives | Add creative | title, bodyText, imageUrl, clickUrl | Created creative | 403, 422 |
| PATCH /admin/advertising/creatives/{id} | Approve/reject | status, rejectionReason | Updated creative | 403, 404 |
| POST /ads/{creativeId}/impression | Record impression | creativeId | 204 | — |
| POST /ads/{creativeId}/click | Record click | creativeId | 204 | — |
| POST /ads/{creativeId}/report | Report ad | reason | 201 | 403, 409 |
| POST /settings/ad-opt-out | Opt out | — | 201 | 409 already opted out |
| DELETE /settings/ad-opt-out | Opt back in | — | 204 | 404 |
| GET /admin/advertising/advertisers | List advertisers | cursor | Paginated advertisers | 403 |
| POST /admin/advertising/advertisers | Create advertiser | companyName, contactEmail | Created advertiser | 403, 422 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|------------|---------|---------|-----------|
| CampaignCreated | Campaign created | { campaignId, advertiserId, orgId } | Audit log |
| CampaignActivated | Campaign goes active | { campaignId, orgId, adSlot } | Ad serving system |
| CampaignPaused | Campaign paused (manual or budget) | { campaignId, reason } | Audit log |
| CreativeApproved | Admin approves creative | { creativeId, campaignId, reviewedBy } | Campaign activation check |
| CreativeRejected | Admin rejects creative | { creativeId, campaignId, reason } | Advertiser notification |
| AdReported | Member reports ad | { reportId, creativeId, reason } | Admin notification, auto-pause check |
| CampaignBudgetExhausted | spentCents >= budgetCents | { campaignId } | Auto-pause trigger |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|------------|-------------|---------|-------------|
| MemberAdOptOutCreated | Self (M16) | updateAdServing | Exclude member from targeted ads |
| AdReported | Self (M16) | checkReportThreshold | Auto-pause if threshold reached (M16-R5) |

## 11. Acceptance Criteria

### AC-M16-001: Creative Approval
**Given** an ad creative is submitted  
**When** admin has not yet approved it  
**Then** the creative is not displayed to any member

### AC-M16-002: Targeting Privacy
**Given** a campaign with segment targeting  
**When** the advertiser views campaign details  
**Then** they see aggregate segment size only, no individual member data

### AC-M16-003: Sponsored Label
**Given** an approved creative is displayed  
**When** a member views it in any ad slot  
**Then** it is clearly labeled "Sponsored"

### AC-M16-004: Opt-Out
**Given** a member has opted out of targeted ads  
**When** ads are served  
**Then** they see only generic (non-targeted) ads, effective immediately

### AC-M16-005: Budget Enforcement
**Given** a campaign with budgetCents = 10000 and spentCents = 10000  
**When** the next impression would be served  
**Then** the campaign is auto-paused and no further impressions recorded

### AC-M16-006: Report Threshold
**Given** an ad creative reported by N members (N >= configurable threshold)  
**When** the Nth report is submitted  
**Then** the creative is auto-paused for admin review

## 12. Test Expectations

- **Unit:** Budget enforcement logic, report threshold check, opt-out filtering, creative status validation
- **Integration:** Campaign lifecycle (draft -> active -> paused -> completed), creative approval flow, impression/click recording, report accumulation and auto-pause
- **Contract:** POST /campaigns requires PA auth, PATCH /creatives enforces status machine, POST /impression returns 204
- **E2E:** Admin creates campaign with creative, approves creative, activates campaign; member sees ad with "Sponsored" label; member reports ad; member opts out

## 13. Edge Cases

- Campaign with all creatives rejected — cannot activate
- Budget set to 0 — campaign cannot serve any impressions
- Member opts out then back in — targeting resumes
- Campaign endsAt in the past — reject or immediately complete
- Same member reports same creative twice — 409 conflict
- Creative image URL returns 404 — fallback to text-only rendering [INFERRED]
- Ad slot not configured for association — no ads served in that slot
- Concurrent impression recording — atomic spentCents increment
- Very high impression volume — consider async impression recording [INFERRED]

## 14. Dependencies

### Internal Dependencies

- M02 (Person): Member identity for opt-out and reporting
- M03 (Billing): Campaign billing and revenue tracking
- M07 (Communications): Report notifications, campaign alerts
- M13 (Professional Feed): `feed_banner` ad slot rendering

### External Dependencies

- Image hosting / CDN for creative images (via Storage module)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Non-PA manages campaigns | 403 Forbidden | "Platform admin access required" |
| Campaign not found | 404 Not Found | "Campaign not found" |
| Creative not found | 404 Not Found | "Creative not found" |
| Duplicate ad report | 409 Conflict | "You have already reported this ad" |
| Already opted out | 409 Conflict | "You are already opted out of targeted ads" |
| Budget validation (0 or negative) | 422 Validation | "Budget must be a positive amount" |
| No approved creatives for activation | 422 Validation | "Campaign requires at least one approved creative to activate" |

## 16. Performance Expectations

- **Data volume:** ~10 campaigns/association, ~50 creatives total, millions of impressions
- **Concurrent users:** Impression tracking handles full platform traffic
- **Response times:** Ad serving < 50ms (p95), impression recording < 10ms, dashboard < 2s
- **Caching:** Active campaign + approved creatives cached per org; invalidated on status change
- **Impression recording:** Async/batch insert for high-volume impression data [INFERRED]

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|-------|-------|------|--------|------|
| ad.impression | INFO | Ad displayed | campaignId, creativeId, placement | No |
| ad.click | INFO | Ad clicked | campaignId, creativeId | No |
| ad.reported | WARN | Member reports ad | creativeId, reason | No |
| campaign.activated | INFO | Campaign goes active | campaignId, adSlot | No |
| campaign.paused | WARN | Campaign paused | campaignId, reason | No |
| campaign.budget.exhausted | WARN | Budget depleted | campaignId, spentCents | No |
| creative.approved | INFO | Creative approved | creativeId, reviewedBy | No |
| creative.rejected | WARN | Creative rejected | creativeId, reason | No |

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| ad_impressions_total | counter | format, placement | Impression count |
| ad_clicks_total | counter | format | Click count |
| ad_ctr | gauge | campaignId | Click-through rate |
| ad_reports_total | counter | — | Member ad reports |
| ad_spend_cents_total | counter | campaignId | Total spend |
| campaign_active_count | gauge | orgId | Currently active campaigns |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|--------------|
| advertising_enabled | boolean | false | Enable advertising module | Post Phase 2 GA |
| advertising_auto_pause_reports | boolean | true | Auto-pause creative on report threshold | — |
| advertising_report_threshold | number | 5 | Number of reports before auto-pause | — |
| advertising_impression_tracking | boolean | true | Enable impression/click tracking | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M16-S1 | Advertiser CRUD | Create/list/update advertisers | — | P0 |
| M16-S2 | Campaign CRUD | Create/list/update campaigns | M16-S1 | P0 |
| M16-S3 | Creative CRUD + Approval | Add creatives, approve/reject workflow | M16-S2 | P0 |
| M16-S4 | Ad Serving | Serve approved creatives in ad slots | M16-S3, M13 | P1 |
| M16-S5 | Impression/Click Tracking | Record and aggregate metrics | M16-S4 | P1 |
| M16-S6 | Budget Enforcement | Auto-pause on budget exhaustion | M16-S5 | P1 |
| M16-S7 | Member Reporting | Report ads, auto-pause threshold | M16-S4 | P2 |
| M16-S8 | Member Opt-Out | Opt out of targeted ads | M16-S4 | P2 |
| M16-S9 | Advertising Dashboard | Performance charts and metrics | M16-S5 | P2 |

## 20. AI Instructions

When implementing this module:
1. No existing handler code — scaffold `handlers/advertising/` from scratch following `handlers/person/createPerson.ts` pattern.
2. Schema file: `advertising/repos/advertising.schema.ts` as specified in DOMAIN_MODEL.md.
3. Use DOMAIN_MODEL enums exactly: `campaign_status` (draft, pending_review, active, paused, completed, rejected), `creative_status` (pending, approved, rejected), `ad_slot` (feed_banner, sidebar, email_footer, event_sponsor).
4. Convert workflows into vertical slice specs. Implement one slice at a time.
5. Impression recording must be high-throughput — consider batch inserts or in-memory buffer.
6. Privacy: never expose individual member data to advertisers (M16-R2). Segment sizes only.
7. All displayed ads must show "Sponsored" label (M16-R3). The `sponsoredLabel` column defaults to true.
8. Keep terminology consistent with the Domain Glossary.
9. Use acceptance criteria as test basis.
10. Follow ARCHITECTURE.md (Bun, Hono, Drizzle, TypeSpec-first), CONTRIBUTING.md, and CLAUDE.md.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | — |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP WF-092 to WF-096 + opt-out |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | M16-R1 through M16-R7 from PRD + DOMAIN_MODEL annotations |
| 6. Permissions | PARTIAL | No explicit ROLE_PERMISSION_MATRIX section for M16 |
| 7. Data Requirements | COMPLETE | All 5 tables from DOMAIN_MODEL.md (advertiser, ad_campaign, ad_creative, ad_report, member_ad_opt_out) |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL Advertising Context |
| 8. State Transitions | COMPLETE | From DOMAIN_MODEL enums and state inventory |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | COMPLETE | — |
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

- **M13 (Professional Feed):** Feed must support `feed_banner` ad slot rendering — coordinate implementation
- **M03 (Billing):** Campaign billing integration not yet specified — needs API contract [VERIFY]
- **MODULE_MAP.md:** M16 dependencies (M02, M03, M07, M13) must be reflected
- **ROLE_PERMISSION_MATRIX.md:** Missing section 3.x for Advertising — needs addition [VERIFY]
- **Impression/click tracking tables:** Not in DOMAIN_MODEL.md — may need `ad_impression` and `ad_click` tables or use analytics-only approach [VERIFY]
