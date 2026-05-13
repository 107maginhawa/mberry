# Memberry -- Master Product Requirements Document

**Product:** Memberry -- Healthcare Association Management Platform
**Version:** 3.0 (compiled)
**Last Updated:** 2026-05-13
**Status:** v1.0.0 shipped, v1.1.0 shipped, v1.2.0 planning

---

## 1. Executive Summary

Memberry is a vertical SaaS platform for managing healthcare professional associations. It replaces the spreadsheet-and-GC-based workflows that volunteer-run chapters use to track membership, collect dues, organize events, manage continuing education credits, and communicate with members.

The initial market is Philippine dental and medical associations (estimated 2,800+ chapters, 250,000+ licensed professionals). The platform starts as an Association Management System (Phase 1), expands into a Professional Identity Platform (Phase 2), and evolves into a Health Services Marketplace (Phase 3).

Built on the Monobase monorepo template: Bun runtime, PostgreSQL + Drizzle ORM, Hono API, TypeSpec-first API design, TanStack Router frontend, Better-Auth authentication.

**Three-app architecture:**
- `apps/account` -- Cloud account (auth, profile, settings)
- `apps/memberry` -- Product app (membership, dues, events, training)
- `apps/admin` -- Platform operations dashboard

---

## 2. Vision and Scope

### Strategic Phases

| Phase | Identity | Timeline | Focus |
|-------|----------|----------|-------|
| 1 | Association Management System | Months 1-12 | Membership, dues, events, training, credits for individual chapters |
| 2 | Professional Identity Platform | Months 6-18 | Verified professional profiles, cross-org networking, elections, national dashboards |
| 3 | Health Services Marketplace | Months 12-24 | EMR integrations, supply procurement, insurance, telehealth distribution |

### Network Effect

Each association onboarded adds members to the verified professional network. Phase 2 unlocks cross-org value (job board, professional feed, national analytics). Phase 3 monetizes the network as a distribution channel for health products and services.

### What Memberry Is NOT For

- National associations with full-time staff and enterprise AMS (Aptify, iMIS)
- Associations with fewer than 10 members
- Associations that meet only once per year
- Organizations managing clinical/patient data (no EHR scope)
- Multi-language UI beyond English and Filipino in Phase 1

---

## 3. User Roles and Personas

| ID | Role | Description | Flow Count |
|----|------|-------------|------------|
| P1 | Platform Administrator | Manages the SaaS platform itself -- onboarding associations, subscriptions, feature flags, support | 22 |
| P2 | Chapter President | Elected leader of a chapter -- approves members, assigns officers, manages org settings | 14 |
| P3 | Chapter Treasurer | Financial officer -- records payments, manages dues config, generates financial reports | 11 |
| P4 | Chapter Secretary | Administrative officer -- manages roster, events, communications, meeting agendas | 13 |
| P5 | Society Officer | Manages society-level training programs and cross-chapter credit tracking | 14 |
| P6 | Member (Healthcare Professional) | End user -- pays dues, registers for events/training, tracks credits, downloads credentials | 27 |

**Total user flows:** 107 (excluding 6 business-rule-specific flows)

### Key Persona Insights

- **P6 (Member)** has the most flows (27) and is the primary retention driver. Core loop: pay dues, attend training, earn credits, download ID card.
- **P2/P3/P4** are volunteers who manage chapters between patient appointments. Every extra click is friction.
- **P1** operates across all associations -- needs impersonation (read-only), health scoring, and subscription management.
- **P5** bridges chapters and societies -- manages training that awards credits across organizational boundaries.

---

## 4. Module Requirements Matrix

### Phase 1: Core AMS (11 Modules)

| # | Module | Priority | Monetization | Wave | Key Capabilities | Dependencies |
|---|--------|----------|-------------|------|------------------|--------------|
| M01 | Auth and Onboarding | P0 | Free | 1 | Registration, login, OTP, invitation claim, account setup | None |
| M02 | Member Profile and Settings | P0 | Free | 1 | Profile edit, privacy controls, license number, multi-org | M01 |
| M03 | Platform Administration | P0 | Internal | 1 | Org provisioning, subscriptions, feature flags, impersonation | M01 |
| M04 | Organization Admin | P0 | Standard | 1 | Org dashboard, officer management, public page, referrals | M01, M03 |
| M05 | Membership | P0 | Standard | 1 | Applications, approvals, roster, status computation, transfers | M01, M04 |
| M06 | Dues and Payments | P0 | Standard | 1 | Dues config, payment recording, fund allocation, reminders | M01, M04, M05 |
| M07 | Communications | P0 | Standard | 2 | Announcements, templates, email queue, push notifications | M01, M04, M05 |
| M08 | Events | P1 | Premium | 2 | Event CRUD, registration, attendance, QR check-in | M05, M06, M07 |
| M09 | Training | P0 | Premium | 2 | Course management, enrollment, completion, auto-credit award | M05, M06, M07, M10 |
| M10 | Credit Tracking | P0 | Premium | 3 | Credit cycles, auto/manual entries, cross-org aggregation | M05, M09 |
| M11 | Documents and Credentials | P1 | Premium | 3 | ID cards, certificates, receipts (PDF generation) | M05, M09, M10 |

### Phase 2: Professional Identity (5 Modules)

| # | Module | Monetization | Key Capabilities | Dependencies |
|---|--------|-------------|------------------|--------------|
| M12 | Elections and Governance | Add-on | Nominations, voting, ballot integrity, results | M04, M05, M07 |
| M13 | Professional Feed | Add-on | Content posting, moderation, discovery | M01, M02, M05 |
| M14 | National Dashboard | Add-on | Cross-chapter analytics, rollups, benchmarking | M04, M05, M06, M10 |
| M15 | Job Board | Add-on | Job postings, applications, expiry | M01, M02, M05 |
| M16 | Advertising | Add-on | Sponsored content, targeting | M03, M07 |

### Phase 3: Marketplace (3 Modules)

| # | Module | Monetization | Key Capabilities | Dependencies |
|---|--------|-------------|------------------|--------------|
| M17 | Marketplace | Add-on | EMR, supply procurement, insurance integrations | M01, M02, M05 |
| M18 | Surveys and Polls | Add-on | Member feedback, data collection, anonymity controls | M04, M05, M07 |
| M19 | Committee Management | Add-on | Committee CRUD, membership, dissolution rules | M04, M05 |

### Monetization Tiers

| Tier | Modules Included | Target |
|------|-----------------|--------|
| Free | M01-M02 | Individual professionals, trial |
| Standard | M01-M07 | Small chapters getting started |
| Premium | M01-M11 | Active chapters with full needs |
| Add-on | M12-M19 | A la carte per association |

### Implementation Status (API Handlers)

The API service has 22 handler directories under `services/api-ts/src/handlers/`. TypeSpec coverage is approximately 60%. The following platform modules are implemented:

| Handler Directory | TypeSpec | Notes |
|-------------------|----------|-------|
| person | Yes | Central PII hub (25 handlers) |
| association:member | Yes | Mega-module: membership, chapters, officers (157 handlers) |
| association:operations | Yes | Analytics, cross-chapter rollups (54 handlers) |
| platformadmin | Yes | Admin-tier operations (21 handlers) |
| membership | No | Applications, approvals (12 handlers, hand-wired) |
| dues | No | Invoicing, payments (15 handlers, hand-wired) |
| invite | Yes | Org invitations (3 handlers) |
| billing | Yes | Stripe Connect (16 handlers) |
| booking | Yes | Scheduling (19 handlers) |
| events | Yes | Event management (11 handlers) |
| training | No | CPD/CE credit tracking (10 handlers, hand-wired) |
| elections | Yes | Voting, nominations (6 handlers) |
| communication | Yes | Templates, queuing (28 handlers) |
| communications | No | Announcements (8 handlers, hand-wired) |
| comms | Yes | WebSocket: video, chat (11 handlers) |
| documents | Yes | Document management (15 handlers) |
| certificates | Yes | Certificate generation (3 handlers) |
| storage | Yes | File upload/download (6 handlers) |
| reviews | Yes | NPS review system (4 handlers) |
| audit | Yes | Compliance logging (1 handler) |
| email | Yes | Transactional email (9 handlers) |
| notifs | Mixed | Multi-channel notifications (5 handlers) |

---

## 5. Business Rules Summary

The platform has **40 normative business rules** documented in `docs/ver-3/business/business-rules.md`. This document is authoritative -- when a rule conflicts with a story or spec, the business rules document takes precedence.

### Rules by Phase

| Phase | Rule Range | Count | Coverage |
|-------|-----------|-------|----------|
| 1 | BR-01 through BR-32 | 32 | Core membership, dues, credits, security, compliance |
| 2 | BR-33 through BR-37 | 5 | Elections, feeds, national dashboard, job board |
| 3 | BR-38 through BR-40 | 3 | Marketplace, committees, surveys |

### Critical Phase 1 Rules

- **BR-01:** Membership status computed from `dues_expiry_date` (ACTIVE / GRACE / LAPSED / SUSPENDED)
- **BR-03:** Only valid membership transitions enforced (no LAPSED to ACTIVE without payment)
- **BR-05:** Every payment split into configurable fund allocations (chapter, national, special)
- **BR-07:** Payment extends `dues_expiry_date` based on billing cycle
- **BR-08:** Refunds only for payments within 30 days, not yet allocated
- **BR-11:** Credit cycles start on configurable date per org (not calendar year)
- **BR-18:** QR code check-in requires authenticated scanner + valid event
- **BR-22:** Member matching on import uses license number as primary key, email as fallback
- **BR-30:** Payment gateway credentials isolated per org (no cross-org leakage)
- **BR-32:** Financial records retained 7 years per Philippine BIR requirements

Full rule definitions with edge cases: `docs/ver-3/business/business-rules.md`

---

## 6. Rollout Phases

### Development Milestones (Completed)

| Milestone | Phases | Shipped | Key Deliverables |
|-----------|--------|---------|-----------------|
| v1.0.0 Foundation | 0-10 | 2026-05-07 | Test infrastructure, billing schema, audit module, data model unification, TypeSpec reconciliation, app hardening, CI/CD, component library, frontend tests, deploy decision |
| v1.1.0 Auth and Permissions | 11-17 | 2026-05-13 | Seed users, route protection, position-based RBAC, role boundary E2E tests, dues reminders, mobile viewport tests, domain design remediation (Codex-verified) |

### Product Rollout Plan

| Wave | Modules | Milestone | Description |
|------|---------|-----------|-------------|
| Phase 1, Wave 1 | M01-M06 | Pilot launch | Core platform + org management + membership + dues |
| Phase 1, Wave 2 | M07-M09 | During pilot | Communications + events + training |
| Phase 1, Wave 3 | M10-M11 | During pilot | Credit tracking + documents/credentials |
| Phase 2 | M12-M16 | Post-pilot | Elections, feed, national dashboard, job board, advertising |
| Phase 3 | M17-M19 | Scale phase | Marketplace, surveys, committee management |

### Pilot Success Criteria

| Criterion | Target | Window |
|-----------|--------|--------|
| Active members per org | 30+ logged in at least once | Month 3 |
| Dues payments per org | 10+ payments processed | Month 3 |
| Officer onboarding | All 3 roles (Admin, Treasurer, Secretary) completed setup | Week 2 |
| Critical bugs | 0 P0/P1 in production | First 30 days |

---

## 7. Constraints and Non-Functional Requirements

### Performance Targets

| Requirement | Threshold | Rationale |
|-------------|-----------|-----------|
| API response time (p95) | < 500ms | Officers on mobile in the field |
| Page load on mobile 3G | < 3 seconds | Philippine mobile infrastructure |
| Platform uptime | >= 99.5% SLA | < 3.6 hours downtime/month |
| PDF generation | < 3 seconds | Real-time ID card/receipt generation at events |
| Member search | < 200ms | Reception-desk instant lookup |
| Concurrent users | >= 500 simultaneous | Annual convention spikes |

NFR breaches in production are treated as P1 incidents with 24-hour resolution SLA.

### Data Privacy and Compliance

- **Philippines Data Privacy Act of 2012 (DPA 2012):** All PII handling must comply. Consent management planned but not yet in schema.
- **BIR Financial Retention:** 7-year minimum for payment records (BR-32).
- **Soft Delete:** All user-facing records use soft delete with audit reconciliation.
- **Anonymization on Deletion:** Account deletion anonymizes PII but retains financial records with anonymized identifiers.
- **Global Expansion:** Framework for GDPR/PDPA compliance designed but deferred to Phase 2.

### Security

- Better-Auth with session management (BR-26)
- Position-based RBAC enforced at route level (v1.1.0)
- Read-only impersonation for platform admins (BR-10)
- Payment gateway credentials encrypted at rest, never logged (BR-30)
- SVG upload sanitization (BR-31)
- No raw credit card storage -- delegated to PCI-DSS compliant gateway

### Localization

- **Phase 1:** English UI with Filipino/Tagalog context where needed
- **Currency:** Philippine Peso (PHP) primary; multi-currency framework ready
- **Date/Time:** Asia/Manila default; org-configurable timezone
- **Phase 2:** Full i18n framework for ASEAN expansion

### Accessibility

- WCAG 2.1 AA target
- Keyboard navigation for all interactive elements
- Screen reader compatibility for core flows
- High contrast mode support

### Concurrency Control

- Optimistic locking for payment recording (prevent double-payment)
- Officer action serialization (prevent conflicting role assignments)
- Idempotency keys for payment and notification operations

---

## 8. Success Metrics

### North Star

**Monthly Active Members (MAM):** Members who have logged in and performed at least one meaningful action (paid dues, registered for event, viewed credits) within a 30-day window.

### Phase 1 KPIs (6-Month Targets)

| Category | Metric | Target |
|----------|--------|--------|
| Membership | Roster digitization rate | >= 80% of chapter members imported |
| Dues | Online payment adoption | >= 40% of payments via platform |
| Events | Event creation rate | >= 2 events/month per active chapter |
| Training | Training completion tracking | >= 1 training/quarter per chapter |
| Communications | Announcement open rate | >= 50% |
| Credits | Credit tracking adoption | >= 60% of eligible members |

### Failure and Pivot Criteria

- If pilot associations fail active member and dues targets by month 3: immediate qualitative investigation
- If 3 consecutive months of declining MAM: product-market fit reassessment
- If online payment adoption stays below 20% at month 6: payment UX overhaul or pivot to offline-first model

---

## Source Documents

| Section | Primary Source |
|---------|---------------|
| Executive Summary | `README.md`, `docs/ver-3/business/context.md` |
| Vision and Scope | `docs/ver-3/business/context.md` (sections 4, 8) |
| User Roles and Personas | `docs/ver-3/business/personas-and-roles.md` |
| Module Requirements Matrix | `docs/ver-3/business/modules/README.md`, `CLAUDE.md` (handler listing) |
| Business Rules Summary | `docs/ver-3/business/business-rules.md` |
| Rollout Phases | `.planning/ROADMAP.md`, `docs/ver-3/business/modules/README.md` (section 4) |
| Constraints and NFRs | `docs/ver-3/business/cross-cutting.md`, `docs/ver-3/business/metrics.md` (section 2.4) |
| Success Metrics | `docs/ver-3/business/metrics.md` |

---

*Compiled from Memberry PRD v3 source documents. For full specifications, refer to individual module docs at `docs/ver-3/business/modules/m01-m19`.*
