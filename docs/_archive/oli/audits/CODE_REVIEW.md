# Code Review: Commit c770b44

**Commit:** `c770b44` — "fix: resolve all 32 test failures -- prototype pollution, mock.module poison, import paths"
**Reviewed:** 2026-05-19
**Reviewer:** Claude (adversarial review)
**Files Changed:** 33 (32 source, 1 documentation)
**Depth:** Standard + cross-file analysis on test infrastructure

---

## Summary

This commit fixes 32 test failures across 5 root causes:
1. Replace `mock.module('@/utils/officer-check')` with `stubRepo(OfficerTermRepository, ...)` to avoid Bun `mock.module` poisoning
2. Fix `stubRepo` prototype pollution by enhancing `restoreRepo` to delete foreign own-properties
3. Change `describe.todo` to `describe.skip` for integration tests needing a live server
4. Fix relative import paths in `br-edge-cases.test.ts` (`./` to `../`)
5. Fix PAY-02 logic in `listDuesPayments.ts` (officer omits personId for all-org queries)

The mock.module-to-stubRepo migration and the restoreRepo enhancement are sound directionally. The PAY-02 production fix is correct. However, the preload-pristine registry is incomplete, leaving the majority of stubbed repositories still vulnerable to the same cross-file pollution this commit aims to fix.

---

## Critical Issues

*None found.*

---

## Warnings

### WR-01: Incomplete preload-pristine registry -- 36+ repos still vulnerable to prototype pollution

**File:** `services/api-ts/src/test-utils/preload-pristine.ts:27-42`
**Issue:** The preload registers 14 repository classes, but `stubRepo()` is used across the codebase with ~50 distinct repository classes. High-traffic repos like `PersonRepository` (19 files), `EventsRepository` (12 files), `TrainingRepository` (11 files), `OrganizationRepository` (8 files), and `CreditEntryRepository` (7 files) are NOT preloaded. These remain vulnerable to the exact prototype pollution bug this commit fixes: the first `stubRepo()` call in a parallel test run captures an already-polluted prototype as "pristine," making all subsequent `restoreRepo()` calls restore to corrupted state.

**Fix:** Add all repository classes that are stubbed in 2+ test files to the preload list. At minimum:

```typescript
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { EventsRepository } from '@/handlers/events/repos/events.repo';
import { TrainingRepository } from '@/handlers/training/repos/training.repo';
import { OrganizationRepository, AssociationRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { AccreditedProviderRepository } from '@/handlers/training/repos/accredited-provider.repo';
// ... plus ~20 more
```

Or better: dynamically discover and register all repo classes at preload time.

---

### WR-02: `restoreRepo(PersonRepository)` in lifecycle.test.ts is a no-op without preload

**File:** `services/api-ts/src/handlers/billing/lifecycle.test.ts:123`
**Issue:** `restoreRepo(PersonRepository)` is called in `afterEach`, but `PersonRepository` is not in `preload-pristine.ts`. The `restoreRepo` function checks `pristinePrototypes.get(RepoClass)` -- if no entry exists (because neither preload nor a prior `stubRepo` in this file captured it), `restoreRepo` silently does nothing. This gives a false sense of cleanup. If `PersonRepository` is stubbed by another test file in the same worker BEFORE this file's `afterEach` runs, the pollution persists.

**Fix:** Add `PersonRepository` to `preload-pristine.ts`, or add a `beforeEach` that calls `restoreRepo(PersonRepository)` AFTER `ensurePristine` has been called (which happens automatically via the first `stubRepo` call -- but timing depends on test execution order).

---

### WR-03: createBookingEvent test no longer exercises slot generation path

**File:** `services/api-ts/src/handlers/booking/createBookingEvent.test.ts:59-63`
**Issue:** The old test mocked `regenerateEventSlots` as a no-op, so the handler's full path was tested with slot generation stubbed. The new test stubs `BookingEventRepository.findOneById` to return `null`, which makes `regenerateEventSlots` hit an early-exit branch (`event not found -> return`). This means the test now exercises a path where slot generation silently fails (event not found after just being created). The handler at line 50 calls `regenerateEventSlots(db, event.id)` right after `createWithSmartDefaults` returns the event -- in production, `findOneById` would find the event. The test now covers an impossible production scenario (event exists per `createWithSmartDefaults` but not found by `findOneById`).

The test still verifies the 201 response, but the slot generation behavior is now untested in unit tests.

**Fix:** Stub `BookingEventRepository.findOneById` to return the event (matching what `createWithSmartDefaults` returns), and also stub `TimeSlotRepository` and `ScheduleExceptionRepository` methods that `regenerateEventSlots` calls. Or, accept the current approach but add a comment explaining that slot generation is tested elsewhere (integration/E2E).

---

### WR-04: Redundant restore in both beforeEach and afterEach

**File:** Multiple files (e.g., `dues-mutation-auth.test.ts:58-64`, `getDuesFinancialDashboard.test.ts:30-37`, `markDuesInvoicePaid.test.ts:40-48`)
**Issue:** Many test files now call `restoreRepo(OfficerTermRepository)` in BOTH `beforeEach` and `afterEach`. The `beforeEach` restore is the critical one (ensures clean state before each test). The `afterEach` restore is redundant when `beforeEach` runs before the next test. The duplication is not a bug, but it is noise that makes the cleanup contract unclear -- readers can't tell which call is load-bearing.

**Fix:** Standardize on `beforeEach`-only for restore, `afterEach` for teardown of test-specific state. Document the convention.

---

### WR-05: `listRosterMembers.test.ts` does not restore MembershipRepository

**File:** `services/api-ts/src/handlers/association:member/listRosterMembers.test.ts:204-206`
**Issue:** The `afterEach` only restores `OfficerTermRepository`, but `MembershipRepository` is also imported and may be stubbed elsewhere in the same worker. The `beforeEach` at line 198 stubs `OfficerTermRepository` but the `MembershipRepository` stub setup (if any) in the `describe` block's test cases could leak to other tests. The old code had a comment "repos are auto-restored because stubRepo patches the prototype" which was identified as incorrect -- but the fix only added `restoreRepo(OfficerTermRepository)` without also adding `restoreRepo(MembershipRepository)`.

**Fix:**
```typescript
afterEach(() => {
  restoreRepo(OfficerTermRepository);
  restoreRepo(MembershipRepository);
});
```

---

### WR-06: PAY-02 behavior change -- officer with no personId now returns ALL org payments

**File:** `services/api-ts/src/handlers/association:member/listDuesPayments.ts:29-30`
**Issue:** The old code defaulted to `session.user.id` when an officer omitted `personId` (line 29 was `query.personId ?? session.user.id`). The new code defaults to `undefined`, meaning the query returns ALL payments for the entire org. This is a deliberate behavior change (the test at line 171 confirms it), but it changes the API contract: a previously-scoped response now returns potentially thousands of records by default. If any frontend code relies on the old behavior (officer sees own payments when personId not specified), it will break.

This is not a bug per se (the new behavior is arguably more correct for officers), but it is a **breaking API change** that should be called out in release notes.

**Fix:** Confirm no frontend code depends on the old behavior. If uncertain, add a `scope=self|org` query param to make the intent explicit.

---

## Info

### IN-01: `describe.todo` to `describe.skip` -- semantic difference

**Files:** `audit-integration.test.ts:19`, `email-integration.test.ts:19`, `position-rbac.test.ts:17`, `route-protection-association.test.ts:53`, `route-protection-idor.test.ts:26`, `seed-users.test.ts:6`
**Issue:** `describe.todo` signals "not yet implemented" while `describe.skip` signals "implemented but intentionally not run." These integration tests exist and are complete -- they just need a live server. `describe.skip` is the correct semantic choice here. This is a correct fix.

### IN-02: Old `let mocks` + `mockRestore()` pattern coexists with new `restoreRepo` pattern

**Files:** `lifecycle.test.ts:120-127`, `getElection.test.ts`, `listElections.test.ts`, `updateElectionStatus.test.ts`, `createBookingEvent.test.ts`
**Issue:** Several files now call BOTH `restoreRepo()` (new pattern) and `mocks.forEach(m => m.mockRestore())` (old pattern). The old pattern is now redundant since `restoreRepo` fully resets the prototype. The dead code creates confusion about which cleanup mechanism is authoritative.

**Fix:** Remove the `mockRestore()` calls in files that also use `restoreRepo()`. Migrate fully to the `restoreRepo` pattern.

### IN-03: Smoke test uses hardcoded localhost URL

**File:** `services/api-ts/src/tests/smoke.test.ts:13`
**Issue:** `const API_URL = process.env['API_URL'] || 'http://localhost:7213';` -- The fallback port 7213 is hardcoded. If the API port changes in config, this test will silently skip (via `API_AVAILABLE` check) rather than fail. Low risk since the env var override exists.

### IN-04: Documentation audit numbers may be inflated

**File:** `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md`
**Issue:** The audit doc claims "4,296 total assertions across 21 handler modules" and was updated as part of this commit. Since this commit primarily fixes test infrastructure (not adding new assertions), the assertion count increase from ~3,200 to 4,296 is suspicious -- it may reflect a recount methodology change rather than actual new assertions. Not a code issue, but could mislead stakeholders.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (adversarial review)_
_Depth: Standard + cross-file_
