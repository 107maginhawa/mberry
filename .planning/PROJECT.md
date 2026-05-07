# Memberry

## What This Is

A generic healthcare Association Management System (AMS) built on the Monobase monorepo template. Manages membership, dues, events, training, credits, communications, and governance for healthcare professional associations. Starts with Philippine dental associations, expands to medical and global. Three apps: account (auth/profile), admin (ops dashboard), memberry (product app).

## Core Value

Members can manage their association membership, track continuing education credits, and stay current on dues — from any device, with minimal friction.

## Requirements

### Validated

- ✓ Authentication via Better-Auth (email/password, sessions) — existing
- ✓ Person module (profile management, PII safeguard) — existing
- ✓ Booking module (time-based scheduling, hosts, slots) — existing
- ✓ Billing module (invoice-based payments via Stripe Connect) — partial, schema incomplete
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
- ✓ 33 E2E test files covering member/officer journeys — existing
- ✓ 20 Hurl contract test files — existing
- ✓ SDK with generated React Query hooks — existing

### Active

- [ ] Complete billing schema (10+ TODO fields)
- [ ] Complete audit module (write/capture handlers)
- [ ] Unify dual data models (custom vs TypeSpec-generated schemas)
- [ ] TypeSpec definitions for 6 custom modules
- [ ] Full CI/CD pipeline (build, test, lint, deploy)
- [ ] Account app E2E: auth/profile/setup flows only (boilerplate features excluded — will be replaced)
- [ ] Admin app E2E test coverage
- [ ] Shared component library (deduplicate across apps)
- [ ] Frontend unit tests (vitest + testing-library)
- [ ] Deterministic test data strategy (CI-portable)
- [ ] Complete BR coverage (33/40 → 40/40)

### Out of Scope

- Mobile-native apps — Tauri handles desktop/mobile via webview
- Multi-tenancy SaaS infrastructure — single-tenant per deployment for now
- Payment gateway integration beyond Stripe — deferred
- EMR/health product integrations — AMS is distribution channel, products come later

## Context

- **Brownfield project** — 9 base modules + 6 custom domain modules already implemented
- **Three-app architecture:** account (cloud account — license/activation/storage only; boilerplate features like bookings/billing UI will be replaced), memberry (product), admin (ops)
- **Dual data model problem:** Custom handlers use `organization_id` with one set of status enums; TypeSpec-generated association handlers use `tenant_id/org_id` with different enums. Translation glue exists. Needs unification.
- **Custom modules lack TypeSpec:** dues, membership, events, training, elections, certificates are hand-wired with manual route registration. No auto-generated SDK hooks.
- **CI/CD minimal:** Only contract test workflow in GitHub Actions. No build/test/lint/deploy pipelines.
- **Recent work:** Waves 1-3 on `feature/phase0-foundation` branch — fixing data contracts, adding features (credit reports, payment cards, election filters)

## Constraints

- **Tech stack**: Bun, PostgreSQL, Drizzle ORM, Hono API, TypeSpec, TanStack Router — established, not changing
- **Spec-first**: OpenAPI at `specs/api/dist/openapi/openapi.json` is single source of truth
- **Module pattern**: Router → Validators → Handlers → Repositories (established, follow it)
- **Test-first**: VERTICAL_TDD.md protocol — vertical slices per module, not horizontal layers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Test current dual model, unify later | Safety net needed before migration | — Pending |
| TypeSpec reconciliation after unification | Need canonical schema first | — Pending |
| Generic AMS, not PDA-specific | Expand to medical, nursing, global | ✓ Good |
| AMS as distribution channel for health products | AMS is GTM, not profit center | — Pending |
| Three-app architecture (account/product/admin) | JetBrains/Figma pattern, local-first-ready | ✓ Good |
| Better-Auth for identity | Integrated, not separate module | ✓ Good |
| Consent as JSONB on Person model | Not a standalone module | ✓ Good |

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
*Last updated: 2026-05-06 after initialization*
