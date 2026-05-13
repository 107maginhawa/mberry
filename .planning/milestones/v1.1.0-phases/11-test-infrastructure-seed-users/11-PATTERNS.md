# Phase 11: Test Infrastructure & Seed Users - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/api-ts/src/seed.ts` | config (seed) | request-response + CRUD | Self (existing file) | exact |
| `services/api-ts/src/tests/helpers/api-as.ts` | utility (test helper) | request-response | `services/api-ts/src/seed.ts` (signUpUser + extractSessionCookie) | role-match |
| `services/api-ts/src/tests/helpers/api-as.test.ts` | test | request-response | `services/api-ts/src/middleware/custom-routes-auth.test.ts` | role-match |
| `services/api-ts/src/tests/seed-users.test.ts` | test (integration) | request-response | `services/api-ts/src/middleware/custom-routes-auth.test.ts` | role-match |
| `apps/memberry/tests/e2e/helpers/test-config.ts` | config (test constants) | N/A | Self (existing file) | exact |

## Pattern Assignments

### `services/api-ts/src/seed.ts` (modify -- add 3 officer users + positions + terms)

**Analog:** Self -- extend existing patterns in place.

**TEST_USERS array pattern** (lines 24-45):
```typescript
const TEST_USERS = [
  {
    email: 'test@memberry.ph',
    password: 'TestPass123!',
    name: 'Maria Santos',
    firstName: 'Maria',
    lastName: 'Santos',
    specialization: 'Orthodontics',
    licenseNumber: '0012345',
    dbRole: 'admin,association:admin,association:member',
  },
  {
    email: 'member@memberry.ph',
    password: 'TestPass123!',
    name: 'Juan Cruz',
    firstName: 'Juan',
    lastName: 'Cruz',
    specialization: 'General Dentistry',
    licenseNumber: '0067890',
    dbRole: 'association:member',
  },
];
```

**User creation loop pattern** (lines 257-292):
```typescript
for (const user of TEST_USERS) {
  const auth = await signUpUser(user.email, user.password, user.name);
  if (!auth) { console.log(`  ... Skipping ${user.email}`); continue; }
  userRecords.push({ userId: auth.userId, email: user.email, name: user.name });

  const personId = await createPerson(auth.cookie, { ... });
  if (personId) {
    personIds.push(personId);
  } else {
    // Fallback: look up existing person by auth user ID
    const existing = await db.select().from(persons).where(eq(persons.id, auth.userId)).limit(1);
    if (existing.length > 0) personIds.push(existing[0]!.id);
  }

  // Assign roles AFTER person creation
  await db.update(userTable).set({ role: user.dbRole }).where(eq(userTable.email, user.email));
}
```

**Position + officer term creation pattern** (lines 320-344):
```typescript
if (personIds.length > 0) {
  const existingPositions = await db.select().from(positions).where(eq(positions.organizationId, org1.id));

  if (existingPositions.length === 0) {
    const [presidentPos] = await db.insert(positions).values({
      organizationId: org1.id,
      title: 'President',
      description: 'Association President',
      level: 'chapter',
      termLengthMonths: 24,
      sortOrder: 1,
    }).returning();

    await db.insert(officerTerms).values({
      positionId: presidentPos!.id,
      personId: personIds[0]!,
      organizationId: org1.id,
      status: 'active',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
    });
  }
}
```

**Key modification:** Extend the position block (lines 320-344) to create 4 positions (President, Treasurer, Secretary, Society Officer) and 4 officer_terms mapping each to its designated test user. Use a `personIdMap: Map<email, personId>` built during the user creation loop to link correctly.

---

### `services/api-ts/src/tests/helpers/api-as.ts` (new -- authenticated API test helper)

**Analog:** `services/api-ts/src/seed.ts` functions `signUpUser()` (lines 47-79) and `extractSessionCookie()` (lines 82-91)

**Sign-in + cookie extraction pattern** (seed.ts lines 54-67):
```typescript
const signIn = await fetch(`${API_URL}/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!signIn.ok) {
  throw new Error(`Sign-in failed for ${email}: ${signIn.status}`);
}
const cookie = extractSessionCookie(signIn);
```

**Cookie extraction pattern** (seed.ts lines 82-91):
```typescript
function extractSessionCookie(res: Response): string {
  const cookies: string[] = [];
  const setCookies = (res.headers as any).getSetCookie?.() ?? [res.headers.get('set-cookie') || ''];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) cookies.push(match[1]!);
  }
  return cookies.join('; ');
}
```

**Return shape:** Return an object with `get`, `post`, `put`, `patch`, `delete` methods that auto-attach the session cookie. Each method wraps `fetch()` with the `Cookie` header set.

---

### `services/api-ts/src/tests/helpers/api-as.test.ts` (new -- unit test for apiAs helper)

**Analog:** `services/api-ts/src/middleware/custom-routes-auth.test.ts`

**Bun test imports pattern** (line 15):
```typescript
import { describe, test, expect } from 'bun:test';
```

**Test structure pattern** (lines 70-93):
```typescript
describe('Custom module routes auth protection', () => {
  const app = makeProtectedApp();

  for (const route of protectedRoutes) {
    test(`${route.module}: ${route.method} ${route.path} returns 401 without auth`, async () => {
      const req = new Request(`http://localhost${route.path}`, { method: route.method });
      const res = await app.request(req);
      expect(res.status).toBe(401);
    });
  }
});
```

**Note:** This test requires a running API server. It should verify: (1) `apiAs('test@memberry.ph')` returns an object with `get`/`post` methods, (2) `apiAs('test@memberry.ph').get('/persons/me')` returns 200, (3) `apiAs('nonexistent@test.com')` throws.

---

### `services/api-ts/src/tests/seed-users.test.ts` (new -- integration test verifying seed data)

**Analog:** `services/api-ts/src/middleware/custom-routes-auth.test.ts`

**Bun test imports pattern** (line 15):
```typescript
import { describe, test, expect } from 'bun:test';
```

**Integration test pattern** -- this file tests against the running API server, not a mock Hono app. Pattern to follow:

```typescript
import { describe, test, expect } from 'bun:test';
// Import apiAs helper once it exists
import { apiAs } from './helpers/api-as';

const API_URL = process.env['API_URL'] || 'http://localhost:7213';

describe('Seed users', () => {
  test('all 5 users can sign in', async () => {
    const emails = [
      'test@memberry.ph',
      'member@memberry.ph',
      'treasurer@memberry.ph',
      'secretary@memberry.ph',
      'society@memberry.ph',
    ];
    for (const email of emails) {
      const client = await apiAs(email);
      const res = await client.get('/persons/me');
      expect(res.status).toBe(200);
    }
  });
});
```

---

### `apps/memberry/tests/e2e/helpers/test-config.ts` (modify -- add 3 officer email constants)

**Analog:** Self -- extend existing pattern.

**Current pattern** (entire file, lines 1-4):
```typescript
export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:7213'
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'TestPass123!'
export const SEED_OFFICER_EMAIL = process.env.SEED_OFFICER_EMAIL ?? 'test@memberry.ph'
export const SEED_MEMBER_EMAIL = process.env.SEED_MEMBER_EMAIL ?? 'member@memberry.ph'
```

**Add 3 new constants** following same `process.env.VAR ?? 'default'` pattern:
```typescript
export const SEED_TREASURER_EMAIL = process.env.SEED_TREASURER_EMAIL ?? 'treasurer@memberry.ph'
export const SEED_SECRETARY_EMAIL = process.env.SEED_SECRETARY_EMAIL ?? 'secretary@memberry.ph'
export const SEED_SOCIETY_EMAIL = process.env.SEED_SOCIETY_EMAIL ?? 'society@memberry.ph'
```

---

## Shared Patterns

### Authentication (Sign-in via Better-Auth)
**Source:** `services/api-ts/src/seed.ts` lines 47-91
**Apply to:** `api-as.ts` helper, `seed-users.test.ts`

The project authenticates programmatically via `POST /auth/sign-in/email` with JSON body `{ email, password }`. Session is extracted from `set-cookie` response headers using `getSetCookie()` (Bun-specific). All subsequent requests attach the cookie via `Cookie` header.

### Idempotent Seed Guards
**Source:** `services/api-ts/src/seed.ts` lines 321-323
**Apply to:** `seed.ts` modifications (position + officer_term inserts)

```typescript
const existingPositions = await db.select().from(positions).where(eq(positions.organizationId, org1.id));
if (existingPositions.length === 0) {
  // ... insert positions and terms
}
```

All seed inserts check for existing data first. The sign-up function handles 409 (duplicate) by falling back to sign-in.

### Bun Test Structure
**Source:** `services/api-ts/src/middleware/custom-routes-auth.test.ts` lines 15, 70-93
**Apply to:** All new test files

```typescript
import { describe, test, expect } from 'bun:test';

describe('Feature name', () => {
  test('specific behavior', async () => {
    // ...
    expect(result).toBe(expected);
  });
});
```

### DB Schema Imports for Seed
**Source:** `services/api-ts/src/seed.ts` lines 14-18
**Apply to:** `seed.ts` (already imported, no changes needed)

```typescript
import { positions, officerTerms } from './handlers/association:member/repos/governance.schema';
import { persons } from './handlers/person/repos/person.schema';
import { user as userTable } from './generated/better-auth/schema';
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| -- | -- | -- | All files have strong analogs in the existing codebase |

## Metadata

**Analog search scope:** `services/api-ts/src/`, `apps/memberry/tests/e2e/helpers/`
**Files scanned:** ~90 test files + 3 seed files + 2 E2E helpers
**Pattern extraction date:** 2026-05-08
