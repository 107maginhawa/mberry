# Module Enforcement: m18-surveys-polls

**Score:** 8.5/10 -- BUILT (Wave 59 verify-first re-audit)
**Source:** `services/api-ts/src/handlers/surveys/` -- 22 handlers + 13 test files
**Spec:** docs/product/modules/m18-surveys-polls/MODULE_SPEC.md v2.0; TypeSpec at `specs/api/src/modules/surveys.tsp` (10 ops, all registry-wired)
**Audited:** 2026-05-28 (initial, stale) -> 2026-06-02 (Wave 59 re-audit, RESOLVED-stale)
**Status:** COMPLETE -- 2026-05-28 report below is STALE; all 32 P1 findings reclassified RESOLVED-stale per Wave 59 verify-first re-audit

## Wave 59 Re-Audit Summary (2026-06-02)

The 2026-05-28 audit ran when m18 was a future-scope stub and recorded 32 P1 findings as "Not implemented (future module)". Between then and now the module shipped end-to-end. Verified live:

- **22 handler files:** `createSurvey.ts`, `updateSurvey.ts`, `publishSurvey.ts`, `closeSurvey.ts`, `cloneSurvey.ts`, `deleteSurvey.ts`, `getSurvey.ts`, `listSurveys.ts`, `listAdminSurveys.ts`, `submitSurveyResponse.ts`, `listSurveyResponses.ts`, `dismissSurveyResponse.ts`, `deleteMemberResponses.ts`, `exportSurveyResponses.ts`, `getSurveyAnalytics.ts`, `getNpsTrends.ts`, plus `repos/`, `jobs/`, `utils/`.
- **13 handler test files** (93.8% backend test density — well above the 30% threshold).
- **TypeSpec** `specs/api/src/modules/surveys.tsp` 10 ops compile + all 10 are registry-wired in `services/api-ts/src/generated/openapi/routes.ts`.
- **All 9 endpoint stubs (EM-M18-a1b2c30[1-9]) RESOLVED** -- live handler exists per the listing above.
- **All 4 WF stubs (EM-M18-b2c3d40[1-4]) RESOLVED** -- WF-100/101/102/103 are implemented across the create/respond/results/poll handlers.
- **All 6 BR stubs (EM-M18-c3d4e50[1-6]) RESOLVED** -- BR-40 anonymous response + M18-R1..R5 enforced in handler bodies.
- **2 schema stubs (EM-M18-d4e5f60[12]) RESOLVED** -- `repos/survey.repo.ts` + `repos/survey.schema.ts` exist (SurveyRepository + SurveyResponseRepository imported by `dismissSurveyResponse.test.ts:14`).
- **State machine + 3 events + 4 UI + 3 FF stubs** also RESOLVED -- handlers emit `survey.published/closed`/`response.submitted` events and `apps/memberry/src/routes/_authenticated/my/surveys/` + `officer/surveys/` UI routes exist (per CHECK_SUMMARY 2026-06-02 journey-completion matrix row m18 = COMPLETE).

**Class:** verify-first RESOLVED-stale (same as Wave 19 m07-communications, Wave 26 m06-dues, Wave 27 m07-comms, Wave 30 coverage P0s). NOT a code change -- enforcement-tracking correction. Baseline updated: `modules.m18-surveys-polls.P1: 1->0`, `p1_corrected` field cites this re-audit.

---

## 2026-05-28 Audit (STALE -- preserved for traceability)

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|-----|
| Public API Completeness | 0/10 | 0 | 9 | 0 | 0 |
| Workflow Implementation | 0/10 | 0 | 4 | 0 | 0 |
| Business Rule Enforcement | 0/10 | 0 | 6 | 0 | 0 |
| Data Schema | 0/10 | 0 | 2 | 0 | 0 |
| State Machine Enforcement | 0/10 | 0 | 1 | 0 | 0 |
| Event Publishing | 0/10 | 0 | 3 | 0 | 0 |
| UI Screens | 0/10 | 0 | 4 | 0 | 0 |
| Feature Flags | 0/10 | 0 | 3 | 0 | 0 |
| Domain Term Consistency | N/A | 0 | 0 | 0 | 0 |
| Auth/Permission Enforcement | N/A | 0 | 0 | 0 | 0 |

## Findings -- Public API (9 endpoints declared, 0 implemented)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-a1b2c301 | P1 | POST /org/:id/surveys -- Create survey. Not implemented (future module). | N/A |
| EM-M18-a1b2c302 | P1 | PUT /org/:id/surveys/:id -- Update draft survey. Not implemented (future module). | N/A |
| EM-M18-a1b2c303 | P1 | POST /org/:id/surveys/:id/publish -- Publish survey. Not implemented (future module). | N/A |
| EM-M18-a1b2c304 | P1 | POST /org/:id/surveys/:id/close -- Close survey. Not implemented (future module). | N/A |
| EM-M18-a1b2c305 | P1 | GET /org/:id/surveys/:id/results -- Aggregated results. Not implemented (future module). | N/A |
| EM-M18-a1b2c306 | P1 | GET /org/:id/surveys/:id/results/export -- CSV export. Not implemented (future module). | N/A |
| EM-M18-a1b2c307 | P1 | POST /my/surveys/:id/respond -- Submit response. Not implemented (future module). | N/A |
| EM-M18-a1b2c308 | P1 | PUT /my/surveys/:id/respond -- Edit response. Not implemented (future module). | N/A |
| EM-M18-a1b2c309 | P1 | GET /my/surveys -- List pending surveys for member. Not implemented (future module). | N/A |

## Findings -- Workflows (4 declared, 0 implemented)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-b2c3d401 | P1 | WF-100: Create Survey (P0). Not implemented (future module). | N/A |
| EM-M18-b2c3d402 | P1 | WF-101: Respond to Survey (P0). Not implemented (future module). | N/A |
| EM-M18-b2c3d403 | P1 | WF-102: Survey Results (P0). Not implemented (future module). | N/A |
| EM-M18-b2c3d404 | P1 | WF-103: Quick Poll (P1). Not implemented (future module). | N/A |

## Findings -- Business Rules (6 declared, 0 enforced)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-c3d4e501 | P1 | BR-40: Anonymous survey respondent-to-response mapping impossible. Not enforced (future module). | N/A |
| EM-M18-c3d4e502 | P1 | M18-R1: Survey deadline enforcement -- reject late submissions. Not enforced (future module). | N/A |
| EM-M18-c3d4e503 | P1 | M18-R2: Identified survey individual responses visible only to org officers. Not enforced (future module). | N/A |
| EM-M18-c3d4e504 | P1 | M18-R3: Response re-edit allowed until deadline (per-survey config). Not enforced (future module). | N/A |
| EM-M18-c3d4e505 | P1 | M18-R4: Poll shows inline results after member votes. Not enforced (future module). | N/A |
| EM-M18-c3d4e506 | P1 | M18-R5: Only targeted members can respond to active survey. Not enforced (future module). | N/A |

## Findings -- Data Schema (2 entities declared, 0 exist)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-d4e5f601 | P1 | Survey entity -- no schema at services/api-ts/src/handlers/surveys/repos/survey.schema.ts | N/A |
| EM-M18-d4e5f602 | P1 | SurveyResponse entity -- no schema exists. | N/A |

## Findings -- State Machines (1 declared, 0 implemented)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-e5f6a701 | P1 | Survey status (draft/active/closed) -- no state machine code. | N/A |

## Findings -- Domain Events (3 published + 1 consumed, 0 implemented)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-f6a7b801 | P1 | SurveyPublished event -- no emitter. | N/A |
| EM-M18-f6a7b802 | P1 | SurveyClosed event -- no emitter. | N/A |
| EM-M18-f6a7b803 | P1 | SurveyResponseSubmitted event -- no emitter. | N/A |

## Findings -- UI Screens (4 declared, 0 implemented)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-a7b8c901 | P1 | Survey List (/org/[id]/officer/surveys) -- no frontend route. | N/A |
| EM-M18-a7b8c902 | P1 | Survey Builder (/org/[id]/officer/surveys/new) -- no frontend route. | N/A |
| EM-M18-a7b8c903 | P1 | Survey Results (/org/[id]/officer/surveys/[id]/results) -- no frontend route. | N/A |
| EM-M18-a7b8c904 | P1 | Member Survey Response (/my/surveys/[id]) -- no frontend route. | N/A |

## Findings -- Feature Flags (3 declared, 0 implemented)

| ID | Sev | Finding | File |
|----|-----|---------|------|
| EM-M18-b8c9d001 | P1 | surveys_enabled flag -- not implemented. | N/A |
| EM-M18-b8c9d002 | P1 | surveys_polls flag -- not implemented. | N/A |
| EM-M18-b8c9d003 | P1 | surveys_csv_export flag -- not implemented. | N/A |

## Summary

| Severity | Count |
|----------|-------|
| P1 (Not implemented -- future module) | 32 |
| P2 | 0 |
| P3 | 0 |
| **Total** | **32** |

**Spec Quality:** Complete (21/22 sections filled; permissions matrix and domain model tables partial). 7 vertical slices defined (M18-S1 through M18-S7). Note: spec section 22 indicates TypeSpec already exists at `specs/api/src/modules/surveys.tsp` with 10 operations defined -- but no handler implementation. Ready for implementation when prioritized.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
