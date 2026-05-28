# Traceability & Audit Compliance Report

**Generated:** 2026-05-29
**Phases:** 2.5 (oli-trace) + 3 (oli-audit-compliance)
**Scope:** All 19 MODULE_SPECs, 24 handler directories, AUDIT_CONTRACTS.md, WORKFLOW_MAP.md

---

## Phase 2.5: Traceability (oli-trace)

### 5a: Orphan Business Rules

Business rules declared in MODULE_SPECs with NO test or code reference in handler directories.

| Finding ID | Severity | Rule | Description |
|---|---|---|---|
| TR-M05-6d432795 | P2 | BR-04 | "IF category configured THEN cannot delete with assigned members (deactivate only)" — no test/code in membership or association:member handlers |
| TR-M05-9d21a46a | P2 | M5-R2 | "IF matching THEN normalize identifiers" — no test for license/email normalization in membership handlers |
| TR-M05-fa08f30d | P2 | M5-R5 | "IF member has pending application THEN block duplicate" — no duplicate-application guard in handler code |
| TR-M05-dde94b0a | P2 | M5-R6 | "IF transfer THEN preserve all history; receiving org must approve" — no transfer history preservation test |

**Note:** Only M05 was deeply analyzed for 5a (it is the only spec with a fully parseable BR table). Remaining 18 specs have similar structures but were not individually BR-traced due to volume. Recommend running `/br-trace` per module.

---

### 5b: Orphan User Stories

M05 spec declares 9 API endpoints in Section 10 (API Expectations). The `membership` handler directory has 6 implementation files and `association:member` has 194. No orphan user stories detected for M05 — all declared endpoints have corresponding handler implementations across the two directories.

**Cross-module gap:** 12 of 19 MODULE_SPECs have no API_CONTRACTS.md file (only m01-m04, m10, m11 have them). Specs without API_CONTRACTS cannot be validated for endpoint coverage.

| Finding ID | Severity | Description |
|---|---|---|
| TR-GLOBAL-a1b2c3d4 | P2 | 13 MODULE_SPECs (M05-M09, M12-M19) lack API_CONTRACTS.md — cannot validate endpoint-level traceability |

---

### 5c: Unspecced Implementation

All 24 handler directories map to a MODULE_SPEC. Handler function counts per module:

| Handler Dir | Handlers | Mapped Spec |
|---|---|---|
| association:member | 194 | M05 |
| association:operations | 69 | M14 |
| communication | 46 | M07 |
| platformadmin | 40 | M03 |
| person | 24 | M01/M02 |
| booking | 19 | M08 |
| billing | 16 | M06 |
| surveys | 16 | M18 |
| membership | 15 | M05 |
| documents | 15 | M11 |
| events | 15 | M08 |
| training | 14 | M09 |
| comms | 13 | M07 |
| email | 13 | M07 |
| elections | 9 | M12 |
| marketplace | 9 | M17 |
| advertising | 7 | M16 |
| certificates | 6 | M11 |
| storage | 6 | M11 |
| dues | 6 | M06 |
| notifs | 6 | M07 |
| reviews | 4 | (cross-cutting) |
| invite | 3 | M04 |
| audit | 1 | (cross-cutting) |

**No unspecced handler directories found.**

---

### 5d: Cross-Module Chain Breaks

Traced 3 critical cross-module flows from WORKFLOW_MAP Section 6:

| Flow | Chain | Status |
|---|---|---|
| 6.2 Dues Payment → Membership Status | dues handlers reference membership | CONNECTED |
| 6.3 Training Attendance → Credit Award | training handlers reference credits | CONNECTED |
| 6.5 Election → Officer Transition | election handlers reference officers | CONNECTED |

No chain breaks detected in the 3 flows analyzed. The remaining 5 flows (6.1 Registration, 6.4 Event+Payment, 6.6 Account Deletion, 6.7 Booking, 6.8 Communication Pipeline) were not deeply traced.

---

### 5e: Dead Spec References

M05 spec references modules: M01, M02, M04, M05, M06, M07, M11, M12, M13, M14, M15, M17, M18, M19. All referenced modules have corresponding MODULE_SPEC.md files.

**No dead spec references found in M05.**

---

### 5f: Event Chain Integrity

Domain events infrastructure: `services/api-ts/src/core/domain-events.ts` + `domain-events.registry.ts`

#### Events Emitted (34 types)

booking.confirmed, booking.cancelled, booking.created, booking.rejected, person.updated, person.created, credit.awarded, training.completed, training.cancelled, training.published, invite.claimed, membership.created, event.completed, event.published, event.registration.cancelled, officer.transitioned, dues.payment.recorded, subscription.upgraded, officer.assigned, member.suspended, member.removed, credit.adjusted, officer.removed, announcement.published, event.registered, event.cancelled, membership.status.changed, election.status.changed, nomination.submitted, election.deleted, election.created, subscription.cancelled, breach.reported, ticket.created

#### Events Consumed (21 types)

dues.payment.recorded, booking.confirmed, booking.cancelled, officer.assigned, officer.removed, membership.created, credit.awarded, breach.reported, training.cancelled, election.status.changed, event.published, event.completed, event.registered, training.published, officer.transitioned, election.created, nomination.submitted, member.suspended, member.removed, credit.adjusted, invite.claimed

#### Emitted But Never Consumed (13 events)

| Finding ID | Severity | Event | Impact |
|---|---|---|---|
| TR-GLOBAL-e1f2a3b4 | P2 | `booking.created` | No downstream reaction to new bookings |
| TR-GLOBAL-e2f3a4b5 | P2 | `booking.rejected` | No notification on booking rejection |
| TR-GLOBAL-c3d4e5f6 | P1 | `person.updated` | Profile changes not propagated to dependent modules |
| TR-GLOBAL-c4d5e6f7 | P1 | `person.created` | New person registration not triggering onboarding flow |
| TR-GLOBAL-d5e6f7a8 | P2 | `training.completed` | Training completion not triggering certificate generation (WORKFLOW_MAP 6.3 step 2 broken) |
| TR-GLOBAL-d6e7f8a9 | P2 | `event.registration.cancelled` | Waitlist auto-promotion not triggered on cancellation |
| TR-GLOBAL-a7b8c9d0 | P3 | `subscription.upgraded` | No downstream reaction to tier upgrade |
| TR-GLOBAL-a8b9c0d1 | P2 | `announcement.published` | No notification delivery for published announcements |
| TR-GLOBAL-b9c0d1e2 | P2 | `event.cancelled` | Event cancellation not triggering refund/notification cascade |
| TR-GLOBAL-c0d1e2f3 | P3 | `membership.status.changed` | Redundant with individual member.suspended/removed events |
| TR-GLOBAL-d1e2f3a4 | P3 | `election.deleted` | Low-impact lifecycle event |
| TR-GLOBAL-e2f3a4b5 | P3 | `subscription.cancelled` | No downstream reaction |
| TR-GLOBAL-f3a4b5c6 | P3 | `ticket.created` | Support ticket creation — may be consumed externally |

#### Consumed But Never Emitted: None

---

## Phase 3: Audit Compliance (oli-audit-compliance)

### Audit Infrastructure

- **Utility:** `services/api-ts/src/utils/audit.ts` — `auditAction()` helper
- **Repository:** `services/api-ts/src/handlers/audit/repos/audit.repo.ts` — full CRUD + integrity hashing
- **Pattern:** Fire-and-forget (try/catch, never blocks response)
- **Fields captured:** eventType, action, user, resourceType, resource, ipAddress, userAgent, details, organizationId
- **Missing from utility:** No explicit `before`/`after` change tracking (uses generic `details` object)
- **Transaction boundary:** Audit calls are OUTSIDE transactions — acceptable for non-critical events but risks audit loss on crash

### 9d: Audit Event Coverage

44 auditable events declared in AUDIT_CONTRACTS.md across 7 categories.

#### P0 Findings (PII access without audit log)

| Finding ID | Severity | Event | Description |
|---|---|---|---|
| AL-PERSON-5da31612 | P0 | `data.pii-modified` | Person handler has auditAction but does NOT use `data.pii-modified` as eventSubType — PII modification audit not explicitly typed |

#### P1 Findings (Missing audit log for declared action)

| Finding ID | Severity | Event | Handler | Description |
|---|---|---|---|---|
| AL-GLOBAL-37d109f0 | P1 | `auth.login-success` | (Better-Auth) | Auth handled by Better-Auth, not custom handlers — no auditAction integration |
| AL-GLOBAL-9d33ef97 | P1 | `auth.login-failed` | (Better-Auth) | Same — Better-Auth handles auth, no audit hook |
| AL-PERSON-* | P1 | `auth.password-changed` | person | No auditAction call for password change |
| AL-PERSON-* | P1 | `auth.2fa-enabled` | person | No audit for MFA enable |
| AL-PERSON-* | P1 | `auth.2fa-disabled` | person | No audit for MFA disable |
| AL-PERSON-* | P1 | `auth.session-revoked` | person | No audit for session revocation |
| AL-PERSON-* | P1 | `auth.account-locked` | person | No audit for account lockout |
| AL-PERSON-* | P1 | `auth.impersonation-started` | person | No audit for admin impersonation |
| AL-PERSON-* | P1 | `auth.impersonation-ended` | person | No audit for impersonation end |
| AL-PERSON-* | P1 | `data.document-accessed` | person | No audit for document access |
| AL-PERSON-* | P1 | `data.pii-deleted` | person | Account deletion handler lacks explicit audit |
| AL-DUES-* | P1 | `financial.payment-refunded` | dues | No auditAction for refund processing |
| AL-DUES-* | P1 | `financial.invoice-generated` | dues | No audit for invoice generation |
| AL-DUES-* | P1 | `financial.invoice-voided` | dues | No audit for invoice voiding |
| AL-BILLING-* | P1 | `financial.billing-config-changed` | billing | No auditAction in billing handlers |
| AL-BILLING-* | P1 | `financial.fund-allocation-changed` | billing | No auditAction in billing handlers |
| AL-MEMBERSHIP-7c8ca413 | P1 | `membership.status-changed` | membership | membership handler dir has NO auditAction calls at all |
| AL-MEMBERSHIP-* | P1 | `membership.application-submitted` | membership | No audit |
| AL-MEMBERSHIP-* | P1 | `membership.application-approved` | membership | No audit |
| AL-MEMBERSHIP-* | P1 | `membership.application-rejected` | membership | No audit |
| AL-MEMBERSHIP-* | P1 | `membership.transferred` | membership | No audit |
| AL-MEMBERSHIP-* | P1 | `membership.bulk-imported` | membership | No audit for bulk import |
| AL-ELECTIONS-* | P1 | `governance.election-created` | elections | No auditAction (has domain events but not audit) |
| AL-ELECTIONS-* | P1 | `governance.results-published` | elections | No audit |
| AL-CERTIFICATES-db06c42a | P1 | `content.credential-verified` | certificates | No auditAction in certificates handlers |

#### P2 Findings (Incomplete audit fields)

| Finding ID | Severity | Event | Description |
|---|---|---|---|
| AL-PERSON-c07b1ca6 | P2 | `data.pii-accessed` | Handler has auditAction but no explicit `data.pii-accessed` sub-type |
| AL-PERSON-ea45496d | P2 | `data.pii-exported` | Handler has auditAction but no explicit `data.pii-exported` sub-type |
| AL-DUES-fa6059c8 | P2 | `financial.payment-recorded` | Has auditAction but uses generic category, not `financial.payment-recorded` sub-type |
| AL-DUES-* | P2 | `financial.receipt-generated` | Generic audit, not typed |
| AL-BILLING-* | P2 | `financial.stripe-connected` | Generic audit, not typed |
| AL-ELECTIONS-8d00c836 | P2 | `governance.vote-cast` | Has auditAction but no specific sub-type |
| AL-ELECTIONS-* | P2 | `governance.officer-assigned` | Generic audit, not typed |
| AL-ELECTIONS-* | P2 | `governance.officer-removed` | Generic audit, not typed |
| AL-PLATFORMADMIN-567818dc | P2 | `admin.role-changed` | Generic audit, not typed |
| AL-PLATFORMADMIN-3a5379b4 | P2 | `admin.org-created` | Generic audit, not typed |
| AL-PLATFORMADMIN-* | P2 | `admin.org-settings-changed` | Generic audit, not typed |
| AL-PLATFORMADMIN-* | P2 | `admin.feature-flag-toggled` | Generic audit, not typed |
| AL-PLATFORMADMIN-* | P2 | `admin.platform-config-changed` | Generic audit, not typed |
| AL-DOCUMENTS-cd08b0ea | P2 | `content.document-uploaded` | Generic audit, not typed |
| AL-DOCUMENTS-38d9b131 | P2 | `content.document-deleted` | Generic audit, not typed |
| AL-CERTIFICATES-* | P2 | `content.certificate-generated` | Generic audit, not typed |
| AL-GLOBAL-* | P2 | All events | `auditAction` utility does not capture `before`/`after` change diffs — uses generic `details` object instead of structured change tracking |

#### P3 Findings (Minor)

| Finding ID | Severity | Description |
|---|---|---|
| AL-GLOBAL-4ebe4f12 | P3 | `auditAction` is fire-and-forget (outside transaction) — audit log could be lost on crash. Acceptable pattern per current design but noted for compliance awareness. |

---

## Summary

| Phase | Category | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|---|
| 2.5a | Orphan Business Rules | 0 | 0 | 4 | 0 | 4 |
| 2.5b | Orphan User Stories | 0 | 0 | 1 | 0 | 1 |
| 2.5c | Unspecced Implementation | 0 | 0 | 0 | 0 | 0 |
| 2.5d | Cross-Module Chain Breaks | 0 | 0 | 0 | 0 | 0 |
| 2.5e | Dead Spec References | 0 | 0 | 0 | 0 | 0 |
| 2.5f | Event Chain Integrity | 0 | 2 | 6 | 5 | 13 |
| 3/9d | Audit Compliance | 1 | 25 | 17 | 1 | 44 |
| **Total** | | **1** | **27** | **28** | **6** | **62** |

### Top Risks

1. **P0:** PII modification (`data.pii-modified`) lacks typed audit sub-type — DPA 2012 compliance risk
2. **P1 cluster — Authentication (9 events):** Better-Auth handles auth but has no audit hook — all auth events (login, lockout, impersonation, MFA) are unaudited
3. **P1 cluster — Membership (6 events):** `membership` handler directory has ZERO auditAction calls — all membership lifecycle events unaudited
4. **P1 — Event chains:** `person.created` and `person.updated` emitted but never consumed — onboarding and profile sync flows are disconnected
5. **P2 — training.completed not consumed:** WORKFLOW_MAP 6.3 step 2 (training→certificate) is broken — training completion does not trigger certificate generation
