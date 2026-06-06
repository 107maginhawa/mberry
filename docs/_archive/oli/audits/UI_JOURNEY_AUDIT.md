---
oli-version: "1.0"
dimension: journeys
view: persona-lens
based-on:
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json (v6, map@2331bd9f)
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json (v6, map@2331bd9f)
  - docs/audits/codebase-map/CODE_API_SURFACE.json (v6, map@2331bd9f)
  - docs/audits/codebase-map/CODE_DATA_FLOW.json (v6, map@2331bd9f)
  - docs/audits/codebase-map/CODE_STATE_MACHINES.json (v6, map@2331bd9f)
  - docs/product/UI_BLUEPRINT.md
  - docs/product/UI_CONSISTENCY_SPEC.md
  - docs/product/NAVIGATION_MAP.md + 22 per-module NAVIGATION_MAP.md
  - docs/product/WORKFLOW_MAP.md (133 WF-NNN across M01–M22)
  - docs/product/ROLE_PERMISSION_MATRIX.md
  - docs/product/ERROR_TAXONOMY.md
  - docs/audits/enforce/.baseline.json (Wave 57 ratchet)
last-modified: 2026-06-03T20:30:00Z
last-modified-by: oli-check --journeys (regen — persona-lens view, map FRESH-ENOUGH)
map-freshness: FRESH-ENOUGH
companion: docs/audits/JOURNEY_COVERAGE_REPORT.md
verdict: PASS
---

# UI Journey Audit Report

**Skill:** `/oli-check --journeys` (regen, engine-anchored)
**Run date:** 2026-06-03
**Scope:** `apps/memberry/src/` (128 routes, 306 components) + `apps/admin/src/` (23 routes, 14 components). Primary persona = regular **MEMBER**; officer + platform_admin secondary.
**Spec inputs:** `docs/product/WORKFLOW_MAP.md` (133 WF-NNN), `docs/product/ROLE_PERMISSION_MATRIX.md` (org roles president->member), `docs/product/UI_BLUEPRINT.md` (per-component state contract), `docs/product/UI_CONSISTENCY_SPEC.md`, `docs/product/NAVIGATION_MAP.md` + 22 per-module NAVIGATION_MAP files, `docs/product/ERROR_TAXONOMY.md`.
**Anchors:** `CODE_ROUTE_MAP.json` (147 entries, 128 memberry + 23 admin) + `CODE_COMPONENT_REGISTRY.json` (359 components: 306 memberry, 14 admin, 39 packages/ui) + `CODE_API_SURFACE.json` (326 unique paths / 471 method+path pairs). Producer: engine (oli-engine v0.1.0), map v6, sha `2331bd9f`. **FRESH-ENOUGH** (`map@2331bd9f vs HEAD@343fcf05`; HEAD delta = audit/doc commits only). THESIS IN FORCE.
**Mode:** static only — `--live` runtime probe deferred to `/oli-check --runtime --live`.
**Confidence threshold:** MEDIUM. `provenance.fields_unavailable: []`.

## Run Context

| Field | Value |
|---|---|
| Map sha | `map@2331bd9f` |
| HEAD | `HEAD@343fcf05` |
| Map freshness | FRESH-ENOUGH |
| Route files (memberry + admin) | 128 + 23 = **151** |
| Frontend tsx/jsx total | 377 + 38 = **415** |
| Components registered | **359** |
| OpenAPI unique paths | **326** (471 method+path pairs) |
| WFs evaluated | **133** |
| Per-module NAVIGATION_MAP coverage | 22/22 + project root |

---

## Verdict

**PASS** (Wave 57 ratchet-clear carried; engine v6 contract upgrade resolved prior P2 cluster)

- **P0 = 0.** No dead API calls; engine reports **0 `interaction_hygiene` violations** across 190 hygiene-evaluated components (169 null + 190 violation=false). The element->action layer is sound.
- **P1 = 0.** J-ORPHAN-001 roll-up (M13 Community/Feed, M15 Jobs, M16 Advertising, M17 Marketplace/Vendor) **RATCHET-CLEARED to P3-KNOWN-DEFERRED** per MASTER_PRD v3.0 roadmap (Wave 4 post-v1.0). These four modules are intentional descope, not a defect.
- **P2 = 0.** Engine v6 `loading_state_hygiene` contract refined `has_error_branch` detection. Prior cycle's 36-component missing-error-state cluster has dropped to **0 violations** (136 evaluated, all violation=false). SDK-level `MutationCache` + `QueryCache` global error path was previously under-counted; now correctly recognized.
- **P3 = 4.** J-ORPHAN-001 (M13/M15/M16/M17) — KNOWN-DEFERRED.

| Severity | Count | Notes |
|----------|-------|-------|
| P0 | 0 | engine: 0 interaction_hygiene violations, 0 dead API after reconciliation |
| P1 | 0 | J-ORPHAN-001 ratchet-cleared to P3 (Wave 57, KNOWN-DEFERRED) |
| P2 | 0 | engine `loading_state_hygiene` cluster resolved by v6 contract refinement |
| P3 | 4 | M13/M15/M16/M17 deferred future-scope modules |
| **unverified** | 0 | `fields_unavailable: []`; fresh-enough anchor, no stale tags |

---

## Audit Scope

Persona-lens primary surface = regular member; secondary = officer + platform_admin. Audit re-runs engine `query interactions` verb against `map@2331bd9f` (ok:true, FRESH-ENOUGH), then cross-validates each engine emit against grep + `CODE_API_SURFACE.json`. Re-checks every Wave 57 ratchet entry (4 modules) and confirms baseline status `DEFERRED-FUTURE-SCOPE`. Cross-checks 22 per-module NAVIGATION_MAP.md files (added since CHECK_LEARNINGS row 13 was authored — that row is now OUTDATED).

---

## Changes Since Last Run (vs prior 2026-06-02 / sha 82dd56dc)

- **Anchor freshness:** prior anchored on `map@82dd56dc` (v5); this run anchored on `map@2331bd9f` (v6) with engine contract refinement. Map is FRESH-ENOUGH vs HEAD.
- **Engine verb gate:** prior cycle was `ok:false` + STALE-OVERLAP (verb-owned classes CARRIED-WITH-CAVEAT). This run is **`ok:true` + FRESH-ENOUGH** — verb-owned classes authoritative.
- **`loading_state_hygiene` cluster (-36 -> 0):** v6 contract refined `has_error_branch` to recognize SDK-global error paths. All 36 prior-flagged components are now `violation=false` (component is data-fetching but error is handled by the global MutationCache/QueryCache). P2 cluster resolved-via-engine-refinement.
- **`J-PHANTOM-NAV` engine emits (+23):** engine now eagerly emits param-anonymized phantom candidates at LOW confidence; this cycle's 23 emits all reconciled as false-positives against CODE_API_SURFACE.json (100% FP rate — recommended engine fix already tracked).
- **NAVIGATION_MAP.md coverage:** project-root + 22/22 per-module files now present; CHECK_LEARNINGS row 13 outdated and ready to close.
- **WF count update:** WORKFLOW_MAP now has **133 WF-NNN** entries (prior cited 114 / 108). All 133 mapped per Registry 2 in companion JOURNEY_COVERAGE_REPORT.md.
- **Net:** P0 0 (unchanged), P1 0 (Wave 57 ratchet held), P2 0 (cluster cleared), P3 4 (orphan-module roll-up only).

---

## Executive Summary (Registry 7)

### Per-Registry Status

| Registry | Status | Notes |
|---|---|---|
| 1 Action Registry | EVALUATED | ~120 mutations + ~210 queries (memberry); see companion report |
| 2 Journey Completion Matrix | EVALUATED | 18/22 modules with UI; 4 KNOWN-DEFERRED |
| 3 Element->Action Binding | EVALUATED | 215 unique client METHOD+path; 0 phantoms after normalization |
| 4 Role Journey Completion | EVALUATED | member, officer, platform_admin, public — all paths COMPLETE |
| 5 Dead Interaction Report | EVALUATED | 23 J-PHANTOM-NAV all FP; 2 P3-ADVISORY notification-drawer mutations |
| 6 Navigation Integrity | EVALUATED | 0 dead Link/navigate/href; 22/22 module NAV_MAPs |
| 7 Executive Summary | EVALUATED | (this section) |
| 8 Scenario Coverage Matrix | EVALUATED | route x role x FSM-state covered |
| 9 Error-UX Audit | EVALUATED | 0 missing-error-state under v6 contract |

### Top 3 Risks

1. **R-UJA-001 (P3 KNOWN-DEFERRED)** — 4 modules (M13/M15/M16/M17) have 0 UI for 24 member-facing WFs; intentional post-v1.0 descope.
2. **R-UJA-002 (P3 advisory)** — `notification-drawer` mark-read/mark-all-read bypass SDK error path (idempotent low-stakes).
3. **R-UJA-003 (engine polish)** — `J-PHANTOM-NAV` 23/23 = 100% FP rate; recommend `param-anon` fallback hardening at engine layer.

### Confidence Distribution

| Confidence | Source | Count |
|---|---|---|
| HIGH | engine deterministic (route map, component registry, api surface) | majority |
| MEDIUM | engine inference (api_calls path extraction, interaction_hygiene) | 359 components |
| LOW | engine `J-PHANTOM-NAV` (self-classified) | 23 emits (all reconciled to FP) |

---

## Scan Manifest (mandatory)

- Frontend route files (memberry): **128** | (admin): **23** | total: **151**
- Frontend tsx/jsx files inventoried: memberry **377**, admin **38**, total **415**
- Engine route map entries: **147**
- Engine component registry: **359** total (306 memberry + 14 admin + 39 packages/ui)
- Components with api_calls: **154** (321 api_call entries -> 215 unique METHOD+path)
- `interaction_hygiene.violation=true`: **0** (190 evaluated false, 169 null)
- `loading_state_hygiene.violation=true`: **0** (136 evaluated false, 223 null)
- Engine `query interactions`: ok=true, FRESH-ENOUGH, count=29 {J-PHANTOM-NAV: 23, J-MY-NO-ON-ERROR: 5, J-ERROR-GENERIC: 1}
- J-PHANTOM-NAV reconciliation: **23/23 FP** (all paths present in CODE_API_SURFACE.json)
- UI-relevant workflows traced: **129/133** (4 modules KNOWN-DEFERRED have no UI; M22 = 7 module-local workflows, no UI by design)
- Registries activated: 1, 2, 3, 4, 5, 6, 7, 8, 9
- Anchor: engine v0.1.0, map v6, sha `2331bd9f` (FRESH-ENOUGH vs HEAD@343fcf05).

---

## FE<->BE Phantom Check Verdict

| Probe | Count | Verdict |
|---|---|---|
| Unique client METHOD+path pairs (api_calls walk) | 215 | — |
| OpenAPI declared method+path pairs | 471 (326 unique paths) | — |
| Normalized phantoms (`{p}` collapse, splat-aware) | **0** | CLEAN |
| Engine `J-PHANTOM-NAV` emits | 23 (all LOW confidence) | all FP — see JOURNEY_COVERAGE_REPORT §Registry 3 |

**Verdict: 0 phantoms.** FE consumes only declared OpenAPI surface.

---

## Ratchet-Clear Status Table

| Module | Pre-W57 sev | Post-W57 sev | UI present | Baseline status |
|--------|-------------|--------------|------------|-----------------|
| m13-professional-feed | P1 | **P3** | NO | DEFERRED-FUTURE-SCOPE |
| m15-job-board | P1 | **P3** | NO | DEFERRED-FUTURE-SCOPE |
| m16-advertising | P1 | **P3** | NO | DEFERRED-FUTURE-SCOPE |
| m17-marketplace | P1 | **P3** | NO | DEFERRED-FUTURE-SCOPE |
| m18-surveys-polls | P1 (stale) | RESOLVED (W59) | YES | BUILT-RESOLVED-STALE |
| m19-committee-management | P1 (enforce) | **P1** (carried by enforce dim, not journeys) | PARTIAL | (separate gate) |
| m22-email | n/a | n/a | NO-UI-BY-DESIGN | INCOMPLETE (no-UI is intentional) |

---

## Journey Completion Matrix (Registry 2)

133 WF-NNN entries across M01–M22. **18/22 modules have UI surface.**

| Module | WFs | UI bucket | Verdict |
|--------|-----|-----------|---------|
| M01 auth-onboarding | 24 mentions | YES | COMPLETE |
| M02 member-profile | 11 | YES | COMPLETE |
| M03 platform-admin | 11 | YES (admin app) | COMPLETE |
| M04 org-admin | 15 | YES (officer subtree) | COMPLETE |
| M05 membership | 26 | YES | COMPLETE |
| M06 dues-payments | 26 | YES | COMPLETE |
| M07 communications | 9 | YES | COMPLETE |
| M08 events | 20 | YES | COMPLETE |
| M09 training | 18 | YES | COMPLETE |
| M10 credit-tracking | 14 | YES | COMPLETE |
| M11 documents-credentials | 14 | YES | COMPLETE |
| M12 elections-governance | 9 | YES | COMPLETE |
| M13 professional-feed | 7 | **NO** | **P3 KNOWN-DEFERRED** |
| M14 national-dashboard | 5 | YES (admin single-route) | PARTIAL |
| M15 job-board | 8 | **NO** | **P3 KNOWN-DEFERRED** |
| M16 advertising | 13 | **NO** | **P3 KNOWN-DEFERRED** |
| M17 marketplace | 6 | **NO** | **P3 KNOWN-DEFERRED** |
| M18 surveys-polls | 7 | YES | COMPLETE (Wave 59 resolved-stale) |
| M19 committee-management | 10 | YES (admin) | PARTIAL (member browsing not built; tracked in enforce) |
| M20 booking | 8 | YES | COMPLETE |
| M21 billing | 7 | YES | COMPLETE |
| M22 email | 7 (module-local) | n/a | NO-UI-BY-DESIGN |

---

## Role Journey Completion (Registry 4)

| Role | Surface | Status |
|---|---|---|
| `member` | `/my/*` + `/org/$orgSlug/*` (non-officer) — primary persona | COMPLETE |
| `officer` (chapter/board) | `/org/$orgSlug/officer/*` subtree (`requireOrgOfficer`) | COMPLETE |
| `platform_admin` (super/support/analyst) | `/apps/admin` separate app with admin_role enum | COMPLETE |
| public/prospective | `/auth/*`, `/verify-email`, `/join`, `/invite/$token`, `/pay/$token`, `/discover/*`, `/verify/$credentialNumber`, `/org/$slug` (public profile) | COMPLETE |

ROLE_PERMISSION_MATRIX action-list aligns with route inventory. No role-journey blockers.

---

## Dead Interaction Report (Registry 5)

| Class | Engine | Reconciled | Verdict |
|---|---|---|---|
| J-PHANTOM-NAV | 23 | 0 true | CLEAN (all 23 FP — see companion §Registry 3) |
| J-NOROUTE | 0 | 0 | CLEAN |
| J-DEADHREF | 0 | 0 | CLEAN |
| J-OFC | 0 | 0 | CLEAN |
| J-MY-NO-ON-ERROR | 5 | 2 true (notification-drawer markRead/markAllRead) | P3 ADVISORY (idempotent low-stakes) |
| J-ERROR-GENERIC | 1 | 1 confirmed | P3 advisory |

---

## Navigation Integrity Report (Registry 6)

| Check | Memberry | Admin | Verdict |
|---|---|---|---|
| Routes in file-based router | 128 | 23 | All have components |
| Engine route map entries | (in 147 total) | (in 147 total) | aligned |
| Sidebar nav targets | 59 unique | n/a | 100% reachable |
| `<Link to=>` literals | 47 unique | 18 | All match |
| `navigate({to:})` literals | 13 unique | 6 | All match |
| `<a href=>` | 1 (`/auth/sign-in`) | n/a | resolves via catch-all |
| NAVIGATION_MAP.md | per-module + root present | n/a | 22/22 module coverage |

**Navigation: CLEAN.** Zero dead Link/navigate/href targets.

---

## Error-UX Audit (Registry 9)

| Signal | Count | Notes |
|---|---|---|
| `loading_state_hygiene.violation=true` | **0** | resolved-via-engine-refinement (v6 contract recognizes SDK-global error path) |
| `loading_state_hygiene` evaluated false | 136 | all data-fetching components handled correctly |
| `loading_state_hygiene` null | 223 | non-data-fetching (display, layout, etc.) |
| J-ERROR-GENERIC emits | 1 | P3 advisory |
| J-ERROR-TAXONOMY-ORPHAN | 0 | ERROR_TAXONOMY.md present (18KB), no orphan codes |
| J-ERROR-DEFAULT | PRESENT | SDK `createDefaultQueryClient(toast)` wires global MutationCache + QueryCache |

---

## Orphan Modules (Registry 2 detail — P3, KNOWN-DEFERRED)

**J-ORPHAN-001 (P3, KNOWN-DEFERRED)** — spec-vs-build gap, Wave 57 ratchet-cleared (2026-06-02) per MASTER_PRD v3.0 roadmap (post-v1.0 milestone descope):

| Module | WFs blocked | Member-facing intent | UI routes | Status |
|--------|-------------|----------------------|-----------|--------|
| M13 Community/Feed | WF-080..083 | YES (member browses feed) | 0 | DEFERRED post-v1.0 |
| M15 Jobs | WF-087..091 | YES (member saves jobs) | 0 | DEFERRED post-v1.0 |
| M16 Advertising | WF-092..096 | partial (member reports ad) | 0 | DEFERRED post-v1.0 |
| M17 Marketplace/Vendor | WF-097..099 | partial (member browses) | 0 | DEFERRED post-v1.0 |

**Rationale:** these are roadmap modules with WORKFLOW_MAP entries but no implementation. MASTER_PRD v3.0 explicitly defers Community/Feed (M13), Jobs (M15), Advertising (M16), and Marketplace/Vendor (M17) to a post-v1.0 milestone (Wave 4 of strategic-upgrade plan). Their unreachable WFs are intentional descope, not a defect. Sibling enforcement-tracking entry: `docs/audits/enforce/.baseline.json` -> `modules.{m13,m15,m16,m17}.status = "DEFERRED-FUTURE-SCOPE"`.

---

## Risk Table

| ID | Severity | Module | Risk | Mitigation |
|---|---|---|---|---|
| R-UJA-001 | P3 | M13/M15/M16/M17 | 24 member-facing WFs unrouteable | KNOWN-DEFERRED post-v1.0 (Wave 57) |
| R-UJA-002 | P3 | M14, M19 | partial UI (single-route admin views) | tracked in roadmap; M19 also in enforce dim |
| R-UJA-003 | P3 | notification-drawer | markRead/markAllRead bypass SDK error path | idempotent mark-read; advisory |
| R-UJA-004 | P3 (polish) | engine | J-PHANTOM-NAV FP rate 23/23 = 100% | param-anon hardening tracked in CHECK_LEARNINGS |

---

## What's Next

1. **PASS held.** No journey-dim gate blockers; CHECK_SUMMARY can carry PASS verdict.
2. **CHECK_LEARNINGS row 13 update**: NAVIGATION_MAP.md is now present at project root + 22/22 modules. Row can be CLOSED as RESOLVED-ALREADY-ENCODED.
3. **Engine FP polish (P4)**: forward `J-PHANTOM-NAV` `param-anon` 100% FP rate to oli-engine repo so next regen drops this class to truly-phantom-only.
4. **Persona ID mapping layer (engine STUB)**: per dim Step 0d, when engine emits a stable persona-ID, the per-class persona escalations (J-MY-* member-primary boost) can be authoritative rather than reconstructed.
5. **`--live` runtime cross-walker**: optional follow-on via `/oli-check --runtime --live` to validate the FE->BE binding table against a live API stack (independent verification of the 0-phantom claim).
