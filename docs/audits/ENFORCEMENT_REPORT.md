<!-- oli-version: 1.2 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-29T18:00:00Z -->

# Enforcement Report

**Generated:** 2026-05-29 (post-fix re-verification)
**Engine:** oli-enforce-all v3 --strict
**Scope:** 19 modules, 8 phases, 10 agents
**Baseline:** 2026-05-29T12:00:00Z → 2026-05-29T18:00:00Z
**Coverage Score:** 65 → 67 (↑2)

---

## Executive Summary

| Severity | Count | Baseline | Delta |
|----------|-------|----------|-------|
| **P0** | 20 | 26 | ↓6 net (15 RESOLVED, 4 NEW detections, 3 NOT_RETESTED) |
| **P1** | 80 | ~109 | ↓29 (consolidation + resolution) |
| **P2** | 78 | ~108 | ↓30 (consolidation) |
| **P3** | 32 | ~40 | ↓8 |
| **Total** | **210** | **~283** | ↓73 net |

**--strict verdict:** **PASS.** Zero code regressions. All 13 security P0s from Wave 1 confirmed RESOLVED. 4 NEW P0 detections are pre-existing gaps (code unchanged), not regressions introduced by recent commits.

**Security gate:** All P0 security findings from oli-enforce-fix Wave 1 verified fixed with tests. Security gate SATISFIED.

---

## Audit Scope

| Phase | Skill | Status | Agents | Findings |
|-------|-------|--------|--------|----------|
| -1 | oli-codebase-map | SKIPPED | 0 | codebase_map.auto_phase = false |
| -0.5 | Map Health | SKIPPED | 0 | No CODE_MODULE_MAP.json |
| 0 | oli-enforce-coverage | COMPLETE | 1 | 24 (7 P0, 7 P1, 5 P2, 5 P3) |
| 1 | oli-enforce-module + file | COMPLETE | 5 (5 groups) | ~85 |
| 1.5 | oli-ui-journey | COMPLETE | 1 | 19 (1 P0, 3 P1, 9 P2, 6 P3) |
| 2 | oli-enforce-cross-module | COMPLETE | 1 | 12 (0 P0, 9 P1, 3 P2) |
| 2.5 | oli-trace | COMPLETE | 1 | 7 (0 P0, 2 P1, 3 P2, 2 P3) |
| 3 | oli-audit-compliance | COMPLETE | 1 | 18 (2 P0, 11 P1, 4 P2, 1 P3) |
| 4 | Merge + Ratchet | COMPLETE | 0 | — |

**Artifacts reviewed:** 19 MODULE_SPECs, MODULE_MAP.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, EVENT_CONTRACTS.md, AUDIT_CONTRACTS.md, 24 handler directories, apps/memberry/src/ routes+components

---

## Wave 1 Security Fix Verification (13/13 RESOLVED)

All 13 P0 security findings from the previous run are confirmed fixed with test coverage:

| ID | Module | Fix | Commit | Tests |
|----|--------|-----|--------|-------|
| EF-M01-export-pii | M01 | PII allowlist — 14 GDPR-safe fields only | 296a06c9 | exportMyData.test.ts |
| EF-M02-update-no-session-invalidation | M02 | revokeSessionsOnPasswordReset + route interception | 5eff4215 | auth-password-session-revocation.test.ts |
| EF-M03-impersonation-no-write-block | M03 | Pre-existing: impersonation-guard.ts middleware | — | impersonation-guard.test.ts (13) |
| EF-M03-impersonation-no-auto-expire | M03 | Pre-existing: 30min expiresAt + 2hr hard cap | — | startImpersonation.test.ts (9) |
| EF-M04-directory-no-privacy | M04 | orgMembership check → 403 | 296a06c9 | directory.test.ts (10) |
| EF-M07-webrtc-token-placeholder | M07 | HMAC-SHA256 signed token | 5eff4215 | webrtc-token.test.ts (4) |
| EF-M08-listEvents-no-auth | M08 | Session check + UnauthorizedError | ea4f9119 | listEvents.test.ts |
| EF-M10-005 | M10 | escapeLikePattern() across 5 repos | 5eff4215 | sanitize.test.ts (26) |
| EF-M11-002 | M11 | signCertificateQR/verifyCertificateQR HMAC-SHA256 | 5eff4215 | certificate-qr.test.ts (7) |
| EF-M11-004 | M11 | isBlockedDocumentFile() rejects SVG | 5eff4215 | sanitize.test.ts |
| EF-M11-005 | M11 | organizationId !== orgId → NotFoundError | 296a06c9 | uploadNewDocumentVersion.test.ts |
| EF-M12-001 | M12 | Session check + UnauthorizedError | ea4f9119 | getElection.test.ts |
| EF-M14-004 | M14 | escapeCsvValue() neutralizes formula chars | 5eff4215 | exportNationalDashboard.test.ts |

**Additionally resolved:**
- **EM-M07-cancelled** — `cancelled` enum value now present in messageStatusEnum + cancelMessage handler exists
- **EX-NOTIF-enum** — downgraded from P0 to P2 (code has all 18 types; only DOMAIN_MODEL doc is stale)

---

## P0 Findings (Inline — All 20)

### KNOWN P0s (from baseline, still present)

| ID | Module | First Seen | Description | Age |
|----|--------|------------|-------------|-----|
| EM-M07-zero-events | M07 | 2026-05-27 | Domain events emitted in only 1 of ~47 comms handlers | 2d |
| EM-M07-deceased | M07 | 2026-05-27 | Deceased/suppressed check only in batch announcement path | 2d |
| EM-M07-no-typespec | M07 | 2026-05-27 | No communication.tsp — 28-handler module hand-wired | 2d |
| EM-M08-publish | M08 | 2026-05-28 | publishEvent handler absent — events stuck in draft | 1d |
| EM-M08-complete | M08 | 2026-05-28 | completeEvent handler absent — events never complete | 1d |
| EM-M09-dead-code | M09 | 2026-05-28 | 8/14 training handlers unrouted (superseded by association:operations) | 1d |
| EC-001-booking | COVERAGE | 2026-05-29 | booking (19 handlers) — no MODULE_SPEC | 0d |
| EC-002-billing | COVERAGE | 2026-05-29 | billing (16 handlers) — no MODULE_SPEC | 0d |
| EC-003-email | COVERAGE | 2026-05-29 | email (13 handlers) — no MODULE_SPEC | 0d |
| EC-004-communication-notsp | COVERAGE | 2026-05-29 | communication (46 handlers) — no TypeSpec | 0d |
| EC-005-assocmember-notsp | COVERAGE | 2026-05-29 | association:member (194 handlers) — no TypeSpec | 0d |
| EC-006-assocops-notsp | COVERAGE | 2026-05-29 | association:operations (69 handlers) — no TypeSpec | 0d |
| EC-007-platformadmin-gap | COVERAGE | 2026-05-29 | platformadmin (40 handlers) — spec coverage gap | 0d |

### NEW P0 detections (pre-existing gaps, NOT code regressions)

| ID | Module | Description | Phase |
|----|--------|-------------|-------|
| EF-M06-001 | M06 | No recordPayment handler — non-Stripe orgs cannot record manual cash/check payments | 1 |
| AL-001-password-change | AUTH | auth.password-changed event has no audit log emission | 3 |
| AL-002-mfa-lifecycle | AUTH | auth.mfa-enabled/disabled events have no audit log calls | 3 |
| UJ-01-spa-bypass | UI | announcement-list.tsx uses raw `<a href>` bypassing SPA router integrity | 1.5 |

### NOT_RETESTED (dependency scanning not run this cycle)

| ID | Module | First Seen | Description |
|----|--------|------------|-------------|
| ED-GLOBAL-xg6xh9c9 | DEP | 2026-05-28 | better-auth 2FA bypass via premature session caching |
| ED-GLOBAL-qpm26cq5 | DEP | 2026-05-28 | happy-dom code generation bypass (dev-only) |
| ED-GLOBAL-37j7fg3j | DEP | 2026-05-28 | happy-dom VM context escape RCE (dev-only) |

---

## P1 Findings (Inline — Top 30 by Impact)

### Module Enforcement (EM-*)

| ID | Module | Description |
|----|--------|-------------|
| EM-M07-001 | M07 | No TypeSpec for 28-handler communication module — all routes hand-wired |
| EM-M07-002 | M07 | Domain events in only 1 of ~47 handlers (publishAnnouncement) |
| EM-M07-003 | M07 | Deceased/suppressed check missing in direct sendMessage path |
| EM-M08-001 | M08 | publishEvent handler absent — WF-051 workflow dead |
| EM-M08-002 | M08 | completeEvent handler absent — no completion lifecycle |
| EM-M05-transfer | M05 | No transferMember handler — WF-036 (P0 workflow) dead |
| EM-M06-hand-wired | M06 | All dues routes hand-wired, no TypeSpec |
| EM-M09-markattendance | M09 | POST attendance → award credit endpoint missing |
| EM-M03-revenue | M03 | GET /admin/analytics/revenue and /health have no handler files |
| EM-M13-unimplemented | M13 | 0 endpoints specced, 0 implemented |
| EM-M19-unimplemented | M19 | 0 endpoints specced, 0 implemented |

### File Enforcement (EF-*)

| ID | Module | Description |
|----|--------|-------------|
| EF-M06-002 | M06 | No refundPayment handler — refund flow unreachable |
| EF-M05-001 | M05 | No transferMember handler — WF-036 dead |
| EF-M14-001 | M14 | No platform-wide summary handler (cross-association rollup) |

### Cross-Module (EX-*)

| ID | Description |
|----|-------------|
| EX-CM-001 | person/createMyCreditEntry writes directly to association:member CreditEntryRepo |
| EX-CM-002 | dues ↔ association:member bidirectional circular coupling |
| EX-CM-003 | dues/getDuesDashboard imports association:operations schema directly |
| EX-CM-004 | events/* imports membership/repos directly for auth checks |
| EX-CM-005 | association:member/confirmPaymentProof imports dues repos |
| EX-CM-006 | association:member/listDuesPayments imports dues repos |
| EX-CM-007 | membership/listOrgMembers joins 3 contexts directly |
| EX-EV-001 | task.overdue notification trigger exists but no producer wires it |
| EX-EV-002 | dunning.escalation emitted as 'billing' — type mismatch vs contract |

### Coverage (EC-*)

| ID | Description |
|----|-------------|
| EC-008 | events (15 handlers) — has spec but no TypeSpec |
| EC-009 | training (14 handlers) — has spec but no TypeSpec |
| EC-010 | membership (15 handlers) — has spec but no TypeSpec |
| EC-011 | documents (15 handlers) — has spec but no TypeSpec |
| EC-012 | elections (9 handlers) — has spec but no TypeSpec |
| EC-013 | certificates (6 handlers) — grouped under m11, no TypeSpec |
| EC-023 | dues (6 handlers) — only partial TypeSpec (dues-custom.tsp) |

### Traceability (TR-*)

| ID | Description |
|----|-------------|
| TR-001 | BR-41..44 label orphans — logic implemented as M9-Rx aliases but BR tag chain broken |
| TR-002 | BR-45/47 label orphans — advertising BRs covered as M16-Rx but BR tag missing |

### Audit Compliance (AL-*)

| ID | Module | Description |
|----|--------|-------------|
| AL-003 | dues | financial.payment-recorded — no audit in stripeWebhook/bulkRecordPayments |
| AL-004 | billing | All billing handlers lack audit logging entirely |
| AL-005 | dues | financial.fund-allocation-changed — no handler + no audit |
| AL-006 | membership | application-submitted/approved/rejected — zero audit in reviewApplication |
| AL-007 | membership | membership.status-changed — no audit in updateMember |
| AL-008 | elections | governance.vote-cast — castVote has zero audit calls |
| AL-009 | elections | governance.nomination-submitted/election-certified — no audit |
| AL-010 | certificates | certificate-generated/credential-verified — zero audit |
| AL-011 | documents | data.document-accessed — getDocument read unlogged |
| AL-012 | person | data.pii-accessed — getPerson/getMyProfile reads unlogged |
| AL-013 | person | data.bulk-export — no audit on listPersons |

### UI Journey (UJ-*)

| ID | Description |
|----|-------------|
| UJ-02 | host-directory links skip slot selection — ambiguous booking intent |
| UJ-03 | compose-form uses string interpolation not typed Link params |
| UJ-04 | announcement-list uses raw href with runtime param name mismatch |

---

## Ratchet Summary

### P0 Movement

| Category | Count | Details |
|----------|-------|---------|
| **RESOLVED** | 15 | 13 security fixes (3 commits) + EM-M07-cancelled + EX-NOTIF-enum (→P2) |
| **KNOWN** | 13 | 6 structural + 7 coverage (pre-existing, code unchanged) |
| **NEW (detection)** | 4 | EF-M06-001, AL-001, AL-002, UJ-01 (pre-existing gaps, first detection) |
| **NOT_RETESTED** | 3 | Dependency scanning (ED-GLOBAL-*) not run this cycle |
| **REGRESSION** | 0 | No code changes introduced new bugs |
| **Net** | 20 | ↓6 from 26 |

### Module Score Trends

| Module | Baseline | Current | Trend | Reason |
|--------|----------|---------|-------|--------|
| M01 | 6.0 | 7.5 | ↑ | PII export fix |
| M02 | 6.4 | 7.8 | ↑ | Session invalidation fix |
| M03 | 6.5 | 7.5 | ↑ | Impersonation confirmed resolved |
| M04 | 6.5 | 7.5 | ↑ | Directory privacy fix |
| M05 | 6.0 | 6.0 | → | Unchanged + new transfer gap detected |
| M06 | 6.5 | 4.5 | ↓ | recordPayment P0 detected |
| M07 | 5.5 | 4.0 | ↓ | WebRTC fixed but structural P0s remain |
| M08 | 4.0 | 4.5 | ↑ | listEvents auth fix |
| M09 | 5.0 | 4.5 | ↓ | Dead code still present |
| M10 | 6.5 | 7.0 | ↑ | SQL injection fix |
| M11 | 3.0 | 6.0 | ↑↑ | 3 security fixes (HMAC, SVG, IDOR) |
| M12 | 5.5 | 6.5 | ↑ | Election auth fix |
| M14 | 5.0 | 5.5 | ↑ | CSV injection fix |
| M15-M18 | 0.0 | 2.0 | ↑ | Handler code now detected (identity changed) |

### Identity Changes

4 modules changed from `source_path: null` to having handler code:
- **M15** (job-board) → handlers/jobs/ (16 files)
- **M16** (advertising) → handlers/advertising/ (7 files)
- **M17** (marketplace) → handlers/marketplace/ (16 files)
- **M18** (surveys-polls) → handlers/surveys/ (20 files, has TypeSpec)

All 4 have empty MODULE_SPECs (0 endpoints defined). Spec-first workflow violated.

---

## Stabilization Plan

### Wave 1 — P0 Security (COMPLETE)

All 13 P0 security findings from previous run are FIXED and verified with tests across 3 commits (ea4f9119, 296a06c9, 5eff4215). Security gate satisfied.

### Wave 2 — Structural P0s (6 findings, M07/M08/M09)

| Finding | Action |
|---------|--------|
| EM-M07-zero-events | Wire domain events in communication/comms handlers |
| EM-M07-deceased | Add deceased/suppressed check in sendMessage direct path |
| EM-M07-no-typespec | Create communication.tsp TypeSpec for 28-handler module |
| EM-M08-publish | Implement publishEvent handler |
| EM-M08-complete | Implement completeEvent handler |
| EM-M09-dead-code | Remove or properly route 8 dead training handlers |

### Wave 3 — Functional P0s (1 finding, M06)

| Finding | Action |
|---------|--------|
| EF-M06-001 | Implement recordPayment handler for manual cash/check/bank-transfer |

### Wave 4 — Audit Logging P0s (2 findings)

| Finding | Action |
|---------|--------|
| AL-001-password-change | Emit auth.password-changed audit event in password change flow |
| AL-002-mfa-lifecycle | Emit auth.mfa-enabled/disabled audit events |

### Wave 5 — Spec Coverage (7 coverage P0s)

Create MODULE_SPECs for: booking, billing, email. Add TypeSpec for: communication, association:member, association:operations, platformadmin.

### Wave 6 — Future Module Specs

Populate endpoint definitions in M15-M18 MODULE_SPECs (code exists but specs empty). Formally implement or exclude M13, M19.

---

## What's Next

1. **Wave 1 COMPLETE.** Security gate satisfied. No P0 regressions.
2. **Wave 2** (structural M07/M08/M09) — highest impact, 6 P0s block event-driven architecture.
3. **Wave 3** (M06 recordPayment) — blocks non-Stripe payment collection.
4. **Wave 4** (audit logging) — compliance requirement, 2 auth P0s.
5. **Run dependency scanning** — 3 NOT_RETESTED dependency P0s need re-verification.
6. **Populate M15-M18 specs** — spec-first workflow violated, handler code written without specs.
