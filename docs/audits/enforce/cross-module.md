# Cross-Module Contract Alignment Audit

**Generated:** 2026-05-28
**Prior report:** 2026-05-27
**Scope:** 19 business modules, 25 handler directories
**Input artifacts:** MODULE_MAP.md, EVENT_CONTRACTS.md, ROLE_PERMISSION_MATRIX.md, handler source
**Method:** Static import graph analysis + contract document cross-reference

---

## Summary

| Severity | Count | Delta from prior |
|----------|-------|------------------|
| P0 (Security boundary violation) | 1 | +1 NEW |
| P1 (Undeclared dependency / event mismatch) | 11 | +3 NEW, 3 CARRIED |
| P2 (Naming inconsistency / shared schema) | 9 | +2 NEW, 7 CARRIED |
| P3 (Advisory) | 7 | +3 NEW, 4 CARRIED |
| **Total** | **28** | |

---

## P0 -- Security Boundary Violations

| ID | Modules | Finding | Evidence |
|----|---------|---------|----------|
| EX-BOOK-NOTF-a1b2c3d4 | M08 (Booking) / M07 (Notifs) | **Booking job emits notification types `booking_auto_rejected` and `booking_expired` that do NOT exist in `notificationTypeEnum` DB enum.** These use underscores instead of dots, will cause Postgres enum constraint violation at runtime. Additionally, `comms/cross-module-triggers.ts` emits `event.created` which is also absent from the enum. **3 runtime failures latent in code.** | `booking/jobs/confirmationTimer.ts:182` (`booking_auto_rejected`), `:199` (`booking_expired`), `comms/cross-module-triggers.ts:102` (`event.created`). The `notificationTypeEnum` in `notifs/repos/notification.schema.ts` does not include any of these values. EVENT_CONTRACTS.md references them in Flow 2 prose but omits them from the enum catalog. |

---

## P1 -- Undeclared Dependencies / Event Contract Mismatches

| ID | Modules | Finding | Evidence |
|----|---------|---------|----------|
| EX-DUE-MEM-a1b2c3d4 | M06 (Dues) / M05 (Membership) | **CARRIED.** `dues.payment.recorded` domain event has a registered consumer but no producer ever calls `domainEvents.emit()`. Settlement uses direct `settlePayment()` calls. Consumer is dead code. | `domain-event-consumers.ts` registers handler; zero `domainEvents.emit('dues.payment.recorded')` calls in codebase. |
| EX-MEM-INV-e5f6a7b8 | M05 / M04 | **CARRIED.** `membership.status.changed` and `invite.claimed` events defined in type registry, zero producers, zero production consumers. | Type map in `domain-events.registry.ts`; only unit test references. |
| EX-EVT-ALL-c9d0e1f2 | All | **CARRIED.** EVENT_CONTRACTS.md declares 17 cross-module domain events; **none are emitted via domain event bus**. Entire domain event infrastructure unused in production. | Zero `domainEvents.emit()` calls in production code. |
| EX-PERS-ASSM-e4f5a6b7 | M01/M02 -> M04/M05 | **NEW.** Person module has **26 direct imports** into association:member internals (repos, utils, schemas). MODULE_MAP declares M01->M02 but NOT M01->M04 or M01->M05. Person directly instantiates `CreditEntryRepository`, `MembershipRepository`, `OfficerTermRepository`. Heaviest undeclared dependency. | `person/createMyCreditEntry.ts`, `person/exportMyData.ts`, `person/getMyOfficerRole.ts`, `person/getMyCreditSummary.ts`, `person/listMyCreditEntries.ts`, `person/requestMyAccountDeletion.ts`, `person/updatePrivacySettings.ts` -- all import `@/handlers/association:member/repos/`. |
| EX-ASOP-MULT-23a4b5c6 | M14 -> M07, M08, M09, M03 | **NEW.** association:operations has **4 undeclared outbound dependencies**. Imports from notifs (M07), events (M08), training (M09), platformadmin (M03). MODULE_MAP only declares inbound edges to M14. | `cancelEventRegistration.ts` -> notifs; `registerAndPayForEvent.ts` -> billing + events; `exportNationalDashboard.ts` -> platformadmin; `createOrgAccreditedProvider.ts` + 3 others -> training. |
| EX-PLAT-MULT-b1c2d3e4 | M03 -> M04, M07, M14 | **NEW.** platformadmin has **3 undeclared outbound dependencies**. Jobs import governance schema from association:member, notification schema from notifs, and committee repo from association:operations. MODULE_MAP only declares M03->M04. | `platformadmin/listAllCommittees.ts` -> `association:operations/repos/committee.repo`; 4 job files (`trialExpiryMonitor`, `breachDeadlineMonitor`, `ticketSlaMonitor`, `pastDueMonitor`) import from `notifs/repos/notification.schema` and `association:member/repos/governance.schema`. |
| EX-DUES-ASSM-c8d9e0f1 | M06 -> M04 | **Dues imports DuesRepository from association:member re-export proxy** -- circular: dues owns canonical schema, assoc:member re-exports, dues imports back. | `dues/getDuesDashboard.ts:5` imports from `@/handlers/association:member/repos/dues-payments.repo`. |
| EX-BILL-PERS-d9e0f1a2 | M06 -> M01/M02, M03 | **billing has 11 undeclared cross-module imports.** 10 from person, 1 from platformadmin. MODULE_MAP has only inbound M05->M06. | `billing/captureInvoicePayment.ts`, `billing/createInvoice.ts`, `billing/createMerchantAccount.ts` -> person repos. `billing/handleStripeWebhook.ts:10` -> `platformadmin/repos/platform-admin.schema`. |
| EX-MBRS-MULT-f5a6b7c8 | M05 -> M01, M03 | **membership handler imports person schema and platformadmin schema directly.** No M05->M01 or M05->M03 declared in MODULE_MAP. | `membership/listOrgMembers.ts` imports `persons` from person and `platformAdmins` from platformadmin. |
| EX-DUPJ-DUES-b3c4d5e6 | M06 / M04 | **Duplicate `reminderProcessor.ts` in both `dues/jobs/` and `association:member/jobs/`.** Identical type signatures (`type: 'billing'`). Code duplication risks divergent behavior. | `handlers/dues/jobs/reminderProcessor.ts` and `handlers/association:member/jobs/reminderProcessor.ts`. |
| EX-COMM-EVNT-d7e8f9a0 | M07 (Comms) | **`comms/cross-module-triggers.ts` emits `event.created` notification type absent from both `notificationTypeEnum` and EVENT_CONTRACTS catalog.** Undeclared event. | `comms/cross-module-triggers.ts:102`: `type: 'event.created'`. Not in enum, not in catalog. |

---

## P2 -- Naming Inconsistency / Shared Schema Without Clear Ownership

| ID | Modules | Finding | Evidence |
|----|---------|---------|----------|
| EX-PER-MEM-12345678 | M01/M02, M04/M05 | **CARRIED.** Person (root Identity) has 26 imports from association:member. Reverse dependency violating MODULE_MAP. | See P1 EX-PERS-ASSM for details; additionally the import count grew from 10 (prior audit) to 26 (current). |
| EX-PRSN-ALLM-a2b3c4d5 | M01 / 10+ modules | **`persons` schema table imported directly by 10+ modules** via FK references. No API boundary -- all use direct Drizzle schema import. | `dues/repos/dues-payments.schema.ts`, `booking/repos/booking.schema.ts`, `certificates/repos/certificates.schema.ts`, `surveys/repos/survey.schema.ts`, `communication/repos/communication.schema.ts`, `billing/repos/billing.schema.ts`, `elections/repos/elections.schema.ts`, `reviews/repos/`, `association:member/repos/` (5+ files). |
| EX-ORGN-ALLM-e6f7a8b9 | M03 / 5+ modules | **`organizations` schema table owned by platformadmin imported by 5+ modules** for FK references. | `dues/repos/dues-payments.schema.ts` (9 refs), `invite/repos/invite.schema.ts`, `association:member/repos/credentials.schema.ts` (4 refs), `association:member/repos/special-assessments.schema.ts`. |
| EX-ROLE-INCO-c0d1e2f3 | Multiple | **Role checking uses 4 inconsistent patterns.** (1) `user.role === 'admin'` (booking, assoc:member, reviews), (2) `userHasRole(auth, user, 'admin')` (storage), (3) `user.role === 'platform_admin' \|\| user.role === 'super'` (platformadmin, assoc:ops), (4) `hasMinimumRole()` from org-auth utils (underutilized). | `booking/utils/authorization.ts:28`, `storage/listFiles.ts:54`, `association:operations/exportNationalDashboard.ts:43`, `platformadmin/getNationalDashboard.ts:87`. |
| EX-ROLE-ADMN-d4e5f6a7 | M04 vs M08/M09 | **`isAdmin` check uses different role semantics.** `association:member/searchDirectory.ts` checks `user?.role === 'admin'` (org-level). `reviews/listReviews.ts` checks `session.user.role === 'admin'` (same string, different context: system role vs org role). ROLE_PERMISSION_MATRIX defines these separately. | `association:member/searchDirectory.ts:38` vs `reviews/listReviews.ts:33`, `reviews/deleteReview.ts:31`, `reviews/getReview.ts:33`. |
| EX-NTYP-NAMG-a8b9c0d1 | M08 | **Booking notification types mix naming conventions.** Enum uses dots (`booking.confirmed`), but confirmationTimer uses underscores (`booking_auto_rejected`, `booking_expired`). | `booking/jobs/confirmationTimer.ts:182,199` vs `notifs/repos/notification.schema.ts` enum. |
| EX-DURE-PRXY-e2f3a4b5 | M06 / M04 | **CARRIED.** Dues schema circular re-export proxy. `association:member/repos/dues-payments.schema.ts` re-exports from `dues/repos/dues-payments.schema.ts`. BCI-01 backward compat shim masks true ownership. | `association:member/repos/dues-payments.schema.ts:3`: `export * from '@/handlers/dues/repos/dues-payments.schema'`. |
| EX-CPDA-MULT-f6a7b8c9 | M11 / M14 | **`cpdActivityTypeEnum` owned by association:operations imported by certificates.** Ownership unclear -- CPD activity type could be events or credentials concept. | `certificates/repos/certificates.schema.ts:6` imports from `../../association:operations/repos/events.schema`. |
| EX-ALL-PLT-mnop3456 | M03 / 6+ modules | **CARRIED.** 11 modules import `organizations` table directly from platformadmin schema. Most widespread coupling point. | See EX-ORGN-ALLM for details. |

---

## P3 -- Advisory

| ID | Modules | Finding | Evidence |
|----|---------|---------|----------|
| EX-EVNT-MBRS-a0b1c2d3 | M08 -> M05 | **events module imports MembershipRepository directly** from membership handler to check membership status. API boundary bypass; undeclared in MODULE_MAP. | `events/listRegistrations.ts:4`, `events/getEvent.ts:4`, `events/listAttendance.ts:4` import from `@/handlers/membership/repos/membership.repo`. |
| EX-SRVY-ASSM-e8f9a0b1 | M18 -> M04/M05 | **surveys module has 10 imports from association:member.** Second-heaviest cross-module dependency after person. MODULE_MAP declares M05->M18 but not reverse. | `surveys/` has 10 imports from `association:member` repos/utils. |
| EX-TRAN-ASSM-f2a3b4c5 | M09 -> M04/M05 | **training has 12 imports from association:member** (all `OfficerTermRepository` for role-gating). MODULE_MAP declares M09->M10 and M09->M11 but not M09->M04/M05. | 12 imports of `OfficerTermRepository` from `@/handlers/association:member/repos/governance.repo`. |
| EX-DOCS-MULT-d4e5f6a7 | M11 -> M04, M14 | **documents imports QR and credential token utils from association:member and association:operations.** Utility function imports crossing module boundaries. | `documents/` imports `generateQrToken`/`verifyQrToken` from `association:operations/utils/qr-checkin` and `createCredentialToken`/`verifyCredentialToken` from `association:member/utils/credential-token`. |
| EX-DUE-DUE-qrst7890 | M06 / M04 | **CARRIED.** Two classes named `DuesRepository` exist in different modules. Naming collision. | `association:member/repos/dues-payments.repo` and `dues/repos/dues.repo.ts`. |
| EX-IDN-IDN-uvwx1234 | M01 / Audit | **CARRIED.** `user` (Better-Auth) and `person` (application) represent same human but are separate tables. Minor two-identity-path issue. | `audit_log_entry.archivedBy` references `user`, not `person`. |
| EX-ORG-ORG-yz012345 | M03 | **CARRIED.** `organizations` and `associations` are separate tables. Both represent org-like entities. Term drift. | `platformadmin/repos/platform-admin.schema.ts` exports both. `getMyCreditSummary.ts` imports both. |

---

## Dimension Analysis

### 1. API Boundary Violations

**All cross-module interactions use direct TypeScript imports** (schema references, repository instantiation, utility calls). No HTTP/RPC API boundary between handler modules. By design for monolith, but every import is a tight coupling point.

**Actual import graph (compact, import count):**

```
association:member -> elections(18), person(15), platformadmin(8), association:operations(4), dues(4), membership(3), certificates(2)
association:operations -> training(4), notifs(2), association:member(2), platformadmin(1), billing(1), events(1)
billing -> person(10), platformadmin(1)
booking -> person(4), billing(1)
certificates -> person(1), association:operations(1)
communication -> membership(1), notifs(1), person(1)
dues -> association:member(15), person(4), platformadmin(3)
elections -> association:member(8), person(2)
events -> association:member(7), membership(3), association:operations(2), notifs(1)
invite -> platformadmin(2), membership(1)
membership -> association:member(14), person(4), platformadmin(4)
notifs -> person(6)
person -> association:member(26), platformadmin(3), association:operations(2), elections(1), communication(1), certificates(1), documents(1), invite(1), billing(1)
platformadmin -> notifs(4), association:operations(2), association:member(2)
reviews -> person(1)
surveys -> association:member(10), person(1)
training -> association:member(12), platformadmin(1), association:operations(1)
```

**Modules with zero outbound cross-handler imports:** audit, comms, email, storage.

### 2. Event Contract Mismatches

| Event Type in Code | In `notificationTypeEnum`? | In EVENT_CONTRACTS catalog? | Status |
|--------------------|--------------------------|-----------------------------|--------|
| `booking.confirmed` | Yes | Yes | OK |
| `booking.rejected` | Yes | Yes | OK |
| `booking.cancelled` | Yes | Yes | OK |
| `booking_auto_rejected` | **NO** | Prose only (Flow 2) | **RUNTIME FAILURE** |
| `booking_expired` | **NO** | Prose only (Flow 2) | **RUNTIME FAILURE** |
| `event.created` | **NO** | **NO** | **RUNTIME FAILURE** |
| `waitlist.promoted` | Yes | Yes | OK |
| `event.late-cancellation` | Yes | Yes | OK |
| `dunning.escalation` | Yes | Yes | OK |
| `task.overdue` | Yes | Yes | OK |
| `billing` | Yes | Yes | OK |
| `security` | Yes | Yes | OK |
| `system` | Yes | Yes | OK |
| `comms.video-call-started` | Yes | Yes | OK |
| `comms.video-call-joined` | Yes | Yes | OK |
| `comms.video-call-left` | Yes | Yes | OK |
| `comms.video-call-ended` | Yes | Yes | OK |
| `comms.chat-message` | Yes | Yes | OK |

**Domain event bus:** 3 events registered in type map (`dues.payment.recorded`, `membership.status.changed`, `invite.claimed`). Zero production `emit()` calls. All cross-module communication uses direct function imports.

### 3. Dependency Direction Violations

**MODULE_MAP declares 37 edges.** Code analysis reveals **40+ undeclared edges** (after handler-to-module mapping and deduplication).

Key undeclared dependency clusters:
- Nearly every module depends on `person` (M01/M02) and `platformadmin` (M03) for schema FKs -- implicit foundation deps not declared
- `association:member` (M04) is a gravity well -- 8 modules import from it, only partial declaration
- `M14` (association:operations) has 4 undeclared outbound deps
- Reverse dependencies: person->association:member (26), dues->association:member (15)

### 4. Shared Schema Ownership

| Schema/Table | Declared Owner | Imported By | Risk |
|--------------|----------------|-------------|------|
| `persons` | person (M01) | dues, booking, comms, certificates, association:member, surveys, communication, billing, elections, reviews | Low (natural FK) |
| `organizations` | platformadmin (M03) | dues (9 refs), invite, association:member (5+ refs) | Low (natural FK) |
| `notifications` | notifs (M07) | platformadmin (4 jobs), communication (1 job) | Medium (writes) |
| `officerTerms` | association:member (M04) | training (12 refs), platformadmin (2 jobs), documents, certificates | Medium |
| `cpdActivityTypeEnum` | association:operations (M14) | certificates (M11) | Low (enum reuse) |
| `dues-payments` | dues (M06) | association:member (re-export proxy) | High (circular) |

### 5. Role/Permission Consistency

**4 distinct role-checking patterns:**

1. `user.role === 'admin'` -- booking, association:member, reviews (6 files)
2. `userHasRole(auth, user, 'admin')` -- storage (3 files)
3. `user.role === 'platform_admin' || user.role === 'super'` -- platformadmin, association:operations (4 files)
4. `hasMinimumRole()` from `utils/org-auth.ts` -- available but underutilized

The string `'admin'` means org-level admin in some contexts, system admin in others. ROLE_PERMISSION_MATRIX defines these as separate hierarchies but code conflates them.

---

## Recommendations

1. **P0 Fix (immediate):** Add `booking_auto_rejected`, `booking_expired`, and `event.created` to `notificationTypeEnum` in `notifs/repos/notification.schema.ts` (or change code to use existing dot-separated values). Generate migration. These will cause Postgres constraint violations at runtime.

2. **P1 Fix (next sprint):**
   - Update MODULE_MAP.md to declare the ~40 missing dependency edges, particularly the person->association:member reverse dependency
   - Either activate the domain event bus (emit `dues.payment.recorded` etc.) or remove the dead consumer code and update EVENT_CONTRACTS.md to reflect the direct-call reality
   - Deduplicate `reminderProcessor.ts` (delete one copy)

3. **P2 Fix (planned):**
   - Standardize role-checking to `hasMinimumRole()` everywhere
   - Create shared schema re-exports package for `persons`/`organizations` FK references
   - Resolve the dues schema circular re-export (BCI-01)

4. **P3 Monitor:** The association:member mega-module split (P1-11, deferred to v1.2.0) will naturally resolve several dependency violations. Ensure split plan at `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` accounts for these findings.
