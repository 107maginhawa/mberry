# UI Journey Audit Report

**Skill:** `/oli-check --journeys` (Phase D, engine-anchored re-run)
**Run date:** 2026-05-31
**Scope:** `apps/memberry/src/` (127 routes), primary persona = regular **MEMBER**; officer/admin secondary.
**Spec inputs:** `docs/product/WORKFLOW_MAP.md` (114 WF-NNN), `docs/product/ROLE_PERMISSION_MATRIX.md` (org roles president→member), `docs/product/UI_BLUEPRINT.md` (per-component state contract), `docs/product/ERROR_TAXONOMY.md`.
**Anchors:** `docs/audits/codebase-map/CODE_ROUTE_MAP.json` (147 routes, 127 in memberry) + `CODE_COMPONENT_REGISTRY.json` (306 memberry components) — **producer: engine** (oli-engine v0.1.0), map **version 5**, sha `82dd56dc`. Map **FRESH** (`map@82dd56dc == HEAD@82dd56dc`). Prior run was STALE (sha `28c42566`); the `(map stale — verify)` tags are **cleared** in this run. THESIS IN FORCE.
**Mode:** static only — `--live` runtime probe deferred to `/oli-check --runtime --live`.
**Confidence threshold:** MEDIUM. `provenance.fields_unavailable: []`.

---

## Changes Since Last Run (vs stale 2026-05-31 / sha 28c42566)

- **Anchor freshness:** prior anchors were 77 source-files stale; this run is HEAD-anchored. All `(map stale — verify)` qualifiers removed.
- **Resolved / reclassified:** 8 `page_component=null` routes prior-flagged as ambiguous are now **confirmed intentional** (3 `<Outlet/>` layout passthroughs, 5 `beforeLoad` redirects) → not findings.
- **Confirmed (re-fired on fresh map):** 4 orphan workflow-bearing modules (M13/M15/M16/M17) still have **zero UI routes**. **Wave 57 ratchet-clear (2026-06-02):** rolled-up J-ORPHAN-001 demoted P1→P3-KNOWN-DEFERRED per MASTER_PRD v3.0 roadmap deferral (post-v1.0 milestone). No code change; orphan UI is intentional descope.
- **New (engine-only signal):** 36 components with `loading_state_hygiene.violation=true` (skeleton present, **no error branch**) → P2 missing-error-state cluster, surfaced because the engine map now exposes `loading_state_hygiene`.
- **Net:** P0 0 (unchanged), P1 0 (Wave 57 ratchet-clear of orphan-module roll-up), P2 cluster reframed around engine `loading_state_hygiene`, P3 4 (orphan-module roll-up + prior 3).

---

## Verdict

**PASS** (Wave 57 ratchet-clear applied)

- **P0 = 0.** No dead API calls; engine reports **0 `interaction_hygiene` violations** across all 306 memberry components (no noop buttons, orphan forms, or empty handlers). The element→action layer is sound.
- **P1 = 0.** The previously-tracked J-ORPHAN-001 roll-up (M13 Community/Feed, M15 Jobs, M16 Advertising, M17 Marketplace/Vendor; ~13 unjourney-able WFs) is **RATCHET-CLEARED to P3-KNOWN-DEFERRED** per MASTER_PRD v3.0 roadmap (Wave 4 post-v1.0 milestone). These four modules are intentional descope, not a defect.
- **P2 = 4 (rolled from 36 component-level instances).** Missing error-branch on data-fetching screens — primary-persona impact is the 6 member/shared screens; the other 30 are officer surfaces.
- **P3 = 4.** Partial-coverage modules (M14 national analytics, M19 committees) collapsed to a single route; advisory only. Plus J-ORPHAN-001 (KNOWN-deferred future modules).

| Severity | Count | Notes |
|----------|-------|-------|
| P0 | 0 | engine: 0 interaction violations, 0 dead API |
| P1 | 0 | J-ORPHAN-001 ratchet-cleared to P3 (Wave 57, KNOWN-DEFERRED per MASTER_PRD v3.0) |
| P2 | 4 | missing error-state cluster (36 components; 6 member/shared-facing) |
| P3 | 4 | partial-coverage modules (M14, M19), Registry 3 contract-match deferred, + J-ORPHAN-001 KNOWN-DEFERRED |
| **unverified** | 0 | `fields_unavailable: []`; fresh anchor, no stale tags |

---

## Audit Scope

- **Framework:** React 19 + TanStack Router v1 (Vite). File-based routing under `apps/memberry/src/routes/`.
- **Routing strategy:** `file-based` (engine `strategy: file-based`). Dynamic `$param` segments present (e.g. `$orgSlug`, `$personId`) — these are parameterized, **not** catch-all wildcards. No `splat`/`*` catch-all → MISSING_ROUTE not auto-suppressed (none found regardless).
- **Auth strategy:** `_authenticated.tsx` layout `beforeLoad` → `requireAuth`; 116 / 127 routes `auth_required: true`. Officer sub-tree gated by `requireOrgOfficer` (`/org/$orgSlug/officer`). Onboarding chain gated by `requireEmailVerified` / `requireNoPerson` / `requirePerson`.
- **Public (unauthenticated) routes:** 10 — `/join`, `/auth/$authView`, `/discover/events`, `/events/$eventSlug`, `/invite/$token`, `/org/$slug`, `/pay/$token`, `/verify/$certificateNumber`, `/verify/$credentialNumber`, `/verify/$token`. All map to a real component.
- **Route surfaces:** 44 member-facing, 65 officer, 10 public, 8 layout/redirect (intentional).
- **Registries activated:** 1 (Action — engine `interaction_hygiene`), 2 (Journey Completion), 4 (Role Journey), 5 (Dead Interaction), 6 (Navigation Integrity), 7 (Exec Summary), 9 (Error-UX — engine `loading_state_hygiene`). **Skipped:** Registry 3 (Element→Action contract match — per-module API_CONTRACTS.md not loaded; covered by `/oli-check --compliance --category contracts`); Registry 8 (Scenario Matrix — folded into Registry 4 role×route below).

---

## Executive Summary (Registry 7)

### Per-Registry Status

| Registry | Status | Findings | Coverage |
|----------|--------|----------|----------|
| 1. Action Registry | ACTIVE | 0 dead handlers | 306 components, 95 with api_calls (188 calls), 106 events_out — engine `interaction_hygiene.violation=0` |
| 2. Journey Completion | ACTIVE | 4 modules KNOWN-DEFERRED (no UI; Wave 57 ratchet-cleared, post-v1.0) | ~94/108 table WFs have ≥partial UI surface |
| 3. Element→Action Binding | SKIPPED | — | API_CONTRACTS.md not loaded (deferred to compliance) |
| 4. Role Journey Completion | ACTIVE | 0 role-gap | member/officer route guards consistent with ROLE_PERMISSION_MATRIX |
| 5. Dead Interaction | ACTIVE | 0 | engine: 0 noop/orphan/empty-handler; 8 comp:null routes all intentional |
| 6. Navigation Integrity | ACTIVE | 0 P1 | all 127 route paths resolve to component or intentional Outlet/redirect |
| 7. Executive Summary | ACTIVE | — | — |
| 9. Error-UX | ACTIVE | 4 (36 instances) | 36 fetch screens lack error branch (skeleton-only) |

### Top 3 Risks

1. **J-ERROR-001 (P2)** — 6 member/shared data screens (MyIdCard, MyTraining, MyCpdDashboard, MemberAnnouncementPage, GovernancePage, OrgTraining) render a skeleton but have **no error branch** — a failed fetch shows a spinner forever or blank, the exact "Action failed" class of UX the error taxonomy guards against.
2. **J-PARTIAL-001 (P3)** — M14 (national analytics) and M19 (committees) collapsed to a single thin route each; the spec's multi-step officer journeys are only partially traceable.
3. **J-ORPHAN-001 (P3, KNOWN-DEFERRED)** — M13/M15/M16/M17 have zero UI routes; their member WFs (browse feed, save jobs, report ad, browse marketplace, etc.) are unreachable. Wave 57 ratchet-clear: per MASTER_PRD v3.0 roadmap, all four modules are descoped to post-v1.0. No build action this cycle.

### Confidence Distribution

| Level | Count | % |
|-------|-------|---|
| High | 8 (orphan-module + comp:null classification — deterministic from route map) | ~73% |
| Medium | 3 (error-state cluster — engine `confidence: MEDIUM`) | ~27% |
| Low | 0 | 0% |

---

## Scan Manifest (mandatory)

- Frontend files inventoried (memberry): 128 route files + 306 registered components.
- Frontend files scanned: all (engine map version 5, `file_count: 1402` repo-wide, full mode).
- Frontend files skipped: 0.
- Interactive signal source: engine `CODE_COMPONENT_REGISTRY` (`interaction_hygiene`, `events_out`, `api_calls`) — 306 memberry components, 95 with API calls (188 calls), 106 events_out.
- Routes verified: 127 memberry (147 total map).
- Dead interaction patterns: engine `interaction_hygiene.violation=true` → **0**.
- Missing-error-state patterns: engine `loading_state_hygiene.violation=true` → **36** components.
- UI-relevant workflows traced: 108/108 table WFs (4 modules BROKEN, 2 partial, rest ≥partial).
- Registries activated: 1, 2, 4, 5, 6, 7, 9. Skipped: 3 (contract-match deferred), 8 (folded into 4).
- Anchor: engine v0.1.0, map v5, sha `82dd56dc` == HEAD — **FRESH**.

---

## Journey Completion Matrix (Registry 2)

| Module | WFs | UI Entry (route) | Completable | Severity |
|--------|-----|------------------|-------------|----------|
| M01 Auth/Onboarding | WF-001..009 | `/join`, `/auth/$authView`, `/onboarding`, `/verify-email`, `/invite/$token` | COMPLETE | — |
| M02 Profile/Settings | WF-010..014 | `/my/profile`, `/my/settings`, `/my/id-card`, `/my/notifications`, `/my/data-export` | COMPLETE | — |
| M03 Platform Admin | WF-015..023 | (admin app — out of memberry scope) | N/A here | — |
| M04 Org Admin | WF-024..028 | `/officer/settings/org`, `/officer/dashboard`, `/org/$slug` | COMPLETE | — |
| M05 Membership | WF-029..037 | `/officer/applications`, `/officer/roster`, `/officer/settings/membership-categories`, `/directory` | COMPLETE | — |
| M06 Dues/Payments | WF-038..045 | `/my/billing`, `/my/payments`, `/pay/$token`, `/officer/finances/*`, `/officer/payments/*` | COMPLETE | — |
| M07 Communications | WF-046..050 | `/officer/communications/*`, `/org/$orgSlug/announcements/*` | COMPLETE | — |
| M08 Events | WF-051..057 | `/discover/events`, `/events/$eventSlug`, `/my/events`, `/officer/events/*` | COMPLETE | — |
| M09 Training | WF-058..064 | `/my/training`, `/org/$orgSlug/training/*`, `/officer/training/*` | COMPLETE | — |
| M10 Credits | WF-065..070 | `/my/credits`, `/my/credits/log`, `/my-cpd`, `/officer/reports/credits`, `/officer/settings/cpd` | COMPLETE | — |
| M11 ID/Certs/Docs | WF-071..075 | `/my/id-card`, `/my/certificates/*`, `/verify/*`, `/officer/documents/*`, `/officer/certificates` | COMPLETE | — |
| M12 Elections | WF-076..079 | `/elections/*`, `/elections/$electionId/vote`, `/officer/elections/*` | COMPLETE | — |
| M13 Community/Feed | WF-080..083 | none | DEFERRED — 0 routes (post-v1.0) | P3 (KNOWN-DEFERRED) |
| M14 National Analytics | WF-084..086 | only `/officer/communications/analytics` (comms-scoped) | PARTIAL | P3 |
| M15 Jobs | WF-087..091 | none | DEFERRED — 0 routes (post-v1.0) | P3 (KNOWN-DEFERRED) |
| M16 Advertising | WF-092..096 | none | DEFERRED — 0 routes (post-v1.0) | P3 (KNOWN-DEFERRED) |
| M17 Marketplace/Vendor | WF-097..099 | none | DEFERRED — 0 routes (post-v1.0) | P3 (KNOWN-DEFERRED) |
| M18 Surveys | WF-100..103 | `/my/surveys/*`, `/officer/surveys/*`, `/officer/reviews` | COMPLETE | — |
| M19 Committees | WF-104..108 | only `/governance/` (single thin route) | PARTIAL | P3 |

---

## Role Journey Completion (Registry 4)

| Role | Surface | Route guard | Conditional render | Completable | Notes |
|------|---------|-------------|--------------------|-------------|-------|
| **member** (primary) | 44 `/my/*` + `/org/$orgSlug/*` (non-officer) | `requireAuth` only | gated correctly | YES | Full member journey reachable; officer tree excluded by `requireOrgOfficer`. |
| officer (president…staff) | 65 `/officer/*` | `requireOrgOfficer` | role-tiered | YES | Officer sub-tree gated at layout; 2FA roles (president/treasurer/secretary) enforced backend-side per matrix. |
| platform admin (super/support/analyst) | admin app | (out of memberry scope) | — | N/A | Audited separately. |

No `BLOCKED_BY_PERMISSION` / `BLOCKED_BY_ROUTE_GUARD` / `BLOCKED_BY_CONDITIONAL_RENDER` found for member or officer within memberry. Role gates align with ROLE_PERMISSION_MATRIX hierarchy.

---

## Dead Interaction Report (Registry 5)

Engine `interaction_hygiene.violation` = **0** across all 306 memberry components → no NOOP_BUTTON / ORPHAN_FORM / EMPTY_HANDLER. No DEAD_API_CALL (188 calls all resolve). 8 routes with `page_component=null` are **not** dead:

| Route | Classification |
|-------|----------------|
| `/officer/communications` | `<Outlet/>` layout passthrough |
| `/officer/payments` | `<Outlet/>` layout passthrough |
| `/officer/roster` | `<Outlet/>` layout passthrough |
| `/officer/dues/assessments` | `beforeLoad` redirect |
| `/officer/dues/member/$memberId` | `beforeLoad` redirect |
| `/officer/dues/treasurer` | `beforeLoad` redirect |
| `/officer/settings/dues` | `beforeLoad` redirect |
| `/officer/settings/funds` | `beforeLoad` redirect |

---

## Navigation Integrity Report (Registry 6)

127 memberry routes; every path resolves to a real component or an intentional Outlet/redirect. No MISSING_ROUTE (no `<Link>`/nav target points to an undeclared path on the fresh map). 116 auth-required routes correctly under `_authenticated` layout. No P1/P2 navigation findings.

---

## Error-UX Audit (Registry 9 — missing error states)

Engine `loading_state_hygiene.violation=true` on **36** data-fetching components: pattern is `has_skeleton:true, has_error_branch:false` — they render a loading skeleton but have **no error branch**, so a failed query leaves an indefinite skeleton or blank screen (the "Action failed / Please try again" class).

**J-ERROR-001 (P2)** — member/shared-facing (primary persona, highest priority):

| ID | Component | File |
|----|-----------|------|
| J-ERROR-001a | MyIdCard | `routes/_authenticated/my/id-card.tsx` |
| J-ERROR-001b | MyTraining | `routes/_authenticated/my/training.tsx` |
| J-ERROR-001c | MyCpdDashboard | `routes/_authenticated/org/$orgSlug/my-cpd.tsx` |
| J-ERROR-001d | MemberAnnouncementPage | `routes/_authenticated/org/$orgSlug/announcements/$announcementId.tsx` |
| J-ERROR-001e | GovernancePage | `routes/_authenticated/org/$orgSlug/governance/index.tsx` |
| J-ERROR-001f | OrgTraining | `routes/_authenticated/org/$orgSlug/training/index.tsx` |

**J-ERROR-001 — RESOLVED in working tree (2026-05-31, pending engine re-scan):** all 6 member screens now render a distinct error branch (`role="alert"`, `bg-[var(--color-error-bg)] text-[var(--color-error)]`, "Unable to load… Please try refreshing the page"), separated from loading/empty states. `id-card.tsx` already shipped its `hasError` branch (audit list was stale on that one — verified per-file, not trusted wholesale); the other 5 (`my/training.tsx`, `my-cpd.tsx`, `announcements/$announcementId.tsx`, `governance/index.tsx`, `training/index.tsx`) were edited this session — error split out of the EmptyState/skeleton fold. Typecheck clean. Engine `loading_state_hygiene.violation` count will drop 36→≤31 after the next working-tree re-scan (changes uncommitted, map still `@82dd56dc`).

**J-ERROR-002 (P2)** — 30 officer-surface components share the same missing-error-branch pattern (OfficerDashboard, OrgSettingsForm, CertificateList/Preview, AnnouncementList, TemplateList, DuesConfigForm, GatewaySetup, PaymentHistoryTable, RecentActivityFeed, SpecialAssessmentsList, ElectionDetail, MemberElectionDetail, NomineePickerDialog, VotingBallot, MemberDetail, NpsTrendChart, SurveyResults, EventDetail(officer), TrainingDetail(officer), AnnouncementDetailPage, AnalyticsDashboardPage, SentHistoryPage, DocumentDetail, FundsPage, PaymentDetailPage, CreditReport, CpdSettings, EditElection, InvoiceDetailPage, + 1 more). Secondary persona — lower priority but same fix (add error branch + taxonomy-coded `toast.error`).

Suggested fix (both): add an `isError`/`error` branch surfacing `err?.code ? \`${err.code}: ${err.message}\` : "Could not load …"` per `docs/product/ERROR_TAXONOMY.md`.

---

## Orphan Modules (Registry 2 detail — P3, KNOWN-DEFERRED)

**J-ORPHAN-001 (P3, KNOWN-DEFERRED)** — spec-vs-build gap, Wave 57 ratchet-cleared (2026-06-02) per MASTER_PRD v3.0 roadmap (post-v1.0 milestone descope):

| Module | WFs blocked | Member-facing intent | UI routes | Status |
|--------|-------------|----------------------|-----------|--------|
| M13 Community/Feed | WF-080..083 (browse feed, create post, moderate, mute) | YES (member browses feed) | 0 | DEFERRED post-v1.0 |
| M15 Jobs | WF-087..091 (browse/save jobs, post, alerts) | YES (member saves jobs) | 0 | DEFERRED post-v1.0 |
| M16 Advertising | WF-092..096 (campaigns, approval, report ad) | partial (member reports ad) | 0 | DEFERRED post-v1.0 |
| M17 Marketplace/Vendor | WF-097..099 (vendor reg, browse marketplace, suspend) | partial (member browses) | 0 | DEFERRED post-v1.0 |

**Wave 57 ratchet-clear rationale:** these are roadmap modules with WORKFLOW_MAP entries but no implementation. MASTER_PRD v3.0 explicitly defers Community/Feed (M13), Jobs (M15), Advertising (M16), and Marketplace/Vendor (M17) to a post-v1.0 milestone (Wave 4 of strategic-upgrade plan). Their unreachable WFs are intentional descope, not a defect. Sibling enforcement-tracking entry: `docs/audits/enforce/.baseline.json` → `deferred_future_modules.ratchet_cleared` (m13-professional-feed, m15-job-board, m16-advertising, m17-marketplace).

---

## What's Next

No P0 → quality gate satisfied (`block_on: P0 dead-API` not tripped). **PASS** after Wave 57 ratchet-clear of J-ORPHAN-001. Recommended:
1. Add error branches to the 6 member/shared screens (J-ERROR-001) first; officer set (J-ERROR-002) next.
2. Run `/oli-check --traceability` (consumes this report) and `/oli-check --compliance --category contracts` to close Registry 3 (Element→Action contract match).
3. When M13/M15/M16/M17 are reactivated (post-v1.0 milestone): scaffold member entry routes; revisit J-ORPHAN-001 classification.

**Pipeline position:** Phase D → `/oli-check --compliance` + `--confidence` + `--journeys` ← YOU ARE HERE → `/oli-check --traceability`.
