<!-- oli-version: 1.1 -->
<!-- based-on: map@3f0dae76 -->
<!-- based-on-detail: docs/product/modules/m*/MODULE_SPEC.md, docs/product/MODULE_MAP.md, docs/audits/codebase-map (v6 @ 3f0dae76) -->
<!-- generated: 2026-06-03T21:15:00Z -->
<!-- last-modified: 2026-06-03T21:15:00Z -->
<!-- last-modified-by: /oli-check --regenerate-dim-reports --auto (Wave 60 rev2: re-anchor vs map@3f0dae76; doc-only delta since prior rewrite) -->
<!-- code-map-sha: 3f0dae76f2ef67248b04fcf16c97f87404df1702 -->
<!-- map freshness: FRESH (HEAD 3f0dae76 matches map git_sha; map captured 2026-06-03T08:13:02Z) -->

# Enforcement Coverage Report — Memberry

**Generated:** 2026-06-03T21:15:00Z
**Auditor:** `/oli-check --enforcement coverage.md` (oli-engine v6 @ 3f0dae76)
**Scope:** 22 modules — 13 in-scope production (m01–m12 + m14), 1 BUILT-RESOLVED-STALE (m18), 3 backend-only DEGRADE (m20/m21/m22), 4 DEFERRED-FUTURE-SCOPE (m13/m15/m16/m17), 1 KNOWN-future CARRIED (m19)
**Previous audit:** 2026-06-02 (v53 baseline; Wave 57/58/59 applied)

---

## Run Context

| Field | Value |
|-------|-------|
| Sub-check | `~/.claude/skills/oli-check/dimensions/enforcement/coverage.md` (Phase 0) |
| HEAD | 3f0dae76 |
| Map SHA | 3f0dae76 (1408 files) |
| Map freshness | FRESH (HEAD == map sha) |
| Module count | 22 |
| Computation | Spec-depth + spec-breadth + cross-reference integrity (per `coverage.md` §2–§5) |

---

## Overall Coverage Score: 82%

- **In-scope modules with full code anchors:** 13/13 (m01–m12 + m14)
- **BUILT-RESOLVED-STALE (Wave 59):** 1 — m18-surveys-polls now covered (22 handlers + 13 tests + 10 TypeSpec ops parked under `services/api-ts/src/handlers/communication/`)
- **Backend-only zero-anchor modules:** 3 (m20-booking, m21-billing, m22-email) — code present, spec lacks BR/AC/WF/SM anchors; score capped at 7.0 per DEGRADE policy
- **Future-scope module stubs (DEFERRED-FUTURE-SCOPE, Wave 57 ratchet-clear):** 4 — m13, m15, m16, m17 (descoped in MASTER_PRD v3.0)
- **KNOWN-future CARRIED:** 1 — m19-committee-management (Add-on Phase 3, in-scope per MASTER_PRD v3.0 roadmap but not yet built — sole P1 driver `EM-M19-future01`)
- **Weighted score:** **82%** — unchanged vs v53 (no source mutation since baseline)

---

## Per-Module Coverage Matrix

| Module | Slug | Spec? | Source Dirs | Spec Endpoints | Code Handlers | Coverage | Depth | Breadth | Status |
|--------|------|-------|------------|---------------|---------------|----------|-------|---------|--------|
| m01 | auth-onboarding | YES | `person/`, `onboarding/`, `invite/`, `core/auth.ts` | 9 | 22+ | 100% | FULL | ALL | PASS |
| m02 | member-profile | YES | `person/`, frontend `features/profile/`, `routes/_authenticated/my/` | 10 | 22+ | 95% | FULL | ALL | PASS |
| m03 | platform-admin | YES | `platformadmin/` | 15 | 38 | 90% | FULL | ALL | PASS |
| m04 | org-admin | YES | `association:member/` (mega-module) | 14 | 84 | 90% | FULL | ALL | PASS |
| m05 | membership | YES | `membership/`, `association:member/` subset | 12 | 12 | 95% | FULL | ALL | PASS |
| m06 | dues-payments | YES | `dues/`, `association:member/` subset | 15 | 15 | 90% | FULL | ALL | PASS |
| m07 | communications | YES | `communication/` (24 ops), `communications/` (7 announcements), `comms/` (11 RT), `email/`, `notifs/` | 31 audited + 8 announcements | 28 + 8 | 90% | FULL | ALL | PASS |
| m08 | events | YES | `association:operations/`, `booking/` | 11 + 19 booking | 30 | 88% | FULL | ALL | PASS |
| m09 | training | YES | `training/`, `association:member/` (completeTrainingEnrollment) | 10 | 10 | 85% | FULL | ALL | PASS |
| m10 | credit-tracking | YES | `association:member/` (credit subset) | 8 | 8 | 88% | FULL | ALL | PASS |
| m11 | documents-credentials | YES | `documents/`, `certificates/` | 18 | 18 | 95% | FULL | ALL | PASS |
| m12 | elections-governance | YES | `elections/` + `association:member/` | 8 | 6 + ~13 | 90% | FULL | ALL | PASS |
| m13 | professional-feed | YES | (5 parked stubs under `handlers/communication/` — `createFeedPost`, `deleteFeedPost`, `getFeedPost`, `listFeedPosts`, `reportFeedPost`) | 7 | 5 stubs | 70% | PARTIAL | PARTIAL | DEFERRED-FUTURE-SCOPE |
| m14 | national-dashboard | YES | `association:operations/` | 5 | 54 | 85% | FULL | ALL | PASS |
| m15 | job-board | YES | NO SOURCE (future) | 10 | 0 | 60% | PARTIAL | PARTIAL | DEFERRED-FUTURE-SCOPE |
| m16 | advertising | YES | NO SOURCE (future) | 14 | 0 | 50% | SHALLOW | PARTIAL | DEFERRED-FUTURE-SCOPE |
| m17 | marketplace | YES | NO SOURCE (future) | 7 | 0 | 50% | SHALLOW | PARTIAL | DEFERRED-FUTURE-SCOPE |
| m18 | surveys-polls | YES | `handlers/communication/` (parked: `createSurvey`, `createPoll`, `votePoll`, `listSurveys`, `getSurveyResults`, `submitSurveyResponse`, `dismissSurveyResponse` + 15 more = 22 handlers + 13 tests + 10 TypeSpec ops) | 10 | 22 | 90% | FULL | ALL | PASS (BUILT-RESOLVED-STALE Wave 59 — score 2.0→8.5) |
| m19 | committee-management | YES | NO SOURCE (KNOWN-future) | 12 | 0 | 60% | SHALLOW | PARTIAL | KNOWN-future (CARRIED — MASTER_PRD v3.0 Add-on Phase 3) |
| m20 | booking | YES (prose-only) | `booking/` | API_CONTRACTS only (0 BR/AC/WF/SM anchors) | 19 | 75% | PARTIAL | ALL | PASS (DEGRADE cap 7.0) |
| m21 | billing | YES (prose-only) | `billing/` | API_CONTRACTS only | 16 | 75% | PARTIAL | ALL | PASS (DEGRADE cap 7.0) |
| m22 | email | YES (prose-only) | `email/` | API_CONTRACTS only | 9 | 75% | PARTIAL | ALL | PASS (DEGRADE cap 7.0) |

---

## Spec-Artifact Availability per Module

| Module | MODULE_SPEC | API_CONTRACTS | DOMAIN_MODEL refs | WORKFLOW_MAP refs | ROLE_PERMISSION refs | AUDIT_CONTRACTS refs |
|--------|-------------|---------------|-------------------|-------------------|-----------------------|----------------------|
| m01 | YES | YES | YES | YES (WF-001..009) | YES | YES |
| m02 | YES | YES | YES | YES (WF-010..020) | YES | YES |
| m03 | YES | YES | YES | YES (WF-021..035) | YES | YES |
| m04 | YES | YES | YES | YES (WF-036..049) | YES | YES |
| m05 | YES | YES | YES | YES (WF-050..061) | YES | YES |
| m06 | YES | YES (stub D2-1) | YES | YES (WF-062..076) | YES | YES |
| m07 | YES | YES (stub D2-2) | YES | YES (WF-077..107) | YES | YES |
| m08 | YES | YES (stub D2-3) | YES | YES (WF-108..118) | YES | YES |
| m09 | YES | YES (stub D2-4) | YES | YES (WF-058..064) | YES | YES |
| m10 | YES | YES (stub D2-5) | YES | YES | YES | YES |
| m11 | YES | YES (stub D2-6) | YES | YES | YES | YES |
| m12 | YES | YES (stub D2-7) | YES | YES | YES | YES |
| m13 | YES | YES (stub D2-8) | YES | YES | YES | YES |
| m14 | YES | YES (stub D2-9) | YES | YES | YES | YES |
| m15 | YES | YES (stub D2-10) | YES | YES | YES | YES |
| m16 | YES | YES (stub D2-11) | YES | YES | YES | YES |
| m17 | YES | YES (stub D2-12) | YES | YES | YES | YES |
| m18 | YES | YES (stub D2-13) | YES | YES | YES | YES |
| m19 | YES | YES | YES | YES | YES | YES |
| m20 | YES (prose) | YES | partial | partial | partial | partial |
| m21 | YES (prose) | YES | partial | partial | partial | partial |
| m22 | YES (prose) | YES | partial | partial | partial | partial |

> 13 of 22 API_CONTRACTS.md files are MEDIUM-severity stubs per `docs/product/CONSISTENCY_REPORT.md` D2-1..D2-13. The stubs are content-incomplete but file-present; they do NOT block enforcement because MODULE_SPEC §10 carries the endpoint declarations and code-side proof is anchored against MODULE_SPEC. Wave 58 reclassified the 13 D2-* findings to RESOLVED-FALSE-POSITIVE in the consistency dimension (regex blind to backtick-wrapped paths in detailed format).

---

## Coverage Score Breakdown

| Dimension | Modules Counted | Average | Weight | Contribution |
|-----------|-----------------|---------|--------|--------------|
| Public API surface | 13 in-scope + m18 | 95% | 0.30 | 28.5 |
| Domain entities | 13 in-scope + m18 | 92% | 0.20 | 18.4 |
| Workflow implementation | 13 in-scope + m18 | 88% | 0.20 | 17.6 |
| State machine enforcement | 13 in-scope + m18 | 85% | 0.10 | 8.5 |
| Event publishing | 13 in-scope + m18 | 78% | 0.10 | 7.8 |
| Audit logging | 13 in-scope + m18 | 100% | 0.05 | 5.0 |
| Domain term consistency | 22 all | 76% | 0.05 | 3.8 |
| **In-scope subtotal** | | | | **89.6** |
| Future-scope drag (m13/m15/m16/m17/m19 at 50–70%) | 5 | 58% | weighted −7.0 pt | −7.0 |
| Zero-anchor DEGRADE (m20/m21/m22 at 75%) | 3 | 75% | weighted −0.6 pt | −0.6 |
| **Overall** | | | | **82.0%** |

> Score unchanged vs v53 — no source mutation since baseline. m18 promotion from future-scope drag to in-scope subtotal was applied in v53 (Wave 59) and carries forward.

---

## Coverage Findings

### EC- Findings (Coverage)

**No P0 findings.**
**No P1 findings.**

**P2 (4):**

| ID | Finding | Module | Confidence |
|----|---------|--------|------------|
| `EC-GLOBAL-stub-api-contracts` | 13 API_CONTRACTS.md files are stubs (D2-1..D2-13 in CONSISTENCY_REPORT). Backfill from MODULE_SPEC §10 endpoint lists. NOT blocking — MODULE_SPEC is the authoritative endpoint source for enforcement. Wave 58 reclassified the 13 D2 findings RESOLVED-FALSE-POSITIVE in the consistency dimension. | GLOBAL | MEDIUM |
| `EC-M20-zero-anchor` | m20-booking spec is prose-only; no BR/AC/WF/SM identifiers. Score capped at 7.0. Add anchors to lift cap. | m20-booking | HIGH |
| `EC-M21-zero-anchor` | m21-billing spec is prose-only; no BR/AC/WF/SM identifiers. Score capped at 7.0. | m21-billing | HIGH |
| `EC-M22-zero-anchor` | m22-email spec is prose-only; no BR/AC/WF/SM identifiers. Score capped at 7.0. | m22-email | HIGH |

**P3 (4):**

| ID | Finding | Module | Confidence |
|----|---------|--------|------------|
| `EC-GLOBAL-flat-vs-folder` | 19 legacy single-file specs (`docs/product/modules/m*.md`) coexist with folder specs (`docs/product/modules/m*/MODULE_SPEC.md`). Folder specs are 8–30 days newer; flat files are archival. Document or archive — see D2-15. | GLOBAL | HIGH |
| `EC-M03-INFERRED-ImpersonationSession` | m03 ui-prototype references `ImpersonationSession [INFERRED]` not in DOMAIN_MODEL (D2-16). | m03-platform-admin | MEDIUM |
| `EC-M09-stale-INFERRED` | m09 screens.md has `[INFERRED]` workflow tag but WF-058..064 are assigned in spec §3 (D2-17). | m09-training | MEDIUM |
| `EC-BR42-orphan` | BR-42 cataloged in WORKFLOW_MAP but not referenced by any MODULE_SPEC §5 (D2-14). | GLOBAL | MEDIUM |

---

## Module Source-Code Anchor Map

| Module | Primary Handler Dir | Component Source | Routes Source |
|--------|--------------------|--------------------|--------------|
| m01 | `services/api-ts/src/handlers/person/`, `onboarding/`, `invite/`, `core/auth.ts` | `apps/memberry/src/features/onboarding/`, `account/` | `apps/memberry/src/routes/_auth/`, `_authenticated/` |
| m02 | `services/api-ts/src/handlers/person/` | `apps/memberry/src/features/profile/`, `id-card/` | `apps/memberry/src/routes/_authenticated/my/` |
| m03 | `services/api-ts/src/handlers/platformadmin/` | `apps/admin/src/features/platform/` | `apps/admin/src/routes/platform/` |
| m04 | `services/api-ts/src/handlers/association:member/` (mega-module) | `apps/admin/src/features/members/`, `apps/memberry/src/features/officer/` | `apps/admin/src/routes/members/`, `apps/memberry/src/routes/_authenticated/officer/` |
| m05 | `services/api-ts/src/handlers/membership/`, `association:member/` | `apps/memberry/src/features/membership/` | `apps/memberry/src/routes/_authenticated/membership/` |
| m06 | `services/api-ts/src/handlers/dues/`, `association:member/` | `apps/memberry/src/features/dues/`, `payments/` | `apps/memberry/src/routes/_authenticated/dues/`, `payments/` |
| m07 | `services/api-ts/src/handlers/communication/`, `communications/`, `comms/`, `email/`, `notifs/` | `apps/memberry/src/features/announcements/`, `comms/` | `apps/memberry/src/routes/_authenticated/announcements/`, `comms/` |
| m08 | `services/api-ts/src/handlers/association:operations/`, `booking/` | `apps/memberry/src/features/events/` | `apps/memberry/src/routes/_authenticated/events/` |
| m09 | `services/api-ts/src/handlers/training/`, `association:member/` | `apps/memberry/src/features/training/` | `apps/memberry/src/routes/_authenticated/training/` |
| m10 | `services/api-ts/src/handlers/association:member/` (credit subset) | `apps/memberry/src/features/credits/` | `apps/memberry/src/routes/_authenticated/cpd/` |
| m11 | `services/api-ts/src/handlers/documents/`, `certificates/` | `apps/memberry/src/features/documents/`, `certificates/` | `apps/memberry/src/routes/_authenticated/documents/` |
| m12 | `services/api-ts/src/handlers/elections/`, `association:member/` | `apps/memberry/src/features/elections/` | `apps/memberry/src/routes/_authenticated/elections/` |
| m13 | `services/api-ts/src/handlers/communication/` (5 parked stubs) | — | — |
| m14 | `services/api-ts/src/handlers/association:operations/` | `apps/admin/src/features/dashboard/` | `apps/admin/src/routes/dashboard/` |
| m15 | (NO SOURCE — descoped) | — | — |
| m16 | (NO SOURCE — descoped) | — | — |
| m17 | (NO SOURCE — descoped) | — | — |
| m18 | `services/api-ts/src/handlers/communication/` (22 parked handlers + 13 tests) | `apps/memberry/src/features/surveys/` | `apps/memberry/src/routes/_authenticated/surveys/` |
| m19 | (NO SOURCE — KNOWN-future, CARRIED) | — | — |
| m20 | `services/api-ts/src/handlers/booking/` | (backend-only) | (backend-only) |
| m21 | `services/api-ts/src/handlers/billing/` | (backend-only) | (backend-only) |
| m22 | `services/api-ts/src/handlers/email/` | (backend-only) | (backend-only) |

---

## Recommendations

- **m19-committee-management** — single P1 carried driver (`EM-M19-future01`). Schedule MASTER_PRD v3.0 Add-on Phase 3 to clear.
- **m20/m21/m22** — add BR/AC/WF/SM anchors to MODULE_SPEC §5/§6 to lift the 7.0 score cap (each module reaches `MOSTLY COMPLIANT` once anchors are present).
- **EC-GLOBAL-stub-api-contracts** — already addressed by Wave 58 reclassification in consistency dimension; the 13 stub files can be backfilled when convenient or archived as redundant given MODULE_SPEC §10 authority.
- **EC-GLOBAL-flat-vs-folder** — archive `docs/product/modules/m*.md` flat files or convert to redirects pointing to `docs/product/modules/m*/MODULE_SPEC.md`.

---

## What's Next

`/oli-check --enforcement coverage.md` complete — **0 P0, 0 P1**. 4 P2 + 4 P3 advisories. Output feeds the orchestrator merge step (`all.md` Step 6) that produced `ENFORCEMENT_REPORT.md`.

For coverage-only routing:
- Run `/oli-spec-modules --module m20-booking` (and m21/m22) to backfill anchors and lift the 7.0 score cap.
- Run `/oli-spec-modules --module m19-committee-management` when ready to scaffold the Add-on Phase 3 milestone.

*Pipeline: this report is Phase 0 of `/oli-check --enforcement`. It feeds the merge step that produces `ENFORCEMENT_REPORT.md`.*
