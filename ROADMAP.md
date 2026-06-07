# Roadmap

> **Active hardening plan:** `~/.claude/plans/whats-good-for-long-crystalline-blum.md`
> (Wave 7 Decomposition Closeout + Wave 8 Coverage Bootstrap).
> Mega-module decomposition (P1-11) **CLOSED** 2026-06-07 via the
> `member-*-cutover` tag series (cert + chapters + credentials + credits
> + directory + dues + governance + membership).
> Landed at `handlers/member/<sub>/` (NOT the SPLIT-PLAN-proposed
> `handlers/association:<sub>/`). See SUPERSEDED banner in
> `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`.

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

### Phase 47a: Institutional Memberships — **BACKEND COMPLETE**

**Backend (DONE 2026-06-07 at `member-membership-cutover`):**
- ✅ DB schema: `institutional_memberships`, `seat_allocations` tables
- ✅ 8 handler implementations (no DeferredScopeError stubs remain).
  Located at `handlers/member/membership/` (createInstitutionalMembership,
  getInstitutionalMembership, listInstitutionalMemberships,
  updateInstitutionalMembership, deleteInstitutionalMembership,
  allocateSeat, listSeatAllocations, revokeSeat)
- ✅ Repository layer + unit tests
- ✅ Hurl contract: `seat-allocation-flow.hurl` (Wave 7 baseline 144/144)

**Frontend (STILL PENDING):**
- ⏳ Wire `requiredCredits` prop from org CPD config API to
  `apps/memberry/src/features/membership/components/member-table.tsx:60`
  (currently defaults to `60` hardcoded). Pass real value from parent route.

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

| Handler | Module | Status | Description |
|---------|--------|--------|-------------|
| ~~`listInstitutionalMemberships`~~ | member/membership | ✅ Done (member-membership-cutover) | List corporate/org memberships |
| ~~`getInstitutionalMembership`~~ | member/membership | ✅ Done | Get single institutional membership |
| ~~`createInstitutionalMembership`~~ | member/membership | ✅ Done | Create multi-seat org membership |
| ~~`updateInstitutionalMembership`~~ | member/membership | ✅ Done | Update institutional membership |
| ~~`deleteInstitutionalMembership`~~ | member/membership | ✅ Done | Delete institutional membership |
| ~~`allocateSeat`~~ | member/membership | ✅ Done | Allocate seat in institutional membership |
| ~~`revokeSeat`~~ | member/membership | ✅ Done | Revoke allocated seat |
| ~~`listSeatAllocations`~~ | member/membership | ✅ Done | List seat allocations |

> All Phase 47a backend scaffolds resolved at `member-membership-cutover`
> (commit `5f0c374d`). When future scaffolds appear: replace
> `DeferredScopeError` throw with real logic, add tests, remove from this
> table.

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

### Domain Module Decomposition — **CLOSED 2026-06-07** (P1-11)

**Status:** ✅ COMPLETE. The `association:member` mega-module has been
decomposed via the `member-*-cutover` tag series. Final landing point
differs from the original SPLIT-PLAN proposal:

| Sub-module (actual) | Path | Cutover Tag |
|---|---|---|
| Member/Certificates | `handlers/member/certificates/` | `member-certificates-cutover` |
| Member/Chapters | `handlers/member/chapters/` | `member-chapters-cutover` |
| Member/Credentials | `handlers/member/credentials/` | `member-credentials-cutover` |
| Member/Credits | `handlers/member/credits/` | `member-credits-cutover` |
| Member/Directory | `handlers/member/directory/` | `member-directory-cutover` |
| Member/Governance | `handlers/member/governance/` | `member-governance-cutover` |
| Member/DuesSpecialAssessments | `handlers/member/duesspecialassessments/` | `member-dues-cutover` |
| Member/Membership | `handlers/member/membership/` | `member-membership-cutover` (FINAL) |

**Residual at `handlers/association:member/`** (intentional cross-domain
leftover, NOT a sub-module): `getOrgDashboard.ts`,
`transitionOfficerTerm.ts`, 3 cross-domain jobs, single-domain utils
(deferred future cleanup), all `repos/*` (canonical per cutover § 4.2),
3 cross-domain integration tests.

**Residual at `handlers/membership/`** (intentional admin-tier surface,
distinct from `handlers/member/membership/`): 4 LIVE legacy handlers
back `/membership/*/{organizationId}` admin routes, repos/membership.repo
(query-rich JOIN/search canonical per CLAUDE.md).

Reference (superseded planning doc): `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`
See SUPERSEDED banner in that file for context.

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
