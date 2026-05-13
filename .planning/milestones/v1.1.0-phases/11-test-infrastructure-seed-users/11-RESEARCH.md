# Phase 11: Test Infrastructure & Seed Users - Research

**Researched:** 2026-05-08
**Domain:** Seed data, test helpers, auth infrastructure, Bun test + Playwright E2E
**Confidence:** HIGH

## Summary

Phase 11 establishes the test user foundation for all subsequent TDD phases (12-16) in the v1.1.0 Auth & Permission Enforcement milestone. The codebase already has 2 seed users (`test@memberry.ph` as President/admin, `member@memberry.ph` as regular member), positions/officer_terms infrastructure, and a working seed pipeline (`seed.ts` -> `seed-modules.ts` -> `seed-rich.ts`). Three new officer users (Treasurer, Secretary, Society Officer) must be added with their own auth accounts, person records, memberships, and officer_term records linked to existing positions.

The `apiAs(email)` test helper is net-new but follows an established pattern: the seed script already demonstrates programmatic sign-up/sign-in via Better-Auth's `/auth/sign-up/email` and `/auth/sign-in/email` endpoints, extracting session cookies. The E2E test config (`test-config.ts`) currently exports only 2 user constants and needs 3 more. The existing `officerAuthMiddleware` already queries `OfficerTermRepository.findActiveByPersonAndOrg()` -- Phase 12 will wire it to routes, but Phase 11 just ensures the data exists for those tests.

**Primary recommendation:** Add 3 officer users to `seed.ts`, their officer_term records to `seed.ts` (alongside existing President term), create `apiAs()` helper for API-level tests (Bun test), and extend E2E `test-config.ts` with new constants.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Seed user creation (auth) | API / Backend | -- | Better-Auth sign-up endpoint creates auth user |
| Seed person/membership records | Database / Storage | -- | Direct Drizzle inserts |
| Officer term records | Database / Storage | -- | Direct Drizzle inserts linking person -> position |
| `apiAs()` test helper | API / Backend | -- | Makes authenticated HTTP requests in Bun tests |
| E2E test config | Frontend Server (SSR) | -- | Playwright test constants |
| Verification (login works) | API / Backend | Frontend (E2E) | Both tiers verify |

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun test | built-in | API unit/integration tests | Project standard per CLAUDE.md |
| Playwright | project dep | E2E tests | Project standard |
| Better-Auth | project dep | Auth sign-up/sign-in | Creates auth users programmatically |
| Drizzle ORM | project dep | Direct DB inserts for seed data | Type-safe, SQL-injection-proof |
| Hono | project dep | API framework | For `apiAs()` helper HTTP calls |

No new dependencies needed for this phase.

## Architecture Patterns

### System Architecture Diagram

```
seed.ts (requires API running)
  |
  +--> POST /auth/sign-up/email  --> Better-Auth creates user record
  |     (for each of 5 users)        in `user` table
  |
  +--> POST /persons              --> Creates person record
  |     (with session cookie)         linked to auth user
  |
  +--> Direct DB: memberships     --> Links person to org
  |
  +--> Direct DB: positions       --> Creates Treasurer/Secretary/etc positions
  |
  +--> Direct DB: officer_terms   --> Links person to position in org
```

```
apiAs(email) helper (for Bun API tests)
  |
  +--> POST /auth/sign-in/email   --> Gets session cookie
  |
  +--> Returns fetch wrapper       --> All subsequent requests use cookie
       with cookie attached
```

### Existing Seed Pipeline

The project has a 3-stage seed pipeline. All 3 must be updated:

1. **`seed.ts`** -- Creates auth users via API, persons, memberships, positions, officer terms. **Requires API server running.** Currently creates 2 users + 1 position (President) + 1 officer term.

2. **`seed-modules.ts`** -- Module-specific data (dues config, events, training). Direct DB. No user changes needed.

3. **`seed-rich.ts`** -- 50+ memberships, 12 positions, 15+ officer terms. Direct DB. Creates positions for both orgs. **Already creates Treasurer/Secretary/etc positions** -- but assigns them to random seeded persons, not dedicated test users.

### Key Insight: seed-rich.ts Position Conflict

`seed-rich.ts` creates positions and officer terms for org1 if none exist (line 311-389). But `seed.ts` already creates a President position. The `seed-rich.ts` script checks `posCount > 0` and skips if positions already exist. This means:

- `seed.ts` creates 1 position (President) + 1 officer term for `test@memberry.ph`
- `seed-rich.ts` sees positions exist, skips creating more

**Resolution:** Phase 11 should add all needed positions (Treasurer, Secretary, Society Officer) directly in `seed.ts`, alongside the existing President position. The officer_term records for the 3 new users should also go in `seed.ts`.

### Pattern 1: User Seed Pattern (from existing seed.ts)

**What:** Create auth user + person + membership + officer term in seed.ts
**When to use:** Adding new test users

```typescript
// Source: services/api-ts/src/seed.ts (existing pattern)
const TEST_USERS = [
  // ... existing users ...
  {
    email: 'treasurer@memberry.ph',
    password: 'TestPass123!',
    name: 'Jose Reyes',
    firstName: 'Jose',
    lastName: 'Reyes',
    specialization: 'Prosthodontics',
    licenseNumber: '0054321',
    dbRole: 'association:member', // NOT admin -- just member with officer term
  },
];
```

[VERIFIED: services/api-ts/src/seed.ts lines 24-45]

### Pattern 2: apiAs() Helper Pattern

**What:** Authenticated API request helper for Bun tests
**When to use:** Testing role-based endpoint access

```typescript
// Recommended pattern based on seed.ts signUpUser() + extractSessionCookie()
export async function apiAs(email: string, password = 'TestPass123!') {
  const res = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status}`);
  
  const cookies: string[] = [];
  const setCookies = (res.headers as any).getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) cookies.push(match[1]!);
  }
  const cookie = cookies.join('; ');
  
  return {
    get: (path: string) => fetch(`${API_URL}${path}`, { headers: { Cookie: cookie } }),
    post: (path: string, body?: any) => fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    }),
    // ... put, patch, delete
  };
}
```

[VERIFIED: Pattern derived from seed.ts signUpUser() and extractSessionCookie() functions]

### Anti-Patterns to Avoid
- **Creating officer users with admin role:** The 3 new officer users must have `dbRole: 'association:member'`, NOT `admin`. Their officer status comes from `officer_term` records, not the user role field. Only `test@memberry.ph` should be admin. [VERIFIED: TDD-AUTH-PLAN.md specifies `association:member` role]
- **Skipping person creation:** Auth sign-up only creates a `user` record. A separate `POST /persons` call is needed to create the person record. Without it, officer_term foreign keys will fail. [VERIFIED: seed.ts lines 93-125]
- **Hardcoding org IDs:** Use the same org lookup pattern (`where slug = 'pda-metro-manila'`) as existing seed scripts. The org1 ID is `ed8e3a96-8126-4341-be42-e6eb7940c562` but should be looked up dynamically. [VERIFIED: seed.ts line 162]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth user creation | Manual DB insert into `user` table | Better-Auth `/auth/sign-up/email` | Better-Auth manages password hashing, session creation |
| Session cookie extraction | Custom cookie parsing | Existing `extractSessionCookie()` from seed.ts | Already handles Bun's `getSetCookie()` |
| Position/term schema | New tables | Existing `positions` + `officerTerms` tables | Already migrated, repos exist |

## Common Pitfalls

### Pitfall 1: Seed Order Dependency
**What goes wrong:** Running `seed-modules.ts` or `seed-rich.ts` before `seed.ts` fails because they depend on org + person records.
**Why it happens:** `seed.ts` requires the API server running; `seed-modules.ts` and `seed-rich.ts` are direct DB.
**How to avoid:** Document and enforce: `bun dev` first, then `bun run db:seed`, then `bun run db:seed-modules`, then `bun run db:seed-rich`.
**Warning signs:** "Run base seed first!" error messages.

### Pitfall 2: Person ID = Auth User ID
**What goes wrong:** Assuming person.id is different from auth user.id.
**Why it happens:** The seed script creates the person via API which links person.id to the auth user.id. The `officer_term.personId` must match.
**How to avoid:** After sign-up, use the returned `userId` as the `personId` for officer_term inserts.
**Warning signs:** Foreign key violations on officer_term inserts.

### Pitfall 3: Re-seed Idempotency
**What goes wrong:** Re-running seed fails with duplicate key errors.
**Why it happens:** `seed.ts` handles sign-up conflicts (409 -> sign-in) but position/term inserts may not be idempotent.
**How to avoid:** Use the existing pattern: check `existingPositions.length === 0` before inserting. [VERIFIED: seed.ts lines 321-345]
**Warning signs:** `duplicate key value violates unique constraint` errors.

### Pitfall 4: apiAs() Requires Running Server
**What goes wrong:** `apiAs()` tries to sign in via HTTP but API server isn't running.
**Why it happens:** Better-Auth sign-in is HTTP-only; no in-process bypass exists.
**How to avoid:** API tests using `apiAs()` need `bun dev` running or a test setup that boots the server. Consider adding setup instructions to test files.
**Warning signs:** `ECONNREFUSED` errors in test output.

## Code Examples

### Officer Term Seed (extends existing seed.ts pattern)

```typescript
// Source: Derived from seed.ts lines 319-345
// After all users are created and personIds collected:

const OFFICER_POSITIONS = [
  { title: 'President', email: 'test@memberry.ph' },
  { title: 'Treasurer', email: 'treasurer@memberry.ph' },
  { title: 'Secretary', email: 'secretary@memberry.ph' },
  { title: 'Society Officer', email: 'society@memberry.ph' },
];

const existingPositions = await db.select().from(positions)
  .where(eq(positions.organizationId, org1.id));

if (existingPositions.length === 0) {
  for (const pos of OFFICER_POSITIONS) {
    const [position] = await db.insert(positions).values({
      organizationId: org1.id,
      title: pos.title,
      description: `${pos.title} of PDA Metro Manila`,
      level: 'chapter',
      termLengthMonths: 24,
      sortOrder: OFFICER_POSITIONS.indexOf(pos),
    }).returning();

    const personId = personIdMap.get(pos.email);
    if (personId && position) {
      await db.insert(officerTerms).values({
        positionId: position.id,
        personId,
        organizationId: org1.id,
        status: 'active',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-12-31'),
      });
    }
  }
}
```

### E2E Test Config Update

```typescript
// Source: apps/memberry/tests/e2e/helpers/test-config.ts (extend existing)
export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:7213'
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'TestPass123!'
export const SEED_OFFICER_EMAIL = process.env.SEED_OFFICER_EMAIL ?? 'test@memberry.ph'
export const SEED_MEMBER_EMAIL = process.env.SEED_MEMBER_EMAIL ?? 'member@memberry.ph'
export const SEED_TREASURER_EMAIL = process.env.SEED_TREASURER_EMAIL ?? 'treasurer@memberry.ph'
export const SEED_SECRETARY_EMAIL = process.env.SEED_SECRETARY_EMAIL ?? 'secretary@memberry.ph'
export const SEED_SOCIETY_EMAIL = process.env.SEED_SOCIETY_EMAIL ?? 'society@memberry.ph'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2 test users (admin + member) | 5 test users (admin/president + member + 3 officers) | Phase 11 | Enables position-based RBAC testing |
| No `apiAs()` helper | Authenticated API request helper | Phase 11 | All Phase 12-16 backend tests depend on this |
| Officer auth = any authenticated user | Officer auth = officer_term lookup | Already exists in middleware | Phase 12 wires it; Phase 11 ensures data exists |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `apiAs()` should live in a shared test utility file under `services/api-ts/src/tests/` or similar | Architecture Patterns | Low -- file location is movable |
| A2 | Society Officer position title should be exactly "Society Officer" | Code Examples | Medium -- must match what Phase 13 `requirePosition()` checks against |
| A3 | All 3 new officer users should be members of org1 (pda-metro-manila) only, not org2 | Code Examples | Low -- cross-org tests in Phase 14 use different mechanism |

## Open Questions

1. **Society Officer exact position title**
   - What we know: TDD-AUTH-PLAN.md says "Society Officer position" for `society@memberry.ph`
   - What's unclear: Whether the position title should match seed-rich.ts "Public Relations Officer" or be a distinct "Society Officer"
   - Recommendation: Use "Society Officer" as specified in TDD-AUTH-PLAN.md. seed-rich.ts positions are for demo data, not test assertions.

2. **apiAs() location**
   - What we know: No existing helper exists. Backend tests use `bun:test`. E2E tests use Playwright.
   - What's unclear: Should `apiAs()` be a Bun test helper or also usable from Playwright tests?
   - Recommendation: Create for Bun tests at `services/api-ts/src/tests/helpers/api-as.ts`. E2E tests already have `signIn()` via Playwright page interactions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (API) | Bun test (built-in) |
| Framework (E2E) | Playwright |
| Config file (API) | `services/api-ts/bunfig.toml` |
| Config file (E2E) | `apps/memberry/playwright.config.ts` |
| Quick run command | `cd services/api-ts && bun test src/tests/` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P11-01 | 5 distinct seed users exist with correct roles | integration | `cd services/api-ts && bun test src/tests/seed-users.test.ts -x` | Wave 0 |
| P11-02 | 3 officer users have active officer_term records | integration | `cd services/api-ts && bun test src/tests/seed-users.test.ts -x` | Wave 0 |
| P11-03 | `apiAs(email)` helper authenticates and makes requests | unit | `cd services/api-ts && bun test src/tests/helpers/api-as.test.ts -x` | Wave 0 |
| P11-04 | All 5 users can login via API | integration | `cd services/api-ts && bun test src/tests/seed-users.test.ts -x` | Wave 0 |
| P11-05 | E2E test config exports all 5 user constants | static | Verified by TypeScript compilation | N/A |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun test src/tests/ -x`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** All seed user tests pass + `bun run db:seed` succeeds cleanly

### Wave 0 Gaps
- [ ] `services/api-ts/src/tests/seed-users.test.ts` -- covers P11-01, P11-02, P11-04
- [ ] `services/api-ts/src/tests/helpers/api-as.ts` -- the helper itself
- [ ] `services/api-ts/src/tests/helpers/api-as.test.ts` -- covers P11-03

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth (password hashing, session management) |
| V3 Session Management | yes | Better-Auth session cookies |
| V4 Access Control | yes | officer_term records define authorization |
| V5 Input Validation | no | No user input in seed scripts |
| V6 Cryptography | no | Handled by Better-Auth internally |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Test credentials in production | Information Disclosure | Seed scripts only run in dev; `TestPass123!` is not used in production |
| Officer role escalation via seed | Elevation of Privilege | Officer users get `association:member` role, NOT `admin`; authority comes from officer_term table only |

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/seed.ts` -- existing user creation pattern, sign-up flow, officer term creation
- `services/api-ts/src/seed-rich.ts` -- position titles, officer term structure, idempotency pattern
- `services/api-ts/src/handlers/association:member/repos/governance.schema.ts` -- positions + officerTerms table schema
- `services/api-ts/src/handlers/association:member/repos/governance.repo.ts` -- `findActiveByPersonAndOrg()` used by officer middleware
- `services/api-ts/src/middleware/officer-auth.ts` -- existing `officerAuthMiddleware()` implementation
- `services/api-ts/src/middleware/auth.ts` -- `authMiddleware()` role checking logic
- `apps/memberry/tests/e2e/helpers/test-config.ts` -- current test user constants
- `apps/memberry/tests/e2e/helpers/auth.ts` -- current E2E sign-in helper
- `docs/TDD-AUTH-PLAN.md` -- Phase 0 requirements, user specifications
- `docs/UAT-CHECKLIST.md` -- Test user table showing MISSING users

### Secondary (MEDIUM confidence)
- `services/api-ts/src/middleware/custom-routes-auth.test.ts` -- Bun test pattern for auth middleware testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools are already in the project
- Architecture: HIGH -- follows existing seed.ts patterns exactly
- Pitfalls: HIGH -- derived from reading actual seed code and understanding dependencies

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable -- seed infrastructure doesn't change fast)
