---
oli-version: "1.0"
dimension: discovery
last-modified: 2026-05-30
last-modified-by: oli-check --discovery
audit-cycle: 4
prior-cycle: 3 (EXISTING_CODEBASE_ADOPTION_AUDIT.cycle_3.md, 2026-05-27)
source-commit: 9c473e1fd7ce5d6c1986070f966eb37b6e9bcd2e
source-directory: /Users/elad-mini/Desktop/memberry
stack: TypeScript + Bun + Hono + Drizzle ORM + PostgreSQL + TanStack Router + Vite
---

# Existing Codebase Adoption Audit — Cycle 4

## 1. Executive Summary

**Overall Health Score: 8.2 / 10** (156 / 190 across 19 dimensions)
**Delta vs Cycle 3 baseline: +0.8** (7.4 → 8.2)

The remediation work between 2026-05-27 and 2026-05-30 measurably moved the codebase forward. Five of the seven P1 items raised in cycle 3 are resolved or partially resolved:

- **State transition guards introduced.** Two utilities exist (`services/api-ts/src/utils/status-transitions.ts` — global; `services/api-ts/src/handlers/association:member/utils/status-transitions.ts` and `.../booking/utils/status-transitions.ts` — module-scoped). 11 transition maps defined (BOOKING_EVENT, EMAIL_QUEUE, FEED_POST, MEMBERSHIP, DUES_PAYMENT, ELECTION, MARKETPLACE_VENDOR / LISTING / ORDER, TRAINING, TRAINING_ENROLLMENT) with `isValidTransition` / `assertValidTransition` helpers. Guards wired in: `dues-payments.repo`, `marketplace/fulfillOrder`, `association:operations/publishTraining`, `association:member/updateOfficerTerm`, `elections/updateElectionStatus`. NOT yet wired: membership status updates, booking status updates, invoice transitions, license, training enrollment. Net P1 → P2 with surgical fix-list.
- **Status-naming mismatch fixed.** Cycle 3's `terminated` vs `REMOVED` mismatch is resolved — schema and transitions now use `removed` consistently across `membership.schema.ts:43`, `status-transitions.ts:88`, and event subtype mapping in `handlers/membership/updateMember.ts:125`. The only remaining occurrence is the event subtype string `membership.member-terminated` (kept for emitted-event back-compat per `domain-events.registry.ts`).
- **`as any` density collapsed.** Cycle 3 reported 274 `as any` in `association:member`; current count is **1** (a comment containing "any"). Total handler `as any` (excluding tests) dropped from ~290 to **30**, concentrated in: `platformadmin` (9 — Better-Auth session cast, Drizzle enum filter), `communication/jobs/announcementSend` (6 — JSONB column reads), `billing/handleStripeWebhook` (5 — Stripe SDK type gaps, justified inline), `surveys` (3 — JSONB), `certificates` (3), and rest ≤2. All remaining casts are at external-library boundaries or JSONB reads, not internal type-system erosion.
- **Domain events expanded.** Cycle 3 reported 3 typed events; `core/domain-events.registry.ts` now exports **65** typed event names spanning person, membership, dues, events, elections, governance, billing, training, etc. `DomainEventName` derived as `keyof DomainEventMap`. Cross-module communication can now flow via typed events instead of direct repo imports.
- **Core → handler inversions reduced.** Cycle 3 counted 20 inverted imports across 11 core/middleware files. Current count: **9 production inversions** (8 in `core/schema-registry.ts` — schema re-exports, arguably acceptable as a centralization point; 1 in `core/domain-event-consumers.ts` → governance.repo) + **4 middleware → handler** (`officer-auth`, `platform-admin-auth`, `impersonation-guard`, `org-context`). Net ~13 inverted, down from 20. `core/email.ts`, `core/auth.ts`, `core/notifs.ts`, `core/audit.ts` no longer import handler repos.

**Top Remaining Risks (P1):**
1. ~~**Membership / Booking / Invoice / License / Training-Enrollment transitions defined but unenforced**~~ **CLOSED in Wave G1 (2026-05-30).** All 6 production transition maps (membership, booking, invoice, training-enrollment, marketplace-vendor, email-queue) now have ≥1 runtime `assertValidTransition` site. Marketplace-listing map has no mutators in code (no listing CRUD exists yet) — deferred until listing routes ship.
2. **Schema-registry as a hub** — `core/schema-registry.ts` re-exports 8 handler schemas (notifications, bookings, platformAdmins, training, memberships, positions, events, eventRegistrations, invitationTokens). This works at runtime but is still an inverted dependency at the type layer. Either move schemas to `core/` or formalize the registry pattern in ARCHITECTURE.md.
3. **N+1 + unbounded queries persist.** 70 `findMany` calls without `.limit()` outside the well-paginated repos. Spot-checks confirm cycle 3's 15-20 unbounded list endpoints + 3 N+1s are still present (booking, marketplace, person, communication).
4. ~~**Phantom FE endpoints**~~ **CLOSED in Wave G1 (2026-05-30).** All 9 phantom endpoints reconciled via S-G1-07 (`078bd00a`) — drift fixes + hand-wired registrations.

**Recommended adoption posture:** Wave G1 closes the cycle-3 P1 stabilization items. Codebase is now ready to enter **Phase 4 (Adopt Standards)**; remaining stabilization work is N+1/pagination (P2-tier) and schema-registry formalization.

---

## 2. Project Overview

| Item | Count |
|---|---|
| Backend handler modules | 25 |
| Frontend apps | 2 (`memberry` 3004, `admin` 3003) + 2 packages (`ui`, `sdk`) |
| Total source files | ~1,400 TS/TSX (api ~720, memberry ~362, admin ~40, packages ~75) |
| Total source lines (non-test) | ~152K (api 101K + memberry 51K) |
| API endpoints (OpenAPI) | 428 |
| Phantom endpoints (FE-call w/o BE route) | 9 |
| Unauthed / unknown-auth endpoints | 21 |
| Frontend routes | 143 total (120 memberry, 23 admin) |
| Authenticated frontend routes | 60+ |
| Handler tests | 486 files |
| E2E tests (Playwright) | 127 spec files |
| Memberry unit/component tests | 97 files |
| Admin unit/component tests | 12 files |
| Contract tests (Hurl) | 99 files |
| Per-module MODULE_SPECs | 22 (m01–m22) |
| Frontend components | 411 (memberry 348, admin 32, pkg-ui 31) |
| Domain events typed | 65 |
| State machine maps defined | 11 |
| State machine maps wired into handlers | 5 / 11 |
| Source commit | `9c473e1f` (2026-05-30) |

---

## 3. Project Structure

**Stack:** TypeScript + Bun + Hono + Drizzle ORM + PostgreSQL + TanStack Router + Vite.
Source layout matches cycle 3; no architectural moves landed.

| Path | Purpose | Module? |
|---|---|---|
| `services/api-ts/src/handlers/{module}/` | Per-module CRUD handlers, repos, jobs, utils | Yes |
| `services/api-ts/src/core/` | Cross-cutting (auth, errors, db, jobs, events, metrics) | No |
| `services/api-ts/src/middleware/` | Hono middleware (org-context, officer-auth, rate-limit) | No |
| `services/api-ts/src/generated/` | OpenAPI routes/validators/registry, migrations | No (do-not-edit) |
| `apps/memberry/src/routes/` | TanStack Router file-based routes (120) | Yes (frontend) |
| `apps/admin/src/routes/` | Admin dashboard routes (23) | Yes (frontend) |
| `packages/sdk/` | Generated TanStack Query hooks + hand-written client/flows | Shared lib |
| `packages/ui/` | Shared shadcn-style components | Shared lib |
| `specs/api/src/modules/*.tsp` | TypeSpec definitions | Spec |
| `specs/api/tests/contract/*.hurl` | Contract tests (99 files) | Test |

Contract artifacts present (Step 1 detection): `docs/product/DOMAIN_MODEL.md`, `docs/product/MODULE_MAP.md`, `docs/product/modules/{slug}/MODULE_SPEC.md` (22), `docs/product/modules/{slug}/API_CONTRACTS.md` (many). Drift detection (Step 6b / 9b) ACTIVE.

---

## 4. Module Map

### 4.1 Backend modules (25)

| Module | Files | Endpoints | Tests | TypeSpec | Status |
|---|---|---|---|---|---|
| association:member | 246 | 166 | ~79 | partial | MEGA-MODULE — split deferred to v1.2.0 |
| association:operations | 80 | 60 | ~21 | partial | Active — committees, analytics, training-ops |
| communication | 53 | 31 | ~41 | yes | Active — templates, queues, segments |
| platformadmin | 56 | 28 | ~28 | yes | Active — ops |
| booking | 32 | 18 | ~25 | yes | Active |
| person | 35 | 18 | ~29 | partial | Central PII hub |
| billing | 18 | 16 | ~23 | yes | Stripe Connect |
| documents | 17 | 15 | ~22 | partial | Active |
| surveys | 20 | 13 | ~14 | yes | Active — NPS + member surveys |
| email | 23 | 12 | ~17 | yes | Transactional queue |
| comms | 16 | 10 | ~5 | yes | Real-time WS |
| storage | 8 | 6 | ~4 | yes | S3 / MinIO |
| notifs | 9 | 5 | ~7 | mixed | OneSignal multi-app |
| dues | 17 | 4 | ~14 | partial | Invoicing |
| invite | 7 | 4 | ~4 | yes | Org invitations |
| membership | 18 | 4 | ~24 | hand-wired | Applications, approvals |
| reviews | 6 | 4 | ~5 | yes | NPS reviews |
| onboarding | 4 | 2 | — | yes | New |
| events | 18 | 2 | ~25 | partial | Event mgmt (most under association:operations) |
| audit | 4 | 1 | ~4 | yes | Compliance |
| advertising | 11 | — | ~7 | partial | New since cycle 3 |
| certificates | 11 | — | ~12 | no | Active |
| elections | 11 | — | ~17 | partial | Active |
| jobs | 9 | — | ~7 | no | Infra |
| marketplace | 13 | — | ~3 | partial | New since cycle 3 |

### 4.2 Frontend modules

| App | Files | Components | API-calling | Routes |
|---|---|---|---|---|
| memberry | 362 | 348 | 33 | 120 |
| admin | 40 | 32 | 5 | 23 |
| pkg-ui | 31 | 31 | — | — |
| pkg-sdk | 14 | — | — | — |

### 4.3 Dependency posture (from CODE_IMPORT_GRAPH.json + Step 13d re-scan)

- **Handler → handler:** clean (production). One exception: handlers occasionally import sibling-module schemas via `core/schema-registry.ts`.
- **Core → handler:** **9 production inversions** (down from 20). All in `schema-registry.ts` (8) and `domain-event-consumers.ts` (1).
- **Middleware → handler:** 4 (officer-auth → governance.repo; impersonation-guard, platform-admin-auth → platform-admin.repo; org-context → membership.schema + platform-admin.schema). Required for the auth model; consider moving these schemas to `core/`.
- **Bi-directional:** none.

---

## 5. Domain Glossary Summary

Top domain terms (from `CODE_TERMINOLOGY_MAP.json`, 1500 strings sampled, 10 clusters):

| Term | Variants | Strings | Modules using |
|---|---|---|---|
| member | 20 | 91 | app-admin, app-memberry |
| event | 20 | 37 | app-admin, app-memberry |
| dues | 20 | 28 | app-memberry |
| credit | 17 | 27 | app-admin, app-memberry |
| election | 15 | 24 | app-memberry |
| invoice | 12 | 23 | app-memberry |
| membership | 20 | 23 | app-memberry |
| training | 18 | 21 | app-admin, app-memberry |
| document | 15 | 20 | app-memberry |
| committee | 4 | 5 | app-admin, app-memberry |

### DDD Analysis (inferred — `[INFERRED]`)

| Entity | Aggregate Root? | Domain Events | Cross-Module Pattern | Confidence |
|---|---|---|---|---|
| Person | Yes | person.deletion.requested/cancelled (+ implicit PersonCreated/Updated) | API — referenced by every module | INFERRED |
| Membership | Yes | membership.status.changed, membership.activated, member-terminated subtype | Direct import + typed event | INFERRED |
| DuesInvoice | Yes (under membership context) | dues.invoice.generated | Direct import + typed event | INFERRED |
| DuesPayment | Yes | dues.payment.recorded, dues.payment.refunded, dues.payment.proof.rejected | Typed event | INFERRED |
| Booking | Yes | booking.confirmed / cancelled (implicit) | Isolated | INFERRED |
| OfficerTerm | Yes (child of Position aggregate) | term-status changes | Direct (governance.repo) | INFERRED |
| Election | Yes | election.status.changed | Typed event | INFERRED |
| EventRegistration | Child (Event aggregate) | event.registration.cancelled | Typed event | INFERRED |
| Organization | Yes | org.settings.updated | Cross-cutting | INFERRED |
| Survey | Yes | (not yet typed) | Module-internal | INFERRED |

**Bounded contexts:** memberry app behaves as one composite context; backend handler boundaries approximate sub-contexts (association:member, billing, comms vs. communication vs. communications). Three-name communication split documented in CLAUDE.md.
**Anti-corruption layers present:** `services/api-ts/src/sdk/` SDK client wraps generated OpenAPI types; Stripe SDK access wrapped in `handleStripeWebhook` (with documented cast escapes).
**Anti-corruption layers missing:** cross-module direct repo loads in `core/domain-event-consumers.ts` (governance.repo) and in middleware (governance, platform-admin, membership). Acceptable for now; should be replaced with explicit ports under `core/ports/` (cycle-3 recommendation, unrealized).

### Terminology drift (Step 3 + Step 13)

| Concept | Variations | Severity |
|---|---|---|
| Communication modules | `comms/` (WS), `communication/` (templates), `communications/` (announcements) | P3 (documented in CLAUDE.md) |
| Member identifier | `memberNumber` vs `licenseNumber` fallback in `importMembers.ts` | P2 — unchanged from cycle 3 |
| Status enum case | `pendingPayment` (camelCase) vs `pending_payment` (snake_case appears in some seed/test fixtures) | P3 |

---

## 6. Permission Summary

Auth stack unchanged from cycle 3 (verified present):

| Layer | Mechanism | Status |
|---|---|---|
| Global auth | Better-Auth session + suspended account block | PASS |
| Officer auth | Active term + 2FA for president/treasurer/secretary | PASS |
| Platform admin | `platform_admins` table check | PASS |
| Impersonation guard | 2-hour cap, write-block | PASS |
| Account lockout | 5 failed attempts → 15-min ban + audit log | PASS |
| Rate limiting | Configurable per-route; skips `/livez` / `/readyz` | PASS |
| Session limits | 24 h expiry, 5 concurrent (configurable) | PASS |

Unauthed/unknown-auth endpoints (from CODE_API_SURFACE.md): 21 across `app-memberry` (7 — public verify endpoints, payment tokens, public org slug), `app-admin` (2 — dev-mode shells), `email` (2 — unsubscribe public links), `platformadmin` (2 — health/ready), `events` (2 — public discovery), `billing` (1 — webhook), `dues` (2 — payment-token + reminder hooks), `invite` (1 — token claim), `association:member` (2 — public verify). Spot-checks confirm these are intentional public endpoints (token-gated or read-only public).

Role definition: `RoleRequirement = string | ${string}:owner`. Owner-based row-level enforcement present in `core/auth.ts`. No new role classes introduced since cycle 3.

---

## 7. Business Rules Summary

Per `MEMORY.md`: 33/40 BRs COMPLETE (cycle-3 status). The Hurl contract suite (99 files) now includes per-BR tags (BR-43, BR-47, BR-48, BR-50, BR-51 added since cycle 3 per recent commit log). The `__tests__/br-edge-cases.test.ts` file binds [BR-16] [BR-25] [BR-28] [BR-29] to runnable assertions.

| Rule class | Confidence | Note |
|---|---|---|
| Explicit business rules (status guards, eligibility, ownership) | HIGH | Drizzle Zod validators + handler-level checks |
| Technical validation | HIGH | Generated Zod validators wrap all routes |
| UI-only behavior | MEDIUM | Some role-conditional rendering not re-checked server-side (acceptable when API enforces) |
| Inferred behavior | LOW | Magic strings (status names) still appear inline in some handlers |

No new P0/P1 BR-correctness regressions detected. Stub remaining: 9 institutional-membership handlers (deferred to v1.2.0) + `recalculateAgingBucket.ts` (1 explicit stub).

---

## 8. API Surface Summary

| Metric | Value |
|---|---|
| Total endpoints (OpenAPI) | 428 |
| Hand-wired routes (not from OpenAPI generation) | ~33 by-design |
| Phantom (FE-calls without BE route) | 9 — see Phantom report below |
| Unauthed / unknown-auth endpoints | 21 (intentional public surface) |
| OpenAPI spec size | 83,238 lines (`specs/api/dist/openapi/openapi.json`) |
| TypeSpec module coverage | 58% (15 of 25 handler dirs) |

### 8b. API Contract Drift (against per-module API_CONTRACTS.md)

Per-module `API_CONTRACTS.md` artifacts present under `docs/product/modules/m??/`. Full per-endpoint drift cross-walk not re-executed in this dimension (compliance/enforcement dimensions own that). High-level signal from `CODE_API_SURFACE.json`:

| Category | Approximate count | Severity |
|---|---|---|
| Undocumented endpoints in code | ~30 (mostly hand-wired routes) | P2 |
| Unimplemented endpoints in contracts | unknown without compliance run | run `/oli-check --compliance` |
| Schema drift | unknown without compliance run | run `/oli-check --compliance` |

Recommend running `/oli-check --compliance` next to populate this section quantitatively.

### Phantom endpoints (9 from CODE_API_SURFACE.md)

Frontend issues calls without a matching backend route — could be SDK calls to as-yet-unimplemented endpoints or stale code paths. Recommend a targeted grep + reconciliation pass before next release. **Severity: P1 — silent runtime 404 / 405 in production.**

---

## 9. State Machines Summary

Cycle 3 reported 6 unguarded machines with severity P1. Current state:

| Entity | Map defined | Helper | Used by handler | Coverage notes |
|---|---|---|---|---|
| Membership | yes (10 states) | `isValidMembershipTransition` | **NO** (defined-but-unused) | unit-tested 132 cases |
| Booking | yes (BOOKING_VALID + BOOKING_EVENT_VALID) | `isValidBookingTransition` | **NO** | unit-tested |
| Dues Invoice | yes | `isValidInvoiceTransition` | **NO** | unit-tested |
| Dues Payment | yes | `assertValidTransition(DUES_PAYMENT_VALID_TRANSITIONS,…)` | **YES** — `dues-payments.repo.ts:180` | wired |
| Officer Term | yes | `isValidTermTransition` | **YES** — `updateOfficerTerm.ts:43` | wired |
| Training | yes | `assertValidTransition(TRAINING_VALID_TRANSITIONS,…)` | **YES** — `publishTraining.ts:35` | wired |
| Training Enrollment | yes | — | NO | unit-tested only |
| Election | yes | `assertValidTransition(ELECTION_VALID_TRANSITIONS,…)` | **YES** — `updateElectionStatus.ts:26` | wired |
| Marketplace Order | yes | `assertValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS,…)` | **YES** — `fulfillOrder.ts:30` | wired |
| Marketplace Vendor / Listing | yes | — | NO | defined |
| License | NO map | — | NO | gap |
| Email Queue | yes | — | NO (used in queue worker?) | needs verification |
| Feed Post | yes | — | NO | defined |

5 of ~12 machines have runtime guards; framework exists for the remaining 7. **Severity: P1 → P2** (framework lifted infra burden; remaining work is wire-up).

Discrepancy with codebase-map: `CODE_STATE_MACHINES.md` detected only 3 FSMs because its detector pattern targets `useState<'a' | 'b'>` unions in React components. The Drizzle pg-enum-based state machines on the backend are invisible to that pattern. **Tooling gap (P3): codebase-map detector misses backend status enums; recommend extending detector.**

### 9b. Domain Model Drift (DOMAIN_MODEL.md present)

Per-endpoint state-machine cross-walk requires the compliance dimension (DOMAIN_MODEL.md has the canonical FSM map). Spot-check: `removed` state aligned in both DOMAIN_MODEL and code (was a P1 drift in cycle 3, **resolved**).

---

## 10. UI / Screens Summary

| App | Routes | Screens with components | Has tests | Notes |
|---|---|---|---|---|
| memberry | 120 | 120 | 97 component + 127 E2E spec | most routes have at least one E2E |
| admin | 23 | 23 | 12 component | E2E coverage still light |

Mock data isolation: per cycle 3, seed isolated to `src/seed/`. Spot-check confirms no `*.mock.ts` or `mockData` referenced from production routes. UI prototype packs exist for 19 modules under `docs/product/modules/m??/ui-prototype/`.

Audit `docs/audits/UI_JOURNEY_AUDIT.md` and `wave0a-UI-REVIEW.md` show ongoing journey coverage work; not a regression.

---

## 11. Test Coverage Summary

| Category | Items | Tested | Coverage | Quality |
|---|---|---|---|---|
| Backend handler tests | 486 files | n/a | strong | STRONG (Bun test) |
| Memberry unit + component tests | 97 files | 348 components | partial | mixed |
| Admin unit + component tests | 12 files | 32 components | weak | thin |
| E2E (Playwright) | 127 files | 120 routes | strong | most routes covered |
| Hurl contract tests | 99 files | 428 endpoints | partial | BR-tagged |
| SDK tests | ~5 | — | minimal | acceptable |

Per-module module-spec coverage (22 specs vs 25 handler dirs):
- Missing: `comms`, `notifs`, `storage`, `audit`, `invite`, `reviews`, `jobs`, `certificates` — some are infra modules.

Memberry E2E covers 120 routes via Playwright `page.goto` (verified by recent commits adding BR-tagged contract tests and surveys/communications coverage).

### 11.1 Per-Module Test Coverage Assessment

| Tier | Modules |
|---|---|
| STRONG (handler tests, E2E, contract) | association:member, communication, person, booking, events, membership, billing, documents, dues |
| GOOD (handler + contract, some E2E) | platformadmin, elections, certificates, surveys, training (under association:operations) |
| MODERATE (handler tests, light E2E/contract) | email, comms, notifs, reviews, storage, invite, audit, onboarding |
| WEAK (sparse) | advertising (new), jobs, marketplace (new), admin app |

---

## 12. Repository Guardrails Review

| File | Exists | Lines | Quality | Notes |
|---|---|---|---|---|
| ARCHITECTURE.md | yes | ~340 | current | matches code structure |
| CONTRIBUTING.md | yes | ~2,500 | comprehensive | covers TDD, conventions |
| CLAUDE.md | yes | ~420 | current | reflects 2-app architecture |
| README.md | yes | ~340 | current | accurate command set |
| ROADMAP.md | yes | ~155 | active | v1.2.0 in progress |
| VERTICAL_TDD.md | yes | ~310 | current | followed by recent commits |
| QUICKSTART.md | yes | — | current | — |
| CHANGELOG.md | yes | — | current | — |

Multiple legacy audit-summary markdowns at root (`AUDIT_04_INDEX.md`, `AUDIT_04_SUMMARY.md`, `CODEBASE_ORIENTATION.md`, `INTERACTIVE_AUDIT_QUICK_REF.md`, `INTERACTIVE_ELEMENTS_AUDIT.md`, `MEMBER_INTERACTIVE_ELEMENTS_AUDIT.md`, `TODOS.md`) — P3 housekeeping: relocate to `docs/audits/archive/`.

---

## 13. PRD / Spec Coverage Review

| Artifact | Exists | Matches code | Quality | Notes |
|---|---|---|---|---|
| MASTER_PRD.md | yes | yes | comprehensive | — |
| DOMAIN_MODEL.md | yes | yes (membership `removed` aligned) | complete | — |
| DOMAIN_GLOSSARY.md | yes | yes | complete | — |
| ROLE_PERMISSION_MATRIX.md | yes | yes | complete | — |
| MODULE_MAP.md | yes | yes | complete | — |
| MODULE_SPEC.md per module | 22 | yes | comprehensive | covers all 22 product modules |
| API_CONTRACTS.md per module | many | partial drift | comprehensive | run `--compliance` |
| WORKFLOW_MAP.md | yes | yes | complete | — |
| STATE_MACHINES.md | yes | yes | complete | matches new transition maps |
| THREAT_MODEL.md | yes | yes | complete | — |
| EVENT_CONTRACTS.md | yes | partial (65 typed events) | active | grew from 3→65 |
| UI_BLUEPRINT.md | yes | yes | complete | — |
| TRACE_MATRIX.md | yes | yes | complete | — |
| OBSERVABILITY.md | yes | yes | complete | — |
| PERFORMANCE.md | yes | partial (still unbounded queries) | complete | — |
| DATA_GOVERNANCE_DRAFT.md | yes | draft | partial | promote out of `_DRAFT` |
| DISASTER_RECOVERY.md | yes | yes | complete | — |
| ERROR_TAXONOMY.md | yes | yes | complete | — |
| EVENT_CONTRACTS.md | yes | yes | complete | — |
| API_CONVENTIONS.md | yes | yes | complete | — |
| AUDIT_CONTRACTS.md | yes | yes | complete | — |

Industry-leading documentation coverage retained.

---

## 14. Standards Gap Matrix

| Area | Current State (2026-05-30) | Target | Gap | Risk | Priority | Action |
|---|---|---|---|---|---|---|
| State transition guards | 5 of 12 wired; framework complete | All 12 wired | Wire 7 remaining | Invalid transitions possible on membership, booking, invoice, training-enrollment, marketplace vendor/listing, email queue | P1 | Add `isValidTransition` call sites in `handlers/membership/updateMember.ts`, `handlers/association:member/terminateMembership.ts`, `handlers/booking/updateBooking*.ts`, invoice transitions, training-enrollment, marketplace |
| Core → handler inversions | 9 schema re-exports + 1 governance.repo + 4 middleware | 0 (use core/ports/) | Architectural | Cross-module changes break core | P2 | Move shared schemas to `core/`; introduce `core/ports/` for repo interfaces |
| Phantom FE endpoints | 9 | 0 | Silent 404s | Runtime errors | P1 | Reconcile FE SDK calls vs OpenAPI |
| N+1 queries | 3 (cycle-3 list, not re-counted) | 0 | Performance | Latency at scale | P2 | Batch in `communication/bulkUpdatePersonSubscriptions`, `communication/createMessage`, `certificates/batchGenerateCertificates` |
| Unbounded queries | 70 `findMany` without `.limit()`; many in repos | All bounded | Memory exhaustion at scale | P2 | Add `.limit()` + cursor pagination |
| Type cast density | 30 handler `as any` (down from ~290); 1 in association:member (a comment) | <10 | acceptable | low | P3 | Tighten Stripe + JSONB casts |
| Status naming | `removed` aligned | Aligned | none | — | resolved | — |
| Domain events | 65 typed | 50+ | exceeds target | — | resolved | — |
| TypeSpec coverage | 58% (15/25) | 100% | 10 modules without TypeSpec | Drift risk | P3 | Author TypeSpec for advertising, certificates, comms, dues, elections, jobs, marketplace, notifs, person, training, etc. |
| FK indexes | 2 missing (dues-payments idempotencyKey, invite.personId per cycle 3) | All indexed | minor perf | P3 | add indexes |
| CSRF protection | SameSite cookies only | Explicit token | minor | P3 | optional middleware |
| OpenTelemetry tracing | None | Present | observability gap | P3 | add OTel |
| FSM detector tooling | misses backend pg-enum FSMs | full FSM detection | tooling | P3 | extend `oli-codebase-map` |
| Schema-registry hub | 8 handler→schema re-exports in core | promoted to core/ or formalized | architectural | P2 | decide pattern |
| association:member size | 246 files (down from 316) | <100 | maintainability | P3 | continue split per `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` |
| Root-level audit MDs | 7 stale files at repo root | archived | housekeeping | P3 | move to `docs/audits/archive/` |

---

## 15. Inconsistency Report

### 15.0 Critical (Security / Data Integrity)

| ID | Type | Description | Files | Impact |
|---|---|---|---|---|
| IC-01 | Phantom endpoint | 9 FE calls without BE route | per `CODE_API_SURFACE.json` (frontend SDK call sites) | Silent 404s in production |
| IC-02 | State guard not wired | `MEMBERSHIP_VALID_TRANSITIONS` defined but unused | `handlers/association:member/utils/status-transitions.ts:81` (defined), no callers in handlers | Invalid membership status transitions possible (e.g., active→pendingPayment, removed→active) |

### 15.1 Major (Functional Gaps)

| ID | Type | Description | Impact |
|---|---|---|---|
| IC-03 | State guard not wired (booking) | `BOOKING_VALID_TRANSITIONS` defined, no callers | Invalid booking status transitions |
| IC-04 | State guard not wired (invoice) | `INVOICE_VALID_TRANSITIONS` defined, no callers | Invalid invoice transitions |
| IC-05 | Unbounded queries | 70 `findMany` without `.limit()` | Memory / DB load at scale |
| IC-06 | N+1 queries | 3 from cycle 3 not yet batched | Latency at scale |
| IC-07 | Schema-registry inversion | core re-exports 8 handler schemas | Cross-module change can ripple via core |

### 15.2 Minor (Consistency)

| ID | Type | Description | Impact |
|---|---|---|---|
| IC-08 | 3 communication module names | comms vs communication vs communications | Developer confusion (documented in CLAUDE.md, low practical risk) |
| IC-09 | Member identifier fallback | memberNumber vs licenseNumber | low |
| IC-10 | FSM detector gap | codebase-map sees 3 FSMs; reality is 11+ | Map under-reports backend FSMs |
| IC-11 | Root-level audit markdown clutter | 7 legacy audit files at repo root | housekeeping |

### 15.3 Stub & TODO Inventory (Step 13b)

| Stub class | Source | Count |
|---|---|---|
| Runtime 501 stubs in handlers | — | **0** (cycle 3 reported 9 institutional-membership stubs returning 501; now none found via grep — appears the 501 returns were refactored or wrapped) |
| Explicit `Implementation-Status: STUB` comments | `handlers/association:member/recalculateAgingBucket.ts:27` | 1 |
| `throw new Error('not implemented')` | — | **0** in production code |
| `// TODO` / `// FIXME` / `// HACK` markers in src (non-test) | api + memberry + admin | **0** matching the strict prefix `// TODO/FIXME/HACK` per regex (very low) |

Net: cycle 3 reported 9 stubs + 2 TODOs; current is 1 deferred stub + 0 TODOs. **Significant cleanup.**

### 15.4 Type Cast Density (Step 13c)

| Scope | `as any` | `as unknown` | `@ts-ignore` | Severity |
|---|---|---|---|---|
| services/api-ts/src/handlers (all, non-test) | 30 | 0 | 0 | P3 |
| services/api-ts/src/handlers/association:member (non-test) | **1** (a comment fragment) | 0 | 0 | resolved (was 274 in cycle 3) |
| services/api-ts/src/core (non-test) | 2 | 0 | 0 | acceptable |
| apps/memberry/src (non-test) | 246 (most in `routeTree.gen.ts` — generated, plus React mount casts) | low | 3 | P3 (generated file) |

Internal-vs-external split (handler scope):
- External library type gaps (Stripe, Better-Auth, Drizzle enum filter) — ~20 (acceptable)
- JSONB column reads — ~7 (acceptable, no Zod parser yet)
- Internal types — ~3 (justified by comments)

Verdict: **type system integrity recovered**. Cycle 3's 274-cast association handler crisis is over.

### 15.5 Cross-Module Import Audit (Step 13d)

| Source | Target | Type | Severity |
|---|---|---|---|
| core/schema-registry.ts | 8 handler schemas | schema re-export | P2 |
| core/domain-event-consumers.ts | association:member/repos/governance.repo | repo | P2 |
| middleware/officer-auth.ts | association:member/repos/governance.repo | repo | P2 |
| middleware/impersonation-guard.ts | platformadmin/repos/platform-admin.repo | repo | P2 |
| middleware/platform-admin-auth.ts | platformadmin/repos/platform-admin.repo | repo | P2 |
| middleware/org-context.ts | association:member/repos/membership.schema, platformadmin/repos/platform-admin.schema | schema | P2 |

No bi-directional pairs detected. Handler-to-handler clean. Total ~13 inversions (vs 20 in cycle 3).

### 15.6 Cross-Module Raw SQL (Step 13e)

49 files use `sql\`\`` template literals; spot-check shows queries are **scoped to the same module's tables** in nearly all cases. Two intentional cross-module reads:
- `communication/jobs/announcementSend.ts:172` reads `"user"` (Better-Auth user table) — acceptable cross-cutting.
- `membership/repos/membership.repo.ts:131` subquery reads `dues_invoice` — cross-module read into dues. P2 — should use repo interface.

No raw SQL injection risks (all use Drizzle template literals with parameter binding). No type casts in SQL detected beyond the standard `::text`/`::uuid` boundary casts.

### 15.7 Security Audit (OWASP) — Step 10

| OWASP | Status | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS | 4-layer auth, `auth-gate-coverage.test.ts`, owner checks |
| A02 Cryptographic Failures | PASS | Better-Auth bcrypt, PII masking (`maskEmail`) |
| A03 Injection | PASS | Drizzle template literals, Zod, no string-concat SQL detected (49 raw-SQL files audited) |
| A04 Insecure Design | P2 | CSRF on SameSite cookies only — no explicit token |
| A05 Security Misconfiguration | PASS | `hono/secure-headers` (CSP, HSTS, X-Frame-Options), `hono/cors` with origin validator (`middleware/security.ts`) |
| A06 Vulnerable Components | MONITOR | Playwright pinned 1.58.2, no known critical CVEs in lock |
| A07 Authentication Failures | PASS | Account lockout, session limits, MFA disable guard |
| A08 Data Integrity | PASS | Zod, DB constraints |
| A09 Logging & Monitoring | PASS | Pino structured logging, X-Request-ID propagation, audit middleware |
| A10 SSRF | PASS | No user-controlled URL fetching in handlers (grep `0`) |

**One `dangerouslySetInnerHTML` scan returned 0 results in apps — clean.**

### 15.8 Observability Audit (Step 11)

| Area | Status | Notes |
|---|---|---|
| Structured logging | Present | Pino JSON, serializers |
| Correlation IDs | Present | `X-Request-ID` middleware (`middleware/request.ts`), propagated via ctx |
| Metrics | Basic | `core/metrics.ts` exposes Prometheus counters (requests, errors). Missing: latency histograms, DB-call duration. |
| Health checks | Complete | `/livez` (lightweight), `/readyz` (DB + storage + jobs) |
| Distributed tracing | Absent | No OpenTelemetry — P3 |

### 15.9 Performance Anti-Patterns (Step 12)

| Pattern | Count | Severity | Files |
|---|---|---|---|
| Unbounded `findMany` | 70 calls without `.limit()` (broad grep) | P2 | booking, marketplace, person, communication repos primarily |
| Bounded `findMany` (with `.limit()`) | 234 | — | majority of newer repos |
| N+1 queries | 3 from cycle 3 unchanged | P2 | communication × 2, certificates × 1 |
| Sync blocking | 0 | PASS | all handlers async |
| Missing FK indexes | 2 (cycle 3) | P3 | dues-payments `idempotencyKey`, invite `personId` |

---

## 16. Risk Assessment

### P0 — Fix Immediately
**None.** Cycle-3 P0 backlog was empty; no new P0 issues detected this cycle.

### P1 — Fix Before Major New Work
1. **Wire 7 remaining state transition guards** (membership, booking, invoice, training-enrollment, marketplace vendor/listing, email queue, license). The framework is built; only call sites are missing. (~2 days)
2. **Reconcile 9 phantom frontend endpoints** — these will produce silent runtime 404s. Decide per-call: implement, remove FE call, or redirect to existing route. (~half-day)

### P2 — Fix When Touching Module
3. **Batch the 3 known N+1 queries** (communication × 2, certificates × 1).
4. **Add `.limit()` + pagination to unbounded `findMany`** (~70 sites).
5. **Move shared schemas (memberships, platformAdmins, etc.) into `core/`** OR formalize `core/schema-registry.ts` as the cross-cutting hub in ARCHITECTURE.md.
6. **Extract `core/ports/`** for governance.repo, platform-admin.repo dependencies so middleware no longer reaches into handler dirs.
7. **CSRF token middleware** (low-priority — SameSite is already enforced).

### P3 — Improve Later
8. Authoring TypeSpec for 10 remaining handler dirs (advertising, certificates, comms, dues partial, elections, jobs, marketplace, notifs, person partial, training).
9. Continue association:member decomposition.
10. Add missing FK indexes (dues-payments, invite).
11. Add OpenTelemetry.
12. Promote `DATA_GOVERNANCE_DRAFT.md` out of draft state.
13. Archive 7 legacy root-level audit markdowns.
14. Extend `oli-codebase-map` FSM detector to recognise backend pg-enum-based state machines.
15. Tighten the remaining 30 handler-level `as any` (Stripe SDK type gaps + JSONB).

---

## 17. Stabilization Plan

### Fix Immediately (P0)
None.

### Fix Before Major New Work (P1) — CLOSED in Wave G1 (oli-magic/wave-g1, 2026-05-30)
- [x] Wire `isValidMembershipTransition` into all membership-status mutators (3 sites). _(S-G1-01 `189b75db`)_
- [x] Wire `isValidBookingTransition` into booking-status mutators. _(S-G1-02 `98ac4666`)_
- [x] Wire `isValidInvoiceTransition` into invoice-status mutators. _(S-G1-03 `d676c7fa`)_
- [x] Wire remaining guards (training enrollment, marketplace vendor, email queue). _(S-G1-04 `fca2d891`, S-G1-05 `b1b0a865`, S-G1-06 `ae65bb69`)_ Marketplace **listing** guard deferred — no listing mutators exist (documented in S-G1-05).
- [x] Reconcile 9 phantom FE endpoints. _(S-G1-07 `078bd00a`)_

### Fix When Touching Module (P2)
- [ ] Batch the 3 N+1 sites.
- [ ] Add `.limit()` + cursor pagination to unbounded queries.
- [ ] Decide schema-registry strategy (move to core/ or document the inversion).
- [ ] Introduce `core/ports/` for middleware dependencies.
- [ ] Document the 3-name communication split rationale prominently in ARCHITECTURE.md.

### Always: add tests around risky existing behavior BEFORE changing it.

---

## 18. Standards Adoption Plan

### Phase 1: Guardrails — DONE
All root docs present and current.

### Phase 2: Document Current Reality — DONE
22 module specs, 65 typed events, DOMAIN_MODEL aligned to code.

### Phase 3: Stabilize Risky Areas — IN PROGRESS (~90%, Wave G1 closed)
- [x] State-machine framework
- [x] 5 state guards wired
- [x] `as any` collapse (~290 → 30)
- [x] Status naming aligned (`removed`)
- [x] Domain events expanded (3 → 65)
- [x] Core → handler inversions reduced (20 → 13)
- [x] Remaining 6/7 state guards wired (Wave G1; marketplace listing deferred — no mutators)
- [x] 9 phantom endpoints reconciled (Wave G1)
- [ ] N+1 + pagination

### Phase 4: Adopt Standards
- [ ] Author TypeSpec for the 10 remaining handler dirs
- [ ] `core/ports/` formalization
- [ ] Tighten ARCHITECTURE.md to ratify the schema-registry pattern

### Phase 5: Migrate Gradually
- [ ] All hand-wired routes through TypeSpec
- [ ] OpenTelemetry integration
- [ ] Continue association:member decomposition

---

## 19. Recommended First 3 Vertical Slices to Standardize

| Rank | Slice | Module | Why | Risk | Work |
|---|---|---|---|---|---|
| 1 | Wire all 7 remaining state transition guards | membership, booking, dues invoice, training-enrollment, marketplace × 2, email queue | Closes the cycle-3 P1 cleanly with infra already built. Pattern replication, not invention. | Low | 2 days |
| 2 | Reconcile 9 phantom FE endpoints | sdk + memberry + handlers | Eliminates silent 404 risk; pairs FE/BE for the next release. | Low | 0.5 day |
| 3 | Pagination + N+1 batch | booking, marketplace, person, communication | Fixes 70+ unbounded queries and 3 N+1 patterns; establishes conventions in PERFORMANCE.md. | Low-Medium | 1-2 days |

---

## 20. Health Score

| # | Dimension | Score | Δ vs C3 | Notes |
|---|---|---|---|---|
| 1 | Terminology consistency | 8 | +1 | `removed` aligned; 3 comm modules documented |
| 2 | Permission coverage | 9 | 0 | 4-layer auth retained |
| 3 | Business rule clarity | 8 | 0 | BR-tagged tests growing |
| 4 | API consistency | 8 | 0 | TypeSpec 58%; 9 phantom endpoints offset growth |
| 5 | State machine safety | 6 | +3 | Framework built, 5/12 wired (was 0/6) |
| 6 | Error handling uniformity | 8 | 0 | centralized errors module |
| 7 | Backend test coverage | 9 | +1 | 486 handler tests + BR-tagged contracts |
| 8 | Frontend test coverage | 7 | 0 | 127 E2E + 97 component, admin still light |
| 9 | PRD/spec coverage | 10 | 0 | 22 module specs, 23+ top-level docs |
| 10 | UI prototype readiness | 9 | 0 | 19 prototype packs |
| 11 | Architecture alignment | 7 | +1 | 9 schema inversions + 4 mw, down from 20 |
| 12 | Domain model clarity | 9 | +1 | 65 events; aggregates well-typed |
| 13 | Security posture (OWASP) | 9 | 0 | Clean; CSRF still SameSite-only |
| 14 | Observability coverage | 7 | 0 | Pino + req-id + health; OTel absent |
| 15 | Performance health | 6 | 0 | 70 unbounded + 3 N+1 unchanged |
| 16 | Stub density | 10 | 0 | 0 throw-stubs, 1 explicit deferred stub |
| 17 | Type cast density | 9 | +4 | 274 → 1 in association handler |
| 18 | Cross-module coupling | 7 | +1 | 20 → 13 inversions; handler→handler clean |
| 19 | Raw SQL leakage | 9 | -1 | 1 confirmed cross-module SQL subquery (membership → dues_invoice) |
| **Total** | | **156 / 190** | **+15** | |
| **Overall** | | **8.2 / 10** | **+0.8** | |

---

## 21. Final Recommendations

### Do Now
- Wire the 7 remaining transition guards.
- Reconcile the 9 phantom frontend endpoints.

### Do Next
- Batch N+1 + add `.limit()` to unbounded queries (70 sites).
- Decide schema-registry strategy: promote schemas to core/ or formalize the registry pattern.
- Extract `core/ports/` for middleware repo dependencies.

### Do Later
- TypeSpec author remaining 10 handler dirs.
- Add OpenTelemetry.
- Extend `oli-codebase-map` FSM detector to backend pg-enum machines.
- Archive 7 legacy root audit markdowns.
- Continue association:member decomposition.

### Avoid
- Big-bang refactors of association:member.
- Treating the `core/schema-registry.ts` pattern as either obviously-wrong or obviously-right without an explicit ARCHITECTURE.md decision.
- Tightening `as any` in `billing/handleStripeWebhook.ts` until Stripe SDK ships matching types (the casts are documented type-gap workarounds).

---

## Delta Vs Cycle 3 (Summary)

**Resolved since cycle 3:**
- Status mismatch `terminated` vs `REMOVED` → resolved (now `removed`).
- `as any` density in association:member → 274 → 1.
- Core → handler inversions in `core/email.ts`, `core/auth.ts`, `core/notifs.ts`, `core/audit.ts` → cleared.
- Domain events 3 → 65 typed.
- State machine FRAMEWORK absent → built (11 maps, 6 helper functions, unit-tested) and 5 wired.
- TODO/FIXME count → effectively 0 in production source.
- 9 institutional-membership 501 stubs → no longer 501 (refactored).

**New / persistent findings:**
- 7 transition guards defined-but-unused (P1, surgical fix list known).
- 9 phantom frontend endpoints surfaced by codebase-map (P1, new in this run).
- Unbounded `findMany` count rose from "15-20 sampled" (cycle 3 spot-check) to 70 (this run's broader grep) — likely better measurement, not regression.
- `core/schema-registry.ts` as a deliberate inversion hub (P2, may be intentional).
- `oli-codebase-map` FSM detector under-reports backend machines (3 detected vs 11+ actual) — tooling gap.

**Net:** strong forward motion; remediation work is producing measurable health-score gains.

---

*Generated by `/oli-check --discovery` on 2026-05-30 against source commit `9c473e1f`. Compared against `EXISTING_CODEBASE_ADOPTION_AUDIT.cycle_3.md` (2026-05-27). Health score measures code structural quality, not spec compliance or test confidence (run `--compliance` / `--confidence` for those).*
