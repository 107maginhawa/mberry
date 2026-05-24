---
slice: w1-t3-dues-metrics
phase: wave1-financial
priority: P1
agent_skills: [oli-execution-gate]
---

# T3: getDuesMetrics Endpoint

## Goal
New endpoint providing treasurer-level financial metrics: trailing collection rates (30/90/365d), monthly breakdown (12 months), member status distribution.

## Acceptance Criteria

- **AC-T3-001**: `GET /association/member/dues-metrics/{orgId}` returns 200 with trailing collection rates for 30, 90, and 365 day windows
- **AC-T3-002**: Response includes monthly breakdown (12 months) with collected + outstanding per month
- **AC-T3-003**: Response includes member status distribution: counts per status (Active, DueSoon, Overdue, Lapsed)
- **AC-T3-004**: Endpoint requires officer authentication (returns 401/403 for unauthorized)
- **AC-T3-005**: Empty org (zero invoices/payments) returns valid response with 0 values, not NaN or error
- **AC-T3-006**: Uses existing `agingBuckets` table for status distribution data

## Business Rules

- **BR-T3-001**: IF zero payments exist in a trailing window THEN collectionRate MUST be 0 (not NaN, not division-by-zero error)
- **BR-T3-002**: IF collectionRate is computed THEN it MUST be returned as 0-100 integer (percentage)
- **BR-T3-003**: IF monthly breakdown is computed THEN months with no activity return {collected: 0, outstanding: 0}

## Files in Scope
- `services/api-ts/src/handlers/association:member/getDuesMetrics.ts` — NEW handler
- `services/api-ts/src/handlers/association:member/getDuesMetrics.test.ts` — NEW test
- `services/api-ts/src/handlers/association:member/repos/dues-payments.repo.ts` — ADD getMetricsWithTrends()

## Out of Scope
- Frontend chart components (T5)
- Member-level detail (T4)
- TypeSpec definition (hand-wired route for now)
