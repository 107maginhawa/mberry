# Phase 13: Position-Based RBAC - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade from binary officer/non-officer access control to position-specific permissions. Phase 12 established `requireOfficerTerm` (any officer can access officer endpoints). Phase 13 adds `requirePosition` so only the RIGHT officer (e.g., Treasurer) can access position-restricted endpoints (e.g., dues management). Also filters the officer sidebar navigation so each position only sees relevant sections.

</domain>

<decisions>
## Implementation Decisions

### Permission Matrix
- **D-01:** Position-to-route mapping:
  - **President**: all officer endpoints (superset — President can do everything any officer can)
  - **Treasurer**: dues, billing, payment gateway routes
  - **Secretary**: roster, applications, announcements, communications routes
  - **Society Officer**: events, training, courses, credit compliance routes
  - **Any officer**: org profile (read), member list (read) — shared read access
- **D-02:** This is the v1 matrix. Future phases can add granular permissions via a `capabilities` JSONB on the position table. For now, title-based matching is sufficient.

### Guard Design
- **D-03:** New `requirePosition(allowedTitles: string[])` utility following the existing `requireOfficerTerm` pattern — returns `Response | null` (not middleware that throws). Reuses `findActiveByPersonAndOrg()` which already returns `positionTitle` via JOIN.
- **D-04:** Multi-position handling: if a user holds multiple positions (e.g., both Treasurer and Secretary), access is granted if ANY of their active positions match the `allowedTitles` array.
- **D-05:** `requirePosition` calls `requireOfficerTerm` internally first (or reuses its logic) — no need to call both in handlers.

### Sidebar Filtering
- **D-06:** Filter at the data level, not the component level. The caller (officer layout/page) builds `navGroups` based on the user's positions from `/persons/me/officer-role/:orgId`. `AppSidebar` stays generic — it renders whatever `navGroups` it receives.
- **D-07:** Position-to-nav mapping lives in a single config object (e.g., `POSITION_NAV_CONFIG`) so it's easy to update in one place. President gets all nav groups.

### Position Matching
- **D-08:** Match by position title string, case-insensitive. Positions are seeded with known titles (President, Treasurer, Secretary, Society Officer).
- **D-09:** For v1, we don't need a `capabilities`/`permissions` enum — the 4 known titles are sufficient. Organizations that use non-standard titles (e.g., "Finance Officer" instead of "Treasurer") are a future-phase concern.

### Claude's Discretion
- Test organization and structure — follow Phase 12 test patterns
- Exact error messages for position-denied responses (should be similar to existing 403 patterns)
- Whether to create a shared constants file for position titles or inline them

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Plan & Requirements
- `docs/TDD-AUTH-PLAN.md` — Full TDD auth plan with position-based RBAC sections
- `docs/UAT-CHECKLIST.md` — 267 testable items including position-specific checks

### Phase 12 Context (predecessor)
- `.planning/phases/12-backend-auth-route-protection/12-CONTEXT.md` — Officer auth decisions, test patterns, middleware wiring approach

### Existing Guards (extend these patterns)
- `services/api-ts/src/utils/officer-check.ts` — `requireOfficerTerm()` pattern to follow for `requirePosition()`
- `services/api-ts/src/middleware/officer-auth.ts` — `officerAuthMiddleware()` route-level guard
- `services/api-ts/src/handlers/association:member/repos/governance.repo.ts` — `findActiveByPersonAndOrg()` already returns `positionTitle`

### Frontend Role Query
- `services/api-ts/src/handlers/association:member/getMyOfficerRole.ts` — Returns `{ isOfficer, positions[] }` to frontend

### Route Registration
- `services/api-ts/src/app.ts` — Hand-wired officer routes with `officerAuthMiddleware()`

### Seed Data
- `services/api-ts/src/seed.ts` — 4 positions (President, Treasurer, Secretary, Society Officer) with active officer terms

### Frontend Sidebar
- `apps/account/src/components/app-sidebar.tsx` — Generic `AppSidebar` accepting `navGroups` prop

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireOfficerTerm()` in `utils/officer-check.ts` — Clone and extend for position checking. Same `Response | null` pattern.
- `findActiveByPersonAndOrg()` in governance repo — Already JOINs position table and returns `positionTitle`. No schema changes needed.
- `getMyOfficerRole` handler — Frontend already gets position titles. Sidebar filtering can use this data directly.
- `AppSidebar` component — Accepts `navGroups[]` prop. Filtering happens upstream.

### Established Patterns
- Handler-level guards return `Response | null` (D-09 from Phase 12). `requirePosition` follows this.
- Route-level middleware (`officerAuthMiddleware`) throws `ForbiddenError`. Position check happens at handler level after this.
- Position title is a free-text `varchar(200)` on the `position` table. Matching is by string, not enum.

### Integration Points
- Each handler file in `association:operations/` and `association:member/` already calls `requireOfficerTerm()` — upgrade those calls to `requirePosition(['Treasurer'])` etc.
- Officer sidebar in the frontend needs position-aware nav group filtering
- `getMyOfficerRole` endpoint already returns position data — no backend changes needed for frontend sidebar filtering

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow Phase 12 patterns.

</specifics>

<deferred>
## Deferred Ideas

- Custom position titles per organization (e.g., "Finance Officer" mapping to Treasurer capabilities) — needs `capabilities` JSONB or position-type enum on position table
- Granular per-endpoint permissions beyond position groups
- Position hierarchy (e.g., Vice President inherits subset of President permissions)

</deferred>

---

*Phase: 13-Position-Based RBAC*
*Context gathered: 2026-05-08*
