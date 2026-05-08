# Phase 13: Position-Based RBAC - Research

**Researched:** 2026-05-08
**Domain:** Authorization / RBAC / Hono handler-level guards
**Confidence:** HIGH

## Summary

Phase 13 upgrades the existing binary officer/non-officer access control to position-specific RBAC. Phase 12 established `requireOfficerTerm()` which answers "is this user ANY officer?" Phase 13 adds `requirePosition(allowedTitles)` which answers "is this user the RIGHT officer?"

The codebase is well-prepared for this upgrade. `findActiveByPersonAndOrg()` already JOINs positions and returns `positionTitle`. The existing `requireOfficerTerm()` pattern (return `Response | null`) is the exact template for `requirePosition()`. 27 handler files currently call `requireOfficerTerm()` — each needs upgrading to `requirePosition([...])` with the correct title(s) per the permission matrix. The frontend officer sidebar in `apps/memberry` is hardcoded with all nav sections visible to all officers — it needs position-aware filtering using the `officerPositions` already available in route context.

**Primary recommendation:** Create `requirePosition()` in `utils/officer-check.ts` alongside the existing function. Upgrade each handler's `requireOfficerTerm()` call to `requirePosition()` with position-specific titles. Filter officer sidebar nav groups using a `POSITION_NAV_CONFIG` mapping object.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Position-to-route mapping: President=all, Treasurer=dues/billing/payments, Secretary=roster/applications/announcements/communications, Society Officer=events/training/courses/credit compliance. Any officer gets shared read access to org profile and member list.
- **D-02:** v1 matrix only. Future phases can add `capabilities` JSONB on position table.
- **D-03:** New `requirePosition(allowedTitles: string[])` utility following `requireOfficerTerm` pattern — returns `Response | null`. Reuses `findActiveByPersonAndOrg()`.
- **D-04:** Multi-position: ANY matching position grants access.
- **D-05:** `requirePosition` calls `requireOfficerTerm` internally (or reuses its logic) — no need for both.
- **D-06:** Sidebar filtering at data level, not component level. `AppSidebar`/`OfficerSidebar` stays generic.
- **D-07:** Position-to-nav mapping in single config object (`POSITION_NAV_CONFIG`).
- **D-08:** Case-insensitive title matching.
- **D-09:** v1 uses 4 known titles, no capabilities enum.

### Claude's Discretion
- Test organization and structure — follow Phase 12 test patterns
- Exact error messages for position-denied responses (similar to existing 403 patterns)
- Whether to create a shared constants file for position titles or inline them

### Deferred Ideas (OUT OF SCOPE)
- Custom position titles per organization (e.g., "Finance Officer" mapping to Treasurer capabilities)
- Granular per-endpoint permissions beyond position groups
- Position hierarchy (e.g., Vice President inherits subset of President)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | RED: Position-specific API tests (Treasurer-only, President-only, Secretary-allowed) | Phase 12 test patterns (`route-protection-association.test.ts`), `apiAs()` helper, seeded officers with known positions |
| REQ-02 | GREEN: Create `requirePosition(positions[])` middleware | Existing `requireOfficerTerm()` pattern in `utils/officer-check.ts`, `findActiveByPersonAndOrg()` already returns `positionTitle` |
| REQ-03 | GREEN: Wire `requirePosition` to each route group per permission matrix | 27 handler files currently calling `requireOfficerTerm()`, plus hand-wired routes in `app.ts` |
| REQ-04 | GREEN: Update officer sidebar to filter nav by position | `OfficerSidebar` in `apps/memberry/src/components/layout/officer-sidebar.tsx`, `officerPositions` already in route context |
| REQ-05 | GREEN: Update `requireOrgOfficer` guard to pass position info to route context | Already done — `requireOrgOfficer` in `apps/memberry/src/utils/guards.ts` already returns `officerPositions` array |
| REQ-06 | Verify: Each role sees only their sections. Cross-position mutations blocked. | Test matrix from D-01 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Position-based access control (requirePosition) | API / Backend | -- | Authorization is server-side; never trust client |
| Permission matrix config | API / Backend | Frontend (sidebar filtering) | Backend enforces, frontend mirrors for UX |
| Sidebar nav filtering | Frontend (memberry app) | -- | UX concern; OfficerSidebar is in memberry app |
| Position data query | Database / Storage | API / Backend | JOINed via `findActiveByPersonAndOrg()` |

## Standard Stack

No new libraries needed. This phase uses existing stack exclusively.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | existing | API framework, handler/middleware | Already in use |
| Drizzle ORM | existing | DB queries for officer_term + position JOINs | Already in use |
| Bun test | existing | Unit/integration tests | Already in use |
| TanStack Router | existing | Route context, beforeLoad guards | Already in use |

**No `npm install` required.**

## Architecture Patterns

### System Architecture Diagram

```
Request -> authMiddleware -> orgContextMiddleware -> officerAuthMiddleware (route-level)
                                                         |
                                                         v
                                                    Handler Code
                                                         |
                                                    requirePosition(['Treasurer'])
                                                         |
                                                    findActiveByPersonAndOrg()
                                                         |
                                              ┌──────────┴──────────┐
                                              |                     |
                                         positionTitle         No match
                                         matches ANY?               |
                                              |                 403 Response
                                         null (proceed)
```

Frontend sidebar filtering:
```
/persons/me/officer-role/:orgId  ->  { positions: [{title: 'Treasurer'}, ...] }
                                              |
                                     POSITION_NAV_CONFIG lookup
                                              |
                                     filtered navGroups[]
                                              |
                                     OfficerSidebar renders
```

### Recommended Project Structure

No new files beyond:
```
services/api-ts/src/
├── utils/officer-check.ts          # ADD requirePosition() alongside existing requireOfficerTerm()
├── utils/position-titles.ts        # NEW: shared constants for 4 position titles
├── tests/
│   └── position-rbac.test.ts       # NEW: RED phase position-specific tests

apps/memberry/src/
├── config/position-nav.ts          # NEW: POSITION_NAV_CONFIG mapping
├── components/layout/
│   └── officer-sidebar.tsx          # MODIFY: accept positions prop, filter sections
```

### Pattern 1: requirePosition Guard

**What:** Handler-level guard that checks if user holds any of the allowed position titles. [VERIFIED: codebase grep of officer-check.ts]
**When to use:** Every handler that should be restricted to specific officer positions.

```typescript
// Source: Derived from existing requireOfficerTerm() in utils/officer-check.ts
import type { BaseContext } from '@/types/app';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function requirePosition(
  ctx: BaseContext,
  allowedTitles: string[]
): Promise<Response | null> {
  const user = ctx.get('user');
  if (!user) {
    return ctx.json({ error: 'Authentication required' }, 401);
  }

  const orgId = ctx.get('orgId');
  if (!orgId) {
    return ctx.json({ error: 'Organization context required' }, 403);
  }

  const db = ctx.get('database');
  const repo = new OfficerTermRepository(db);
  const terms = await repo.findActiveByPersonAndOrg(user.id, orgId);

  if (terms.length === 0) {
    return ctx.json({ error: 'Officer access required for this organization' }, 403);
  }

  // Case-insensitive match (D-08): ANY matching position grants access (D-04)
  const normalizedAllowed = allowedTitles.map(t => t.toLowerCase());
  const hasMatch = terms.some(t =>
    normalizedAllowed.includes((t.positionTitle as string).toLowerCase())
  );

  if (!hasMatch) {
    return ctx.json({ error: 'Position access denied. Required: ' + allowedTitles.join(', ') }, 403);
  }

  return null; // allowed
}
```

### Pattern 2: Handler Upgrade (requireOfficerTerm -> requirePosition)

**What:** Replace `requireOfficerTerm(ctx)` with `requirePosition(ctx, ['Treasurer'])` in each handler.

```typescript
// BEFORE (Phase 12):
const denied = await requireOfficerTerm(ctx);
if (denied) return denied;

// AFTER (Phase 13):
const denied = await requirePosition(ctx, ['Treasurer', 'President']);
if (denied) return denied;
```

### Pattern 3: POSITION_NAV_CONFIG (Frontend)

**What:** Single config object mapping position titles to allowed sidebar nav section labels. [VERIFIED: OfficerSidebar sections in officer-sidebar.tsx]

```typescript
// apps/memberry/src/config/position-nav.ts
export const POSITION_NAV_CONFIG: Record<string, string[]> = {
  'president': ['MEMBERS', 'FINANCES', 'ACTIVITIES', 'COMMUNICATIONS', 'GOVERNANCE', 'DOCUMENTS', 'SETTINGS'],
  'treasurer': ['FINANCES', 'DOCUMENTS'],
  'secretary': ['MEMBERS', 'COMMUNICATIONS'],
  'society officer': ['ACTIVITIES', 'DOCUMENTS'],
};

// Dashboard (unlabeled first section) is always visible to all officers.
// SETTINGS items like "Org Profile" are shared read — visible to all.
```

### Pattern 4: Sidebar Filtering in Officer Layout

**What:** Filter OfficerSidebar sections based on user's positions. [VERIFIED: officer.tsx route already has `officerPositions` in context]

```typescript
// In officer.tsx layout:
const positions = routeContext.officerPositions || [];
const positionTitles = positions.map(p => p.title.toLowerCase());

// Determine allowed nav sections
const allowedSections = new Set<string>();
// Dashboard always visible (no label)
allowedSections.add('');
for (const title of positionTitles) {
  const allowed = POSITION_NAV_CONFIG[title] || [];
  allowed.forEach(s => allowedSections.add(s));
}

// Pass filtered info to OfficerSidebar
```

### Anti-Patterns to Avoid
- **Client-side-only enforcement:** Never rely solely on sidebar hiding for security. Backend `requirePosition()` is the real guard; sidebar is UX convenience only.
- **Calling both requireOfficerTerm AND requirePosition:** Per D-05, `requirePosition` handles the officer check internally. Don't double-check.
- **Enum-based position matching:** Per D-09, use string matching not enums. Positions are free-text `varchar(200)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Officer term lookup | Custom SQL for position checking | `findActiveByPersonAndOrg()` | Already JOINs positions table, returns `positionTitle` |
| Session management | Custom auth cookies | Better-Auth via `authMiddleware()` | Already wired on all routes |
| Frontend guard | Custom position fetch | `requireOrgOfficer` guard | Already returns `officerPositions` array to route context |

## Common Pitfalls

### Pitfall 1: President Must Match ALL Routes
**What goes wrong:** Forgetting to include 'President' in every `requirePosition()` call.
**Why it happens:** D-01 says President = all officer endpoints (superset). Easy to miss one handler.
**How to avoid:** Always include 'President' in every `allowedTitles` array. Or have `requirePosition` automatically treat President as superuser.
**Warning signs:** President gets 403 on any officer endpoint.

### Pitfall 2: Case Sensitivity in Position Title Matching
**What goes wrong:** Seed data has "Society Officer" but code checks for "society officer".
**Why it happens:** Position titles are free-text varchar, not enums.
**How to avoid:** D-08 mandates case-insensitive matching. Normalize both sides with `.toLowerCase()`.
**Warning signs:** Position checks fail despite correct title in DB.

### Pitfall 3: Hand-Wired Routes in app.ts Also Need Position Checks
**What goes wrong:** Only upgrading handler files in `association:*` but forgetting hand-wired routes in `app.ts`.
**Why it happens:** app.ts has 7+ officer-protected routes (dues dashboard, membership, applications, org profile PUT, officer-terms, credit-compliance) that use `officerAuthMiddleware()` at route level. These need position-specific checks too.
**How to avoid:** Audit app.ts routes against permission matrix. Some may need handler-level `requirePosition()` calls inside the inline handlers, or extraction to proper handler files.
**Warning signs:** Treasurer can access Secretary-only hand-wired routes.

### Pitfall 4: Shared Read Access Routes
**What goes wrong:** Over-restricting routes that D-01 says are shared (org profile GET, member list GET).
**Why it happens:** Not differentiating between GET (shared) and PUT/POST (position-restricted).
**How to avoid:** D-01 specifies "Any officer: org profile (read), member list (read)". Only mutations need position restrictions. Read routes keep `requireOfficerTerm` (any officer).
**Warning signs:** Officers can't view basic org info or member list.

### Pitfall 5: OfficerSidebar Is in memberry App, Not account App
**What goes wrong:** Looking for officer-sidebar.tsx in `apps/account/`.
**Why it happens:** CONTEXT.md references "officer-sidebar.tsx" without specifying which app.
**How to avoid:** The officer sidebar and layout are in `apps/memberry/src/components/layout/officer-sidebar.tsx` and `apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx`.
**Warning signs:** Cannot find the file to modify.

## Code Examples

### Handler-to-Position Mapping (Complete)

Based on D-01 permission matrix and codebase grep of all `requireOfficerTerm` calls: [VERIFIED: grep of handlers]

**Treasurer + President routes:**
- `recordDuesPayment.ts` — POST dues payments
- `refundDuesPayment.ts` — refund payments
- `createDuesConfig.ts` — dues configuration
- `generateDuesInvoicesForOrg.ts` — generate invoices
- app.ts: `GET /dues/dashboard/:orgId` — dues dashboard
- app.ts: `GET /credit-compliance/:orgId` — credit compliance (could also be Society Officer)

**Secretary + President routes:**
- `addRosterMember.ts` — add member to roster
- `importRosterMembers.ts` — bulk import
- `approveMembershipApplication.ts` — approve applications
- `denyMembershipApplication.ts` — deny applications
- `createMembership.ts` — create membership
- `updateMembership.ts` — update membership
- `createAnnouncement.ts` — create announcement
- `publishAnnouncement.ts` — publish announcement
- app.ts: `GET /membership/members/:orgId` — member roster (READ = any officer)
- app.ts: `GET /membership/applications/:orgId` — applications (READ = any officer)

**Society Officer + President routes:**
- `createEvent.ts` / `updateEvent.ts` / `deleteEvent.ts` / `publishEvent.ts` / `cancelEvent.ts` — events
- `createCheckIn.ts` — event check-in
- `createTraining.ts` / `updateTraining.ts` / `deleteTraining.ts` / `publishTraining.ts` — training
- `createCourse.ts` / `updateCourse.ts` / `deleteCourse.ts` — courses

**President-only (governance) routes:**
- `createElection.ts` — create election
- `createOfficerTerm.ts` — create officer term
- `createPosition.ts` — create position
- `updateOrganizationProfile.ts` — update org profile

**Any officer (shared read) — KEEP requireOfficerTerm:**
- app.ts: `GET /membership/org-profile/:orgId` — org profile read
- app.ts: `GET /officer-terms/:orgId` — list officers

### Seeded Test Users [VERIFIED: seed.ts]

| Email | Position | Org |
|-------|----------|-----|
| test@memberry.ph | President | pda-metro-manila |
| treasurer@memberry.ph | Treasurer | pda-metro-manila |
| secretary@memberry.ph | Secretary | pda-metro-manila |
| society@memberry.ph | Society Officer | pda-metro-manila |
| member@memberry.ph | (none — regular member) | pda-metro-manila |
| idor-officer@memberry.ph | President | pda-cebu |

### Test Pattern (RED Phase)

```typescript
// Source: Derived from route-protection-association.test.ts pattern
import { describe, test, expect, beforeAll } from 'bun:test';
import { apiAs, type ApiClient } from '@/tests/helpers/api-as';

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

describe('Position-based RBAC - Treasurer restrictions', () => {
  let treasurerClient: ApiClient;

  beforeAll(async () => {
    treasurerClient = await apiAs('treasurer@memberry.ph');
  });

  test('Treasurer CANNOT create events (Society Officer domain)', async () => {
    const res = await treasurerClient.post(`/association/operations/events`, {
      organizationId: ORG_ID,
      title: 'Unauthorized event',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer CAN record dues payment', async () => {
    // This should succeed (200/201), not 403
    const res = await treasurerClient.post(`/association/member/dues-payments`, {
      organizationId: ORG_ID,
      membershipId: 'some-id',
      amount: 250000,
    });
    expect(res.status).not.toBe(403);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary officer check (Phase 12) | Position-specific RBAC (Phase 13) | This phase | Treasurer can't create events, Secretary can't record payments |
| All nav visible to all officers | Position-filtered sidebar | This phase | Officers see only relevant sections |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Credit compliance endpoint should be accessible to Society Officer (not just Treasurer) since it relates to training credits | Code Examples | Society Officer might be locked out of credit reports they need; easy to adjust in permission matrix |
| A2 | Dashboard (unlabeled first nav section) should be visible to ALL officers | Pattern 3 | Some officers might see an empty dashboard; low risk |
| A3 | The 7 hand-wired officer routes in app.ts can have position checks added as inline `requirePosition()` calls without extracting to separate handler files | Pitfall 3 | May need refactoring if inline handlers get too complex; medium risk |

## Open Questions

1. **Credit compliance endpoint ownership**
   - What we know: `/credit-compliance/:orgId` tracks training credit compliance. D-01 assigns Treasurer to "dues, billing, payment gateway" and Society Officer to "events, training, courses, credit compliance."
   - What's unclear: Should this be Society Officer + President only, or also Treasurer?
   - Recommendation: Assign to Society Officer + President per D-01. Treasurer focuses on financial matters.

2. **app.ts inline handler position checks**
   - What we know: 7+ routes in app.ts are inline handlers with `officerAuthMiddleware()`. Adding `requirePosition()` means calling it inside the inline async function.
   - What's unclear: Whether to extract these to proper handler files for cleaner architecture.
   - Recommendation: Add inline `requirePosition()` calls for v1 simplicity. Extraction is a future cleanup.

3. **TDD-AUTH-PLAN.md and UAT-CHECKLIST.md referenced but missing**
   - What we know: Both documents are referenced in ROADMAP and CONTEXT but do not exist in the repo.
   - What's unclear: Whether they were deleted or never created.
   - Recommendation: Derive test requirements from D-01 permission matrix and Phase 12 test patterns instead.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | none (Bun test uses bunfig.toml) |
| Quick run command | `cd services/api-ts && bun test src/tests/position-rbac.test.ts` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01a | Treasurer blocked from event/training endpoints | integration | `bun test src/tests/position-rbac.test.ts` | Wave 0 |
| REQ-01b | Secretary blocked from dues/payment endpoints | integration | `bun test src/tests/position-rbac.test.ts` | Wave 0 |
| REQ-01c | Society Officer blocked from roster/announcement endpoints | integration | `bun test src/tests/position-rbac.test.ts` | Wave 0 |
| REQ-01d | President can access ALL officer endpoints | integration | `bun test src/tests/position-rbac.test.ts` | Wave 0 |
| REQ-01e | Regular member still gets 403 on all officer endpoints | integration | `bun test src/tests/position-rbac.test.ts` | Wave 0 |
| REQ-02 | requirePosition returns 403 for wrong position, null for correct | unit | `bun test src/utils/officer-check.test.ts` | Wave 0 |
| REQ-04 | Sidebar shows only relevant sections per position | manual | Browse memberry app as each officer | N/A |

### Sampling Rate
- **Per task commit:** `bun test src/tests/position-rbac.test.ts`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `services/api-ts/src/tests/position-rbac.test.ts` -- RED phase position-specific tests
- [ ] `services/api-ts/src/utils/officer-check.test.ts` -- unit tests for requirePosition (if not already covered)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Already handled by Better-Auth (Phase 12) |
| V3 Session Management | no | Already handled by Better-Auth |
| V4 Access Control | **yes** | `requirePosition()` — role-based access at handler level |
| V5 Input Validation | no | No new user input in this phase |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns for Position-Based RBAC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via client-side nav manipulation | Elevation of Privilege | Server-side `requirePosition()` enforces regardless of frontend |
| Position title injection/spoofing | Tampering | Position titles come from DB (JOINed from position table), not user input |
| Missing position check on new endpoint | Elevation of Privilege | RED-phase tests catch missing guards before deployment |
| Case-sensitivity bypass | Tampering | D-08 mandates case-insensitive `.toLowerCase()` matching |

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/utils/officer-check.ts` — existing `requireOfficerTerm()` implementation [VERIFIED: Read tool]
- `services/api-ts/src/handlers/association:member/repos/governance.repo.ts` — `findActiveByPersonAndOrg()` with position JOIN [VERIFIED: Read tool]
- `services/api-ts/src/handlers/association:member/repos/governance.schema.ts` — position table schema (varchar title) [VERIFIED: Read tool]
- `services/api-ts/src/app.ts` — all hand-wired officer routes [VERIFIED: Read tool]
- `services/api-ts/src/seed.ts` — 4 seeded positions + officer terms [VERIFIED: Read tool]
- `apps/memberry/src/components/layout/officer-sidebar.tsx` — current hardcoded nav sections [VERIFIED: Read tool]
- `apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx` — officer layout with `officerPositions` context [VERIFIED: Read tool]
- `apps/memberry/src/utils/guards.ts` — `requireOrgOfficer` guard returning positions [VERIFIED: Read tool]
- `services/api-ts/src/tests/helpers/api-as.ts` — test helper for role-based API calls [VERIFIED: Read tool]
- Grep of all 27 handler files calling `requireOfficerTerm` [VERIFIED: Grep tool]

### Secondary (MEDIUM confidence)
- Phase 12 CONTEXT.md — predecessor patterns and decisions [VERIFIED: Read tool]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing
- Architecture: HIGH — extending proven patterns from Phase 12
- Pitfalls: HIGH — identified from direct codebase analysis
- Handler mapping: HIGH — complete grep of all requireOfficerTerm calls

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable — internal codebase patterns)
