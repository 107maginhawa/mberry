# Step 13: Pattern Inconsistencies, Stubs, Type Safety & Coupling Audit

**Date:** 2026-05-20
**Scope:** `services/api-ts/src/`, `apps/*/src/`
**Excludes:** `node_modules/`, `generated/`

---

## 13. Pattern Inconsistencies

### 13.1 Error Handling Patterns

**Verdict: CONSISTENT** -- All handlers use the same custom error class hierarchy.

| Error Class | Usage Count | Pattern |
|---|---|---|
| `UnauthorizedError` | ~120 | `if (!session) throw new UnauthorizedError()` |
| `ValidationError` | ~30 | `throw new ValidationError('message')` |
| `NotFoundError` | ~25 | `throw new NotFoundError('Resource')` |
| `BusinessLogicError` | ~20 | `throw new BusinessLogicError('msg', 'CODE')` |
| `ForbiddenError` | ~10 | `throw new ForbiddenError()` |

No modules use raw `HTTPException` or Hono's built-in error types. All throw from `@/core/errors`. Consistent.

**P2 Finding:** 8 stub handlers in `association:member` contain commented-out error examples from the code generator template (5 commented `throw` lines each = 40 dead comment lines). Should be cleaned.

### 13.2 Service Layer vs Logic-in-Handlers

**Verdict: NO SERVICE LAYER EXISTS**

- Zero files named `*service*` or `*Service*` found in handlers.
- All business logic lives directly in handler functions.
- Complex logic is extracted to `utils/` directories (10 modules have them).
- `utils/` directories found in: `association:member`, `association:operations`, `booking`, `certificates`, `dues`, `email`, `events`, `invite`, `platformadmin`.
- `jobs/` directories found in: `audit`, `booking`, `dues`, `email`, `membership`, `notifs`, `person`.

**Assessment:** Pattern is Handler -> Repository with utils for shared logic. No service layer abstraction. This is intentional and consistent.

### 13.3 Validation Location

**Verdict: CONSISTENT** -- Two-layer pattern used everywhere.

1. **Generated validators** (middleware layer): OpenAPI-derived Zod schemas in `generated/openapi/` validate request shape before handler.
2. **Handler-level validation**: Business rule validation (e.g., refund eligibility, booking conflicts) in handler code or `utils/`.
3. **Repository-level**: No Zod validation in repos -- they trust validated input from handlers.

No modules deviate from this pattern.

### 13.4 Naming Convention Inconsistencies

**Handler files: camelCase (DOMINANT)**
- 98%+ of handler files use camelCase: `createBooking.ts`, `listMembers.ts`, `getDuesDashboard.ts`

**Exceptions (kebab-case):**
| File | Module | Severity |
|---|---|---|
| `notification-triggers.ts` | notifs | P3 |
| `ws.chat-room.ts` | comms | P3 |

**Module directory names: MIXED**
| Convention | Modules |
|---|---|
| lowercase | `audit`, `billing`, `booking`, `comms`, `dues`, `email`, `events`, `invite`, `jobs`, `membership`, `notifs`, `person`, `reviews`, `storage`, `training` |
| camelCase-ish | `platformadmin` |
| colon-separated | `association:member`, `association:operations` |
| plural vs singular | `events` vs `email`, `certificates` vs `storage` |

**P3:** Plural/singular inconsistency across module names is cosmetic but notable.

---

## 13b. Stubs & TODOs

### TODO/FIXME/HACK Counts (Handler Code Only, Excluding Tests)

| Count | Module | Severity |
|---|---|---|
| 14 | billing | P2 |
| 10 | association:member | **P1** |
| 1 | dues | P3 |
| 1 | comms | P3 |

**Total handler TODOs:** 26
**Total including tests:** 28

### P1 Handler Stubs (Runtime Empty Handlers)

**8 stub handlers** in `association:member` -- institutional membership CRUD not implemented:

| File | Line | Status |
|---|---|---|
| `createInstitutionalMembership.ts` | :32 | `// TODO: Implement business logic` |
| `getInstitutionalMembership.ts` | :38 | `// TODO: Implement business logic` |
| `updateInstitutionalMembership.ts` | :33 | `// TODO: Implement business logic` |
| `deleteInstitutionalMembership.ts` | :32 | `// TODO: Implement business logic` |
| `listInstitutionalMemberships.ts` | :32 | `// TODO: Implement business logic` |
| `allocateSeat.ts` | :33 | `// TODO: Implement business logic` |
| `revokeSeat.ts` | :32 | `// TODO: Implement business logic` |
| `listSeatAllocations.ts` | :33 | `// TODO: Implement business logic` |

**Severity: P1** -- These are registered routes returning empty/default responses. Any client calling them gets silently wrong data.

### Other Notable TODOs

| Location | TODO | Severity |
|---|---|---|
| `core/audit.ts:45` | `markForPurging` not implemented | P2 |
| `utils/identity-matching.ts:49` | DB queries for license fields | P2 |
| `dues/jobs/index.ts:27` | Wire to payment gateway | P2 |
| `comms/joinVideoCall.ts:212` | Short-lived WebRTC JWT | P2 |
| `association:member/recalculateAgingBucket.ts:28` | Invoice aging query | P2 |
| `association:member/getDuesFinancialDashboard.ts:54` | Membership expiry query | P3 |
| `billing/markInvoiceUncollectible.ts:120` | Line items storage | P2 |

### Apps TODO Count

| App | Count |
|---|---|
| memberry | 1 |
| account | 0 |
| admin | 0 |

---

## 13c. Type Cast Density

### `as any` Counts

#### api-ts Service

| Scope | Count |
|---|---|
| **Total (non-generated)** | **2,165** |
| Handler code (non-test) | 439 |
| Handler tests | 1,487 |
| Core/middleware/utils | 239 |

#### Per Handler Module (All Files Including Tests)

| Count | Module | Notes |
|---|---|---|
| 224 | association:member | Largest module |
| 191 | comms | WebSocket/video complexity |
| 178 | booking | Slot management |
| 151 | billing | Stripe types |
| 151 | association:operations | Analytics |
| 146 | email | Queue mocking |
| 119 | dues | Financial ops |
| 107 | person | PII module |
| 93 | training | CPD tracking |
| 92 | communication | Templates |
| 80 | membership | Import/export |
| 50 | elections | Voting |
| 47 | notifs | Push notifications |
| 46 | events | Event mgmt |
| 44 | documents | Doc management |
| 35 | reviews | NPS |
| 35 | platformadmin | Admin ops |
| 34 | marketplace | Listings |
| 33 | audit | Compliance |
| 31 | advertising | Job postings |
| 19 | storage | File ops |
| 15 | invite | Invitations |
| 3 | jobs | Background jobs |
| 2 | certificates | Cert gen |

**Key insight:** ~69% of `as any` (1,487/2,165) are in test files -- used to mock Hono context, DB repos, and external services. This is a common testing pattern and lower risk than production code casts.

#### Apps

| Count | App |
|---|---|
| 79 | memberry |
| 52 | account |
| 10 | admin |
| **141** | **Total** |

### `as unknown` Counts

**Total in handlers:** 40 (low, acceptable)

### `@ts-ignore` / `@ts-expect-error` Counts

| Scope | Count | Classification |
|---|---|---|
| api-ts (non-generated) | 0 | Clean |
| apps (all) | 27 | Mostly test mocking |

**Breakdown of 27 app suppressions:**
- `detect-timezone.test.ts`: 7 -- mocking `Intl.DateTimeFormat` (test-only, P3)
- `detect-language.test.ts`: 10 -- mocking `navigator.language` (test-only, P3)
- `detect-country.test.ts`: 8 -- mocking locale APIs (test-only, P3)
- `media-devices.ts`: 1 -- `cursor`/`displaySurface` not in TS types yet (library gap, P3)
- `image-cropper-dialog.tsx`: 1 -- Cropper + React 19 JSX mismatch (library gap, P3)

**Verdict:** All 27 are justified -- either test mocking of browser APIs or library type gaps. No `@ts-ignore` in api-ts at all.

### Files with >10 Type Casts

| Count | File | Classification |
|---|---|---|
| 375 | association:member (aggregate) | Test mocking |
| 88 | seed-scenarios.ts | Seed data casting |
| 72 | comms/comms-rest-handlers.test.ts | Test mocking |
| 59 | email/repos/queue.repo.test.ts | Test mocking |
| 58 | comms/video-calls-stabilization.test.ts | Test mocking |
| 53 | email/repos/template.repo.test.ts | Test mocking |
| 43 | dues/repos/dues.repo.test.ts | Test mocking |
| 39 | billing/repos/billing.repo.test.ts | Test mocking |

All top files are test files. **No production code file exceeds 20 casts individually.**

---

## 13d. Cross-Module Import Violations

### Import Coupling Matrix (Production Code Only)

| Count | Source -> Target | Type |
|---|---|---|
| 23 | association:member -> dues | Repos, utils, schema |
| 12 | person -> association:member | Repos, utils, schema |
| 6 | membership -> association:member | Utils, schema |
| 4 | association:member -> platformadmin | Schema (organizations) |
| 3 | events -> membership | Repo |
| 3 | association:member -> person | Schema |
| 2 | association:operations -> notifs | Notification triggers |
| 2 | association:member -> membership | Repo |
| 2 | person -> platformadmin | Schema |
| 2 | membership -> platformadmin | Schema |
| 1 | dues -> association:member | Utils (membership-lifecycle) |
| 1 | dues -> association:operations | Schema (events) |
| 1 | dues -> platformadmin | Schema |
| 1 | invite -> platformadmin | Schema |
| 1 | membership -> person | Schema |
| 1 | documents -> association:operations | Utils (qr-checkin) |
| 1 | documents -> association:member | Utils (credential-token) |
| 1 | documents -> certificates | Repo |

### Bidirectional Import Violations (P1)

| Pair | Direction A | Direction B | Total |
|---|---|---|---|
| **association:member <-> dues** | 23 | 2 | 25 |
| **association:member <-> membership** | 2 | 6 | 8 |
| **association:member <-> person** | 3 | 12 | 15 |

**Severity: P1** for all three bidirectional pairs. These create circular dependency risks and indicate bounded context violations.

**Root causes:**
1. **association:member <-> dues (25 imports):** Tightest coupling. `association:member` heavily uses `DuesRepository` and `dues/utils/`. Dues imports `membership-lifecycle` from `association:member`. These modules are functionally intertwined.
2. **association:member <-> person (15 imports):** Person reads membership data for "my memberships/credits" views. Association:member reads person schema for roster views.
3. **association:member <-> membership (8 imports):** Membership module uses `computeMembershipStatus` from association:member. Association:member uses `MembershipRepository`.

### Schema Cross-References (FK Dependencies)

3 schemas import `organizations` table from `platformadmin`:
- `dues/repos/dues-payments.schema.ts`
- `invite/repos/invite.schema.ts`
- `association:member/repos/credentials.schema.ts`

**Assessment:** Schema cross-refs to `platformadmin` are acceptable -- `organizations` is a shared reference table. The bidirectional handler imports are the real concern.

---

## 13e. Raw SQL Usage

### `sql` Template Literal Usage per Module

| Count | Module | Files |
|---|---|---|
| 19 | booking | `booking.schema.ts` (14), `bookingEvent.repo.ts` (4), `timeSlot.repo.ts` (1) |
| 6 | email | `queue.repo.ts` (5), `template.repo.ts` (1) |
| 4 | comms | `chatRoom.repo.ts` (4) |
| 4 | membership | `membership.repo.ts` (3), `importMembers.ts` (2), `csvImport.ts` (2) |
| 3 | dues | `dues.repo.ts` (3) |
| 3 | elections | `elections.schema.ts` (3) |
| 3 | reviews | `review.schema.ts` (3) |
| 2 | association:member | `membership.repo.ts` (1), `governance.schema.ts` (1) |
| 1 | billing | `billing.repo.ts` (1) |
| 1 | certificates | `certificates.repo.ts` (1) |
| 1 | marketplace | `listing.repo.ts` (1) |
| 1 | platformadmin | `getOrganizationBySlug.ts` (1) |

**Total: 61 raw SQL usages**

### Cross-Module Table References in SQL

**None found.** All `sql` template literals reference tables defined in the same module's schema. The `booking.schema.ts` has the highest density (14 usages) but all reference `booking_event`, `time_slot`, and `booking` tables -- all local.

Cross-module data access goes through imported repositories, not raw SQL. This is correct.

---

## Summary

### P1 Issues (3)

| ID | Issue | Location | Impact |
|---|---|---|---|
| P1-13b-1 | 8 stub handlers with no business logic | `association:member/` institutional membership CRUD | Routes return empty/default data |
| P1-13d-1 | Bidirectional imports: association:member <-> dues | 25 cross-imports | Circular dependency risk |
| P1-13d-2 | Bidirectional imports: association:member <-> person | 15 cross-imports | Circular dependency risk |
| P1-13d-3 | Bidirectional imports: association:member <-> membership | 8 cross-imports | Circular dependency risk |

### P2 Issues (3)

| ID | Issue | Location | Impact |
|---|---|---|---|
| P2-13b-2 | 14 TODOs in billing handlers | `billing/` various | Incomplete features |
| P2-13b-3 | Core audit `markForPurging` not implemented | `core/audit.ts:45` | GDPR purging incomplete |
| P2-13c-1 | 439 `as any` casts in production handler code | All modules | Type safety erosion |

### P3 Issues (3)

| ID | Issue | Location | Impact |
|---|---|---|---|
| P3-13a-1 | 2 kebab-case handler files among 200+ camelCase | `notifs/`, `comms/` | Naming inconsistency |
| P3-13a-2 | Plural/singular module name inconsistency | Handler directories | Cosmetic |
| P3-13b-4 | 40 dead template comment lines in stub handlers | `association:member/` | Code noise |

### Health Scores

| Dimension | Score | Notes |
|---|---|---|
| Error handling consistency | 9/10 | Single error class hierarchy, no deviations |
| Validation consistency | 9/10 | Two-layer pattern used everywhere |
| Architecture consistency | 8/10 | No service layer, Handler->Repo consistent |
| Stub coverage | 7/10 | 8 empty handlers reachable via routes |
| Type safety | 6/10 | 2,165 `as any` total (69% in tests) |
| Module coupling | 5/10 | 3 bidirectional import pairs, 66 cross-module imports |
| SQL safety | 9/10 | No cross-module raw SQL, all in repos/schemas |
| Naming consistency | 8/10 | 2 exceptions in 200+ files |
