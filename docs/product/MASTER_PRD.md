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

The API service has 24 handler directories under `services/api-ts/src/handlers/`. TypeSpec coverage is approximately 60%. The following platform modules are implemented:

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
| comms | Yes | WebSocket: video, chat (11 handlers) |
| documents | Yes | Document management (15 handlers) |
| certificates | Yes | Certificate generation (3 handlers) |
| storage | Yes | File upload/download (6 handlers) |
| reviews | Yes | NPS review system (4 handlers) |
| audit | Yes | Compliance logging (1 handler) |
| email | Yes | Transactional email (9 handlers) |
| notifs | Mixed | Multi-channel notifications (5 handlers) |
| advertising | No | Ad management (7 handlers, hand-wired) |
| jobs | No | Job board (7 handlers, hand-wired) |
| marketplace | No | Vendor marketplace (9 handlers, hand-wired) |

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

### Core Workflows

107 user flows documented in `docs/ver-3/business/personas-and-roles.md` (authoritative). Key journeys per persona:

**P6 Member (27 flows):** Register → verify email → complete profile → join org → pay dues → register for event → attend training → earn credits → download ID card. Core retention loop.

**P3 Treasurer (11 flows):** Configure dues → record payment → allocate funds → process refund → generate financial report. All flows require `treasurer` position.

**P4 Secretary (13 flows):** Import members → approve applications → create event → send announcement → manage roster. All flows require `secretary` position.

**P2 President (14 flows):** Assign officers → approve members → manage org settings → initiate elections → review reports. Highest org-level authority.

**P5 Society Officer (14 flows):** Create training program → manage enrollment → confirm attendance → issue credits → cross-org reporting.

**P1 Platform Admin (22 flows):** Onboard association → manage subscriptions → toggle feature flags → impersonate (read-only) → health scoring.

**Exception flows:** All officer actions require position validation (RBAC). Payment flows use idempotency keys. Session expiry redirects to login (no draft save). Invalid membership transitions rejected silently (BR-03). Refunds blocked after 30 days or fund allocation (BR-08).

**Cross-module flows:** Event attendance → training completion → credit award (M08→M09→M10). Dues payment → expiry extension → membership status update (M06→M05). Full workflow map: `docs/product/WORKFLOW_MAP.md`.

### Acceptance Criteria by Module

Per-module acceptance criteria are defined in individual module specs at `docs/product/modules/m01-m19/`. Each module spec includes:
- Functional requirements with pass/fail criteria
- Business rule coverage mapping (BR-## tags)
- UAT scenarios for critical paths

Pilot-level acceptance criteria are in PRD S6 (Pilot Success Criteria) and S8 (Success Metrics).

### Data Volume Estimates

| Dimension | Pilot (3 months) | Scale (12 months) | Rationale |
|-----------|------------------|-------------------|-----------|
| Associations | 3-5 | 50-100 | PH dental/medical pilot associations |
| Organizations per association | 10-20 chapters | 50-100 chapters | PH dental assoc has ~200 chapters total |
| Members per org | 30-100 | 50-300 | PRD pilot target: 30+ active per org |
| Total members | 1,000-5,000 | 25,000-100,000 | Target market: 250K+ licensed professionals |
| Payments per org per month | 10-30 | 30-100 | PRD pilot target: 10+ payments per org |
| Events per org per month | 2-5 | 5-15 | PRD target: 2+ events/month per active chapter |
| Training completions per month | 50-200 | 500-5,000 | 1 training/quarter per chapter (PRD S8) |
| File uploads per month | 100-500 | 1,000-10,000 | Certificates, ID cards, receipts |
| Email sends per day | 50-200 | 1,000-10,000 | Announcements, reminders, receipts |
| Concurrent WebSocket connections | 20-50 | 100-500 | Convention spike NFR: 500 max |

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

### Rate Limiting

Global rate limiting implemented in `services/api-ts/src/middleware/rate-limit.ts`:

| Category | Limit | Window | Scope |
|----------|-------|--------|-------|
| Write ops (POST/PUT/PATCH/DELETE) | 30 requests | 1 minute | Per IP |
| Read ops (GET/HEAD/OPTIONS) | 120 requests | 1 minute | Per IP |
| Auth routes (/auth/*) | Managed by Better-Auth | — | Per IP |
| Health checks (/health, /ready) | Exempt | — | — |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on 429).

Rate limiting is disabled in development and test environments. Convention spike scenario (500 concurrent users) stays within read limits.

### UI States

All data-fetching views must handle four states. Reference implementations exist in the codebase:

| State | Component | Pattern | Reference |
|-------|-----------|---------|-----------|
| Loading | `SkeletonLoader` | Animated placeholder matching final layout | `apps/memberry/src/components/patterns/skeleton-loader.tsx` |
| Empty | `EmptyState` | Illustration + message + primary action CTA | `apps/memberry/src/components/patterns/empty-state.tsx` |
| Error | `ErrorBoundary` + `ErrorState` | Retry button + error message (no stack traces) | `apps/memberry/src/components/patterns/error-boundary.tsx`, `error-state.tsx` |
| Success | Normal render | Data displayed in table/card/list | Standard TanStack Query `data` state |

Error handling: TanStack Query `onError` → sonner toast for transient errors, inline `ErrorState` for page-level failures. Network errors trigger automatic retry (TanStack Query default: 3 retries with exponential backoff).

### Edge Case Handling

**Network failures:**
- TanStack Query retries failed requests 3 times with exponential backoff (default behavior)
- Mutations use `onError` callbacks to display sonner toast with retry action
- WebSocket (comms module) shows `ConnectionStatus` indicator and auto-reconnects
- Offline state: no offline support — user sees standard browser offline page

**Partial operation recovery:**
- Payment recording: idempotency keys prevent double-charge if request retries
- Bulk operations (member import, bulk payment): each row processed independently — partial success returns list of failed rows with error details
- File upload: failed uploads return error immediately — no partial file state
- Database transactions: multi-table operations wrapped in transactions — all-or-nothing

### Test Strategy

Full protocol: `VERTICAL_TDD.md`. Test-first, vertical slices per module.

**Test types and counts:**

| Type | Count | Runner | Scope |
|------|-------|--------|-------|
| API unit tests | ~97 files | Bun test | Handler logic, repos, validators, business rules |
| Contract tests | ~97 .hurl files | Hurl | API endpoint behavior against running server |
| Frontend component tests | Growing | Vitest | Component rendering, hook behavior |
| E2E tests | Growing | Playwright | Critical user journeys per persona |

**Coverage targets:**
- Every business rule (BR-01 through BR-40) must have at least one dedicated test tagged with `[BR-##]`
- Every state machine transition must have a test (valid + invalid transitions)
- Every handler must have unit tests covering happy path + error path
- Critical user journeys (pay dues, register for event, record payment) must have E2E tests

**Test pyramid:** Unit tests (fast, many) → Contract tests (API surface) → E2E tests (critical paths). No integration test layer — contract tests serve this purpose.

### Feature Flags

Feature flag system implemented in `services/api-ts/src/handlers/platformadmin/`:

**Schema:** `feature_flag` table with `targetType` (association/organization/global), `targetId`, `moduleName`, `enabled` boolean.

**CRUD:** Platform admin manages flags via admin dashboard. Flags are scoped:
- **Global:** Applies to all associations (e.g., new module rollout)
- **Association:** Applies to one association (e.g., pilot feature)
- **Organization:** Applies to one org (e.g., beta testing)

**Per-org `featureFlags` JSONB:** Organizations also carry a `featureFlags` JSONB column for quick-check flags without DB joins.

**Naming convention:** `{module}.{feature}` (e.g., `events.qrCheckin`, `dues.onlinePayment`)

**Lifecycle:** Create (disabled) → Enable for pilot orgs → Enable globally → Remove flag + dead code. Flags older than 6 months should be evaluated for permanent adoption or removal.

**No A/B testing in Phase 1.** Feature flags are binary on/off toggles for phased rollout. A/B testing framework deferred to Phase 2.

### Localization

- **Phase 1:** English UI with Filipino/Tagalog context where needed
- **Currency:** Philippine Peso (PHP) primary; multi-currency framework ready
- **Date/Time:** Asia/Manila default; org-configurable timezone
- **Phase 2:** Full i18n framework for ASEAN expansion
- **RTL support:** Not required — target markets (PH, ASEAN) are LTR

**String externalization (Phase 1):**
- UI strings are hardcoded in English (acceptable for Phase 1 single-locale)
- Error messages from API use `AppError.message` (English)
- Email templates support variable interpolation but single-language content

**String externalization (Phase 2 preparation):**
- Extract all UI strings to JSON resource files (`en.json`, `fil.json`)
- Use `react-i18next` or equivalent for runtime string lookup
- API error messages remain English (machine-readable `code` field used for client-side i18n)
- Date/number/currency formatting via `Intl` APIs (already locale-aware)

**Translation workflow (Phase 2):**
- Professional translation for core UI strings (paid)
- Community/officer translation for org-specific content (templates, announcements)
- Translation memory tool (e.g., Crowdin) for consistency across updates

### Accessibility

- **Target:** WCAG 2.1 AA compliance
- **Keyboard navigation:** All interactive elements reachable via Tab, activatable via Enter/Space. Focus indicators visible (`:focus-visible` CSS)
- **Screen readers:** Core flows (login, dashboard, payment, event registration) tested with VoiceOver (macOS/iOS). ARIA landmarks on all page regions. Form fields have associated labels.
- **Component library:** shadcn/ui primitives (Radix-based) provide built-in ARIA roles, keyboard handling, and focus management. Reference: `packages/ui/src/components/`
- **Data tables:** `data-table.tsx` pattern includes column headers with scope, sortable columns with `aria-sort`, row selection with checkbox
- **High contrast:** Support via CSS custom properties — no separate theme needed
- **Assistive technology testing:** VoiceOver (primary), NVDA (Windows, Phase 2). No JAWS testing planned.
- **Automated checks:** axe-core integration in E2E tests for accessibility regression detection (Phase 2)

### Concurrency Control

- Optimistic locking for payment recording (prevent double-payment)
- Officer action serialization (prevent conflicting role assignments)
- Idempotency keys for payment and notification operations

### Error Contract

All API errors return a consistent JSON shape defined in TypeSpec (`specs/api/src/common/errors.tsp`) and implemented in `services/api-ts/src/core/errors.ts`:

```json
{ "code": "ERROR_CODE", "message": "Human-readable", "requestId": "uuid", "timestamp": "ISO 8601", "statusCode": 400 }
```

| Code | HTTP | When | Extra Fields |
|------|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Zod schema failure | `fieldErrors[]`, `globalErrors[]` |
| `UNAUTHORIZED` | 401 | Missing or expired session | — |
| `AUTHENTICATION_ERROR` | 401 | Login failure | `scheme`, `supportedSchemes[]` |
| `FORBIDDEN` | 403 | Valid session, insufficient role | — |
| `AUTHORIZATION_ERROR` | 403 | RBAC denial | `requiredPermission`, `resource` |
| `NOT_FOUND` | 404 | Resource or route missing | `resourceType`, `suggestions[]` |
| `METHOD_NOT_ALLOWED` | 405 | Correct path, wrong method | `allowed[]` + `Allow` header |
| `CONFLICT` | 409 | Optimistic locking / duplicate | `reason`, `resolution[]` |
| `BUSINESS_ERROR` | 422 | Domain rule violation | — |
| `RATE_LIMIT` | 429 | Throttled | `limit`, `usage`, `resetTime` + `Retry-After` header |
| `DEFERRED_SCOPE` | 501 | Handler planned for future wave | — |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled | `trackingId` |

Production mode strips `path`, `method`, and internal `details` from responses. TypeSpec models define the same hierarchy: `ErrorDetail` base with `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError` extensions.

### Session Lifecycle

- **Duration:** Configurable via `config.auth.sessionExpiresIn` (Better-Auth)
- **Expiry detection:** API returns `401 UNAUTHORIZED` on expired session
- **Frontend behavior:** Route guards (`requireAuth` in TanStack Router `beforeLoad`) catch 401 and redirect to `/auth/sign-in`
- **In-progress work:** Form state is **not preserved** on session expiry — data entered in unsubmitted forms is lost
- **Post-login redirect:** Returns to dashboard, not the previous page
- **Tracked improvements (P2):**
  - Redirect back to previous page after re-authentication
  - Auto-save form drafts to `localStorage` for long-form flows (payment recording, member import)

### Bootstrap Data Requirements

Minimum bootstrap for a new deployment:

1. **Database migrations** — run automatically on server start
2. **Platform admin account** — at least one super-admin for platform operations
3. **Role definitions** — system-wide and org-scoped roles defined in code (`types/auth.ts`, `utils/org-auth.ts`), not DB seed
4. **First association + organization** — created through platform admin UI after initial login

For development and testing: `bun run db:seed-scenarios` creates 18 phases of scenario data (associations, orgs, members, officers, dues, events, training). Full manifest: `docs/product/SEED_MANIFEST.md`.

### Observability

See `docs/product/OBSERVABILITY.md` for the full observability strategy. Key points:

- **Logging:** Pino structured JSON, configurable levels (`LOG_LEVEL` env var), correlation via `requestId`
- **Metrics:** RED method (Rate, Errors, Duration) per endpoint, tied to NFR targets
- **Alerting:** Thresholds derived from NFR targets (p95 > 500ms, uptime < 99.5%, error rate > 1%)
- **Tracing:** Request correlation via `X-Request-ID` header propagation
- **Health check:** `/health` endpoint for liveness + readiness probes

### Disaster Recovery

See `docs/product/DISASTER_RECOVERY.md` for the full DR plan. Key points:

- **RTO:** 4 hours (maximum acceptable recovery time)
- **RPO:** 1 hour (maximum acceptable data loss)
- **Backups:** Daily full PostgreSQL backups + continuous WAL archiving
- **Financial data:** 7-year retention per BIR requirements (BR-32)
- **BCDR testing:** Quarterly restore validation

### State Machines

See `docs/product/STATE_MACHINES.md` for all entity lifecycle state machines. Every entity with a `status` field has a documented state machine with valid transitions. Key machines:

- **Membership** (BR-03): PENDING → ACTIVE → GRACE → LAPSED → SUSPENDED → REMOVED
- **Dues Payment:** pending → completed/failed → refunded/partiallyRefunded
- **Invoice:** draft → open → paid/void/uncollectible
- **Event:** draft → active → paused → archived
- **Training Enrollment:** enrolled → completed
- **Message:** draft → scheduled → sending → sent/cancelled/failed

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
| Module Requirements Matrix | `docs/product/modules/README.md`, `CLAUDE.md` (handler listing) |
| Business Rules Summary | `docs/ver-3/business/business-rules.md` |
| Rollout Phases | `.planning/ROADMAP.md`, `docs/product/modules/README.md` (section 4) |
| Constraints and NFRs | `docs/ver-3/business/cross-cutting.md`, `docs/ver-3/business/metrics.md` (section 2.4) |
| Success Metrics | `docs/ver-3/business/metrics.md` |

---

*Compiled from Memberry PRD v3 source documents. For full specifications, refer to individual module docs at `docs/product/modules/m01-m19`.*
