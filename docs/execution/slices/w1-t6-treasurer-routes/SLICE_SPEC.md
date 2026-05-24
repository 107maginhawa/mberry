---
slice: w1-t6-treasurer-routes
phase: wave1-financial
priority: P2
agent_skills: [oli-execution-gate]
---

# T6: Treasurer Dashboard + Member Detail Routes

## Goal
Wire chart components and member detail into new routes accessible from officer navigation.

## Acceptance Criteria

- **AC-T6-001**: `/org/$orgSlug/officer/dashboard/treasurer` route renders treasurer dashboard with all 4 chart components
- **AC-T6-002**: `/org/$orgSlug/officer/dues/member/$memberId` route renders member financial detail page
- **AC-T6-003**: Treasurer dashboard fetches data from getDuesMetrics endpoint
- **AC-T6-004**: Member detail page fetches data from getDuesMemberSummary endpoint
- **AC-T6-005**: Both routes require officer authentication (redirect to auth if not officer)
- **AC-T6-006**: Loading states shown while data fetches (Suspense boundary for lazy-loaded charts)

## Business Rules

- **BR-T6-001**: IF user is not officer THEN redirect to member dashboard (not 403 page)
- **BR-T6-002**: IF chart data is loading THEN show skeleton/spinner, not empty chart

## Files in Scope
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dashboard/treasurer.tsx` — NEW
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/member/$memberId.tsx` — NEW

## Out of Scope
- Chart component internals (T5)
- Backend endpoints (T3/T4)
- Navigation sidebar changes
