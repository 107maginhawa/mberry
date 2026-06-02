<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/m*/MODULE_SPEC.md, docs/product/MODULE_MAP.md, docs/audits/codebase-map (v6) -->
<!-- generated: 2026-06-02T00:00:00Z -->
<!-- code-map-sha: f29971811da966f1d02e8e70c910d92095c65244 (HEAD: 12c32763) -->
<!-- map freshness: STALE-OVERLAP (12 frontend polish files + 7 generated SDK/OpenAPI files differ from map) -->

# Enforcement Coverage Report — Memberry

**Generated:** 2026-06-02T00:00:00Z
**Auditor:** /oli-check --enforcement coverage.md (oli-engine v6 @ f2997181)
**Scope:** 22 modules — 12 in-scope production (m01–m12), 1 in-scope dashboard (m14), 3 backend-only (m20/m21/m22), 6 future-scope stubs (m13/m15/m16/m17/m18/m19)
**Previous audit:** 2026-05-31 (v50 baseline)

---

## Overall Coverage Score: 82%

- **In-scope modules with full code anchors:** 13/13 (m01–m12 + m14)
- **Backend-only zero-anchor modules:** 3 (m20-booking, m21-billing, m22-email) — code present, spec lacks BR/AC/WF/SM anchors; score capped at 7.0 per DEGRADE policy
- **Future-scope module stubs:** 6 (m13, m15, m16, m17, m18, m19) — explicitly out of scope per MASTER_PRD v3.0
- **Weighted score:** 82% — Workflow & API contracts cover 88–92% of declared spec items; dropoffs are in future-scope modules and m20/m21/m22 zero-anchor DEGRADE

---

## Per-Module Coverage Matrix

| Module | Slug | Spec? | Source Dirs | Spec Endpoints | Code Handlers | Coverage | Depth | Breadth | Status |
|--------|------|-------|------------|---------------|---------------|----------|-------|---------|--------|
| m01 | auth-onboarding | YES | `person/`, `onboarding/`, `invite/`, `core/auth.ts` | 9 | 22+ | 100% | FULL | ALL | PASS |
| m02 | member-profile | YES | `person/`, frontend `features/profile/`, `routes/_authenticated/my/` | 10 | 22+ | 95% | FULL | ALL | PASS |
| m03 | platform-admin | YES | `platformadmin/` | 15 | 38 | 90% | FULL | ALL | PASS |
| m04 | org-admin | YES | `association:member/` (mega) | 14 | 84 (mega-module) | 95% | FULL | ALL | PASS |
| m05 | membership | YES | `membership/` + `association:member/` | 9 | 12 + ~30 | 100% | FULL | ALL | PASS |
| m06 | dues-payments | YES | `dues/` + `billing/` + `association:member/` | 11 | 15 + 16 + ~40 | 100% | FULL | ALL | PASS |
| m07 | communications | YES | `communication/` + `comms/` + `email/` + `notifs/` + `communications/` | 9 | 28+11+9+5+8 = 61 | 95% | FULL | ALL | PASS |
| m08 | events | YES | `events/` + `booking/` | 10 | 11 + 19 = 30 | 100% | FULL | ALL | PASS |
| m09 | training | YES | `training/` | 11 | 10 | 95% | FULL | ALL | PASS |
| m10 | credit-tracking | YES | `training/` + `person/` (shared) | 5 | shared | 90% | FULL | ALL | PASS |
| m11 | documents-credentials | YES | `documents/` + `certificates/` + `storage/` | 8 | 15 + 3 + 6 = 24 | 90% | FULL | ALL | PASS |
| m12 | elections-governance | YES | `elections/` + `association:member/` | 8 | 6 + ~13 | 90% | FULL | ALL | PASS |
| m13 | professional-feed | YES | NO SOURCE (future-scope) | 7 | 0 | 70% | PARTIAL | PARTIAL | WARN (future) |
| m14 | national-dashboard | YES | `association:operations/` | 5 | 54 | 85% | FULL | ALL | PASS |
| m15 | job-board | YES | NO SOURCE (future) | 10 | 0 | 60% | PARTIAL | PARTIAL | WARN (future) |
| m16 | advertising | YES | NO SOURCE (future) | 14 | 0 | 50% | SHALLOW | PARTIAL | WARN (future) |
| m17 | marketplace | YES | NO SOURCE (future) | 7 | 0 | 50% | SHALLOW | PARTIAL | WARN (future) |
| m18 | surveys-polls | YES | NO SOURCE (future) | 9 | 0 | 50% | SHALLOW | PARTIAL | WARN (future) |
| m19 | committee-management | YES | NO SOURCE (future) | 12 | 0 | 60% | SHALLOW | PARTIAL | WARN (future) |
| m20 | booking | YES (prose-only) | `booking/` | API_CONTRACTS only (0 BR/AC/WF/SM anchors) | 19 | 75% | PARTIAL | ALL | PASS (DEGRADE) |
| m21 | billing | YES (prose-only) | `billing/` | API_CONTRACTS only | 16 | 75% | PARTIAL | ALL | PASS (DEGRADE) |
| m22 | email | YES (prose-only) | `email/` | API_CONTRACTS only | 9 | 75% | PARTIAL | ALL | PASS (DEGRADE) |

---

## Spec-Artifact Availability per Module

| Module | MODULE_SPEC | API_CONTRACTS | DOMAIN_MODEL refs | WORKFLOW_MAP refs | ROLE_PERMISSION refs | AUDIT_CONTRACTS refs |
|--------|-------------|---------------|-------------------|-------------------|-----------------------|----------------------|
| m01 | YES | YES | YES | YES (WF-001..009) | YES | YES |
| m02 | YES | YES | YES | YES | YES | YES |
| m03 | YES | YES | YES | YES | YES | YES |
| m04 | YES | YES | YES | YES | YES | YES |
| m05 | YES | YES (stub at folder level — see CONSISTENCY_REPORT D2-1) | YES | YES | YES | YES |
| m06 | YES | YES (stub D2-2) | YES | YES (WF-014..025) | YES | YES |
| m07 | YES | YES (stub D2-3) | YES | YES (WF-035..046) | YES | YES |
| m08 | YES | YES (stub D2-4) | YES | YES (WF-061..072) | YES | YES |
| m09 | YES | YES (stub D2-5) | YES | YES (WF-058..064) | YES | YES |
| m10 | YES | YES | YES | YES | YES | YES |
| m11 | YES | YES | YES | YES | YES | YES |
| m12 | YES | YES (stub D2-6) | YES | YES | YES | YES |
| m13 | YES | YES (stub D2-7) | YES | YES | YES | YES |
| m14 | YES | YES (stub D2-8) | YES | YES | YES | YES |
| m15 | YES | YES (stub D2-9) | YES | YES | YES | YES |
| m16 | YES | YES (stub D2-10) | YES | YES | YES | YES |
| m17 | YES | YES (stub D2-11) | YES | YES | YES | YES |
| m18 | YES | YES (stub D2-12) | YES | YES | YES | YES |
| m19 | YES | YES (stub D2-13) | YES | YES | YES | YES |
| m20 | YES (prose) | YES | partial | partial | partial | partial |
| m21 | YES (prose) | YES | partial | partial | partial | partial |
| m22 | YES (prose) | YES | partial | partial | partial | partial |

> 13 of 22 API_CONTRACTS.md files are MEDIUM-severity stubs per `docs/product/CONSISTENCY_REPORT.md` D2-1..D2-13. The stubs are content-incomplete but file-present; they do NOT block enforcement because MODULE_SPEC §10 carries the endpoint declarations and code-side proof is anchored against MODULE_SPEC.

---

## Coverage Score Breakdown

| Dimension | Modules Counted | Average | Weight | Contribution |
|-----------|-----------------|---------|--------|--------------|
| Public API surface | 13 in-scope | 95% | 0.30 | 28.5 |
| Domain entities | 13 in-scope | 92% | 0.20 | 18.4 |
| Workflow implementation | 13 in-scope | 88% | 0.20 | 17.6 |
| State machine enforcement | 13 in-scope | 85% | 0.10 | 8.5 |
| Event publishing | 13 in-scope | 78% | 0.10 | 7.8 |
| Audit logging | 13 in-scope | 100% | 0.05 | 5.0 |
| Domain term consistency | 22 all | 76% | 0.05 | 3.8 |
| **In-scope subtotal** | | | | **89.6** |
| Future-scope drag (6 modules at 50-70%) | 6 | 56% | weighted -7 pt | -7.0 |
| Zero-anchor DEGRADE (3 modules at 75%) | 3 | 75% | weighted -0.5 pt | -0.6 |
| **Overall** | | | | **82.0%** |

---

## Coverage Findings

### EC- Findings (Coverage)

No P0 findings.
No P1 findings.

**P2 (3):**
- `EC-GLOBAL-stub-api-contracts` — 13 API_CONTRACTS.md files are stubs (D2-1..D2-13 in CONSISTENCY_REPORT). Backfill from MODULE_SPEC §10 endpoint lists. NOT blocking — MODULE_SPEC is the authoritative endpoint source for enforcement.
- `EC-M20-zero-anchor` — m20-booking spec is prose-only; no BR/AC/WF/SM identifiers. Score capped at 7.0. Add anchors to lift cap.
- `EC-M21-zero-anchor`, `EC-M22-zero-anchor` — same as above for m21-billing, m22-email.

**P3 (4):**
- `EC-GLOBAL-flat-vs-folder` — 19 legacy single-file specs (`docs/product/modules/m*.md`) coexist with folder specs (`docs/product/modules/m*/MODULE_SPEC.md`). Folder specs are 8–30 days newer; flat files are archival. Document or archive — see D2-15.
- `EC-M03-INFERRED-ImpersonationSession` — m03 ui-prototype references `ImpersonationSession [INFERRED]` not in DOMAIN_MODEL (D2-16).
- `EC-M09-stale-INFERRED` — m09 screens.md has `[INFERRED]` workflow tag but WF-058..064 are assigned in spec §3 (D2-17).
- `EC-BR42-orphan` — BR-42 cataloged in WORKFLOW_MAP but not referenced by any MODULE_SPEC §5 (D2-14).

---

## Module Source-Code Anchor Map

| Module | Primary Handler Dir | Component Source | Routes Source |
|--------|--------------------|--------------------|--------------|
| m01 | `services/api-ts/src/handlers/person/`, `onboarding/`, `invite/`, `core/auth.ts` | `apps/memberry/src/features/onboarding/`, `account/` | `apps/memberry/src/routes/{auth,verify-email,onboarding,join,invite,_authenticated/my/settings}.tsx` |
| m02 | `person/` (shared) | `features/profile/`, `directory/` | `_authenticated/my/profile.tsx`, `directory.tsx`, `directory/$personId.tsx` |
| m03 | `platformadmin/` | `features/admin/` | `apps/admin/src/routes/` |
| m04 | `association:member/`, `association:operations/` | `features/admin/`, `features/chapters/` | `_authenticated/org/$orgSlug/officer/**` |
| m05 | `membership/`, `association:member/` | `features/membership/` | `_authenticated/org/$orgSlug/officer/members.tsx`, `_authenticated/org/$orgSlug/members.tsx` |
| m06 | `dues/`, `billing/`, `association:member/` | `features/dues/`, `features/billing/` | `_authenticated/org/$orgSlug/dues.tsx`, `officer/settings/dues.tsx` |
| m07 | `communication/`, `comms/`, `email/`, `notifs/`, `communications/` | `features/communications/`, `features/comms/`, `features/notifications/` | `_authenticated/org/$orgSlug/announcements/**`, `messages/**`, `my-notifications.tsx` |
| m08 | `events/` | `features/events/` | `_authenticated/org/$orgSlug/events/**`, `officer/events/**`, `discover/events.tsx` |
| m09 | `training/` | `features/training/` | `_authenticated/org/$orgSlug/training/**` |
| m10 | `training/`, `person/` (shared) | `features/training/` (shared) | `my-cpd.tsx`, `officer/credits.tsx` |
| m11 | `documents/`, `certificates/`, `storage/` | `features/documents/`, `features/certificates/` | `documents/**`, `officer/certificates.tsx` |
| m12 | `elections/`, `association:member/` | `features/elections/` | `governance/**`, `officer/elections/**` |
| m13 | none (future) | none | none |
| m14 | `association:operations/` (shared) | `features/dashboard/` | `_authenticated/dashboard.tsx`, `home.tsx` |
| m15 | none (future) | none | none |
| m16 | none (future) | none | none |
| m17 | none (future) | none | none |
| m18 | none (future) | none | none |
| m19 | none (future) | none | none |
| m20 | `booking/` | `features/booking/` | (embedded in events) |
| m21 | `billing/` | `features/billing/` | (embedded in dues) |
| m22 | `email/` | (backend-only) | (backend-only) |

---

## Recommendations

- **Hold the line:** in-scope coverage is healthy (89.6% subtotal). Brownfield graduation criteria already cleared (codebase_health=9.5, spec_compliance=9.5, test_confidence=9.0 per last graduation 2026-05-30).
- **Backfill API_CONTRACTS.md stubs** (13 files, D2-1..D2-13) — cosmetic spec hygiene; lift overall coverage to ~88%.
- **Add anchor IDs to m20/m21/m22 specs** — adds 3 modules to FULL enforcement; lifts overall to ~85%.
- **Defer future-scope modules** — m13/m15/m16/m17/m18/m19 carry a -7pt drag; this is by-design and intentional.

---

*Pipeline: this report is Phase 0 of `/oli-check --enforcement`. It feeds the merge step that produces `ENFORCEMENT_REPORT.md`.*
