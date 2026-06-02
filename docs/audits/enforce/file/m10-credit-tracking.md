# File Enforcement: m10-credit-tracking

> **Audit date:** 2026-05-28
> **Spec sources:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, ERROR_TAXONOMY.md, ROLE_PERMISSION_MATRIX.md
> **Scope:** All credit-related files across `training/`, `association:member/`, `person/`, `association:operations/` handler directories + frontend credit routes

---

## File Inventory

M10 credit tracking code is **distributed across 4 handler directories** (shared with M04, M05, M09) + **8 frontend files**.

### `training/` — Credit-bearing training flow (shared with M09)
| File | Role | M10 Relevance |
|------|------|---------------|
| `markComplete.ts` | Handler | AUTO credit creation on training completion (BR-13); emits `credit.awarded` + `training.completed` domain events |
| `markComplete.test.ts` | Test | 7 sections, covers credit flow + auth |
| `flow-02.training-credit-award.test.ts` | Test | FLOW-02 cross-module test |
| `flow-020.attendance-credit.test.ts` | Test | Attendance-to-credit flow + AC-M10-002 |
| `ac-m10.credit-tracking.test.ts` | Test | M10 acceptance criteria tests (AC-M10-003/004/005) |
| `br-14.cross-org-credits.test.ts` | Test | BR-14 cross-org aggregation |
| `br-15.training-event-distinction.test.ts` | Test | BR-15 training vs event credit distinction |
| `repos/training.repo.ts` | Repo | Training CRUD, enrollment management |

### `association:member/` — Credit entry CRUD, compliance, transcripts
| File | Role | M10 Relevance |
|------|------|---------------|
| `repos/credits.schema.ts` | Schema | `credit_entry` (18 columns) + `org_cpd_config` tables |
| `repos/credits.repo.ts` | Repo | CreditEntryRepository — all credit data access |
| `utils/credit-cycle.ts` | Util | Cycle computation (BR-11), carryover (BR-12) |
| `utils/credit-cycle.test.ts` | Test | Cycle calculation tests |
| `utils/transcript-template.ts` | Util | HTML transcript rendering (WF-070) |
| `utils/trust-signals.ts` | Util | Trust signal computation for credits |
| `awardManualCredit.ts` | Handler | Officer manual credit award (WF-067 partial); emits `credit.adjusted` domain event |
| `awardManualCredit.test.ts` | Test | Award manual credit tests |
| `createCreditEntry.ts` | Handler | Member manual credit entry (WF-066) |
| `listCreditEntries.ts` | Handler | List credit entries for person |
| `getCreditCompliance.ts` | Handler | Org compliance report (WF-068) |
| `getCreditTranscript.ts` | Handler | Cross-org transcript JSON (WF-070 partial) |
| `getCreditTranscriptPdf.ts` | Handler | Transcript PDF generation (WF-070) |
| `getCreditTranscriptPdf.test.ts` | Test | PDF transcript tests |
| `voidCreditEntry.ts` | Handler | Void/revoke credits (officer action) |
| `voidCreditEntry.test.ts` | Test | Void credit tests |
| `credits.test.ts` | Test | General credit tests |
| `jobs/creditIssue.ts` | Job | Background credit issuance pipeline |
| `jobs/creditIssue.test.ts` | Test | Credit issue job tests |

### `person/` — Self-service credit views
| File | Role | M10 Relevance |
|------|------|---------------|
| `getMyCredits.ts` | Handler | GET /persons/me/credits (WF-065) — 22 lines, raw schema queries |
| `getMyCredits.test.ts` | Test | My credits tests |
| `getMyCreditSummary.ts` | Handler | GET /credit-summary (cross-org aggregation) — 69 lines |
| `getMyCreditSummary.test.ts` | Test | Credit summary tests |
| `createMyCreditEntry.ts` | Handler | POST /credit-entries (self-service, WF-066) — 61 lines |
| `createMyCreditEntry.test.ts` | Test | Self-service credit entry tests |
| `listMyCreditEntries.ts` | Handler | GET /credit-entries (own entries) — 27 lines |
| `listMyCreditEntries.test.ts` | Test | List my credit entries tests |

### `association:operations/` — Training + accredited provider schemas (shared with M09)
| File | Role | M10 Relevance |
|------|------|---------------|
| `repos/training.schema.ts` | Schema | `training` table with `creditBearing`, `creditAmount` |
| `createOrgAccreditedProvider.ts` | Handler | POST org accredited provider (OpenAPI generated) |
| `listOrgAccreditedProviders.ts` | Handler | GET org accredited providers (OpenAPI generated) |
| `updateOrgAccreditedProvider.ts` | Handler | PUT org accredited provider (OpenAPI generated) |
| `deleteOrgAccreditedProvider.ts` | Handler | DELETE org accredited provider (OpenAPI generated) |
| `org-accredited-providers.test.ts` | Test | Accredited provider CRUD tests |

### Frontend — Credit tracking UI
| File | Role | M10 Relevance |
|------|------|---------------|
| `routes/_authenticated/my/credits/index.tsx` | Route | My Credits page (WF-065): summary cards + credit log table |
| `routes/_authenticated/my/credits/log.tsx` | Route | Manual credit entry form (WF-066) |
| `routes/_authenticated/org/$orgSlug/my-cpd.tsx` | Route | Org-scoped CPD dashboard with category breakdown |
| `routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` | Route | Officer compliance report (WF-068): summary cards + member table |
| `routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx` | Route | CPD config settings (required credits, cycle length, SDL cap) |
| `features/dashboard/components/credit-breakdown.tsx` | Component | Dashboard credit progress ring widget |
| `features/dashboard/components/credit-breakdown.test.tsx` | Test | Credit breakdown component tests |
| `features/training/components/completion-table.tsx` | Component | Training completion table (shared with M09) |

---

## Findings

### Legend

| Severity | Meaning |
|----------|---------|
| P1 | Blocker — functional incorrectness, data loss risk, security gap |
| P2 | Warning — spec divergence, maintainability risk, SDK incompatibility |
| P3 | Note — minor naming/style mismatch, acceptable trade-off |

| ID | Sev | Check | Finding | File | Spec Source | Confidence |
|----|-----|-------|---------|------|-------------|------------|
| EF-M10-a1b2c3d4 | P1 | Error taxonomy | `awardManualCredit.ts` throws generic `ValidationError` and `ConflictError` — does not use `M10-001` for negative deductions or `M10-004` for closed-cycle checks. No closed-cycle validation exists at all. | `association:member/awardManualCredit.ts` | ERROR_TAXONOMY M10-001, M10-004 | HIGH |
| EF-M10-b2c3d4e5 | P1 | Error taxonomy | `createCreditEntry.ts` and `createMyCreditEntry.ts` do not validate against closed compliance cycles (M10-004), do not enforce supporting document requirements (M10-006), and do not check for negative credit values (M10-001). `createCreditEntry.ts` checks `creditAmount <= 0` but not M10 structured code. | `association:member/createCreditEntry.ts`, `person/createMyCreditEntry.ts` | ERROR_TAXONOMY M10-001, M10-004, M10-006 | HIGH |
| EF-M10-c3d4e5f6 | P1 | Data shape | `getMyCredits.ts` returns `{ data: { totalCredits, requiredCredits, compliancePercent, categoryBreakdown, sdlCap, history } }` — does not match API_CONTRACTS 2.1 shape which expects `{ data: { currentCycle, entries, totalCredits, remainingCredits, compliancePercentage, carryoverCredits } }`. Missing: `currentCycle`, `remainingCredits`, `carryoverCredits`. Extra: `categoryBreakdown`, `sdlCap`, `history`. | `person/getMyCredits.ts` | API_CONTRACTS 2.1 GET /credits/my | HIGH |
| EF-M10-d4e5f6a7 | P1 | Import boundaries | `training/markComplete.ts` imports from 4 foreign handler directories: `association:member/repos/credits.repo`, `association:member/repos/membership.repo`, `association:member/utils/credit-cycle`, `platformadmin/repos/platform-admin.repo`, `association:member/repos/governance.repo`. Violates handler isolation — should use a cross-module service or domain event. | `training/markComplete.ts` | Architecture: handler isolation | HIGH |
| EF-M10-e5f6a7b8 | P2 | Error taxonomy | `markComplete.ts` throws generic `ForbiddenError`, `NotFoundError`, `ConflictError` — does not use M10 error codes from ERROR_TAXONOMY (M10-001 through M10-007). Silently swallows credit creation failures in catch block without logging. | `training/markComplete.ts` | ERROR_TAXONOMY 5.10 | HIGH |
| EF-M10-f6a7b8c9 | P2 | Error taxonomy | `voidCreditEntry.ts` validates reason (min 10 chars) but throws generic `ValidationError` instead of structured M10 error code. Uses `NotFoundError` correctly. | `association:member/voidCreditEntry.ts` | ERROR_TAXONOMY M10 codes | MEDIUM |
| EF-M10-a7b8c9d0 | P2 | Domain terms | Schema uses `creditAmount` (column name) consistently, but MODULE_SPEC and API_CONTRACTS use `creditValue` as the field name. All code uses `creditAmount` — internally consistent but spec-divergent. | `association:member/repos/credits.schema.ts` | MODULE_SPEC 7, API_CONTRACTS 2.2 | HIGH |
| EF-M10-b8c9d0e1 | P2 | Domain terms | `creditEntryTypeEnum` has `['auto', 'manual']`. Spec workflow WF-067 and API_CONTRACTS 2.3 require an `adjusted` type for officer credit adjustments. `voidCreditEntry.ts` works around this by setting `status: 'voided'` instead of creating a new adjustment entry. | `association:member/repos/credits.schema.ts` | API_CONTRACTS 2.3, WF-067 | HIGH |
| EF-M10-c9d0e1f2 | P2 | Data shape | `getCreditCompliance.ts` returns `{ summary, data: memberResults }` with `compliance_status` (snake_case). API_CONTRACTS 2.4 expects `complianceStatus` (camelCase) and `{ data: { summary, members } }` structure. | `association:member/getCreditCompliance.ts` | API_CONTRACTS 2.4 | HIGH |
| EF-M10-d0e1f2a3 | P2 | Data shape | `getCreditTranscript.ts` returns JSON with `{ personId, cycle, organizations, earned, ... }`. Spec endpoint `GET /credits/transcript` should return binary PDF/CSV, not JSON. This handler serves the JSON data view; `getCreditTranscriptPdf.ts` renders HTML. Neither produces actual PDF binary or CSV download. | `association:member/getCreditTranscript.ts`, `getCreditTranscriptPdf.ts` | API_CONTRACTS 2.5 | HIGH |
| EF-M10-e1f2a3b4 | P2 | Naming | Route path mismatch: `app.ts` registers `POST /association/member/credits/manual` but API_CONTRACTS defines `POST /credits/manual`. Route registers `GET /persons/me/credits` but spec defines `GET /credits/my`. SDK/frontend will not find endpoints at spec-defined paths. | `services/api-ts/src/app.ts` | API_CONTRACTS 2.1, 2.2 | HIGH |
| EF-M10-f2a3b4c5 | P2 | Naming | Three separate handlers create manual credit entries: `awardManualCredit.ts` (officer), `createCreditEntry.ts` (member via association:member), `createMyCreditEntry.ts` (member via person). Spec defines exactly one endpoint: `POST /credits/manual`. Unclear which handler is canonical. | `association:member/awardManualCredit.ts`, `createCreditEntry.ts`, `person/createMyCreditEntry.ts` | API_CONTRACTS 2.2 | HIGH |
| EF-M10-a3b4c5d6 | P2 | Import boundaries | `person/getMyCredits.ts` imports schema directly (`creditEntries`, `orgCpdConfig`) from `association:member/repos/credits.schema.ts`, then writes raw Drizzle queries with inline SQL. Should use `CreditEntryRepository` for data access abstraction. | `person/getMyCredits.ts` | Architecture: repo pattern | HIGH |
| EF-M10-b4c5d6e7 | P2 | Import boundaries | `person/getMyCreditSummary.ts` imports raw schema tables (`memberships`, `associations`, `organizations`) from multiple handler directories and writes join queries. Should use respective repositories. | `person/getMyCreditSummary.ts` | Architecture: repo pattern | HIGH |
| EF-M10-c5d6e7f8 | P2 | Feature flags | None of the 3 spec-defined feature flags (`credit_tracking_enabled`, `credit_transcript_export`, `credit_cpd_categories`) are checked anywhere in backend or frontend code. All features are unconditionally active. | All credit handlers + frontend routes | MODULE_SPEC 18 | HIGH |
| EF-M10-d6e7f8a9 | P2 | Observability | Only 2 of 5 spec-defined log events implemented: `credit.awarded` (in `markComplete.ts:127`) and `credit.adjusted` (in `awardManualCredit.ts:37`). Missing: `credit.manual.created`, `credit.duplicate.skipped`, `credit.cycle.computed`. No metrics counters (`credits_created_total`, `credit_compliance_rate`, `credit_summary_latency_ms`) implemented. | Multiple handlers | MODULE_SPEC 17 | MEDIUM |
| EF-M10-e7f8a9b0 | P2 | Domain events | `CreditAwarded` event emitted from `markComplete.ts` but NOT from `createCreditEntry.ts`, `createMyCreditEntry.ts`, or `creditIssue.ts` job. Spec says CreditAwarded fires on "AUTO or MANUAL credit created". `CreditAdjusted` emitted only from `awardManualCredit.ts`. | `association:member/createCreditEntry.ts`, `person/createMyCreditEntry.ts`, `jobs/creditIssue.ts` | MODULE_SPEC 10b | HIGH |
| EF-M10-f8a9b0c1 | P2 | Consumed events | No handlers consume `MembershipStatusChanged` or `AccountDeletionProcessed` events as spec requires. Credit tracking does not respond to membership status changes or account deletions. | Missing handlers | MODULE_SPEC 10b Consumed Events | HIGH |
| EF-M10-a9b0c1d2 | P3 | Domain terms | `cpdCategoryEnum` uses `'Self-Directed'` (hyphenated). Spec uses `SelfDirected` (no hyphen). Minor but could cause API response/request mismatch if SDK enforces spec enum values. | `association:member/repos/credits.schema.ts` | API_CONTRACTS 2.2 cpdCategory | MEDIUM |
| EF-M10-b0c1d2e3 | P3 | Naming | `getCreditCompliance.ts` registered at an unspecified route. API_CONTRACTS defines `GET /orgs/:organizationId/credits/compliance`. Handler uses `ctx.req.valid('param')` suggesting generated-route registration but route path not verified in app.ts hand-wired section. | `association:member/getCreditCompliance.ts` | API_CONTRACTS 2.4 | MEDIUM |
| EF-M10-c1d2e3f4 | P3 | Import boundaries | `getCreditCompliance.ts` imports `MembershipRepository` from `../membership/repos/membership.repo` — cross-handler import but through the repo abstraction layer, which is the expected pattern. Acceptable. | `association:member/getCreditCompliance.ts` | Architecture: repo pattern | LOW (acceptable) |
| EF-M10-d2e3f4a5 | P3 | Frontend spec | `/my/credits/index.tsx` hardcodes `requiredCredits` fallback to 60, `carryover` to 0. Does not display `currentCycle` object or `carryoverCredits` as spec requires. Internally calls `/api/persons/me/credit-summary` and `/api/persons/me/credit-entries` — different from spec path `GET /credits/my`. | `routes/_authenticated/my/credits/index.tsx` | MODULE_SPEC 9 Screen: My Credits | MEDIUM |
| EF-M10-e3f4a5b6 | P3 | Frontend spec | `/org/$orgSlug/officer/reports/credits.tsx` hardcodes `requiredCredits=45&cyclePeriodYears=3` as query params. Should read from org CPD config, not hardcode PRC defaults. | `routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` | MODULE_SPEC 9 Screen: Org Credit Compliance | MEDIUM |

---

## Positive Findings

| ID | Finding | File | Spec Source |
|----|---------|------|-------------|
| EF-M10-POS-01 | AC-M10-002 duplicate guard correctly implemented via `findByTrainingAndPerson()` check before insert in `markComplete.ts`. Unique constraint `uq_credit_source_person` provides DB-level safety net. | `training/markComplete.ts`, `credits.schema.ts` | AC-M10-002, M10-R2 |
| EF-M10-POS-02 | BR-11 credit cycle config read from association settings with sane fallback defaults (2-year, 40 credits). `getCycleForDateWithConfig()` supports both fixed-anchor and registration-based modes. | `association:member/utils/credit-cycle.ts` | BR-11 |
| EF-M10-POS-03 | BR-12 carryover capped at 50% implemented in `calculateCarryover()` pure function. | `association:member/utils/credit-cycle.ts` | BR-12 |
| EF-M10-POS-04 | BR-14 cross-org aggregation implemented in `CreditEntryRepository.sumCreditsByOrg()` and tested in `br-14.cross-org-credits.test.ts`. | `association:member/repos/credits.repo.ts`, `training/br-14.*.test.ts` | BR-14 |
| EF-M10-POS-05 | Comprehensive test coverage: 7 test files in `training/` + 6 test files across `association:member/` and `person/` + 1 in `association:operations/` covering all major credit flows. | multiple | MODULE_SPEC 12 |
| EF-M10-POS-06 | `credits.schema.ts` has proper indexes: `idx_credit_person`, `idx_credit_org`, `idx_credit_cycle`, `idx_credit_training`, `idx_credit_source`. Unique constraint `uq_credit_source_person` enforces idempotency. | `association:member/repos/credits.schema.ts` | MODULE_SPEC 16, M10-R2 |
| EF-M10-POS-07 | Transcript rendering in `transcript-template.ts` produces well-structured HTML with per-org grouping, cycle boundary display, and compliance status — ready for PDF conversion. | `association:member/utils/transcript-template.ts` | WF-070 |
| EF-M10-POS-08 | `voidCreditEntry.ts` enforces mandatory reason (min 10 chars) and creates immutable audit trail via status change, aligning with M10-R3. | `association:member/voidCreditEntry.ts` | M10-R3 |
| EF-M10-POS-09 | `awardManualCredit.ts` implements SDL cap warning — computes Self-Directed Learning cap percentage and warns when exceeded. Beyond spec requirements. Emits `credit.adjusted` domain event. | `association:member/awardManualCredit.ts` | PRC compliance |
| EF-M10-POS-10 | `markComplete.ts` emits both `credit.awarded` and `training.completed` domain events (lines 127, 158), covering the spec's CreditAwarded published event for AUTO credits. | `training/markComplete.ts` | MODULE_SPEC 10b Published Events |
| EF-M10-POS-11 | `creditIssue.ts` job correctly maps `sourceType` to `type` enum: `manual_award` -> `'manual'`, all others -> `'auto'`. Validates payload fields and skips zero/negative amounts. | `association:member/jobs/creditIssue.ts` | BR-13, M10-R2 |
| EF-M10-POS-12 | `createCreditEntry.ts` uses `CreditEntryRepository` via repo pattern and calls `auditAction()` for audit trail. Validates `creditAmount > 0`. | `association:member/createCreditEntry.ts` | M10-R3, Architecture |
| EF-M10-POS-13 | CPD config settings UI (`officer/settings/cpd.tsx`) allows officers to configure required credits, cycle length, SDL cap, and cycle start month per org — matches `org_cpd_config` schema. | `routes/.../officer/settings/cpd.tsx` | MODULE_SPEC 18 credit_tracking_enabled |
| EF-M10-POS-14 | Frontend credit pages implement all 3 spec UI states: Loading (skeleton), Empty (empty state with CTA), Error (alert message). | `routes/_authenticated/my/credits/index.tsx`, `officer/reports/credits.tsx` | MODULE_SPEC 9 |

---

## Summary

| Severity | Count | Category Breakdown |
|----------|-------|-------------------|
| P1 | 4 | Error taxonomy (2), Data shape (1), Import boundaries (1) |
| P2 | 14 | Error taxonomy (2), Domain terms (2), Data shape (2), Naming (2), Import boundaries (2), Feature flags (1), Observability (1), Domain events (1), Consumed events (1) |
| P3 | 5 | Domain terms (1), Naming (1), Import boundaries (1), Frontend spec (2) |
| **Total** | **23** | Across 10 check categories |
| Positive | 14 | Core domain logic + schema + test coverage well-implemented |

### Key Themes

1. **Error taxonomy adoption: 0%** — No handler uses M10-xxx structured error codes from ERROR_TAXONOMY. All throw generic framework errors.
2. **Route path divergence** — Hand-wired routes in `app.ts` do not match API_CONTRACTS paths. SDK/frontend consumers will fail to reach endpoints.
3. **Handler duplication** — Three separate handlers for manual credit creation (`awardManualCredit`, `createCreditEntry`, `createMyCreditEntry`) with no clear canonical choice.
4. **Response shape drift** — `getMyCredits.ts` response structure significantly differs from API_CONTRACTS 2.1 spec definition.
5. **Cross-handler coupling** — `markComplete.ts` imports from 4 foreign handler directories. `getMyCredits.ts` bypasses repo pattern with raw schema queries.
6. **Missing `adjusted` entry type** — Enum only has `auto`/`manual`; spec requires `adjusted` for officer credit adjustments (WF-067).
7. **No closed-cycle validation** — M10-004 (cannot modify credits in closed cycle) is not implemented in any handler.
8. **Feature flags: 0% adoption** — None of the 3 spec-defined feature flags are checked anywhere. All features unconditionally active.
9. **Domain event gaps** — `CreditAwarded` only emitted from `markComplete.ts`, not from manual credit or job paths. No consumed event handlers for `MembershipStatusChanged` or `AccountDeletionProcessed`.
10. **Frontend hardcoding** — Compliance report hardcodes PRC defaults (45 credits, 3-year cycle) instead of reading org config.

### Remediation Priority

1. **P1 blockers first:** Add M10 error codes + closed-cycle validation, fix `getMyCredits` response shape to match API_CONTRACTS, refactor `markComplete.ts` cross-handler imports to use domain events
2. **P2 warnings:** Consolidate manual credit handlers, fix route paths, add `adjusted` enum value, implement feature flags, emit `CreditAwarded` from all credit creation paths, add consumed event handlers
3. **P3 notes:** Minor naming mismatches, frontend hardcoded defaults, acceptable cross-repo imports


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
