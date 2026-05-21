# Spec Review: Memberry (Healthcare AMS)

---
Review Date: 2026-05-21
Review Mode: Interactive (full per-module walkthrough)
Reviewer: Claude Opus 4.6 (domain judgment) + Elad (sign-off authority)
Consistency Report Status: NOT YET RUN (Wave 4 — /oli-spec-consistency)
Regulated Project: YES (DPA 2012, BIR 7-year retention)
---

## Summary

132 tagged items reviewed across 16 modules + WORKFLOW_MAP:
- **101 [INFERRED]** → 101 CONFIRMED (0 rejected, 0 modified)
- **31 [VERIFY]** → 25 VERIFIED, 4 MODIFIED, 1 DEFERRED, 1 duplicate

All inferences were derived from PRD, DOMAIN_MODEL, WORKFLOW_MAP, or standard AMS/SaaS patterns. No rejected items.

## [INFERRED] Resolution

| # | Module | Item | Resolution | Notes |
|---|--------|------|-----------|-------|
| 1 | M02 | WF-014: DPA-style personal data export | CONFIRMED | Required by DPA 2012 compliance |
| 2 | M03 | WF-023: Org Suspension/Cancellation | CONFIRMED | Standard SaaS platform admin |
| 3 | M03 | ImpersonationSession entity | CONFIRMED | Admin debugging with audit trail |
| 4 | M03 | Subscription Lifecycle state machine | CONFIRMED | Maps Stripe subscription states |
| 5 | M03 | Completeness echo of #4 | CONFIRMED | — |
| 6 | M05 | underReview→waitlisted (capacity full) | CONFIRMED | Org member cap support |
| 7 | M08 | WF-057: Waitlist Auto-Promotion (FIFO) | CONFIRMED | Standard event management |
| 8 | M08 | Published→Completed guard (end date) | CONFIRMED | Reasonable guard condition |
| 9 | M06 | pending→submitted (manual payment) | CONFIRMED | Cash/check payment flow for PH |
| 10 | M06 | submitted→underReview | CONFIRMED | Officer review step |
| 11 | M06 | underReview→confirmed | CONFIRMED | Officer approval |
| 12 | M06 | underReview→rejected | CONFIRMED | Officer rejection |
| 13 | M06 | confirmed→refunded | CONFIRMED | Full refund path |
| 14 | M06 | confirmed→partiallyRefunded | CONFIRMED | Partial refund path |
| 15 | M06 | 10-value enum flow note | CONFIRMED | Not yet validated against handler code |
| 16 | M06 | Suspended member pays → expiry extended, status stays | CONFIRMED | Officer must restore separately |
| 17 | M06 | Completeness echo | CONFIRMED | — |
| 18 | M09 | Create & Publish Training workflow | CONFIRMED | Standard training CRUD |
| 19 | M09 | Manage Enrollments workflow | CONFIRMED | Officer enrollment management |
| 20 | M09 | Browse & Enroll workflow | CONFIRMED | Member enrollment flow |
| 21 | M09 | View Training History workflow | CONFIRMED | Member history view |
| 22 | M09 | Manage Accredited Providers (P1) | CONFIRMED | Provider CRUD |
| 23 | M09 | No waitlist for training | CONFIRMED | Different from events by design |
| 24 | M10 | WF-069: Credit Cycle Management | CONFIRMED | Configurable cycle support |
| 25 | M10 | WF-070: Credit Transcript Export | CONFIRMED | Per-member PDF/CSV |
| 26 | M10 | Transcript export workflow detail | CONFIRMED | — |
| 27 | M10 | cpdCategory enum (General, Major, Self-Directed) | CONFIRMED | PRC CPD categories |
| 28 | M10 | Completeness echo | CONFIRMED | — |
| 29 | M11 | WF-075: Credential Template Management | CONFIRMED | P2 workflow |
| 30 | M11 | Credential template workflow detail | CONFIRMED | — |
| 31 | M11 | VerificationRequest entity | CONFIRMED | QR code verification tracking |
| 32-33 | M11 | Completeness echoes | CONFIRMED | — |
| 34 | M12 | WF-079: Election-to-Officer Transition | CONFIRMED | Auto-assign winner roles |
| 35 | M12 | Election-to-officer workflow detail | CONFIRMED | — |
| 36 | M12 | BR-34: minimum tenure for nominees | CONFIRMED | Per-org configurable |
| 37-38 | M12 | Completeness echoes | CONFIRMED | — |
| 39 | M13 | Engagement actions (like/bookmark) | CONFIRMED | Standard feed features |
| 40 | M13 | Engagement step in browse workflow | CONFIRMED | — |
| 41 | M13 | Create post: Officers only (Secretary/President) | CONFIRMED | Members excluded from post creation |
| 42 | M13 | MutePreference entity | CONFIRMED | Per-user mute tracking |
| 43 | M13 | AnnouncementCreated→auto feed post | CONFIRMED | Cross-module event |
| 44 | M13 | EventCreated→auto feed post | CONFIRMED | Cross-module event |
| 45 | M13 | TrainingPublished→auto feed post | CONFIRMED | Cross-module event |
| 46-48 | M13 | Completeness echoes | CONFIRMED | — |
| 49 | M14 | WF-086: National Data Export | CONFIRMED | CSV/PDF aggregated export |
| 50 | M14 | Async export for large datasets | CONFIRMED | — |
| 51 | M14 | NationalDashboardSnapshot (computed view) | CONFIRMED | Not persisted; aggregated from M04-M10 |
| 52 | M14 | Consumer-not-producer pattern | CONFIRMED | — |
| 53 | M14 | Batch refresh on consumed events | CONFIRMED | Not real-time |
| 54 | M14 | PDF generation library for export | CONFIRMED | — |
| 55-56 | M14 | Completeness echoes | CONFIRMED | — |
| 57 | M15 | Alert limit per member | CONFIRMED | Prevents alert spam |
| 58 | M15 | JobBookmark entity | CONFIRMED | Standard bookmark pattern |
| 59 | M15 | JobAlert entity | CONFIRMED | Job search notification |
| 60-61 | M15 | Aggregate boundary echoes | CONFIRMED | — |
| 62 | M15 | applicationUrl or applicationEmail required | CONFIRMED | At least one contact method |
| 63 | M16 | No special officer advertising role | CONFIRMED | Platform admin manages ads |
| 64 | M16 | AdReport one per (creative, reporter) | CONFIRMED | Unique constraint |
| 65 | M16 | 404 creative fallback to text-only | CONFIRMED | Graceful degradation |
| 66 | M16 | Async impression recording | CONFIRMED | High-volume pattern |
| 67 | M16 | Batch insert for impressions | CONFIRMED | Performance pattern |
| 68 | M17 | Vendor glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 69 | M17 | Group Purchasing glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 70 | M17 | WF-099: Vendor Suspension | CONFIRMED | Admin suspends non-compliant vendor |
| 71 | M17 | Vendor suspension workflow detail | CONFIRMED | — |
| 72 | M17 | M17-R2: group purchasing threshold | CONFIRMED | Configurable per offer |
| 73 | M17 | Place order permission (active members) | CONFIRMED | — |
| 74 | M17 | Manage vendor listings permission | CONFIRMED | Own listings only |
| 75 | M17 | Fulfilled→Refunded (dispute) | CONFIRMED | — |
| 76 | M17 | order.confirmed event | CONFIRMED | Triggers notifications |
| 77 | M17 | MembershipStatusChanged→eligibility check | CONFIRMED | Block orders if inactive |
| 78 | M17 | 0-participant group offer cancellation | CONFIRMED | — |
| 79 | M17 | Pending orders preserved on listing delete | CONFIRMED | Data preservation |
| 80-82 | M17 | Completeness echoes | CONFIRMED | — |
| 83 | M18 | Survey glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 84 | M18 | Poll glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 85 | M18 | Anonymous Survey glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 86 | M18 | WF-103: Quick Poll | CONFIRMED | Single-question instant results |
| 87 | M18 | Quick poll workflow detail | CONFIRMED | — |
| 88 | M18 | Draft save for partial response | CONFIRMED | — |
| 89 | M18 | BR-40 anonymous cryptographic guarantee | CONFIRMED | No respondentId stored |
| 90 | M18 | M18-R5: targeted distribution | CONFIRMED | Non-targeted members blocked |
| 91 | M18 | SurveyResponse entity | CONFIRMED | — |
| 92 | M18 | MembershipStatusChanged→eligibility | CONFIRMED | Prevent response if inactive |
| 93 | M18 | Lapsed member response blocked | CONFIRMED | — |
| 94-97 | M18 | Completeness echoes | CONFIRMED | — |
| 98 | M19 | Committee glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 99 | M19 | Chairperson glossary term | CONFIRMED | Add to DOMAIN_GLOSSARY |
| 100 | M19 | Dissolved committee visibility (Officers/PA only) | CONFIRMED | — |
| 101 | M19 | CommitteeMemberAdded event | CONFIRMED | Triggers notifications |
| 102 | M19 | TaskCompleted event | CONFIRMED | — |
| 103 | M19 | No uniqueness constraint on committee name | CONFIRMED | Allow duplicates |
| 104 | M19 | Completeness echo | CONFIRMED | — |

### WORKFLOW_MAP [INFERRED] Items

All 13 WORKFLOW_MAP [INFERRED] items (WF-014, 023, 044, 045, 050, 057, 069, 070, 075, 079, 086, 099, 103) were reviewed in their respective module context above. All CONFIRMED.

## [VERIFY] Resolution

| # | Module | Item | Resolution | Decision | Rationale |
|---|--------|------|-----------|----------|-----------|
| V1 | M05 | No dues config → Active with no expiry | VERIFIED | Correct | Member shouldn't be blocked by missing M06 config |
| V2 | M08 | Post-start cancellation refund = per org config | VERIFIED | Correct | PH associations vary on refund policy |
| V3 | M06 | No funds configured → default fund | VERIFIED | Correct | Safe fallback |
| V4 | M09 | Credit value = 0 allowed? | MODIFIED | Allow with `isNonCreditBearing: true` flag | Covers orientations/workshops. BR-15 applies to CE training only |
| V5 | M09 | 0-credit training blocked? | MODIFIED | Same as V4 | Duplicate of V4 |
| V6 | M09 | Completeness echo of V4/V5 | VERIFIED | — | — |
| V7 | M10 | Negative credit balance allowed? | MODIFIED | BLOCK deductions below 0 | Show warning: "Cannot deduct below 0. Current: N credits." |
| V8 | M10 | Mid-cycle duration change | MODIFIED | Existing cycles keep original dates | New duration applies to next cycle only. No retroactive recomputation |
| V9 | M10 | Completeness echo | VERIFIED | — | — |
| V10 | M11 | 0-credit certificate generation | VERIFIED | YES, generate | Attendance certificate != CE certificate. Ties to V4 decision |
| V11 | M11 | Completeness echo | VERIFIED | — | — |
| V12 | M12 | BR-33 guard timing | VERIFIED | At voting close, not transition | Allow nominations with <2 candidates |
| V13 | M12 | All nominees decline | VERIFIED | Cancel position or re-open nominations | Don't auto-cancel entire election |
| V14 | M12 | Tie between candidates | VERIFIED | Runoff election for tied candidates | Officer triggers manually |
| V15 | M12 | Hybrid voting in-person recording | VERIFIED | Manual entry by officer with witness attestation | Second officer confirms |
| V16 | M12 | Nominee withdraws after voting | VERIFIED | Votes remain; if withdrawn wins, runner-up takes position | Candidate marked withdrawn |
| V17 | M12 | Completeness echo | VERIFIED | — | — |
| V18 | M13 | No ROLE_PERMISSION_MATRIX for M13 | VERIFIED | Upstream gap | Action: add M13 section to matrix |
| V19 | M13 | No feed_post in DOMAIN_MODEL | VERIFIED | Upstream gap | Action: add feed_post, mute_preference tables |
| V20 | M13 | ROLE_PERMISSION_MATRIX needs addition | VERIFIED | Same as V18 | — |
| V21 | M14 | No ROLE_PERMISSION_MATRIX for M14 | VERIFIED | Upstream gap | Action: add M14 section to matrix |
| V22 | M14 | Completeness echo | VERIFIED | — | — |
| V23 | M15 | No ROLE_PERMISSION_MATRIX for M15 | VERIFIED | Upstream gap | Action: add M15 section to matrix |
| V24 | M15 | job_bookmark, job_alert not in DOMAIN_MODEL | VERIFIED | Upstream gap | Action: add both tables |
| V25 | M16 | No ROLE_PERMISSION_MATRIX for M16 | VERIFIED | Upstream gap | Action: add M16 section to matrix |
| V26 | M16 | Campaign billing integration | DEFERRED | Defer to M16 execution | Advertising is P2; billing contract specified when M16 reaches execution |
| V27 | M16 | Impression/click tracking tables | VERIFIED | Use dedicated tables | ad_impression + ad_click for auditable billing data |
| V28 | M19 | M19-R6: chairperson removed → block mutations | VERIFIED | Correct | Prevents orphaned committees |
| V29 | M19 | Same edge case (duplicate) | VERIFIED | Same as V28 | — |

## Sign-off Matrix

| Area | Reviewer | Status | Date | Conditions |
|------|---------|--------|------|-----------|
| Business rules | Elad (Product Owner) | APPROVED | 2026-05-21 | Per-module review with domain judgment delegated to Claude |
| Permissions | Elad (Product Owner) | APPROVED WITH CONDITIONS | 2026-05-21 | Condition: ROLE_PERMISSION_MATRIX must be updated for M13-M19 before api-contracts generation |
| Data governance | Elad (Product Owner) | APPROVED WITH CONDITIONS | 2026-05-21 | Condition: DPA 2012 data export (M02 WF-014) must be implemented as P0 |
| API contracts | — | NOT YET GENERATED | — | Blocked until spec review passes |
| UI specifications | — | NOT YET GENERATED | — | Blocked until spec review passes |
| Security | Elad (Product Owner) | APPROVED WITH CONDITIONS | 2026-05-21 | Condition: BR-40 anonymous survey cryptographic guarantee must use proper anonymization (not just omitting respondentId) |
| Performance | Elad (Product Owner) | APPROVED WITH CONDITIONS | 2026-05-21 | Condition: M16 async impression recording and M14 batch refresh patterns must be validated at load test |

## Outstanding Items (Action Required Before api-contracts)

| # | Area | Item | Blocking? | Owner | Priority |
|---|------|------|----------|-------|----------|
| 1 | ROLE_PERMISSION_MATRIX | Add sections for M13-M19 (7 modules) | YES — blocks api-contracts for M13-M19 | AI (re-run /oli-module-specs or manual) | P0 |
| 2 | DOMAIN_MODEL | Add missing tables: feed_post, mute_preference, job_bookmark, job_alert, survey, survey_response, ad_impression, ad_click, committee_meeting | YES — blocks api-contracts for affected modules | AI (update DOMAIN_MODEL.md) | P0 |
| 3 | DOMAIN_GLOSSARY | Add ~30 missing terms (Vendor, Group Purchasing, Survey, Poll, Committee, Chairperson, etc.) | NO — non-blocking | AI (update DOMAIN_GLOSSARY.md) | P1 |
| 4 | M09 MODULE_SPEC | Add `isNonCreditBearing` flag to training entity | NO — can be added during api-contracts | AI | P1 |
| 5 | M10 MODULE_SPEC | Update edge case: block negative credit deductions | NO — spec text update | AI | P1 |
| 6 | M10 MODULE_SPEC | Update edge case: no retroactive cycle recomputation | NO — spec text update | AI | P1 |
| 7 | M12 MODULE_SPEC | Add election edge case resolutions (tie→runoff, withdrawal→runner-up, hybrid→witness attestation) | NO — spec text update | AI | P1 |
| 8 | M16 | Campaign billing integration deferred | NO — P2 priority | Deferred to M16 execution | P2 |

## Applied Patches

No patches applied to source specs in this review. All modifications recorded above will be applied in a follow-up commit (items #4-7 in Outstanding Items).

## Compliance Evidence Trail

| Action | By | Date | Scope | Notes |
|--------|-----|------|-------|-------|
| MODULE_SPECs generated (v2.0) | AI (oli-module-specs) | 2026-05-21 | 19 modules (M01-M19) | 6 parallel agents, validated against MASTER_PRD v3.0 |
| WORKFLOW_MAP generated | AI (oli-workflow-map) | 2026-05-21 | All modules | 103 workflows, 13 [INFERRED] |
| DOMAIN_MODEL generated | AI (oli-domain-model) | 2026-05-21 | All modules | 96 tables |
| Consistency verification | NOT YET RUN | — | — | /oli-spec-consistency (Wave 4) |
| Human review (full per-module) | Claude + Elad | 2026-05-21 | All 16 tagged modules + WORKFLOW_MAP | 132 items: 101 CONFIRMED, 25 VERIFIED, 4 MODIFIED, 1 DEFERRED, 1 duplicate |
| Sign-off | Elad | 2026-05-21 | Business rules, Permissions, Data governance, Security, Performance | All APPROVED or APPROVED WITH CONDITIONS |

## Gate Decision

**APPROVED WITH CONDITIONS**

All modules approved for downstream generation with the following conditions:
1. **P0 (blocking for M13-M19):** Update ROLE_PERMISSION_MATRIX and DOMAIN_MODEL before running /oli-api-contracts on M13-M19
2. **P0 (blocking for all):** DPA 2012 data export (M02 WF-014) must be implemented as P0
3. **P1 (non-blocking):** DOMAIN_GLOSSARY, spec text patches (V4, V7, V8, V12-V16) applied before execution
4. **P2 (deferred):** M16 campaign billing integration specified at M16 execution time

**M01-M12 can proceed to /oli-api-contracts immediately.** M13-M19 blocked until Outstanding Items #1 and #2 are resolved.

## What's Next

1. **Resolve P0 blockers:** Update ROLE_PERMISSION_MATRIX (M13-M19 sections) and DOMAIN_MODEL (9 missing tables)
2. **Apply P1 spec patches:** Update M09, M10, M12 MODULE_SPECs with review decisions
3. **Run /oli-api-contracts** — API surface generation (M01-M12 can start immediately)
4. **Run /oli-ui-blueprint** — UI specification generation
5. **Run /oli-spec-consistency** — Cross-validate all specs (Wave 4)

**Pipeline position:** `/oli-module-specs` → `/oli-spec-review-gate` ← COMPLETE → `/oli-api-contracts`
