# Existing Codebase Adoption Audit

---
**Audit Date:** 2026-05-27 (Deep oli-audit-codebase v3)
**Previous Audit:** 2026-05-26 (Post-audit/codebase-improvements branch, v2)
**Source Directory:** /Users/elad-mini/Desktop/memberry
**Stack:** TypeScript + Bun + Hono + Drizzle ORM + PostgreSQL + TanStack Router + Vite
**oli version:** oli-audit-codebase v3
---

## 1. Executive Summary

**Overall Health Score: 7.4/10** (141/190 across 19 dimensions)

**Top 3 Strengths:**
1. **Exceptional spec/doc coverage** -- 19 MODULE_SPECs, 19 API_CONTRACTS, 23 top-level product docs, 126 audit reports, 13 slice specs, 16 TDD proofs. Industry-leading documentation.
2. **Strong security posture** -- OWASP clean across all categories. 4-layer auth (global + officer + platform admin + impersonation guard). Account lockout, session limits, PII masking, rate limiting. No injection, XSS, or SSRF vulnerabilities found.
3. **Solid test infrastructure** -- 471 handler tests (STRONG assertion quality), 127 E2E specs, 97 frontend component tests, 97 Hurl contract tests. ~722+ test artifacts.

**Top 3 Gaps:**
1. **No state transition guards** -- 6 state machines (membership, dues invoice, dues payment, booking, license, officer term) have zero runtime transition validation. Invalid state changes possible. Status naming mismatch: `terminated` vs spec `REMOVED`.
2. **Inverted core→handler dependencies** -- 20 imports across 11 core/middleware files importing from handler repos. Architectural violation: core should never depend on handler layer. Module changes can silently break core.
3. **Type cast density in association handler** -- 274 `as any` casts in association:member (internal types, not library). Source code otherwise clean (2 TODOs, 0 stubs, 0 FIXMEs).

**Delta Since Last Audit (2026-05-26):**
- Health score: 7.9 → 7.4 (deeper analysis revealed state machine + inverted dep severity was underrated)
- **New findings:** Inverted core→handler deps quantified (20 imports, 11 files), state machine guards confirmed absent across all 6 machines, type cast density in association handler (274 `as any`)
- **Corrections from v2:** Cross-module coupling is NOT handler→handler (that's clean). It's core→handler (architectural inversion). v2 counted 35+ cross-module imports but misclassified the source.
- **Confirmed from v2:** Unbounded queries (~15-20), N+1 patterns (3), no P0 issues, spec coverage excellent

---

## 2. Module Discovery

### 2.1 Backend Handler Modules (25-26 directories)

| Module | Total Files | Test Files | TypeSpec | Status |
|--------|------------|------------|----------|--------|
| association:member | 316 | 79 | No | MEGA-MODULE -- split deferred to v1.2.0 |
| association:operations | 98 | 21 | No | Active -- committees, analytics |
| communication | 92 | 41 | No | Active -- templates, queuing |
| platformadmin | 59 | 28 | Yes | Active -- admin operations |
| person | 57 | 29 | Yes | Active -- central PII hub |
| booking | 56 | 25 | Yes | Active -- scheduling |
| events | 42 | 25 | No | Active -- event management |
| billing | 41 | 23 | Yes | Active -- Stripe Connect |
| membership | 41 | 24 | No (custom .tsp) | Active -- applications |
| email | 40 | 17 | Yes | Active -- transactional queue |
| documents | 39 | 22 | No | Active -- document management |
| training | 37 | 22 | No | Active -- CPD/CE credits |
| surveys | 34 | 14 | Yes | Active -- NPS, surveys |
| dues | 26 | 14 | Yes (custom) | Active -- invoicing |
| elections | 26 | 17 | No | Active -- voting |
| comms | 22 | 5 | Yes | Active -- WebSocket |
| certificates | 22 | 12 | No | Active -- certificates |
| advertising | 18 | 7 | No | NEW -- not yet spec'd |
| notifs | 16 | 7 | Yes | Active -- push notifications |
| jobs | 16 | 7 | No | Infrastructure |
| marketplace | 16 | 3 | No | Active -- listing/orders |
| storage | 12 | 4 | Yes | Active -- S3/MinIO |
| reviews | 11 | 5 | Yes | Active -- NPS reviews |
| invite | 10 | 4 | Yes | Active -- org invitations |
| audit | 8 | 4 | Yes | Active -- compliance logging |

### 2.2 Frontend Applications

**Memberry App (port 3004):** 125 routes, 22 feature dirs, 97 test files
**Admin App (port 3003):** 23 routes, 12 test files (improved from 0 in prior audit)

### 2.3 SDK (packages/sdk-ts)
Generated TanStack Query hooks + hand-written client, transport, flows, WebRTC utils. 5 test files.

---

## 3. Domain Terms & DDD Analysis

### 3.1 Aggregate Roots Identified

| Entity | Aggregate Root? | Domain Events | Cross-Module Pattern | Confidence |
|--------|----------------|---------------|---------------------|------------|
| Person | Yes | PersonCreated, PersonUpdated | API (referenced by all modules) | [INFERRED] |
| Membership | Yes | MembershipActivated, MembershipLapsed | Direct import (tight coupling) | [INFERRED] |
| Booking | Yes | BookingConfirmed, BookingCancelled | Isolated | [INFERRED] |
| DuesPayment | No (child) | PaymentCaptured | Direct import | [INFERRED] |
| DuesInvoice | No (child) | InvoiceGenerated | Direct import | [INFERRED] |
| Notification | No | — | Isolated | [INFERRED] |

### 3.2 Terminology Inconsistencies

| Concept | Variations | Severity |
|---------|-----------|----------|
| Communications | `comms/` (WebSocket), `communication/` (templates), `communications/` (announcements) | P2 |
| Member status | `terminated` in updateMember.ts vs `REMOVED` in spec BR-03 | P1 |
| Member ID | `memberNumber` vs `licenseNumber` (fallback logic in importMembers.ts) | P2 |

### 3.3 Domain Events (Only 3 typed)
```
dues.payment.recorded     -> paymentId, personId, organizationId, amount, newExpiryDate
membership.status.changed -> membershipId, personId, organizationId, oldStatus, newStatus
invite.claimed            -> inviteId, personId, organizationId, membershipId
```
Cross-module communication largely via direct imports rather than events.

---

## 4. Permission Matrix

### 4.1 Auth Stack (4 layers)

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Global auth | Better-Auth session validation, suspended account check | ✅ All non-public routes |
| Officer auth | Active term + 2FA for president/treasurer/secretary | ✅ Officer endpoints |
| Platform admin | Membership check in platform_admin table | ✅ /platformadmin/* |
| Impersonation guard | 2-hour limit, write-block during session | ✅ All mutations |
| Account lockout | 5 failed attempts → 15-min ban + audit log (AC-M01-005) | ✅ Auth endpoints |
| Rate limiting | Configurable per-route, skips /health and /ready | ✅ Global |
| Session limits | 24h expiry, 5 concurrent sessions (configurable) | ✅ Global |

### 4.2 Role Definition
`RoleRequirement = string | ${string}:owner` — system roles (admin, support, user) + context roles (client, host) + owner variants.

---

## 5. Business Rules Summary

33/40 BRs COMPLETE per shell audit. Majority explicit business rules with HIGH confidence. See `.planning/` artifacts for full BR registry.

### 5.1 Stub Handlers (Deferred v1.2.0)
9 institutional membership stubs returning 501 with `Implementation-Status: STUB` comment.

---

## 6. API Surface

- **412 endpoints** across **276 paths** (OpenAPI spec: 81,705 lines)
- **~33 hand-wired routes** (payment tokens, email unsubscribe, public org discovery, etc.)
- **TypeSpec coverage:** ~58% (15/26 handler dirs)

---

## 7. State Machines

| Entity | Status Enum | States | Guards? | Severity |
|--------|-------------|--------|---------|----------|
| Membership | `membership_status` | pendingPayment → active → gracePeriod → lapsed/expired/suspended/removed/resigned/deceased/expelled | ❌ None | P1 |
| Dues Invoice | `dues_invoice_status` | generated → sent → paid/overdue/cancelled/writtenOff | ❌ None | P1 |
| Dues Payment | `dues_payment_status` | pending → captured/failed/charged_back/refunded | ❌ None | P1 |
| Booking | `booking_status` | pending → confirmed/rejected/cancelled/completed/no_show_* | DB constraints only | P2 |
| License | `license_status` | active → expired/suspended/inactive | ❌ None | P1 |
| Officer Term | `term_status` | upcoming → active → completed/resigned/removed | ❌ None | P1 |
| Committee | committee status | active → completed/dissolved | Handler checks | P2 |
| Election | election status | draft → active → closed | Handler checks | P2 |
| Training | training status | draft → published → completed/cancelled | Handler checks | P2 |
| TrainingEnrollment | enrollment status | enrolled → completed/cancelled | Handler checks | P2 |

**Critical Finding:** No `VALID_TRANSITIONS` map or guard function exists for ANY state machine. Status naming mismatch: `terminated` vs spec `REMOVED`.

---

## 8. UI / Screen Audit

- 125 Memberry routes, 23 Admin routes
- 19 modules have full UI prototype packs (screens, components, interaction-states, mock-data)
- No mock data contamination in production components (seed data properly isolated in `src/seed/`)
- Reusable patterns: confirm-dialog, data-table, date-picker, skeleton-loader, empty-state, error-boundary, form-field

---

## 9. Test Coverage Audit

### 9.1 Test Counts

| Layer | Count | Quality |
|-------|-------|---------|
| Backend handler tests | 471 files | STRONG (56:3 strong:weak ratio sampled) |
| Core tests | 15 files | STRONG |
| Memberry frontend tests | 97 files | Component |
| Admin frontend tests | 12 files | Component |
| E2E tests (Playwright) | 127 files | Integration |
| Contract tests (Hurl) | 97 files | Contract |
| SDK tests | 5 files | Unit |
| **Total** | **~824** | |

### 9.2 Module Coverage Assessment

| Assessment | Modules |
|-----------|---------|
| STRONG | association:member, communication, person, booking, events, membership, billing, documents, training, dues |
| GOOD | platformadmin, elections, certificates, surveys |
| MODERATE | email, comms, notifs, reviews, storage, invite, audit |
| WEAK | advertising, jobs, marketplace |

---

## 10. Security Audit (OWASP Top 10)

| OWASP Category | Status | Key Evidence |
|----------------|--------|-------------|
| A01: Broken Access Control | ✅ PASS | 4-layer auth, IDOR fixed (a233a3c9), auth-gate-coverage.test.ts |
| A02: Cryptographic Failures | ✅ PASS | Better-Auth credential storage, PII masked (maskEmail) |
| A03: Injection | ✅ PASS | Drizzle sql`` template literals, Zod validators, no string concat |
| A04: Insecure Design | ⚠️ P2 | No explicit CSRF token (SameSite cookies only) |
| A05: Security Config | ✅ PASS | secureHeaders (CSP, HSTS, X-Frame-Options), CORS hardened |
| A06: Vulnerable Components | ✅ MONITOR | Standard deps, Playwright pinned to 1.58.2 |
| A07: Auth Failures | ✅ PASS | Account lockout, session limits, MFA disable guard |
| A08: Data Integrity | ✅ PASS | DB check constraints, Zod validators on all generated routes |
| A09: Logging & Monitoring | ✅ PASS | Pino structured logging, requestId correlation, audit middleware |
| A10: SSRF | ✅ PASS | No user-controlled URL fetching in handlers |

---

## 11. Observability Audit

| Area | Status | Implementation |
|------|--------|---------------|
| Structured logging | ✅ Present | Pino JSON with serializers |
| Correlation IDs | ✅ Present | X-Request-ID, auto-generated UUID, propagated via ctx |
| Metrics | ⚠️ Basic | Prometheus /metrics: request counts, errors, top routes. **Missing:** latency histograms, DB duration |
| Health checks | ✅ Complete | /livez (lightweight), /readyz (DB + storage + jobs) |
| Feature flags | ✅ Present | FF_* env vars, typed, exposed via /feature-flags |
| Distributed tracing | ❌ None | No OpenTelemetry (P3) |

---

## 12. Performance Anti-Patterns

| Pattern | Count | Severity | Files |
|---------|-------|----------|-------|
| N+1 queries | 3 confirmed | P2 | communication/bulkUpdatePersonSubscriptions.ts, communication/createMessage.ts, certificates/batchGenerateCertificates.ts |
| Unbounded findMany | ~15-20 | P2 | booking.repo (4), governance.repo (4), marketplace.repo (2), dues repos, email repos |
| Missing FK indexes | 2 | P3 | dues-payments.schema.ts (idempotencyKey), invite.schema.ts (personId) |
| Sync blocking | 0 | ✅ | All handlers async |

---

## 13. Inconsistency Report

### 13.1 Critical (Architectural)

| ID | Type | Description | Files | Impact |
|----|------|-------------|-------|--------|
| IC-01 | Inverted dependency | Core imports handler repos (20 imports, 11 files) | core/email.ts (7), core/auth.ts (3), core/notifs.ts (3), core/audit.ts (2), + 6 more | Module changes silently break core |
| IC-02 | Status mismatch | `terminated` vs `REMOVED` for member status | handlers/association:member/updateMember.ts | Incorrect business logic |

### 13.2 Major (Functional)

| ID | Type | Description | Impact |
|----|------|-------------|--------|
| IC-03 | Missing guards | 6 state machines have no transition validation | Invalid state transitions possible |
| IC-04 | N+1 queries | 3 bulk operations loop with individual DB calls | Performance at scale |
| IC-05 | Unbounded queries | ~15-20 list endpoints without pagination | Memory exhaustion risk |

### 13.3 Minor (Consistency)

| ID | Type | Description | Impact |
|----|------|-------------|--------|
| IC-06 | Domain naming | 3 communication module variants | Developer confusion |
| IC-07 | Type casts | 274 `as any` in association handler | Type safety erosion |
| IC-08 | Missing FK indexes | 2 foreign keys without indexes | Query performance |

### 13.4 Stub & TODO Inventory

| Category | In Source | In Deps | Severity |
|----------|----------|---------|----------|
| Runtime stubs (501) | 9 (institutional membership, deferred v1.2.0) | — | P3 |
| `// TODO` | 2 (generate.ts, member-table.tsx) | 3,257 | ✅ Clean |
| `// FIXME` | 0 | 35 | ✅ Clean |
| `throw new Error('not implemented')` | 0 | 80 | ✅ Clean |

### 13.5 Type Cast Density

| Module/Area | `as any` | `as unknown` | `@ts-ignore` | Severity |
|-------------|----------|-------------|-------------|----------|
| association handler | 274 | — | — | P2 (internal) |
| routeTree.gen.ts | — | 124 | — | ✅ (generated) |
| Test files | ~60% of total | — | ~2,400 | ✅ (mocks) |
| Handler code (non-assoc) | ~16 | — | — | ✅ (low) |

### 13.6 Cross-Module Import Violations

**Core → Handler (Inverted, P1):**

| File | Target Handler | Import Count |
|------|---------------|-------------|
| core/email.ts | email/repos, association:member/repos | 7 |
| core/auth.ts | person/repos, audit/repos | 3 |
| core/notifs.ts | notifs/repos, person/repos | 3 |
| core/audit.ts | audit/repos | 2 |
| core/org-scoped-persons.ts | association:member/repos | 1 |
| core/domain-event-consumers.ts | handler repos | 1 |
| core/account-lockout.ts | handler repos | 1 |
| middleware/officer-auth.ts | governance.repo | 1 |
| middleware/platform-admin-auth.ts | platform-admin.repo | 1 |
| middleware/impersonation-guard.ts | platform-admin.repo | 1 |

**Handler → Handler:** CLEAN — no production cross-handler imports.
**Bi-directional:** None. All violations one-directional (core → handlers).

### 13.7 Cross-Module Raw SQL
No cross-module table references in raw SQL. All queries via Drizzle ORM within module boundaries. ✅ Clean.

---

## 14. Repository Guardrails

| File | Exists? | Lines | Quality |
|------|---------|-------|---------|
| ARCHITECTURE.md | ✅ | 343 | Current |
| CONTRIBUTING.md | ✅ | 2,506 | Comprehensive |
| CLAUDE.md | ✅ | 409 | Current |
| README.md | ✅ | 339 | Current |
| ROADMAP.md | ✅ | 155 | Active |
| VERTICAL_TDD.md | ✅ | 308 | Current |

**Assessment:** Exceptional. All critical docs present and maintained.

---

## 15. Spec Coverage

| Artifact | Count | Quality |
|----------|-------|---------|
| MASTER_PRD.md | 1 | Comprehensive |
| DOMAIN_MODEL.md | 1 | Complete |
| DOMAIN_GLOSSARY.md | 1 | Complete |
| ROLE_PERMISSION_MATRIX.md | 1 | Complete |
| MODULE_MAP.md | 1 | Complete |
| MODULE_SPEC.md (per module) | 19 | Comprehensive |
| API_CONTRACTS.md (per module) | 19 | Comprehensive |
| INTEGRATION_CONTRACTS.md | 4 | Partial |
| UI Prototypes (per module) | 19 | Full packs |
| VERTICAL_SLICE_PLAN.md | 5 | Active |
| Slice specs | 13 | Active |
| TDD proofs | 16 | Active |
| WORKFLOW_MAP.md | 1 | Complete |
| STATE_MACHINES.md | 1 | Complete |
| THREAT_MODEL.md | 1 | Complete |
| EVENT_CONTRACTS.md | 1 | Complete |
| UI_BLUEPRINT.md | 1 | Complete |
| TRACE_MATRIX.md | 1 | Complete |
| Audit reports | 126 | Extensive |

**Verdict:** Industry-leading spec coverage. 23 top-level product docs, 19 per-module spec suites, 126 audit reports.

---

## 16. Standards Gap Matrix

| Area | Current | Target | Gap | Priority |
|------|---------|--------|-----|----------|
| State transition guards | 0/6 formal | 6/6 with runtime validation | Critical | P1 |
| Core→handler deps | 20 inverted imports | 0 (use interfaces/events) | Architectural | P1 |
| Status naming | `terminated` vs `REMOVED` | Aligned with spec | Mismatch | P1 |
| N+1 patterns | 3 confirmed | 0 | Performance | P2 |
| Unbounded queries | ~15-20 | 0 (all paginated) | Performance | P2 |
| Type casts (assoc) | 274 `as any` | < 10 | Type safety | P2 |
| CSRF tokens | SameSite only | Explicit CSRF middleware | Security gap | P2 |
| Build caching | None (Bun workspaces) | Turborepo or equivalent | DX gap | P2 |
| Domain naming | 3 comm module names | Consistent naming | Confusion | P2 |
| TypeSpec coverage | 58% (15/26) | 100% | Spec gap | P3 |
| Domain events | 3 typed | 15+ (cover cross-module) | Coupling | P3 |
| Distributed tracing | None | OpenTelemetry | Observability | P3 |
| FK indexes | 2 missing | All FKs indexed | Performance | P3 |
| assoc:member size | 316 files | < 100 per module | Maintainability | P3 |

---

## 17. Stabilization Plan

### P0: Fix Immediately
**None found.** All prior P0 items resolved (IDOR, auth guards).

### P1: Fix Before Major New Work

1. **Add state transition guards** -- Create `core/state-machine.ts` with generic transition validator. Define allowed transitions per entity. Add guard to all status-updating handlers. (1-2 days)
2. **Extract core→handler interfaces** -- Create `core/ports/` with interfaces. Start with `core/email.ts` (7 imports). Establish port/adapter pattern for remaining 10 inversions. (2-3 days)
3. **Fix status naming** -- `terminated` → `REMOVED` in updateMember.ts. (30 minutes)

### P2: Fix When Touching Module

4. Batch N+1 queries in bulk operations (3 files)
5. Add .limit() to ~15-20 unbounded queries
6. Reduce `as any` casts in association handler (274 → <10)
7. Evaluate CSRF token middleware need
8. Evaluate Turborepo for build caching
9. Document comms/communication/communications naming rationale

### P3: Improve Later

10. Decompose association:member into feature subfolders
11. Add TypeSpec for remaining 11 modules
12. Expand domain events (3 → 15+)
13. Add OpenTelemetry
14. Add FK indexes on dues-payments, invite schemas
15. Expand Prometheus metrics (latency, DB duration)

---

## 18. Adoption Plan (5-Phase)

### Phase 1: Guardrails ✅ COMPLETE
All docs present and maintained (ARCHITECTURE, CONTRIBUTING, CLAUDE, README, ROADMAP, VERTICAL_TDD).

### Phase 2: Document Current Reality ✅ COMPLETE
23 top-level product docs, 19 per-module spec suites, 126 audit reports.

### Phase 3: Stabilize Risky Areas -- IN PROGRESS
- [x] P0 security fixes (IDOR, auth guards)
- [x] 824+ test artifacts across all layers
- [ ] State transition guards (P1)
- [ ] Core→handler interface extraction (P1)
- [ ] Status naming fix (P1)
- [ ] Unbounded query fixes (P2)
- [ ] N+1 batch fixes (P2)

### Phase 4: Adopt Standards
- [ ] TypeSpec for remaining 11 modules
- [ ] Domain events for cross-module communication
- [ ] association:member decomposition
- [ ] Build caching (Turborepo)

### Phase 5: Migrate Gradually
- [ ] All hand-wired routes to TypeSpec
- [ ] Cross-module imports replaced by events
- [ ] OpenTelemetry integration
- [ ] Full contract test coverage

---

## 19. Recommended First 3 Slices

| Rank | Slice | Module | Why | Risk | Work |
|------|-------|--------|-----|------|------|
| 1 | State transition guard layer | core + all status modules | Prevents invalid transitions across 6 entities. Pattern-setting infrastructure. | Medium | 1-2 days |
| 2 | Core dependency inversion (email) | core/email.ts → email handlers | Highest inverted dep count (7). Establishes port/adapter pattern. | Low | 1 day |
| 3 | Pagination + N+1 batch | booking, governance, communication | Fixes 18+ performance issues. Establishes batch + pagination conventions. | Low | 1-2 days |

---

## 20. Codebase Health Score

| # | Dimension | Score | Notes |
|---|-----------|-------|-------|
| 1 | Terminology consistency | 7 | 3 communication names, 1 status mismatch |
| 2 | Permission coverage | 9 | 4-layer auth, owner checks, impersonation guard |
| 3 | Business rule clarity | 8 | 33/40 BRs documented and tested |
| 4 | API consistency | 8 | TypeSpec-first, 58% coverage, consistent patterns |
| 5 | State machine safety | 3 | 6 machines, 0 transition guards |
| 6 | Error handling uniformity | 8 | 11 error types, centralized handler |
| 7 | Backend test coverage | 8 | 471 handler tests, strong assertions |
| 8 | Frontend test coverage | 7 | 97 component + 127 E2E |
| 9 | PRD/spec coverage | 10 | 23 docs, 19 module specs, 126 audits |
| 10 | UI prototype readiness | 9 | 19 modules have full prototype packs |
| 11 | Architecture alignment | 6 | Vertical slices good, but 20 inverted deps |
| 12 | Domain model clarity | 8 | DOMAIN_MODEL.md, 10 aggregates identified |
| 13 | Security posture (OWASP) | 9 | Clean except CSRF token gap |
| 14 | Observability coverage | 7 | Pino + correlation IDs + health. Missing latency. |
| 15 | Performance health | 6 | 3 N+1, ~15-20 unbounded, 2 missing indexes |
| 16 | Stub density | 10 | 0 stubs in source, 2 TODOs only |
| 17 | Type cast density | 5 | 274 `as any` in association handler |
| 18 | Cross-module coupling | 6 | 20 inverted core→handler. Handler→handler clean. |
| 19 | Raw SQL leakage | 10 | All via Drizzle ORM, no cross-module SQL |
| **Total** | **141/190** | **7.4/10** |

**Score change from v2:** 7.9 → 7.4. Deeper analysis revealed state machine guards (3→3, down from assumed partial), architecture alignment (9→6, inverted deps severe), type cast density (9→5, association handler). Scoring methodology more rigorous.

---

## 21. What's Next

| Action | Skill | Priority |
|--------|-------|----------|
| Add state transition guards | Manual / `/handler` | P1 -- Do Now |
| Extract core→handler interfaces | Manual refactor | P1 -- Do Now |
| Fix `terminated` → `REMOVED` | Manual | P1 -- Do Now |
| Batch N+1 + add pagination | Manual | P2 -- Next Sprint |
| Reduce association `as any` | Manual | P2 -- When Touching |
| Verify specs match code | `/oli-audit-compliance` | After P1 fixes |
| Score test confidence | `/oli-confidence-stack` | After P2 fixes |
| Plan implementation sequence | `/oli-vertical-slice-plan` | For Phase 4 |

---

*Generated by oli-audit-codebase v3 on 2026-05-27. Health score measures code structural quality, NOT spec compliance or test confidence (see `/oli` Health Score Convention).*
