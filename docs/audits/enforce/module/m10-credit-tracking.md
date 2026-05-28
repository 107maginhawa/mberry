# Module Enforcement: m10-credit-tracking

**Score:** 7.0/10 — CONDITIONALLY COMPLIANT (capped by P1 findings)
**Previous Score:** 5.8/10
**Audit Date:** 2026-05-28
**Source:** `person/getMyCredits.ts`, `person/getMyCreditSummary.ts`, `person/createMyCreditEntry.ts`, `person/listMyCreditEntries.ts`, `association:member/awardManualCredit.ts`, `association:member/getCreditCompliance.ts`, `association:member/getCreditTranscript.ts`, `association:member/getCreditTranscriptPdf.ts`, `association:member/voidCreditEntry.ts`, `association:member/createCreditEntry.ts`, `association:member/repos/credits.repo.ts`, `association:member/repos/credits.schema.ts`, `association:member/utils/credit-cycle.ts`, `training/markComplete.ts`

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 7/10 | 0 | 1 | 4 | 1 |
| 2. Workflow Implementation | 7/10 | 0 | 1 | 1 | 0 |
| 3. Domain Term Consistency | 7/10 | 0 | 0 | 1 | 1 |
| 4. State Machine Enforcement | 6/10 | 0 | 0 | 1 | 0 |
| 5. Event Publishing | 5/10 | 0 | 1 | 1 | 0 |
| 6. Auth/Permission Enforcement | 7/10 | 0 | 0 | 2 | 0 |

**Raw average:** 6.5 | **Capped at 7.0** (P1 findings present) | **Final: 7.0**

## Summary

M10 Credit Tracking improved from 5.8 to 7.0 since last audit. Major progress: two previously-missing spec endpoints now implemented (`POST /credits/adjust` via `awardManualCredit`, `GET /orgs/:orgId/credits/compliance` via `getCreditCompliance`). Credit handler code is now spread across 3 handler directories:

- **`person/`** (4 handlers): `getMyCredits`, `getMyCreditSummary`, `createMyCreditEntry`, `listMyCreditEntries` — member self-service
- **`association:member/`** (6+ handlers): `awardManualCredit`, `getCreditCompliance`, `getCreditTranscript`, `getCreditTranscriptPdf`, `voidCreditEntry`, `createCreditEntry` — officer/admin workflows
- **`training/`**: `markComplete` — auto-credit pipeline (BR-13)

All 5 spec API endpoints now have functional handlers, though route paths diverge from spec. The data layer (`CreditEntryRepository`, `credit-cycle.ts`) is mature. Test coverage is strong (~40+ test cases across 12 test files). Remaining gaps: transcript not in OpenAPI routes, GDPR event handler missing, schema type enum incomplete.

### Changes Since Last Audit

| Previous Finding | Status | Notes |
|---|---|---|
| EM-M10-c4a91e2f (P1): `POST /credits/adjust` missing | **RESOLVED** | `awardManualCredit.ts` implements officer award with position check, idempotency, SDL cap |
| EM-M10-b7d03f1a (P1): `GET /orgs/:orgId/credits/compliance` missing | **RESOLVED** | `getCreditCompliance.ts` returns per-member breakdown with compliant/at_risk/non_compliant |
| EM-M10-e5c72a8d (P1): WF-067 officer adjustment missing | **RESOLVED** | Split into `awardManualCredit` (positive) + `voidCreditEntry` (revoke). Different pattern than spec but functional. |
| EM-M10-15ad42e8 (P1): No domain events emitted | **PARTIAL** | `markComplete` emits `credit.awarded`; `awardManualCredit` emits `credit.adjusted`. Self-service `createMyCreditEntry` still emits nothing. |
| EM-M10-37cf640a (P1): No auth on adjust/compliance | **RESOLVED** | Both use `requirePosition()` for officer gating |
| EM-M10-82da1f5b (P2): Missing `adjusted` type in enum | **OPEN** | Still only `auto`/`manual` in enum |
| EM-M10-d9f14b3e (P1): awardManualCredit missing validations | **PARTIAL** | Idempotency and SDL cap added. Supporting doc validation still missing. |

## Findings

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M10-c9d0e1f2 | P1 | API Completeness | Transcript export handlers exist (`getCreditTranscript.ts`, `getCreditTranscriptPdf.ts`) but not registered in OpenAPI routes. Dead code — not reachable via API. Spec WF-070 requires downloadable PDF/CSV. | `association:member/getCreditTranscript.ts`, `getCreditTranscriptPdf.ts` | HIGH |
| EM-M10-a1b2c3d4 | P2 | API Completeness | Path drift: spec declares `GET /credits/my`, impl uses `GET /persons/me/credit-summary` and `GET /persons/me/credits`. Functional but contract mismatch. | `person/getMyCreditSummary.ts`, `person/getMyCredits.ts` | MEDIUM |
| EM-M10-e5f6g7h8 | P2 | API Completeness | Path drift: spec declares `POST /credits/manual` (self-service), impl at `POST /persons/me/credit-entries`. | `person/createMyCreditEntry.ts` | MEDIUM |
| EM-M10-i9j0k1l2 | P2 | API Completeness | Spec declares `POST /credits/adjust` for officer adjustment (positive/negative). Impl at `POST /association/member/credits/manual` awards only (positive). Negative adjustments go through separate `voidCreditEntry` — different semantics. | `association:member/awardManualCredit.ts` | MEDIUM |
| EM-M10-m3n4o5p6 | P2 | API Completeness | Path drift: spec `GET /orgs/{id}/credits/compliance` vs impl `GET /credit-compliance/{organizationId}`. | `association:member/getCreditCompliance.ts` | MEDIUM |
| EM-M10-u1v2w3x4 | P3 | API Completeness | `voidCreditEntry` not declared in spec. Extra capability implementing credit revocation by voiding active entries. Useful but undeclared. | `association:member/voidCreditEntry.ts` | LOW |
| EM-M10-y5z6a7b8 | P2 | Workflow | WF-067 (Officer Credit Adjustment): spec expects single adjust endpoint handling positive/negative adjustments. Impl splits into `awardManualCredit` (positive award) + `voidCreditEntry` (revoke). Spec says "corrections via new ADJUSTED entries" but impl voids existing entries instead. | `association:member/awardManualCredit.ts`, `voidCreditEntry.ts` | HIGH |
| EM-M10-c9f1e2d3 | P1 | Workflow | WF-070 (Credit Transcript Export): handler files exist but are not routed. No API path registered in OpenAPI. Spec requires format selection (PDF/CSV) and downloadable output. | `association:member/getCreditTranscript.ts`, `getCreditTranscriptPdf.ts` | HIGH |
| EM-M10-e7f8g9h0 | P2 | Domain Terms | Missing `adjusted` type in `credit_entry_type` enum. Spec declares 3 types (AUTO, MANUAL, ADJUSTED); schema has 2 (`auto`, `manual`). Blocks spec-compliant officer adjustment entries. | `association:member/repos/credits.schema.ts` | HIGH |
| EM-M10-i1j2k3l4 | P3 | Domain Terms | Spec says CreditCycle is "computed, not stored" but schema denormalizes `cycle_start`/`cycle_end` per entry. Pragmatic optimization but diverges from spec intent. | `credits.schema.ts` | LOW |
| EM-M10-g3h4i5j6 | P2 | State Machine | Schema has de facto state machine (`active` -> `voided`, `active` -> `disputed` via `creditStatusEnum`) but spec explicitly says "no state machine — immutable records". Corrections should use new ADJUSTED entries per spec, not status transitions. | `credits.schema.ts`, `voidCreditEntry.ts` | HIGH |
| EM-M10-o1p2q3r4 | P1 | Event Publishing | Spec declares consumption of `AccountDeletionProcessed` event requiring PII anonymization of credit records. No handler subscribes to this event. GDPR/privacy compliance risk. | (missing handler) | HIGH |
| EM-M10-s5t6u7v8 | P2 | Event Publishing | Self-service `createMyCreditEntry` emits no domain event. Spec implies `CreditAwarded` should fire for all credit creation paths. Only `markComplete` (credit.awarded) and `awardManualCredit` (credit.adjusted) emit events. | `person/createMyCreditEntry.ts` | MEDIUM |
| EM-M10-k7l8m9n0 | P2 | Event Publishing | Spec declares consumption of `MembershipStatusChanged` to check if credit tracking still applies. No listener implemented. Low impact (no-op per spec) but contract gap. | (missing handler) | MEDIUM |
| EM-M10-w9x0y1z2 | P2 | Auth/Permission | Spec requires 2FA for president when adjusting credits. `awardManualCredit` uses `requirePosition([PRESIDENT, SECRETARY, TREASURER])` — no 2FA check. Secretary/Treasurer not in spec's allowed roles for adjustment (spec says "super, admin, president (2FA), officer"). | `association:member/awardManualCredit.ts` | MEDIUM |
| EM-M10-a3b4c5d6 | P2 | Auth/Permission | Compliance view: spec allows super, admin roles. Impl restricts to `SOCIETY_OFFICER` + `PRESIDENT` only via `requirePosition`. Missing super/admin access. | `association:member/getCreditCompliance.ts` | MEDIUM |
| EM-M10-m5n6o7p8 | P2 | Business Rules | M10-R1: `markComplete.ts` does not check org's `creditTrackingEnabled` flag before creating auto credit entries. Should skip auto-credit for orgs with tracking disabled. | `training/markComplete.ts` | MEDIUM |
| EM-M10-q9r0s1t2 | P2 | Business Rules | M10-R5: No supporting document file-type/size validation in `createMyCreditEntry`. Spec requires PDF/image only, max 5MB. Handler accepts any `supportingDocumentId` without validation. | `person/createMyCreditEntry.ts` | MEDIUM |
| EM-M10-48d0751b | P3 | Positive | `CreditEntryRepository` is comprehensive: `createOne`, `findByTrainingAndPerson` (AC-M10-002 duplicate guard), `sumCreditsForCycle`, `sumCreditsByCategoryBatch`, `sumCreditsByOrg`, `listForPerson`. Data layer fully supports all spec workflows. | `association:member/repos/credits.repo.ts` | HIGH |
| EM-M10-59e1862c | P3 | Positive | `credit-cycle.ts` correctly implements BR-11 (configurable cycle start with fixed annual anchor + registration-based fallback) and BR-12 (carryover capped at 50%). `getCycleForDateWithConfig` handles both modes. Well-tested in `credit-cycle.test.ts`. | `association:member/utils/credit-cycle.ts` | HIGH |
| EM-M10-6af2973d | P3 | Positive | Strong test coverage: 12 test files covering AC-M10-001 through AC-M10-005, BR-14 cross-org aggregation, training-credit-award flow, attendance-credit flow, credit cycle computation, handler auth guards. ~40+ test cases total. | `training/`, `association:member/`, `person/` | HIGH |
| EM-M10-7b039a4e | P3 | Positive | Auto-credit pipeline (BR-13) works via `markComplete.ts` with duplicate guard (`findByTrainingAndPerson`), cycle config lookup from association, and `credit.awarded` domain event. AC-M10-002 (no duplicate AUTO) enforced at both application and database level (unique constraint). | `training/markComplete.ts` | HIGH |
| EM-M10-8c14ab5f | P3 | Positive | `getMyCredits.ts` returns category breakdown (General/Major/Self-Directed), SDL cap tracking with exceeded flag, compliance percentage, and full history. Exceeds minimal spec requirements. `getCreditCompliance.ts` provides org-wide compliance with compliant/at_risk/non_compliant classification. | `person/getMyCredits.ts`, `association:member/getCreditCompliance.ts` | HIGH |

## Recommended Actions (Priority Order)

1. **P1**: Wire transcript export to OpenAPI routes (`getCreditTranscript`, `getCreditTranscriptPdf`) or remove dead handler files
2. **P1**: Implement `AccountDeletionProcessed` event handler for PII anonymization (GDPR)
3. **P2**: Add `adjusted` to `credit_entry_type` enum; update spec to document void pattern as intentional
4. **P2**: Check `creditTrackingEnabled` in `markComplete.ts` before auto-awarding credits
5. **P2**: Add supporting document validation (file type + 5MB cap) in `createMyCreditEntry`
6. **P2**: Emit `CreditAwarded` event from `createMyCreditEntry`
7. **P2**: Add super/admin access to compliance endpoint
8. **P2**: Reconcile spec API paths with actual OpenAPI paths (update spec to match implementation)
9. **P3**: Document void/status pattern in spec as intentional divergence from "no state machine"
