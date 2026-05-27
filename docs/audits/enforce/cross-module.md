# Cross-Module Enforcement Report

**Generated:** 2026-05-27
**Auditor:** Cross-module enforcement auditor (automated)
**Scope:** 21 handler directories, EVENT_CONTRACTS.md, MODULE_MAP.md, DOMAIN_MODEL.md, ROLE_PERMISSION_MATRIX.md

---

## 1. Event Contract Alignment

### 1a. Domain Event Bus (domain-events.registry.ts)

Three events are registered in the typed DomainEventMap:

| Event | Producer Module | Consumer Module(s) | Producer Emits? | Consumer Handles? | Status |
|-------|----------------|--------------------|-----------------|--------------------|--------|
| `dues.payment.recorded` | dues (M06) | membership (M05) via `domain-event-consumers.ts` | **NO** -- zero `domainEvents.emit()` calls found in entire codebase | YES -- consumer registered in `registerDomainEventConsumers()` | **BROKEN** -- consumer exists but no producer ever emits |
| `membership.status.changed` | membership (M05) | (none registered) | **NO** -- zero emits found | **NO** -- only appears in unit tests | **DEAD** -- registered in type map, never emitted, never consumed |
| `invite.claimed` | invite (M04) | (none registered) | **NO** -- zero emits found | **NO** -- only appears in unit tests | **DEAD** -- registered in type map, never emitted, never consumed |

### 1b. EVENT_CONTRACTS.md Cross-Module Domain Events (Spec vs Reality)

EVENT_CONTRACTS.md declares 17 cross-module domain events. **None are emitted via the domain event bus.** The bus has zero `domainEvents.emit()` calls in production code.

| Declared Event | Declared Producer | Implementation Status |
|---------------|-------------------|----------------------|
| `PersonCreated` | M01 | Not emitted. Better-Auth handles user creation directly. |
| `PersonUpdated` | M02 | Not emitted. No event bus integration. |
| `PersonAnonymized` | M02 | Not emitted. Deletion processor is a scheduled job, not event-driven. |
| `AccountDeletionScheduled` | M02 | Not emitted. Job-based (`person.deletionProcessor`). |
| `MembershipCreated` | M05 | Not emitted. Direct DB writes. |
| `MembershipStatusChanged` | M05 | Registered in type map as `membership.status.changed` but never emitted. |
| `DuesPaymentRecorded` | M06 | Registered in type map as `dues.payment.recorded` but never emitted. Settlement uses direct function calls (`settlePayment()` / `membershipLifecycle`). |
| `DuesOverdue` | M06 | Not emitted. Handled via `dues.reminderProcessor` job. |
| `InviteClaimed` | M04 | Registered in type map as `invite.claimed` but never emitted. |
| `BookingCreated` | M08 | Not emitted via domain bus. Uses `wsService.publishToUser()` for WebSocket push. |
| `BookingConfirmed` | M08 | Same -- WebSocket only. |
| `BookingRejected` | M08 | Same -- WebSocket only. |
| `BookingCancelled` | M08 | Same -- WebSocket only. |
| `EventRegistered` | M08 | Not emitted. |
| `TrainingCompleted` | M09 | Not emitted. Credit award is direct function call in `markComplete.ts`. |
| `CreditAwarded` | M10 | Not emitted. |
| `ElectionStarted` | M12 | Not emitted. |

### 1c. Notification-Based Events

EVENT_CONTRACTS.md declares 17 notification event types. These are NOT domain events -- they are notification `type` enum values stored in the `notification` table. They work via direct function calls (`notifyLateCancellation`, `notifyWaitlistPromotion`, etc.) rather than the event bus.

**Assessment:** The notification trigger functions in `handlers/notifs/notification-triggers.ts` provide the actual cross-module glue. These work correctly as direct imports.

---

## 2. API Boundary Violations

### 2a. Direct Cross-Handler Imports (Schema/Repo Access)

Modules that directly import another module's schemas, repos, or utils instead of going through API/event boundaries:

#### person/ --> association:member/ (10 imports)

| File | Imports From | Type |
|------|-------------|------|
| `getMyMemberships.ts` | `association:member/repos/membership.schema` | Schema (table) |
| `createMyCreditEntry.ts` | `association:member/repos/credits.repo` | Repository |
| `createMyCreditEntry.ts` | `association:member/utils/credit-cycle` | Utility |
| `exportMyData.ts` | `association:member/repos/membership.repo` | Repository |
| `exportMyData.ts` | `association:member/repos/credits.repo` | Repository |
| `getMyOfficerRole.ts` | `association:member/repos/governance.repo` | Repository |
| `getMyCredits.ts` | `association:member/repos/credits.schema` | Schema (table) |
| `getMyCreditSummary.ts` | `association:member/repos/credits.repo` + `utils/credit-cycle` | Repository + Utility |
| `listMyCreditEntries.ts` | `association:member/repos/credits.repo` | Repository |
| `updatePrivacySettings.ts` / `updateMyPrivacySettings.ts` | `association:member/repos/membership.schema` | Schema (table) |

#### person/ --> platformadmin/ (3 imports)

| File | Imports From | Type |
|------|-------------|------|
| `getMyMemberships.ts` | `platformadmin/repos/platform-admin.schema` | Schema (organizations table) |
| `getMyCreditSummary.ts` | `platformadmin/repos/platform-admin.schema` | Schema (associations + organizations) |

#### dues/ --> association:member/ (3 imports)

| File | Imports From | Type |
|------|-------------|------|
| `getDuesDashboard.ts` | `association:member/repos/dues-payments.repo` | Repository |
| `repos/dues.repo.ts` | `association:member/repos/membership.schema` | Schema (table) |
| `repos/dues.repo.ts` | `association:member/repos/dues.schema` | Schema (table) |

#### dues/ --> platformadmin/ (2 imports)

| File | Imports From | Type |
|------|-------------|------|
| `repos/payment-token.schema.ts` | `platformadmin/repos/platform-admin.schema` | Schema (FK reference) |
| `repos/payment-token.repo.ts` | `platformadmin/repos/platform-admin.schema` | Schema (table) |

#### association:member/ --> person/ (5 imports)

| File | Imports From | Type |
|------|-------------|------|
| `createDuesInvoice.ts` | `person/repos/person.schema` | Schema (table) |
| `publishMyDirectoryProfile.ts` | `person/repos/person.schema` | Schema (table) |
| `listOfficerTerms.ts` | `person/repos/person.schema` | Schema (table) |
| `utils/trust-signals.ts` | `person/repos/privacy-settings.schema` | Schema (table) |
| `listMembershipApplications.ts` | `person/repos/person.schema` | Schema (table) |
| `jobs/directoryAutoPopulate.ts` | `person/repos/person.schema` | Schema (table) |
| `lookupCredentialPublic.ts` | `person/repos/privacy-settings.schema` | Schema (table) |

#### association:member/ --> platformadmin/ (5 imports)

| File | Imports From | Type |
|------|-------------|------|
| `repos/credentials.schema.ts` | `platformadmin/repos/platform-admin.schema` | Schema (FK) |
| `repos/dues-payments.schema.ts` | `platformadmin/repos/platform-admin.schema` | Schema (FK) |
| `repos/special-assessments.schema.ts` | `platformadmin/repos/platform-admin.schema` | Schema (FK) |
| `updateOrganizationProfile.ts` | `platformadmin/repos/platform-admin.schema` | Schema (table) |
| `createOfficerTerm.ts` | `platformadmin/repos/platform-admin.repo` | Repository |
| `getOrganizationProfile.ts` | `platformadmin/repos/platform-admin.schema` | Schema (table) |

#### association:member/ --> association:operations/ (1 import)

| File | Imports From | Type |
|------|-------------|------|
| `getDuesDashboard.ts` | `association:operations/repos/events.schema` | Schema (table) |

#### association:member/ --> membership/ (2 imports)

| File | Imports From | Type |
|------|-------------|------|
| `listRosterMembers.ts` | `membership/repos/membership.repo` | Repository |
| `getRosterMember.ts` | `membership/repos/membership.repo` | Repository |

#### association:operations/ --> notifs/ (2 imports)

| File | Imports From | Type |
|------|-------------|------|
| `cancelEventRegistration.ts` | `notifs/notification-triggers` | Function |
| `promoteWaitlistEntry.ts` | `notifs/notification-triggers` | Function |

#### association:operations/ --> billing/ (1 import)

| File | Imports From | Type |
|------|-------------|------|
| `registerAndPayForEvent.ts` | `billing/repos/billing.repo` | Repository |

#### association:operations/ --> events/ (1 import)

| File | Imports From | Type |
|------|-------------|------|
| `registerAndPayForEvent.ts` | `events/utils/membership-check` | Utility |

#### membership/ --> association:member/ (4 imports)

| File | Imports From | Type |
|------|-------------|------|
| `listOrgApplications.ts` | `association:member/repos/membership.schema` | Schema (tables) |
| `listMembers.ts` | `association:member/utils/compute-membership-status` | Utility |
| `listOrgMembers.ts` | `association:member/repos/membership.schema` | Schema (table) |
| `getMember.ts` | `association:member/utils/compute-membership-status` | Utility |

#### membership/ --> platformadmin/ (2 imports)

| File | Imports From | Type |
|------|-------------|------|
| `listOrgApplications.ts` | `platformadmin/repos/platform-admin.schema` | Schema |
| `listOrgMembers.ts` | `platformadmin/repos/platform-admin.schema` | Schema |

#### membership/ --> person/ (1 import)

| File | Imports From | Type |
|------|-------------|------|
| `listOrgMembers.ts` | `person/repos/person.schema` | Schema |

#### invite/ --> platformadmin/ (1 import)

| File | Imports From | Type |
|------|-------------|------|
| `repos/invite.schema.ts` | `platformadmin/repos/platform-admin.schema` | Schema (FK) |

#### events/ --> membership/ (3 imports)

| File | Imports From | Type |
|------|-------------|------|
| `listRegistrations.ts` | `membership/repos/membership.repo` | Repository |
| `getEvent.ts` | `membership/repos/membership.repo` | Repository |
| `listAttendance.ts` | `membership/repos/membership.repo` | Repository |

### 2b. Modules With Clean Boundaries (No Cross-Handler Imports)

These modules have zero cross-handler imports: `billing/`, `booking/`, `comms/`, `communication/`, `documents/`, `elections/`, `email/`, `notifs/`, `reviews/`, `storage/`, `certificates/`, `training/`, `audit/`.

**Total boundary violations:** 46 direct cross-handler imports across 8 importing modules.

---

## 3. Dependency Direction Violations

Per MODULE_MAP.md dependency diagram:

| Declared Direction | Code Reality | Violation? |
|-------------------|-------------|------------|
| M05 (Membership) --> M06 (Dues) | `dues/ imports from association:member/` (repos + schema) | **YES -- reverse dependency.** Dues reaches into Membership's repos. |
| M01 (Person) is root context | `person/ imports from association:member/` (10 imports) | **YES -- reverse dependency.** Person (root) depends on Membership (downstream). |
| M04 (Org Admin) --> M05 (Membership) | `membership/ imports from association:member/` (4 imports) | Ambiguous -- both are Membership context modules. |
| M08 (Events) depends on M05 | `events/ imports from membership/` (3 imports) | **Aligned** -- correct direction. |
| association:member --> membership (bidirectional) | `association:member/ imports from membership/` AND `membership/ imports from association:member/` | **Circular** -- same bounded context, documented as mega-module. |

### Critical: Financial <-> Membership Bidirectional Coupling

DOMAIN_MODEL.md explicitly flags this as the highest-risk coupling:
- `association:member/` contains `settlePayment()` and `membershipLifecycle` which handle dues settlement logic
- `dues/` imports `DuesRepository` and schemas from `association:member/`
- The domain event `dues.payment.recorded` was designed to decouple this but is **never emitted**

The intended decoupling mechanism (domain event bus) exists in code but is completely unused. Settlement is done via direct function calls through the mega-module.

---

## 4. Domain Term Consistency

### 4a. Person vs Member vs User

| Term | Usage | Consistency |
|------|-------|-------------|
| `Person` | Used consistently as the central PII entity across `person/`, `association:member/`, `platformadmin/` | **CONSISTENT** |
| `Member` | Used to mean "person with a membership record" | **CONSISTENT** |
| `User` | Better-Auth's internal identity. `audit_log_entry.archivedBy` references `user` table, not `person`. | **MINOR DRIFT** -- two identity concepts coexist |

### 4b. Organization vs Association

| Term | Where Used | Issue |
|------|-----------|-------|
| `organization` | DB table name, platformadmin schema, all FK references | Primary term |
| `association` | DB table `associations`, `getMyCreditSummary.ts` imports `associations` table | Secondary term |
| Both coexist | `platformadmin/repos/platform-admin.schema` exports both `organizations` and `associations` | **INCONSISTENT** -- two tables for org-like entities |

### 4c. Dues Subsystem Duplication

| Term | Location | Issue |
|------|---------|-------|
| `dues_config` / `dues_invoice` | `association:member/repos/dues.schema.ts` | Legacy tables |
| `dues_payment` / `dues_org_config` / `dues_fund` | `dues/repos/dues-payments.schema.ts` | V2 tables |
| `DuesRepository` | Exists in BOTH `association:member/repos/dues-payments.repo` AND `dues/repos/dues.repo.ts` | **CONFUSING** -- same class name, different modules |

---

## 5. Role/Permission Matrix Compliance (Spot Check)

### 5a. Training Module (M09) -- Position Enforcement

Matrix says: `createTraining` requires `SOCIETY_OFFICER` or `PRESIDENT`.
Code: `requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT])` -- **ALIGNED**.

### 5b. Dues Dashboard -- Position Enforcement

Matrix says: `getDuesDashboard` requires `TREASURER` or `PRESIDENT`.
Code: `requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT])` -- **ALIGNED**.

### 5c. Certificates -- Position Enforcement

Matrix says: `bulkIssueCertificates` requires `PRESIDENT` or `SECRETARY`.
Code: `requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY])` -- **ALIGNED**.

### 5d. Person "getMyX" Endpoints -- Auth Check

Matrix says: self-access for `getMyMemberships`, `getMyCredits`, etc.
Code: These extract `personId` from session -- **ALIGNED** (no cross-role escalation possible).

### 5e. Booking WebSocket Push -- No Auth Check on Notification Target

`confirmBooking.ts` calls `wsService.publishToUser(booking.client, ...)`. The `client` ID comes from the booking record. No additional permission check verifies the push target matches. This is **acceptable** -- the booking record itself is the authorization.

---

## Findings

| ID | Sev | Finding | Modules | Confidence |
|----|-----|---------|---------|------------|
| EX-DUE-MEM-a1b2c3d4 | **P1** | `dues.payment.recorded` domain event has a registered consumer in `domain-event-consumers.ts` that updates membership expiry, but **no producer ever calls `domainEvents.emit()`**. Settlement uses direct `settlePayment()` calls instead. The consumer is dead code. | dues, membership | HIGH |
| EX-MEM-INV-e5f6a7b8 | **P1** | `membership.status.changed` and `invite.claimed` events are defined in the type registry and tested in unit tests, but have zero producers and zero production consumers. Contracts declare them as active cross-module events. | membership, invite | HIGH |
| EX-EVT-ALL-c9d0e1f2 | **P1** | EVENT_CONTRACTS.md declares 17 cross-module domain events (PersonCreated, MembershipStatusChanged, DuesPaymentRecorded, BookingCreated, etc.) but **none are emitted via the domain event bus**. The entire domain event infrastructure is unused in production. | all | HIGH |
| EX-PER-MEM-12345678 | **P2** | Person module (root Identity context) has 10 direct imports from `association:member/` (repos, schemas, utils). This is a **reverse dependency** -- the root context should not depend on downstream Membership context. Violates MODULE_MAP dependency direction. | person, association:member | HIGH |
| EX-DUE-MEM-9abcdef0 | **P2** | Dues module directly imports `DuesRepository`, `memberships` schema, and `duesInvoices` schema from `association:member/`. This is a reverse dependency per MODULE_MAP (M05 --> M06, not M06 --> M05). | dues, association:member | HIGH |
| EX-MEM-MEM-fedcba98 | **P2** | Bidirectional imports between `association:member/` and `membership/` -- each imports the other's repos/utils. Documented as same bounded context (mega-module) but creates circular dependency risk. | association:member, membership | MEDIUM |
| EX-OPS-NTF-76543210 | **P2** | `association:operations/` directly imports notification trigger functions from `notifs/notification-triggers.ts`. This creates a direct coupling between Activities and Communication contexts. Should use the domain event bus instead. | association:operations, notifs | MEDIUM |
| EX-OPS-BIL-abcd1234 | **P2** | `association:operations/registerAndPayForEvent.ts` imports `MerchantAccountRepository` directly from `billing/repos/billing.repo`. Activities context reaches into Financial context internals. | association:operations, billing | MEDIUM |
| EX-OPS-EVT-5678efgh | **P2** | `association:operations/registerAndPayForEvent.ts` imports `checkActiveMembership` from `events/utils/membership-check`. Cross-import within Activities context but between separate handler directories. | association:operations, events | LOW |
| EX-MEM-PER-ijkl9012 | **P2** | `association:member/` has 7 imports from `person/` (person schema, privacy settings schema). While dependency direction is correct (Membership --> Identity), these are direct table imports rather than going through a Person API/service. | association:member, person | LOW |
| EX-ALL-PLT-mnop3456 | **P2** | 11 modules import `organizations` table directly from `platformadmin/repos/platform-admin.schema`. This is the most widespread cross-module coupling. While direction is correct (all depend on Platform), it bypasses any encapsulation of the organizations table. | platformadmin, 6+ modules | MEDIUM |
| EX-DUE-DUE-qrst7890 | **P3** | Two classes named `DuesRepository` exist: one in `association:member/repos/dues-payments.repo` and one in `dues/repos/dues.repo.ts` (marked deprecated). The deprecated one is still imported by `dues/getDuesDashboard.ts` and tests. Naming collision causes confusion. | dues, association:member | MEDIUM |
| EX-IDN-IDN-uvwx1234 | **P3** | `user` (Better-Auth) and `person` (application) represent the same human but are separate tables. `audit_log_entry.archivedBy` references `user`, not `person`. Minor but creates two identity paths. | person, audit | LOW |
| EX-ORG-ORG-yz012345 | **P3** | `organizations` and `associations` are separate tables in `platformadmin/` schema. Both represent org-like entities. `getMyCreditSummary.ts` imports both. Term drift between "organization" and "association". | platformadmin | LOW |

---

## Summary

### Event Infrastructure: Fully Specced, Completely Unused

The domain event bus (`DomainEventBus` class) is well-designed with typed payloads, error isolation, and logging. However:
- **0 production `emit()` calls** exist in the entire codebase
- **1 consumer** is registered (`dues.payment.recorded` -> membership expiry update) but is dead code
- **2 additional events** are type-registered but have neither producers nor consumers
- **17 cross-module events** are declared in EVENT_CONTRACTS.md but none use the bus

All cross-module communication happens via **direct function imports** (e.g., `settlePayment()`, `notifyLateCancellation()`, `computeMembershipStatus()`).

### Boundary Violations: 46 Cross-Handler Imports

- **8 modules** import from other modules' handler directories
- **person/** is the worst offender with 13 outbound cross-handler imports (to association:member and platformadmin)
- **platformadmin/** schema is imported by 6+ modules (most widespread coupling point)
- **13 modules** maintain clean boundaries with zero cross-handler imports

### Dependency Direction: 2 Reverse Dependencies

- Person (root) --> association:member (downstream) -- **reverse**
- Dues (M06) --> association:member (M05) -- **reverse** per MODULE_MAP

### Role/Permission: Aligned on Spot Checks

All 5 spot-checked endpoints enforce roles matching the ROLE_PERMISSION_MATRIX.md declarations.
