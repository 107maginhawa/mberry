# File Enforcement: m10-credit-tracking

> **Audit date:** 2026-05-27
> **Spec sources:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, ERROR_TAXONOMY.md, ROLE_PERMISSION_MATRIX.md
> **Scope:** All credit-related files across `training/`, `association:member/`, `person/`, `association:operations/` handler directories

## File Inventory

M10 credit tracking code is **distributed across 4 handler directories** (shared with M04, M05, M09):

### `training/` — Credit-bearing training flow (shared with M09)
| File | Role | M10 Relevance |
|------|------|---------------|
| `markComplete.ts` | Handler | AUTO credit creation on training completion (BR-13) |
| `markComplete.test.ts` | Test | 7 sections, covers credit flow + auth |
| `flow-02.training-credit-award.test.ts` | Test | FLOW-02 cross-module test |
| `flow-020.attendance-credit.test.ts` | Test | Attendance-to-credit flow + AC-M10-002 |
| `ac-m10.credit-tracking.test.ts` | Test | M10 acceptance criteria tests |
| `br-14.cross-org-credits.test.ts` | Test | BR-14 cross-org aggregation |
| `br-15.training-event-distinction.test.ts` | Test | BR-15 training vs event credit distinction |
| `repos/training.repo.ts` | Repo | Training CRUD, enrollment management |

### `association:member/` — Credit entry CRUD, compliance, transcripts
| File | Role | M10 Relevance |
|------|------|---------------|
| `repos/credits.schema.ts` | Schema | `credit_entry` + `org_cpd_config` tables |
| `repos/credits.repo.ts` | Repo | CreditEntryRepository — all credit data access |
| `utils/credit-cycle.ts` | Util | Cycle computation (BR-11), carryover (BR-12) |
| `utils/credit-cycle.test.ts` | Test | Cycle calculation tests |
| `utils/transcript-template.ts` | Util | HTML transcript rendering (Slice 043) |
| `awardManualCredit.ts` | Handler | Officer manual credit award (WF-067 partial) |
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
| `utils/trust-signals.ts` | Util | Trust signal computation for credits |

### `person/` — Self-service credit views
| File | Role | M10 Relevance |
|------|------|---------------|
| `getMyCredits.ts` | Handler | GET /persons/me/credits (WF-065) |
| `getMyCredits.test.ts` | Test | My credits tests |
| `getMyCreditSummary.ts` | Handler | GET /credit-summary (cross-org aggregation) |
| `getMyCreditSummary.test.ts` | Test | Credit summary tests |
| `createMyCreditEntry.ts` | Handler | POST /credit-entries (self-service, WF-066) |
| `createMyCreditEntry.test.ts` | Test | Self-service credit entry tests |
| `listMyCreditEntries.ts` | Handler | GET /credit-entries (own entries) |
| `listMyCreditEntries.test.ts` | Test | List my credit entries tests |

### `association:operations/` — Training schema (shared with M09)
| File | Role | M10 Relevance |
|------|------|---------------|
| `repos/training.schema.ts` | Schema | `training` table with `creditBearing`, `creditAmount` |

---

## Findings

| ID | Sev | Check | Finding | File | Spec Source | Confidence |
|----|-----|-------|---------|------|-------------|------------|
| EF-M10-1a2b3c4d | P2 | Error taxonomy | `markComplete.ts` throws generic `ForbiddenError`, `NotFoundError`, `ConflictError` — does not use M10 error codes from ERROR_TAXONOMY (M10-001 through M10-007). Silently swallows credit creation failures in catch block without logging. | `training/markComplete.ts` | ERROR_TAXONOMY 5.10 | HIGH |
| EF-M10-2b3c4d5e | P1 | Error taxonomy | `awardManualCredit.ts` throws generic `ValidationError` and `ConflictError` — does not use `M10-001` for negative deductions or `M10-004` for closed-cycle checks. No closed-cycle validation exists at all. | `association:member/awardManualCredit.ts` | ERROR_TAXONOMY M10-001, M10-004; API_CONTRACTS 2.3 | HIGH |
| EF-M10-3c4d5e6f | P1 | Error taxonomy | `createCreditEntry.ts` and `createMyCreditEntry.ts` do not validate against closed compliance cycles (M10-004), do not enforce supporting document requirement (M10-006), and do not check for negative credit values (M10-001). | `association:member/createCreditEntry.ts`, `person/createMyCreditEntry.ts` | ERROR_TAXONOMY M10-001, M10-004, M10-006 | HIGH |
| EF-M10-4d5e6f7a | P2 | Error taxonomy | `voidCreditEntry.ts` validates reason (min 10 chars) but throws generic `ValidationError` instead of structured M10 error code. Uses `NotFoundError` correctly. | `association:member/voidCreditEntry.ts` | ERROR_TAXONOMY M10 codes | MEDIUM |
| EF-M10-5e6f7a8b | P2 | Domain terms | Schema uses `creditAmount` (column name) consistently, but MODULE_SPEC and API_CONTRACTS use `creditValue` as the field name. All code uses `creditAmount` — internally consistent but spec-divergent. | `association:member/repos/credits.schema.ts` | MODULE_SPEC 7, API_CONTRACTS 2.2 | HIGH |
| EF-M10-6f7a8b9c | P2 | Domain terms | `creditEntryTypeEnum` has `['auto', 'manual']`. Spec workflow WF-067 and API_CONTRACTS 2.3 require an `adjusted` type for officer credit adjustments. `voidCreditEntry.ts` works around this by setting `status: 'voided'` instead of creating a new adjustment entry. | `association:member/repos/credits.schema.ts` | API_CONTRACTS 2.3, WF-067 | HIGH |
| EF-M10-7a8b9c0d | P3 | Domain terms | `cpdCategoryEnum` uses `'Self-Directed'` (hyphenated). Spec uses `SelfDirected` (no hyphen). Minor but could cause API response/request mismatch if SDK enforces spec enum values. | `association:member/repos/credits.schema.ts` | API_CONTRACTS 2.2 cpdCategory | MEDIUM |
| EF-M10-8b9c0d1e | P1 | Data shape | `getMyCredits.ts` returns response shape `{ data: { totalCredits, requiredCredits, compliancePercent, categoryBreakdown, sdlCap, history } }` — does not match API_CONTRACTS 2.1 shape which expects `{ data: { currentCycle, entries, totalCredits, remainingCredits, compliancePercentage, carryoverCredits } }`. Missing: `currentCycle` object, `remainingCredits`, `carryoverCredits`. Extra: `categoryBreakdown`, `sdlCap`, `history`. | `person/getMyCredits.ts` | API_CONTRACTS 2.1 GET /credits/my | HIGH |
| EF-M10-9c0d1e2f | P2 | Data shape | `getCreditCompliance.ts` returns `{ summary, data: memberResults }` with `compliance_status` (snake_case). API_CONTRACTS 2.4 expects `complianceStatus` (camelCase) and `{ data: { summary, members } }` structure. | `association:member/getCreditCompliance.ts` | API_CONTRACTS 2.4 | HIGH |
| EF-M10-0d1e2f3a | P2 | Data shape | `getCreditTranscript.ts` returns JSON with `{ personId, cycle, organizations, earned, ... }`. Spec endpoint `GET /credits/transcript` should return binary PDF/CSV, not JSON. This handler serves the JSON data view; `getCreditTranscriptPdf.ts` renders HTML. Neither produces actual PDF binary or CSV. | `association:member/getCreditTranscript.ts`, `getCreditTranscriptPdf.ts` | API_CONTRACTS 2.5 | HIGH |
| EF-M10-1e2f3a4b | P2 | Data shape | `creditIssue.ts` job inserts credits with `type: payload.sourceType` (e.g., `'training_completion'`). But `creditEntryTypeEnum` only allows `'auto'` or `'manual'`. The job uses raw SQL-style insert that bypasses Drizzle enum validation via `as any` casting. Will fail at DB level if enum constraint is enforced. | `association:member/jobs/creditIssue.ts` | Schema enum vs job payload | HIGH |
| EF-M10-2f3a4b5c | P1 | Naming | Route path mismatch: `app.ts:337` registers `POST /association/member/credits/manual` but API_CONTRACTS defines `POST /credits/manual`. Route `app.ts:340` registers `GET /persons/me/credits` but spec defines `GET /credits/my`. SDK/frontend will not find these endpoints at spec-defined paths. | `services/api-ts/src/app.ts:337,340` | API_CONTRACTS 2.1, 2.2 | HIGH |
| EF-M10-3a4b5c6d | P2 | Naming | Three separate handlers create manual credit entries: `awardManualCredit.ts` (officer), `createCreditEntry.ts` (member via association:member), `createMyCreditEntry.ts` (member via person). Spec defines exactly one endpoint: `POST /credits/manual`. Unclear which handler is canonical. | `association:member/awardManualCredit.ts`, `createCreditEntry.ts`, `person/createMyCreditEntry.ts` | API_CONTRACTS 2.2 | HIGH |
| EF-M10-4b5c6d7e | P3 | Naming | `getCreditCompliance.ts` registered at an unspecified route. API_CONTRACTS defines `GET /orgs/:organizationId/credits/compliance`. Handler uses `ctx.req.valid('param')` suggesting generated-route registration but route path not verified in app.ts hand-wired section. | `association:member/getCreditCompliance.ts` | API_CONTRACTS 2.4 | MEDIUM |
| EF-M10-5c6d7e8f | P1 | Import boundaries | `training/markComplete.ts` imports from 4 foreign handler directories: `association:member/repos/credits.repo`, `association:member/repos/membership.repo`, `association:member/utils/credit-cycle`, `platformadmin/repos/platform-admin.repo`, `association:member/repos/governance.repo`. Violates handler isolation — should use a cross-module service or domain event. | `training/markComplete.ts` | Architecture: handler isolation | HIGH |
| EF-M10-6d7e8f9a | P2 | Import boundaries | `person/getMyCredits.ts` imports schema directly: `creditEntries` and `orgCpdConfig` from `association:member/repos/credits.schema.ts`, then writes raw Drizzle queries. Should use `CreditEntryRepository` for data access abstraction. | `person/getMyCredits.ts` | Architecture: repo pattern | HIGH |
| EF-M10-7e8f9a0b | P2 | Import boundaries | `person/getMyCreditSummary.ts` imports raw schema tables (`memberships`, `associations`, `organizations`) from multiple handler directories and writes join queries. Should use respective repositories. | `person/getMyCreditSummary.ts` | Architecture: repo pattern | HIGH |
| EF-M10-8f9a0b1c | P3 | Import boundaries | `getCreditCompliance.ts` imports `MembershipRepository` from `../membership/repos/membership.repo` — cross-handler import but through the repo abstraction layer, which is the expected pattern. Acceptable. | `association:member/getCreditCompliance.ts` | Architecture: repo pattern | LOW (acceptable) |

---

## Positive Findings

| ID | Finding | File | Spec Source |
|----|---------|------|-------------|
| EF-M10-POS-01 | AC-M10-002 duplicate guard correctly implemented via `findByTrainingAndPerson()` check before insert in `markComplete.ts`. | `training/markComplete.ts:60-80` | AC-M10-002 |
| EF-M10-POS-02 | BR-11 credit cycle config read from association settings with sane fallback defaults (2-year, 40 credits). `getCycleForDateWithConfig()` supports both fixed-anchor and registration-based modes. | `association:member/utils/credit-cycle.ts` | BR-11 |
| EF-M10-POS-03 | BR-12 carryover capped at 50% implemented in `calculateCarryover()` pure function. | `association:member/utils/credit-cycle.ts` | BR-12 |
| EF-M10-POS-04 | BR-14 cross-org aggregation implemented in `CreditEntryRepository.sumCreditsByOrg()` and tested in `br-14.cross-org-credits.test.ts`. | `association:member/repos/credits.repo.ts`, `training/br-14.*.test.ts` | BR-14 |
| EF-M10-POS-05 | Comprehensive test coverage: 7 test files in `training/` + 5 test files across `association:member/` and `person/` covering all major credit flows. | multiple | MODULE_SPEC 12 |
| EF-M10-POS-06 | `credits.schema.ts` has proper indexes: `idx_credit_person`, `idx_credit_org`, `idx_credit_cycle`, `idx_credit_training`, `idx_credit_source`. Unique constraint `uq_credit_source_person` enforces idempotency. | `association:member/repos/credits.schema.ts` | MODULE_SPEC 16, M10-R2 |
| EF-M10-POS-07 | Transcript rendering in `transcript-template.ts` produces well-structured HTML with per-org grouping, cycle boundary display, and compliance status — ready for PDF conversion. | `association:member/utils/transcript-template.ts` | WF-070 |
| EF-M10-POS-08 | `voidCreditEntry.ts` enforces mandatory reason (min 10 chars) and creates immutable audit trail via status change, aligning with M10-R3. | `association:member/voidCreditEntry.ts` | M10-R3 |
| EF-M10-POS-09 | `awardManualCredit.ts` implements SDL cap warning — computes Self-Directed Learning cap percentage and warns when exceeded. Beyond spec requirements. | `association:member/awardManualCredit.ts` | PRC compliance |

---

## Summary

| Severity | Count | Category Breakdown |
|----------|-------|-------------------|
| P1 | 4 | Error taxonomy (1), Data shape (1), Naming (1), Import boundaries (1) |
| P2 | 10 | Error taxonomy (2), Domain terms (2), Data shape (3), Naming (1), Import boundaries (2) |
| P3 | 4 | Domain terms (1), Naming (1), Import boundaries (2) |
| **Total** | **18** | Across 5 check categories |
| Positive | 9 | Core domain logic well-implemented |

### Key Themes

1. **Error taxonomy adoption: 0%** — No handler uses M10-xxx structured error codes from ERROR_TAXONOMY. All throw generic framework errors.
2. **Route path divergence** — Hand-wired routes in `app.ts` do not match API_CONTRACTS paths. SDK/frontend consumers will fail to reach endpoints.
3. **Handler duplication** — Three separate handlers for manual credit creation (`awardManualCredit`, `createCreditEntry`, `createMyCreditEntry`) with no clear canonical choice.
4. **Response shape drift** — `getMyCredits.ts` response structure significantly differs from API_CONTRACTS 2.1 spec definition.
5. **Cross-handler coupling** — `markComplete.ts` imports from 4 foreign handler directories. `getMyCredits.ts` bypasses repo pattern with raw schema queries.
6. **Missing `adjusted` entry type** — Enum only has `auto`/`manual`; spec requires `adjusted` for officer credit adjustments (WF-067).
7. **No closed-cycle validation** — M10-004 (cannot modify credits in closed cycle) is not implemented in any handler.

### Remediation Priority

1. **P1 blockers first:** Add M10 error codes, fix route paths, implement closed-cycle check, refactor `markComplete.ts` cross-handler imports
2. **P2 warnings:** Consolidate manual credit handlers, fix response shapes, add `adjusted` enum value, align domain terms
3. **P3 notes:** Minor naming mismatches, acceptable cross-repo imports
