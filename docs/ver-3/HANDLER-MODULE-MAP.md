# Handler-Module Map

**Version:** 1.0
**Date:** 2026-05-08
**Source:** `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` §4, §10; live codebase scan

Maps the 22 handler directories in `services/api-ts/src/handlers/` to the 19 PRD modules defined in `docs/product/modules/`.

---

## 1. Master Mapping Table

| Handler Dir | PRD Module | TypeSpec | Handlers | Tests | Coverage Notes |
|-------------|-----------|----------|----------|-------|----------------|
| `person` | M01 Auth & Onboarding, M02 Member Profile | Yes (`person.tsp`, `person-custom.tsp`) | 30 | 6 | Central PII hub. Auth handled by Better-Auth (not a handler). |
| `association:member` | M04 Organization Admin, M05 Membership | Yes | 171 | 15 | **MEGA-MODULE** — 39% of all handlers. Covers membership, chapters, officers, positions. |
| `association:operations` | M04 Organization Admin, M14 National Dashboard | Yes | 56 | 2 | Analytics, cross-chapter rollups. Low test coverage. |
| `platformadmin` | M03 Platform Administration | Yes (`platform-admin.tsp`, `platform-admin-custom.tsp`) | 26 | 6 | Admin-tier operations. |
| `membership` | M05 Membership | **No** (hand-wired) | 27 | 16 | Applications, approvals, tiers. No TypeSpec — uses inline route definitions. |
| `dues` | M06 Dues & Payments | **No** (hand-wired) | 32 | 22 | Invoicing, payments, funds. Mixed auth patterns. |
| `billing` | M06 Dues & Payments | Yes (`billing.tsp`) | 23 | 8 | Stripe Connect integration. |
| `invite` | M05 Membership | Yes | 6 | 3 | Org invitations. No orgId param in routes. |
| `communication` | M07 Communications | Yes | 29 | 1 | Templates, queuing. **1 test for 29 handlers.** |
| `communications` | M07 Communications | **No** (hand-wired) | 13 | 6 | Announcements. Overlaps `communication`. |
| `comms` | M07 Communications | Yes (`comms.tsp`) | 13 | 2 | WebSocket: video, chat. Overlaps `communication` + `communications`. |
| `events` | M08 Events | Yes | 21 | 11 | Event management. |
| `training` | M09 Training | **No** (hand-wired) | 19 | 10 | CPD/CE credit tracking. No TypeSpec. |
| `elections` | M12 Elections & Governance | Yes | 13 | 8 | **P0: `castVote` has no input validation.** |
| `documents` | M11 Documents & Credentials | Yes | 16 | 1 | Access-log tracking. **1 test for 16 handlers.** |
| `certificates` | M11 Documents & Credentials | Yes | 6 | 4 | Certificate generation. |
| `storage` | M11 Documents & Credentials | Yes (`storage.tsp`) | 7 | 1 | **P0: `uploadFile` has no MIME allowlist.** |
| `reviews` | Cross-cutting (M05+) | Yes (`reviews.tsp`) | 5 | 1 | NPS review system. |
| `audit` | Cross-cutting (all) | Yes (`audit.tsp`) | 1 | **0** | **P0: compliance-critical module, ZERO tests.** |
| `email` | Cross-cutting (M07+) | Yes (`email.tsp`) | 9 | 1 | **P0: compliance-critical, 1 test for 9 handlers.** |
| `notifs` | Cross-cutting (all) | Yes (`notifs.tsp`, `notifs-custom.tsp`) | 6 | 1 | Multi-channel notifications via OneSignal. |
| `booking` | M08 Events | Yes (`booking.tsp`) | 21 | 6 | Time-based scheduling. |

**Totals:** 22 handler dirs · 549 handler files · 127 test files · 15 TypeSpec source files

---

## 2. PRD Modules Without Dedicated Handlers

These PRD modules have no standalone handler directory. Implementation is either inline, embedded in another handler, or not yet started.

| PRD Module | Status | Where Implemented |
|-----------|--------|-------------------|
| M10 Credit Tracking | **Inline routes in `app.ts`** | Lines 229, 260, 274 — credit entry CRUD + compliance dashboard. No handler dir, no TypeSpec, no tests. |
| M13 Professional Feed | **Not started** | Phase 2 — no handler dir exists. |
| M14 National Dashboard | **Partial** | `association:operations` covers some rollup analytics. No dedicated handler. |
| M15 Job Board | **Not started** | Phase 2 — no handler dir exists. |
| M16 Advertising | **Not started** | Phase 2 — no handler dir exists. |
| M17 Marketplace | **Not started** | Phase 3 — no handler dir exists. |
| M18 Surveys & Polls | **Not started** | Phase 3 — no handler dir exists. |
| M19 Committee Management | **Not started** | Phase 3 — no handler dir exists. |

---

## 3. Handler Dirs Not Directly Mapped to a Single PRD Module

These handler directories serve cross-cutting concerns or map to multiple PRD modules.

| Handler Dir | Serves | Notes |
|-------------|--------|-------|
| `audit` | All modules | Compliance logging. Should be wired into every mutation. |
| `email` | M07 Communications + all transactional | Email queue. Consumed by communications, membership, dues, events. |
| `notifs` | All modules | Push/in-app notifications. Consumed by communications, events, dues. |
| `reviews` | M05 Membership + future | NPS system. Currently membership-adjacent. |
| `booking` | M08 Events | Time-slot scheduling. Could be argued as part of Events or standalone. |

---

## 4. TypeSpec Coverage Gaps

**With TypeSpec (14 handler dirs):** person, association:member, association:operations, platformadmin, invite, billing, communication, comms, events, elections, documents, certificates, storage, booking

**Without TypeSpec — hand-wired routes (4 handler dirs):**

| Handler Dir | Handler Count | Impact |
|-------------|--------------|--------|
| `membership` | 27 | Core module — applications, approvals, categories. No generated validators. |
| `dues` | 32 | Revenue-critical — invoicing, payments, funds. No generated validators. |
| `communications` | 13 | Announcements. Overlaps TypeSpec-covered `communication` module. |
| `training` | 19 | Compliance-critical — CPD/CE tracking. No generated validators. |

**Total hand-wired handler files:** 91 (17% of all handlers bypass the spec-first pipeline)

**Cross-cutting TypeSpec modules with no handler dir:** `provider.tsp`, `patient.tsp`, `emr.tsp` — these are TypeSpec definitions for future healthcare-specific endpoints (no handlers exist yet).

---

## 5. Inline Routes Inventory

Hand-wired routes in `services/api-ts/src/app.ts` that bypass both handler directories and TypeSpec:

| Line | Method | Route | Auth | Module Affinity |
|------|--------|-------|------|-----------------|
| 109 | GET | `/public/org/:slug` | None | M04 Org Admin |
| 115 | GET | `/persons/me/memberships` | `authMiddleware()` | M05 Membership |
| 121 | GET | `/persons/me/credit-summary` | `authMiddleware()` | M10 Credits |
| 136 | GET | `/officer-terms/:orgId` | `authMiddleware()` + `officerAuth()` | M04 Org Admin |
| 177 | GET | `/persons/me/export` | `authMiddleware()` | M02 Profile |
| 183 | POST | `/persons/me/delete` | `authMiddleware()` | M02 Profile |
| 187 | POST | `/persons/me/cancel-delete` | `authMiddleware()` | M02 Profile |
| 193 | POST | `/notifs/read-all` | `authMiddleware()` | Notifs (cross-cutting) |
| 229 | POST | `/persons/me/credit-entries` | `authMiddleware()` | M10 Credits |
| 260 | GET | `/persons/me/credit-entries` | `authMiddleware()` | M10 Credits |
| 274 | GET | `/credit-compliance/:orgId` | `authMiddleware()` + `officerAuth()` | M10 Credits |
| 317 | GET | `/membership/org-profile/:orgId` | `authMiddleware()` | M04 Org Admin |
| 326 | PUT | `/membership/org-profile/:orgId` | `authMiddleware()` + `officerAuth()` | M04 Org Admin |
| 340 | GET | `/membership/members/:orgId` | `authMiddleware()` + `officerAuth()` | M05 Membership |
| 366 | GET | `/membership/applications/:orgId` | `authMiddleware()` + `officerAuth()` | M05 Membership |
| 387 | GET | `/dues/dashboard/:orgId` | `authMiddleware()` + `officerAuth()` | M06 Dues |
| 416 | GET | `/persons/me/officer-role/:orgId` | `authMiddleware()` | M04 Org Admin |
| 422 | GET | `/persons/me/privacy` | `authMiddleware()` | M02 Profile |
| 430 | GET | `/persons/me/notification-preferences` | `authMiddleware()` | Notifs (cross-cutting) |
| 446 | route | `/communications` | (router-level) | M07 Communications |
| 452 | GET | `/admin/me/role` | None (**P1: no auth**) | M03 Platform Admin |

**Total: 21 inline routes** — none have TypeSpec definitions, generated validators, or dedicated test files.

---

## 6. Communications Module Overlap

Three handler directories all serve PRD module M07 (Communications):

| Handler Dir | Purpose | TypeSpec | Handlers | Recommendation |
|-------------|---------|----------|----------|----------------|
| `communication` | Templates, queuing, delivery tracking | Yes | 29 | **Keep** — primary, spec-covered |
| `communications` | Announcements, broadcast messaging | No | 13 | **Merge into `communication`** |
| `comms` | WebSocket: video calls, real-time chat | Yes | 13 | **Keep** — distinct transport (WS vs HTTP) |

**Action needed:** Consolidate `communications` (announcements) into `communication` (templates/queuing). The `comms` module is architecturally distinct (WebSocket transport) and should remain separate.

---

## 7. Test Coverage Summary

| Coverage Tier | Handler Dirs | Details |
|---------------|-------------|---------|
| **Zero tests** | `audit` | Compliance-critical — P0 risk |
| **1 test** | `communication`, `documents`, `email`, `notifs`, `reviews`, `storage` | All have 5-29 handlers with only 1 test file each |
| **2-5 tests** | `association:operations`, `comms`, `certificates`, `invite` | Low but non-zero |
| **6-10 tests** | `person`, `platformadmin`, `booking`, `elections` | Moderate |
| **10+ tests** | `association:member` (15), `membership` (16), `dues` (22), `events` (11), `training` (10) | Best-covered modules |

**Overall test-to-handler ratio:** 127 tests / 549 handlers = **23%** file-level coverage.

---

## 8. Summary Statistics

| Metric | Count |
|--------|-------|
| Handler directories | 22 |
| PRD modules (M01-M19) | 19 |
| Mapped (handler → PRD) | 22/22 |
| Mapped (PRD → handler) | 11/19 (8 not started or inline-only) |
| TypeSpec-covered handler dirs | 14/22 (64%) |
| Hand-wired handler dirs | 4/22 |
| Inline routes in app.ts | 21 |
| Total handler .ts files | 549 |
| Total test files | 127 |
| Test-to-handler ratio | 23% |

---

*Handler-Module Map — Memberry v1.0*
