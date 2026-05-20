---
Artifact: VERTICAL_SLICE_PLAN
Version: 1.0
Generated: 2026-05-20
Based On: MODULE_SPEC.md v1.0 (19 modules), WORKFLOW_MAP.md v1.0, DOMAIN_MODEL.md v1.0
Pipeline Stage: Phase C -- Execution Planning
Codebase State: 2954+ API tests passing, 22 handler directories, 19 modules implemented
---

# Vertical Slice Plan

## Summary

Total slices: 48
Modules covered: M01-M19 (all 19 modules) + 3 cross-cutting integration slices
Recommended first slice: 001-membership-status-stabilization
Slice type breakdown: 8 new-feature, 28 stabilize-existing, 12 refactor-existing

## Slice Summary Table

| Slice ID | Module | Description | Priority | Dependencies | Type | Risk | Complexity |
|----------|--------|-------------|----------|--------------|------|------|------------|
| 001-membership-status-stabilization | M05 | Stabilize membership status computation from dues_expiry_date per BR-01/BR-02 | P0 | None | stabilize-existing | P1 | medium |
| 002-auth-session-hardening | M01 | Harden login, session management, OTP verification against spec | P0 | None | stabilize-existing | P1 | medium |
| 003-person-profile-spec-compliance | M02 | Align person CRUD + privacy controls with MODULE_SPEC | P0 | 002 | stabilize-existing | P2 | medium |
| 004-platform-admin-stabilization | M03 | Stabilize association/org CRUD, feature flags, impersonation | P0 | 002 | stabilize-existing | P2 | medium |
| 005-org-admin-officer-roles | M04 | Stabilize officer role assignment, transition checklists per M4-R1/R2 | P0 | 004 | stabilize-existing | P1 | medium |
| 006-dues-config-fund-allocation | M06 | Stabilize dues configuration + fund allocation (BR-05, M6-R1 rounding) | P0 | 001, 005 | stabilize-existing | P1 | medium |
| 007-manual-payment-recording | M06 | Stabilize treasurer manual payment flow + expiry extension (BR-07) | P0 | 006 | stabilize-existing | P1 | small |
| 008-refund-handler | M06 | Implement refund with allocation reversal + expiry revert (BR-08) -- GAP-001 | P0 | 007 | new-feature | P0 | large |
| 009-payment-webhook-retry | M06 | Implement webhook failure retry strategy with backoff -- GAP-009 | P0 | 007 | new-feature | P0 | medium |
| 010-grace-lapsed-cron | M05 | Implement scheduled job for Grace->Lapsed automatic transition -- GAP-015 | P0 | 001 | new-feature | P0 | medium |
| 011-billing-gateway-stabilization | M06 | Stabilize Stripe/PayMongo gateway setup, credential isolation (BR-30) | P0 | 006 | stabilize-existing | P1 | medium |
| 012-member-roster-directory | M05 | Stabilize roster search/filter + privacy-filtered directory (BR-21) | P0 | 001 | stabilize-existing | P2 | medium |
| 013-bulk-csv-import | M05 | Stabilize CSV import with per-row validation, cross-org matching (BR-22, M5-R3) | P0 | 012 | stabilize-existing | P1 | large |
| 014-dues-reminders-dunning | M06 | Stabilize automated reminder schedule (M6-R5) + dunning escalation | P0 | 006 | stabilize-existing | P2 | medium |
| 015-announcements-templates | M07 | Stabilize announcement CRUD + message templates + delivery tracking | P0 | 005 | stabilize-existing | P2 | medium |
| 016-email-queue-stabilization | M07 | Stabilize async email processing pipeline, opt-out enforcement | P0 | 015 | stabilize-existing | P2 | small |
| 017-event-crud-registration | M08 | Stabilize event create/publish + registration with capacity (BR-18) | P0 | 005 | stabilize-existing | P2 | medium |
| 018-event-qr-checkin | M08 | Stabilize QR check-in scanner + manual check-in | P0 | 017 | stabilize-existing | P2 | small |
| 019-training-crud-enrollment | M09 | Stabilize training CRUD + enrollment with capacity management | P0 | 005 | stabilize-existing | P2 | medium |
| 020-training-attendance-credit | M09, M10 | Stabilize attendance confirmation -> auto-credit award (cross-module) | P0 | 019 | stabilize-existing | P1 | medium |
| 021-credit-cycle-config | M10 | Stabilize credit cycle configuration per association (BR-11) | P0 | 001 | stabilize-existing | P2 | small |
| 022-credit-aggregation-compliance | M10 | Stabilize cross-org credit aggregation + compliance views | P0 | 021, 020 | stabilize-existing | P2 | medium |
| 023-documents-credentials | M11 | Stabilize member ID card generation, certificate PDFs, QR verification | P0 | 003, 001 | stabilize-existing | P2 | medium |
| 024-elections-voting | M12 | Stabilize election CRUD + nominations + online voting + results | P0 | 005 | stabilize-existing | P1 | large |
| 025-election-officer-transition | M12, M04 | Stabilize election results -> officer role auto-assignment (cross-module) | P0 | 024, 005 | stabilize-existing | P1 | medium |
| 026-audit-retention-compliance | Cross | Stabilize audit logging + 7-year retention (BR-32) across all modules | P0 | None | stabilize-existing | P2 | small |
| 027-notification-service-wiring | Cross | Wire notification delivery to all modules (addresses GAP-003, GAP-006, GAP-012, GAP-017) | P0 | 015, 016 | refactor-existing | P1 | large |
| 028-account-deletion-cascade | M02, Cross | Stabilize account deletion with cascade across all modules | P0 | 003 | stabilize-existing | P1 | large |
| 029-payment-receipts | M06 | Stabilize PDF receipt generation with sequential numbering (M6-R6) | P1 | 007 | stabilize-existing | P2 | small |
| 030-financial-reports | M06 | Stabilize collection/fund/aging/status reports | P1 | 007 | stabilize-existing | P2 | medium |
| 031-online-payment-flow | M06 | Stabilize member checkout via payment gateway | P1 | 011, 009 | stabilize-existing | P1 | medium |
| 032-paid-events | M08 | Implement event fee collection via M06 billing | P1 | 017, 011 | new-feature | P1 | medium |
| 033-event-waitlisting | M08 | Implement waitlist auto-promotion on cancellation + notification (GAP-003) | P1 | 017 | new-feature | P2 | small |
| 034-paid-training | M09 | Implement training fee collection via M06 billing | P1 | 019, 011 | new-feature | P1 | medium |
| 035-committee-crud-membership | M19 | Stabilize committee CRUD + member management + chairperson enforcement | P1 | 005 | stabilize-existing | P2 | medium |
| 036-committee-tasks | M19 | Stabilize task management: create, assign, track, overdue notifications | P1 | 035 | stabilize-existing | P2 | small |
| 037-professional-feed | M13 | Stabilize feed display + post creation + moderation | P1 | 001 | stabilize-existing | P2 | medium |
| 038-job-board | M15 | Stabilize job listing CRUD + search + auto-expiry | P1 | 005 | stabilize-existing | P2 | medium |
| 039-surveys-polls | M18 | Stabilize survey CRUD + response collection + anonymity enforcement | P1 | 005 | stabilize-existing | P2 | medium |
| 040-national-dashboard | M14 | Stabilize cross-chapter KPIs + comparison table + drill-down | P1 | 001, 006 | stabilize-existing | P2 | medium |
| 041-booking-slot-management | M08 | Refactor booking slot generation/cleanup/confirmation timer jobs | P1 | 017 | refactor-existing | P2 | medium |
| 042-certificate-pdf-generation | M11, M09 | Refactor training certificate PDF with QR verification | P1 | 020, 023 | refactor-existing | P2 | small |
| 043-credit-transcript-pdf | M10 | Implement credit transcript PDF export -- GAP-018 | P1 | 022 | new-feature | P2 | small |
| 044-bulk-payment-recording | M06 | Implement bulk payment for treasurers -- GAP-005 | P1 | 007 | new-feature | P2 | medium |
| 045-marketplace-vendor | M17 | Stabilize vendor management + marketplace browse | P2 | 004 | stabilize-existing | P3 | medium |
| 046-advertising-campaigns | M16 | Stabilize advertiser management + campaign CRUD + creative review | P2 | 004, 037 | stabilize-existing | P3 | large |
| 047-chat-rooms-websocket | M07 | Refactor real-time WebSocket messaging | P2 | 002 | refactor-existing | P2 | large |
| 048-video-calls | M07 | Refactor WebRTC video call infrastructure | P2 | 047 | refactor-existing | P3 | large |

## Dependency Graph

```
                    FOUNDATION LAYER (no deps)
                    ========================
          001-membership-status    002-auth-session    026-audit-retention
               |                       |
               +----------+----------+---+----------+
               |          |          |   |          |
          010-grace   012-roster  003-profile  004-platform
          -lapsed     |          |             |
          -cron       013-csv    028-delete    005-org-admin
                      -import   -cascade       |
                                           +---+---+---+---+---+---+---+
                                           |   |   |   |   |   |   |   |
                    DUES LAYER            006  015  017  019  024  035  038
                    ==========            dues comms evnt trng elec cmte jobs
                    |                      |    |    |    |    |    |    |
                   006-dues-config         |   016   018  020  025  036  039
                    |    |    |             |  email  qr  att+  off  task surv
                   007  011   |            |         ckin cred  trn
                   pay  gway  014          |               |
                   rec   |   remind       021-credit      022-credit
                    |    |                 -cycle          -aggr
              +-----+----+                                  |
              |     |                                      023-docs
             008   009                                     -creds
             refund retry                                   |
             GAP1  GAP9                                   042-cert
              |     |                                      |
             029   031                                    043-transcript
             rcpt  online
              |     |
             030   032   033   034   044
             rpts  paid  wait  paid  bulk
                   evnt  list  trng  pay

                    LATER PHASES
                    ============
                   037-feed -> 046-ads
                   040-national-dashboard
                   041-booking-refactor
                   045-marketplace
                   047-chat -> 048-video
                   027-notification-wiring (after 015, 016)
```

## Detailed Slice Definitions

---

### 001-membership-status-stabilization

- **Module:** M05 (Membership)
- **Description:** Stabilize the membership status computation engine to correctly derive status from `dues_expiry_date` + configurable grace period per BR-01 and BR-02. Ensure status is never stored as mutable field but always computed on read.
- **Priority:** P0 -- Foundational. Every module that checks membership status depends on this being correct.
- **Dependencies:** None
- **Foundational?** Yes
- **Backend scope:** `handlers/membership/` status computation logic, `handlers/association:member/` membership queries. Verify computed status in all list/get endpoints.
- **Frontend scope:** Membership status badges across all screens that display member info.
- **Test scope:** BR-01 (status = f(dues_expiry_date)), BR-02 (org-specific grace 0-90 days), M5-R1 (state machine transitions: Pending->Active->Grace->Lapsed), M5-R10 (cross-org independence). Verify 2954+ existing tests still pass.
- **Data/schema scope:** Verify `dues_expiry_date`, `grace_period_days` columns exist. No new migrations expected.
- **Permission/audit scope:** Read-only computation -- no permission changes. Audit log membership status transitions.
- **Risks:** Changing computation logic could break downstream modules that cache or assume status values.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 002-auth-session-hardening

- **Module:** M01 (Auth & Onboarding)
- **Description:** Harden authentication endpoints (login, registration, OTP, session management) against MODULE_SPEC acceptance criteria. Verify account lockout (AC-M01-005), claim token expiry (AC-M01-004), session revocation.
- **Priority:** P0 -- Security foundation for all authenticated operations.
- **Dependencies:** None
- **Foundational?** Yes
- **Backend scope:** `handlers/person/` auth endpoints (25 handlers). Session create/revoke, OTP rate limiting, password reset flow.
- **Frontend scope:** Login, registration, OTP verification screens.
- **Test scope:** AC-M01-001 (OTP delivery), AC-M01-004 (claim token 48h expiry), AC-M01-005 (lockout after 5 failed attempts). BR-30 credential isolation.
- **Data/schema scope:** `person`, `session` tables. Verify `failed_attempts`, `locked_until` columns.
- **Permission/audit scope:** Public routes (register, login) vs authenticated routes. Audit all auth events.
- **Risks:** OTP delivery depends on email service availability. Rate limiting thresholds need tuning.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 003-person-profile-spec-compliance

- **Module:** M02 (Member Profile & Settings)
- **Description:** Align profile view/edit, privacy controls, notification preferences with MODULE_SPEC. Ensure per-org privacy settings (PersonPrivacySetting) work correctly.
- **Priority:** P0 -- Profile is the member's primary interaction point.
- **Dependencies:** 002-auth-session-hardening
- **Foundational?** Yes
- **Backend scope:** `handlers/person/` profile endpoints. Privacy toggle CRUD, notification preference CRUD.
- **Frontend scope:** `/my/profile`, `/my/id-card` screens. Privacy toggle UI.
- **Test scope:** AC-M02-001 (photo upload), AC-M02-002 (privacy toggle), AC-M02-004 (QR verification), AC-M02-005 (multi-org display).
- **Data/schema scope:** `person`, `person_privacy_setting`, `notification_preference` tables.
- **Permission/audit scope:** Self-only access for profile. Officers can view (not edit) member profiles.
- **Risks:** Photo upload size limits, image processing.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 004-platform-admin-stabilization

- **Module:** M03 (Platform Administration)
- **Description:** Stabilize association CRUD, organization provisioning, feature flag matrix, impersonation. Verify last-super-admin protection (AC-M03-004).
- **Priority:** P0 -- Platform admin controls tenant provisioning for all downstream modules.
- **Dependencies:** 002-auth-session-hardening
- **Foundational?** Yes
- **Backend scope:** `handlers/platformadmin/` (21 handlers). Association CRUD, org lifecycle state machine, feature flags.
- **Frontend scope:** `/admin` dashboard, `/admin/feature-flags` screen.
- **Test scope:** AC-M03-001 (impersonation audit trail), AC-M03-002 (feature flag disable warning), AC-M03-004 (last super admin protection).
- **Data/schema scope:** `association`, `organization`, `feature_flag` tables. Org lifecycle states.
- **Permission/audit scope:** Platform admin only (AdminLevel check). All impersonation events logged.
- **Risks:** Feature flag changes could disable modules for live orgs.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 005-org-admin-officer-roles

- **Module:** M04 (Organization Admin)
- **Description:** Stabilize officer role assignment/removal with one-per-role constraint (M4-R1), president-only authorization (M4-R2), transition checklists (M4-R3), disciplinary actions with mandatory reason (M4-R4).
- **Priority:** P0 -- Officer roles gate all org-level operations.
- **Dependencies:** 004-platform-admin-stabilization
- **Foundational?** Yes
- **Backend scope:** `handlers/association:member/` officer endpoints. Role assignment, transition checklist generation, disciplinary action recording.
- **Frontend scope:** `/org/[id]/officer/dashboard`, officer management screens.
- **Test scope:** M4-R1 (one per role except board), M4-R2 (president-only), M4-R3 (checklist required), M4-R4 (reason required, immutable), M4-R5 (SVG sanitization), BR-09 (notify new officer).
- **Data/schema scope:** `officer_role`, `disciplinary_action` tables. Role hierarchy in `ROLE_HIERARCHY`.
- **Permission/audit scope:** President-only for role changes. 2FA required for president/secretary/treasurer in prod. Immutable audit trail for all officer actions (M4-R6).
- **Risks:** Role hierarchy enforcement must be consistent with `hasMinimumRole` utility.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 006-dues-config-fund-allocation

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize dues amount/frequency/grace configuration and fund allocation with 100% sum constraint (BR-05, M6-R1). Verify currency-aware rounding with last-fund absorption.
- **Priority:** P0 -- Financial correctness is non-negotiable.
- **Dependencies:** 001-membership-status-stabilization, 005-org-admin-officer-roles
- **Foundational?** Yes
- **Backend scope:** `handlers/dues/` configuration endpoints (15 handlers). Fund config CRUD, allocation percentage validation.
- **Frontend scope:** `/org/[id]/officer/payments` configuration section.
- **Test scope:** BR-05 (fund split totals 100%), M6-R1 (rounding: sum == payment_amount always), BR-32 (7-year retention).
- **Data/schema scope:** `dues_config`, `fund_config`, `fund_allocation` tables.
- **Permission/audit scope:** Treasurer or president can configure. All config changes audited.
- **Risks:** Rounding errors in multi-currency scenarios. PHP peso sub-unit handling.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 007-manual-payment-recording

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize treasurer manual payment recording flow: record offline payment, trigger fund allocation, extend dues_expiry_date per BR-07, concurrent payment warning per M6-R4.
- **Priority:** P0 -- Primary payment method for many Philippine orgs.
- **Dependencies:** 006-dues-config-fund-allocation
- **Foundational?** No
- **Backend scope:** `handlers/dues/` payment recording endpoints. Expiry date extension logic, duplicate detection (5-min window).
- **Frontend scope:** Payment recording form on financial dashboard.
- **Test scope:** BR-07 (payment extends expiry by billing cycle), M6-R4 (concurrent payment warning within 5 min), M6-R8 (idempotent webhook).
- **Data/schema scope:** `dues_payment`, `fund_allocation` tables. Payment status state machine.
- **Permission/audit scope:** Treasurer records payments. All payments logged with actor + timestamp.
- **Risks:** Race condition on concurrent payments for same member.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 008-refund-handler

- **Module:** M06 (Dues & Payments)
- **Description:** Implement refund handler per BR-08: refunds only within 30 days of payment, only for un-allocated payments. Must reverse dues_expiry_date extension and fund allocations. Addresses GAP-001 (HIGH).
- **Priority:** P0 -- HIGH gap. No refund path exists today.
- **Dependencies:** 007-manual-payment-recording
- **Foundational?** No
- **Backend scope:** New refund endpoint in `handlers/dues/`. Allocation reversal logic, expiry date rollback computation. Full and partial refund support.
- **Frontend scope:** Refund button on payment detail, confirmation dialog with impact preview.
- **Test scope:** BR-08 (30-day window, un-allocated only), payment status transition to `refunded`, fund allocation reversal sums, membership status recomputation after refund.
- **Data/schema scope:** `dues_payment` status `refunded`, new `refund_amount`, `refund_date`, `refund_reason` columns or separate refund table.
- **Permission/audit scope:** Treasurer initiates, president approves (for amounts > threshold). Refund event logged immutably.
- **Risks:** Partial refund allocation reversal is complex. Must handle case where expiry was already extended by subsequent payment.
- **Risk level:** P0
- **Slice type:** new-feature
- **Complexity:** large (7+ files)

---

### 009-payment-webhook-retry

- **Module:** M06 (Dues & Payments)
- **Description:** Implement payment webhook failure retry strategy with exponential backoff. Currently only a terminal "failed" state exists with no recovery path. Addresses GAP-009 (HIGH).
- **Priority:** P0 -- HIGH gap. Payment failures are silently lost.
- **Dependencies:** 007-manual-payment-recording
- **Foundational?** No
- **Backend scope:** Webhook handler in `handlers/dues/` or `handlers/billing/`. Add retry queue with exponential backoff (1m, 5m, 15m, 1h). Dead letter queue after max retries. Idempotency key enforcement (M6-R8).
- **Frontend scope:** Failed payment status indicator on financial dashboard. Admin retry button.
- **Test scope:** M6-R8 (duplicate webhook returns 200), retry count tracking, dead letter after N failures, successful retry transitions payment to completed.
- **Data/schema scope:** Add `retry_count`, `last_retry_at`, `next_retry_at` to payment or webhook tracking table.
- **Permission/audit scope:** Automatic retries system-initiated. Manual retry by treasurer. All attempts logged.
- **Risks:** Retry storms if gateway is down. Must implement circuit breaker. Idempotency critical to prevent double-charging.
- **Risk level:** P0
- **Slice type:** new-feature
- **Complexity:** medium (4-6 files)

---

### 010-grace-lapsed-cron

- **Module:** M05 (Membership)
- **Description:** Implement scheduled cron job that transitions membership status from Grace to Lapsed when the configurable grace period expires. Addresses GAP-015 (HIGH).
- **Priority:** P0 -- HIGH gap. Grace periods never expire automatically today.
- **Dependencies:** 001-membership-status-stabilization
- **Foundational?** No
- **Backend scope:** New pg-boss job `membership.graceToLapsed` in `handlers/membership/` or `handlers/association:member/`. Query all memberships in Grace state where `dues_expiry_date + grace_period_days < now()`. Batch update to Lapsed. Send notifications.
- **Frontend scope:** None (background job). Status change reflected in existing UI.
- **Test scope:** Grace period computation per org config (BR-02, 0-90 days default 30), batch processing correctness, notification sent on transition, no transition if dues paid during grace.
- **Data/schema scope:** No new tables. Uses existing `membership`, `dues_config` tables. Job registered in pg-boss.
- **Permission/audit scope:** System-initiated. Each transition logged to status_history with reason "grace_period_expired".
- **Risks:** Large batch sizes at month boundaries. Must be idempotent for re-runs.
- **Risk level:** P0
- **Slice type:** new-feature
- **Complexity:** medium (4-6 files)

---

### 011-billing-gateway-stabilization

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize payment gateway setup (Stripe Connect, PayMongo) with per-org credential isolation per BR-30. Verify gateway adapter interface (M6-R12).
- **Priority:** P0 -- Gateway isolation is a security requirement.
- **Dependencies:** 006-dues-config-fund-allocation
- **Foundational?** No
- **Backend scope:** `handlers/billing/` (16 handlers). Gateway adapter pattern, credential storage, test mode toggle.
- **Frontend scope:** Gateway setup wizard in org settings.
- **Test scope:** BR-30 (no cross-org credential leakage), M6-R12 (adapter interface), test mode isolation.
- **Data/schema scope:** Billing configuration tables. Encrypted credential storage.
- **Permission/audit scope:** President/treasurer configure gateway. Credentials never exposed in API responses.
- **Risks:** Payment gateway API changes. PCI compliance considerations.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 012-member-roster-directory

- **Module:** M05 (Membership)
- **Description:** Stabilize member roster (officer view with search/filter) and member directory (privacy-filtered public view). Ensure cross-org independence (BR-21).
- **Priority:** P0 -- Core member management workflow.
- **Dependencies:** 001-membership-status-stabilization
- **Foundational?** No
- **Backend scope:** `handlers/association:member/` roster/directory endpoints. Privacy filter logic using PersonPrivacySetting.
- **Frontend scope:** `/org/[id]/officer/roster`, `/org/[id]/members` screens.
- **Test scope:** BR-21 (multi-org independence), AC-M05-005 (directory privacy), member search < 200ms.
- **Data/schema scope:** Uses existing membership + person + privacy tables.
- **Permission/audit scope:** Roster: officers only. Directory: all org members with privacy filters applied.
- **Risks:** Search performance at scale. Privacy filter correctness.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 013-bulk-csv-import

- **Module:** M05 (Membership)
- **Description:** Stabilize bulk CSV import with per-row independent validation (M5-R3/M5-R8), cross-org matching by email/license (BR-22, M5-R2), and conflict flagging for human review.
- **Priority:** P0 -- Critical for initial org setup and bulk member onboarding.
- **Dependencies:** 012-member-roster-directory
- **Foundational?** No
- **Backend scope:** `handlers/association:member/` import endpoints. CSV parsing, row validation, identifier normalization (M5-R2), conflict detection.
- **Frontend scope:** `/org/[id]/officer/roster/import` with preview table, error rows highlighted.
- **Test scope:** AC-M01-002 (CSV preview), AC-M05-003 (bulk import performance), AC-M05-004 (license normalization), M5-R3/M5-R8 (row-independent validation), BR-22 (email/license matching). Edge: GAP-002 (conflict resolution when email matches Person A but license matches Person B).
- **Data/schema scope:** Temporary import staging table or in-memory processing.
- **Permission/audit scope:** Officers with secretary+ role. Import event logged with row counts.
- **Risks:** GAP-002 (conflict resolution UI) is MEDIUM gap -- needs admin workflow for ambiguous matches.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** large (7+ files)

---

### 014-dues-reminders-dunning

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize automated dues reminder schedule (default 60/30/7 pre-expiry, 7/30 post-expiry per M6-R5). Address GAP-012 dunning escalation stages.
- **Priority:** P0 -- Revenue protection.
- **Dependencies:** 006-dues-config-fund-allocation
- **Foundational?** No
- **Backend scope:** `handlers/dues/` reminder job (already exists as `dues.reminderProcessor`). Dunning template escalation logic.
- **Frontend scope:** Reminder schedule configuration in org settings.
- **Test scope:** M6-R5 (default schedule 60/30/7/7/30), configurable per org, dunning template selection by escalation stage, deceased/suppressed member exclusion.
- **Data/schema scope:** `dunning_template`, `dues_reminder` tables.
- **Permission/audit scope:** System-initiated. Configurable by treasurer. Delivery logged.
- **Risks:** Email volume spikes at month boundaries. Must respect notification preferences.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 015-announcements-templates

- **Module:** M07 (Communications)
- **Description:** Stabilize announcement CRUD (create/publish/archive), message template management with variable substitution, and delivery statistics tracking.
- **Priority:** P0 -- Primary officer-to-member communication channel.
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** `handlers/communication/` (28 handlers). Announcement lifecycle, template CRUD, variable substitution engine.
- **Frontend scope:** `/org/[id]/officer/communications` dashboard, compose screen.
- **Test scope:** AC-M07-001 (in-app always on), AC-M07-002 (email opt-out respected), AC-M07-003 (scheduled delivery), AC-M07-004 (delivery stats).
- **Data/schema scope:** `announcement`, `message_template` tables.
- **Permission/audit scope:** Officers create. Publish requires officer+ role. All announcements audited.
- **Risks:** Scheduled delivery timing accuracy. Template variable injection safety.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 016-email-queue-stabilization

- **Module:** M07 (Communications)
- **Description:** Stabilize async email processing pipeline (email.processor job), delivery status tracking, email cleanup job, opt-out enforcement.
- **Priority:** P0 -- Email is critical delivery channel.
- **Dependencies:** 015-announcements-templates
- **Foundational?** No
- **Backend scope:** `handlers/email/` (email.processor, email.cleanup jobs). Delivery status tracking, bounce handling.
- **Frontend scope:** Email delivery status in communication dashboard.
- **Test scope:** Email processor batch processing, cleanup retention policy, opt-out check before send, deceased member suppression.
- **Data/schema scope:** `email_queue`, `email_delivery` tables.
- **Permission/audit scope:** System-initiated. Delivery logs retained per policy.
- **Risks:** Email deliverability. Bounce rate monitoring.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 017-event-crud-registration

- **Module:** M08 (Events)
- **Description:** Stabilize event create/edit/publish lifecycle and member registration with capacity management. Verify QR check-in security (BR-18).
- **Priority:** P0 -- Events are core member engagement feature.
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** `handlers/events/` (11 handlers) + `handlers/association:operations/` event endpoints. Event lifecycle state machine, registration with capacity check.
- **Frontend scope:** `/org/[id]/officer/events` dashboard, `/my/events` member view.
- **Test scope:** AC-M08-001 (QR check-in requires authenticated scanner + valid event), AC-M08-002 (capacity management), event status transitions (draft->published->completed->cancelled).
- **Data/schema scope:** `event`, `event_registration`, `check_in` tables.
- **Permission/audit scope:** Officers create/publish events. Members register. Check-in requires authenticated scanner.
- **Risks:** Capacity race conditions under concurrent registration.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 018-event-qr-checkin

- **Module:** M08 (Events)
- **Description:** Stabilize QR code check-in flow: scanner authentication, check-in recording, duplicate prevention, manual check-in fallback.
- **Priority:** P0 -- Used at live events for attendance tracking.
- **Dependencies:** 017-event-crud-registration
- **Foundational?** No
- **Backend scope:** `handlers/events/` or `handlers/association:operations/` check-in endpoints.
- **Frontend scope:** `/org/[id]/officer/events/[id]/attendance` scanner screen.
- **Test scope:** BR-18 (authenticated scanner + valid event required), duplicate check-in prevention, manual override by officer.
- **Data/schema scope:** `check_in` table.
- **Permission/audit scope:** Officers operate scanner. Each check-in logged with timestamp + method (QR/manual).
- **Risks:** Offline scenarios at event venues. QR code forgery prevention.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 019-training-crud-enrollment

- **Module:** M09 (Training)
- **Description:** Stabilize training CRUD (create/publish/cancel/complete) and member enrollment with capacity management.
- **Priority:** P0 -- Training is the CPD/CE credit source.
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** `handlers/training/` (10 handlers). Training lifecycle state machine, enrollment with capacity.
- **Frontend scope:** `/org/[id]/officer/training` dashboard, `/my/training` member view.
- **Test scope:** Training status transitions, enrollment capacity enforcement, AC-M09-003 (no duplicate credits).
- **Data/schema scope:** `training`, `training_enrollment` tables.
- **Permission/audit scope:** Officers create training. Members enroll. Attendance confirmed by officer.
- **Risks:** Training completion triggers credit award -- must coordinate with M10.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 020-training-attendance-credit

- **Module:** M09 (Training), M10 (Credit Tracking)
- **Description:** Stabilize the cross-module flow: officer confirms attendance -> auto-credit entry created in M10 -> certificate generated in M11. Verify no duplicate AUTO credits (AC-M10-002).
- **Priority:** P0 -- Core CPD compliance workflow.
- **Dependencies:** 019-training-crud-enrollment
- **Foundational?** No
- **Backend scope:** `handlers/training/` attendance confirmation -> `handlers/association:member/` credit entry creation. Cross-module event flow.
- **Frontend scope:** `/org/[id]/officer/training/[id]/attendance` confirmation screen.
- **Test scope:** AC-M09-001 (auto-credit on attendance), AC-M10-002 (no duplicate AUTO credits), cross-module flow 6.3 (Training Attendance & Credit Award).
- **Data/schema scope:** `training_enrollment`, `credit_entry` tables. Cross-table transaction.
- **Permission/audit scope:** Officer confirms attendance. Credit entry auto-generated with source=AUTO.
- **Risks:** Transaction boundary across modules. Duplicate credit prevention under concurrent confirmation.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 021-credit-cycle-config

- **Module:** M10 (Credit Tracking)
- **Description:** Stabilize credit cycle configuration per association (BR-11: configurable start date, not calendar year). Verify cycle computation logic.
- **Priority:** P0 -- Foundation for all credit compliance reporting.
- **Dependencies:** 001-membership-status-stabilization
- **Foundational?** No
- **Backend scope:** `handlers/association:member/` credit configuration endpoints.
- **Frontend scope:** Credit cycle settings in org/association admin.
- **Test scope:** BR-11 (configurable cycle start date), cycle boundary computation, credit carryover rules.
- **Data/schema scope:** Credit cycle config in association settings.
- **Permission/audit scope:** Association admin configures. Read by all credit queries.
- **Risks:** Cycle boundary edge cases (leap year, timezone).
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 022-credit-aggregation-compliance

- **Module:** M10 (Credit Tracking)
- **Description:** Stabilize cross-org credit aggregation (AC-M10-001) and compliance views for both members and officers. Verify toggle independence (AC-M10-004).
- **Priority:** P0 -- Members need to see compliance status across all org memberships.
- **Dependencies:** 021-credit-cycle-config, 020-training-attendance-credit
- **Foundational?** No
- **Backend scope:** `handlers/association:member/` credit summary/compliance endpoints. Cross-org aggregation query.
- **Frontend scope:** `/my/credits` member view, `/org/[id]/officer/credits` officer compliance report.
- **Test scope:** AC-M10-001 (cross-org aggregation), AC-M10-003 (excess carryover), AC-M10-004 (toggle independence).
- **Data/schema scope:** `credit_entry` table. Computed aggregation (no materialized view).
- **Permission/audit scope:** Members see own credits. Officers see org-wide compliance. Platform admin sees association-wide.
- **Risks:** Query performance for cross-org aggregation at scale.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 023-documents-credentials

- **Module:** M11 (Documents & Credentials)
- **Description:** Stabilize member ID card generation (PDF + QR), certificate PDFs, public verification page with HMAC, SVG sanitization for logos.
- **Priority:** P0 -- Member-facing credential artifacts.
- **Dependencies:** 003-person-profile-spec-compliance, 001-membership-status-stabilization
- **Foundational?** No
- **Backend scope:** `handlers/documents/` (15 handlers), `handlers/certificates/` (3 handlers). PDF generation, QR code embedding, HMAC verification, SVG sanitization.
- **Frontend scope:** `/my/id-card`, verification page at `/verify/[token]`.
- **Test scope:** AC-M11-001 (QR authenticity via HMAC), AC-M11-002 (certificate available after training completion), AC-M11-003 (SVG sanitization strips scripts/events/external refs), AC-M11-004 (auto-regeneration on profile change).
- **Data/schema scope:** `member_card`, `certificate`, `document`, `verification_request` tables.
- **Permission/audit scope:** Members access own documents. Officers access org members' documents. Public verification is unauthenticated.
- **Risks:** PDF generation performance (< 3s SLA). SVG sanitization bypass vectors.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 024-elections-voting

- **Module:** M12 (Elections & Governance)
- **Description:** Stabilize full election lifecycle: create/configure, open/close nominations, online voting with ballot integrity, result computation and publication.
- **Priority:** P0 -- Governance is a core AMS feature.
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** `handlers/elections/` (6 handlers). Election state machine, nomination management, vote casting with one-vote-per-position enforcement, result tallying.
- **Frontend scope:** `/org/[id]/officer/elections` list, `/org/[id]/elections/[id]/vote` ballot, results display.
- **Test scope:** AC-M12-001 (one vote per position per member), AC-M12-002 (only Active members can vote), AC-M12-003 (results immutable after publication). Election status transitions.
- **Data/schema scope:** `election`, `election_nominee`, `election_vote` tables.
- **Permission/audit scope:** President creates elections. Active members vote. Votes are anonymized after casting. Results immutable.
- **Risks:** Vote integrity. Concurrent voting race conditions. Anonymization vs auditability tension.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** large (7+ files)

---

### 025-election-officer-transition

- **Module:** M12 (Elections & Governance), M04 (Organization Admin)
- **Description:** Stabilize the cross-module flow from election results publication to automatic officer role assignment (cross-module flow 6.5). Addresses GAP-010 partially.
- **Priority:** P0 -- Election results must flow into role assignments.
- **Dependencies:** 024-elections-voting, 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** `handlers/elections/` result publication -> `handlers/association:member/` officer role update. Cross-module event handling.
- **Frontend scope:** Officer transition confirmation screen after election results.
- **Test scope:** Cross-module flow 6.5 (winnerId, positionId, orgId passed from M12 to M04), role one-per-position constraint maintained, notification to new officer.
- **Data/schema scope:** `election`, `officer_role` tables. Cross-table transaction.
- **Permission/audit scope:** System-initiated from election results. President confirms. Transition logged.
- **Risks:** GAP-010 (election-to-officer-transition spec is inferred, not explicit). Edge cases: tied elections, declined positions.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 026-audit-retention-compliance

- **Module:** Cross-cutting (Audit)
- **Description:** Stabilize audit logging across all modules and verify 7-year financial record retention per BR-32. Verify audit.retention job configuration.
- **Priority:** P0 -- Philippine BIR compliance requirement.
- **Dependencies:** None
- **Foundational?** Yes
- **Backend scope:** `handlers/audit/` (1 handler). `audit.retention` job. Verify all financial operations emit audit events.
- **Frontend scope:** Audit log viewer for platform admin.
- **Test scope:** BR-32 (7-year retention), audit event completeness (actor, timestamp, before/after state, IP), retention job respects financial record minimum.
- **Data/schema scope:** Audit tables. Retention policy configuration.
- **Permission/audit scope:** Platform admin reads audit logs. Audit records are immutable.
- **Risks:** Storage growth over 7 years. Query performance on large audit tables.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 027-notification-service-wiring

- **Module:** Cross-cutting (Notifications)
- **Description:** Wire notification delivery service to all modules that currently lack notifications. Addresses GAP-003 (waitlist promotion notification), GAP-006 (late cancellation officer notification), GAP-012 (dunning escalation), GAP-017 (committee task overdue).
- **Priority:** P0 -- Multiple MEDIUM gaps depend on this.
- **Dependencies:** 015-announcements-templates, 016-email-queue-stabilization
- **Foundational?** No
- **Backend scope:** `handlers/notifs/` (processScheduled, cleanup jobs). Wire notification triggers from M08 (waitlist), M06 (dunning), M19 (tasks), M08 (cancellation).
- **Frontend scope:** Notification center UI (already exists). Additional notification types.
- **Test scope:** GAP-003 (waitlist auto-promote notification), GAP-006 (late cancellation notification), GAP-012 (dunning escalation notifications), GAP-017 (overdue task notification). Notification preference enforcement.
- **Data/schema scope:** `notification` table. New notification_type enum values.
- **Permission/audit scope:** System-generated notifications. Member preference opt-out respected.
- **Risks:** Notification fatigue if too many types wired at once. Must respect per-member preferences.
- **Risk level:** P1
- **Slice type:** refactor-existing
- **Complexity:** large (7+ files)

---

### 028-account-deletion-cascade

- **Module:** M02 (Member Profile), Cross-cutting
- **Description:** Stabilize account deletion with 30-day grace period (AC-M02-003), data anonymization, and cascade deletion across all 19 modules per cross-module flow 6.6.
- **Priority:** P0 -- DPA compliance requirement.
- **Dependencies:** 003-person-profile-spec-compliance
- **Foundational?** No
- **Backend scope:** `handlers/person/` deletion endpoint. `person.deletionProcessor` job. Cascade logic across membership, dues, events, training, credits, elections, committees, communications.
- **Frontend scope:** Account deletion request screen with impact preview.
- **Test scope:** AC-M02-003 (30-day grace period), cross-module flow 6.6 (cascade steps), anonymization completeness, financial record preservation (BR-32 override).
- **Data/schema scope:** Person deletion status, scheduled deletion date. Anonymization of PII fields.
- **Permission/audit scope:** Self-service deletion request. Admin can cancel during grace period. Deletion event immutably logged.
- **Risks:** Cascade completeness -- must verify all 19 modules handle person deletion. Financial records must be retained (BR-32) while PII is anonymized.
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** large (7+ files)

---

### 029-payment-receipts

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize PDF receipt generation with unique sequential numbering (ORG_CODE-YEAR-SEQ per M6-R6) and email delivery.
- **Priority:** P1
- **Dependencies:** 007-manual-payment-recording
- **Foundational?** No
- **Backend scope:** `handlers/dues/` receipt generation endpoint. Sequential number generation with gap-free sequence.
- **Frontend scope:** Receipt download button on payment history.
- **Test scope:** M6-R6 (unique receipt number format), PDF generation < 3s, email delivery with PDF attachment.
- **Data/schema scope:** Receipt number sequence per org per year.
- **Permission/audit scope:** Members see own receipts. Treasurer sees all org receipts.
- **Risks:** Sequence gap prevention under concurrent receipt generation.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 030-financial-reports

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize financial reports: collection summary, fund allocation breakdown, aging report, membership status report.
- **Priority:** P1
- **Dependencies:** 007-manual-payment-recording
- **Foundational?** No
- **Backend scope:** `handlers/dues/` or `handlers/association:operations/` reporting endpoints.
- **Frontend scope:** Financial reports section of officer dashboard.
- **Test scope:** AC-M06-005 (report accuracy), fund allocation totals match payments, aging bucket correctness.
- **Data/schema scope:** Reporting queries against existing tables. No new tables.
- **Permission/audit scope:** Treasurer and president access. Export to CSV/PDF.
- **Risks:** Report query performance on large datasets.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 031-online-payment-flow

- **Module:** M06 (Dues & Payments)
- **Description:** Stabilize member-facing online payment flow via connected payment gateway. Public payment page at `/pay/[token]`.
- **Priority:** P1
- **Dependencies:** 011-billing-gateway-stabilization, 009-payment-webhook-retry
- **Foundational?** No
- **Backend scope:** `handlers/billing/` checkout flow + `handlers/dues/` payment confirmation. Token-based public payment page.
- **Frontend scope:** `/pay/[token]` public payment page. AC-M06-003 (one-tap payment).
- **Test scope:** AC-M06-003 (one-tap payment), AC-M06-004 (concurrent payment warning), gateway error handling, payment status lifecycle.
- **Data/schema scope:** Payment session/token table.
- **Permission/audit scope:** Public page (token-gated). Payment events logged.
- **Risks:** Gateway downtime handling. Token security (expiry, single-use).
- **Risk level:** P1
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 032-paid-events

- **Module:** M08 (Events)
- **Description:** Implement event fee collection through M06 billing integration. Registration requires payment for paid events per cross-module flow 6.4.
- **Priority:** P1
- **Dependencies:** 017-event-crud-registration, 011-billing-gateway-stabilization
- **Foundational?** No
- **Backend scope:** `handlers/events/` + `handlers/billing/` integration. Fee configuration on event, payment-gated registration.
- **Frontend scope:** Payment step in event registration flow.
- **Test scope:** AC-M08-003 (paid event registration requires payment), cross-module flow 6.4 steps 1-3, refund on event cancellation.
- **Data/schema scope:** `event` fee fields, `event_registration` payment status.
- **Permission/audit scope:** Officers set event fees. Members pay at registration. Refund on cancellation.
- **Risks:** Payment gateway integration complexity. Refund flow depends on 008-refund-handler.
- **Risk level:** P1
- **Slice type:** new-feature
- **Complexity:** medium (4-6 files)

---

### 033-event-waitlisting

- **Module:** M08 (Events)
- **Description:** Implement waitlist auto-promotion when registered member cancels, with notification to promoted member. Addresses GAP-003.
- **Priority:** P1
- **Dependencies:** 017-event-crud-registration
- **Foundational?** No
- **Backend scope:** `handlers/events/` waitlist logic. Auto-promotion on cancellation trigger.
- **Frontend scope:** Waitlist position display for members. Promotion notification.
- **Test scope:** Waitlist ordering (FIFO), auto-promotion on cancellation, notification sent (GAP-003), capacity constraint maintained.
- **Data/schema scope:** `event_registration` waitlist status, position field.
- **Permission/audit scope:** System-initiated promotion. Member notified.
- **Risks:** Race condition on concurrent cancellation + registration.
- **Risk level:** P2
- **Slice type:** new-feature
- **Complexity:** small (1-3 files)

---

### 034-paid-training

- **Module:** M09 (Training)
- **Description:** Implement training fee collection through M06 billing integration. Enrollment requires payment for paid training.
- **Priority:** P1
- **Dependencies:** 019-training-crud-enrollment, 011-billing-gateway-stabilization
- **Foundational?** No
- **Backend scope:** `handlers/training/` + `handlers/billing/` integration. Fee configuration, payment-gated enrollment.
- **Frontend scope:** Payment step in training enrollment flow.
- **Test scope:** Paid enrollment requires payment, refund on training cancellation, fee configuration by officer.
- **Data/schema scope:** `training` fee fields, `training_enrollment` payment status.
- **Permission/audit scope:** Officers set training fees. Members pay at enrollment.
- **Risks:** Similar to 032 -- payment gateway integration.
- **Risk level:** P1
- **Slice type:** new-feature
- **Complexity:** medium (4-6 files)

---

### 035-committee-crud-membership

- **Module:** M19 (Committee Management)
- **Description:** Stabilize committee CRUD (create/edit/dissolve), member management (add/remove), chairperson requirement enforcement (AC-M19-001).
- **Priority:** P1
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** `handlers/association:member/` or `handlers/association:operations/` committee endpoints. Committee lifecycle, member management, cascading removal (AC-M19-004).
- **Frontend scope:** `/org/[id]/officer/committees` list and detail screens.
- **Test scope:** AC-M19-001 (chairperson required), AC-M19-002 (ad-hoc dissolution), AC-M19-004 (cascading member removal from org removes from committees).
- **Data/schema scope:** `committee`, `committee_member` tables.
- **Permission/audit scope:** Officers manage committees. Chairperson has committee-scoped permissions.
- **Risks:** Cascading removal complexity when member removed from org.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 036-committee-tasks

- **Module:** M19 (Committee Management)
- **Description:** Stabilize task management within committees: create, assign, track status, overdue notifications (GAP-017).
- **Priority:** P1
- **Dependencies:** 035-committee-crud-membership
- **Foundational?** No
- **Backend scope:** `handlers/association:member/` or `handlers/association:operations/` task endpoints.
- **Frontend scope:** Task board on committee detail screen.
- **Test scope:** AC-M19-003 (overdue task visibility), task status transitions, assignment to committee members only, GAP-017 (overdue notification wiring).
- **Data/schema scope:** `committee_task` table.
- **Permission/audit scope:** Chairperson and officers manage tasks. Committee members update own task status.
- **Risks:** GAP-017 notification wiring depends on 027.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** small (1-3 files)

---

### 037-professional-feed

- **Module:** M13 (Professional Feed)
- **Description:** Stabilize professional feed: chronological display, officer post creation, moderation (hide/remove posts).
- **Priority:** P1
- **Dependencies:** 001-membership-status-stabilization
- **Foundational?** No
- **Backend scope:** Feed aggregation query, post CRUD, moderation endpoints.
- **Frontend scope:** `/org/[id]/feed` display, inline post creation.
- **Test scope:** AC-M13-001 (feed visibility scoped to org), AC-M13-002 (muting), AC-M13-003 (moderation removes post from all views).
- **Data/schema scope:** `post` table with org scoping.
- **Permission/audit scope:** Officers create posts. Active members view. Officers moderate.
- **Risks:** Feed query performance with large post volume.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 038-job-board

- **Module:** M15 (Job Board)
- **Description:** Stabilize job listing CRUD, search/browse with filters, save jobs, and auto-expiry (30 days per AC-M15-001).
- **Priority:** P1
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** Job listing endpoints, search with filters, saved jobs, expiry cron.
- **Frontend scope:** `/org/[id]/jobs` browse, `/org/[id]/officer/jobs/new` create.
- **Test scope:** AC-M15-001 (30-day auto-expiry), AC-M15-002 (external employer approval), AC-M15-003 (access gating by membership status).
- **Data/schema scope:** `job_listing`, `saved_job`, `job_alert` tables.
- **Permission/audit scope:** Officers post jobs. Active members browse. External employers require approval.
- **Risks:** GAP-019 (auto-extension max not specified).
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 039-surveys-polls

- **Module:** M18 (Surveys & Polls)
- **Description:** Stabilize survey CRUD, response collection, anonymity enforcement (AC-M18-001), deadline enforcement (AC-M18-002).
- **Priority:** P1
- **Dependencies:** 005-org-admin-officer-roles
- **Foundational?** No
- **Backend scope:** Survey CRUD, response submission, results aggregation.
- **Frontend scope:** `/org/[id]/officer/surveys` management, `/my/surveys/[id]` response form, results dashboard.
- **Test scope:** AC-M18-001 (anonymity guarantee -- no respondent identification), AC-M18-002 (deadline enforcement -- no submissions after close), AC-M18-003 (results visible only to officers).
- **Data/schema scope:** `survey`, `survey_response` tables.
- **Permission/audit scope:** Officers create surveys. Members respond. Results officer-only.
- **Risks:** GAP-016 (concurrent edit conflict resolution).
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 040-national-dashboard

- **Module:** M14 (National Dashboard)
- **Description:** Stabilize cross-chapter KPI cards, chapter comparison table, per-chapter drill-down view. Association-scoped data only.
- **Priority:** P1
- **Dependencies:** 001-membership-status-stabilization, 006-dues-config-fund-allocation
- **Foundational?** No
- **Backend scope:** `handlers/association:operations/` analytics endpoints (54 handlers). Cross-chapter aggregation queries.
- **Frontend scope:** `/admin/national` dashboard, `/admin/national/[id]/orgs/[id]` drill-down.
- **Test scope:** AC-M14-001 (cross-chapter aggregation accuracy), AC-M14-002 (access scoping -- association admin only), AC-M14-003 (export accuracy matches dashboard).
- **Data/schema scope:** Computed views/queries across membership, dues, credit tables.
- **Permission/audit scope:** Association president/secretary or platform admin. Data scoped to association.
- **Risks:** Query performance across many chapters. Caching strategy for dashboard.
- **Risk level:** P2
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 041-booking-slot-management

- **Module:** M08 (Events/Booking)
- **Description:** Refactor booking subsystem: slot generation, cleanup, confirmation timer jobs for reliability and spec compliance.
- **Priority:** P1
- **Dependencies:** 017-event-crud-registration
- **Foundational?** No
- **Backend scope:** `handlers/booking/` (19 handlers). `booking.slotGenerator`, `booking.confirmationTimer`, `booking.slotCleanup` jobs.
- **Frontend scope:** Booking slot selection UI.
- **Test scope:** Slot generation correctness, confirmation timer (15-min window), slot cleanup for expired bookings, notification on auto-rejection.
- **Data/schema scope:** `booking`, `time_slot` tables.
- **Permission/audit scope:** Members book slots. System manages lifecycle.
- **Risks:** Timer accuracy. Concurrent slot booking race conditions.
- **Risk level:** P2
- **Slice type:** refactor-existing
- **Complexity:** medium (4-6 files)

---

### 042-certificate-pdf-generation

- **Module:** M11 (Documents & Credentials), M09 (Training)
- **Description:** Refactor training certificate PDF generation with QR verification code, ensuring certificate availability after training completion.
- **Priority:** P1
- **Dependencies:** 020-training-attendance-credit, 023-documents-credentials
- **Foundational?** No
- **Backend scope:** `handlers/certificates/` (3 handlers). PDF template, QR embedding, HMAC verification URL.
- **Frontend scope:** Certificate download on `/my/training`.
- **Test scope:** AC-M11-002 (certificate available after completion), QR verification via public page, PDF generation < 3s.
- **Data/schema scope:** `certificate` table.
- **Permission/audit scope:** Members download own certificates. Public verification page.
- **Risks:** PDF template consistency across different training types.
- **Risk level:** P2
- **Slice type:** refactor-existing
- **Complexity:** small (1-3 files)

---

### 043-credit-transcript-pdf

- **Module:** M10 (Credit Tracking)
- **Description:** Implement credit transcript PDF export with cycle-by-cycle breakdown. Addresses GAP-018.
- **Priority:** P1
- **Dependencies:** 022-credit-aggregation-compliance
- **Foundational?** No
- **Backend scope:** New endpoint in credit handlers. PDF generation with credit entries grouped by cycle.
- **Frontend scope:** Export button on `/my/credits`.
- **Test scope:** Transcript includes all credit types (AUTO, MANUAL), cycle boundaries correct, cross-org credits included.
- **Data/schema scope:** No new tables. Query existing credit_entry.
- **Permission/audit scope:** Members export own transcript. Officers export for org members.
- **Risks:** PDF format not fully specified in spec (GAP-018).
- **Risk level:** P2
- **Slice type:** new-feature
- **Complexity:** small (1-3 files)

---

### 044-bulk-payment-recording

- **Module:** M06 (Dues & Payments)
- **Description:** Implement bulk payment recording for treasurers (currently only individual). Addresses GAP-005.
- **Priority:** P1
- **Dependencies:** 007-manual-payment-recording
- **Foundational?** No
- **Backend scope:** New bulk endpoint in `handlers/dues/`. Batch validation, per-row error handling, fund allocation for each.
- **Frontend scope:** Bulk payment form with CSV upload or multi-select from roster.
- **Test scope:** Batch validation (per-row independent), fund allocation per payment, concurrent batch warning, partial failure handling.
- **Data/schema scope:** No new tables. Batch of individual payment records.
- **Permission/audit scope:** Treasurer only. Each payment individually audited.
- **Risks:** Large batch performance. Transaction boundaries.
- **Risk level:** P2
- **Slice type:** new-feature
- **Complexity:** medium (4-6 files)

---

### 045-marketplace-vendor

- **Module:** M17 (Marketplace)
- **Description:** Stabilize vendor management (registration, verification) and marketplace browse (search, filter). Phase 3 feature.
- **Priority:** P2
- **Dependencies:** 004-platform-admin-stabilization
- **Foundational?** No
- **Backend scope:** Vendor CRUD, verification workflow, listing management.
- **Frontend scope:** `/org/[id]/marketplace` browse.
- **Test scope:** AC-M17-001 (vendor verification required), AC-M17-002 (access gating by membership tier).
- **Data/schema scope:** `vendor`, `marketplace_listing` tables.
- **Permission/audit scope:** Platform admin verifies vendors. Active members browse.
- **Risks:** Marketplace is Phase 3 -- may not have full schema in place.
- **Risk level:** P3
- **Slice type:** stabilize-existing
- **Complexity:** medium (4-6 files)

---

### 046-advertising-campaigns

- **Module:** M16 (Advertising)
- **Description:** Stabilize advertiser management, campaign CRUD, creative review/approval workflow, feed placement integration.
- **Priority:** P2
- **Dependencies:** 004-platform-admin-stabilization, 037-professional-feed
- **Foundational?** No
- **Backend scope:** Campaign CRUD, creative approval workflow, ad serving logic, impression/click tracking.
- **Frontend scope:** `/admin/advertising` dashboard, campaign detail.
- **Test scope:** AC-M16-001 (creative approval before display), AC-M16-002 (targeting without PII exposure), AC-M16-003 (sponsored label), AC-M16-004 (member opt-out).
- **Data/schema scope:** `advertiser`, `campaign`, `creative` tables.
- **Permission/audit scope:** Platform admin manages advertisers. Creative requires admin approval.
- **Risks:** Ad serving performance. Targeting privacy compliance.
- **Risk level:** P3
- **Slice type:** stabilize-existing
- **Complexity:** large (7+ files)

---

### 047-chat-rooms-websocket

- **Module:** M07 (Communications)
- **Description:** Refactor real-time WebSocket chat room infrastructure for reliability and spec compliance.
- **Priority:** P2
- **Dependencies:** 002-auth-session-hardening
- **Foundational?** No
- **Backend scope:** `handlers/comms/` (11 handlers). WebSocket connection management, room creation, message delivery.
- **Frontend scope:** Chat UI components.
- **Test scope:** WebSocket connection lifecycle, message ordering, room membership enforcement, reconnection handling.
- **Data/schema scope:** `chat_room`, `message` tables.
- **Permission/audit scope:** Org members access org chat rooms.
- **Risks:** WebSocket scaling. Message persistence vs real-time delivery.
- **Risk level:** P2
- **Slice type:** refactor-existing
- **Complexity:** large (7+ files)

---

### 048-video-calls

- **Module:** M07 (Communications)
- **Description:** Refactor WebRTC video call infrastructure for reliability and spec compliance.
- **Priority:** P2
- **Dependencies:** 047-chat-rooms-websocket
- **Foundational?** No
- **Backend scope:** `handlers/comms/` video call signaling. STUN/TURN server integration.
- **Frontend scope:** Video call UI with participant management.
- **Test scope:** Call initiation, participant join/leave, connection fallback, concurrent call limits.
- **Data/schema scope:** `video_call` table.
- **Permission/audit scope:** Org members initiate calls.
- **Risks:** WebRTC NAT traversal. TURN server costs and availability.
- **Risk level:** P3
- **Slice type:** refactor-existing
- **Complexity:** large (7+ files)

---

## Parallel Execution Groups

| Group | Slices | Shared Schema? | Interface Contracts Needed |
|-------|--------|----------------|---------------------------|
| G1: Foundation | 001, 002, 026 | No | None -- independent foundations |
| G2: Core Admin | 003, 004 | No | Both depend on G1 auth but not each other |
| G3: Org + Members | 005, 012 | Yes (membership) | Officer role -> membership queries |
| G4: Financial Foundation | 006, 010 | No | 006 needs 001+005; 010 needs 001 only |
| G5: Payments | 007, 011, 014 | Yes (dues) | Gateway + manual payment + reminders |
| G6: HIGH Gaps | 008, 009 | Yes (dues_payment) | Both modify payment state machine |
| G7: Activities | 017, 019, 024 | No | All depend on 005 but not each other |
| G8: Activity Follow-up | 018, 020, 025 | No | Each follows its G7 parent |
| G9: Content Modules | 015, 021 | No | Independent module stabilization |
| G10: Compliance | 022, 023, 013 | No | Credits, docs, import -- independent |
| G11: Cross-Cutting | 027, 028 | No | Notification wiring + deletion cascade |
| G12: P1 Features | 029-036 | Mixed | Various -- see dependencies |
| G13: P1 Content | 037-040 | No | Feed, jobs, surveys, dashboard -- independent |
| G14: P1 Refactors | 041-044 | No | Booking, certificates, transcript, bulk pay |
| G15: Phase 3 | 045-048 | No | Marketplace, ads, chat, video -- independent |

## Recommended First Slice

**Slice 001-membership-status-stabilization**

Rationale:
1. **Zero dependencies** -- can start immediately
2. **Maximum downstream impact** -- 12+ slices depend on correct membership status computation
3. **Existing code** -- handlers already implemented (157 handlers in association:member), making this a stabilization task not greenfield
4. **Verifiable** -- clear acceptance criteria (BR-01: status = f(dues_expiry_date), BR-02: org-specific grace period)
5. **Risk reducer** -- if status computation is wrong, every module that checks membership status (events, training, elections, credits, directory, dues) is affected
6. **Pattern-establishing** -- defines the computed-on-read pattern that other modules should follow

Parallel start: slices 002 (auth hardening) and 026 (audit retention) can begin simultaneously as they share no dependencies with 001.

## HIGH Gaps from WORKFLOW_MAP

| Gap ID | Description | Addressing Slice | Status |
|--------|-------------|-----------------|--------|
| GAP-001 | No explicit refund handler in dues module -- BR-08 requires refund with expiry reversal | **008-refund-handler** | New feature. P0. Implements full/partial refund with allocation reversal and expiry date rollback. |
| GAP-009 | Payment webhook failure retry strategy not specified -- only "failed" terminal state | **009-payment-webhook-retry** | New feature. P0. Adds retry queue with exponential backoff, dead letter queue, circuit breaker. |
| GAP-015 | Grace period -> Lapsed automatic transition has no explicit scheduled job | **010-grace-lapsed-cron** | New feature. P0. Implements pg-boss cron job `membership.graceToLapsed` with batch processing. |

All three HIGH gaps are addressed as P0 slices with explicit implementation scope. GAP-001 and GAP-009 are in parallel group G6 (both depend on 007). GAP-015 is in group G4 (depends only on 001).

## MEDIUM Gaps Coverage

| Gap ID | Description | Addressing Slice |
|--------|-------------|-----------------|
| GAP-002 | Bulk import conflict resolution | 013-bulk-csv-import (flagged as risk) |
| GAP-003 | Waitlist auto-promotion notification | 027-notification-service-wiring + 033-event-waitlisting |
| GAP-005 | No bulk payment recording | 044-bulk-payment-recording |
| GAP-006 | Late cancellation officer notification | 027-notification-service-wiring |
| GAP-010 | Election-to-officer transition inferred | 025-election-officer-transition |
| GAP-012 | Dunning escalation stages | 014-dues-reminders-dunning + 027-notification-service-wiring |

## PRD Gaps or Ambiguities

| Issue | Affects Slices | Resolution Needed |
|-------|---------------|-------------------|
| Refund approval threshold not specified -- does treasurer need president approval for large refunds? | 008-refund-handler | Define threshold amount and approval workflow |
| Partial refund allocation reversal algorithm not specified -- proportional or LIFO? | 008-refund-handler | Define reversal strategy in MODULE_SPEC |
| Webhook retry max attempts and dead letter handling not specified | 009-payment-webhook-retry | Define max retries (recommend 5), backoff schedule, alerting |
| Grace-to-Lapsed cron frequency not specified | 010-grace-lapsed-cron | Define schedule (recommend daily at 00:00 UTC+8) |
| Credit transcript PDF format not specified (GAP-018) | 043-credit-transcript-pdf | Define template: cycle columns, credit types, totals, org breakdown |
| Election tie-breaking rule not specified | 024-elections-voting, 025-election-officer-transition | Define: runoff vs president decides vs random |
| Concurrent edit conflict resolution for survey responses (GAP-016) | 039-surveys-polls | Define: last-write-wins vs optimistic locking |
| Job listing auto-extension max count not specified (GAP-019) | 038-job-board | Define max extensions (recommend 2) |
| Ad creative re-submission workflow after rejection (GAP-020) | 046-advertising-campaigns | Define: new creative vs revision of rejected |
| Committee data archival strategy after dissolution (GAP-011) | 035-committee-crud-membership | Define: soft delete vs archive table vs retention period |
