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

---

## Planned Work — API Scaffolds

TypeSpec-defined endpoints with generated routes, returning HTTP 501 via `DeferredScopeError`. Frontend does not call any of these. They are scaffolding for future features.

| Handler | Module | Target | Description |
|---------|--------|--------|-------------|
| `listInstitutionalMemberships` | association:member | Wave 2 | List corporate/org memberships |
| `getInstitutionalMembership` | association:member | Wave 2 | Get single institutional membership |
| `createInstitutionalMembership` | association:member | Wave 2 | Create multi-seat org membership |
| `updateInstitutionalMembership` | association:member | Wave 2 | Update institutional membership |
| `deleteInstitutionalMembership` | association:member | Wave 2 | Delete institutional membership |
| `allocateSeat` | association:member | Wave 2 | Allocate seat in institutional membership |
| `revokeSeat` | association:member | Wave 2 | Revoke allocated seat |
| `listSeatAllocations` | association:member | Wave 2 | List seat allocations |

> When implementing: replace `DeferredScopeError` throw with real logic, add tests, remove from this table.

---

## Planned Work — Job Infrastructure

Internal job scheduler stubs. These are NOT HTTP endpoints — they throw inside background job utility functions.

| Location | Description | Target |
|----------|-------------|--------|
| `booking/jobs/index.ts:61` | Slot regeneration with ownerId (needs API redesign) | Wave 2 |
| `booking/jobs/index.ts:64` | Manual job trigger endpoint | Wave 2 |
| `dues/jobs/index.ts:36` | Payment processor webhook settlement | Wave 2 |
| `association:member/jobs/index.ts:32` | Payment processor integration | Wave 2 |

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
| `requiredCredits` | `apps/memberry/src/features/membership/components/member-table.tsx:20` | Hardcoded to 40 | Dynamic from association config API per membership tier |

> Prerequisite: Build association config endpoint that exposes CPD/CE credit requirements.

---

## Structural Refactors

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

33 routes registered directly in `services/api-ts/src/app.ts` instead of via TypeSpec-generated router.

### By Design (12 routes) — keep as-is

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

### Pre-migration (21 routes) — migrate when touching the module

| Route | Module |
|-------|--------|
| GET `/admin/national-dashboard/:associationId` | platformadmin |
| GET `/admin/committees` | platformadmin |
| GET `/admin/committees/:id` | platformadmin |
| POST `/org/:organizationId/payments/send-link` | dues |
| GET `/accredited-providers/:organizationId` | training |
| POST `/accredited-providers/:organizationId` | training |
| PATCH `/accredited-providers/:organizationId/:providerId` | training |
| DELETE `/accredited-providers/:organizationId/:providerId` | training |
| GET `/association/member/cpd-config/:organizationId` | credits |
| PATCH `/association/member/cpd-config/:organizationId` | credits |
| POST `/association/member/credits/manual` | credits |
| GET `/association/member/compliance/:organizationId` | credits |
| POST `/association/member/compliance/:organizationId/refresh` | credits |
| GET `/persons/me/credits` | credits |
| POST `/certificates/bulk-issue` | certificates |
| POST `/association/member/special-assessments` | dues |
| GET `/association/member/special-assessments/:orgId` | dues |
| PUT `/association/member/special-assessments/:id` | dues |
| DELETE `/association/member/special-assessments/:id` | dues |
| POST `/association/member/special-assessments/:id/apply` | dues |
| GET `/association/member/special-assessments/:id/collection` | dues |
| POST `/communications/segments` | communications |
| GET `/communications/segments` | communications |
| DELETE `/communications/segments/:id` | communications |
