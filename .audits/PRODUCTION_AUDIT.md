# Production-Readiness Audit

Source: `/Users/elad-mini/Desktop/memberry/.understand-anything/knowledge-graph.json` (3474 nodes, 8259 edges, 11 layers, commit `0178b7c`).

## Step 1 — Docs source-of-truth ✅

### Doc sets identified

| Set | Purpose | Status |
|---|---|---|
| `docs/product/` | OLI-generated PRD set — 20 cross-cutting docs + 22 module specs (m01-m22) | **CANON** |
| `docs/execution/` | Active slice plans (VERTICAL_SLICE, WAVE0B-WAVE3A, slices/<feature>/) | **CANON** |
| `docs/ver-3/` | UX-by-role iteration (109 screens by `auth/member/officer/org-member/platform-admin/public`) + business rules | **DECIDE** — overlaps `product/modules/*/ui-prototype/` |
| `services/api-ts/docs/` | Backend dev guides (AUTH, BILLING, EMAILS, NOTIFS, REALTIME, VIDEO) | **CANON** |
| `specs/api/` + `specs/api/src/modules/*.md` | Contract docs around TypeSpec | **CANON** |
| Root `.md` (README, CLAUDE, CONTRIBUTING, ARCHITECTURE, ROADMAP, QUICKSTART, VERTICAL_TDD, CHANGELOG) | Top-level guides | **CANON** |
| `docs/audits/`, `docs/superpowers/`, `docs/checklists/`, `docs/frameworks/`, `docs/templates/`, `docs/trace/` | OLI process byproducts (COMPLIANCE_*, ENFORCEMENT_*, CONFIDENCE_*, WAVE*_REPORT, UI-REVIEW-batchN, etc.) | **ARCHIVED** → `docs/_archive/oli/` |
| 8 `docs/product/` root reports (CONSISTENCY_REPORT, PRD_AUDIT_REPORT, SPEC_COVERAGE_REPORT, SPEC_REVIEW, SPEC_REVIEW_PATCHES, TRACE_AUDIT_REPORT, TRACE_MATRIX, UI_AUDIT_REPORT) | OLI process output | **ARCHIVED** → `docs/_archive/oli/product/` |
| Root `AUDIT_04_FILE_COVERAGE.txt` | Ad-hoc audit output | **ARCHIVED** |

**Total archived: 321 files** via `git mv` (history preserved).

### Code ↔ spec module mismatches (P1)

27 code handler dirs vs 22 product spec modules.

| Spec module | Code module | Status |
|---|---|---|
| m01-auth-onboarding | `onboarding/`, `invite/`, Better-Auth integration | Multi-dir owner |
| m02-member-profile | `person/` | Partial — also covers org-scoped PII |
| m03-platform-admin | `platformadmin/` | ✅ |
| m04-org-admin | `association:operations/` | Naming drift |
| m05-membership | `membership/` + `association:member/` | **Split across two code dirs** |
| m06-dues-payments | `dues/` | ✅ |
| m07-communications | `comms/` + `communication/` + `communications/` | **3 code dirs for 1 spec** |
| m08-events | `events/` | ✅ |
| m09-training | (no code dir — absorbed into `association:member/`) | **Spec lies** |
| m10-credit-tracking | (absorbed into `association:member/`) | **Spec lies** |
| m11-documents-credentials | `documents/` + (credentials in `association:member/`) | Split |
| m12-elections-governance | `elections/` + (in `association:member/`) | Split |
| m13-professional-feed | (no code) | **Spec orphan** |
| m14-national-dashboard | FE only (`apps/admin/national-dashboard/`) | FE only |
| m15-job-board | (no code) | **Spec orphan** |
| m16-advertising | `advertising/` | ✅ |
| m17-marketplace | `marketplace/` | ✅ |
| m18-surveys-polls | `surveys/` | ✅ |
| m19-committee-management | (in `association:member/`) | **Inside mega-module** |
| m20-booking | `booking/` | ✅ |
| m21-billing | `billing/` | ✅ |
| m22-email | `email/` | ✅ |

**Code modules with no spec:** `association:operations`, `audit`, `certificates`, `default`, `jobs`, `notifs`, `reviews`, `storage`

### Actions to follow (deferred — not done yet)

- [ ] Update `docs/product/MODULE_MAP.md` to reflect 5 spec→code split patterns
- [ ] Update CLAUDE.md handler module section (currently claims 25 modules in 22 well-defined ones)
- [ ] Decide: merge `docs/ver-3/ux/screens/` into `docs/product/modules/<mNN>/ui-prototype/` or archive ver-3
- [ ] Drop or build m13-professional-feed and m15-job-board

---

## Step 2 — Module-level duplication ✅

### P0 — 20 split-brain handlers

Same handler file basename exists in TWO modules with different implementations. Pre-Phase-35 (old `elections/`, `events/`, etc.) vs post-Phase-35 (in `association:member/`, `association:operations/`). Old files survived migration as dead code.

| Pair | Count | Examples |
|---|---|---|
| `association:member` ↔ `elections` | 5 | createElection, certifyElection, deleteElection, getElection, listElections |
| `association:operations` ↔ `events` | 4 | cancelEvent, createEvent, getEvent, updateEvent |
| `association:member` ↔ `certificates` | 3 | bulkIssueCertificates, getCertificate, verifyCertificatePublic |
| `association:member` ↔ `dues` | 3 | getDuesDashboard, getDuesMemberSummary, getDuesMetrics |
| `communication` ↔ `surveys` | 3 | createSurvey, listSurveys, submitSurveyResponse |
| `association:member` ↔ `person` | 1 | getMyOfficerRole |
| `association:operations` ↔ `platformadmin` | 1 | getCommittee |

**Concrete evidence — `createElection` pair:**
- `elections/createElection.ts` (57 LOC, raw Context, hand-rolled officer check)
- `association:member/createElection.ts` (75 LOC, ValidatedContext, requirePosition util, OpenAPI operationId)

**app.ts import count:**
- `association:member/`: 17 hand-wired (of 248 files; 231 served via generated routes)
- `association:operations/`: 1 hand-wired
- Old standalone: ~10 hand-wired (by-design exceptions: verifyCertificatePublic, deleteElection, serveEventOgMeta)

### P1 — Mega-module confirmed

`association:member/` = 248 files (CLAUDE.md says 157 — stale). 6.2× next-biggest. Owns m05+m10+m11+m12+m19 + parts of m04+m08. Split deferred per `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` — should re-prioritize.

### P1 — CLAUDE.md inaccuracies

- Claims 3 comms modules (`comms`+`communication`+`communications`); filesystem has 2 — `communications/` doesn't exist
- Claims `association:member` has 157 handlers; now 248
- Claims `training/` standalone module with 10 handlers; doesn't exist — absorbed into `association:member`

### Actions to follow

- [ ] Audit + delete dead duplicate (the 20 pairs) — grep generated route registry per file, delete unimported version
- [ ] Re-prioritize mega-module split (60% larger than planned)
- [ ] Fix CLAUDE.md (training, comms-2-not-3, 248-not-157)

---

## Step 3 — Naming consistency ✅

### Strong baseline
- Repo class suffix: 92/92 `*Repository` ✅
- Handler verbs core: get(113)+list(91)+create(70)+update(68)+delete(45) = 387 / ~520 = 74% CRUD ✅
- FE component casing: 208/212 kebab-case ✅

### P1 — Semantic duplicates (hidden from exact-basename match)
- `notifs/markAllNotificationsAsRead.ts` + `notifs/markAllNotificationsRead.ts` — both exist, both have tests, same module, identical intent
- `membership/addMember.ts` + `association:member/createMembership.ts` — pre/post Phase-35
- `membership/upsertCategory.ts` + `association:member/upsertMembershipCategory.ts` — pre/post Phase-35

### P2 — Verb drift
- `add` (3) vs `create` (70): addRosterMember, addMember, addTicketComment
- `register` (3) vs `create`: registerForEvent etc.
- `submit` (3) vs `create`: submitPaymentProof, submitSurveyResponse
- `mark` (6) vs `set` (3) for state flips

### P2 — Hook file casing split (apps/memberry/src/hooks)
- kebab (12): use-detect-timezone, use-format-date, use-chat-websocket, use-video-call, use-unread-counts, use-pending-nps, use-survey-draft, use-spring-transition, use-detect-country, use-detect-language, use-mutation-feedback, use-media-stream
- camel (4): useOrg, useOrgContext, useMyOrgs, useFinancialStanding

### Actions
- [ ] Resolve `markAllNotifications(As)Read` collision
- [ ] Rename 4 camelCase hooks to kebab-case
- [ ] Standardize `add/register/submit` → `create` OR document exception in CLAUDE.md
- [ ] Audit semantic-dup candidates in `add/submit/register/mark/set` for hidden pre/post-Phase-35 pairs

---

## Step 4 — God objects + coupling ✅

### Healthy framework hubs (leave alone)
| File | Fan-in | Reason |
|---|---|---|
| `core/database.ts` | 568 | Drizzle handle |
| `types/app.ts` | 481 | Hono Context augmentation |
| `core/errors.ts` | 478 | Error classes |
| `types/auth.ts` | 147 | Session type |
| `core/domain-events.ts` | 77 | Event bus |
| FE `motion/glass-card.tsx` | 105 | UI primitive |
| FE `patterns/page-shell.tsx` | 98 | Layout |
| FE `hooks/useOrg.ts` | 74 | Org context |
| FE `lib/api.ts` | 69 | SDK client |

### P1 — Antipattern hubs (refactor to middleware/decorator)
- `utils/audit.ts` (231 importers) — every handler hand-calls `auditAction`. Move to Hono middleware with route metadata.
- `utils/officer-check.ts` (112) — every officer-gated handler imports `requirePosition`. Middleware factory bound to route.
- `utils/position-titles.ts` (96) — wide blast radius for renames.

### P1 — Correctness risk
- `handlers/person/accountDeletionCascade.ts` imports 20 schemas to cascade delete. New schema = silent miss. Convert to `personDeleted` domain event with per-module subscriber.

---

## Step 5 — Boundary violations ✅

### Excellent
- FE → BE internals: **0** (perfect SDK boundary)
- Handler → handler cross-module: **2** (both `notifs/notification-triggers.ts` helper)

### P2 — Cross-module schema reads: 125
Drizzle joins need both schemas. Indicates coupling:
- `association:member/*` → `person/repos/person.schema.ts` (8+)
- `association:member/*` → `platformadmin/repos/platform-admin.schema.ts` (6+)
- `association:member/*` → `association:operations/repos/events.schema.ts` (4+)
- `association:member/*` → `association:operations/repos/training.schema.ts`

Mega-module split plan must define data ownership without breaking these joins.

---

## Step 6 — Spec↔code drift ✅

### Healthy contract pipeline
- 455 operations / 313 paths / 24 tags
- TypeSpec organized as top-level modules + `association/core/*.tsp` (9 sub-specs: engagement, fee-schedule, reporting, primitives, consent, communication, documents, staff, scheduling, billing) + `association/integration/*.tsp`
- Generated registry intact (`routes.ts`, `types.ts`, `validators.ts`, `registry.ts`)

### P0 — Abandoned healthcare TSPs
- `specs/api/src/modules/patient.tsp` — `Patient` model defined, **0 operations reference**
- `specs/api/src/modules/provider.tsp` — `Provider`, `ProviderType` enum defined, **0 operations reference**
- Project explicitly chose person-centric (code comment in `comms/repos/comms.schema.ts:20`). Delete.

### P1 — Stale `*-custom.tsp`
- `dues-custom.tsp`, `membership-custom.tsp`, `notifs-custom.tsp`, `person-custom.tsp`, `platform-admin-custom.tsp`
- Convention unclear. Verify purpose; document or delete.

### P2 — Tag/code count mismatches
| Tag | Ops | Handlers | Note |
|---|---|---|---|
| Association:Member | 169 | ~100 | After de-dup expected ≈100 |
| Membership | 4 | 18 | Likely old standalone — confirm Step 2 duplicates |
| Events | 2 | 18 | Most under `Association:Operations` tag |

### Actions
- [ ] Delete `patient.tsp` + `provider.tsp`
- [ ] Audit `*-custom.tsp` files (purpose or delete)
- [ ] Confirm `membership/` module handlers are duplicates of `association:member/`

---

## Execution log

### P0.1 — resolved 18 of 20 split-brain pairs (commit 0cf8c37e..)
- Deleted 16 dead handlers + 13 paired tests (-2563 LOC) — each independently verified absent from generated registry + app.ts.
- Restored 2 false positives flagged as duplicates that are real impls behind one-line re-export shims in the TypeSpec namespace:
  - `certificates/bulkIssueCertificates.ts` (shimmed via `association:member/bulkIssueCertificates.ts`)
  - `association:operations/getCommittee.ts` (shimmed via `platformadmin/getCommittee.ts`)
- 2 pairs deferred (both register but coexist functionally):
  - **deleteElection** — `elections/deleteElection.ts` hand-wired in `app.ts:527` overrides the `association:member/deleteElection.ts` TypeSpec route at the same path; both physically exist but Hono's later-binding-wins means only the hand-wired one serves. Follow-up: pick one path, retire other.
  - **verifyCertificatePublic** — TypeSpec route uses the namespace shim `association:member/verifyCertificatePublic.ts` (one-line re-export) → impl in `certificates/verifyCertificatePublic.ts`; `app.ts:349` hand-wires the same impl at a friendlier `/certificates/verify/:certificateNumber` path. Dual-routing, single impl, no conflict.

### P0.2 — done (commit 0cf8c37e)
Deleted `specs/api/src/modules/patient.tsp` + `provider.tsp` orphan healthcare TSPs. Regenerated validators.ts.

### P0.3 — done (commit 528b3e77)
Deleted older `notifs/markAllNotificationsRead.ts` + test + `notifs-custom.tsp`. Kept `markAllNotificationsAsRead.ts`. Updated shared notifs handler test.

---

## Consolidated Production-Readiness Punch List

### P0 — Block ship
1. Resolve 20 split-brain handler pairs (delete dead version each pair)
2. Delete orphan healthcare TSPs (`patient.tsp`, `provider.tsp`)
3. Resolve `notifs/markAllNotificationsAsRead.ts` + `markAllNotificationsRead.ts` (same module, identical intent, both tested)

### P1 — Before scale
4. Re-prioritize `association:member` split (now 248 files, 60% bigger than v1.2 plan)
5. Move audit + officer-check to middleware (cuts 343 import sites)
6. Convert `accountDeletionCascade` to event-driven per-module subscribers
7. Update CLAUDE.md (training absorbed, 248-not-157, communications dir absent)
8. Audit `*-custom.tsp` purpose
9. Decide ver-3 UX merge into product/modules/*/ui-prototype/ or archive

### P2 — Quality polish
10. Standardize hook file casing (kebab everywhere)
11. Standardize verb prefixes (`add/submit/register` → `create` where applicable)
12. Audit/wire-or-archive orphan spec modules m13-professional-feed, m15-job-board

### P3 — Already healthy
- FE↔BE boundary clean
- Repo class suffix consistent
- Handler-to-handler boundary clean
- TypeSpec → OpenAPI → SDK pipeline working



