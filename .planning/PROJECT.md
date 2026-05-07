# Memberry

## What This Is

A generic healthcare Association Management System (AMS) built on the Monobase monorepo template. Manages membership, dues, events, training, credits, communications, and governance for healthcare professional associations. Starts with Philippine dental associations, expands to medical and global. Three apps: account (auth/profile), admin (ops dashboard), memberry (product app). Shipped v1.0.0 foundation with unified data model, full TypeSpec coverage, shared UI library, and CI/CD pipeline.

## Core Value

Members can manage their association membership, track continuing education credits, and stay current on dues — from any device, with minimal friction.

## Requirements

### Validated

- ✓ Authentication via Better-Auth (email/password, sessions) — existing
- ✓ Person module (profile management, PII safeguard) — existing
- ✓ Booking module (time-based scheduling, hosts, slots) — existing
- ✓ Billing module (invoice-based payments, access controls, void threshold) — v1.0
- ✓ Notifications module (multi-channel via OneSignal) — existing
- ✓ Communications module (chat rooms, WebRTC video) — existing
- ✓ Storage module (file upload/download, S3/MinIO) — existing
- ✓ Email module (transactional, SMTP/Postmark) — existing
- ✓ Reviews module (NPS review system) — existing
- ✓ Membership management (custom handlers) — existing
- ✓ Dues & payments (custom handlers) — existing
- ✓ Events management (custom handlers) — existing
- ✓ Training management (custom handlers) — existing
- ✓ Elections & governance (custom handlers) — existing
- ✓ Certificate management (custom handlers) — existing
- ✓ Member dashboard with role-based views (member/officer) — existing
- ✓ Cadence P2P sync engine (Rust, offline-first) — existing
- ✓ Tauri desktop wrapper (QuickJS embedded API) — existing
- ✓ Global audit middleware with auto-capture — v1.0
- ✓ Unified data model (single canonical schema) — v1.0
- ✓ TypeSpec definitions for all 6 custom modules — v1.0
- ✓ Auto-generated SDK hooks for all modules — v1.0
- ✓ Shared @monobase/ui component library (29 components) — v1.0
- ✓ Full CI/CD: build, test, deploy (Railway + Cloudflare Pages) — v1.0
- ✓ E2E tests across all 3 apps — v1.0
- ✓ Frontend unit tests (Vitest + testing-library) — v1.0
- ✓ Contract test suite (Hurl) — v1.0
- ✓ Pre-commit gate (typecheck + lint-staged) — v1.0
- ✓ Deterministic test fixtures — v1.0

### Active

(None — next milestone requirements TBD via `/gsd-new-milestone`)

### Out of Scope

- Mobile-native apps — Tauri handles desktop/mobile via webview
- Multi-tenancy SaaS infrastructure — single-tenant per deployment for now
- Payment gateway integration beyond Stripe — deferred (PayMongo for v2)
- EMR/health product integrations — AMS is distribution channel, products come later
- Real-time sync (cadence activation) — stub exists, activation deferred to v2

## Context

- **v1.0.0 shipped** — 11 phases, 39 plans, 36 requirements, 1,334 files, 7 days
- **Three-app architecture:** account (cloud account), memberry (product), admin (ops)
- **Unified data model:** Single canonical schema with organizationId (tenant_id eliminated)
- **Full TypeSpec coverage:** All 6 custom modules + 9 base modules have spec definitions
- **Shared UI:** @monobase/ui with 29 components, Ladle preview, used by all 3 apps
- **CI/CD:** GitHub Actions → Railway (API) + Cloudflare Pages (frontends)
- **Test coverage:** E2E (3 apps), unit (Vitest), contract (Hurl), pre-commit gates

## Constraints

- **Tech stack**: Bun, PostgreSQL, Drizzle ORM, Hono API, TypeSpec, TanStack Router — established, not changing
- **Spec-first**: OpenAPI at `specs/api/dist/openapi/openapi.json` is single source of truth
- **Module pattern**: Router → Validators → Handlers → Repositories (established, follow it)
- **Test-first**: VERTICAL_TDD.md protocol — vertical slices per module, not horizontal layers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Test current dual model, unify later | Safety net needed before migration | ✓ Good — unified in Phase 3 |
| TypeSpec reconciliation after unification | Need canonical schema first | ✓ Good — completed in Phase 4 |
| Generic AMS, not PDA-specific | Expand to medical, nursing, global | ✓ Good |
| AMS as distribution channel for health products | AMS is GTM, not profit center | — Pending |
| Three-app architecture (account/product/admin) | JetBrains/Figma pattern, local-first-ready | ✓ Good |
| Better-Auth for identity | Integrated, not separate module | ✓ Good |
| Consent as JSONB on Person model | Not a standalone module | ✓ Good |
| Railway for API, Cloudflare Pages for frontends | Cost-effective, good DX | ✓ Good — wired in Phase 10 |
| Source-level exports for packages/ui | No build step, matches sdk-ts pattern | ✓ Good |
| Supersede Phase 0 plans | Requirements met organically by later phases | ✓ Good — avoided busywork |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-07 after v1.0.0 milestone*
