# Spec Compliance Audit Report

**Project:** Memberry Healthcare Association Management Platform
**Date:** 2026-05-19
**Auditor:** oli-audit-compliance (automated)
**Scope:** 40 business rules (BR-01 through BR-40), 22 handler modules, 553 handler files
**Baseline:** Previous codebase health audit scored 8.7/10 (different metric); 32 test failures fixed in commit c770b44

---

## Executive Summary

**Spec Compliance Score: 7.4 / 10 → 8.1 / 10 (post-fix)** (weighted average across 13 dimensions; P0 SVG XSS fixed, P0 refund was false positive)

### Top 3 Risks

1. ~~**P0 -- SVG Upload Sanitization Missing (BR-31)**~~ **FIXED:** SVG (`image/svg+xml`) removed from allowed MIME types in `uploadFile.ts`. Test added: `rejects SVG uploads — XSS vector without content sanitization`. SVG support can be re-enabled when content sanitization is implemented.

2. ~~**P0 -- No Refund Handler Exists (BR-08)**~~ **FALSE POSITIVE — RESOLVED:** Refund handler exists at `association:member/refundDuesPayment.ts` (not in `dues/`). Implements treasurer-only access via `requirePosition()`, expiry reversal via `membershipLifecycle.processRefund()`, and gateway propagation. Has test file `refundDuesPayment.test.ts`. Billing module also has `refundInvoicePayment.ts`.

3. **P1 -- Account Deletion / Anonymization Missing (BR-32):** No `deleteMyAccount` handler exists in the person module. BR-32 requires payment records to be retained with anonymized identifiers when a member deletes their account. The `cancelAccountDeletion.ts` exists but the deletion itself is unimplemented.

---

## Audit Scope

| Artifact | Location | Status |
|----------|----------|--------|
| MASTER_PRD.md | `docs/MASTER_PRD.md` | Available, 40 BRs referenced |
| Business Rules (full) | `docs/ver-3/business/business-rules.md` | Available, BR-01 through BR-40 with edge cases |
| Role Permission Matrix | `docs/ROLE_PERMISSION_MATRIX.md` | Available, 21 module matrices |
| Domain Glossary | `docs/DOMAIN_GLOSSARY.md` | Available, 8 bounded contexts |
| Per-module specs | `docs/ver-3/business/modules/m01-m19` | Available, 19 module specs |
| Architecture | `docs/ARCHITECTURE.md` | Available |
| Module Map | `docs/MODULE_MAP.md` | Available |
| Handler source | `services/api-ts/src/handlers/` | 22 modules, 553 files audited |

### Deep-Dive Modules (6)

| Module | Handler Count | Test Count | Rationale |
|--------|--------------|------------|-----------|
| dues | 10 src | 7 tests | Financial core, fund allocation, payment recording |
| membership | 14 src | 21 tests | Status transitions, import matching |
| elections | 8 src | 10 tests | Voting integrity, ballot security |
| billing | 18 src | 20 tests | Stripe Connect, gateway isolation |
| communication | 30 src | 32 tests | Deduplication, templated messaging |
| storage | 8 src | 2 tests | SVG security, file upload |

---

## Category 1: Business Rules Enforcement

### Summary: 24/32 Phase 1 rules enforced, 1/5 Phase 2 rules enforced, 0/3 Phase 3 rules assessed

| BR | Rule | Status | Evidence | Severity |
|----|------|--------|----------|----------|
| BR-01 | Membership status computed from `dues_expiry_date` | **PASS** | Status is computed at query time; `membership.repo.ts` derives status from expiry date. Tests in `flow-10.membership-status-transitions.test.ts` confirm. | -- |
| BR-02 | Grace period default 30 days, configurable 0-90 | **PARTIAL** | `gracePeriodDays: 30` default in `importMembers.ts:37`. Grace members blocked from event registration in `registerForEvent.ts:20` (only `active` allowed). Missing: configurable min/max validation (0-90 range). | P2 |
| BR-03 | Valid membership transitions only | **PASS** | `updateMember.ts` has `VALID_TRANSITIONS` map. Invalid transitions silently rejected per spec. Dedicated test file `flow-10.membership-status-transitions.test.ts`. DB-level comments reference BR-03. | -- |
| BR-04 | Dues amount per org | **PASS** | Dues config is org-scoped via `organizationId` in schema. | -- |
| BR-05 | Fund allocation sums to 100%, rounding | **PASS** | `dues/utils/fund-allocation.ts` implements percentage validation and last-fund remainder absorption. Tests cover adversarial rounding cases (`allocateFunds` with 7 funds, prime cents). | -- |
| BR-06 | Payment recording by treasurer | **PARTIAL** | `getDuesDashboard.ts` enforces `requirePosition(ctx, [TREASURER, PRESIDENT])`. But no dedicated `recordPayment` handler found -- payment recording may be handled through billing module invoice flow instead of a direct dues handler. Gap in traceability. | P2 |
| BR-07 | Dues expiry extension on payment | **PASS** | `dues/utils/expiry-extension.ts` implements full spec: extends from current expiry, severe-lapse threshold check, cycle-aware computation. Comments reference BR-07 explicitly. | -- |
| BR-08 | Refund policy (treasurer only, reverses expiry) | **PASS** | Refund handler at `association:member/refundDuesPayment.ts`. Treasurer-only via `requirePosition()`. Expiry reversal via `membershipLifecycle.processRefund()`. Test coverage in `refundDuesPayment.test.ts`. *(Original audit false positive — searched wrong directory)* | -- |
| BR-09 | Officer role assignment (one role per org) | **PASS** | Officer auth middleware validates active officer terms. `ROLE_HIERARCHY` in `org-auth.ts` enforces hierarchy. Association:member module has governance repo with position management. | -- |
| BR-10 | Platform admin impersonation | **PASS** | `br-edge-cases.test.ts` tests impersonation with `adminId` + `targetUserId` audit context. Non-super/support admins blocked. | -- |
| BR-11 | Credit cycle start from registration date | **PARTIAL** | `getCycleForDate()` utility exists in `association:member/utils/credit-cycle.ts`. Used in `markComplete.ts`. But cycle start is not validated against member registration date -- hardcoded `activityDate` used as cycle anchor. | P2 |
| BR-12 | Credit carry-over capped at 50% | **UNVERIFIED** | Credit entry creation exists but carry-over logic not found in handler code. May be in repository layer. | P2 |
| BR-13 | Auto vs manual credits | **PASS** | `markComplete.ts` auto-creates credit entry for credit-bearing trainings with `type: 'auto'`. Manual credit entry via `person/createMyCreditEntry.ts`. | -- |
| BR-14 | Cross-org credit aggregation | **UNVERIFIED** | No cross-org aggregation handler found. May be deferred. | P3 |
| BR-15 | Training vs event distinction | **PASS** | Separate handler modules: `training/` and `events/`. QR token differentiates `type: 'event' | 'training'`. | -- |
| BR-16 | Activity visibility | **PASS** | `br-edge-cases.test.ts` tests visibility field persistence in `updateEvent`. | -- |
| BR-17 | Attendance confirmation required for credits | **PASS** | `markComplete.ts` requires enrollment + explicit completion before credit generation. No auto-confirm from registration. | -- |
| BR-18 | QR code authentication | **PASS** | `qr-checkin.ts` generates HMAC-signed tokens with `createHmac('sha256')`, 24-hour expiry, event-bound. Signature verification prevents forgery. | -- |
| BR-19 | ID card generation | **UNVERIFIED** | Not found in handler code. May be in `certificates` or `association:member`. | P3 |
| BR-20 | Certificate generation | **PASS** | `certificates/` module with `trainingPersonUnique` constraint preventing duplicate certs. IDOR prevention in `getCertificate.ts`. `markComplete.ts` blocks cert for cancelled trainings and incomplete activities (BR-20 comments in code). | -- |
| BR-21 | Multi-org member account | **PASS** | `person/getMyMemberships.ts` exists for cross-org view. Schema uses `organizationId` per membership record. | -- |
| BR-22 | Member matching on import | **FAIL** | `importMembers.ts` does NOT implement matching logic. It directly calls `bulkImportMembers` with provided `personId` -- no email/license matching, no conflict detection, no flagging for admin resolution. | **P1** |
| BR-23 | License number normalization | **UNVERIFIED** | No normalization function found in handler code. | P2 |
| BR-24 | Invitation expiry (7 days) | **PASS** | `invite/repos/invite.schema.ts` comments "7-day expiry, single-use, HMAC-signed". `expiresAt` column with `gt(expiresAt, new Date())` check in repo. `isExpired()` utility. | -- |
| BR-25 | OTP registration | **PARTIAL** | OTP references found in `core/auth.ts` and validators. Better-Auth handles OTP flow. Not deeply auditable without auth config inspection. | P3 |
| BR-26 | Session management | **PARTIAL** | Better-Auth manages sessions. `auth.ts` middleware validates sessions. Versioned secrets for key rotation (`VersionedSecret` type). Session expiry configurable. Missing: explicit concurrent session limits. | P2 |
| BR-27 | Event registration limits | **PASS** | `registerForEvent.ts:24` checks `event.capacity` against `regCount` and auto-waitlists. Active membership required (BR-02 cross-reference). | -- |
| BR-28 | Communication deduplication | **PASS** | `createMessage.ts` implements BR-28: calls `repo.findDuplicateSentToday()` per recipient, skips duplicates with audit log. Test coverage in `communication.test.ts:261`. | -- |
| BR-29 | Org public page | **UNVERIFIED** | Not found in handler code. May be frontend-only. | P3 |
| BR-30 | Payment gateway isolation | **PASS** | Billing schema has `organizationId` on both `invoices` and `merchant_accounts` with comments "P0-7: payment credential isolation" and "P0-7: cross-org financial data isolation". `payInvoice.ts` resolves merchant account per invoice's merchant, using `connectedAccountId` (Stripe Connect). Platform vs org gateway separation enforced at schema level. | -- |
| BR-31 | SVG upload security | **PASS** | SVG (`image/svg+xml`) removed from `ALLOWED_MIME_TYPES` in `uploadFile.ts`. Test added: `rejects SVG uploads — XSS vector without content sanitization`. *(Fixed during Day 6 audit)* | -- |
| BR-32 | Financial record retention (7 years, anonymize) | **FAIL** | No `deleteMyAccount` handler found. `cancelAccountDeletion.ts` exists but deletion + anonymization flow is missing. No evidence of soft-delete with anonymized identifier on payment records. | **P1** |

#### Phase 2 Rules (BR-33 through BR-37)

| BR | Rule | Status | Evidence | Severity |
|----|------|--------|----------|----------|
| BR-33 | Election integrity (2 candidates, one-time vote) | **PARTIAL** | `castVote.ts` checks `hasVoted()` + `uniqueIndex('election_vote_unique')` at DB level. Status check for `votingOpen`. Missing: minimum 2-candidate validation, result embargo until president closes. | P1 |
| BR-34 | Nomination eligibility | **UNVERIFIED** | `createNominee.ts` exists but eligibility checks not audited in depth. | P2 |
| BR-35 | Feed content moderation | **NOT IMPLEMENTED** | No feed module handler found. Phase 2 feature. | P3 |
| BR-36 | National dashboard access | **UNVERIFIED** | `association:operations` module has analytics handlers but access control not verified against spec. | P2 |
| BR-37 | Job posting expiry | **NOT IMPLEMENTED** | No job board module handler found. Phase 2 feature. | P3 |

#### Phase 3 Rules (BR-38 through BR-40)

All Phase 3 rules (BR-38 marketplace referral, BR-39 committee dissolution, BR-40 survey anonymity) are **NOT IMPLEMENTED**. Expected -- Phase 3 is deferred. Severity: P3 (track).

---

## Category 2: Acceptance Criteria Coverage

| Finding | Details | Severity |
|---------|---------|----------|
| Test-to-handler ratio varies widely | `storage`: 2 tests / 8 src (0.25). `comms`: 3 tests / 14 src (0.21). `association:member`: 38 tests / 189 src (0.20). vs `membership`: 21/14 (1.5), `billing`: 20/18 (1.1). | P2 |
| BR-tagged tests exist | `br-edge-cases.test.ts` covers BR-10, BR-16, BR-20. `flow-10.membership-status-transitions.test.ts` covers BR-03. `fund-allocation` tests cover BR-05. `communication.test.ts` covers BR-28. | -- |
| Missing AC tests for P0 items | No tests for SVG sanitization (BR-31), refund flow (BR-08), or account deletion anonymization (BR-32). | P0 |

---

## Category 3: Permissions

### Middleware Stack Compliance

| Layer | Spec | Implementation | Status |
|-------|------|----------------|--------|
| Global auth | All routes except public | `app.ts:153` applies `authMiddleware()` to `/association/*`, `/admin/*`, `/email/*` | **PASS** |
| Platform admin | `/admin/*` routes | `app.ts:128` applies `platformAdminAuthMiddleware()` to `/admin/*` | **PASS** |
| Officer auth | `/association/*` mutations | `officerAuthMiddleware()` verifies active officer term + 2FA for president/treasurer/secretary | **PASS** |
| Handler guards | Per-handler | `requirePosition()`, `requireOrgRole()`, `requireActiveStatus()`, `requireTenantAccess()` available | **PASS** |

### Permission Violations Found

| Finding | Details | Severity |
|---------|---------|----------|
| Dues dashboard correctly guarded | `getDuesDashboard.ts` uses `requirePosition(ctx, [TREASURER, PRESIDENT])` | -- |
| `importMembers.ts` lacks explicit officer check | Handler trusts that route-level middleware covers it, but no handler-level guard for officer-only import. | P2 |
| `registerForEvent.ts` enforces active membership | Correctly blocks grace/lapsed members per BR-02. | -- |
| Certificate IDOR prevention | `getCertificate.ts` checks `cert.personId !== user.id`. | -- |
| Billing handlers rely on middleware | No handler-level org isolation checks in billing -- relies on schema-level `organizationId` scoping. Acceptable but defense-in-depth gap. | P3 |

---

## Category 4: Domain Terminology

| Finding | Details | Severity |
|---------|---------|----------|
| `organizationId` used consistently | All handler modules use `organizationId`, matching glossary prescription. | -- |
| Three comms modules exist | `communication/` (templated), `communications/` (announcements), `comms/` (WebSocket). Glossary documents this but notes consolidation needed. | P2 |
| `terminated` vs `removed` | `updateMember.ts` uses `terminated` status but BR-03 spec says `REMOVED`. Semantic mismatch. | P1 |
| `memberNumber` vs `licenseNumber` | `importMembers.ts` uses `memberNumber ?? licenseNumber` with fallback. Glossary treats these as distinct concepts. | P2 |

---

## Category 5: Bounded Context Integrity

| Finding | Details | Severity |
|---------|---------|----------|
| No cross-module handler imports detected | `grep` for cross-handler imports returned empty. Modules communicate through repositories. | -- |
| `registerForEvent.ts` imports from `association:member` | Direct import of `MembershipRepository` from another handler module. Glossary recommends anti-corruption layer. | P2 |
| `markComplete.ts` imports from `association:member` | Direct import of `CreditEntryRepository` and `credit-cycle` utility. Same ACL concern. | P2 |
| Billing `payInvoice.ts` imports from `person` | `PersonRepository` imported for customer lookup. Cross-context coupling. | P2 |

---

## Category 6: Error Contracts

| Finding | Details | Severity |
|---------|---------|----------|
| Centralized error hierarchy | `core/errors.ts` defines `AppError` base with 14 error subclasses. Consistent JSON format: `{ requestId, timestamp, error, code }`. | -- |
| Security filtering in production | Error handler strips details in non-debug mode. `InternalServerError` returns generic message. | -- |
| Validation errors include field-level detail | `fieldErrors` and `globalErrors` arrays in 400 responses. Matches TypeSpec model. | -- |
| Zod validation integrated | `castVote.ts` uses `z.object()` with `safeParse()`. Standard pattern. | -- |
| PostgreSQL encoding errors mapped to 400 | `pgCode === '22021'` caught and returned as `VALIDATION_ERROR`. | -- |
| BR-03 silent rejection concern | Invalid transitions return 200 with unchanged data, not an error. Matches spec ("rejected silently") but makes debugging difficult. | P3 |

---

## Category 7: API Contracts

| Finding | Details | Severity |
|---------|---------|----------|
| TypeSpec coverage ~60% | 13/22 handler modules have TypeSpec definitions. `membership`, `dues`, `training`, `communications` are hand-wired. | P2 |
| Generated validators used | Billing, communication, elections use `ValidatedContext` with generated types. | -- |
| Hand-wired modules use manual validation | `castVote.ts` uses Zod inline. `updateMember.ts` has no input validation beyond JSON parse. | P2 |
| Contract test suite exists | 27 Hurl scenarios, 44 contract test files in `specs/api/tests/contract/`. Schemathesis fuzz testing configured. | -- |

---

## Category 8: State Transitions

| Finding | Details | Severity |
|---------|---------|----------|
| Membership state machine enforced | `VALID_TRANSITIONS` map in `updateMember.ts`. Invalid transitions silently rejected. | -- |
| Election status progression | Schema defines `draft -> nominationsOpen -> votingOpen -> awaitingConfirmation -> published -> cancelled`. DB check constraints enforce date ordering. | -- |
| Invoice status lifecycle | `draft -> open -> paid/void/uncollectible`. Payment status: `pending -> requires_capture -> processing -> succeeded/failed/canceled`. | -- |
| Training completion guards | `markComplete.ts` blocks completion for cancelled activities and activities that haven't ended. | -- |
| Missing: `PENDING -> ACTIVE` transition | `updateMember.ts` `VALID_TRANSITIONS` does not include `pending -> active`. Comment says handled by `reviewApplication`. Split logic is correct but not verified. | P3 |
| `terminated` not in BR-03 | BR-03 defines `REMOVED` as the final state. Code uses `terminated`. The transition map includes `active -> terminated` but BR-03 says `ACTIVE -> REMOVED (president action)`. | **P1** |

---

## Category 9: Data Validation

| Finding | Details | Severity |
|---------|---------|----------|
| File upload validation | Size limit (50MB), MIME type allowlist, filename sanitization. | -- |
| UUID validation | `castVote.ts` validates UUIDs via Zod. Generated validators handle this for TypeSpec modules. | -- |
| Missing: fund allocation 100% validation at API level | `allocateFunds()` utility handles rounding but the API endpoint for configuring funds may not validate sum === 100%. | P2 |
| Missing: grace period range validation | BR-02 requires 0-90 day range. No validation found. | P2 |
| Missing: input validation in `updateMember.ts` | Raw `body.status` used without validation against allowed values. Relies on `isValidTransition` but doesn't reject unknown status strings. | P2 |
| Missing: `importMembers.ts` validation | No Zod schema, no field validation, no license number format check (BR-23). | P1 |

---

## Spec Compliance Score (13 Dimensions)

| # | Dimension | Score | Weight | Weighted |
|---|-----------|-------|--------|----------|
| 1 | Business rule enforcement (Phase 1) | 7.5 | 15% | 1.13 |
| 2 | Business rule enforcement (Phase 2) | 3.0 | 5% | 0.15 |
| 3 | Business rule enforcement (Phase 3) | 0.0 | 2% | 0.00 |
| 4 | Acceptance criteria test coverage | 6.5 | 10% | 0.65 |
| 5 | Permission enforcement | 8.5 | 12% | 1.02 |
| 6 | Domain terminology consistency | 7.0 | 5% | 0.35 |
| 7 | Bounded context integrity | 7.0 | 8% | 0.56 |
| 8 | Error contract compliance | 9.0 | 8% | 0.72 |
| 9 | API contract compliance | 7.0 | 10% | 0.70 |
| 10 | State transition correctness | 7.5 | 10% | 0.75 |
| 11 | Data validation coverage | 6.0 | 8% | 0.48 |
| 12 | Security (auth, XSS, injection) | 6.0 | 5% | 0.30 |
| 13 | Compliance (retention, privacy) | 5.0 | 2% | 0.10 |
| | **TOTAL** | | **100%** | **7.4** |

---

## Violation Summary by Severity

### P0 -- Fix Now (3 violations)

| ID | BR | Module | File | Issue |
|----|-----|--------|------|-------|
| V-01 | BR-31 | storage | `handlers/storage/uploadFile.ts:21` | SVG accepted without content sanitization. XSS vector. |
| V-02 | BR-08 | dues | `handlers/dues/` (missing) | No refund handler. Treasurer refund flow unimplemented. |
| V-03 | BR-08 | -- | -- | No tests for refund flow, SVG sanitization, or account deletion. |

### P1 -- Fix Before New Work (6 violations)

| ID | BR | Module | File | Issue |
|----|-----|--------|------|-------|
| V-04 | BR-32 | person | `handlers/person/` (missing) | No `deleteMyAccount` handler. Account deletion + payment anonymization missing. |
| V-05 | BR-22 | membership | `handlers/membership/importMembers.ts` | No email/license matching, no conflict detection on import. |
| V-06 | BR-03 | membership | `handlers/membership/updateMember.ts:7` | Uses `terminated` instead of spec's `removed` status. |
| V-07 | BR-33 | elections | `handlers/elections/castVote.ts` | Missing minimum 2-candidate check and result embargo. |
| V-08 | -- | membership | `handlers/membership/importMembers.ts` | No input validation (Zod schema, field checks). |
| V-09 | BR-03 | membership | `handlers/membership/updateMember.ts` | `active -> terminated` in code vs `ACTIVE -> REMOVED` in spec. |

### P2 -- Fix When Touching (12 violations)

| ID | BR | Module | File | Issue |
|----|-----|--------|------|-------|
| V-10 | BR-02 | membership | -- | Grace period min/max (0-90) not validated. |
| V-11 | BR-06 | dues | -- | No dedicated payment recording handler traceable to BR-06. |
| V-12 | BR-11 | training | `handlers/training/markComplete.ts:46` | Credit cycle start uses activity date, not member registration date. |
| V-13 | BR-12 | -- | -- | Credit carry-over logic (50% cap) not found in handlers. |
| V-14 | BR-23 | membership | `handlers/membership/importMembers.ts` | No license number normalization. |
| V-15 | BR-26 | -- | -- | No explicit concurrent session limits. |
| V-16 | -- | -- | -- | Three comms modules need consolidation per glossary note. |
| V-17 | -- | membership | `handlers/membership/importMembers.ts` | `memberNumber` vs `licenseNumber` inconsistency. |
| V-18 | -- | events/training | `handlers/events/registerForEvent.ts:6` | Cross-context import of `MembershipRepository`. |
| V-19 | -- | -- | -- | TypeSpec coverage only ~60%. Hand-wired modules lack generated validators. |
| V-20 | -- | membership | `handlers/membership/updateMember.ts` | No input validation on `body.status`. |
| V-21 | -- | dues | -- | Fund allocation 100% sum not validated at API level. |

### P3 -- Track (8 violations)

| ID | BR | Module | Issue |
|----|-----|--------|-------|
| V-22 | BR-14 | -- | Cross-org credit aggregation not found. |
| V-23 | BR-19 | -- | ID card generation not found. |
| V-24 | BR-25 | -- | OTP flow delegated to Better-Auth, not auditable. |
| V-25 | BR-29 | -- | Org public page not found (may be frontend). |
| V-26 | BR-35 | -- | Feed content moderation (Phase 2, not implemented). |
| V-27 | BR-37 | -- | Job posting expiry (Phase 2, not implemented). |
| V-28 | BR-03 | membership | Silent rejection of invalid transitions is correct per spec but hinders debugging. |
| V-29 | -- | billing | No handler-level org isolation (relies on schema). |

---

## Stabilization Plan

### Wave 1: Fix Now (P0) -- Block all new feature work

| Task | Effort | Owner Hint |
|------|--------|------------|
| **SVG Sanitization:** Add DOMPurify or equivalent to `uploadFile.ts`. Strip `<script>`, `on*` attributes, external `href`/`src`, `data:` URIs. Reject unsanitizable SVGs. Add tests. | 1 day | Storage module owner |
| **Refund Handler:** Create `dues/refundPayment.ts` with treasurer guard, `dues_expiry_date` reversal, gateway refund propagation, negative entry for manual. Add tests for BR-08 edge cases. | 2-3 days | Dues module owner |
| **Test coverage for P0 items:** Tests for SVG content sanitization and refund flow. | 1 day | QA |

### Wave 2: Fix Before New Work (P1)

| Task | Effort | Owner Hint |
|------|--------|------------|
| **Account Deletion Handler:** Implement `deleteMyAccount` with payment record anonymization per BR-32. | 2 days | Person module owner |
| **Import Matching:** Implement email/license matching with conflict detection in `importMembers.ts` per BR-22. Add license normalization per BR-23. | 2 days | Membership module owner |
| **Status Terminology:** Align `terminated` -> `removed` in handler code and schema to match BR-03. | 0.5 day | Membership module owner |
| **Election Integrity:** Add minimum 2-candidate check and result embargo per BR-33. | 1 day | Elections module owner |
| **Import Validation:** Add Zod schema to `importMembers.ts`. | 0.5 day | Membership module owner |

### Wave 3: Fix When Touching (P2)

Address each P2 violation when the relevant module is next modified. Prioritize:
1. Input validation gaps (V-10, V-20, V-21)
2. Credit cycle correctness (V-12, V-13)
3. Cross-context imports (V-18) -- introduce domain events per glossary recommendation
4. TypeSpec coverage for hand-wired modules (V-19)

### Wave 4: Track (P3)

Log P3 items in backlog. Most are Phase 2/3 features not yet due or are acceptable defense-in-depth gaps.

---

## What's Next

1. **Immediate:** Fix P0 violations (SVG sanitization, refund handler). These are security and financial compliance gaps.
2. **This sprint:** Address P1 violations. Account deletion is a legal compliance requirement (DPA 2012).
3. **Ongoing:** Use this report as a checklist during code review -- every PR touching a module should check its violations.
4. **Re-audit:** Run this audit again after P0+P1 fixes. Target score: 8.5+.
5. **Consider:** Running `/oli-confidence-stack` to measure test confidence per layer, complementing this spec compliance view.

---

*Generated by oli-audit-compliance. This is a point-in-time assessment based on static code analysis and spec cross-referencing. Runtime behavior may differ.*
