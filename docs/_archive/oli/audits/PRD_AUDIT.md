# PRD Quality Audit

**Source:** docs/product/MASTER_PRD.md
**Date:** 2026-05-20
**Auditor:** Claude (gsd-code-reviewer)
**Score:** 6.5/10

## Summary

The MASTER_PRD is a well-structured compilation document that covers problem statement, personas, modules, business rules, rollout, and NFRs. It scores well on the categories it addresses. However, it has meaningful gaps: no monitoring/observability section, no migration plan, no glossary, no deprecation strategy, no testing strategy section, and a factual discrepancy with its own source documents (North Star metric contradiction). The handler directory listing is stale -- it omits 3 directories that exist in the codebase and lists 1 that does not exist. These gaps range from P1 (will cause rework) to P3 (polish).

## Category Scores

| # | Category | Score (0-10) | Findings |
|---|----------|:---:|----------|
| 1 | Problem statement | 8 | Clear, specific to PH dental/medical. "Spreadsheet-and-GC-based workflows" is evidence-backed. Could cite market sizing source. |
| 2 | Target users | 9 | 6 personas with flow counts, pain points, device preferences. Strong. |
| 3 | Success metrics | 7 | KPIs defined per phase. North Star contradicts source doc (P1). Failure criteria present -- good. |
| 4 | Scope boundaries | 8 | "What Memberry Is NOT For" section explicit. No EHR, no enterprise AMS. |
| 5 | Feature completeness | 7 | 19 modules across 3 phases. 3 handler directories in codebase not in PRD (P2). |
| 6 | Acceptance criteria | 4 | Pilot success criteria exist but per-feature ACs are absent from this document. Delegated to module docs. |
| 7 | Non-functional requirements | 8 | Performance targets, concurrency, localization, accessibility all covered with thresholds. |
| 8 | Data model alignment | 6 | Handler listing is stale -- `communications` dir doesn't exist, `advertising`/`jobs`/`marketplace` dirs omitted (P1). Consent field noted as missing. |
| 9 | API coverage | 6 | Handler counts listed but no endpoint-level mapping. TypeSpec coverage noted as ~60% but no list of gaps. |
| 10 | UX flows | 5 | Flow counts per persona referenced but actual flows not in this document. Delegated to personas doc. |
| 11 | Edge cases | 6 | Some edge cases in business rules summary (refund window, membership transitions). Most delegated to business-rules.md. |
| 12 | Integration points | 7 | Stripe, OneSignal, S3/MinIO, Better-Auth mentioned. No integration architecture diagram or failure mode docs. |
| 13 | Regulatory compliance | 7 | DPA 2012, BIR 7-year retention, soft delete, anonymization covered. GDPR deferred to Phase 2. No breach notification procedure. |
| 14 | Rollout plan | 8 | 3 waves defined with module groupings. Pilot success criteria with timeline. |
| 15 | Risk assessment | 3 | Failure/pivot criteria exist (good) but no risk register -- no technical risks, no adoption risks, no competitive risks. |
| 16 | Glossary completeness | 0 | No glossary section. Domain terms (MAM, DPA, BIR, CPD/CE, RBAC) used without definition. |
| 17 | Cross-references | 7 | Source documents table at bottom. Links to business-rules.md, module docs. Some paths not verified. |
| 18 | Versioning | 8 | Version 3.0, last updated date, status field present. No changelog. |
| 19 | Stakeholder sign-off | 0 | No approval process, no reviewers listed, no sign-off section. |
| 20 | Technical constraints | 8 | Stack documented. Three-app architecture clear. Bun, PG, Drizzle, Hono, TypeSpec all stated. |
| 21 | Migration plan | 0 | No mention of migrating from existing spreadsheet/GC workflows. No data import strategy beyond BR-22 member matching. |
| 22 | Testing strategy | 2 | No testing section in PRD. VERTICAL_TDD.md exists in repo but PRD doesn't reference QA approach. |
| 23 | Monitoring/Observability | 0 | Zero mentions of monitoring, alerting, logging dashboards, or observability. NFR says "99.5% uptime" but no plan to measure it. |
| 24 | Deprecation/Sunset | 0 | No deprecation strategy for old workflows or feature phase-out plan. |

## P0 Findings

None. No gaps that fully block development.

## P1 Findings

### P1-01: North Star Metric Contradicts Source Document

**Category:** Success metrics
**PRD says:** "Monthly Active Members (MAM)" is the North Star.
**Source says:** `docs/ver-3/business/metrics.md` line 10 defines "Number of dues payments processed per month" as the North Star, with explicit rationale that it is not a vanity metric and requires real operational adoption.
**Impact:** Teams optimizing for MAM (login + any action) vs. dues payments (financial activation) will make different product decisions. This is not a semantic difference -- it changes prioritization.
**Fix:** Align PRD North Star with metrics.md, or update metrics.md if MAM is the new decision. Document the change rationale.

### P1-02: Handler Directory Listing Is Stale

**Category:** Data model alignment
**PRD claims:** 22 handler directories (Section 4 table).
**Actual codebase:** 25 entries under `services/api-ts/src/handlers/`:
- `communications` listed in PRD but **does not exist** as a directory. Announcements live inside `communication/`.
- `advertising` exists in codebase but **not in PRD** (has tests: createAdvertiser, createCampaign, createCreative).
- `jobs` exists in codebase but **not in PRD** (has handlers: createJobPosting, createJobApplication).
- `marketplace` exists in codebase but **not in PRD** (has handlers: createListing, createVendor, createOrder).
- `__tests__` is a test directory (not a module) -- not in PRD, which is correct.
**Impact:** New developers will not know these modules exist. Module ownership, testing scope, and TypeSpec coverage tracking are all affected.
**Fix:** Update Section 4 table to reflect actual handler directories. Remove `communications` row, add `advertising`, `jobs`, `marketplace`. Note their TypeSpec status.

### P1-03: No Monitoring/Observability Section

**Category:** Monitoring/Observability
**Issue:** PRD specifies NFRs (99.5% uptime, <500ms p95, <3s page load) but provides zero guidance on how these will be measured, alerted on, or dashboarded. The word "monitoring" does not appear in the document.
**Impact:** NFR targets are aspirational without measurement infrastructure. Incident response cannot function without observability.
**Fix:** Add section covering: application logging (Pino config exists), metrics collection, uptime monitoring, alerting thresholds, and dashboard requirements.

### P1-04: No Migration Plan for Existing Workflows

**Category:** Migration plan
**Issue:** PRD acknowledges chapters currently use "spreadsheet-and-GC-based workflows" but provides no migration strategy. BR-22 mentions member matching on import (license number primary key, email fallback) but there is no import tool spec, no data mapping guide, no rollback plan for failed imports.
**Impact:** Pilot onboarding will stall without a defined migration path. This is the most likely pilot failure mode.
**Fix:** Add migration section covering: spreadsheet import format, validation rules, error handling, rollback capability, and onboarding checklist per association.

## P2 Findings

### P2-01: No Glossary

**Category:** Glossary completeness
**Issue:** Domain-specific terms used without definition: MAM, DPA 2012, BIR, CPD, CE, RBAC, PII, GC (group chat?), NPS, QR, SLA, WCAG. Healthcare association terminology (chapter vs. society vs. national) not formally defined.
**Impact:** Confusion for new team members and stakeholders outside the PH healthcare domain.
**Fix:** Add glossary section defining all acronyms and domain terms.

### P2-02: Per-Feature Acceptance Criteria Missing from PRD

**Category:** Acceptance criteria
**Issue:** PRD has pilot-level success criteria (Section 6) but no per-feature or per-module acceptance criteria. Module docs at `docs/product/modules/m01-m19` may contain these, but the PRD itself delegates without summarizing.
**Impact:** PRD cannot stand alone as a requirements document. Reviewers must chase 19 module docs to understand what "done" means for each feature.
**Fix:** Add summary AC per module in Section 4 table (1-2 lines each), or add an explicit "see module doc for AC" note with a completeness assertion.

### P2-03: No Risk Register

**Category:** Risk assessment
**Issue:** Failure/pivot criteria exist (good) but there is no structured risk register. Missing: technical risks (Bun ecosystem maturity, TypeSpec coverage gaps), adoption risks (volunteer officer churn, mobile connectivity), competitive risks (existing AMS vendors), regulatory risks (DPA enforcement changes).
**Impact:** Risk mitigation is reactive rather than planned.
**Fix:** Add risk register table with risk, likelihood, impact, mitigation strategy.

### P2-04: No Testing Strategy

**Category:** Testing strategy
**Issue:** PRD does not describe QA approach. The repo has VERTICAL_TDD.md, Hurl contract tests (27 scenarios), Playwright E2E tests, and Bun unit tests -- but none of this is referenced in the PRD. No test coverage targets stated.
**Impact:** QA expectations are implicit. New contributors won't know what testing is required.
**Fix:** Add testing strategy section referencing VERTICAL_TDD.md protocol and stating coverage targets per module.

### P2-05: UX Flows Referenced but Not Included

**Category:** UX flows
**Issue:** Flow counts per persona are listed (107 total) but the actual flow descriptions are entirely in `docs/ver-3/business/personas-and-roles.md`. The PRD provides no user journey maps, wireframe references, or flow diagrams.
**Impact:** PRD readers cannot evaluate UX completeness without reading a separate document.
**Fix:** Include at minimum the top 5 critical user journeys inline (member dues payment, officer onboarding, event check-in, training enrollment, credit tracking).

## P3 Findings

### P3-01: No Stakeholder Sign-off Section

**Category:** Stakeholder sign-off
**Issue:** No approval process, no reviewer list, no version approval history.
**Fix:** Add sign-off table with role, name, date, status.

### P3-02: No Deprecation/Sunset Strategy

**Category:** Deprecation/Sunset
**Issue:** No mention of phasing out old workflows (spreadsheets, GC groups) as associations onboard. No feature deprecation plan for internal platform changes.
**Fix:** Add sunset criteria: when old workflow is retired per association, and how deprecated features are communicated.

### P3-03: No Changelog in Document Versioning

**Category:** Versioning
**Issue:** Version 3.0 stated but no changelog showing what changed from v2 to v3.
**Fix:** Add brief changelog (e.g., "v3.0: Compiled from ver-3 source docs, added implementation status table").

### P3-04: Market Sizing Source Not Cited

**Category:** Problem statement
**Issue:** "2,800+ chapters, 250,000+ licensed professionals" stated without source attribution.
**Fix:** Cite source (PRC data, PDA directory, etc.).

### P3-05: Integration Failure Modes Not Documented

**Category:** Integration points
**Issue:** External services listed (Stripe, OneSignal, S3/MinIO) but no failure mode documentation. What happens when OneSignal is down? When Stripe webhook delivery fails?
**Fix:** Add integration dependency table with graceful degradation behavior.

## Recommendations

1. **Immediate (before v1.2.0 planning):** Fix P1-01 (North Star contradiction) and P1-02 (stale handler listing). These are factual errors that mislead planning.

2. **Before pilot launch:** Add migration plan (P1-04) and monitoring section (P1-03). These are the highest-risk gaps for real-world deployment.

3. **Next PRD revision:** Add glossary (P2-01), risk register (P2-03), testing strategy (P2-04), and inline UX flows (P2-05). Convert PRD from a compilation reference into a self-contained requirements document.

4. **Ongoing:** Establish a PRD update cadence. The handler listing was already stale, suggesting the PRD is not being maintained as code changes land.

---

_Audited: 2026-05-20_
_Auditor: Claude (gsd-code-reviewer)_
