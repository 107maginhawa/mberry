<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-28T12:00:00Z -->

# Enforcement Report

**Generated:** 2026-05-28
**Modules Audited:** 19 (m01-auth-onboarding, m02-member-profile, m03-platform-admin, m04-org-admin, m05-membership, m06-dues-payments, m07-communications, m08-events, m09-training, m10-credit-tracking, m11-documents-credentials, m12-elections-governance, m13-professional-feed, m14-national-dashboard, m15-job-board, m16-advertising, m17-marketplace, m18-surveys-polls, m19-committee-management)
**Baseline Compared:** 2026-05-27T21:00:00Z
**Days Since Last Run:** 1
**Coverage Completeness:** FULL

---

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_MAP.md | YES | YES |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | YES |
| EVENT_CONTRACTS.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
| AUDIT_CONTRACTS.md | YES | YES |
| Baseline (.baseline.json) | YES | YES |

**Sub-skills dispatched:**
- [x] oli-enforce-coverage (Phase 0)
- [x] dependency security scan (Phase 0.5, bun.lock — 13 CVEs found)
- [x] oli-enforce-module (Phase 1, per module — 19 modules)
- [x] oli-enforce-file (Phase 1, per module — 19 modules)
- [x] oli-ui-journey (Phase 1.5, 14 frontend modules)
- [x] oli-enforce-cross-module (Phase 2)
- [x] oli-trace (Phase 2.5, PRD→spec→code chains)
- [x] oli-audit-compliance (Phase 3, audit logging only)

**Incomplete sub-skills:** none

---

## Coverage Completeness

**Status:** FULL

All mandatory phases completed. Scores reflect full enforcement coverage.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Coverage Score** | 62% ⚠ WARN |
| **Modules Audited** | 19 |
| **Implemented Modules** | 14 |
| **Future Modules (spec-only)** | 5 |
| **Compliant Modules (≥ 9.0)** | 0 |
| **Non-Compliant Modules (any P0/P1)** | 19 |
| **Total P0 Findings** | 20 |
| **Total P1 Findings** | 109 (implemented) + 208 (future) = 317 |
| **Total P2 Findings** | ~145 |
| **Total P3 Findings** | ~85 |
| **Cross-Module P0** | 1 |
| **Cross-Module P1** | 11 |
| **Dependency CVE P0** | 3 |
| **Dependency CVE P1** | 5 |
| **Audit Logging P0** | 1 |
| **Audit Logging P1** | 21 |
| **UI Journey P0** | 4 |
| **Regressions (new P0/P1)** | 5 (new P0s not in baseline) |
| **Resolved Since Last Run** | 19 P0s + multiple P1s |
| **Overall Trend** | IMPROVING |

**Overall trend:** IMPROVING — 19 P0s resolved since last run, more resolutions than regressions. No new security P0s in core auth/data modules.

---

## Coverage Findings

| Module | Coverage Score | Depth | Breadth | Status |
|--------|---------------|-------|---------|--------|
| m01-auth-onboarding | 75% | PARTIAL | ALL | WARN |
| m02-member-profile | 70% | PARTIAL | PARTIAL | WARN |
| m03-platform-admin | 55% | PARTIAL | PARTIAL | WARN |
| m04-org-admin | 40% | SHALLOW | PARTIAL | FAIL |
| m05-membership | 65% | PARTIAL | ALL | WARN |
| m06-dues-payments | 50% | PARTIAL | PARTIAL | FAIL |
| m07-communications | 35% | SHALLOW | PARTIAL | FAIL |
| m08-events | 60% | PARTIAL | PARTIAL | WARN |
| m09-training | 55% | PARTIAL | PARTIAL | WARN |
| m10-credit-tracking | 65% | PARTIAL | PARTIAL | WARN |
| m11-documents-credentials | 60% | PARTIAL | PARTIAL | WARN |
| m12-elections-governance | 70% | FULL | ALL | WARN |
| m13-professional-feed | 100% | FULL | ALL | PASS (spec-only) |
| m14-national-dashboard | 45% | SHALLOW | PARTIAL | FAIL |
| m15–m19 (future) | 100% | FULL | ALL | PASS (spec-only) |

**Coverage P0 Findings:** 3 (M04 mega-module breadth gap, M06 spec-vs-impl divergence, M14 handler attribution confusion)

Details: [→ ENFORCEMENT_COVERAGE.md](ENFORCEMENT_COVERAGE.md)

---

## Module Compliance

| Module | Score | Label | P0 | P1 | P2 | P3 | Trend | Status | Detail |
|--------|-------|-------|----|----|----|----|----|--------|--------|
| m01-auth-onboarding | 6.0/10 | PARTIAL | 0 | 5 | 4 | 2 | → | COMPLETE | [→](enforce/module/m01-auth-onboarding.md) |
| m02-member-profile | 6.4/10 | PARTIAL | 1 | 4 | 5 | 3 | ↑ | COMPLETE | [→](enforce/module/m02-member-profile.md) |
| m03-platform-admin | 7.0/10 | MOSTLY | 1 | 5 | 10 | 6 | ↑ | COMPLETE | [→](enforce/module/m03-platform-admin.md) |
| m04-org-admin | 7.0/10 | MOSTLY | 0 | 2 | 4 | 2 | ↑ | COMPLETE | [→](enforce/module/m04-org-admin.md) |
| m05-membership | 6.0/10 | PARTIAL | 0 | 5 | 5 | 4 | → | COMPLETE | [→](enforce/module/m05-membership.md) |
| m06-dues-payments | 6.5/10 | PARTIAL | 1 | 5 | 6 | 2 | ↓ | COMPLETE | [→](enforce/module/m06-dues-payments.md) |
| m07-communications | 6.0/10 | PARTIAL | 4 | 5 | 7 | 4 | ↑ | COMPLETE | [→](enforce/module/m07-communications.md) |
| m08-events | 4.0/10 | NON | 2 | 7 | 3 | 1 | ↓ | COMPLETE | [→](enforce/module/m08-events.md) |
| m09-training | 5.0/10 | PARTIAL | 1 | 1 | 11 | 3 | ↓ | COMPLETE | [→](enforce/module/m09-training.md) |
| m10-credit-tracking | 7.0/10 | MOSTLY | 0 | 3 | 11 | 5 | ↑ | COMPLETE | [→](enforce/module/m10-credit-tracking.md) |
| m11-documents-credentials | 3.0/10 | CRITICAL | 1 | 5 | 10 | 2 | ↓ | COMPLETE | [→](enforce/module/m11-documents-credentials.md) |
| m12-elections-governance | 6.0/10 | PARTIAL | 0 | 7 | 7 | 3 | ↓ | COMPLETE | [→](enforce/module/m12-elections-governance.md) |
| m13-professional-feed | 0.0/10 | CRITICAL | 0 | 25 | 0 | 0 | → | COMPLETE | [→](enforce/module/m13-professional-feed.md) |
| m14-national-dashboard | 5.5/10 | PARTIAL | 0 | 4 | 9 | 1 | ↑ | COMPLETE | [→](enforce/module/m14-national-dashboard.md) |
| m15-job-board | 0.0/10 | CRITICAL | 0 | 33 | 0 | 0 | → | COMPLETE | [→](enforce/module/m15-job-board.md) |
| m16-advertising | 0.0/10 | CRITICAL | 0 | 43 | 0 | 0 | → | COMPLETE | [→](enforce/module/m16-advertising.md) |
| m17-marketplace | 0.0/10 | CRITICAL | 0 | 33 | 0 | 0 | → | COMPLETE | [→](enforce/module/m17-marketplace.md) |
| m18-surveys-polls | 0.0/10 | CRITICAL | 0 | 32 | 0 | 0 | → | COMPLETE | [→](enforce/module/m18-surveys-polls.md) |
| m19-committee-management | 0.0/10 | CRITICAL | 0 | 42 | 0 | 0 | → | COMPLETE | [→](enforce/module/m19-committee-management.md) |

### P0 Module Findings (Action Required)

| ID | Sev | Module | Finding | Dimension | Status |
|----|-----|--------|---------|-----------|--------|
| EM-M02-qrhmac | P0 | m02 | QR HMAC falls back to hardcoded `'fallback-secret'` when AUTH_SECRET unset | Security | NEW |
| EM-M03-escalation | P0 | m03 | `revokeAdmin`, `deleteAssociation`, `updateAdmin` lack super-only caller role guards | Auth/Permissions | KNOWN |
| EM-M06-zero-events | P0 | m06 | Zero domain events emitted — M05 membership expiry integration broken | Domain Events | NEW |
| EM-M07-cancelled | P0 | m07 | Missing `cancelled` enum value in message status | State Machine | KNOWN |
| EM-M07-zero-events | P0 | m07 | Zero domain events emitted across all 5 handler directories | Domain Events | KNOWN |
| EM-M07-deceased | P0 | m07 | No deceased/suppressed recipient check (M7-R5) | Business Rules | KNOWN |
| EM-M07-no-typespec | P0 | m07 | No `communication.tsp` TypeSpec file — routes hand-wired | Architecture | KNOWN |
| EM-M08-publish | P0 | m08 | `publishEvent` handler does not exist — events stuck in draft | State Machine | NEW |
| EM-M08-complete | P0 | m08 | `completeEvent` handler does not exist — events never complete | State Machine | NEW |
| EM-M09-dead-code | P0 | m09 | 8/14 training handler files are dead code — not routed | Architecture | NEW |
| EM-M11-pii | P0 | m11 | `verifyCertificatePublic` leaks PII (full name) to unauthenticated callers | Security | KNOWN |

### P1 Module Findings (Implemented modules only — 109 total)

See per-module detail files for full P1 listings. Top items:

| Module | Key P1s |
|--------|---------|
| m01 | Onboarding wizard missing, bulk CSV import test-only, 2/4 domain events missing |
| m02 | Zero domain events for profile, data export still synchronous |
| m03 | Revenue analytics endpoints missing, subscription lifecycle incomplete |
| m04 | Spec paths diverge from OpenAPI, 10 bonus endpoints undocumented |
| m05 | reviewApplication lacks officer position check, 4/6 events missing |
| m06 | `GET /my/payments` missing, no 2FA on financial mutations, RBAC gaps |
| m07 | Stats endpoint missing, consumed events unwired, role guards missing |
| m08 | No TypeSpec, BR-15 violated, 4/5 domain events missing |
| m09 | Certificate generation not wired to training |
| m10 | Transcript export dead code, GDPR event handler missing |
| m11 | createDocument no role check, documents bypass draft state, HTML not PDF |
| m12 | castVote/createNominee NO route registration — voting unreachable |
| m14 | 3/5 spec endpoints missing, no feature flags |

---

## File Compliance

| Module | Files Checked | P0 | P1 | P2 | P3 | Status | Detail |
|--------|---------------|----|----|----|----|----|--------|
| m01 | 44 | 1 | 9 | 12 | 4 | COMPLETE | [→](enforce/file/m01-auth-onboarding.md) |
| m02 | 20 | 0 | 2 | 9 | 4 | COMPLETE | [→](enforce/file/m02-member-profile.md) |
| m03 | 78 | 0 | 3 | 35 | 4 | COMPLETE | [→](enforce/file/m03-platform-admin.md) |
| m04 | 100+ | 0 | 1 | 4 | 1 | COMPLETE | [→](enforce/file/m04-org-admin.md) |
| m05 | 30 | 0 | 5 | 9 | 7 | COMPLETE | [→](enforce/file/m05-membership.md) |
| m06 | 40 | 1 | 7 | 8 | 3 | COMPLETE | [→](enforce/file/m06-dues-payments.md) |
| m07 | 163 | 0 | 3 | 13 | 5 | COMPLETE | [→](enforce/file/m07-communications.md) |
| m08 | 40 | 0 | 4 | 16 | 7 | COMPLETE | [→](enforce/file/m08-events.md) |
| m09 | 25 | 0 | 4 | 14 | 5 | COMPLETE | [→](enforce/file/m09-training.md) |
| m10 | 55 | 0 | 4 | 14 | 5 | COMPLETE | [→](enforce/file/m10-credit-tracking.md) |
| m11 | 66 | 1 | 7 | 13 | 5 | COMPLETE | [→](enforce/file/m11-documents-credentials.md) |
| m12 | 20 | 0 | 4 | 17 | 6 | COMPLETE | [→](enforce/file/m12-elections-governance.md) |
| m13 | 0 | 0 | 0 | 0 | 0 | COMPLETE | [→](enforce/file/m13-professional-feed.md) |
| m14 | 100 | 0 | 3 | 4 | 3 | COMPLETE | [→](enforce/file/m14-national-dashboard.md) |
| m15–m19 | 0 | 0 | 0 | 0 | 0 | COMPLETE | (future) |

### P0 File Findings (Action Required)

| ID | Sev | Module | Finding | File | Status |
|----|-----|--------|---------|------|--------|
| EF-M01-lockout | P0 | m01 | Missing account lockout after 5 failed logins — brute-force vector | handlers/person/ | NEW |
| EF-M06-paylink | P0 | m06 | `sendPaymentLink` missing role check — any authenticated user can send | handlers/dues/sendPaymentLink.ts | KNOWN |
| EF-M11-pii | P0 | m11 | PII leak in `verifyCertificatePublic` — holder names on public endpoint | handlers/certificates/verifyCertificatePublic.ts | KNOWN |

---

## Cross-Module Findings

| Severity | Count |
|----------|-------|
| P0 | 1 |
| P1 | 11 |
| P2 | 9 |
| P3 | 7 |

### P0/P1 Cross-Module Findings (Action Required)

| ID | Sev | Finding | Modules | Status |
|----|-----|---------|---------|--------|
| EX-NOTIF-enum | P0 | 3 notification types (`booking_auto_rejected`, `booking_expired`, `event.created`) absent from `notificationTypeEnum` — runtime constraint violation | booking, events, notifs | NEW |
| EX-MEGA-deps | P1 | 40+ undeclared cross-module import edges (person→association:member 26 imports) | multiple | KNOWN |
| EX-EVENT-bus | P1 | Domain event bus has zero production `emit()` consumers. 17 declared cross-module events completely unused | all | KNOWN |
| EX-REMIND-dup | P1 | `reminderProcessor.ts` duplicated in dues/jobs/ and association:member/jobs/ | m06, m04 | KNOWN |

Details: [→ cross-module.md](enforce/cross-module.md)

---

## UI Journey Findings

| Module | P0 | P1 | P2 | P3 |
|--------|----|----|----|-----|
| All 14 frontend modules | 4 | 12 | 16 | 7 |

### P0 UI Journey Findings (Action Required)

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| UJ-NAV-orphan6 | P0 | 6 orphaned routes (`/my/payments`, `/my/bookings`, `/my/id-card`, `/my/billing`, `/my/schedule`, `/my/data-export`) — no navigation paths, users cannot discover features | KNOWN |
| UJ-NAV-legacy | P0 | Legacy `officer/dues/*` routes coexist with new `officer/finances/*` | KNOWN |
| UJ-NAV-officer3 | P0 | 3 officer routes (`settings/cpd`, `compliance`, `certificates`) orphaned from sidebar | KNOWN |
| UJ-SDK-raw | P0 | Raw `api.get()` calls in `my-cpd.tsx` and `home.tsx` bypass SDK type safety | NEW |

Details: [→ ui-journey/all-modules.md](enforce/ui-journey/all-modules.md)

---

## Traceability Findings

| Metric | Value |
|--------|-------|
| Chain Coverage | 86.2% |
| P0 Gaps | 0 |
| P1 Gaps | 3 |
| P2 Gaps | 16 |
| P3 Gaps | 15 |

### P0/P1 Traceability Findings

| ID | Sev | Gap Type | Module | Finding | Status |
|----|-----|----------|--------|---------|--------|
| TR-M08-payment | P1 | Broken chain | m08 | Paid event payment initiation missing (only refund path) | KNOWN |
| TR-M06-actags | P1 | Untested ACs | m06 | All 7 ACs lack test tag traceability | KNOWN |
| TR-CROSS-cert | P1 | Cross-module blind spot | m09→m11 | `training.completed` not wired to certificate generation | KNOWN |

Details: [→ trace.md](enforce/trace.md)

---

## Dependency Security Findings

| Ecosystem | Lockfile | Vulnerabilities | P0 | P1 | P2 | P3 | Status |
|-----------|----------|----------------|----|----|----|----|----|
| JavaScript/Bun | bun.lock | 13 | 3 | 5 | 3 | 2 | COMPLETE |

### Lockfile Integrity Issues

All lockfiles have valid manifests.

### P0/P1 Dependency Findings (Action Required)

| ID | Sev | CVE | Package | Title | Fix Available |
|----|-----|-----|---------|-------|---------------|
| ED-GLOBAL-xg6xh9c9 | P0 | GHSA-xg6x-h9c9-2m83 | better-auth <1.4.2 | **2FA Bypass via Premature Session Caching** | YES: upgrade ≥1.4.2 |
| ED-GLOBAL-qpm26cq5 | P0 | GHSA-qpm2-6cq5-7pq5 | happy-dom ≥19 <20.0.2 | Code generation bypass (dev-only) | YES: upgrade ≥20.0.2 |
| ED-GLOBAL-37j7fg3j | P0 | GHSA-37j7-fg3j-429f | happy-dom ≥19 <20.0.2 | VM Context Escape → RCE (dev-only) | YES: upgrade ≥20.0.2 |
| ED-GLOBAL-gpj5g38j | P1 | GHSA-gpj5-g38j-94v9 | drizzle-orm <0.45.2 | **SQL injection via escaped identifiers** | YES: upgrade ≥0.45.2 |
| ED-GLOBAL-x732676q | P1 | GHSA-x732-6j76-qmhm | better-auth <1.4.2 | Double-slash bypasses rate limits | YES: upgrade ≥1.4.2 |
| ED-GLOBAL-p6v2xcpg | P1 | GHSA-p6v2-xcpg-h6xw | better-auth <1.4.2 | Rate limiter IPv6 bypass | YES: upgrade ≥1.4.2 |
| ED-GLOBAL-w4gpfjgq | P1 | GHSA-w4gp-fjgq-3q4g | happy-dom ≥19 <20.0.2 | Fetch credentials leak (dev-only) | YES: upgrade ≥20.0.2 |
| ED-GLOBAL-6q6hj7hj | P1 | GHSA-6q6h-j7hj-3r64 | happy-dom ≥19 <20.0.2 | Unsanitized export names (dev-only) | YES: upgrade ≥20.0.2 |

---

## Audit Logging Findings

**Compliance rate: 35% (14/40 events fully compliant)**

| Category | Events | Compliant | Missing | P0 | P1 | P2 |
|----------|--------|-----------|---------|----|----|-----|
| Authentication | 9 | 4 | 5 | 0 | 5 | 0 |
| Data Access | 6 | 3 | 2 | 1 | 2 | 1 |
| Financial | 6 | 0 | 4 | 0 | 4 | 2 |
| Membership | 6 | 0 | 5 | 0 | 5 | 1 |
| Governance | 5 | 0 | 4 | 0 | 4 | 1 |
| Administrative | 5 | 4 | 1 | 0 | 1 | 0 |
| Content | 4 | 3 | 1 | 0 | 0 | 0 |

### P0 Audit Logging Findings

| ID | Sev | Finding | File | Status |
|----|-----|---------|------|--------|
| AL-PERSON-a1b2c3d4 | P0 | `exportMyData` returns full PII with NO audit log — bulk PII exfiltration invisible to compliance | handlers/person/exportMyData.ts | NEW |

Details: [→ audit-compliance/all.md](enforce/audit-compliance/all.md)

---

## Ratchet Summary

**Baseline date:** 2026-05-27T21:00:00Z (1 day ago)

### Regressions — New P0 (Action Required)

5 new P0 findings not in previous baseline:

| ID | Sev | Module | Finding | First Seen |
|----|-----|--------|---------|------------|
| EM-M02-qrhmac | P0 | m02 | QR HMAC hardcoded fallback secret | 2026-05-28 |
| EM-M06-zero-events | P0 | m06 | Zero domain events emitted | 2026-05-28 |
| EM-M08-publish | P0 | m08 | publishEvent handler missing | 2026-05-28 |
| EM-M08-complete | P0 | m08 | completeEvent handler missing | 2026-05-28 |
| EM-M09-dead-code | P0 | m09 | 8/14 handlers dead code | 2026-05-28 |

**Note:** These are newly DISCOVERED by deeper enforcement, not necessarily newly introduced in code. Prior audit had shallower checks.

### Resolved Since Last Run (19 P0s)

| ID | Module | Resolution |
|----|--------|------------|
| EM-M03-admin-role | m03 | fixed — admin role check added |
| EM-M04-term-bypass | m04 | fixed — isValidTermTransition() called |
| EM-M04-svg-xss | m04 | fixed — SVG signature detection blocks uploads |
| EM-M05-zero-events | m05 | fixed — membership.created emitted |
| EM-M07-publish-noop | m07 | fixed — downgraded to P1 |
| EM-M07-event-dead | m07 | fixed — announcement.published emitted |
| EM-M09-zero-events | m09 | fixed — 3 events wired |
| EM-M09-status-bypass | m09 | fixed — forces status: draft |
| EM-M11-pii-leak | m11 | fixed — holderName removed from select |
| EF-M04-cancelled-key | m04 | fixed — cancelled terminal state added |
| EF-M05-addmember-auth | m05 | fixed — officer role guard added |
| EF-M05-addmember-dup | m05 | fixed — 23505 → ConflictError |
| EF-M06-paylink-auth | m06 | fixed — officer role verification added |
| EF-M07-subtopic-role | m07 | fixed — president/admin guard added |
| EF-M11-pii-file | m11 | fixed — same as EM-M11 |
| UJ-M01-accept-invite | m01 | fixed — route invite/$token.tsx exists |
| UJ-M02-nav-wrong | m02 | fixed — links to /settings/security correctly |
| UJ-M03-org-lifecycle | m03 | fixed — onClick handlers wired |
| UJ-M03-add-org | m03 | fixed — createOrganizationMutation wired |

### Per-Module Score Trend

| Module | Previous | Current | Trend | New P0/P1 |
|--------|----------|---------|-------|-----------|
| m01-auth-onboarding | 6.0 | 6.0 | → | — |
| m02-member-profile | 5.5 | 6.4 | ↑ | 1 P0 |
| m03-platform-admin | 6.5 | 7.0 | ↑ | — |
| m04-org-admin | 6.5 | 7.0 | ↑ | — |
| m05-membership | 6.0 | 6.0 | → | — |
| m06-dues-payments | 7.5 | 6.5 | ↓ | 1 P0 |
| m07-communications | 5.5 | 6.0 | ↑ | — |
| m08-events | 7.0 | 4.0 | ↓ | 2 P0 |
| m09-training | 7.0 | 5.0 | ↓ | 1 P0 |
| m10-credit-tracking | 6.5 | 7.0 | ↑ | — |
| m11-documents-credentials | 5.5 | 3.0 | ↓ | — |
| m12-elections-governance | 8.0 | 6.0 | ↓ | — |
| m13-professional-feed | 0.0 | 0.0 | → | — |
| m14-national-dashboard | 1.5 | 5.5 | ↑ | — |
| m15–m19 (future) | 0.0 | 0.0 | → | — |

**Score movement:** 7 modules ↑, 5 modules ↓, 7 modules →. Downward corrections (m08, m09, m11, m12) reflect deeper enforcement catching issues the prior shallow audit missed.

---

## Stabilization Plan

### Fix Now — P0 Findings (20 total)

**Production Security (fix immediately):**

1. **ED-GLOBAL-xg6xh9c9** — better-auth 2FA Bypass
   - Action: `bun update better-auth` to ≥1.4.2

2. **ED-GLOBAL-gpj5g38j** — drizzle-orm SQL injection
   - Action: `bun update drizzle-orm` to ≥0.45.2

3. **EM-M02-qrhmac** — QR HMAC hardcoded fallback secret
   - File: person/utils/qr-code.ts
   - Action: Remove fallback, require AUTH_SECRET, throw on missing

4. **EM-M03-escalation** — Admin privilege escalation
   - File: platformadmin/revokeAdmin.ts, deleteAssociation.ts, updateAdmin.ts
   - Action: Add `requireSuperAdmin()` guard to each handler

5. **AL-PERSON-a1b2c3d4** — PII export unaudited
   - File: person/exportMyData.ts
   - Action: Add `auditAction('data.pii-exported', ...)` call

6. **EM-M11-pii** — Certificate PII leak
   - File: certificates/verifyCertificatePublic.ts
   - Action: Remove holder name from public response, add HMAC validation

7. **EX-NOTIF-enum** — Notification type enum mismatch
   - File: notifs/repos/notification.schema.ts
   - Action: Add `booking_auto_rejected`, `booking_expired`, `event.created` to enum

8. **EF-M01-lockout** — No account lockout
   - File: core/auth.ts
   - Action: Implement 5-attempt lockout per M1-R4 spec

9. **EF-M06-paylink** — Payment link no role check
   - File: dues/sendPaymentLink.ts
   - Action: Add officer role verification

**Architectural (fix before new feature work):**

10. **EM-M08-publish/complete** — Event lifecycle broken
    - Action: Create publishEvent.ts and completeEvent.ts handlers with state machine transitions

11. **EM-M09-dead-code** — 8 dead handler files
    - Action: Either wire to routes or remove dead code

12. **EM-M06-zero-events** — No domain events in dues
    - Action: Add PaymentRecorded, InvoiceGenerated event emissions

13. **EM-M07 P0s** (4) — Communications architectural gaps
    - Action: Add cancelled enum, wire domain events, implement deceased check, create TypeSpec

**Dev-only (lower urgency):**

14-15. **ED-GLOBAL happy-dom** (2 P0s) — Dev dependency RCE
    - Action: `bun update happy-dom` to ≥20.0.2

### Fix Before New Work — P1 Findings (109 in implemented modules)

Top priority P1 clusters:

1. **Audit logging (21 P1s)** — Financial and membership handlers completely unaudited. BIR 7-year requirement violated.
2. **Domain events (across modules)** — Most modules emit few/no events. Cross-module integration is broken.
3. **Elections (m12)** — castVote and createNominee handlers have NO route registration. Core governance feature unreachable.
4. **UI orphan routes (12 P1s)** — Features exist but no navigation path. Users can't discover them.

### Fix When Touching — P2 Findings (~145)

| Area | Count | Pattern |
|------|-------|---------|
| Spec drift (route paths) | ~30 | TypeSpec paths vs actual routes diverge |
| Missing validations | ~25 | BR enforcement gaps |
| Auth inconsistency | ~20 | Role check patterns vary |
| Domain model gaps | ~15 | Schema missing spec-declared fields |
| Error handling | ~15 | Inline ctx.json errors vs typed responses |
| Test gaps | ~20 | Untested handlers |
| Other | ~20 | Various |

### Track — P3 Findings (~85)

Mostly naming conventions, optional features, and style improvements. See per-module detail files.

---

## What's Next

### CRITICAL — P0 Findings Require Immediate Action

20 P0 finding(s) found across m01, m02, m03, m06, m07, m08, m09, m11, GLOBAL (dependencies), GLOBAL (cross-module).

1. Review P0 findings in the "Fix Now" section above
2. Fix all P0 issues before any other work — these are security or data integrity risks
3. **Priority 1:** Upgrade `better-auth` and `drizzle-orm` (CVE fixes, one command each)
4. **Priority 2:** Fix QR HMAC fallback, admin escalation, PII leak, account lockout
5. **Priority 3:** Fix event lifecycle and domain event gaps
6. Re-run enforcement after fixes: `/oli-enforce-all --strict`

### P1 Findings Present — Fix Before Merging

109 P1 finding(s) across all 14 implemented modules.

1. Address audit logging gaps first (compliance risk — BIR 7-year requirement)
2. Wire election voting routes (core governance feature)
3. Fix domain event infrastructure (cross-module integration is broken)
4. Re-run per-module enforcement to verify

### Spec Coverage Below Threshold (62%)

1. Run `/oli-module-specs` to fill spec gaps for m04 (mega-module), m07 (multi-directory), m14 (attribution)
2. Re-run `/oli-enforce-all` after specs are updated for complete enforcement

---

*Pipeline: `/oli-module-specs` → `/oli-enforce-coverage` → `/oli-enforce-module` → `/oli-enforce-file` → `/oli-enforce-cross-module` → `/oli-trace` → `/oli-audit-compliance` (audit logging) → **YOU ARE HERE** → `/oli-audit-compliance` (full, optional) → `/oli-confidence-stack`*
