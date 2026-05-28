<!-- oli-version: 1.2 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-29T12:00:00Z -->

# Enforcement Report

**Generated:** 2026-05-29
**Engine:** oli-enforce-all v3 --strict
**Scope:** 19 modules, 8 phases, 44 agents
**Baseline:** 2026-05-28T12:00:00Z → 2026-05-29
**Coverage Score:** 62 → 65 (↑3)

---

## Executive Summary

| Severity | Count | Baseline | Delta |
|----------|-------|----------|-------|
| **P0** | 23 | 23 | → (0 net — 13 NEW, 13 KNOWN, 3 NOT_RETESTED) |
| **P1** | 109 | ~170 | ↓ (deeper analysis, fewer false P1s in future modules) |
| **P2** | 108 | ~92 | ↑ (deeper file-level analysis found more validation gaps) |
| **P3** | 40 | ~40 | → |
| **Total** | **280** | **~325** | ↓ net |

**--strict verdict:** **13 NEW P0 findings detected.** See [New P0 Regressions](#new-p0-regressions) below.

---

## Audit Scope

| Phase | Skill | Status | Agents | Findings |
|-------|-------|--------|--------|----------|
| -1 | oli-codebase-map | SKIPPED | 0 | codebase_map.auto_phase = false |
| -0.5 | Map Health | SKIPPED | 0 | No CODE_MODULE_MAP.json |
| 0 | oli-enforce-coverage | COMPLETE | 1 | 24 (8 P0, 15 P2, 1 P3) |
| 1 | oli-enforce-module + file | COMPLETE | 8 (4 batches x 2 checks) | 154 |
| 1.5 | oli-ui-journey | COMPLETE | 1 | 27 (1 P0, 2 P1, 13 P2, 11 P3) |
| 2 | oli-enforce-cross-module | COMPLETE | 1 | 13 (1 P0, 9 P1, 3 P2) |
| 2.5 | oli-trace | COMPLETE | 1 | 18 (2 P1, 11 P2, 5 P3) |
| 3 | oli-audit-compliance | COMPLETE | 1 | 44 (1 P0, 25 P1, 17 P2, 1 P3) |
| 4 | Merge + Ratchet | COMPLETE | 0 | -- |

**Artifacts reviewed:** 19 MODULE_SPECs, MODULE_MAP.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, EVENT_CONTRACTS.md, AUDIT_CONTRACTS.md, 24 handler directories, apps/memberry/src/ routes+components

---

## P0 Findings (Inline -- All 23)

### KNOWN P0s (from baseline, still present)

| ID | Module | First Seen | Description | Age |
|----|--------|------------|-------------|-----|
| EM-M07-cancelled | M07 | 2026-05-27 | Missing `cancelled` enum value in message status | 2d |
| EM-M07-zero-events | M07 | 2026-05-27 | Zero domain events emitted across all comms directories | 2d |
| EM-M07-deceased | M07 | 2026-05-27 | No deceased/suppressed recipient check (M7-R5) | 2d |
| EM-M07-no-typespec | M07 | 2026-05-27 | No communication.tsp TypeSpec file -- routes hand-wired | 2d |
| EM-M08-publish | M08 | 2026-05-28 | publishEvent handler does not exist -- events stuck in draft | 1d |
| EM-M08-complete | M08 | 2026-05-28 | completeEvent handler does not exist -- events never complete | 1d |
| EM-M09-dead-code | M09 | 2026-05-28 | 8/14 training handler files are dead code -- not routed | 1d |
| EX-NOTIF-enum | CROSS | 2026-05-28 | Notification type enum drift -- 4 types in schema but not DOMAIN_MODEL | 1d |
| UJ-NAV-orphan6 | UI | 2026-05-27 | Orphaned routes with no navigation paths (refined to specific routes) | 2d |
| UJ-NAV-legacy | UI | 2026-05-27 | Legacy officer/dues routes coexist with officer/finances | 2d |
| UJ-NAV-officer3 | UI | 2026-05-27 | 3 officer routes orphaned from sidebar | 2d |
| UJ-SDK-raw | UI | 2026-05-28 | Raw api.get() calls bypass SDK type safety | 1d |
| AL-PERSON-a1b2c3d4 | AUDIT | 2026-05-28 | exportMyData returns full PII with NO audit log | 1d |

### NOT RETESTED (dependency scanning phase not in current run)

| ID | Module | First Seen | Description |
|----|--------|------------|-------------|
| ED-GLOBAL-xg6xh9c9 | DEP | 2026-05-28 | better-auth 2FA Bypass via Premature Session Caching |
| ED-GLOBAL-qpm26cq5 | DEP | 2026-05-28 | happy-dom code generation bypass (dev-only) |
| ED-GLOBAL-37j7fg3j | DEP | 2026-05-28 | happy-dom VM Context Escape RCE (dev-only) |

### NEW P0 Regressions {#new-p0-regressions}

These are P0s found in this run that were NOT in the previous baseline. **--strict gate: FAIL.**

| ID | Module | Description | Phase |
|----|--------|-------------|-------|
| EF-M01-export-pii | M01 | exportMyData returns ALL PII fields unfiltered -- data exfiltration surface | 1 |
| EF-M02-update-no-session-invalidation | M02 | No session invalidation on password change (M2-R2) | 1 |
| EF-M03-impersonation-no-write-block | M03 | Impersonation write-block is UI-only, no API enforcement (M3-R4) | 1 |
| EF-M03-impersonation-no-auto-expire | M03 | Impersonation session has no server-side expiration check (M3-R3) | 1 |
| EF-M04-directory-no-privacy | M04 | Directory profiles bypass org membership check -- non-members access member data | 1 |
| EF-M07-webrtc-token-placeholder | M07 | WebRTC auth returns hardcoded 'USE_SESSION_TOKEN' sentinel | 1 |
| EF-M08-listEvents-no-auth | M08 | listEvents has ZERO authentication -- exposes all org events including drafts | 1 |
| EF-M10-005 | M10 | SQL wildcard injection in training search LIKE pattern | 1 |
| EF-M11-002 | M11 | Missing HMAC QR signing -- certificate verification has no cryptographic proof | 1 |
| EF-M11-004 | M11 | Missing SVG sanitization -- XSS via document/certificate uploads | 1 |
| EF-M11-005 | M11 | IDOR in uploadNewDocumentVersion -- no org-scope check | 1 |
| EF-M12-001 | M12 | getElection has no auth + no org-scope -- full data leak including vote tallies | 1 |
| EF-M14-004 | M14 | CSV injection in national dashboard export (formula chars unescaped) | 1 |

---

## P1 Findings (Inline -- Top 30 by Impact)

### Module Enforcement (EM-*)

| ID | Module | Description |
|----|--------|-------------|
| EM-M01-events | M01 | 3/4 declared domain events not emitted (SessionCreated, InvitationClaimed, OnboardingCompleted) |
| EM-M01-onboarding | M01 | Onboarding wizard endpoints (GET/PUT /onboarding/*) have no handler files |
| EM-M02-events | M02 | 4/5 domain events missing (PersonUpdated, DataExportReady, DeletionRequested, DeletionCancelled) |
| EM-M02-email-change | M02 | Email change accepts directly -- no OTP verification (M2-R1) |
| EM-M03-missing-handlers | M03 | 3 spec-declared handlers missing: toggleFeatureFlag, updateOrgStatus, getDashboardMetrics |
| EM-M03-events | M03 | Zero domain events emitted in platformadmin (spec declares 4) |
| EM-M03-admin-team | M03 | Admin team management endpoints (invite/role/delete) unimplemented |
| EM-M04-events-partial | M04 | OfficerRemoved and OrgUpdated events not emitted |
| EM-M04-transition-handler | M04 | Officer transition workflow handler missing |
| EM-M05-status-compute | M05 | Membership status directly written (contradicts computed-status model BR-01) |
| EM-M05-events | M05 | 6/6 declared domain events not emitted -- zero domainEvents.emit() calls |
| EM-M06-no-refund-handler | M06 | No refund endpoint despite spec WF-041 |
| EM-M07-chatroom-no-domain-event | M07 | ChatRoomCreated event not emitted |
| EM-M08-no-event-published-event | M08 | EventPublished event not emitted, no publish handler |
| EM-M09-no-certificate-generation | M09 | Training completion does not trigger certificate generation (BR-20) |
| EM-M10-004 | M10 | markComplete swallows credit creation errors silently |
| EM-M10-006 | M10 | Zero auditAction calls across all training mutation handlers |
| EM-M10-001 | M10 | 5 credit-specific endpoints declared but none implemented |
| EM-M11-001 | M11 | Zero domain events across 21 document+certificate handlers |
| EM-M11-009 | M11 | ID card generation workflow entirely unimplemented |
| EM-M11-011 | M11 | createDocument has no role restriction -- any user creates in any org |

### File Enforcement (EF-*)

| ID | Module | Description |
|----|--------|-------------|
| EF-M06-reminder-no-consent | M06 | Payment reminders sent without opt-out/consent check |
| EF-M07-announcement-send-job | M07 | Announcement delivery ignores per-member subscription preferences |
| EF-M08-no-audit-trail | M08 | Zero auditAction calls across all event mutation handlers |
| EF-M09-listTrainings-no-auth | M09 | listTrainings has no authentication -- mirrors M08 pattern |
| EF-M12-003 | M12 | listElections has no org-scope enforcement |
| EF-M12-005 | M12 | Bylaw ratification workflow declared but not enforced |
| EF-M14-001 | M14 | Summary dashboard endpoint unimplemented |
| EF-M14-002 | M14 | Chapter drill-down endpoint unimplemented |

### Cross-Module (EX-*)

| ID | Description |
|----|-------------|
| EX-EVENT-orphan-batch1 | 13 domain events emitted but never consumed -- broken downstream chains |
| EX-EVENT-training-dup | training.completed emitted from 3 separate files, zero consumers |
| EX-EVENT-booking-notify-gap | booking.created/rejected have no notification consumer |
| EX-EVENT-payload-mismatch | EVENT_CONTRACTS payload shapes may not match DomainEventMap types |
| EX-NOTIF-missing-types | High-volume events use generic 'system' notification type |
| EX-IMPORT-cross-context-high | Bidirectional coupling between dues and association:member |
| EX-IMPORT-events-membership | events/ imports MembershipRepository from 2 inconsistent paths |
| EX-IMPORT-schema-spider | 28+ cross-handler schema imports -- missing shared abstractions |
| EX-SCHEMA-template-status | Duplicate pgEnum 'template_status' across communication + email |

### Traceability (TR-*)

| ID | Description |
|----|-------------|
| TR-GLOBAL-c3d4e5f6 | person.updated emitted but never consumed -- profile changes not propagated |
| TR-GLOBAL-c4d5e6f7 | person.created emitted but never consumed -- onboarding flow disconnected |

### Audit Compliance (AL-*) -- 25 P1 findings

See `docs/product/TRACE_AUDIT_REPORT.md` for full list. Top clusters:
- **9 auth events** (login, lockout, impersonation, MFA) unaudited -- Better-Auth has no audit hook
- **6 membership events** -- membership handler dir has ZERO auditAction calls
- **4 financial events** -- refund, invoice generation/voiding, billing config unaudited
- **3 certificate/document events** -- credential verification, certificate generation unaudited

### Future Modules (EM-M15 through EM-M19) -- 35 P1 findings

All 5 future modules share identical 7 missing spec sections (template-level gap):
User Stories, Functional Requirements, Non-Functional Requirements, Validation Rules, Notifications, Migration Strategy, Open Questions.

**Recommendation:** Add these sections to MODULE_SPEC template OR formally exclude from 22-section checklist (specs use alternative coverage: Workflows, Business Rules, etc.).

---

## P2/P3 Detail Files

Full P2/P3 findings in linked sub-skill artifacts:

- Module m01-m05: `docs/audits/ENFORCE_M01_M05_PHASE1.md`
- Module m06-m09: `docs/audits/ENFORCE_M06_M09_REPORT.md`
- Module m10-m14: `docs/audits/ENFORCE_M10_M14_REPORT.md`
- UI Journey: `docs/audits/UI_JOURNEY_AUDIT.md`
- Cross-module: `docs/audits/CROSS_MODULE_ALIGNMENT_REPORT.md`
- Trace + Audit: `docs/product/TRACE_AUDIT_REPORT.md`
- Coverage: `docs/product/SPEC_COVERAGE_REPORT.md`

---

## Coverage Findings (Phase 0)

| Metric | Score |
|--------|-------|
| Breadth (modules with specs / total modules with code) | 100% (19/19) |
| Depth (avg sections filled / 22) | 94.8% |
| Overall Coverage Score | 65/100 |

### Unspecced Handler Directories (8 -- all P0)

| Directory | Handlers | Description |
|-----------|----------|-------------|
| booking/ | 19 | Time-based scheduling -- no MODULE_SPEC |
| billing/ | 16 | Stripe Connect integration -- no MODULE_SPEC |
| email/ | 13 | Transactional email queue -- no MODULE_SPEC |
| storage/ | 6 | File upload/download via S3/MinIO -- no MODULE_SPEC |
| notifs/ | 6 | OneSignal notifications -- no MODULE_SPEC |
| reviews/ | 4 | NPS review system -- no MODULE_SPEC |
| invite/ | 3 | Org invitations -- no MODULE_SPEC |
| audit/ | 1 | Compliance logging -- no MODULE_SPEC |

**Total unspecced handlers:** 68 (11.4% of codebase)

---

## Module Compliance (Phase 1)

| Module | P0 | P1 | P2 | P3 | Score | Trend |
|--------|----|----|----|----|-------|-------|
| M01 Auth & Onboarding | 1 | 3 | 3 | 1 | 6.0 | -> |
| M02 Member Profile | 1 | 2 | 3 | 1 | 6.4 | -> |
| M03 Platform Admin | 2 | 3 | 3 | 1 | 6.5 | v (new P0s) |
| M04 Org Admin | 1 | 3 | 3 | 1 | 6.5 | v (new P0) |
| M05 Membership | 0 | 3 | 3 | 1 | 6.0 | -> |
| M06 Dues & Payments | 0 | 3 | 4 | 1 | 6.5 | -> |
| M07 Communications | 1 | 3 | 5 | 2 | 5.5 | v (WebRTC P0) |
| M08 Events | 1 | 2 | 5 | 1 | 4.0 | -> |
| M09 Training | 0 | 2 | 4 | 1 | 5.0 | -> |
| M10 Credit Tracking | 1 | 3 | 3 | 2 | 6.5 | v (SQL P0) |
| M11 Documents & Credentials | 2 | 4 | 4 | 2 | 3.0 | -> |
| M12 Elections & Governance | 1 | 2 | 3 | 2 | 5.5 | v (auth P0) |
| M13 Professional Feed | 0 | 1 | 0 | 0 | 0.0 | -> (future) |
| M14 National Dashboard | 1 | 2 | 2 | 1 | 5.0 | v (CSV P0) |
| M15-M19 (5 future) | 0 | 35 | 4 | 5 | 0.0 | -> (future) |

---

## UI Journey (Phase 1.5)

| Registry | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Dead Interactions | 0 | 1 | 2 | 1 | 4 |
| Journey Completion | 0 | 1 | 3 | 2 | 6 |
| Orphaned Routes | 1 | 0 | 7 | 6 | 14 |
| Legacy/Conflicting | 0 | 0 | 1 | 2 | 3 |
| **Total** | **1** | **2** | **13** | **11** | **27** |

Top: `/discover/events` completely unreachable (P0). `/officer/national-dashboard` 404 on click (P1).

Full detail: `docs/audits/UI_JOURNEY_AUDIT.md`

---

## Cross-Module (Phase 2)

| Category | P0 | P1 | P2 | Total |
|----------|----|----|----|----|
| Event Contract | 0 | 4 | 1 | 5 |
| Notification Enum | 1 | 1 | 0 | 2 |
| Import Direction | 0 | 3 | 0 | 3 |
| Shared Schema | 0 | 1 | 0 | 1 |
| Domain Terminology | 0 | 0 | 2 | 2 |
| **Total** | **1** | **9** | **3** | **13** |

Systemic: 13 orphan events, bidirectional dues/membership coupling, duplicate pgEnum.

Full detail: `docs/audits/CROSS_MODULE_ALIGNMENT_REPORT.md`

---

## Traceability (Phase 2.5)

| Algorithm | P0 | P1 | P2 | P3 | Total |
|-----------|----|----|----|----|-------|
| 5a Orphan BRs | 0 | 0 | 4 | 0 | 4 |
| 5b Orphan Stories | 0 | 0 | 1 | 0 | 1 |
| 5c Unspecced Impl | 0 | 0 | 0 | 0 | 0 |
| 5d Chain Breaks | 0 | 0 | 0 | 0 | 0 |
| 5e Dead Refs | 0 | 0 | 0 | 0 | 0 |
| 5f Event Chain | 0 | 2 | 6 | 5 | 13 |
| **Total** | **0** | **2** | **11** | **5** | **18** |

Chain health: 86% -> 86% (->). 13 events emitted but never consumed.

---

## Audit Compliance (Phase 3)

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Auth events | 0 | 9 | 0 | 0 | 9 |
| PII/data events | 1 | 3 | 2 | 0 | 6 |
| Financial events | 0 | 4 | 3 | 0 | 7 |
| Membership events | 0 | 6 | 0 | 0 | 6 |
| Governance events | 0 | 2 | 3 | 0 | 5 |
| Admin events | 0 | 0 | 5 | 0 | 5 |
| Content events | 0 | 1 | 4 | 0 | 5 |
| Global patterns | 0 | 0 | 0 | 1 | 1 |
| **Total** | **1** | **25** | **17** | **1** | **44** |

Full detail: `docs/product/TRACE_AUDIT_REPORT.md`

---

## Ratchet Summary

### Baseline Comparison (2026-05-28 -> 2026-05-29)

| Category | Baseline | Current | Delta |
|----------|----------|---------|-------|
| Total P0 | 23 | 23 | -> |
| Total P1 | ~170 | 109 | v 61 |
| Total P2 | ~92 | 108 | ^ 16 |
| Total P3 | ~40 | 40 | -> |
| Coverage Score | 62 | 65 | ^ 3 |
| Chain Health | 86% | 86% | -> |

### Resolved P0s (from prior runs, still resolved)

| ID | Resolved In | Reason |
|----|-------------|--------|
| EM-M03-admin-role | 5e7e9bec | Admin role check added |
| EM-M04-term-bypass | 5e7e9bec | isValidTermTransition() called |
| EM-M04-svg-xss | 5e7e9bec | SVG signature detection blocks uploads |
| EM-M05-zero-events | 837cab7c | membership.created emitted |
| EM-M07-publish-noop | 837cab7c | Downgraded to P1 |
| EM-M07-event-dead | 837cab7c | announcement.published emitted |
| EM-M09-zero-events | 837cab7c | 3 events wired |
| EM-M09-status-bypass | 5e7e9bec | Forces status: draft |
| EM-M11-pii-leak | 5e7e9bec | holderName removed from select |
| EF-M04-cancelled-key | 5e7e9bec | cancelled terminal state added |
| EF-M05-addmember-auth | 5e7e9bec | Officer role guard added |
| EF-M05-addmember-dup | 5e7e9bec | 23505 -> ConflictError |
| EF-M06-paylink-auth | 5e7e9bec | Officer role verification added |
| EF-M07-subtopic-role | 5e7e9bec | President/admin guard added |
| EF-M11-pii-file | 5e7e9bec | holderName removed from select |
| UJ-M01-accept-invite | 5e7e9bec | Route invite/$token.tsx exists |
| UJ-M02-nav-wrong | 5e7e9bec | Links to /settings/security correctly |
| UJ-M03-org-lifecycle | 5e7e9bec | onClick handlers wired |
| UJ-M03-add-org | 5e7e9bec | createOrganizationMutation wired |

---

## Stabilization Plan

### Wave 1 -- P0 Security (Immediate, 13 new findings)

1. **EF-M08-listEvents-no-auth** -- Add session + org-scope check to listEvents.ts
2. **EF-M12-001** -- Add auth + org-scope to getElection.ts
3. **EF-M11-005** -- Add org-scope check to uploadNewDocumentVersion.ts
4. **EF-M04-directory-no-privacy** -- Verify requester is org member in directory endpoints
5. **EF-M01-export-pii** -- Filter PII fields in exportMyData response
6. **EF-M03-impersonation-no-write-block** -- Add API middleware to block writes during impersonation
7. **EF-M03-impersonation-no-auto-expire** -- Add server-side session expiry validation
8. **EF-M02-update-no-session-invalidation** -- Invalidate other sessions on password change
9. **EF-M07-webrtc-token-placeholder** -- Disable video calls via feature flag or implement auth
10. **EF-M11-004** -- Add SVG sanitization (strip script/on*/foreignObject)
11. **EF-M11-002** -- Implement HMAC-SHA256 QR signing for certificate verification
12. **EF-M10-005** -- Escape SQL wildcards in training search LIKE pattern
13. **EF-M14-004** -- Escape formula characters (=, +, -, @) in CSV export

### Wave 2 -- Domain Events (Systemic P1)

Wire domain event emissions across all modules. Current state: specs declare ~60 events, code emits ~34, consumers handle ~21. Priority:
1. Wire consumers for `person.created`, `person.updated` (onboarding + profile sync)
2. Wire consumers for `training.completed` (certificate generation -- WORKFLOW_MAP 6.3)
3. Wire consumers for `booking.created`, `booking.rejected` (host/client notifications)
4. Remove duplicate notification paths (booking confirm/cancel: choose event OR direct call)

### Wave 3 -- Audit Logging (P1 cluster)

Add `auditAction()` calls to:
1. All membership/ handlers (zero calls currently)
2. All events/ handlers (zero calls)
3. All training mutation handlers (zero calls)
4. Better-Auth audit hook for auth events (9 unaudited)

### Wave 4 -- Spec Coverage

Create MODULE_SPECs for 8 unspecced handler directories (68 handlers, 11.4% of codebase):
booking, billing, email, storage, notifs, reviews, invite, audit

### Wave 5 -- Future Module Specs

Add 7 missing sections to MODULE_SPEC template and backfill M15-M19 (or formally exclude from checklist).

---

## What's Next

Based on enforcement results:

1. **P0 count > 0 AND new regressions exist** -> Run `/oli-enforce-fix --wave=1` to address 13 new P0 security findings
2. **Coverage score < 70%** -> Run `/oli-module-specs` for booking, billing, email, storage, notifs, reviews, invite, audit
3. **Domain events systemic gap** -> Run `/oli-enforce-fix --wave=2` to wire event emissions and consumers
4. **Audit compliance cluster** -> Run `/oli-enforce-fix --wave=3` to add auditAction calls
5. **After fixes** -> Re-run `/oli-enforce-all --strict` to verify ratchet improvement

---

## Sub-Skill Artifacts

| Phase | Artifact | Path |
|-------|----------|------|
| 0 | Coverage Report | `docs/product/SPEC_COVERAGE_REPORT.md` |
| 1 (m01-m05) | Module+File Enforcement | `docs/audits/ENFORCE_M01_M05_PHASE1.md` |
| 1 (m06-m09) | Module+File Enforcement | `docs/audits/ENFORCE_M06_M09_REPORT.md` |
| 1 (m10-m14) | Module+File Enforcement | `docs/audits/ENFORCE_M10_M14_REPORT.md` |
| 1 (m15-m19) | Module+File Enforcement | (agent output -- future modules, 44 template-gap findings) |
| 1.5 | UI Journey Audit | `docs/audits/UI_JOURNEY_AUDIT.md` |
| 2 | Cross-Module Alignment | `docs/audits/CROSS_MODULE_ALIGNMENT_REPORT.md` |
| 2.5 + 3 | Traceability + Audit | `docs/product/TRACE_AUDIT_REPORT.md` |
| 4 | This Report | `docs/audits/ENFORCEMENT_REPORT.md` |
| 4 | Baseline | `docs/audits/enforce/.baseline.json` |
