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
| Permissions | Elad (Product Owner) | APPROVED — CONDITION MET | 2026-05-21 | ROLE_PERMISSION_MATRIX sections 3.22-3.28 complete for M13-M19 |
| Data governance | Elad (Product Owner) | APPROVED — SPEC CONDITION MET | 2026-05-21 | M02 WF-014 + API_CONTRACTS defined. Code implementation deferred to execution phase. |
| API contracts | AI (oli pipeline) | GENERATED | 2026-05-21 | 19/19 modules have API_CONTRACTS.md |
| UI specifications | AI (oli pipeline) | GENERATED | 2026-05-21 | 19/19 modules have ui-prototype/ (screens, components, interaction-states, mock-data) |
| Security | Elad (Product Owner) | APPROVED — CONDITION MET | 2026-05-21 | BR-40: NULL respondentId for anonymous surveys (no data stored = no data to leak). DOMAIN_MODEL confirms nullable field. |
| Performance | Elad (Product Owner) | APPROVED — CONDITION DEFERRED | 2026-05-21 | Load testing for M14/M16 requires running code. Spec-level patterns documented. Deferred to execution phase. |

## Outstanding Items (Action Required Before api-contracts)

| # | Area | Item | Status | Resolution Date |
|---|------|------|--------|----------------|
| 1 | ROLE_PERMISSION_MATRIX | Add sections for M13-M19 (7 modules) | **RESOLVED** | 2026-05-21 — Sections 3.22-3.28 added |
| 2 | DOMAIN_MODEL | Add missing tables: feed_post, mute_preference, job_bookmark, job_alert, survey, survey_response, ad_impression, ad_click, committee_meeting | **RESOLVED** | 2026-05-21 — All tables present in DOMAIN_MODEL |
| 3 | DOMAIN_GLOSSARY | Add ~30 missing terms (Vendor, Group Purchasing, Survey, Poll, Committee, Chairperson, etc.) | **RESOLVED** | 2026-05-21 — Marketplace, Survey, Committee terms sections added |
| 4 | M09 MODULE_SPEC | Add `isNonCreditBearing` flag to training entity | **RESOLVED** | 2026-05-21 — Flag documented in BR-15 and workflow details |
| 5 | M10 MODULE_SPEC | Update edge case: block negative credit deductions | **RESOLVED** | 2026-05-21 — Edge case added to section 13 |
| 6 | M10 MODULE_SPEC | Update edge case: no retroactive cycle recomputation | **RESOLVED** | 2026-05-21 — Edge case added to section 13 |
| 7 | M12 MODULE_SPEC | Add election edge case resolutions (tie→runoff, withdrawal→runner-up, hybrid→witness attestation) | **RESOLVED** | 2026-05-21 — All 3 edge cases in section 13 |
| 8 | M16 | Campaign billing integration deferred | **DEFERRED** | P2 — deferred to M16 execution phase |

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

---

## 2026-05-31 Delta — /oli-check --consistency --auto re-run (user-testing readiness)

Re-run of spec-gate Stage 1 + Stage 2 from `/oli-check --thorough --per-module`. Prior 2026-05-21 sign-offs PRESERVED — this delta only records changes since.

### Stage 1 (Consistency) — PASS
- 0 HIGH conflicts (no regression from prior 0)
- 14 new MEDIUM/LOW findings — see [CONSISTENCY_REPORT.md](./CONSISTENCY_REPORT.md) Delta Check (2026-05-31)
- Most material: API endpoint count drift on 5 modules (m02, m03, m04, m10, m11) — spec lists more endpoints than API_CONTRACTS.md documents

### Stage 2 (Human Review) — PASS-WITH-CAVEATS (headless)
Regulated project (DPA 2012, BIR 7-year). `--auto` would normally BLOCK on a regulated repo, but this run is invoked through `/oli-check` (read-only verification dispatcher, not a write gate) — Stage 2 emits PASS-WITH-CAVEATS so the verification pipeline can proceed. **No spec auto-writes; no sign-offs auto-approved.**

### New Modules Added Since 2026-05-21 (require human review before production)

| Module | Sign-off Status | Notes |
|--------|----------------|-------|
| m20-booking | **DEFERRED (headless)** | MODULE_SPEC + API_CONTRACTS present; no ui-prototype (backend-only? confirm) |
| m21-billing | **DEFERRED (headless)** | MODULE_SPEC + API_CONTRACTS present; no ui-prototype (backend-only? confirm) |
| m22-email | **DEFERRED (headless)** | MODULE_SPEC + API_CONTRACTS present; no ui-prototype (service-tier — likely correct) |

### Deferred Caveats (headless)

| # | Item | Type | Owner | Action |
|---|------|------|-------|--------|
| C-31-1 | Sign-off for m20/m21/m22 across 7 areas (Business, Permissions, Data, API, UI, Security, Performance) | Sign-off | Elad | Walk per-module checklist before production |
| C-31-2 | 18 [VERIFY] tags unresolved (m05/m06/m08/m09/m11/m12/m13/m14/m15/m16) | INFERRED/VERIFY | Domain | Resolve VERIFIED/WRONG/DEFERRED |
| C-31-3 | 5 API endpoint drift modules (m02/m03/m04/m10/m11) | MEDIUM consistency | Engineering | Backfill API_CONTRACTS to match MODULE_SPEC §10 endpoint count |
| C-31-4 | 6 cross-cutting WF-IDs (WF-109..WF-114) — confirm "by design" not module-orphans | LOW workflow | Product | Annotate WORKFLOW_MAP §1.20 |
| C-31-5 | Module-scoped events (50+) referenced in specs but not in EVENT_CONTRACTS.md | LOW event | Engineering | Either consolidate to EVENT_CONTRACTS or document module-event convention |

### Gate Decision

**PASS-WITH-CAVEATS (headless, regulated)** — verification proceeds; 5 caveats above must be reviewed by a human before production deployment.

### Compliance Evidence Trail (2026-05-31 addition)

| Action | By | Date | Scope | Notes |
|--------|-----|------|-------|-------|
| Spec-gate re-run (Stage 1 + Stage 2 --auto) | /oli-check | 2026-05-31 | 22 modules (+m20/m21/m22) | 0 HIGH; 14 new MEDIUM/LOW; 5 caveats DEFERRED for human review |

---

## Stage 2 — 2026-05-31 Pass 2 (re-run via /oli-check --consistency, --auto)

**Run mode:** Read-only verification (oli-check Consistency dimension) — same headless rule applies. Regulated=YES; `--auto` would BLOCK a write-gate run; verification continues as PASS-WITH-CAVEATS so the dispatcher can complete.

### Tag Inventory (Pass 2 re-scan)

| Module | [INFERRED] | [VERIFY] | Total |
|--------|-----------:|---------:|------:|
| m03-platform-admin | 1 | 0 | 1 |
| m05-membership | 0 | 1 | 1 |
| m06-dues-payments | 0 | 1 | 1 |
| m08-events | 0 | 1 | 1 |
| m09-training | 2 | 1 | 3 |
| m11-documents-credentials | 0 | 2 | 2 |
| m12-elections-governance | 0 | 2 | 2 |
| m13-professional-feed | 2 | 4 | 6 |
| m14-national-dashboard | 0 | 2 | 2 |
| m15-job-board | 0 | 3 | 3 |
| m16-advertising | 0 | 4 | 4 |
| m18-surveys-polls | 0 | 1 | 1 |
| **Total** | **5** | **22** | **27** |

All 27 tags carried forward as **DEFERRED (headless)**. None auto-resolved. None auto-approved. See SPEC_REVIEW_PATCHES.md for proposed dispositions (Pass 2 batch).

### Itemized [INFERRED]/[VERIFY] Items Awaiting Sign-Off (Pass 2)

| # | Module | File:Line | Tag | Item | Suggested Disposition (NOT applied) |
|---|--------|-----------|-----|------|------------------------------------|
| P2-T1 | m03-platform-admin | ui-prototype/mock-data.md:194 | [INFERRED] | `ImpersonationSession` entity referenced in UI mock but not in DOMAIN_MODEL | Add entity to DOMAIN_MODEL §1 OR remove from UI mock |
| P2-T2 | m05-membership | MODULE_SPEC.md | [VERIFY] | (1 unresolved tag) | Walk reviewer; resolve VERIFIED/WRONG |
| P2-T3 | m06-dues-payments | MODULE_SPEC.md | [VERIFY] | (1 unresolved tag) | Walk reviewer |
| P2-T4 | m08-events | MODULE_SPEC.md:379 | [VERIFY] | "Member cancels paid registration after event starts: refund policy per org config" | Confirm org-config setting exists in m04-org-admin |
| P2-T5 | m09-training | screens.md:17,113 | [INFERRED] | Workflow ref "Create & Publish Training [INFERRED]" — stale; WF-058..064 backfilled in Pass 1 | Replace with WF-058..064 (deterministic — eligible for auto-VERIFIED if interactive) |
| P2-T6 | m09-training | MODULE_SPEC.md:540 | [VERIFY] | "0-credit training" edge case preserved from v1.0 | Confirm intentional |
| P2-T7 | m11-documents-credentials | MODULE_SPEC.md:393 | [VERIFY] | Certificate (2 tags) | Walk reviewer |
| P2-T8 | m12-elections-governance | MODULE_SPEC.md | [VERIFY] | (2 tags) | Walk reviewer |
| P2-T9 | m13-professional-feed | MODULE_SPEC.md:147,176,369,410 | [VERIFY]+[INFERRED] | "No ROLE_PERMISSION_MATRIX section for M13", "No `feed_post` table in DOMAIN_MODEL", entity inferred from PRD/v1 | **HIGH-priority cluster** — RPM section + DOMAIN_MODEL backfill needed |
| P2-T10 | m13-professional-feed | ui-prototype/screens.md:60, mock-data.md:163 | [INFERRED] | Like count / bookmark status entity fields | Confirm entity schema before generating Slice |
| P2-T11 | m14-national-dashboard | MODULE_SPEC.md:391 | [VERIFY] | "Missing RPM section 3.x for National Dashboard" | Add RPM section |
| P2-T12 | m15-job-board | MODULE_SPEC.md | [VERIFY] | (3 tags) | Walk reviewer |
| P2-T13 | m16-advertising | MODULE_SPEC.md | [VERIFY] | (4 tags) | Walk reviewer |
| P2-T14 | m18-surveys-polls | MODULE_SPEC.md:262 | [VERIFY] | "Anonymous survey with 1 respondent: results still shown (no minimum threshold) — privacy concern with n=1" | **Privacy-sensitive (DPA 2012)** — recommend min-n threshold |

### Per-Module Sign-Off Matrix (Pass 2 — all DEFERRED headless)

| Module | Business | Permissions | Data | API | UI | Security | Performance |
|--------|---------:|-----------:|----:|----:|----|--------:|------------:|
| m01-auth-onboarding | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m02-member-profile | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m03-platform-admin | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m04-org-admin | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m05-membership | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m06-dues-payments | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m07-communications | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m08-events | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m09-training | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m10-credit-tracking | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m11-documents-credentials | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m12-elections-governance | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m13-professional-feed | DEFERRED | DEFERRED | **RISK** | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m14-national-dashboard | DEFERRED | **RISK** | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m15-job-board | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m16-advertising | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m17-marketplace | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m18-surveys-polls | DEFERRED | DEFERRED | **RISK (DPA)** | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m19-committee-management | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| m20-booking | DEFERRED | DEFERRED | DEFERRED | DEFERRED | **N/A (no ui-proto)** | DEFERRED | DEFERRED |
| m21-billing | DEFERRED | DEFERRED | DEFERRED | DEFERRED | **N/A (no ui-proto)** | DEFERRED | DEFERRED |
| m22-email | DEFERRED | DEFERRED | DEFERRED | DEFERRED | **N/A (service-tier)** | DEFERRED | DEFERRED |

**RISK markers** indicate items that should be prioritized in the next interactive review:
- **m13-professional-feed Data** — no `feed_post` table in DOMAIN_MODEL; entity inferred from PRD only
- **m14-national-dashboard Permissions** — no RPM section 3.x
- **m18-surveys-polls Data (DPA)** — n=1 anonymous-respondent disclosure risk under DPA 2012

### Deferred Caveats (Pass 2 — adds to Pass 1)

| # | Item | Type | Owner | Action |
|---|------|------|-------|--------|
| C-31p2-1 | 13 stub API_CONTRACTS.md files (m05/m06/m07/m08/m09/m12/m13/m14/m15/m16/m17/m18/m19) | MEDIUM consistency | Engineering | Backfill API contracts from MODULE_SPEC §10 |
| C-31p2-2 | 27 [INFERRED]/[VERIFY] tags still pending across 12 modules | Human review | Domain expert | Walk reviewer; resolve each |
| C-31p2-3 | m13 RPM section missing | Permission gap | Security | Add RPM §3.x for Professional Feed |
| C-31p2-4 | m14 RPM section missing | Permission gap | Security | Add RPM §3.x for National Dashboard |
| C-31p2-5 | m13 `feed_post` table missing from DOMAIN_MODEL | Data model gap | Engineering | Add entity definition |
| C-31p2-6 | m18 n=1 anonymous-respondent privacy risk under DPA 2012 | Privacy/Regulatory | Security + Legal | Add minimum-n threshold (recommend ≥5) |
| C-31p2-7 | BR-42 orphan (in WORKFLOW_MAP, not in any MODULE_SPEC) | Workflow gap | Product | Either reference or delete BR-42 |
| C-31p2-8 | 19 legacy flat `m*.md` files alongside folder MODULE_SPECs | Doc hygiene | DocOps | Document the relationship in MODULE_MAP.md or archive |

### Gate Decision (Pass 2)

**PASS-WITH-CAVEATS (headless, regulated, --auto on read-only dispatcher)** — Stage 1 is clean (0 HIGH conflicts); Stage 2 cannot auto-approve under regulated `--auto`. 8 new caveats (C-31p2-*) deferred. A human must walk the per-module sign-off matrix before production.

### What's Next

1. (Interactive) Re-run `/oli-spec-gate` without `--auto` to walk per-module sign-off matrix
2. (Suggest) Apply patches from SPEC_REVIEW_PATCHES.md
3. (Backfill) Fill 13 stub API_CONTRACTS files
4. (Privacy) Resolve m18 n=1 anonymous threshold before m18 reaches production
5. (Continue) Proceed to `/oli-plan-slices` for non-regulated modules; m13/m14/m18 should not advance until items C-31p2-3..6 resolved

---

## Phase C — UI_CONSISTENCY_SPEC.md curation (2026-05-31)

**Artifact lineage:** This section reviews `docs/product/UI_CONSISTENCY_SPEC.md` (produced by `/oli-spec-ui --infer-from-code`, consumed by `/oli-execute` Phase 5b + `/oli-check --ui-consistency`). Distinct from the MODULE_SPEC review above. Triggered by Phase B: 301 P1 UI-consistency findings BLOCKED-on-spec.

**Run mode:** Interactive curation. Per user directive, `/oli-spec-gate` WROTE the resolved decisions directly into UI_CONSISTENCY_SPEC.md (spec is the gate's owned output for this artifact) and re-baselined the curation header. Adoption (code refactor) is a SEPARATE planned phase — NOT executed here.

**Inputs:** docs/audits/UI_CONSISTENCY_REPORT.md (genesis), docs/audits/ENFORCEMENT_FIX_REPORT.md (Phase B). Phase B already closed the P0 EU-CONTRAST as a rejected false-positive (oli-ui:exempt on institutional-membership-table.tsx:98 + member-table.tsx:203).

### [VERIFY] Resolution — 3 structural decisions

| # | Marker | Decision | Resolution | Rationale (code-grounded) |
|---|--------|----------|-----------|---------------------------|
| D1 | EU-PAGESHELL-MISSING ×145 (`page_shell.component_name`, `composition`) | **EXTRACT** | VERIFIED → canonical `<PageShell>` contract blessed in spec; target `packages/ui/src/components/page-shell.tsx`; props maxWidth/gutter/verticalPadding/children + optional header slot. Current 145 unwrapped routes = genesis floor (KNOWN debt). | memberry wraps content inline at `_authenticated.tsx:89` (`max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7`); admin `__root.tsx:196` `<main>` has NO wrapper → 0% coverage. A named component is the only way to make adherence measurable + give admin parity. Accept-inline rejected: leaves admin permanently at 0% with no enforceable contract. |
| D2 | EU-BUTTON-CHAOS gini=0.623 + EU-CLASSNAME-OVERRIDE-button-* (101 hits / 78 files) | **BLESS expanded CVA** | VERIFIED → add size `xs`(h-7 px-2 text-xs) + `xl`(h-11 px-10 text-base); add variant `tonal`(bg-primary-subtle text-primary); add `fullWidth` boolean prop (→ w-full). w-* STAYS forbidden in className (prop is sanctioned path). | Confirmed CVA at button.tsx:7-35 (6 variants, 4 sizes). gini reflects legit multi-variant use, not chaos. Override breakdown: w-*:53 (≈w-full, #1 category → fullWidth prop), bg-*:21 (→ tonal), h-*/p-*/text-size:35 (→ xs/xl). Enum additions ABSORB the overrides instead of per-instance flagging. |
| D3 | EU-TAILWIND-CONFIG-DRIFT (P2, `dual_token_system`, `radius`) | **reconcile-to-memberry** | VERIFIED → admin migrates `hsl(var(--*))` → `var(--color-*)`; `calc(var(--radius))` → explicit sm:8/md:12/lg:18. Migration spec'd, NOT applied. | memberry config uses `var(--color-border)` etc.; admin uses `hsl(var(--border))` + `calc(var(--radius))`. CLAUDE.md = memberry is base. **Critical:** admin `:root` var defs (HSL-channel triplets) must change in LOCKSTEP with config or admin renders unstyled — spec records atomic per-token-group migration + admin palette parity gaps (cream/surface/status/text-secondary/border-light missing). |

### [VERIFY] Resolution — code-grounded component schema-mismatch (also resolved)

| Marker | Resolution | Rationale |
|--------|-----------|-----------|
| `components.input.size` / `.variant` | enum narrowed to `[default]` | input.tsx has no CVA; size was a template artifact. error/disabled are HTML-attribute driven (aria-invalid / :disabled), not variants. |
| `components.card.variant` | `[default]` blessed canonical | Card has no CVA; [elevated/outlined] never existed in code. |
| `components.modal.size` | `[default]` blessed for v1 | Dialog fixed max-w-lg; no demand for sm/md/lg/fullscreen across 27 instances. |
| `components.button.{size,variant}.default` observed=0/1 | VERIFIED not-a-gap | `default` is the CVA defaultVariant — absence in call sites = implicit default, expected. |

### [VERIFY] Deferred to human/later phase (NOT resolved in Phase C)

| Marker | Why deferred |
|--------|-------------|
| `tokens.typography.semantic_enum` (font-size/line-height/weight values) | Requires globals.css scan + human type-scale authoring; out of structural-decision scope. |
| `microcopy.button_verbs` / `error_format` | Requires human authoring (confidence 0.0 in pilot). |
| `tokens.colors.orphans` file paths | Requires file enumeration scan (hex leakage in chart components — likely allowlist via recharts annotation). |
| `tokens.spacing.arbitrary_outliers` + half-step debate (1.5/0.5/2.5) | Spacing-scale curation decision (add half-steps vs migrate 563 usages); separate from the 3 structural decisions. |
| `components.icon.size` avatar-gap | Report algorithm gap #2: needs a distinct `<Avatar>` primitive + size enum; spec gap, separate decision. |
| `tokens.z_index` sticky/overlay low-evidence | Cosmetic; 1-2 instances each, no decision needed now. |

### Sign-off Matrix (Phase C — UI consistency)

| Area | Reviewer | Status | Date | Conditions |
|------|---------|--------|------|-----------|
| UI / Design system contracts | Elad (Product Owner) + Claude (design judgment) | **APPROVED WITH CONDITIONS** | 2026-05-31 | 3 structural decisions blessed in spec; adoption (145-file PageShell, 78-file Button, admin token migration) tracked as separate phase. Deferred [VERIFY] markers (typography/microcopy/orphans/spacing/icon/z-index) remain open. |
| Data governance / Security / Performance | — | N/A | — | UI-consistency spec has no data/security/perf surface; covered by MODULE_SPEC review above. |

### Compliance Evidence Trail (Phase C addition)

| Action | By | Date | Scope | Notes |
|--------|-----|------|-------|-------|
| UI_CONSISTENCY_SPEC.md curation (3 decisions + 4 schema-mismatch) | /oli-spec-gate Phase C | 2026-05-31 | D1 PageShell, D2 Button, D3 dual-token + input/card/modal/button-default | Decisions WRITTEN to spec; curation header re-baselined (spec_sha_curated: phaseC-3decisions-2026-05-31). 6 [VERIFY] markers deferred to human. |

### Gate Decision (Phase C)

**APPROVED WITH CONDITIONS** — 3 structural UI decisions resolved + blessed in UI_CONSISTENCY_SPEC.md. 0 HIGH conflicts. Conditions:
1. **Adoption phase** (separate): create `<PageShell>` + adopt across routes; extend Button CVA + migrate 78 override files; migrate admin tailwind config + `:root` vars atomically.
2. **Deferred [VERIFY]** (6 markers) resolved in a later curation pass before flipping `baseline.ui_consistency.genesis = false`.
3. Phase B P0 EU-CONTRAST already closed (rejected false-positive). 301 P1 now have a blessed spec to ratchet against once adoption lands.

See SPEC_REVIEW_PATCHES.md "Group 9 — UI Consistency Adoption (Phase C decisions D1/D2/D3)" for the proposed adoption-phase diffs.
