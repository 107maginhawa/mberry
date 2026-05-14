---
phase: 25-email-notif-guards-handler-tests
plan: "04"
subsystem: handler-tests
tags: [testing, communication, person, unit-tests, auth-guards]
dependency_graph:
  requires: []
  provides: [communication-handler-tests, person-handler-tests]
  affects: [EML-05]
tech_stack:
  added: []
  patterns: [stubRepo/restoreRepo prototype patching, mockDb inline objects for direct-db handlers]
key_files:
  created:
    - services/api-ts/src/handlers/communication/createMessage.test.ts
    - services/api-ts/src/handlers/communication/getMessage.test.ts
    - services/api-ts/src/handlers/communication/deleteMessage.test.ts
    - services/api-ts/src/handlers/communication/updateMessage.test.ts
    - services/api-ts/src/handlers/communication/cancelMessage.test.ts
    - services/api-ts/src/handlers/communication/searchMessages.test.ts
    - services/api-ts/src/handlers/communication/scheduleMessage.test.ts
    - services/api-ts/src/handlers/communication/createAnnouncement.test.ts
    - services/api-ts/src/handlers/communication/getAnnouncement.test.ts
    - services/api-ts/src/handlers/communication/listAnnouncements.test.ts
    - services/api-ts/src/handlers/communication/updateAnnouncement.test.ts
    - services/api-ts/src/handlers/communication/deleteAnnouncement.test.ts
    - services/api-ts/src/handlers/communication/publishAnnouncement.test.ts
    - services/api-ts/src/handlers/communication/archiveAnnouncement.test.ts
    - services/api-ts/src/handlers/communication/createMessageTemplate.test.ts
    - services/api-ts/src/handlers/communication/getMessageTemplate.test.ts
    - services/api-ts/src/handlers/communication/updateMessageTemplate.test.ts
    - services/api-ts/src/handlers/communication/deleteMessageTemplate.test.ts
    - services/api-ts/src/handlers/communication/searchMessageTemplates.test.ts
    - services/api-ts/src/handlers/communication/previewMessageTemplate.test.ts
    - services/api-ts/src/handlers/communication/createSubscriptionTopic.test.ts
    - services/api-ts/src/handlers/communication/getSubscriptionTopic.test.ts
    - services/api-ts/src/handlers/communication/updateSubscriptionTopic.test.ts
    - services/api-ts/src/handlers/communication/deleteSubscriptionTopic.test.ts
    - services/api-ts/src/handlers/communication/listPersonSubscriptions.test.ts
    - services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.test.ts
    - services/api-ts/src/handlers/communication/updatePersonSubscription.test.ts
    - services/api-ts/src/handlers/person/listPersons.test.ts
    - services/api-ts/src/handlers/person/getPerson.test.ts
    - services/api-ts/src/handlers/person/updatePerson.test.ts
    - services/api-ts/src/handlers/person/updateMyProfile.test.ts
    - services/api-ts/src/handlers/person/getMyMemberships.test.ts
    - services/api-ts/src/handlers/person/getMyOfficerRole.test.ts
    - services/api-ts/src/handlers/person/createMyCreditEntry.test.ts
    - services/api-ts/src/handlers/person/listMyCreditEntries.test.ts
    - services/api-ts/src/handlers/person/getMyCreditSummary.test.ts
    - services/api-ts/src/handlers/person/exportMyData.test.ts
    - services/api-ts/src/handlers/person/getMyNotificationPreferences.test.ts
    - services/api-ts/src/handlers/person/updateMyNotificationPreferences.test.ts
    - services/api-ts/src/handlers/person/getNotificationPreferences.test.ts
    - services/api-ts/src/handlers/person/updateNotificationPreferences.test.ts
    - services/api-ts/src/handlers/person/getPrivacySettings.test.ts
    - services/api-ts/src/handlers/person/getMyPrivacySettings.test.ts
    - services/api-ts/src/handlers/person/updatePrivacySettings.test.ts
    - services/api-ts/src/handlers/person/updateMyPrivacySettings.test.ts
    - services/api-ts/src/handlers/person/requestMyAccountDeletion.test.ts
    - services/api-ts/src/handlers/person/cancelAccountDeletion.test.ts
    - services/api-ts/src/handlers/person/cancelMyAccountDeletion.test.ts
    - services/api-ts/src/handlers/person/executeAccountDeletion.test.ts
  modified: []
decisions:
  - "mockDb inline objects used for handlers that query db directly (no repo class) — avoids over-engineering"
  - "Per-handler test files created alongside existing combined test files — both coexist without conflict"
metrics:
  duration: ~15 minutes
  completed: "2026-05-13"
  tasks_completed: 2
  files_created: 49
---

# Phase 25 Plan 04: Communication + Person Handler Tests Summary

49 per-handler unit test files covering all previously untested communication (27) and person (22) handlers. EML-05 test coverage requirement satisfied for both modules.

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | Communication module tests (27 handlers) | 42eb8b6 | 178 pass |
| 2 | Person module tests (22 handlers) | 70ff377 | 124 pass |

**Total: 302 tests, 0 failures.**

## Test Coverage Pattern

Each file follows the canonical pattern:
- `restoreRepo` in `beforeEach` and `afterEach` (cross-file pollution prevention)
- Auth guard test (401 or throws Unauthorized)
- Org context guard test (403) where applicable
- Happy path with stubbed repos
- Business logic edge cases for stateful handlers (cancel/schedule/delete state guards)

## Handler Variation Notes

Two handler patterns required different mocking strategies:

**Repo-based handlers** (most): `stubRepo(RepoClass, { method: async () => ... })` — straightforward prototype patching.

**Direct-db handlers** (notification prefs, privacy settings, credit summary, memberships): These query `db.select().from().where()` directly without a repo class. Tested with inline `mockDb` objects that replicate the Drizzle query builder chain.

**Multi-repo handlers** (exportMyData): Stubs all 3 repos — `PersonRepository`, `MembershipRepository`, `CreditEntryRepository` — with `restoreRepo` for each in beforeEach/afterEach.

## Deviations from Plan

### Auto-fixed: Error message matching

**Found during:** Task 1 and Task 2 (test run)

`BusinessLogicError` is thrown with `(message, code)` — the `.toThrow()` matcher matches the human-readable message, not the code string. Fixed 5 test assertions to match actual error messages:
- `'MESSAGE_ALREADY_SENT'` → `'Cannot update a message that has already been sent'`
- `'MESSAGE_CANNOT_CANCEL'` → `'Cannot cancel a message with status'`
- `'MESSAGE_CANNOT_SCHEDULE'` → `'Cannot schedule a message with status'`
- `'DELETION_ALREADY_REQUESTED'` → `'Deletion already requested'`
- `'NO_DELETION_REQUEST'` → `'No pending deletion request'`

## Known Stubs

None. All tests verify real handler behavior with stubbed repos.

## Threat Flags

None. Test-only plan; no production attack surface introduced.

## Self-Check: PASSED

- 27 communication test files: FOUND
- 22 person test files: FOUND
- Commit 42eb8b6: FOUND
- Commit 70ff377: FOUND
- `bun test src/handlers/communication/` → 178 pass, 0 fail
- `bun test src/handlers/person/` → 124 pass, 0 fail
