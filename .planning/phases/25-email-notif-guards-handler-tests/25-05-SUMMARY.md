---
phase: 25-email-notif-guards-handler-tests
plan: 05
subsystem: api-ts
tags: [testing, unit-tests, notifs, platformadmin, documents, billing]
dependency_graph:
  requires: []
  provides: [notifs-handler-tests, platformadmin-handler-tests, documents-handler-tests, billing-handler-tests]
  affects: [EML-05]
tech_stack:
  added: []
  patterns: [makeCtx+stubRepo pattern, billing-ctx-helper pattern]
key_files:
  created:
    - services/api-ts/src/handlers/notifs/listNotifications.test.ts
    - services/api-ts/src/handlers/notifs/getNotification.test.ts
    - services/api-ts/src/handlers/notifs/markAllNotificationsAsRead.test.ts
    - services/api-ts/src/handlers/notifs/markAllNotificationsRead.test.ts
    - services/api-ts/src/handlers/platformadmin/getAdminRole.test.ts
    - services/api-ts/src/handlers/platformadmin/listAdmins.test.ts
    - services/api-ts/src/handlers/platformadmin/inviteAdmin.test.ts
    - services/api-ts/src/handlers/platformadmin/updateAdmin.test.ts
    - services/api-ts/src/handlers/platformadmin/revokeAdmin.test.ts
    - services/api-ts/src/handlers/platformadmin/listOrganizations.test.ts
    - services/api-ts/src/handlers/platformadmin/getOrganization.test.ts
    - services/api-ts/src/handlers/platformadmin/createOrganization.test.ts
    - services/api-ts/src/handlers/platformadmin/updateOrganization.test.ts
    - services/api-ts/src/handlers/platformadmin/listAssociations.test.ts
    - services/api-ts/src/handlers/platformadmin/getAssociation.test.ts
    - services/api-ts/src/handlers/platformadmin/createAssociation.test.ts
    - services/api-ts/src/handlers/platformadmin/updateAssociation.test.ts
    - services/api-ts/src/handlers/platformadmin/deleteAssociation.test.ts
    - services/api-ts/src/handlers/platformadmin/listFeatureFlags.test.ts
    - services/api-ts/src/handlers/platformadmin/setFeatureFlag.test.ts
    - services/api-ts/src/handlers/platformadmin/deleteFeatureFlag.test.ts
    - services/api-ts/src/handlers/documents/createDocument.test.ts
    - services/api-ts/src/handlers/documents/getDocument.test.ts
    - services/api-ts/src/handlers/documents/updateDocument.test.ts
    - services/api-ts/src/handlers/documents/deleteDocument.test.ts
    - services/api-ts/src/handlers/documents/searchDocuments.test.ts
    - services/api-ts/src/handlers/documents/archiveDocument.test.ts
    - services/api-ts/src/handlers/documents/getDocumentVersion.test.ts
    - services/api-ts/src/handlers/documents/listDocumentVersions.test.ts
    - services/api-ts/src/handlers/documents/uploadNewDocumentVersion.test.ts
    - services/api-ts/src/handlers/documents/getDocumentAccessLog.test.ts
    - services/api-ts/src/handlers/documents/createDocumentTag.test.ts
    - services/api-ts/src/handlers/documents/getDocumentTag.test.ts
    - services/api-ts/src/handlers/documents/listDocumentTags.test.ts
    - services/api-ts/src/handlers/documents/updateDocumentTag.test.ts
    - services/api-ts/src/handlers/documents/deleteDocumentTag.test.ts
    - services/api-ts/src/handlers/billing/getInvoice.test.ts
    - services/api-ts/src/handlers/billing/finalizeInvoice.test.ts
    - services/api-ts/src/handlers/billing/updateInvoice.test.ts
    - services/api-ts/src/handlers/billing/deleteInvoice.test.ts
    - services/api-ts/src/handlers/billing/markInvoiceUncollectible.test.ts
    - services/api-ts/src/handlers/billing/captureInvoicePayment.test.ts
    - services/api-ts/src/handlers/billing/refundInvoicePayment.test.ts
    - services/api-ts/src/handlers/billing/getMerchantAccount.test.ts
    - services/api-ts/src/handlers/billing/createMerchantAccount.test.ts
    - services/api-ts/src/handlers/billing/onboardMerchantAccount.test.ts
    - services/api-ts/src/handlers/billing/getMerchantDashboard.test.ts
  modified: []
decisions:
  - Notifs already fully covered by notifs-handlers.test.ts; created individual files as complementary tests (makeCtx pattern) per plan artifact requirement
  - Billing handlers using session.user (not ctx.get('user')) required a local makeBillingCtx helper in each test file
  - getMerchantAccount has no admin bypass — test updated to use isInternalExpand flag instead
  - markInvoiceUncollectible has no admin bypass — test updated to use merchant as caller
  - billing.repo.test.ts cross-test prototype pollution failures are pre-existing (verified via git stash)
metrics:
  duration: 85 minutes
  completed: 2026-05-14
  tasks_completed: 2
  files_created: 47
---

# Phase 25 Plan 05: Notifs + Platformadmin + Documents + Billing Handler Tests Summary

Unit test coverage for 47 handlers across notifs (4), platformadmin (17), documents (15), and billing (11) modules using makeCtx + stubRepo pattern with auth guards, happy paths, and error cases.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Notifs + platformadmin tests | f7f06ee | 21 test files |
| 2 | Documents + billing tests | b1c8235 | 26 test files |

## Test Results

| Module | New Files | Tests Added | Status |
|--------|-----------|-------------|--------|
| notifs | 4 | 16 | All pass |
| platformadmin | 17 | 53 | All pass |
| documents | 15 | 49 | All pass |
| billing | 11 | 35 | All pass |
| **Total** | **47** | **153** | **All pass** |

Full suite counts:
- notifs: 43 pass (including pre-existing tests)
- platformadmin: 139 pass (including pre-existing tests)
- documents: 117 pass (including pre-existing tests)
- billing (new files only): 35 pass, 0 fail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] billing.ctx pattern: handlers use session.user not ctx.get('user')**
- **Found during:** Task 2 (billing tests)
- **Issue:** Billing handlers read `const session = ctx.get('session') as Session; const user = session.user;` pattern, but makeCtx's default logger is null, causing `logger.debug` to throw TypeError
- **Fix:** Added `fakeLogger` + `makeBillingCtx` helper in each billing test file; passed `logger: fakeLogger` to all billing contexts
- **Files modified:** All 11 billing test files

**2. [Rule 1 - Bug] getMerchantAccount: no admin bypass**
- **Found during:** Task 2 (getMerchantAccount.test.ts)
- **Issue:** Test assumed admin could view any merchant account; handler only allows `personId === user.id` (no admin bypass)
- **Fix:** Updated test to use `isInternalExpand: true` to bypass auth (the documented escape hatch)
- **Files modified:** getMerchantAccount.test.ts

**3. [Rule 1 - Bug] markInvoiceUncollectible: no admin bypass**
- **Found during:** Task 2 (markInvoiceUncollectible.test.ts)
- **Issue:** Handler requires caller to be the merchant person; no admin bypass exists
- **Fix:** Updated test to use merchant user as authenticated caller
- **Files modified:** markInvoiceUncollectible.test.ts

**4. [Rule 1 - Bug] captureInvoicePayment: expects paymentStatus='requires_capture' not 'authorized'**
- **Found during:** Task 2 (captureInvoicePayment.test.ts)
- **Issue:** Handler checks `paymentStatus !== 'requires_capture'` (not 'authorized')
- **Fix:** Updated fixture paymentStatus and ConflictError trigger to use 'succeeded' (already-captured)
- **Files modified:** captureInvoicePayment.test.ts

**5. [Rule 1 - Bug] Various billing handlers need additional repo stubs**
- **Found during:** Task 2
- **Issue:** finalizeInvoice/updateInvoice call `findOneWithLineItems` after update; onboardMerchantAccount needs `getConnectAccountStatus`+`generateOnboardingLink`
- **Fix:** Added all required method stubs to each test's beforeEach
- **Files modified:** All affected billing test files

## Known Stubs

None — all handlers test auth + happy path with real business logic paths exercised.

## Pre-existing Issues (Not Introduced)

`billing.repo.test.ts` has 14 failures when run as part of full billing suite due to cross-test prototype pollution from other pre-existing test files (`lifecycle.test.ts`, `accessControl.test.ts`). Verified via `git stash` that these failures existed before this plan. Not related to new test files.

## Threat Flags

None — test-only plan, no production code changes.

## Self-Check: PASSED

- All 47 test files exist and contain `describe` blocks
- Commits f7f06ee and b1c8235 exist in git log
- 153 new tests pass, 0 fail (excluding pre-existing billing.repo failures)
