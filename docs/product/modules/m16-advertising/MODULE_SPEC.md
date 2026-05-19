# Module Specification: Advertising (M16)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Revenue generation through targeted advertising — sponsored content, banner ads, and directory highlights. Platform admin manages advertisers, creative approval, targeting, and analytics. Members see clearly labeled ads with report/opt-out controls.

### Users
- Platform Administrator, Advertiser, Member

### Related Modules
- M03 (Platform Admin — advertiser management), M07 (Communications — delivery infrastructure)
- M13 (Professional Feed — sponsored content surface), M17 (Marketplace — directory highlights)

### In Scope
- Advertiser registration and approval, campaign management
- Ad formats: banner ads, sponsored content posts, directory listing highlights
- Targeting: specialty, location, membership category (segment-based, no individual data shared)
- Creative review and approval, ad slot configuration
- Performance analytics (impressions, clicks, CTR)
- Member controls: report ad, opt out of targeted advertising

### Out of Scope
- Self-serve advertiser portal (Phase 1 is admin-managed), programmatic bidding

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Advertiser | External entity (vendor, employer) paying for ad placement. |
| Campaign | Time-bounded advertising effort with budget, targeting, and creatives. |
| Sponsored Content | Post in Professional Feed labeled "Sponsored." |
| Ad Slot | Configured placement location (feed banner, sidebar, directory). |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Advertiser Registration | Advertiser | Apply to advertise | P1 |
| Campaign Creation | Platform Admin | Set up campaign with targeting and creatives | P1 |
| Creative Review | Platform Admin | Approve/reject ad creatives | P1 |
| Ad Slot Configuration | Platform Admin | Configure placements per association | P1 |
| Report Ad | Member | Flag inappropriate ad | P1 |
| Opt Out of Targeting | Member | Disable targeted ads | P1 |

## 4. Workflow Details

### Workflow: Campaign Creation (Journey 16A)

Actor: Platform Admin
Steps:
1. Advertiser submits campaign request: goals, budget, target audience, creatives.
2. Admin reviews creatives against content policy.
3. Approves creatives. Configures targeting (specialty, location, association).
4. Sets campaign dates and budget.
5. Campaign goes live. Ads appear in configured slots.
6. Performance tracked: impressions, clicks, CTR.

### Workflow: Member Reports Ad (Journey 16E)

Actor: Member
Steps:
1. Sees sponsored post or banner in feed.
2. Clicks "Report" or "..." menu.
3. Selects reason (inappropriate, misleading, irrelevant).
4. Report sent to admin review queue.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M16-R1 | IF ad creative submitted THEN require admin approval before display | Creative review | No self-serve publishing |
| M16-R2 | IF targeting configured THEN segment-based only, no individual member data shared | Privacy | Advertiser sees aggregate counts |
| M16-R3 | IF sponsored content THEN clearly labeled "Sponsored" | Display | UX requirement |
| M16-R4 | IF member opts out THEN no targeted ads, generic ads only | Opt-out | Respected immediately |
| M16-R5 | IF ad reported N times THEN auto-pause for review | Moderation | Threshold configurable |
| M16-R6 | IF campaign budget exhausted THEN pause delivery | Budget | No overspend |
| M16-R7 | IF ad slot per association THEN admin configures which slots active | Configuration | Per-association |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Manage advertisers | super, admin | All others | PA |
| Review creatives | super, admin | All others | PA |
| Configure ad slots | super, admin | All others | PA |
| View analytics | super, admin, analyst | All others | PA |
| Report ad | All authenticated | — | GA |
| Opt out | All authenticated | — | GA |

## 7. Data Requirements

### Entity: Advertiser

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| companyName | Yes | Advertiser name | — |
| companyType | Yes | Vendor/employer/other | — |
| contactEmail | Yes | Primary contact | — |
| status | Yes | pending/approved/suspended/rejected | Enum |

### Entity: Campaign

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| advertiserId | Yes | Advertiser FK | — |
| name | Yes | Campaign name | — |
| budgetCents | Yes | Total budget | Integer |
| startDate | Yes | Campaign start | — |
| endDate | Yes | Campaign end | After start |
| targeting | Yes | Targeting criteria | JSONB (specialty, location, associations) |
| status | Yes | draft/active/paused/completed | Enum |

### Entity: Creative

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| campaignId | Yes | Campaign FK | — |
| format | Yes | banner/sponsored_post/directory_highlight | Enum |
| content | Yes | Ad content (text, image URL, CTA) | JSONB |
| status | Yes | pending/approved/rejected | Enum |
| reviewedBy | No | Admin who reviewed | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Campaign | Creative, AdImpression | Targeting | Budget not exceeded. All creatives approved before live. |
| Advertiser | Campaign | — | Must be approved before campaigns. |

## 8. State Transitions

### Campaign Status
```txt
Draft → Active (all creatives approved + start date reached)
Active → Paused (admin or budget exhausted)
Active → Completed (end date reached)
Paused → Active (resumed)
```

### Creative Status
```txt
Pending → Approved → (live)
Pending → Rejected
```

## 9. UI / UX Requirements

### Screen: Advertising Dashboard (/admin/advertising)
Purpose: Platform-wide ad management
Components: Active campaigns, pending reviews, revenue metrics, advertiser list

### Screen: Campaign Detail (/admin/advertising/campaigns/[id])
Purpose: Campaign management and analytics
Components: Campaign config, creative previews, targeting display, performance charts (impressions, clicks, CTR)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /admin/advertisers | Register advertiser | Company data | advertiserId | 409 duplicate |
| POST /admin/campaigns | Create campaign | Campaign data | campaignId | 403, 400 |
| PUT /admin/creatives/:id/review | Review creative | approve/reject | Updated creative | 403 |
| POST /my/ads/report | Report ad | adId, reason | reported: true | — |
| POST /my/ads/opt-out | Opt out of targeting | — | optedOut: true | — |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CampaignActivated | Campaign goes live | campaignId, targeting | M13 (feed insertion) |
| CreativeApproved | Admin approves creative | creativeId, campaignId | — |
| AdReported | Member reports ad | adId, reason | Admin review queue |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PostViewed | M13 | Record ad impression | Impression counter |

## 11. Acceptance Criteria

### AC-M16-001: Creative Approval
No ad creative displayed without admin approval.

### AC-M16-002: Targeting Privacy
Advertisers never receive individual member data. Only aggregate segment counts.

### AC-M16-003: Sponsored Label
All sponsored content clearly labeled "Sponsored" in the feed.

### AC-M16-004: Opt-Out
Member opts out → no targeted ads, generic only. Takes effect immediately.

## 12. Test Expectations

Required tests:
- Creative approval: pending→approved→live, pending→rejected
- Targeting: segment-based, no PII leakage
- Budget: campaign pauses when budget exhausted
- Reporting: member reports, threshold-based auto-pause
- Opt-out: targeting disabled, generic ads shown

## 13. Edge Cases

- Campaign with $0 remaining budget: auto-paused before next impression.
- All creatives rejected: campaign cannot activate.
- Member opts out then opts back in: targeting resumes.
- Ad reported 10 times in 1 hour: auto-paused for review. [INFERRED threshold]

## 14. Dependencies

### Internal Dependencies
- M03 (Platform Admin), M07 (Communications — delivery), M13 (Feed — placement surface)

### External Dependencies
- None (ads served from platform, no ad network integration)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Budget exceeded | Pause campaign | (Admin notification) |
| Creative upload fails | Retry | "Upload failed. Try again." |
| Ad report submission fails | Retry | "Could not submit report." |

## 16. Performance Expectations

- Expected data volume: 10-50 active campaigns, 1000+ impressions/day
- Acceptable response times: Ad serving < 100ms (inline with feed load)

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| ad.impression | INFO | Ad displayed | campaignId, creativeId, placement | No |
| ad.click | INFO | Ad clicked | campaignId, creativeId | No |
| ad.reported | WARN | Member reports | adId, reason | No |
| campaign.budget.exhausted | WARN | Budget depleted | campaignId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| ad_impressions_total | counter | format, placement | Impression count |
| ad_clicks_total | counter | format | Click count |
| ad_ctr | gauge | campaignId | Click-through rate |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| advertising_enabled | release | false | Gates advertising module | — |
| advertising_directory_highlights | release | false | Directory highlight ads | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M16-S1 | Advertiser Management | Registration, approval | M03 | P1 |
| M16-S2 | Campaign CRUD | Create, configure, activate | M16-S1 | P1 |
| M16-S3 | Creative Review | Approval workflow | M16-S2 | P1 |
| M16-S4 | Feed Placement | Sponsored content in M13 feed | M16-S3, M13 | P1 |
| M16-S5 | Performance Analytics | Impressions, clicks, CTR | M16-S4 | P1 |
| M16-S6 | Member Controls | Report ad, opt out | M16-S4 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
