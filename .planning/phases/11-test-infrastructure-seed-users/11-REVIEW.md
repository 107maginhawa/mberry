---
phase: 11
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/memberry/tests/e2e/helpers/test-config.ts
  - services/api-ts/src/seed.ts
  - services/api-ts/src/tests/helpers/api-as.ts
  - services/api-ts/src/tests/helpers/api-as.test.ts
  - services/api-ts/src/tests/seed-users.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 11 added 3 new seed officer users, an `apiAs()` authenticated test helper, and verification tests. The code is generally coherent and idempotent-safe. However: plaintext test credentials are hardcoded in seed.ts and leaked into console output; the seed script silently swallows person-lookup failures; the `apiAs` helper retains sessions in a per-test scope with no cleanup; and the seed-users test suite never actually verifies officer terms or role restrictions — the "role assignment" tests only check that a 200 is returned from `/persons/me`, providing false coverage confidence.

---

## Critical Issues

### CR-01: Plaintext passwords hardcoded in seed.ts and printed to stdout

**File:** `services/api-ts/src/seed.ts:27,413-438`
**Issue:** `TestPass123!` is hardcoded as the literal password for every seed user in the `TEST_USERS` array (lines 27–74) and then printed verbatim in the summary banner (lines 413–438). Even though these are test-only credentials, the summary banner runs every time the seed script executes in any environment — including CI pipelines that publish logs to artifact stores or third-party services. If CI log retention is broad, secrets are permanently exposed in logs. Additionally, if the seed script is run against a staging/production database by mistake (nothing in the script prevents this), real accounts will be created with this well-known password.

**Fix:**
1. Read the password from an env var with no in-code default: `const TEST_PASSWORD = process.env['TEST_PASSWORD'];` — abort if unset.
2. Redact the password from the summary banner: print `Password: ****` or omit it entirely.
3. Add a guard at the top of `seed()` that rejects execution when `NODE_ENV === 'production'` or `DATABASE_URL` contains a production hostname pattern.

```typescript
// At the top of seed()
if (process.env['NODE_ENV'] === 'production') {
  console.error('Seed script must not run in production.');
  process.exit(1);
}
const TEST_PASSWORD = process.env['TEST_PASSWORD'];
if (!TEST_PASSWORD) {
  console.error('TEST_PASSWORD env var is required');
  process.exit(1);
}
```

---

## Warnings

### WR-01: Tier idempotency check uses positional index — wrong tier can be silently assigned

**File:** `services/api-ts/src/seed.ts:230-232`
**Issue:** When tiers already exist (`existingTiers.length >= 2`), `regularTier` falls back to `existingTiers[0]` if no tier with `code === 'REGULAR'` is found, and `associateTier` falls back to `existingTiers[1]`. If a different tier was inserted first (e.g., a manual migration), the wrong tier is assigned to all memberships on subsequent re-seeds with no warning.

```typescript
regularTier = existingTiers.find((t: any) => t.code === 'REGULAR') || existingTiers[0];
associateTier = existingTiers.find((t: any) => t.code === 'ASSOCIATE') || existingTiers[1];
```

**Fix:** Throw (or at minimum `console.warn`) when the expected codes are not found rather than silently falling back:

```typescript
regularTier = existingTiers.find((t: any) => t.code === 'REGULAR');
associateTier = existingTiers.find((t: any) => t.code === 'ASSOCIATE');
if (!regularTier || !associateTier) {
  throw new Error('Expected REGULAR and ASSOCIATE tiers not found. Manual intervention required.');
}
```

### WR-02: Person lookup fallback uses auth userId as person id — assumption may be wrong

**File:** `services/api-ts/src/seed.ts:311-317`
**Issue:** When `createPerson` fails (e.g., 409 conflict on re-seed), the script falls back to querying `persons` where `persons.id === auth.userId`. This assumes the person record's primary key equals the Better-Auth user ID. If the person schema uses its own UUID (which is the common pattern for normalized PII tables), this query will return 0 rows silently and `personIdMap` will be missing the entry. Downstream, officer term insertion is skipped without any error.

**Fix:** Look up the existing person by a reliable key (e.g., join via `users.email` → membership link, or store `personId` on the user record), and surface a warning when the person cannot be found:

```typescript
// After createPerson returns null, query by user's auth id or a known FK
const existing = await db.select().from(persons)
  .where(eq(persons.authUserId, auth.userId))  // use correct FK column
  .limit(1);
if (existing.length === 0) {
  console.warn(`  ⚠ Could not locate existing person for ${user.email} — officer term will be skipped`);
}
```

### WR-03: apiAs() cookie extraction silently returns empty string on failure

**File:** `services/api-ts/src/tests/helpers/api-as.ts:33-39`
**Issue:** If `getSetCookie()` returns no values and `get('set-cookie')` also returns null/empty, the fallback is `['']`. The cookie regex `^([^=]+=[^;]+)` won't match an empty string, so `cookie` ends up as `''`. All subsequent requests silently send no credentials. The caller sees `apiAs()` resolve successfully, calls methods, and gets unexpected 401s with no indication that authentication state was never captured.

**Fix:** Assert the cookie is non-empty before returning:

```typescript
const cookie = cookies.join('; ');
if (!cookie) {
  throw new Error(`Sign-in for ${email} succeeded (${res.status}) but no session cookie was returned`);
}
```

### WR-04: seed-users.test.ts "role assignment" tests do not verify roles — false coverage

**File:** `services/api-ts/src/tests/seed-users.test.ts:57-83`
**Issue:** The `describe('role assignments are correct')` block claims to verify that `member@memberry.ph` "is NOT an admin" and that the President "has admin role." However, every assertion in these tests is just `expect(res.status).toBe(200)` from `/persons/me` — an endpoint accessible to all authenticated users. The tests will pass even if every user has the wrong role, or if role assignment is completely broken. This gives false confidence that RBAC is correct.

**Fix:** Test role enforcement by hitting an admin-only endpoint:

```typescript
test('member@memberry.ph is NOT an admin', async () => {
  const client = await apiAs('member@memberry.ph');
  // An admin-only route should be forbidden
  const res = await client.get('/admin/platform-admins');  // or whatever the route is
  expect(res.status).toBe(403);
});

test('test@memberry.ph (President) has admin access', async () => {
  const client = await apiAs('test@memberry.ph');
  const res = await client.get('/admin/platform-admins');
  expect(res.status).toBe(200);
});
```

---

## Info

### IN-01: TEST_PASSWORD constant exported from test-config.ts is redundant with hardcoded value in api-as.ts

**File:** `apps/memberry/tests/e2e/helpers/test-config.ts:2` / `services/api-ts/src/tests/helpers/api-as.ts:11`
**Issue:** The password is defined in two separate places: `test-config.ts` exports `TEST_PASSWORD` for E2E tests, and `api-as.ts` hardcodes `DEFAULT_PASSWORD = 'TestPass123!'` independently. If the seed password changes, both files must be updated in sync. They already diverge in naming.

**Fix:** Have `api-as.ts` import from a shared config, or both read from the same env var: `process.env['TEST_PASSWORD'] ?? 'TestPass123!'`.

### IN-02: seed-users.test.ts officer term tests only verify session — position not verified at API level

**File:** `services/api-ts/src/tests/seed-users.test.ts:42-55`
**Issue:** The `describe('officer users have active officer terms')` block comment says "Officer position verification is at DB level via seed data." This means there is no API-level test that the officer terms are actually present and active. If the officer term insert silently fails (e.g., due to WR-02), these tests still pass.

**Fix:** Either add a DB-level check in the test (using drizzle directly) or add an API endpoint for listing officer terms and assert against it.

### IN-03: `any` casts throughout seed.ts and test files suppress type errors

**File:** `services/api-ts/src/seed.ts:95,106,153` and test files
**Issue:** Pervasive use of `as any` on API response bodies means TypeScript will not catch field name mismatches (e.g., `data.user?.id || data.id` guessing the response shape). A wrong field path silently produces `undefined`, which then propagates as the userId.

**Fix:** Define minimal response interfaces for the sign-in and person creation responses and use them instead of `as any`.

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
