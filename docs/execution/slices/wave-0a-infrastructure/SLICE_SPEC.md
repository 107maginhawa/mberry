---
slice: wave-0a-infrastructure
phase: wave-0
agent_skills: [oli-execution-gate]
priority: P0
status: complete
---

# Wave 0a: Infrastructure Foundation

## Goal

Establish shared infrastructure all subsequent module waves depend on: org slugs, org context provider, org switcher, and Account app deprecation.

## Acceptance Criteria

### AC-W0A-001: Slug Migration (expand-then-contract)
- [x] `slug` column added to organization table (varchar, nullable initially)
- [x] `slugify()` function creates URL-safe slugs from org names (`generateSlug`/`ensureUniqueSlug` in `utils/slug.ts`)
- [x] Backfill migration populates existing orgs with generated slugs
- [x] Collision resolution appends auto-suffix (`-2`, `-3`)
- [x] `NOT NULL` + `UNIQUE` constraint enforced after backfill
- [x] Slug generation tested in `createOrganization.test.ts`
- [x] Collision resolution tested via `ensureUniqueSlug` in `createOrganization.test.ts`

### AC-W0A-002: OrgProvider Upgrade
- [x] React Context Provider with `{ org, role, permissions, isOfficer }`
- [x] `useMyOrgs()` hook fetches memberships with orgSlug
- [x] OrgProvider unit tests (`OrgProvider.test.tsx`)
- [x] useMyOrgs unit tests (`useMyOrgs.test.ts`)

### AC-W0A-003: Org Switcher Icon Rail
- [x] Desktop: Slack-style vertical icon rail (`org-icon-rail.tsx`)
- [x] Mobile: bottom sheet picker (responsive breakpoint)
- [x] Icon rail unit test (`org-icon-rail.test.tsx`)

### AC-W0A-004: Account Merge/Deprecation
- [x] Auth routes moved to Memberry app (`routes/auth/`)
- [x] Shared AuthView component used by both apps

### AC-W0A-005: Public Org Endpoint
- [x] `GET /public/org/:slug` returns org profile
- [x] Cancelled orgs return 404
- [x] Active member count (BR-29)
- [x] Tests: input validation, happy path, cancelled org, response shape

### AC-W0A-006: Membership Response Cleanup
- [x] PII-adjacent fields removed from `getMyMemberships` response
- [x] orgSlug included in response
- [x] orgId alias maintained for backwards compat
- [x] Regression test: PII fields not exposed

### AC-W0A-007: getTraining Handler Tests
- [x] Tests target wired handler (association:operations), not dead code
- [x] Auth guard, org context, happy path, not found, cross-org attack tested

## Business Rules

| BR | Description | Status |
|----|------------|--------|
| BR-29 | Org Public Page — active member count, cancelled orgs hidden | COMPLETE |

## Dependencies
- None (foundation layer)

## Verification Commands
```bash
bun test services/api-ts/src/handlers/platformadmin/getOrganizationBySlug.test.ts
bun test services/api-ts/src/handlers/person/getMyMemberships.test.ts
bun test services/api-ts/src/handlers/association:operations/getTraining.test.ts
bun test services/api-ts/src/handlers/invite/
```
