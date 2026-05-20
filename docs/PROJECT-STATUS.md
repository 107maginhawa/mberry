# Memberry — Project Status Reference

**Last updated:** 2026-05-20
**Milestones shipped:** v1.0.0 through v1.4.0 (37 phases)

---

## What's Built (Shipped)

### v1.0.0 Foundation (Phases 0-10) — shipped 2026-05-07
Core platform: billing schema, audit, data models, TypeSpec/OpenAPI, CI/CD, shared components, frontend tests, deploy config.

### v1.1.0 Auth & Permission (Phases 11-17) — shipped 2026-05-13
4-layer auth stack, position-based RBAC (Treasurer/President/Secretary), cross-org isolation, mobile viewport, domain design remediation (BR-33/34, refund, election integrity).

### v1.2.0 Pilot Launch (Phases 18-25) — shipped 2026-05-14
Dues security fix, account deletion (DPA compliance), offline payment flow, officer daily ops (roster/bulk approve), PRC CPD compliance, member departure/deceased, email guards (rate limit, bounce suppression, unsubscribe).

### v1.3.0 Test Confidence (Phases 26-33) — shipped 2026-05-15
CI gates, handler test depth, BR edge cases, 46/46 frontend component tests, E2E behavioral upgrade, flow registry 60%, ratcheted coverage thresholds.

### v1.4.0 Brownfield Rescue (Phases 34-37) — shipped 2026-05-20
Zod validation on updateMember, gracePeriodDays max 90, election test gaps, credit cycle date fix, cross-context decoupling, comms consolidation doc, session limits.

---

## Module Status Matrix

| # | Module | Backend | Frontend | Status |
|---|--------|---------|----------|--------|
| M01 | Auth & Onboarding | 25 handlers | 16 routes (account) | **SHIPPED** |
| M02 | Member Profile | shared w/ person | shared w/ account | **SHIPPED** |
| M03 | Platform Admin | 21 handlers | 11 routes (admin) | **SHIPPED** |
| M04 | Org Admin | 157 handlers | shared w/ memberry | **SHIPPED** |
| M05 | Membership | 12+ handlers | memberry routes | **SHIPPED** |
| M06 | Dues & Payments | 15+16 handlers | memberry routes | **SHIPPED** |
| M07 | Communications | 28+11+9+5 handlers | memberry routes | **SHIPPED** |
| M08 | Events | 11+19 handlers | memberry routes | **SHIPPED** |
| M09 | Training | 13 handlers | memberry routes | **SHIPPED** |
| M10 | Credit Tracking | shared w/ training | memberry routes | **SHIPPED** |
| M11 | Documents & Credentials | 15+3+6 handlers | memberry routes | **SHIPPED** |
| M12 | Elections & Governance | 8 handlers | memberry routes | **SHIPPED** |
| M13 | Professional Feed | -- | -- | **NOT STARTED** |
| M14 | National Dashboard | 54 handlers | memberry routes | **SHIPPED** |
| M15 | Job Board | 5 handler stubs | -- | **STUBS ONLY** |
| M16 | Advertising | 5 handler stubs | -- | **STUBS ONLY** |
| M17 | Marketplace | 7 handler stubs | -- | **STUBS ONLY** |
| M18 | Surveys & Polls | -- | -- | **NOT STARTED** |
| M19 | Committee Management | -- | -- | **NOT STARTED** |

---

## What's Remaining

### Phase 2 Modules (have specs, need full implementation)

| Module | What | Backend Status | Effort |
|--------|------|----------------|--------|
| **M13 Professional Feed** | Member activity feed with content moderation (BR-35) | No handlers | Large |
| **M15 Job Board** | Job postings with expiry (BR-37) | 5 stubs, no routes wired | Medium |
| **M16 Advertising** | PII-free ad campaigns with creative approval | 5 stubs, no routes wired | Medium |
| **M17 Marketplace** | Vendor management with referral disclosure (BR-38) | 7 stubs, no routes wired | Medium |
| **M18 Surveys & Polls** | Anonymous surveys (BR-40) | No handlers | Medium |
| **M19 Committee Management** | Committee lifecycle with dissolution (BR-39) | No handlers | Medium |

### Phase 2 Features for Existing Modules

| Feature | Module | BR | What's Missing |
|---------|--------|----|----------------|
| Cross-org credit aggregation | M10/M14 | BR-14 | National-level credit rollup across chapters |
| ID card generation | M05 | BR-19 | Digital member ID with QR code |
| Org public page | M05 | BR-29 | Public-facing org profile page |

### Infrastructure / Quality Items (non-blocking)

| Item | Priority | Notes |
|------|----------|-------|
| Metrics endpoint (Prometheus/StatsD) | P3 | No `/metrics` — rate limiter headers only |
| Distributed tracing (traceparent) | P3 | Request IDs exist but no trace propagation |
| 20 unbounded queries | P3 | Need `.limit()` on list endpoints |
| Persistent rate limiter | P3 | In-memory only — won't work multi-instance |
| 90 deferred tests (todo/skip/fixme) | P3 | Most are Phase 2/3 feature stubs |
| association:member mega-module split | P3 | 157 handlers — split plan at `.planning/phases/14-mega-module-split/SPLIT-PLAN.md` |

### P3 Compliance Items (accepted/deferred)

| ID | Item | Disposition |
|----|------|-------------|
| V-24 | OTP flow in Better-Auth | ACCEPTED — not auditable |
| V-28 | Silent invalid transition rejection | ACCEPTED — correct per spec |
| V-29 | Billing handler-level org isolation | ACCEPTED — schema-level sufficient |

---

## Scores

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Codebase Health | 8.7/10 | -- | Good |
| Spec Compliance | 7.4/10 (8.1 post-fix) | >= 7.0 | MET |
| Test Confidence | 8.4/10 | >= 6.0 | MET |
| P0 Violations | 0 | 0 | MET |
| **Graduation** | **GRADUATED** | | |

---

## Stats

| Metric | Count |
|--------|-------|
| Handler modules | 22 |
| Handler files | 553+ |
| Backend test files | 336+ |
| E2E test files | 132+ |
| Total assertions | 4,296+ |
| OpenAPI endpoints | 360 |
| Frontend routes | 93 (memberry 66, admin 11, account 16) |
| Business rules | 40 (33 COMPLETE, 1 PARTIAL, 6 DEFERRED) |
| Database tables | 80+ |
| Milestones shipped | 5 |
| Phases completed | 37 |

---

*Generated by `/oli-magic`. Source: ROADMAP.md, BROWNFIELD_STATUS.md, EXISTING_CODEBASE_ADOPTION_AUDIT.md*
