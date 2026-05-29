<!-- oli:compliance-report v2.1 | generated: 2026-05-30 | dimension: compliance | method: codebase-map + enforcement-baseline trace -->

# Compliance Report

---
Audit Date: 2026-05-30
Modules Audited: m01-m22 (22 module specs); backend handler dirs mapped by domain
Spec Version: MASTER_PRD v3.0, DOMAIN_MODEL v1.0, WORKFLOW_MAP v1.0 (module specs "Phase B")
Dimension: Compliance (read-only audit, no `--fix`)
Method: Fresh codebase-map JSON (`docs/audits/codebase-map/`) + enforcement baseline v49 (2026-05-29) + targeted handler/seed verification
---

## Generated Code Exclusion

Auto-generated files are excluded from compliance checks:
- `services/api-ts/src/generated/` (OpenAPI routes/validators/registry, Better-Auth schema, migrations)
- `dist/`, `build/`, `*.generated.ts`

Hand-written files that consume generated types ARE in scope: handlers, repos, `*.schema.ts`, middleware, frontend.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|---------------|
| MODULE_SPEC.md | ✓ (22 modules m01-m22) | Steps 3-10 |
| DOMAIN_GLOSSARY.md | ✓ | Step 6 (terminology) |
| DOMAIN_MODEL.md | ✓ | Steps 6.1, 6.2, 6b |
| API_CONTRACTS.md | ✓ (m01-m19; absent m20-m22) | Step 8b |
| API_CONVENTIONS.md | ✓ | Step 7 / 8b envelope |
| EVENT_CONTRACTS.md | ✓ | Steps 6.3, 9c |
| ERROR_TAXONOMY.md | ✓ | Steps 6.4, 8b |
| AUDIT_CONTRACTS.md | ✓ | Step 9d |
| DATA_GOVERNANCE.md | ✗ (only DATA_GOVERNANCE_DRAFT.md) | Step 9e SKIPPED (not `--regulated`) |
| WORKFLOW_MAP.md | ✓ | Step 11 (workflow trace) |
| STATE_MACHINES.md | ✓ | Step 9 (state transitions) |
| SEED_MANIFEST.md | ✓ | Step 11b (data path) |

### Method note (context-managed audit)

This audit leans on the **fresh codebase-map** (`CODE_API_SURFACE.json` 428 endpoints w/ auth, `CODE_TERMINOLOGY_MAP.json`, `CODE_STATE_MACHINES.json`) and the **per-module enforcement baseline** (`docs/audits/enforce/.baseline.json` v49, 2026-05-29 — the freshest authoritative per-module compliance state, 19 modules with ratchet tracking) as source-of-truth for mechanical facts, with targeted handler/seed/schema verification for high-value checks. The prior `COMPLIANCE_REPORT.md` (Cycle 7, 2026-05-28, 5.5/10) is **superseded** — its 7 P0 / 85 P1 were resolved by enforcement Waves 11-56 (now reflected in baseline v49: 0 P0, 6 P1).

> Spec paradox disclaimer: This audit validates code against specs. If specs are wrong, compliant code may still be incorrect. Last spec-gate run: per `SPEC_REVIEW.md` / `SPEC_CONSISTENCY_REPORT.md` (present).

## Executive Summary

- **Overall compliance rate:** ~96% (per-module enforcement baseline v49: 0 P0, 6 P1, 50 P2, 20 P3 across 19 scored modules; the 6 P1s are unimplemented roadmap modules, not bugs in shipped code)
- **Verdict roll-up:** **PASS** (no P0 — not BLOCK)
- **P0 violations (fix now):** 0
- **P1 violations (fix before new work):** 6 (all unbuilt/partial roadmap modules m13/m15/m16/m17/m18/m19)
- **P2 violations (fix when touching):** ~50 (consistency/internal-data; carried from enforcement baseline) + 4 data-path (unseeded internal tables)
- **P3 observations:** ~20
- **Spec gaps found:** 5 (m13, m15 specs with no backend code; m20-m22 missing API_CONTRACTS.md)

### Top Risks

1. **6 spec'd-but-unbuilt modules** — m13 professional-feed & m15 job-board have NO backend handler AND no frontend route; m16 advertising & m17 marketplace have backend handlers but no frontend; m19 committee-management has admin frontend but no backend handler; m18 surveys-polls "polls" sub-feature gap. These are roadmap features, scored P1 each (functional gap vs spec).
2. **Financial↔Membership circular dependency** — `handlers/dues/` ↔ `handlers/association:member/` mutual imports (P2, deferred to mega-module split P1-11 per CLAUDE.md).
3. **4 unseeded internal tables** — `billingConfigs`, `documentVersions`, `dunningTemplates`, `emailSuppressions` have repo consumers but no seed rows (P2/P3; write-on-demand or config tables, not user-facing empty states).
4. **Residual non-fatal seed errors** — payment→invoice linking, chat room members, credit/certificate backfill, election-state coverage are try/catch-isolated (per SEED_MANIFEST §5) — P2 internal-data integrity, non-blocking.

## Category Summary

| Category | Items | Compliant | P0 | P1 | P2 | P3 | Spec Gaps |
|----------|-------|-----------|----|----|----|----|-----------|
| Business Rules | ~40 BRs | ~38 | 0 | 0 | 1 | 1 | — |
| Acceptance Criteria | per module | most | 0 | 0 | — | — | — |
| Permissions | 419 backend eps | 419 | 0 | 0 | 0 | 0 | — |
| Domain Terminology | 1500 strings / 10 clusters | 1500 | 0 | 0 | 0 | 0 | — |
| Bounded Context Integrity | cross-module deps | most | 0 | 0 | 1 (dues↔member) | 0 | — |
| Error Contracts | global envelope | ✓ | 0 | 0 | — | — | — |
| API Contracts (Module Spec) | m01-m22 | most | 0 | 6 (unbuilt) | — | — | 5 |
| API Contracts (Full Schema) | m01-m19 | most | 0 | 0 | ~10 | — | m20-m22 no contract |
| State Transitions | 10 machines | 10 | 0 | 0 | 0 | 0 | — |
| Event Contracts | EVENT_CONTRACTS | ✓ (21 consumers) | 0 | 0 | ~5 | — | — |
| Audit Logging | 114 auditable | most | 0 | 0 | ~3 | — | — |
| Data Governance | — | — | — | — | — | — | SKIPPED (no DATA_GOVERNANCE.md) |
| Data Validation | per entity | most | 0 | 0 | ~8 | — | — |
| Data Path Connectivity | 110-118 tables | ~114 | 0 | 0 | 2 | 2 | — |
| Error Boundary Coverage | frontend hooks | most | 0 | 0 | (carried) | — | — |
| Contract Consistency | FE/BE | most | 0 | 0 | (carried) | — | — |

## Auth / Permission Coverage (Step 5)

Computed from `CODE_API_SURFACE.json` (428 endpoints; 419 backend, 9 phantom frontend artifacts):

- **0 endpoints** with `auth_required:false`. No silent auth bypass.
- **12 by-design public** (`auth_required:null`, intentional): `POST /billing/webhooks/stripe`, `GET /certificates/verify/{n}`, `GET|POST /email/unsubscribe`, `GET /invite/validate/{token}`, `GET /pay/{token}/validate` + `POST /pay/{token}/checkout`, `GET /public/events`, `GET /public/events/{slug}`, `GET /public/org/{slug}`, `GET /public/orgs`, `GET /association/member/credentials/lookup/{credentialNumber}` (public credential verify — confirmed by `lookupCredentialPublic.test.ts`).
- **9 phantom endpoints** — all in `app-admin`/`app-memberry` modules, template-literal regex artifacts (e.g. `GET /api/admin/surveys?${params}`, `GET /api/persons/me`). Not real routes. P3 (map noise, no runtime impact).
- Session-auth endpoints without role-middleware (e.g. billing, platformadmin) rely on handler-level session + org-scoping ("guaranteed by middleware" pattern) — verified compliant, not violations.

**Result: 0 P0/P1 permission violations.**

## Domain Terminology (Step 6)

`CODE_TERMINOLOGY_MAP.json` (built against DOMAIN_GLOSSARY): `glossary_mismatches: 0`, `uncovered_strings: 0`. The 10 synonym clusters are UI-label variants (e.g. "member"/"members"/"active members"), not entity-name contradictions. **0 terminology violations.**

## State Transitions (Step 9)

STATE_MACHINES.md defines 10 backend machines (membership BR-03, dues-payment, invoice, booking-event, training-enrollment, message, announcement, email-queue, template, webhook-retry) all sourced from schema enums. Enforcement baseline records all state-machine P1s resolved (Waves 12, 18, 20-22). `CODE_STATE_MACHINES.json` only auto-detected 3 frontend `useState` tab-toggles (not domain FSMs) — no spec contradiction. **0 state-transition violations.**

## Violations by Module

### m13 professional-feed — score 0/10
#### P1 — Fix Before New Work
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M13-001 | API Contracts | Spec defines feed module; NO backend handler dir, NO frontend route. `feed_post`/`feed_post_reaction`/`feed_post_report`/`feed_muted_author` tables exist + seeded but no API/UI. | handlers/(none); apps/(none) | Implement module or mark spec deferred in ROADMAP |
#### P3 — Track
| ID | Category | Description | File:Line | Notes |
|----|----------|-------------|-----------|-------|
| V-M13-002 | Observation | Tables seeded ahead of feature build | seed/layer-7-* | Dormant until module built |

### m15 job-board — score 2/10
#### P1
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M15-001 | API Contracts | Spec defines job board; NO backend handler (`jobs/` dir is background-jobs infra, not job-board), NO frontend route. `job_posting`/`job_application` tables seeded only. | handlers/(none) | Implement or defer |
#### P2
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M15-002 | Data Path | job_posting/job_application seeded but no serving endpoint | seed/layer-7-misc.ts | Wire endpoints when module built |

### m16 advertising — score 2/10
#### P1
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M16-001 | API Contracts | Backend handler `advertising/` exists; NO frontend route. Spec'd advertiser/creative/campaign flows API-only. | apps/(none) | Build frontend or defer |
#### P2
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M16-002 | Contract Consistency | API present without consumer | handlers/advertising/ | Verify on frontend build |

### m17 marketplace — score 2/10
#### P1
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M17-001 | API Contracts | Backend handler `marketplace/` exists; NO frontend route. Listing/order flows API-only. | apps/(none) | Build frontend or defer |
#### P2
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M17-002 | Contract Consistency | API present without consumer | handlers/marketplace/ | Verify on frontend build |

### m18 surveys-polls — score 2/10
#### P1
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M18-001 | API Contracts | Surveys BUILT (13 endpoints `handlers/surveys/`, frontend `org/.../officer/surveys` + `my/surveys`). P1 = "polls" sub-feature of spec not implemented separately. | handlers/surveys/ | Confirm polls covered by survey type or defer |
#### P2
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M18-002 | API Contracts | Poll-specific spec endpoints not distinct from survey | handlers/surveys/ | Reconcile spec vs survey-as-poll |

### m19 committee-management — score 0/10
#### P1
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-M19-001 | API Contracts | Admin frontend `apps/admin/src/routes/committees` exists; NO backend handler dir. `committee`/`committee_member`/`committee_task` tables seeded only. Frontend likely calls association:member endpoints or is stub. | handlers/(none) | Implement backend or defer |
#### P3
| ID | Category | Description | File:Line | Notes |
|----|----------|-------------|-----------|-------|
| V-M19-002 | Observation | Frontend-ahead-of-backend | apps/admin/.../committees | Verify route is not dead-end |

### m01-m12, m14 — built & compliant
Enforcement baseline v49: 0 P0, 0 P1 each. Residual P2/P3 are consistency/doc-reconciliation items already triaged across Waves 13-56 (terminology, minor field naming, status-history logging nuances). Scores 7.5-9/10. No new violations found in this sweep.

### m20 booking / m21 billing / m22 email — built, not in enforcement baseline
18/16/12 endpoints respectively. Auth clean (only stripe-webhook + email-unsubscribe public, by design). No per-module API_CONTRACTS.md (spec gap, not code violation). No P0/P1 found.

## Data Path Connectivity Report (Step 11b)

### Coverage Summary
| Metric | Count |
|--------|-------|
| Total tables (pgTable defs) | ~118 (110 per SEED_MANIFEST canonical count) |
| Seeded tables | ~114 (SEED_MANIFEST claims 110/110 = 100%) |
| Unseeded tables | 4 (after name normalization) |
| Unseeded + user-visible (P0) | 0 |
| Unseeded + API-only (P1) | 0 |
| Unseeded + internal (P2) | 2 |
| Unseeded + dormant/write-on-demand (P3) | 2 |

### P2 — Unseeded Tables with Internal Consumers
| Table | Module | Query Function | File:Line | Impact |
|-------|--------|---------------|-----------|--------|
| billing_config | billing | billing.repo.ts | services/api-ts/src/handlers/billing/repos/billing.repo.ts | Config read; empty → default fallback path |
| dunning_template | dues/member | dunning.repo.ts | services/api-ts/src/handlers/association:member/repos/dunning.repo.ts | Dunning email template lookup; empty → no templated dunning |

### P3 — Write-on-Demand (dormant, expected empty)
| Table | Module | File:Line | Reason |
|-------|--------|-----------|--------|
| document_version | documents | services/api-ts/src/handlers/documents/repos/documents.repo.ts | Populated on document re-upload (runtime) |
| email_suppression | email | services/api-ts/src/handlers/email/repos/suppression.repo.ts | Populated on bounce/unsubscribe (runtime) |

### Residual seed errors (SEED_MANIFEST §5) — P2 internal
payment→invoice linking, chat_room_members / room-type update (chat_room_id col gap), credit backfill, certificate backfill, election-state coverage. All try/catch-isolated; tables themselves seeded. Non-blocking.

### Full Data Path Trace (summary)
| Table | Seeded? | Queried By | Endpoint | Frontend | Severity |
|-------|---------|-----------|----------|----------|----------|
| billing_config | NO | billing.repo | billing config read | indirect | P2 |
| dunning_template | NO | dunning.repo | dunning job | n/a (job) | P2 |
| document_version | NO (runtime) | documents.repo | document detail | doc view | P3 |
| email_suppression | NO (runtime) | suppression.repo | email send guard | n/a | P3 |
| (110 others) | YES | various | various | various | — |

## Spec Gaps

NOT code violations — specs incomplete or ahead of build:

| Module | Section | Gap | Impact | Recommendation |
|--------|---------|-----|--------|---------------|
| m13 | API/impl | Spec exists, zero code | Roadmap feature unbuilt | Track in ROADMAP or `/oli-spec-modules --defer` |
| m15 | API/impl | Spec exists, zero code | Roadmap feature unbuilt | Track in ROADMAP |
| m20 booking | API_CONTRACTS.md | Missing per-module contract | Step 8b not auditable | Generate via `/oli-spec-api` |
| m21 billing | API_CONTRACTS.md | Missing per-module contract | Step 8b not auditable | Generate via `/oli-spec-api` |
| m22 email | API_CONTRACTS.md | Missing per-module contract | Step 8b not auditable | Generate via `/oli-spec-api` |

## Unauditable Items

| Item | Reason | Manual Check Needed |
|------|--------|-------------------|
| Test EXECUTION results | Static audit checks existence only | Run `bun test` (Step 4 note) |
| m19 committee frontend data path | Backend handler absent; frontend may call other module | Click-through verify route not dead-end |
| Runtime seed completeness | Manifest claims 100% but 4 tables show no seed-var | Run `bun run db:seed` + row-count spot check |

## Test Traceability Summary

| Type | Total | Strong Test | Weak Test | No Test | Traceability % |
|------|-------|-------------|-----------|---------|----------------|
| Business Rules | ~40 | ~35 | ~3 | ~2 | ~88% |
| Acceptance Criteria | per module | majority | some | unbuilt-module ACs | n/a |

Auth-gate BRs (BR-02/04/11/14/33/34) have dedicated pure-function tests (`auth-gate-coverage.test.ts`). Storage has `auth-enforcement.test.ts`. Test traceability is supplementary — severity driven by code enforcement. For full scoring run `/oli-check --confidence`.

## Stabilization Plan

### Fix Now (P0)
- None. No security/data-integrity P0 found.

### Fix Before New Work (P1)
- V-M13-001 / V-M15-001 / V-M19-001: decide build-vs-defer for unimplemented modules (feed, job-board, committee-management). If deferred, annotate specs/ROADMAP so they stop scoring as gaps.
- V-M16-001 / V-M17-001: advertising & marketplace backends exist — build frontends or mark API-only/deferred.
- V-M18-001: reconcile "polls" spec against survey-as-poll implementation.

### Fix When Touching Module (P2)
- billing_config / dunning_template seed rows (data path).
- Resolve residual non-fatal seed errors (SEED_MANIFEST §5 cleanup pass).
- dues↔association:member circular dependency (mega-module split P1-11).
- ~50 carried per-module P2 consistency items (terminology/field-naming/doc reconciliation) — address opportunistically.

### Track (P3)
- 9 phantom endpoint artifacts (codebase-map noise).
- document_version / email_suppression write-on-demand tables (expected empty).
- ~20 carried per-module P3 observations.

## Health Score

| Dimension | Score (0-10) | Notes |
|-----------|-------------|-------|
| Business rule enforcement | 9 | Auth-gate + state BRs tested; baseline shows all P1s resolved |
| Acceptance criteria coverage | 8 | Built modules well-covered; unbuilt modules' ACs untestable |
| Permission coverage | 10 | 0 auth gaps; 12 by-design public, 9 phantom artifacts |
| Terminology consistency | 10 | glossary_mismatches=0, uncovered=0 |
| Bounded context integrity | 7 | dues↔member circular dep (P2, deferred) |
| Error contract compliance | 9 | API_CONVENTIONS envelope honored |
| API contract compliance | 6 | Capped by 6 P1 (unbuilt modules); m20-m22 lack contracts |
| State transition safety | 10 | 10 machines schema-sourced, all enforced |
| Data validation coverage | 8 | Zod validators generated + handler checks |
| Event contract compliance | 8 | 21 consumers wired (was 1); minor P2s |
| Audit logging compliance | 8 | 114 auditable events; audit handler + retention test present |
| Data governance compliance | n/a | SKIPPED — no DATA_GOVERNANCE.md, not --regulated |
| Workflow coverage | 8 | WORKFLOW_MAP present; BR enforcement traced via baseline waves |
| Data path connectivity | 8 | ~114/118 seeded; 4 internal/dormant unseeded |
| Error boundary coverage | 7 | Carried from prior waves; not re-swept this run |
| Contract consistency | 7 | Carried; advertising/marketplace API-only gaps |

**Overall health:** 8.1/10 (average of 15 applicable dimensions)

## What's Next

- **No P0** — verdict PASS. Proceed with development.
- **6 P1s** are all unimplemented/partial roadmap modules (feed, job-board, advertising, marketplace, polls-subfeature, committee-mgmt). Decide build-vs-defer; if deferred, annotate specs so they stop scoring as functional gaps.
- Generate API_CONTRACTS.md for m20 booking / m21 billing / m22 email to enable Step 8b on those.
- For per-module ratchet detail see `docs/audits/enforce/.baseline.json` (v49) and `/oli-check --enforcement`.
- For test-execution confidence: `bun test` + `/oli-check --confidence`.
