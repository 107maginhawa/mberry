# Roadmap

> Single source of truth for all planned work, structural refactors, and migration backlog.
> Bugs are fixed immediately — they don't belong here. This file tracks only **planned work**.

---

## Completed Milestones

| Version | Name | Phases | Shipped |
|---------|------|--------|---------|
| v1.0.0 | Foundation | 0–10 | 2026-05-07 |
| v1.1.0 | Auth & Permission Enforcement | 11–17 | 2026-05-13 |
| v1.2.0 | Pilot Launch | 18–25 | 2026-05-14 |
| v1.3.0 | Test Confidence | 26–33 | 2026-05-15 |
| v1.4.0 | Brownfield Rescue Cycle 1 | 34–37 | 2026-05-20 |
| v1.5.0 | Brownfield Rescue Cycle 2 | 38–45 | 2026-05-20 |
| — | Wave 0a Foundation | Wave 0a | 2026-05-23 |
| — | Wave 0-7 Compliance Audit | Waves 0–7 | 2026-05-24 |
| — | Wave 0b Foundation | Wave 0b | 2026-05-28 |
| — | Waves 1-6 Frontend + Backend | Waves 1–6 | 2026-05-28 |

---

## Active Work

### Phase 47a: Institutional Memberships

**Goal:** Implement multi-seat institutional (corporate/org) memberships — DB schema, repositories, all 8 CRUD + seat-allocation handlers, tests. Wire `requiredCredits` from CPD config API to member-table frontend component.

**Scope:**
- 2 new DB tables: `institutional_memberships`, `seat_allocations`
- 8 handler implementations (replace DeferredScopeError stubs)
- Repository layer + unit tests
- Frontend: wire `requiredCredits` prop from org CPD config API

### Phase 47b: National Dashboard Frontend + Booking Cleanup

**Goal:** Build national dashboard frontend page for cross-chapter aggregate views (BR-36). Resolve 2 remaining booking job stubs.

**Scope:**
- Frontend page + route for national dashboard (backend already exists)
- Auth gate for national admin role
- Booking: fix `triggerSlotGeneration` (ownerId → eventId lookup)
- Booking: TypeSpec route for manual job trigger endpoint

---

## Planned Work — API Scaffolds

TypeSpec-defined endpoints with generated routes, returning HTTP 501 via `DeferredScopeError`. Frontend does not call any of these. They are scaffolding for future features.

| Handler | Module | Target | Description |
|---------|--------|--------|-------------|
| `listInstitutionalMemberships` | association:member | Phase 47a | List corporate/org memberships |
| `getInstitutionalMembership` | association:member | Phase 47a | Get single institutional membership |
| `createInstitutionalMembership` | association:member | Phase 47a | Create multi-seat org membership |
| `updateInstitutionalMembership` | association:member | Phase 47a | Update institutional membership |
| `deleteInstitutionalMembership` | association:member | Phase 47a | Delete institutional membership |
| `allocateSeat` | association:member | Phase 47a | Allocate seat in institutional membership |
| `revokeSeat` | association:member | Phase 47a | Revoke allocated seat |
| `listSeatAllocations` | association:member | Phase 47a | List seat allocations |

> When implementing: replace `DeferredScopeError` throw with real logic, add tests, remove from this table.

---

## Planned Work — Job Infrastructure

Internal job scheduler stubs. These are NOT HTTP endpoints — they throw inside background job utility functions.

| Location | Description | Target |
|----------|-------------|--------|
| `booking/jobs/index.ts:61` | Slot regeneration with ownerId (needs API redesign) | Phase 47b |
| `booking/jobs/index.ts:64` | Manual job trigger endpoint | Phase 47b |
| ~~`dues/jobs/index.ts:36`~~ | ~~Payment processor webhook settlement~~ | ✅ Resolved (Phase 46) |
| ~~`association:member/jobs/index.ts:32`~~ | ~~Payment processor integration~~ | ✅ Resolved (Phase 46) |

---

## Planned Work — Future Modules

Business rules defined but modules not yet built. These are product features, not technical debt.

| BR | Name | Phase | Milestone | Description |
|----|------|-------|-----------|-------------|
| BR-35 | Feed Content Moderation | 2 | M12 | Moderation queue for association feeds |
| BR-36 | National Dashboard Access | 2 | M14 | Cross-chapter aggregate views for national admins |
| BR-37 | Job Posting Expiry | 2 | M15 | 30-day expiry with reminders and extensions |
| BR-38 | Marketplace Referral Disclosure | 2 | M16 | Referral transparency for marketplace listings |
| BR-39 | Committee Dissolution | 3 | M19 | Committee lifecycle completion with data retention |
| BR-40 | Survey Anonymity | 3 | M19 | Anonymous survey response guarantees |

---

## Planned Work — Association Config API

Dynamic configuration per association/tier. Currently hardcoded values.

| Item | Location | Current | Target |
|------|----------|---------|--------|
| `requiredCredits` | `apps/memberry/src/features/membership/components/member-table.tsx:20` | Hardcoded default=60 (API wired in Phase 46) | Phase 47a — wire prop from parent component |

> Prerequisite: Build association config endpoint that exposes CPD/CE credit requirements.

---

## Structural Refactors

### Carry-forwards

**`elections/updateElectionStatus`** — orphan handler. Implemented + tested (24 refs across 5 sibling tests asserting BR-33, transition guards, status-changed event, cancellation cascade) but unwired (no TypeSpec operation, not in `app.ts`). Per-transition successors (`openElectionVoting`, `openElectionNominations`, `certifyElection` in `association:member/`) cover the `votingOpen`/`published`/etc. branches; the `cancelled` branch has no wired path. Build a real `cancelElection` operation when product needs it, then retire `updateElectionStatus` + its dependent tests in one pass. Reference: F5 cleanup, commit 9cc394a5.

### Domain Module Decomposition

The `association:member` handler directory contains ~211 handlers across 7 natural bounded contexts in a single flat directory. This is a structural refactor for DDD alignment — not a bug or debt.

**Current:** 1 directory, ~211 handlers, 7 repo pairs
**Proposed:** 7 domain modules:

| Module | Handlers | Domain |
|--------|----------|--------|
| `association:membership` | ~42 | Core membership lifecycle, institutional, roster |
| `association:dues` | ~42 | Invoicing, payments, dunning, royalties |
| `association:governance` | ~30 | Elections, officers, positions |
| `association:chapter` | ~13 | Chapter affiliations, transfers |
| `association:credentials` | ~17 | Professional credentials, certificates |
| `association:credits` | ~12 | CE/CPD tracking, licenses |
| `association:directory` | ~7 | Member directory, search |

**Status:** Planned, not blocking. Reference: `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`
**Prerequisites:** Route regeneration + update 19 external consumers importing from `association:member/repos/`

---

## TypeSpec Migration Backlog

9 routes registered directly in `services/api-ts/src/app.ts` instead of via TypeSpec-generated router. All are by-design (middleware ordering or public-before-auth requirements).

### By Design (9 routes) — keep as-is

These require specific middleware ordering or must be registered before auth middleware.

| Route | Reason |
|-------|--------|
| GET `/public/orgs` | Public, no auth |
| GET `/og/events/:slug` | Public OG meta for crawlers |
| GET `/association/member/credentials/lookup/:credentialNumber` | Public credential lookup |
| GET `/certificates/verify/:certificateNumber` | Public certificate verification |
| GET `/pay/:token/validate` | Public payment token (before auth) |
| POST `/pay/:token/checkout` | Public payment checkout |
| GET `/email/unsubscribe` | RFC 8058 — must be before email auth |
| POST `/email/unsubscribe` | RFC 8058 — must be before email auth |
| GET `/email/suppressions` | Must be after email auth (ordering) |

Note: auth routes (via `registerAuthRoutes`) and WebSocket routes (via `registerWebSocketRoutes`) are separate registration functions, not counted here.

### Pre-migration — COMPLETE

All 24 pre-migration routes migrated to TypeSpec:
- **Cycle 8:** accredited-providers (4), cpd-config (2), credits/manual (1), compliance (2), persons/me/credits (1) — 10 routes
- **Phase 35:** admin/national-dashboard + committees (3), send-link (1), special-assessments (6), bulk-issue (1), segments (3) — 14 routes

Original ROADMAP listed 21 routes; actual count was 24 (3 communications/segments routes added post-inventory).
