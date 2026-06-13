---
slice: w1-t5-chart-components
phase: wave1-financial
priority: P2
---

# T5: Recharts Chart Components (Lazy-Loaded)

## Goal
Install Recharts and build 4 lazy-loaded chart components for the treasurer dashboard.

## Acceptance Criteria

- **AC-T5-001**: `recharts` added as dependency to `apps/memberry/package.json`
- **AC-T5-002**: `collection-rate-card.tsx` renders collection rate percentage with trend indicator (up/down/flat arrow)
- **AC-T5-003**: `monthly-trend-chart.tsx` renders 12-month line chart with collected vs outstanding lines
- **AC-T5-004**: `status-distribution-chart.tsx` renders pie/donut chart with Active/DueSoon/Overdue/Lapsed segments
- **AC-T5-005**: `top-unpaid-list.tsx` renders sorted table of members with highest outstanding amounts, with "Send Reminder" action button
- **AC-T5-006**: All chart components wrapped in `React.lazy()` at import site (not self-lazy)
- **AC-T5-007**: Empty data (zero payments, zero members) renders gracefully — no crash, shows "No data" message
- **AC-T5-008**: Charts have ARIA labels for screen reader accessibility

## Business Rules

- **BR-T5-001**: IF Recharts receives empty data array THEN component MUST render fallback "No data yet" message, not throw
- **BR-T5-002**: IF collection rate trend is computed THEN compare current 30d rate vs prior 30d rate: up if higher, down if lower, flat if equal

## Files in Scope
- `apps/memberry/src/features/dues/components/collection-rate-card.tsx` — NEW
- `apps/memberry/src/features/dues/components/monthly-trend-chart.tsx` — NEW
- `apps/memberry/src/features/dues/components/status-distribution-chart.tsx` — NEW
- `apps/memberry/src/features/dues/components/top-unpaid-list.tsx` — NEW
- Tests for each component

## Out of Scope
- Backend endpoints (T3/T4)
- Route wiring (T6)
