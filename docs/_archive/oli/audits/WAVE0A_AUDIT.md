# Wave 0a Quality Audit

---
Audit Date: 2026-05-23
Scope: Wave 0a files only (T1-T5, T9)
Stack: TypeScript + Hono + Drizzle + Vite + TanStack Router
Commits: e417280..4c77347 (6 commits, 170 files, +10.6k lines)
---

## 1. Executive Summary

- **Overall health:** 6/10 — functional but has integration bugs, dead code, and zero frontend test coverage
- **Top risks:** UUID→slug redirect churn on every nav (P0), dead code handlers with misattributed tests (P1), fetch-then-check org isolation pattern (P1)
- **Immediate blockers:** None (app works), but P0 nav perf issue degrades UX noticeably
- **Test coverage:** 0/5 frontend components tested, 2/2 backend handlers have minimal tests

## 2. Findings by Severity

### P0 — Fix Immediately (2)

| ID | Finding | Impact | Fix |
|----|---------|--------|-----|
| P0-1 | **UUID passed as orgSlug in nav params.** Dashboard/My routes use `orgId` (UUID) in `params={{ orgSlug: orgId }}`. Route's `beforeLoad` detects UUID, calls API to resolve slug, redirects. Every org link click = extra round-trip. | UX feels sluggish, unnecessary API calls, silent failure on network error | Use `m.orgSlug` from membership data (already in response). Build `orgIdToSlug` map. Files: `dashboard.tsx:259,261,399,454,473`, `my/events.tsx:84`, `my/organizations.tsx:101` |
| P0-2 | **Duplicate `getMyMemberships` handlers.** `association:member/getMyMemberships.ts` is dead code (not wired). Missing `orgSlug` field, different auth pattern (`ctx.json` vs `throw`). Confuses developers, wrong one could get edited. | Developer confusion, divergent implementations | Delete `association:member/getMyMemberships.ts`. Only `person/getMyMemberships.ts` is wired. |

### P1 — Fix Before Wave 0b (5)

| ID | Finding | Impact | Fix |
|----|---------|--------|-----|
| P1-1 | **getTraining fetch-then-check org isolation.** `association:operations/getTraining.ts` calls `findOneById(trainingId)` globally, then checks `organizationId !== orgId`. TOCTOU pattern — data loaded before org check. | Cross-org data read into memory before guard. Info leak risk if error messages or future code access data pre-check. | Replace with `findOne({ id, organizationId })` scoped query. |
| P1-2 | **Tests validate dead code handlers.** `training/getTraining.test.ts` has 4 good tests (including cross-org attack) but tests the dead `training/getTraining.ts`, NOT the wired `association:operations/getTraining.ts`. False sense of security. | Wired handler has zero tests. Dead handler's tests pass, masking that live code is untested. | Port tests to `association:operations/`. Delete dead handler + test. |
| P1-3 | **Dead `training/getTraining.ts` has no auth.** No `user` or `session` check. No org isolation from session. If accidentally wired, critical vulnerability. | Dead code now, but dangerous trap if someone wires it. | Delete file. |
| P1-4 | **`useMyOrgs` uses `as any` (2 casts).** API response typed as `any`, field access untyped. Hides contract drift — `m.organizationId \|\| m.orgId` fallback chain masks API shape instability. | Type safety bypass. If API changes field names, silently returns undefined. No compile-time error. | Type the API response. Remove fallback chains. |
| P1-5 | **Silent error swallowing on membership fetch.** `useMyOrgs` query has no error handling. If `/persons/me/memberships` fails, `orgs` is empty array — OrgIconRail renders nothing, no error shown to user. | User sees empty org rail on network failure. No way to retry or understand what happened. | Add error state to useMyOrgs. Show error UI in OrgIconRail. |

### P2 — Fix in Current Wave (10)

| ID | Finding | Impact | Fix |
|----|---------|--------|-----|
| P2-1 | OrgProvider `orgId` is empty string `''` during loading | Child components may fire invalid API requests with empty orgId | Add loading guard, don't render children until orgId resolved |
| P2-2 | Slug redirect catches non-redirect errors silently | Network failures leave UUID in URL, page loads forever | Distinguish 404 vs network error in catch block |
| P2-3 | OrgProvider context value not memoized | New object ref each render = re-render all consumers | Wrap context value in `useMemo` |
| P2-4 | getTraining auth guard returns raw JSON, not `throw` | Bypasses error middleware logging/formatting | Use `throw new UnauthorizedError()` |
| P2-5 | No index on `membership.personId` standalone | `getMyMemberships` scans composite index inefficiently | Add `index('membership_person_idx').on(table.personId)` |
| P2-6 | `getMyMemberships` returns misleading `total` | `total: data.length` implies pagination, but query is unbounded | Remove `total` or add real pagination |
| P2-7 | AnimatePresence in `_authenticated.tsx` may destroy child state | Route transitions re-mount children, losing form state | Verify `mode="wait"` behavior with forms |
| P2-8 | OrgProvider fetches orgId via `orgSlug` but no validation | Path traversal unlikely but no UUID/slug format check | Validate orgSlug format before API call |
| P2-9 | Dashboard uses `orgId` (UUID) for `orgNames` map key | Mixes UUID keys with slug navigation targets | Use consistent identifiers |
| P2-10 | `association:member/getMyMemberships` auth pattern differs | Dead code uses `ctx.json(401)` instead of `throw` | Delete file (covered by P0-2) |

### P3 — Fix When Convenient (8)

| ID | Finding |
|----|---------|
| P3-1 | Cross-module imports: person handler imports from `association:member` and `platformadmin` schemas (coupling) |
| P3-2 | No logging/correlation IDs in either handler |
| P3-3 | `getMyMemberships` unbounded query (no LIMIT) — low risk, users rarely have >20 orgs |
| P3-4 | `_authenticated.tsx` officer route detection via string match (`routeId.includes("/officer")`) — fragile |
| P3-5 | OrgIconRail flashes absent-then-present on first load (no loading state) |
| P3-6 | Missing `aria-current` on mobile org picker sheet |
| P3-7 | No `staleTime` on membership query (re-fetches on every mount) |
| P3-8 | OrgPickerSheet receives props while OrgIconRail fetches internally (inconsistent data-fetching pattern) |

## 3. Test Coverage

### Frontend (0% — all NONE)

| Component | Lines | Test File | Assertion Quality | Risk |
|-----------|-------|-----------|-------------------|------|
| `useMyOrgs.ts` | 54 | — | NONE | HIGH |
| `OrgProvider.tsx` | 104 | — | NONE | HIGH |
| `org-icon-rail.tsx` | 110 | — | NONE | HIGH |
| `org-picker-sheet.tsx` | 136 | — | NONE | MEDIUM |
| `_authenticated.tsx` | 73 | — | NONE | MEDIUM |

### Backend (partial)

| Handler | Test File | Tests | Assertion Quality | Gap |
|---------|-----------|-------|-------------------|-----|
| `person/getMyMemberships.ts` | `getMyMemberships.test.ts` | 2 | WEAK (status check only) | Missing: empty result, multi-org, orgSlug presence, error cases |
| `association:operations/getTraining.ts` | — | 0 | NONE | All: happy path, cross-org isolation, auth, invalid ID |
| `training/getTraining.ts` (DEAD) | `getTraining.test.ts` | 4 | STRONG | Tests dead code — should port to wired handler |
| `association:member/getMyMemberships.ts` (DEAD) | — | 0 | NONE | Dead code — delete |

## 4. Dead Code Inventory

| File | Reason | Action |
|------|--------|--------|
| `services/api-ts/src/handlers/association:member/getMyMemberships.ts` | Not wired in routes, missing fields, weaker auth | DELETE |
| `services/api-ts/src/handlers/training/getTraining.ts` | Not wired, no auth, no org isolation | DELETE |
| `services/api-ts/src/handlers/training/getTraining.test.ts` | Tests dead handler above | PORT tests to `association:operations/`, then DELETE |

## 5. Migration Safety

| Migration | Safety | Notes |
|-----------|--------|-------|
| 0038: rename_terminated_to_removed | SAFE | Simple enum rename, no data loss |
| 0040: slug_backfill | SAFE (non-idempotent) | Generates slugs from org names. Re-running would create duplicates. Mitigated by migration journal. |
| 0041: slug_not_null | SAFE | Expand-then-contract. Correct pattern. |

## 6. Dependency Graph (Wave 0a)

```
_authenticated.tsx
  ├── OrgIconRail ← useMyOrgs ← GET /persons/me/memberships (person/getMyMemberships.ts)
  ├── MemberHeader
  ├── MemberSidebar
  └── MemberBottomNav

OrgProvider.tsx (wraps /org/$orgSlug/* routes)
  ├── GET /organizations/by-slug/$orgSlug (resolve org)
  └── GET /persons/me/officer-role/$orgId (check officer status)

OrgPickerSheet ← receives orgs as props (from parent using useMyOrgs)

Dashboard/My routes → params={{ orgSlug: orgId }} ← P0 BUG: passes UUID not slug
```

## 7. Recommended Fix Order

### Immediate (before Wave 0b)

1. **P0-1**: Fix UUID→slug in dashboard nav params (use `m.orgSlug`)
2. **P0-2 + P1-3**: Delete dead `association:member/getMyMemberships.ts` and `training/getTraining.ts`
3. **P1-2**: Port cross-org attack tests to `association:operations/getTraining.test.ts`
4. **P1-1**: Fix getTraining to use scoped query `findOne({ id, organizationId })`
5. **P1-4**: Type useMyOrgs API response, remove `as any`

### Write Tests

6. `useMyOrgs.test.ts` — mapped orgs, active org detection, empty/error states
7. `OrgProvider.test.tsx` — slug resolution, officer check, context value
8. `org-icon-rail.test.tsx` — render, active highlight, click nav
9. `association:operations/getTraining.test.ts` — happy path, cross-org guard, auth

### P2 Fixes (batch with tests)

10. Memoize OrgProvider context value
11. Add error boundary for slug redirect failures
12. Standardize getTraining auth to throw pattern

## 8. Health Score (Wave 0a scope only)

| Dimension | Score (0-10) | Notes |
|-----------|-------------|-------|
| API consistency | 5 | Duplicate handlers, inconsistent auth patterns |
| Business rule clarity | 7 | Guards exist but fetch-then-check pattern |
| Permission coverage | 6 | Auth present, but raw JSON returns bypass middleware |
| Frontend test coverage | 0 | Zero tests for all 5 components |
| Backend test coverage | 3 | 2 basic tests for wired handlers, 4 tests on dead code |
| Type safety | 5 | `as any` in hook, defensive field mapping |
| Error handling | 4 | Silent failures, swallowed errors, empty string states |
| Performance | 6 | UUID redirect churn, missing index, no memoization |
| Dead code hygiene | 3 | 3 dead files, one with misattributed tests |
| Security posture | 6 | Auth present, but TOCTOU org isolation pattern |

**Overall Wave 0a health: 4.5/10**

## 9. What's Next

- Fix P0s + P1s → run `/oli-confidence-stack` to score test confidence after fixes
- Write tests → run `/pre-commit` to verify
- Then proceed to Wave 0b (T6-T8)
