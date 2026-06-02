# Module Enforcement: m16-advertising

**Score:** 0.0/10 — CRITICALLY NON-COMPLIANT
**Source:** No handler directory (Future module)
**Spec:** docs/product/modules/m16-advertising/MODULE_SPEC.md
**Status:** COMPLETE
**Date:** 2026-05-28

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|-----|
| Public API Completeness | 0/10 | 0 | 13 | 0 | 0 |
| Workflow Implementation | 0/10 | 0 | 6 | 0 | 0 |
| Domain Term Consistency | N/A | 0 | 0 | 0 | 0 |
| State Machine Enforcement | 0/10 | 0 | 2 | 0 | 0 |
| Event Publishing | 0/10 | 0 | 7 | 0 | 0 |
| Business Rule Enforcement | 0/10 | 0 | 7 | 0 | 0 |
| Auth/Permission Enforcement | 0/10 | 0 | 8 | 0 | 0 |

**Total P1 findings: 43**

## Findings — Public API Completeness

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M16-a1b2c3d4 | P1 | Public API | GET /admin/advertising/campaigns — List campaigns: Not implemented (future module) | N/A | HIGH |
| EM-M16-e5f6a7b8 | P1 | Public API | POST /admin/advertising/campaigns — Create campaign: Not implemented (future module) | N/A | HIGH |
| EM-M16-c9d0e1f2 | P1 | Public API | GET /admin/advertising/campaigns/{id} — Campaign detail + metrics: Not implemented (future module) | N/A | HIGH |
| EM-M16-a3b4c5d6 | P1 | Public API | PATCH /admin/advertising/campaigns/{id} — Update campaign: Not implemented (future module) | N/A | HIGH |
| EM-M16-e7f8a9b0 | P1 | Public API | POST /admin/advertising/campaigns/{id}/creatives — Add creative: Not implemented (future module) | N/A | HIGH |
| EM-M16-c1d2e3f4 | P1 | Public API | PATCH /admin/advertising/creatives/{id} — Approve/reject creative: Not implemented (future module) | N/A | HIGH |
| EM-M16-a5b6c7d8 | P1 | Public API | POST /ads/{creativeId}/impression — Record impression: Not implemented (future module) | N/A | HIGH |
| EM-M16-e9f0a1b2 | P1 | Public API | POST /ads/{creativeId}/click — Record click: Not implemented (future module) | N/A | HIGH |
| EM-M16-c3d4e5f6 | P1 | Public API | POST /ads/{creativeId}/report — Report ad: Not implemented (future module) | N/A | HIGH |
| EM-M16-a7b8c9d0 | P1 | Public API | POST /settings/ad-opt-out — Member opt out: Not implemented (future module) | N/A | HIGH |
| EM-M16-e1f2a3b4 | P1 | Public API | DELETE /settings/ad-opt-out — Member opt back in: Not implemented (future module) | N/A | HIGH |
| EM-M16-c5d6e7f8 | P1 | Public API | GET /admin/advertising/advertisers — List advertisers: Not implemented (future module) | N/A | HIGH |
| EM-M16-a9b0c1d2 | P1 | Public API | POST /admin/advertising/advertisers — Create advertiser: Not implemented (future module) | N/A | HIGH |

## Findings — Workflow Implementation

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M16-e3f4a5b6 | P1 | Workflow | WF-092 (Campaign Creation) — Admin creates campaign with targeting, budget, creatives: Not implemented (future module) | N/A | HIGH |
| EM-M16-c7d8e9f0 | P1 | Workflow | WF-093 (Creative Approval) — Admin reviews and approves/rejects creatives: Not implemented (future module) | N/A | HIGH |
| EM-M16-a1b2c3d4 | P1 | Workflow | WF-094 (Campaign Lifecycle) — Draft→active→paused→completed with budget enforcement: Not implemented (future module) | N/A | HIGH |
| EM-M16-e5f6a7b8 | P1 | Workflow | WF-095 (Member Reports Ad) — Flag inappropriate ads with auto-pause threshold: Not implemented (future module) | N/A | HIGH |
| EM-M16-c9d0e1f2 | P1 | Workflow | WF-096 (Advertising Dashboard) — Impressions, clicks, revenue metrics: Not implemented (future module) | N/A | HIGH |
| EM-M16-d3e4f5a6 | P1 | Workflow | Member Opt-Out — Toggle targeted ad opt-out in settings: Not implemented (future module) | N/A | HIGH |

## Findings — State Machine Enforcement

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M16-b7c8d9e0 | P1 | State Machine | Campaign status machine (draft→pending_review→active→paused→completed/rejected, paused↔active): Not implemented (future module) | N/A | HIGH |
| EM-M16-f1a2b3c4 | P1 | State Machine | Creative status machine (pending→approved/rejected): Not implemented (future module) | N/A | HIGH |

## Findings — Event Publishing

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M16-d5e6f7a8 | P1 | Events | CampaignCreated event: Not implemented (future module) | N/A | HIGH |
| EM-M16-b9c0d1e2 | P1 | Events | CampaignActivated event: Not implemented (future module) | N/A | HIGH |
| EM-M16-f3a4b5c6 | P1 | Events | CampaignPaused event: Not implemented (future module) | N/A | HIGH |
| EM-M16-d7e8f9a0 | P1 | Events | CreativeApproved event: Not implemented (future module) | N/A | HIGH |
| EM-M16-b1c2d3e4 | P1 | Events | CreativeRejected event: Not implemented (future module) | N/A | HIGH |
| EM-M16-f5a6b7c8 | P1 | Events | AdReported event: Not implemented (future module) | N/A | HIGH |
| EM-M16-d9e0f1a2 | P1 | Events | CampaignBudgetExhausted event: Not implemented (future module) | N/A | HIGH |

## Findings — Business Rule Enforcement

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M16-b3c4d5e6 | P1 | Business Rule | M16-R1: Ad creatives require admin approval before display: Not implemented (future module) | N/A | HIGH |
| EM-M16-f7a8b9c0 | P1 | Business Rule | M16-R2: Segment-based targeting only, no individual member data shared: Not implemented (future module) | N/A | HIGH |
| EM-M16-d1e2f3a4 | P1 | Business Rule | M16-R3: All sponsored content labeled "Sponsored" (sponsoredLabel default true): Not implemented (future module) | N/A | HIGH |
| EM-M16-b5c6d7e8 | P1 | Business Rule | M16-R4: Member opt-out respected immediately, generic ads only: Not implemented (future module) | N/A | HIGH |
| EM-M16-f9a0b1c2 | P1 | Business Rule | M16-R5: Auto-pause creative after N reports (configurable threshold): Not implemented (future module) | N/A | HIGH |
| EM-M16-d3e4f5a6 | P1 | Business Rule | M16-R6: Auto-pause campaign when spentCents >= budgetCents: Not implemented (future module) | N/A | HIGH |
| EM-M16-b7c8d9e0 | P1 | Business Rule | M16-R7: Ad slots configured per association by admin: Not implemented (future module) | N/A | HIGH |

## Findings — Auth/Permission Enforcement

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M16-f1a2b3c4 | P1 | Auth/Perm | Manage advertisers restricted to Platform Admin: Not implemented (future module) | N/A | HIGH |
| EM-M16-d5e6f7a8 | P1 | Auth/Perm | Create/edit campaigns restricted to Platform Admin: Not implemented (future module) | N/A | HIGH |
| EM-M16-b9c0d1e2 | P1 | Auth/Perm | Approve/reject creatives restricted to Platform Admin: Not implemented (future module) | N/A | HIGH |
| EM-M16-f3a4b5c6 | P1 | Auth/Perm | Configure ad slots restricted to Platform Admin: Not implemented (future module) | N/A | HIGH |
| EM-M16-d7e8f9a0 | P1 | Auth/Perm | View advertising dashboard restricted to Platform Admin: Not implemented (future module) | N/A | HIGH |
| EM-M16-b1c2d3e4 | P1 | Auth/Perm | Report ad available to all authenticated members: Not implemented (future module) | N/A | HIGH |
| EM-M16-f5a6b7c8 | P1 | Auth/Perm | Opt out of targeting available to all authenticated members: Not implemented (future module) | N/A | HIGH |
| EM-M16-d9e0f1a2 | P1 | Auth/Perm | View ads available to all members (respecting opt-out): Not implemented (future module) | N/A | HIGH |

## Data Entities (Declared, Not Implemented)

| Entity | Fields | Schema File |
|--------|--------|-------------|
| Advertiser | 8 fields (id, organizationId, companyName, contactEmail, contactPersonId, isActive, createdAt, updatedAt) | N/A |
| AdCampaign | 14 fields (id, organizationId, advertiserId, name, description, status, targetSegmentId, targetSegmentSize, budgetCents, spentCents, startsAt, endsAt, adSlot, createdAt, updatedAt) | N/A |
| AdCreative | 13 fields (id, organizationId, campaignId, title, bodyText, imageUrl, clickUrl, status, reviewedBy, reviewedAt, rejectionReason, sponsoredLabel, createdAt, updatedAt) | N/A |
| AdReport | 6 fields (id, organizationId, creativeId, reporterPersonId, reason, createdAt) | N/A |
| MemberAdOptOut | 4 fields (id, organizationId, personId, optedOutAt) | N/A |

## Vertical Slices (All Pending)

| Slice | Name | Priority | Status |
|-------|------|----------|--------|
| M16-S1 | Advertiser CRUD | P0 | NOT STARTED |
| M16-S2 | Campaign CRUD | P0 | NOT STARTED |
| M16-S3 | Creative CRUD + Approval | P0 | NOT STARTED |
| M16-S4 | Ad Serving | P1 | NOT STARTED |
| M16-S5 | Impression/Click Tracking | P1 | NOT STARTED |
| M16-S6 | Budget Enforcement | P1 | NOT STARTED |
| M16-S7 | Member Reporting | P2 | NOT STARTED |
| M16-S8 | Member Opt-Out | P2 | NOT STARTED |
| M16-S9 | Advertising Dashboard | P2 | NOT STARTED |


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
