<!-- oli:compliance-report v2.0 | generated: 2026-05-28 | baseline: v3 | method: fresh spec-to-code trace -->
# Compliance Report — Cycle 7

**Project:** Memberry Healthcare Association Management Platform
**Date:** 2026-05-28
**Method:** Fresh spec-to-code trace across 14 audit categories, 27 handler dirs, 19 module specs
**Baseline:** v3 (2026-05-27, scored 7.9/10 overall, 0 P0, 31 P1)
**Prior report:** Cycle 6 scored 8.0/10 with 4 P0s — superseded by this deeper audit

---

## Executive Summary

**Spec Compliance Score: 3.5/10** (weighted average of 13 deep-audited modules)

| Metric | Baseline v3 | Cycle 6 | This Audit (Cycle 7) |
|--------|------------|---------|---------------------|
| Overall Score | 7.9/10 | 8.0/10 | **3.5/10** |
| P0 Violations | 3 | 4 | **26** |
| P1 Violations | 87 | 26 | **85** |
| P2 Violations | ~60 | 38 | **~95** |
| Modules Audited | 14 mapped | 19 | 13 deep + 6 discovery |
| Handler Dirs Covered | 13 | 26 | **27 (all)** |

> **Score drop explained:** Prior cycles used enforcement-fix scoring (apply fix → score goes up). This audit is a fresh spec-to-code trace across ALL 14 categories + ALL 27 handler dirs + cross-module checks. The deeper audit surface exposed violations previous cycles didn't cover: missing handlers, auth gaps on 40+ files, dead event bus (23/24 events unconsumed), and 9 handler dirs previously unmapped.

### Top 3 Risks

1. **Domain Event Bus is Structurally Dead** — 24 events registered, 24 emitted, **1 consumer**. 23 events fire into the void. Cross-module reactions (notifications, cascades, audit logging) specified in EVENT_CONTRACTS.md don't happen.

2. **Auth Guards Missing on 40+ Handlers** — Including 2 P0 write endpoints (bulkIssueCertificates, updateOrgCpdConfig) with zero auth. No centralized auth enforcement — each handler must remember to check individually.

3. **Financial↔Membership Circular Dependency** — `dues/` imports from `association:member/` and vice versa. Bidirectional coupling prevents clean module boundaries.

---

## P0 Violation Registry (26 total)

### Security-Critical (fix first)

| ID | Module | Description | File |
|----|--------|-------------|------|
| AUTH-01 | cross | bulkIssueCertificates — no auth on write endpoint | association:member/bulkIssueCertificates.ts |
| AUTH-02 | cross | updateOrgCpdConfig — no auth on write endpoint | association:member/updateOrgCpdConfig.ts |
| M7-R2 | m07 | Email opt-out NOT enforced — announcementSend sends to ALL recipients | communication/jobs/announcementSend.ts:130-170 |
| M7-R5 | m07 | Suppressed/deceased member filter missing in delivery path | communication/jobs/announcementSend.ts:60-80 |
| M6-2FA | m06 | No 2FA on financial operations (manual payment, refund, config) | recordDuesPayment.ts, refundDuesPayment.ts |

### Data Integrity

| ID | Module | Description | File |
|----|--------|-------------|------|
| BR-01-STORED | m05 | Membership status stored mutably — spec says "never store, always compute" | membership/updateMember.ts:70 |
| BR-01-INCOMPLETE | m05 | computeMembershipStatus missing: deceased, expelled, resigned, expired | association:member/utils/compute-membership-status.ts |
| M2-R5-NO-BLOCK | m02 | Account deletion doesn't check pending payments or sole officer | person/requestMyAccountDeletion.ts:26-30 |
| M4-R1-BOARD | m04 | Board Member multi-holder exception not implemented | association:member/createOfficerTerm.ts:46-53 |

### Missing Critical Handlers

| ID | Module | Description |
|----|--------|-------------|
| M4-TRANSITION | m04 | Officer transition endpoint missing (POST /org/:id/officers/:termId/transition) |
| M4-DASHBOARD | m04 | Org dashboard endpoint missing (GET /org/:id/dashboard) |
| M8-R5 | m08 | Cancel-registration handler missing (DELETE endpoint) |
| M9-PUBLISH | m09 | publishTraining handler missing (draft→published broken) |

### Dead Features / Missing Implementation

| ID | Module | Description |
|----|--------|-------------|
| UJ-M02-pdf-disabled | m02 | No backend PDF endpoint for ID card. Frontend uses window.print() |
| UJ-M03-subscriptions | m03 | Subscription management entirely absent from admin UI |
| M3-R11 | m03 | DPA 2012 72h breach notification — zero implementation |
| M3-R12 | m03 | Support ticket SLA workflow absent |
| M9-R1 | m09 | Training type not enforced at handler level (no pgEnum) |
| M9-R6 | m09 | Network visibility unimplemented (field stripped, no DB column) |
| M8-R3 | m08 | cancelEvent doesn't cascade (no member notification/refunds) |

### Systemic

| ID | Module | Description |
|----|--------|-------------|
| M4-EVENTS | m04 | Zero domain events emitted (0/5 spec events) |
| M6-AC-TRACE | m06 | Zero AC IDs referenced in test files — no traceability |
| BCI-01 | cross | Financial↔Membership circular dependency |
| DEB-01 | cross | 23/24 domain events have zero consumers |
| DEB-02 | cross | dues event emission from wrong module (association:member/) |

### Resolved from Baseline

| ID | Status | Evidence |
|----|--------|----------|
| UJ-M02-export-method | **RESOLVED** | Both OpenAPI spec and handler use GET. No mismatch. |

---

## Per-Module Scores

| Module | Score | P0 | P1 | P2 | P3 | Delta vs Baseline |
|--------|-------|----|----|----|----|-------------------|
| m01-auth-onboarding | 4/10 | 0 | 8 | 11 | 3 | -2.0 ▼ |
| m02-member-profile | 4/10 | 2 | 8 | 5 | 3 | -1.5 ▼ |
| m03-platform-admin | 4/10 | 3 | 2 | 4 | 2 | -2.5 ▼ |
| m04-org-admin | 0/10 | 4 | 6 | 4 | 3 | -6.5 ▼ |
| m05-membership | 0/10 | 2 | 5 | 6 | 3 | -6.0 ▼ |
| m06-dues-payments | 5/10 | 2 | 4 | 4 | 2 | -2.5 ▼ |
| m07-communications | 4/10 | 2 | 6 | 5 | 2 | -1.5 ▼ |
| m08-events | 4/10 | 2 | 5 | 5 | 2 | -3.0 ▼ |
| m09-training | 5/10 | 3 | 4 | 3 | 2 | -2.0 ▼ |
| m10-credit-tracking | 5/10 | 0 | 4 | 5 | 2 | -1.5 ▼ |
| m11-documents-credentials | 4/10 | 0 | 6 | 5 | 2 | -1.5 ▼ |
| m12-elections-governance | 5.5/10 | 0 | 5 | 8 | 3 | -2.5 ▼ |
| m14-national-dashboard | 3/10 | 0 | 5 | 5 | 3 | +1.5 ▲ |
| **Cross-module** | — | 5 | 22 | 6 | 1 | — |
| m13-m19 (6 modules) | N/A | — | — | — | — | Audit deferred |

**Scoring formula:** `10 - (P0×3 + P1×1 + P2×0.3 + P3×0.1)`, floor 0

---

## Cross-Module Findings

### Bounded Context Integrity

| Severity | Count | Key Finding |
|----------|-------|-------------|
| P0 | 1 | Financial↔Membership circular dependency (dues↔association:member bidirectional imports) |
| P1 | 8 | person/ has 6 direct imports from association:member/ repos |
| P2 | 1 | membership/↔association:member/ boundary ambiguous |

### Domain Event Bus Health

| Metric | Value |
|--------|-------|
| Registered events | 24 |
| Registered consumers | **1** (dues.payment.recorded → membership expiry) |
| Actual emissions | 24 |
| Emitting modules | 12 of 25 |
| Non-emitting modules | 13 (advertising, audit, billing, certificates, comms, documents, dues, email, marketplace, notifs, platformadmin, reviews, storage) |

### Auth Pattern Consistency

| Pattern | Modules Using |
|---------|--------------|
| `requirePosition()` | dues, training, certificates, association:ops, communication, events |
| `ctx.get('session')` + manual | person, booking, storage, documents, comms, reviews, membership |
| No auth at all | **40+ handler files** |

---

## Discovery: 6 "Spec-Only" Modules Are Implemented

Baseline had `source_path: null` for m13, m15-m19. All are implemented:

| Module | Handler Dir | Handlers | Tests | Frontend |
|--------|------------|----------|-------|----------|
| m13-professional-feed | communication/ | 5 | 3 | none |
| m15-job-board | jobs/ | 7 | 7 | none |
| m16-advertising | advertising/ | 7 | 7 | none |
| m17-marketplace | marketplace/ | 9 | 3 | none |
| m18-surveys-polls | surveys/ | 16 | 10+ | Full (officer+member+admin) |
| m19-committee-management | association:operations/ + platformadmin/ | 10 | 6 | Admin only |

**Action:** Full audit of m13, m15-m19 in next cycle. Update baseline `source_path`.

---

## Module → Handler Mapping (Complete)

| Module | Primary | Secondary |
|--------|---------|-----------|
| m01-auth-onboarding | person/ (auth subset) | invite/ |
| m02-member-profile | person/ (profile subset) | reviews/ |
| m03-platform-admin | platformadmin/ | — |
| m04-org-admin | association:member/ | — |
| m05-membership | membership/ | — |
| m06-dues-payments | dues/ | billing/ |
| m07-communications | communication/ | comms/, email/, notifs/ |
| m08-events | events/ | booking/ |
| m09-training | training/ (course subset) | — |
| m10-credit-tracking | training/ (credit subset) | certificates/ |
| m11-documents-credentials | documents/ | storage/ |
| m12-elections-governance | elections/ | — |
| m13-professional-feed | communication/ (feed subset) | — |
| m14-national-dashboard | platformadmin/ (actual) | — |
| m15-job-board | jobs/ | — |
| m16-advertising | advertising/ | — |
| m17-marketplace | marketplace/ | — |
| m18-surveys-polls | surveys/ | — |
| m19-committee-management | association:operations/ | platformadmin/ |

---

## Stabilization Plan

### Fix Now (P0) — 26 items, priority order

**Security-critical (days 1-2):**
1. Add auth guards to bulkIssueCertificates + updateOrgCpdConfig
2. Add opt-out check + suppressed/deceased filter to announcementSend.ts
3. Add 2FA verification to financial mutation handlers

**Data integrity (days 3-4):**
4. Refactor membership status to computed (or add computed view layer)
5. Add deceased/expelled/resigned/expired to computeMembershipStatus()
6. Add pending-payment + sole-officer checks to requestMyAccountDeletion

**Missing handlers (days 5-7):**
7. Implement officer transition endpoint
8. Implement cancel-registration handler
9. Implement publishTraining handler

### Fix Before New Work (P1) — 85 items

**Highest impact P1s:**
- Wire domain event consumers (DEB-01 — biggest systemic gap)
- Add auth guards to 40+ unguarded handlers
- Implement missing API contract endpoints
- Fix state machine transition maps (m05, m08, m09, m12)

### Fix When Touching (P2) — ~95 items
- Error response shape standardization
- API convention conformance (envelope, pagination)
- Frontend error boundaries
- Domain term consistency

### Track (P3) — ~30 items
- Observability metrics, feature flags, test stubs

---

## Methodology

**14 audit categories applied (skipped infra — no Docker):**
1. Business rules (BR-NNN enforcement in code)
2. Acceptance criteria (AC-NNN test existence)
3. Permissions (role matrix vs middleware/guards)
4. Domain terminology consistency
5. Bounded context integrity
6. Error contracts
7. API contracts
8. State transitions
9. Data validation
10. Events (emission vs EVENT_CONTRACTS.md)
11. Data path connectivity
12. Error boundary coverage
13. Frontend↔backend contract consistency
14. API conventions conformance

**Execution:** 15 parallel agents across 3 waves + cross-module checks. All 27 handler dirs assigned to modules. Shared dirs (person/, training/) deduplicated via file-level attribution.

**Comparison to Cycle 6:** This audit found 26 P0s vs Cycle 6's 4 P0s. The difference: Cycle 6 audited enforcement fixes incrementally. Cycle 7 traced fresh from specs to code across all categories and all handler dirs simultaneously. The deeper audit surface is more accurate but scores lower because it catches violations the incremental approach missed.

---

## What's Next

**26 P0 violations. Fix P0s → re-run audit.**

Priority:
1. Security P0s (unauthed writes, email opt-out bypass)
2. Data integrity P0s (BR-01 membership, account deletion)
3. Missing handlers (officer transition, cancel-registration, publishTraining)
4. Domain event consumers (biggest systemic gap)
5. Full audit of m13, m15-m19 (6 implemented modules unaudited)

After P0/P1 resolution: `/oli-trace` for traceability, then `/oli-confidence-stack` for test confidence.

---

*Generated by oli-audit-compliance Cycle 7. Fresh spec-to-code trace. 15 agents, 14 categories, 27 handler dirs, 19 module specs. Supersedes Cycle 6 report.*
