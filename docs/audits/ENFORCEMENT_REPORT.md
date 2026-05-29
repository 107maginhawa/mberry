<!-- oli-version: 1.2 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-29T18:00:00Z -->

# Enforcement Report

**Generated:** 2026-05-29 (post-Wave 17 update)
**Engine:** oli-enforce-all v3 --strict
**Scope:** 22 modules, 8 phases, 10 agents
**Baseline:** 2026-05-29T22:00:00Z → 2026-05-29T23:30:00Z (v4)
**Coverage Score:** 65 → 78 (↑13)

---

## Executive Summary

| Severity | Count | Baseline | Delta |
|----------|-------|----------|-------|
| **P0** | 1 | 26 | ↓25 net (18 RESOLVED, 8 FALSE POSITIVE, 3 dep RESOLVED in Wave 7, 7 coverage RESOLVED in Wave 8) |
| **P1** | 38 | ~109 | ↓71 (Wave 10: 10 audit resolved, 1 audit FP, 3 UI resolved/FP, 2 traceability resolved, 1 revenue resolved, 1 coupling fixed, 6 coupling FP/accepted, 7 TypeSpec deferred, 1 event deferred). **Wave 11: 9 billing handlers gained audit logging; baseline P1s re-triaged — 7 FP, ~30 REAL (built modules) named, ~170 stubs DEFERRED (future modules). Net count corrections: m12 2→8, m01/m11/m14 ↑2 each, m09 3→1.** |
| **P2** | 78 | ~108 | ↓30 (consolidation) |
| **P3** | 32 | ~40 | ↓8 |
| **Total** | **164** | **~283** | ↓119 net |

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

**Artifacts reviewed:** 22 MODULE_SPECs, MODULE_MAP.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, EVENT_CONTRACTS.md, AUDIT_CONTRACTS.md, 24 handler directories, apps/memberry/src/ routes+components

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

## P0 Findings (Inline — 16 remaining)

### KNOWN P0s (from baseline, still present)

| ID | Module | First Seen | Description | Age |
|----|--------|------------|-------------|-----|
| ~~EM-M07-zero-events~~ | M07 | 2026-05-27 | ~~Domain events emitted in only 1 of ~47 comms handlers~~ **RESOLVED** — domain events added to 6 key handlers (create/send/schedule/cancel message, create/schedule announcement) | 2d |
| ~~EM-M07-deceased~~ | M07 | 2026-05-27 | ~~Deceased/suppressed check only in batch announcement path~~ **RESOLVED** — sendMessage now filters deceased/suspended/removed recipients via membership status query | 2d |
| EM-M07-no-typespec | M07 | 2026-05-27 | No communication.tsp — 28-handler module hand-wired (TypeSpec exists with enums; full operations deferred) | 2d |
| ~~EM-M08-publish~~ | M08 | 2026-05-28 | ~~publishEvent handler absent~~ **FALSE POSITIVE** — publishEvent exists at association:operations/publishEvent.ts, emits domain events | 1d |
| ~~EM-M08-complete~~ | M08 | 2026-05-28 | ~~completeEvent handler absent~~ **FALSE POSITIVE** — completeEvent exists at association:operations/completeEvent.ts with tests | 1d |
| ~~EM-M09-dead-code~~ | M09 | 2026-05-28 | ~~8/14 training handlers unrouted~~ **RESOLVED** — deleted entire handlers/training/ directory (14 handlers + tests + repos), all superseded by association:operations/. Accredited-provider schema/repo moved to association:operations/repos/. Legacy hand-wired routes removed from app.ts | 1d |
| ~~EC-001-booking~~ | COVERAGE | 2026-05-29 | ~~booking (19 handlers) — no MODULE_SPEC~~ **RESOLVED** — MODULE_SPEC created at `docs/product/modules/m20-booking/MODULE_SPEC.md` (19 endpoints, 4 entities, 10 business rules, TypeSpec COMPLETE) | 0d |
| ~~EC-002-billing~~ | COVERAGE | 2026-05-29 | ~~billing (16 handlers) — no MODULE_SPEC~~ **RESOLVED** — MODULE_SPEC created at `docs/product/modules/m21-billing/MODULE_SPEC.md` (16 endpoints, 4 entities, 7 business rules, TypeSpec COMPLETE) | 0d |
| ~~EC-003-email~~ | COVERAGE | 2026-05-29 | ~~email (13 handlers) — no MODULE_SPEC~~ **RESOLVED** — MODULE_SPEC created at `docs/product/modules/m22-email/MODULE_SPEC.md` (12 endpoints, 3 entities, 8 business rules, TypeSpec COMPLETE) | 0d |
| ~~EC-004-communication-notsp~~ | COVERAGE | 2026-05-29 | ~~communication (46 handlers) — no TypeSpec~~ **RESOLVED** — TypeSpec coverage note added to M07 MODULE_SPEC §10. `comms.tsp` covers real-time (11 handlers); `communication.tsp` has enums only; 28 async handlers hand-wired (deferred EM-M07-no-typespec) | 0d |
| ~~EC-005-assocmember-notsp~~ | COVERAGE | 2026-05-29 | ~~association:member (194 handlers) — no TypeSpec~~ **RESOLVED** — TypeSpec coverage note added to M05 MODULE_SPEC §10. `member.tsp` covers 157+ handlers in `association:member/`; 15 legacy `membership/` handlers hand-wired by design | 0d |
| ~~EC-006-assocops-notsp~~ | COVERAGE | 2026-05-29 | ~~association:operations (69 handlers) — no TypeSpec~~ **RESOLVED** — TypeSpec coverage note added to M14 MODULE_SPEC §10. `operations.tsp` covers 69 handlers including dashboard, analytics, event operations | 0d |
| ~~EC-007-platformadmin-gap~~ | COVERAGE | 2026-05-29 | ~~platformadmin (40 handlers) — spec coverage gap~~ **RESOLVED** — TypeSpec coverage note added to M03 MODULE_SPEC §10. `platformadmin.tsp` covers 21/40 handlers; analytics/support gaps documented | 0d |

### NEW P0 detections (pre-existing gaps, NOT code regressions)

| ID | Module | Description | Phase |
|----|--------|-------------|-------|
| ~~EF-M06-001~~ | ~~M06~~ | **FALSE POSITIVE** — recordDuesPayment handler exists at `association:member/recordDuesPayment.ts` (generated registry imports it). Full implementation: receipt gen, invoice linking with optimistic lock, fund allocation, membership extension, audit trail, concurrent payment warning. Test file at `recordDuesPayment.test.ts`. | 1 |
| ~~AL-001-password-change~~ | ~~AUTH~~ | **RESOLVED** — password change audit now emits typed `authentication.password-changed` eventSubType (was generic `security` category). Test: `auth-audit-logging.test.ts` | 3 |
| ~~AL-002-mfa-lifecycle~~ | ~~AUTH~~ | **RESOLVED** — MFA enable/disable routes now intercept and emit `authentication.mfa-enabled`/`authentication.mfa-disabled` audit events. `mfa-enabled`/`mfa-disabled` sub-types added to audit-events.ts. Test: `auth-audit-logging.test.ts` | 3 |
| ~~UJ-01-spa-bypass~~ | ~~UI~~ | **RESOLVED** — announcement-list.tsx `<a href>` replaced with TanStack Router `<Link>` using typed params. Route `$announcementId.tsx` exists. | 1.5 |

### Dependency P0s (RETESTED — all 3 AFFECTED)

| ID | Module | First Seen | Description | Status |
|----|--------|------------|-------------|--------|
| ~~ED-GLOBAL-xg6xh9c9~~ | DEP | 2026-05-28 | better-auth 2FA bypass via premature session caching | **RESOLVED** — upgraded 1.3.27 → 1.6.11. Import paths migrated (`apiKey` → `@better-auth/api-key`, `passkey` → `@better-auth/passkey`). All typechecks pass, test baseline unchanged. |
| ~~ED-GLOBAL-qpm26cq5~~ | DEP | 2026-05-28 | happy-dom code generation bypass (dev-only) | **RESOLVED** — upgraded 19.0.2 → 20.9.0. Dev-only, no breaking changes. |
| ~~ED-GLOBAL-37j7fg3j~~ | DEP | 2026-05-28 | happy-dom VM context escape RCE (dev-only) | **RESOLVED** — upgraded 19.0.2 → 20.9.0. Dev-only, no breaking changes. |

**Additional findings from `bun audit`:**
| Package | Severity | Description |
|---------|----------|-------------|
| ~~drizzle-orm <0.45.2~~ | HIGH | ~~SQL injection via escaped identifiers~~ **RESOLVED** — upgraded 0.44.7 → 0.45.2 |
| ~~nodemailer <8.0.4~~ | LOW+MOD | ~~SMTP command injection (2 advisories)~~ **RESOLVED** — upgraded 7.0.13 → 8.0.9 |
| esbuild | MODERATE | Dev server request exposure |

---

## P1 Findings (Inline — Top 30 by Impact)

### Module Enforcement (EM-*)

| ID | Module | Description |
|----|--------|-------------|
| EM-M07-001 | M07 | No TypeSpec for 28-handler communication module — all routes hand-wired |
| ~~EM-M07-002~~ | M07 | ~~Domain events in only 1 of ~47 handlers~~ **RESOLVED** — 7 handlers now emit events |
| ~~EM-M07-003~~ | M07 | ~~Deceased/suppressed check missing in sendMessage~~ **RESOLVED** — membership status filter added |
| ~~EM-M08-001~~ | M08 | ~~publishEvent handler absent~~ **FALSE POSITIVE** — exists in association:operations/ |
| ~~EM-M08-002~~ | M08 | ~~completeEvent handler absent~~ **FALSE POSITIVE** — exists in association:operations/ |
| ~~EM-M05-transfer~~ | M05 | ~~No transferMember handler~~ **FALSE POSITIVE** — transfer_status enum in chapters.schema.ts; transfer is a membership state transition, not a standalone handler |
| EM-M06-hand-wired | M06 | All dues routes hand-wired, no TypeSpec |
| ~~EM-M09-markattendance~~ | M09 | ~~POST attendance → award credit missing~~ **FALSE POSITIVE** — check-in handlers exist in association:operations/ (createCheckIn, checkInCustomEvent, checkInCustomTraining) |
| ~~EM-M03-revenue~~ | M03 | **RESOLVED** — getRevenueAnalytics.ts and getOrgHealthScores.ts created in platformadmin/ with audit logging |
| ~~EM-M13-unimplemented~~ | M13 | ~~0 endpoints specced, 0 implemented~~ **FALSE POSITIVE** — reviews/ has createReview, deleteReview, getReview, listReviews + schema + tests |
| ~~EM-M19-unimplemented~~ | M19 | ~~0 endpoints specced, 0 implemented~~ **FALSE POSITIVE** — committee handlers in association:operations/ (create/update/dissolve + tasks) |

### File Enforcement (EF-*)

| ID | Module | Description |
|----|--------|-------------|
| ~~EF-M06-002~~ | M06 | ~~No refundPayment handler~~ **FALSE POSITIVE** — refundDuesPayment.ts exists in association:member/ with tests |
| ~~EF-M05-001~~ | M05 | ~~No transferMember handler~~ **FALSE POSITIVE** — see EM-M05-transfer above |
| ~~EF-M14-001~~ | M14 | ~~No platform-wide summary handler~~ **FALSE POSITIVE** — getNationalDashboard.ts in platformadmin/ covers cross-association rollup |

### Cross-Module (EX-*)

| ID | Description |
|----|-------------|
| ~~EX-CM-001~~ | **RESOLVED** — CreditService facade created at association:member/services/credit.service.ts; person handler imports facade instead of repo directly |
| EX-CM-002 | dues ↔ association:member bidirectional circular coupling — **DEFERRED** to v1.2.0 (requires data ownership restructure) |
| EX-CM-003 | dues/getDuesDashboard imports association:member repo — **DEFERRED** (part of EX-CM-002 refactor) |
| ~~EX-CM-004~~ | **ACCEPTED** — events imports membership repo for auth/visibility checks; legitimate security boundary, not domain coupling |
| ~~EX-CM-005~~ | **FALSE POSITIVE** — confirmPaymentProof handler does not exist in codebase |
| ~~EX-CM-006~~ | **FALSE POSITIVE** — listDuesPayments imports from local ./repos/ (intra-module, not cross-module) |
| EX-CM-007 | membership/listOrgMembers joins 3 contexts directly — **DEFERRED** to v1.2.0 (requires QueryFacade/view) |
| EX-EV-001 | task.overdue notification trigger exists but no producer wires it — **DEFERRED** (needs cron job infrastructure) |
| ~~EX-EV-002~~ | **FALSE POSITIVE** — dunning.escalation type is correctly emitted; no mismatch found |

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
| ~~TR-001~~ | **RESOLVED** — BR-41..44 annotations added to createTraining (BR-42/M9-R1), createTrainingEnrollment (BR-41/M9-R2), completeTrainingEnrollment (BR-43/M9-R3, BR-44/M9-R7) |
| ~~TR-002~~ | **RESOLVED** — BR-45/47 annotations added to createCreative (BR-45/M16-R1, BR-47/M16-R3), getAdForPlacement, reviewCreative |

### Audit Compliance (AL-*)

| ID | Module | Description |
|----|--------|-------------|
| ~~AL-003~~ | ~~dues~~ | **RESOLVED** — auditAction added to stripeWebhook (on processed) + bulkRecordPayments (batch summary) |
| ~~AL-004~~ | ~~billing~~ | **RESOLVED** — auditAction added to createInvoice, payInvoice, refundInvoicePayment, voidInvoice (4 key financial handlers) |
| ~~AL-005~~ | ~~dues~~ | **FALSE POSITIVE** — allocateSeat + upsertDuesFunds both already have auditAction calls |
| ~~AL-006~~ | ~~membership~~ | **RESOLVED** — auditAction added to reviewApplication with typed sub-types (member-approved/denied/application-submitted) |
| ~~AL-007~~ | ~~membership~~ | **RESOLVED** — auditAction added to updateMember on status transitions (suspended/terminated/reinstated) |
| ~~AL-008~~ | ~~elections~~ | **RESOLVED** — auditAction added to castVote with governance.vote-cast sub-type |
| ~~AL-009~~ | ~~elections~~ | **RESOLVED** — auditAction added to createNominee (governance.nomination-submitted) + certifyElection (governance.election-closed) |
| ~~AL-010~~ | ~~certificates~~ | **RESOLVED** — auditAction added to generateCertificatePdf with content.certificate-generated sub-type |
| ~~AL-011~~ | ~~documents~~ | **RESOLVED** — auditAction added to getDocument with data.document-accessed sub-type (eventType: data-access) |
| ~~AL-012~~ | ~~person~~ | **RESOLVED** — getPerson upgraded from logger.info to structured auditAction with data.pii-accessed sub-type; getMyProfile does not exist (false reference) |
| ~~AL-013~~ | ~~person~~ | **RESOLVED** — listPersons upgraded from logger.info to structured auditAction with data.bulk-export sub-type |

### UI Journey (UJ-*)

| ID | Description |
|----|-------------|
| ~~UJ-02~~ | **RESOLVED** — host-directory Link now passes eventId search param; host page uses it to pre-select correct event |
| ~~UJ-03~~ | **RESOLVED** — compose-form navigate() calls switched from string interpolation to typed params `{ to: '/org/$orgSlug/...', params: { orgSlug } }` |
| ~~UJ-04~~ | **FALSE POSITIVE** — announcement-list already uses typed `<Link>` with correct params (likely fixed alongside UJ-01) |

---

## Ratchet Summary

### P0 Movement

| Category | Count | Details |
|----------|-------|---------|
| **RESOLVED** | 25 | 13 security (Wave 1) + EM-M07-cancelled + EX-NOTIF-enum (→P2) + AL-001 + AL-002 + UJ-01 (Waves 3-5) + 7 coverage EC-001..007 (Wave 8) |
| **FALSE POSITIVE** | 8 | EF-M06-001 + Wave 6: EM-M05-transfer, EM-M09-markattendance, EM-M13, EM-M19, EF-M06-002, EF-M05-001, EF-M14-001 |
| **KNOWN** | 1 | 1 structural (EM-M07-no-typespec DEFERRED) |
| ~~**AFFECTED**~~ | ~~3~~ | ~~Dependency CVEs verified: better-auth (prod), happy-dom ×2 (dev)~~ **RESOLVED in Wave 7** |
| **REGRESSION** | 0 | No code changes introduced new bugs |
| **Net** | 1 | ↓25 from 26 (18 resolved, 8 false positive, 7 coverage Wave 8; 1 structural deferred) |

### Module Score Trends

| Module | Baseline | Current | Trend | Reason |
|--------|----------|---------|-------|--------|
| M01 | 6.0 | 7.5 | ↑ | PII export fix |
| M02 | 6.4 | 7.8 | ↑ | Session invalidation fix |
| M03 | 6.5 | 7.5 | ↑ | Impersonation confirmed resolved |
| M04 | 6.5 | 8.5 | ↑↑ | Wave 17: OrgSettingsUpdated event wired; spec §10 reconciled to actual paths + 10 bonus endpoints documented (path-mismatch finding partly FP) |
| M05 | 6.0 | 9.0 | ↑↑ | Wave 16: resign/decease emit status.changed, roster import emits membership.imported; auth gap was FP (path divergence) |
| M06 | 6.5 | 4.5 | ↓ | recordPayment P0 detected |
| M07 | 5.5 | 4.0 | ↓ | WebRTC fixed but structural P0s remain |
| M08 | 4.0 | 4.5 | ↑ | listEvents auth fix |
| M09 | 5.0 | 4.5 | ↓ | Dead code still present |
| M10 | 6.5 | 7.0 | ↑ | SQL injection fix |
| M11 | 3.0 | 6.0 | ↑↑ | 3 security fixes (HMAC, SVG, IDOR) |
| M12 | 5.5 | 6.5 | ↑ | Election auth fix |
| M14 | 5.0 | 5.5 | ↑ | CSV injection fix |
| M15-M18 | 0.0 | 5.5 | ↑↑ | Handler code + full MODULE_SPECs (22 sections each). M18 has TypeSpec; M15-M17 hand-wired |

### Identity Changes

4 modules changed from `source_path: null` to having handler code:
- **M15** (job-board) → handlers/jobs/ (16 files)
- **M16** (advertising) → handlers/advertising/ (7 files)
- **M17** (marketplace) → handlers/marketplace/ (16 files)
- **M18** (surveys-polls) → handlers/surveys/ (20 files, has TypeSpec)

All 4 have fully populated MODULE_SPECs (22 sections each, endpoints defined, business rules, acceptance criteria). M18 has TypeSpec (`surveys.tsp`); M15/M16/M17 lack TypeSpec (hand-wired routes).

---

## Stabilization Plan

### Wave 1 — P0 Security (COMPLETE)

All 13 P0 security findings from previous run are FIXED and verified with tests across 3 commits (ea4f9119, 296a06c9, 5eff4215). Security gate satisfied.

### Wave 2 — Structural P0s (MOSTLY COMPLETE — 5/6 resolved)

| Finding | Status | Action |
|---------|--------|--------|
| EM-M07-zero-events | **RESOLVED** | Domain events added to 6 key communication handlers |
| EM-M07-deceased | **RESOLVED** | Deceased/suspended/removed filter in sendMessage |
| EM-M07-no-typespec | DEFERRED | TypeSpec enums exist; full operation coverage deferred |
| EM-M08-publish | **FALSE POSITIVE** | Handler exists in association:operations/ |
| EM-M08-complete | **FALSE POSITIVE** | Handler exists in association:operations/ |
| EM-M09-dead-code | **RESOLVED** | Deleted handlers/training/ (14 handlers + tests + repos), migrated accredited-provider to association:operations/ |

### Wave 3 — Functional P0s (0 findings — EMPTY)

| Finding | Action |
|---------|--------|
| ~~EF-M06-001~~ | **FALSE POSITIVE** — handler exists at `association:member/recordDuesPayment.ts` (same pattern as EM-M08 false positives — enforcement looked in `handlers/dues/` but handler lives in `handlers/association:member/`) |

### Wave 4 — Audit Logging P0s (0 findings — RESOLVED)

| Finding | Action |
|---------|--------|
| ~~AL-001-password-change~~ | **RESOLVED** — typed `authentication.password-changed` eventSubType added to existing audit call |
| ~~AL-002-mfa-lifecycle~~ | **RESOLVED** — MFA enable/disable intercepts with audit logging added to auth.ts |

### Wave 5 — Spec Coverage (7 coverage P0s)

Create MODULE_SPECs for: booking, billing, email. Add TypeSpec for: communication, association:member, association:operations, platformadmin.

### Wave 6 — Structural False-Positive Sweep (COMPLETE — 6/7 FALSE POSITIVE)

| Finding | Status | Evidence |
|---------|--------|----------|
| EM-M05-transfer | **FALSE POSITIVE** | transfer_status enum in chapters.schema.ts; membership state transition |
| EM-M09-markattendance | **FALSE POSITIVE** | Check-in handlers in association:operations/ (createCheckIn, checkInCustomEvent, checkInCustomTraining) |
| EM-M13-unimplemented | **FALSE POSITIVE** | reviews/ fully implemented: createReview, deleteReview, getReview, listReviews + schema + tests |
| EM-M19-unimplemented | **FALSE POSITIVE** | Committee handlers in association:operations/ (create/update/dissolve + tasks) |
| EF-M06-002 | **FALSE POSITIVE** | refundDuesPayment.ts exists in association:member/ with tests |
| EF-M05-001 | **FALSE POSITIVE** | Same as EM-M05-transfer |
| EF-M14-001 | **FALSE POSITIVE** | getNationalDashboard.ts in platformadmin/ covers cross-association rollup |
| EM-M03-revenue | **CONFIRMED REAL** | No dedicated GET /admin/analytics/revenue or /health endpoints |

### Wave 7 — Dependency Updates (COMPLETE ✅)

| Package | Before | After | Severity | Status |
|---------|--------|-------|----------|--------|
| better-auth | 1.3.27 | 1.6.11 | CRITICAL | **RESOLVED** — `apiKey` → `@better-auth/api-key`, `passkey` → `@better-auth/passkey`, client plugin path migrated. Type annotations updated for TS2742 portability. |
| happy-dom | 19.0.2 | 20.9.0 | CRITICAL | **RESOLVED** — dev-only, no breaking changes |
| drizzle-orm | 0.44.7 | 0.45.2 | HIGH | **RESOLVED** — no breaking changes, 209 import files unchanged |
| nodemailer | 7.0.13 | 8.0.9 | LOW+MOD | **RESOLVED** — major version bump, types compatible |

**Verification:** All 4 workspaces typecheck clean. API test baseline unchanged (5735 pass, 12 fail pre-existing, 0 regressions).

### Wave 8 — Coverage Specs (COMPLETE ✅)

| Finding | Status | Action |
|---------|--------|--------|
| EC-001-booking | **RESOLVED** | MODULE_SPEC created at `docs/product/modules/m20-booking/MODULE_SPEC.md` |
| EC-002-billing | **RESOLVED** | MODULE_SPEC created at `docs/product/modules/m21-billing/MODULE_SPEC.md` |
| EC-003-email | **RESOLVED** | MODULE_SPEC created at `docs/product/modules/m22-email/MODULE_SPEC.md` |
| EC-004-communication-notsp | **RESOLVED** | TypeSpec coverage note added to M07 MODULE_SPEC §10 |
| EC-005-assocmember-notsp | **RESOLVED** | TypeSpec coverage note added to M05 MODULE_SPEC §10 |
| EC-006-assocops-notsp | **RESOLVED** | TypeSpec coverage note added to M14 MODULE_SPEC §10 |
| EC-007-platformadmin-gap | **RESOLVED** | TypeSpec coverage note added to M03 MODULE_SPEC §10 |

### Wave 9 — Module Spec Verification (COMPLETE ✅)

| Module | Status | Evidence |
|--------|--------|----------|
| M15 (job-board) | **ALREADY COMPLETE** | 22/22 sections populated, 9 endpoints, 4 entities, 5 business rules, 5 workflows |
| M16 (advertising) | **ALREADY COMPLETE** | 22/22 sections populated, 10 endpoints, 5 entities, 6 business rules, 5 workflows |
| M17 (marketplace) | **ALREADY COMPLETE** | 22/22 sections populated, 7 endpoints, 3 entities, 5 business rules, 3 workflows |
| M18 (surveys-polls) | **ALREADY COMPLETE** | 22/22 sections populated, 9 endpoints, 2 entities, 6 business rules, 4 workflows, TypeSpec COMPLETE |

Original enforcement claim of "empty specs" was stale — specs were populated during initial oli-module-specs run. No work needed.

### Wave 10 — P1 Triage & Resolution (COMPLETE ✅)

**Sub-waves executed:**

| Wave | Scope | Findings | Resolved | FP/Accepted | Deferred |
|------|-------|----------|----------|-------------|----------|
| 10a | Audit logging (AL-003..AL-013) | 11 | 10 | 1 (AL-005) | 0 |
| 10b | Cross-module coupling (EX-CM/EV) | 9 | 1 | 4 | 4 |
| 10c | UI journey (UJ-02..UJ-04) | 3 | 2 | 1 (UJ-04) | 0 |
| 10d | TypeSpec coverage (EC-008..EC-023) | 7 | 0 | 0 | 7 |
| 10e | Traceability (TR-001..TR-002) | 2 | 2 | 0 | 0 |
| 10f | Revenue analytics (EM-M03-revenue) | 1 | 1 | 0 | 0 |
| **Total** | | **33** | **16** | **6** | **11** |

**Infrastructure changes:**
- `audit-events.ts`: Added `data` category with pii-accessed, bulk-export, document-accessed, credential-verified sub-types
- `audit.ts`: Extended with `read`/`export` actions and optional `eventType: 'data-access'`
- `credit.service.ts`: New CreditService facade decoupling person → association:member

**Deferred to v1.2.0:**
- EC-008..EC-023: 7 modules lacking TypeSpec (same class as EM-M07-no-typespec)
- EX-CM-002/003/007: Bidirectional coupling + multi-context joins (requires data ownership restructure)
- EX-EV-001: task.overdue producer (needs cron infrastructure)

---

### Wave 11 — Billing Audit Logging + P1 Baseline Re-Triage (COMPLETE ✅)

**Track A — Billing audit logging (9 handlers):**

Nine billing handlers had no audit-trail emission. Added `auditAction()` calls + 9 new financial event sub-types.

| Handler | New audit sub-type |
|---------|--------------------|
| captureInvoicePayment | `payment-captured` |
| finalizeInvoice | `invoice-finalized` |
| updateInvoice | `invoice-updated` |
| deleteInvoice | `invoice-deleted` |
| markInvoiceUncollectible | `invoice-uncollectible` |
| createMerchantAccount | `merchant-account-created` |
| onboardMerchantAccount | `merchant-onboarded` |
| getMerchantDashboard | `merchant-dashboard-accessed` |
| handleStripeWebhook | `webhook-processed` |

Infra: `audit-events.ts` +9 sub-types; `core/audit.ts` + `utils/audit.ts` extended with `capture`/`finalize` actions. Typecheck passes.

**Track B — P1 baseline re-triage (~30 unnamed baseline P1s across 13 modules):**

Baseline `modules` block held count-only P1 entries (never given IDs or triaged). Surfaced descriptions from module enforce files + verified each against live code via 5 parallel read-only agents. Classified REAL / FP / DEFERRED.

| Module | Baseline P1 | Corrected | REAL | FP | Note |
|--------|------------|-----------|------|----|----|
| m01 | 3 | **5** | 5 | 0 | Onboarding-wizard suite (state/step/WF-005/WF-009/entity) — all unbuilt, REAL |
| m02 | 2 | 2 | 2 | 0 | Data export sync; M02 handlers emit zero events |
| m04 | 3 | 3 | 3 | 4 | 3 handler/event gaps REAL; 4 FP (handlers exist) |
| m05 | 4 | 4 | 4 | 3 | reviewApplication guard + 3 event gaps REAL; consumers/endpoints exist (FP→P2 path divergence) |
| m09 | 3 | **1** | 1 | 1 | Only cert-wiring REAL; 2 resolved prior waves |
| m10 | 3 | 3 | 5* | 0 | Transcript dead-code, partial events, GDPR event consumer (mitigated by cascade) |
| m11 | 4 | **5** | 5 | 0 | No role check, draft-state skip, zero events/consumers, HTML-not-PDF |
| m12 | 2 | **8** | 8 | 0 | ⚠️ castVote/createNominee unreachable, enum mismatch — severely undercounted |
| m14 | 3 | **5** | 5 | 0 | 3 missing endpoints + drill-down + DashboardExported event |
| m13/m15/m16/m17/m18/m19 | 1 each | 1 each | 0 | 0 | **DEFERRED** — every P1 is unbuilt future-module stub (~170 raw stubs collapsed) |

\*m10 sub-findings; several PARTIAL/mitigated.

**Re-triage outcome:** 7 FALSE POSITIVE confirmed (recorded in `resolved_p1s`); ~30 REAL P1s in built modules retained with named IDs (see `wave11_p1_triage` in baseline); ~170 future-module P1 stubs confirmed DEFERRED.

**⚠️ Highest-risk surfaced:** **m12 elections** — `castVote.ts`/`createNominee.ts` implement business rules but are NOT route-registered → members cannot vote or be nominated. `electionType` enum mismatch (DB `officer/bylaw` vs TypeSpec `general/special/byElection`) causes runtime insert failures. Baseline counted 2 P1s; actual is 8. Recommend prioritizing m12 in next fix wave.

---

### Wave 12 — m12 Elections Remediation (COMPLETE ✅)

Fixed the Wave-11 highest-risk cluster. Verified all 8 findings against live code first: **3 were FALSE POSITIVES, 5 REAL.**

**False positives (reclassified):** The flagged `elections/castVote.ts`, `elections/createNominee.ts`, and WF-076/077 unreachability are about *legacy dead duplicates*. The live voting/nomination flows — `castBallot` (POST /association/member/ballots) and `createCandidate` (POST /association/member/candidates) — were always TypeSpec-registered with real handlers. Members could vote/be nominated all along.

**5 REAL fixes:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M12-d2e3f4a5 | electionType enum mismatch (DB officer/bylaw vs TypeSpec general/special/byElection) | Reconciled TypeSpec→DB in `governance.tsp` (Election model + ElectionType + VotingMode + ElectionPositionSlot rewritten to match schema); `createElection` blind spread replaced with explicit field mapping |
| EM-M12-8e9f0a1b | updateNomineeStatus hand-wired, absent from OpenAPI | Migrated to TypeSpec as `updateCandidateStatus` (POST /association/member/candidates/{candidateId}/status); hand-wire + import removed from `app.ts` |
| EM-M12-a1b2c3d4 | WF-078 passageThreshold never evaluated | `certifyElection` now determines winners (plurality per position) and enforces passageThreshold (% of voters) for bylaw elections; winners marked `elected` |
| EM-M12-a0b1c2d3 | Live handlers emit zero domain events | Wired `election.created`, `election.status.changed` (open-nominations + open-voting), `election.deleted`, `nomination.submitted` |
| EM-M12-e4f5a6b7 | ElectionPublished never emitted | Added `election.published` to event registry (winners payload); emitted from `certifyElection`; new consumer performs M04 officer transition — ends outgoing terms + generates checklists, creates winner terms, emits `officer.transitioned`/`officer.assigned` |

**Frontend:** `election-form.tsx` submit mapping updated to new contract field names (`type`, `nominationsOpenAt/CloseAt`, `votingOpenAt/CloseAt`, `passageThreshold`) after SDK regen.

**Pipeline:** TypeSpec → `specs/api` build → `api-ts` generate → SDK regen. Unrelated regen churn (better-auth, websocket registry) reverted to HEAD. Typecheck passes: api-ts, memberry, sdk-ts.

**Outcome:** m12 P1 **8→0**, score **6.0→9.0**. No remaining REAL P1s in m12.

---

### Wave 13 — m11 Documents/Credentials Remediation (COMPLETE ✅)

Fixed the m11 cluster. Verified all 5 findings against live code first: **all 5 REAL.**

**5 REAL fixes:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M11-7a3e1c02 | createDocument hardcoded `status: 'published'`, skipping draft state | Added `status?: "draft" \| "published"` to `DocumentCreateRequest` (TypeSpec); `createDocument` defaults to `'draft'` when omitted, honors explicit `'published'` |
| EM-M11-g4b67c23 | createDocument missing role check | Org/chapter-owned documents now require officer access via `requireOfficerTerm`; self-owned person documents (member:owner) still permitted per API contract |
| EM-M11-d1e34f90 | M11 handlers emit zero domain events | Wired `document.created` (createDocument + uploadNewDocumentVersion), `credential.generated` (generateCertificatePdf), `verification.requested` (verifyCertificatePublic); events added to `domain-events.registry.ts` |
| EM-M11-e2f45a01 | Zero event consumers | Added consumers in `domain-event-consumers.ts`: `person.updated` (ID-card re-download notification on identity-field change), `membership.status.changed`, `training.completed` (certificate-available notification) |
| EM-M11-83a8b9c0 | generateCertificatePdf returned HTML, not real PDF | New `renderCertificatePdf` (pdf-lib, US Letter landscape 792×612, embedded Times fonts, accent border, signatory block); handler returns `application/pdf` bytes with `%PDF` header — WF-074 satisfied. `renderCertificateHtml` retained for batch/bulk issuance |

**Pipeline:** TypeSpec → `specs/api` build → `api-ts` generate (validators.ts gained `status` enum field). Unrelated regen churn (better-auth, websocket registry) reverted to HEAD. Typecheck passes: api-ts, memberry, sdk-ts. Tests: 326 pass / 0 fail across documents + certificates + consumers.

**Outcome:** m11 P1 **5→0**, score **6.0→9.0**. No remaining REAL P1s in m11.

---

### Wave 14 — m14 National Dashboard Remediation (COMPLETE ✅)

Fixed the m14 cluster. Verified all 5 findings against live code first: **all 5 REAL.** Module identity confirmed via baseline `module_identity` — m14 source is `association:operations/` (export handler) with the dashboard read endpoints served from `platformadmin/` via generated TypeSpec routes.

**5 REAL fixes:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M14-71a3e2f0 | `GET /admin/national/chapters` missing (S10 row 2) | Added TypeSpec `listNationalChapters` + handler `platformadmin/listNationalChapters.ts`. Sortable (`totalMembers`/`collectionRate`/`creditCompliance`), offset-paginated chapter comparison list; reuses `listChapterSnapshots` + new `getOrgNames`; M14-R2 suppresses <5-member chapters |
| EM-M14-82b4f3a1 | `GET /admin/national/chapters/{organizationId}` missing (S10 row 3) | Added TypeSpec `getNationalChapterDetail` + handler. Returns `memberStatusBreakdown` + `creditComplianceBreakdown` from snapshot; new repo `getChapterSnapshot`; 404 when no snapshot |
| EM-M14-93c5a4b2 | `GET /admin/national/platform` missing (S10 row 5) | Added TypeSpec `getPlatformSummary` + handler. Platform-admin-only cross-association rollup; new repo `listAssociationIdsForMonth` + reuse `getAssociationAggregate`; sortable + paginated |
| EM-M14-c6f8d7e5 | WF-085 chapter drill-down unimplemented | Satisfied by `getNationalChapterDetail` (single-chapter detailed view) |
| EM-M14-b1e3c2d0 | `DashboardExported` event not emitted | Added `dashboard.exported` to `domain-events.registry.ts`; emitted from `exportNationalDashboard` with `{exportId, associationId, format, exportedBy}` |

**Access control:** new `platformadmin/utils/national-access.ts` centralizes BR-36 — platform admins must pass `associationId`; national officers may omit it when holding exactly one active grant (new repo `getOfficerAssociationIds`), else required. Officer access verified via existing `isDesignatedNationalOfficer`.

**Pipeline:** TypeSpec → `specs/api` build → `api-ts` generate (3 routes/validators/registry entries + 3 handler stubs). Unrelated regen churn (better-auth, websocket registry) reverted to HEAD. Typecheck passes: api-ts, memberry, sdk-ts. Tests: 11 new pass; 254 pass / 0 fail across platformadmin + export suites.

**Outcome:** m14 P1 **5→0**, score **5.5→9.0**. No remaining REAL P1s in m14.

---

### Wave 15 — m01 Auth-Onboarding Remediation (COMPLETE ✅)

Fixed the m01 onboarding cluster. Verified all 5 findings against live code first: **all 5 REAL** — no onboarding handlers, endpoints, or entity existed. Module identity per baseline `module_identity` is `handlers/person/`; the new resumable wizard handlers were placed in `handlers/onboarding/` (tag `Onboarding` → generator dir rule) and bulk import in `handlers/invite/` (tag `Invite`).

**5 REAL fixes:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M01-d8e9f0a1 | `OnboardingState` entity absent | New org-scoped `onboarding_state` table (`organizationId` unique, `currentStep` 1-5, `stepsCompleted` jsonb int[], `completedAt` nullable) via `handlers/onboarding/repos/onboarding.schema.ts` + repo; migration `0058_fast_stingray.sql` |
| EM-M01-a1b2c3d4 | `GET /onboarding/state` missing | TypeSpec `getOnboardingState` + `handlers/onboarding/getOnboardingState.ts`. Query `orgId`; officer-gated via `requireOfficerTerm` against the *requested* org; 404 when wizard not started |
| EM-M01-e5f6a7b8 | `PUT /onboarding/step` missing | TypeSpec `updateOnboardingStep` + handler. Enforces in-order steps (out-of-order → `M01-004` 422), bootstraps at step 1, advances `currentStep`, marks complete + emits `onboarding.completed` on final step |
| EM-M01-c9d0e1f2 | WF-005 resumable wizard unimplemented | Satisfied by state/step endpoints — progress persisted org-scoped across the 5 steps (profile/import/dues/gateway/invite), resumable across sessions |
| EM-M01-34a5b6c7 | WF-009 bulk import lacks preview/dedup/token | TypeSpec `bulkImportMembers` (POST `/invitations/bulk-import`) + `handlers/invite/bulkImportMembers.ts`. CSV parser (quoted fields/embedded commas), `preview`/`import` modes, dedup (within-CSV + against pending invites), HMAC claim-token issuance per valid row |

**Domain event:** added `onboarding.completed` (`{organizationId, officerId}`) to `domain-events.registry.ts`; emitted once on the transition into completed (not re-emitted on re-save of the final step).

**Deliberate deviation:** the contract specifies `multipart/form-data` for bulk import, but the codegen pipeline does not support multipart bodies. CSV is passed inline as a JSON `csvContent` string instead (≤1 MiB). Behavior (preview/dedup/token) matches the contract.

**Pipeline:** TypeSpec → `specs/api` build → `api-ts` generate (3 routes/validators/registry entries + 3 handler stubs) → `db:generate`. Unrelated regen churn (better-auth, websocket registry) reverted to HEAD. Typecheck passes: api-ts, memberry, sdk-ts. Tests: 16 new pass (10 onboarding + 6 bulk import). Existing pure-domain `ac-m01` AC test left untouched.

**Outcome:** m01 P1 **5→0**, score **6.0→9.0**. No remaining REAL P1s in m01.

---

### Wave 16 — m05 Membership Remediation (COMPLETE ✅)

Fixed the m05 membership cluster. Verified all 4 findings against live code first — uncovered a **path divergence**: the baseline `module_identity` for m05 is `handlers/membership/`, but those handlers (`reviewApplication.ts`, `importMembers.ts`, `csvImport.ts`) are **UNWIRED** — no route in `app.ts` or `generated/openapi/routes.ts`; only their repo is consumed by sibling modules. The live, route-wired membership lifecycle lives in `handlers/association:member/` (TypeSpec). Fixes were applied to the **wired** handlers.

**3 REAL fixes:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M05-evt-resigned | `resignMembership` emits no event | `association:member/resignMembership.ts` now emits `membership.status.changed` (`oldStatus`=computed current → `newStatus`=`resigned`) after audit. Existing consumer (`domain-event-consumers.ts:905`) notifies member of status/ID-card change |
| EM-M05-evt-deceased | `deceaseMembership` emits no event | `association:member/deceaseMembership.ts` now emits `membership.status.changed` (→`deceased`). Same consumer fires |
| EM-M05-evt-imported | import handlers emit no event | `association:member/importRosterMembers.ts` collects successfully-imported `personIds` and emits new `membership.imported` (`{organizationId, importedBy, importedCount, personIds[]}`) when ≥1 imported. New bulk-async consumer sends welcome notifications |

**1 FALSE POSITIVE (reclassified):**

| ID | Finding | Verdict |
|----|---------|---------|
| EM-M05-P1-AUTH | `reviewApplication.ts` lacks `requirePosition` guard | **FALSE POSITIVE** — path divergence. The flagged `membership/reviewApplication.ts` is unwired/dead. Live application approval is `association:member/approveMembershipApplication.ts`, which already enforces `requirePosition([Secretary,President])` at line 20 (and `denyMembershipApplication` likewise). No live attack surface |

**Domain event:** added `membership.imported` to `domain-events.registry.ts` + consumer in `domain-event-consumers.ts`.

**Pipeline:** hand-wired/TypeSpec handlers edited directly + internal event registry/consumer (no SDK-facing schema change → no codegen). No `src/generated/*` touched. Typecheck passes: api-ts, memberry, sdk-ts. Tests: 34 pass across resign/decease/import handler suites (incl. 3 new emit assertions + new `importRosterMembers.test.ts`); 287 core tests pass.

**Outcome:** m05 P1 **4→0** (3 REAL fixed, 1 FP), score **6.0→9.0**.

---

### Wave 17 — m04 Org-Admin Remediation (COMPLETE ✅)

Fixed the m04 org-admin cluster (3 P1s). Verified each against live code first. As in Wave 16, the 2026-05-28 re-audit was partly stale: it claimed 4/8 endpoints were hand-wired, but `getOrganizationProfile` + `updateOrganizationProfile` are now OpenAPI-generated (`/association/member/org-profile/:organizationId`, `routes.ts:1498/1505`). Only transition + dashboard remain hand-wired (`app.ts:468/471`); `createDisciplinaryAction` exists but is not route-registered.

**1 REAL fix:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M04-u1v2w3x4 | OrgSettingsUpdated event never emitted (5/6 lifecycle events wired) | Added `org.settings.updated` to `domain-events.registry.ts` (Governance context, `{organizationId, updatedBy, updatedFields}`); emitted from `updateOrganizationProfile.ts` after audit (fire-and-forget `.catch`). New `updateOrganizationProfile.test.ts`: 2 tests verify emit-on-success + no-emit-on-403. No consumer (informational event, no side-effect warranted) |

**2 doc reconciliations:**

| ID | Finding | Fix |
|----|---------|-----|
| EM-M04-01a8b7c6 | Spec-to-OpenAPI path mismatch (partial FP) | MODULE_SPEC §10 rewritten to actual wired paths + OpenAPI/hand-wired wiring column. Audit's "4 hand-wired" claim stale — only transition + dashboard hand-wired; disciplinary handler exists but unwired |
| EM-M04-02d5e4f3 | 10 bonus endpoints undocumented in §10 | Added "Position & Officer-Term Management Endpoints" table to §10 (position CRUD ×5, officer-term list/get/update ×3, summary, my-officer-role) with paths + wiring |

**Pipeline:** internal event registry + handler edit + doc only (no SDK-facing schema change → no codegen). No `src/generated/*` touched. Typecheck passes: api-ts, memberry, sdk-ts. Tests: 49 pass across `updateOrganizationProfile.test.ts` (new, 2), `officer-admin.test.ts`, `ac-m04.org-admin.test.ts`.

**Outcome:** m04 P1 **3→0** (1 REAL fixed, 1 doc-reconcile, 1 partial-FP+doc), score **7.5→8.5**.

---

## What's Next

1. **Waves 1-17 COMPLETE.** Security gate satisfied. No P0 regressions. All P1 audit logging resolved (incl. 9 billing handlers in Wave 11). Revenue analytics gap filled. Baseline P1s fully triaged with named IDs. **Wave 12 closed m12 elections (5 REAL, 3 FP); Wave 13 closed m11 documents/credentials (5 REAL); Wave 14 closed m14 national dashboard (5 REAL); Wave 15 closed m01 auth-onboarding (5 REAL); Wave 16 closed m05 membership (3 REAL, 1 FP); Wave 17 closed m04 org-admin (1 REAL event, 2 doc reconciliations, 1 partial FP).**
2. **Remaining P0s: 1** (EM-M07-no-typespec — communication module 28 hand-wired handlers, DEFERRED).
3. **Remaining P1s (built modules): ~2 clusters left** (see `wave11_p1_triage` in baseline; m01 + m04 + m05 + m11 + m12 + m14 clusters resolved). Priority order for next fix wave:
   - **P1 — m02 (assoc-ops):** cross-chapter rollup spec/path divergence.
   - **P1 — m09 + m10:** certificate↔training wiring; storage/events scattered gaps.
   - **DEFERRED:** ~170 future-module P1 stubs (m13/m15/m16/m17/m18/m19); 7 TypeSpec, 3 coupling, 1 event from Wave 10.
4. **Coverage Score: 78 → ~85** (estimated after Wave 10 + Wave 11 billing audit logging).
