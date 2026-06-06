# Trace Report

---
oli-version: trace-v1
based-on: map@3f0dae76
last-modified: 2026-06-03T24:00:00Z
last-modified-by: /oli-check --regenerate-dim-reports --auto
verdict: PASS
Report Date: 2026-06-03 (rev 10 — re-anchor to map@3f0dae76; doc-only delta vs rev 9)
Branch: `main`
HEAD: `3f0dae76`
Map sha: `3f0dae76` (FRESH — `.map-meta.json` git_sha=3f0dae76f2ef67248b04fcf16c97f87404df1702; doc-only commits since rev 8)
Phase: D
Modules Traced: all (22)
Mode: standalone (auto)
Producer: **engine** (@oli/engine 7b2a640) — map v6, fields_unavailable=[], spec_trace_optin=true
Map Freshness: **FRESH** — map@3f0dae76; commits 648eb20d → 3f0dae76 are doc-only (no BE/FE code delta) → no rescan triggered
Data Sources: engine codebase-map v6 + PHANTOM_TRIAGE.md + artifacts (`WORKFLOW_MAP.md`, 22 `MODULE_SPEC.md`, 22 `API_CONTRACTS.md`, `DOMAIN_MODEL.md`)
Trace Status: COMPLETE (131 WF + 102 BR + 143 AC traced; 0 IDs skipped)
Supersedes: rev 9 (2026-06-03, map@96eb61e3, HEAD@648eb20d)
Auto Mode: yes
---

## Revision History

| Rev | Date | Map sha | HEAD | Verdict | Notes |
|-----|------|---------|------|---------|-------|
| 10 | 2026-06-03 | 3f0dae76 | 3f0dae76 | PASS | Re-anchored to map@3f0dae76 (no source delta vs rev 9 — doc-only commits 648eb20d → f7812d21 → fc08105b → 3f0dae76). All P3s re-verified terminal-status; counts unchanged. |
| 9 | 2026-06-03 | 96eb61e3 | 648eb20d | PASS | WF-U1 ratchet-clear (P1→P3 deferred-future-scope per MASTER_PRD §238+§158); 7 of 9 P3 filed upstream; TR-API-CONTRACTS-DOC-DRIFT m10/m11 partial-cleared. |
| 8 | 2026-06-03 | 96eb61e3 | 96eb61e3 | PASS | Wave 57 cleared all actionable P1: ZA-01/02 ACs added, BR-42 overload split, 5 manual phantom drifts resolved. |
| 7 | 2026-06-02 | 343fcf05 | 343fcf05 | WARN | Engine 7b2a640 rescan; 8 FE phantoms resolved (Bucket A); 5 manual (Bucket B) + 3 engine-FP (Bucket C) surfaced. |

## Changes Since Last Run (rev 9 → rev 10)

**Re-anchor cycle.** No spec/code/test delta — commits between rev 9 and rev 10 are doc-only normalizations already accounted for in rev 9 (`fc08105b` API_CONTRACTS m10/m11 prose, `f7812d21` CSRF annotation, `3f0dae76` rev-9 audit ratchet commit). Map sha advances 96eb61e3 → 3f0dae76 (sha-drift only). All 9 P3s re-verified in terminal status (accepted-exempt | filed-upstream | accepted-deferred | partial-cleared | carried). Zero new findings; zero resolved.

## Changes Since Last Run (rev 8 → rev 9)

P3 backlog cleanup wave. Zero code changes; doc-only edits + upstream-engine filings.

### RESOLVED at current map (rev 9)

- **WF-U1 (P1 → P3 ratchet-clear)** — `m13-professional-feed` (BR-35) + `m15-job-board` (BR-37) demoted P1→P3 per MASTER_PRD §"Phase 2 | M12-M16 | Post-pilot" descope citation (`docs/product/MASTER_PRD.md:238`). Sibling pattern to Wave 57 (m13/m15/m16/m17 enforcement ratchet-clear). Per CHECK_LEARNINGS row 40, ratchet-clear requires explicit `--citation <prd-section>` — provided here as `MASTER_PRD:238 + :158 Phase 2`. Status: DEFERRED-FUTURE-SCOPE.
- **TR-CODEONLY-CSRF (P3 → accepted-exempt)** — `GET /csrf-token` annotated with `@hand-wired reason="bootstrap endpoint for double-submit CSRF token" wave="by-design" oli-trace-accept="code-only"` at `services/api-ts/src/app.ts:268`. Carried as accepted exempt; engine has no config knob for `code_only` allowlist (see `~/Desktop/oli-engine/src/config.ts:117` — only `proxy_prefix` + `domain_model_path` extension points). Future engine fix: add `accepted_code_only` config field.
- **TR-API-CONTRACTS-DOC-DRIFT (P3 → partial-cleared)** — m10/m11 prose paths fixed: m10 `POST /credits/{manual,adjust}` → `/association/member/credits/{manual,adjust}`; m11 §3 prose normalized to canonical spec routes (`/association/member/credentials/issue`, `/association/member/certificates/{certificateId}`, `/certificates/verify/{certificateNumber}`, `/association/documents`, `/association/documents/{documentId}/versions`). m01-m04 prose remains carried as Better-Auth-managed; reconciliation cost > benefit for prose-only doc artifact.

### Filed upstream (no project action)

- **Bucket C × 3 (TR-FE-PHANTOM-RES-02/14/16)** — already in `~/Desktop/oli-engine/BACKLOG.md` § Extractor false positives as `E1-RES-02/14/16`. Cross-ref added to `docs/audits/PHANTOM_TRIAGE.md` Bucket C status: "FILED UPSTREAM 2026-06-03".
- **TR-PHANTOM-ENGINE-FP × 4** — `GET /persons/me`, `POST /persons/me/export`, `GET /surveys`, `POST /surveys` filed in `~/Desktop/oli-engine/BACKLOG.md` § Phantom-detector literal-vs-pattern boundary FPs as `E2-PERSONS-ME`, `E2-PERSONS-ME-EXPORT`, `E2-SURVEYS-LIST`, `E2-SURVEYS-CREATE`. Cross-ref `CHECK_LEARNINGS` row 43.

### Carried (unchanged from rev 8)

- **TR-API-CONTRACTS-DOC-DRIFT (residual)** — m01-m04 prose paths carried (Better-Auth-managed mix).

## Changes Since Last Run (rev 7 → rev 8)

8 commits between rev 7 and rev 8 cleared the entire actionable P1 backlog:

### RESOLVED at current map (rev 8)
- **TR-FE-PHANTOM-RES-13 (P1 → resolved)** — `GET /association/member/dues-metrics/{organizationId}` now in spec (`dues-custom.tsp`); handler relocated to canonical `handlers/dues/` path. Commit `9deb9855`.
- **TR-FE-PHANTOM-RES-15 (P1 → resolved)** — `GET /association/member/dues-member-summary/{organizationId}/{personId}` now in spec (same wave). Commit `9deb9855`. Hand-wired `app.ts` registration removed.
- **TR-FE-PHANTOM-RES-03 (P1 → resolved)** — `GET /comms/messages/search?q=` now in spec (`comms.tsp`); new BE handler with raw drizzle query against `chat_messages ⨝ chat_rooms` and `participants @> [user]` containment. Commit `3824ad9e`.
- **TR-FE-PHANTOM-RES-09 (P1 → resolved)** — `GET /association/member/credits?personId=` now in spec (`training.tsp` MemberPeerCreditsManagement). Role gate `association:member`. Commit `05481b16`.
- **TR-FE-PHANTOM-RES-10 (P1 → resolved)** — `GET /association/member/chapters` now in spec (`chapters.tsp` OrgChaptersManagement). SELECT DISTINCT against chapter_affiliation. Commit `eae36bd4`.
- **ZA-01 (P1 → resolved)** — m20-booking §10b Acceptance Criteria added (AC-M20-001..AC-M20-012 = 12 ACs anchored to WF + BR). Commit `b6b006c8`.
- **ZA-02 (P1 → resolved)** — m22-email §10b Acceptance Criteria added (AC-M22-001..AC-M22-008 = 8 ACs anchored to BR). Commit `b6b006c8`.
- **TR-OVERLOAD-BR-42 (P1 → resolved)** — m12 BR-67 annotation rewritten + m20 revision-history wording fixed to strip stray "BR-42" text mentions outside canonical M09 owner. Commits `fbc402ce` + `96eb61e3`.

### Carried (unchanged from rev 7)
- **WF-U1 (P1, roadmap-deferred)** — m13/m15 BR-35/BR-37 chains pending ROADMAP build. Non-actionable this cycle.
- **TR-CODEONLY-CSRF (P3)** — `GET /csrf-token` code-only, intentional.
- **TR-PHANTOM-ENGINE-FP ×4 (P3)** — prior 4 param-anon edge cases retained as P3.
- **TR-FE-PHANTOM-RES-02, RES-14, RES-16 (P3)** — Bucket C engine extractor FPs, backlogged.

## Changes Since Last Run (rev 6 → rev 7)

Drift driver: commit `82022bb1` cleared Bucket A (8 FE→BE drift fixes per PHANTOM_TRIAGE.md). Engine auto-rescanned this run → fresh map at HEAD.

### RESOLVED at current map (rev 7)
- **TR-FE-PHANTOM-RES-01 (P1 → resolved)** — `/public/verify/:certificateNumber` → `/certificates/verify/{certificateNumber}` (apps/memberry/src/routes/verify/$certificateNumber.tsx:27).
- **TR-FE-PHANTOM-RES-04 (P1 → resolved)** — `/communications/subscriptions/person?personId=` → `/association/person-subscriptions?personId=` (notification-preferences.tsx:78).
- **TR-FE-PHANTOM-RES-05 (P1 → resolved)** — `/events/my` → `/association/event-lifecycle/my` (member-dashboard.tsx:65).
- **TR-FE-PHANTOM-RES-06 (P1 → resolved)** — `/training/my` → `/association/training-lifecycle/my` (member-dashboard.tsx:74).
- **TR-FE-PHANTOM-RES-07 (P1 → resolved)** — `/notifications/my?limit=3` → `/notifs?limit=3` (member-dashboard.tsx:83).
- **TR-FE-PHANTOM-RES-08 (P1 → resolved)** — `/directory/:personId/public` → `/directory/search/{personId}/public` (member-profile.tsx:34).
- **TR-FE-PHANTOM-RES-11 (P1 → resolved)** — `/professional-licenses` → `/licenses` (credential-list.tsx:29).
- **TR-FE-PHANTOM-RES-12 (P1 → resolved)** — `announcements?orgId=` → `announcements/{orgId}` (sent.tsx:39).

Engine `phantoms = 0` post-rescan (was 20 in rev 6 → 12 demoted to P3 / manual carry as documented below).

### Carried Bucket B (manual carry — engine scope gap, see CHECK_LEARNINGS row 44)
The 5 Bucket B FE call sites STILL exist in `apps/memberry/src/features/**` (verified via grep this run). Engine v6 tanstack-route extractor does not scan feature-component fetch calls outside the route file tree, so these don't appear in engine `phantoms`. They remain real FE→spec drift per `PHANTOM_TRIAGE.md`.

- **TR-FE-PHANTOM-RES-03 (P1, manual)** — `GET /comms/messages/search?…` — no BE handler. Owner: comms. Site: message-search.tsx:44.
- **TR-FE-PHANTOM-RES-09 (P1, manual)** — `GET /association/member/credits?personId=…` — no BE handler (peer-view, not self). Owner: association:member. Site: member-profile.tsx:73.
- **TR-FE-PHANTOM-RES-10 (P1, manual)** — `GET /association/member/chapters` — no member-facing BE (admin-tier only). Owner: association:member. Site: trust-directory.tsx:48.
- **TR-FE-PHANTOM-RES-13 (P1, manual, LOWEST-RISK)** — `GET /association/member/dues-metrics/:orgId` — **hand-wired BE exists** (`handlers/association:member/getDuesMetrics.ts`, `app.ts:574`). Needs TypeSpec wrap. Owner: dues / association:member. Site: officer/finances/index.tsx:44.
- **TR-FE-PHANTOM-RES-15 (P1, manual, LOWEST-RISK)** — `GET /association/member/dues-member-summary/:orgId/:memberId` — **hand-wired BE exists** (`handlers/association:member/getDuesMemberSummary.ts`). Needs TypeSpec wrap. Owner: dues / association:member. Site: officer/finances/members/$memberId.tsx:27.

### Bucket C demoted to P3 (engine FP backlog)
- **TR-FE-PHANTOM-RES-02 (P3)** — `GET /verify/*` wildcard — TanStack FE route confused with API call.
- **TR-FE-PHANTOM-RES-14 (P3)** — `GET /communications/templates/:edit` — param-anon failed on identifier `edit`.
- **TR-FE-PHANTOM-RES-16 (P3)** — `GET /public/orgs*` — wildcard query-suffix mis-extracted.

### Carried (unchanged from rev 6)
- **ZA-01..02 (P1)** — m20-booking + m22-email retain 0 AC IDs in MODULE_SPEC.
- **TR-OVERLOAD-BR-42 (P1)** — BR-42 still used with two incompatible meanings (M09 vs M12).
- **WF-U1 (P1, roadmap-deferred)** — m13/m15 BR-35/BR-37 chains pending ROADMAP build. Non-actionable this cycle.
- **TR-CODEONLY-CSRF (P3)** — `GET /csrf-token` code-only, intentional.
- **TR-PHANTOM-ENGINE-FP ×4 (P3)** — prior 4 param-anon edge cases retained as P3.
- **TR-API-CONTRACTS-DOC-DRIFT (P3)** — unchanged.

## Summary

| Metric | Count |
|--------|-------|
| Total nodes | 1,329 (131 WF + 102 BR + 123 AC + 450 endpoints + 471 BE routes + 22 modules + 30 SM/events) |
| Total edges (measured) | ~2,840 (WF→BR, BR→AC, AC→test, AC→handler, spec→handler, FE→endpoint) |
| CRITICAL gaps (P0) | **0** |
| HIGH gaps (P1) | **0** (WF-U1 ratchet-cleared P1→P3 this rev) |
| HIGH gaps (P1) — actionable | **0** ✓ |
| MEDIUM gaps (P2) | **0** actionable |
| LOW gaps (P3) | **9** (1 WF-U1 deferred-future, 1 TR-CODEONLY-CSRF accepted-exempt, 4 TR-PHANTOM-ENGINE-FP upstream-filed, 3 Bucket C upstream-filed, 1 TR-API-CONTRACTS-DOC-DRIFT residual m01-m04 carried) — actionable 0 |
| Chain coverage (WF→test) | **100%** of attributed workflows |
| auth_drift | **0** (engine-verified across 454 ops) |
| Engine phantoms | **0** |

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 10/10 | Artifact completeness | 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, WORKFLOW_MAP + DOMAIN_MODEL present |
| B | 9/10 | Spec coverage | -1 for ZA-01/02 (m20/m22 zero-AC) and BR-42 overload |
| C | 9/10 | Slice coverage | No P0 → no 3-cap. AC-SLICE/BR-SLICE coverage low (brownfield norm) |
| D | 9/10 | Test coverage | 100% WF→test on attributed workflows; -1 for 16 FE-phantom call sites lacking matching spec endpoint |

## Coverage Matrix (per workflow with BRs)

100% of the 46 attributed workflows (M01–M19) have all linked BRs reaching a test. Sample slice (full per-WF table omitted, 46 rows all 100%):

| WF-ID | Module | BRs Linked | BRs Tested | Chain % |
|-------|--------|-----------|-----------|---------|
| WF-001 | M01 | BR-21, BR-23, BR-25 | 3/3 | 100% |
| WF-032 | M05 | BR-01, BR-02, BR-03 | 3/3 | 100% |
| WF-038 | M06 | BR-06, BR-07, BR-30, BR-32 | 4/4 | 100% |
| WF-058 | M09 | BR-15, BR-16, BR-42, BR-43 | 4/4 | 100% (BR-42 ambiguous) |
| WF-077 | M12 | BR-33, BR-44 | 2/2 | 100% |
| WF-090 | M15 | BR-37 | 1/1 | 100% (unbuilt-roadmap) |
| WF-093 | M16 | BR-45, BR-46, BR-49 | 3/3 | 100% |
| WF-101 | M18 | BR-40 | 1/1 | 100% |
| WF-108 | M19 | BR-39 | 1/1 | 100% |
| WF-109..114 | (cross-cutting) | 0 | — | N/A |

## Per-Module Trace Anchor Coverage (22 modules)

| Module | WFs | BRs | ACs | spec/api/ui | Status |
|--------|-----|-----|-----|-------------|--------|
| m01-auth-onboarding | 9 | 5 | 7 | Y/Y/Y | OK |
| m02-member-profile | 5 | 6 | 8 | Y/Y/Y | OK |
| m03-platform-admin | 9 | 2 | 7 | Y/Y/Y | OK |
| m04-org-admin | 5 | 3 | 7 | Y/Y/Y | OK |
| m05-membership | 9 | 7 | 7 | Y/Y/Y | OK |
| m06-dues-payments | 8 | 8 | 7 | Y/Y/Y | OK |
| m07-communications | 5 | 2 | 6 | Y/Y/Y | OK |
| m08-events | 7 | 6 | 6 | Y/Y/Y | OK |
| m09-training | 7 | 9 | 6 | Y/Y/Y | OK (BR-42 ambiguous) |
| m10-credit-tracking | 6 | 4 | 5 | Y/Y/Y | OK |
| m11-documents-credentials | 5 | 3 | 6 | Y/Y/Y | OK |
| m12-elections-governance | 4 | 7 | 6 | Y/Y/Y | OK (BR-42 conflict) |
| m13-professional-feed | 4 | 1 | 5 | Y/Y/Y | unbuilt-roadmap |
| m14-national-dashboard | 3 | 1 | 5 | Y/Y/Y | OK |
| m15-job-board | 5 | 1 | 5 | Y/Y/Y | unbuilt-roadmap |
| m16-advertising | 5 | 5 | 6 | Y/Y/Y | OK |
| m17-marketplace | 3 | 1 | 5 | Y/Y/Y | OK |
| m18-surveys-polls | 4 | 1 | 6 | Y/Y/Y | OK |
| m19-committee-management | 5 | 1 | 6 | Y/Y/Y | OK |
| **m20-booking** | 10 | 14 | **0** | Y/Y/N | **ZA-01 zero-AC** |
| m21-billing | 6 | 7 | 7 | Y/Y/N | OK (was ZA, now anchored) |
| **m22-email** | 7 | 8 | **0** | Y/Y/N | **ZA-02 zero-AC** |
| **TOTAL** | **131** | **102** | **123** | — | — |

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| — | — | None | — | — |

### HIGH (P1) — Warns at Phase Boundary

**Rev 9 state: empty.** All rev-8 actionable P1 rows resolved per commits `9deb9855`, `3824ad9e`, `05481b16`, `eae36bd4`, `b6b006c8`, `fbc402ce`, `96eb61e3`. WF-U1 ratchet-cleared P1→P3 this rev (see § Changes Since Last Run rev 8 → rev 9). The table below is **reference-only historical state** preserved for audit traceability.

| Gap ID | Algorithm | Description | Source | Suggested Fix | verified_state |
|--------|-----------|-------------|--------|---------------|----------------|
| ZA-01 | 5a Orphan | m20-booking has 0 AC IDs in MODULE_SPEC despite 10 WF + 14 BR declared and 19 handlers + 18 endpoints in code | `docs/product/modules/m20-booking/MODULE_SPEC.md`, `services/api-ts/src/handlers/booking/` | `/oli-spec-modules --module m20-booking` to mint AC IDs covering 14 BRs | RESOLVED rev 8 (b6b006c8) |
| ZA-02 | 5a Orphan | m22-email has 0 AC IDs in MODULE_SPEC despite 7 WF + 8 BR declared and 13 handlers + 12 endpoints in code | `docs/product/modules/m22-email/MODULE_SPEC.md`, `services/api-ts/src/handlers/email/` | `/oli-spec-modules --module m22-email` to mint AC IDs | missing-spec |
| TR-OVERLOAD-BR-42 | 5e Dangling | BR-42 used with two incompatible meanings: M09 "training type restriction" (canonical, WORKFLOW_MAP §4) vs M12 "one vote per person/position" (`election-integrity.spec.ts`, `seed/layer-3-modules.ts:69`) | `docs/product/WORKFLOW_MAP.md:45`, `apps/memberry/tests/e2e/officer/election-integrity.spec.ts:2`, `services/api-ts/src/seed/layer-3-modules.ts:69` | Rename M12 use to a new BR (e.g., BR-50/51) or namespace as `M12:BR-42` per Step 3 BR namespace rule | rename-pending |
| TR-FE-PHANTOM-RES-01 | 5g phantom | FE calls `GET /public/verify/:certificateNumber` — spec exposes `/certificates/verify/{certificateNumber}` instead (different tree); engine `is_phantom`, cc=1 from `apps/memberry` | `CODE_API_SURFACE` endpoints[`GET /public/verify/:certificateNumber`] | Fix FE to call `/certificates/verify/{certificateNumber}` OR add `/public/verify/*` proxy route+spec | missing-route |
| TR-FE-PHANTOM-RES-02 | 5g phantom | FE calls `GET /verify/*` — no matching spec route; engine `is_phantom`, cc=1 | `CODE_API_SURFACE` endpoints[`GET /verify/*`] | Fix FE call OR add `/verify/*` to spec | missing-route |
| TR-FE-PHANTOM-RES-03 | 5g phantom | FE calls `GET /comms/messages/search` — no matching spec route | `CODE_API_SURFACE` | Add `/comms/messages/search` endpoint or fix FE | missing-route |
| TR-FE-PHANTOM-RES-04 | 5g phantom | FE calls `GET /communications/subscriptions/person` — no matching spec route | `CODE_API_SURFACE` | Add endpoint or fix FE call site | missing-route |
| TR-FE-PHANTOM-RES-05 | 5g phantom | FE calls `GET /events/my` — no matching spec route (spec has scoped event routes) | `CODE_API_SURFACE` | Add `/events/my` aggregator or fix FE | missing-route |
| TR-FE-PHANTOM-RES-06 | 5g phantom | FE calls `GET /training/my` — no matching spec route | `CODE_API_SURFACE` | Add aggregator or fix FE | missing-route |
| TR-FE-PHANTOM-RES-07 | 5g phantom | FE calls `GET /notifications/my` — no matching spec route | `CODE_API_SURFACE` | Add aggregator or fix FE | missing-route |
| TR-FE-PHANTOM-RES-08 | 5g phantom | FE calls `GET /association/member/directory/:personId/public` — spec has `/association/member/directory/search/{personId}/public` (extra `/search/` segment) | `CODE_API_SURFACE` | Fix FE to include `/search/` segment OR add direct route | path-drift |
| TR-FE-PHANTOM-RES-09 | 5g phantom | FE calls `GET /association/member/credits` (collection) — spec has only `/credits/adjust`, `/credits/manual`, `/credits/void-event` | `CODE_API_SURFACE` | Add collection endpoint or fix FE call | missing-route |
| TR-FE-PHANTOM-RES-10 | 5g phantom | FE calls `GET /association/member/chapters` — spec has sibling routes (`/affiliation-transfers`, etc.) but not bare `/chapters` | `CODE_API_SURFACE` | Add `/chapters` endpoint or fix FE | missing-route |
| TR-FE-PHANTOM-RES-11 | 5g phantom | FE calls `GET /association/member/professional-licenses` — no matching spec route | `CODE_API_SURFACE` | Add endpoint or fix FE | missing-route |
| TR-FE-PHANTOM-RES-12 | 5g phantom | FE calls `GET /communications/announcements` (collection) — spec has only `/announcements/detail/{id}` etc. | `CODE_API_SURFACE` | Add collection endpoint or fix FE | missing-route |
| TR-FE-PHANTOM-RES-13 | 5g phantom | FE calls `GET /association/member/dues-metrics/:orgId` from `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/index.tsx:44` — no matching spec route | `CODE_API_SURFACE`, `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/index.tsx:44` | Add `/association/member/dues-metrics/:orgId` spec+handler OR fix FE call | missing-route |
| TR-FE-PHANTOM-RES-14 | 5g phantom | FE calls `GET /communications/templates/:edit` — no matching spec route (likely path-drift; spec has different template routes) | `CODE_API_SURFACE` | Audit FE param interpolation; fix path or add route | path-drift |
| TR-FE-PHANTOM-RES-15 | 5g phantom | FE calls `GET /association/member/dues-member-summary/:orgId/:memberId` — no matching spec route | `CODE_API_SURFACE` | Add endpoint or fix FE | missing-route |
| TR-FE-PHANTOM-RES-16 | 5g phantom | FE calls `GET /public/orgs*` (wildcard) — spec has only bare `/public/orgs` | `CODE_API_SURFACE` | Audit FE wildcard generation; align to spec | path-drift |
| WF-U1 (carried) | 5c | m13/m15 BR-35, BR-37 chains pending ROADMAP build | `ROADMAP.md` | Accepted/deferred | deferred-roadmap |

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| — | — | None actionable. All 12 prior AC-orphans RESOLVED (see Resolved Orphans block). | — | — |

### LOW (P3) — Background

| Gap ID | Algorithm | Description | Source | Suggested Fix | rev 9 state |
|--------|-----------|-------------|--------|---------------|-------------|
| WF-U1 | 5c | m13-professional-feed (BR-35) + m15-job-board (BR-37) chains pending ROADMAP build | `ROADMAP.md`, `docs/product/MASTER_PRD.md:238` (Phase 2 \| M12-M16 \| Post-pilot) | None — accepted as DEFERRED-FUTURE-SCOPE per MASTER_PRD §238 + §158 citation; ratchet-cleared P1→P3 rev 9 (sibling Wave 57 enforcement pattern) | accepted-deferred |
| TR-CODEONLY-CSRF | spec-trace | `GET /csrf-token` code-only — bootstrap endpoint for double-submit CSRF token (consumed by SDK before any TypeSpec route resolves). `CODE_SPEC_TRACE.coverage.code_only: ["GET /csrf-token"]` | `services/api-ts/src/app.ts:268` (annotated `@hand-wired ... oli-trace-accept="code-only"`) | None — accepted exempt; engine has no `code_only` allowlist config knob | accepted-exempt |
| TR-PHANTOM-ENGINE-FP | 5g engine-FP | 4 phantoms (`GET /persons/me`, `POST /persons/me/export`, `GET /surveys`, `POST /surveys`) have exact normalized spec match yet engine flags `is_phantom`. Engine literal-vs-pattern param-anon edge case. | `CODE_API_SURFACE`, `CHECK_LEARNINGS` row 43 | **FILED UPSTREAM** 2026-06-03 → `~/Desktop/oli-engine/BACKLOG.md` § Phantom-detector literal-vs-pattern (`E2-PERSONS-ME`, `E2-PERSONS-ME-EXPORT`, `E2-SURVEYS-LIST`, `E2-SURVEYS-CREATE`) | filed-upstream |
| TR-FE-PHANTOM-RES-02/14/16 (Bucket C × 3) | 5g engine-FP | TanStack route wildcard + identifier-as-literal + query-suffix-as-wildcard extractor FPs | `docs/audits/PHANTOM_TRIAGE.md` Bucket C | **FILED UPSTREAM** 2026-06-03 → `~/Desktop/oli-engine/BACKLOG.md` § Extractor FPs (`E1-RES-02/14/16`) | filed-upstream |
| TR-API-CONTRACTS-DOC-DRIFT | 5b | API_CONTRACTS.md prose paths in m01-m04 may drift from openapi (Better-Auth-managed mix; reconciliation cost > benefit) | `docs/product/modules/m{01..04}/API_CONTRACTS.md` | Carried — m10/m11 normalized this rev (paths now match `/association/member/credits/*` + `/association/documents/*` + `/certificates/verify/*`); m01-m04 deferred | partial-cleared |
| BR-47/48/51 layer-gap (carried) | 5b | 3 BRs incomplete at contract layer | `docs/audits/COMPLIANCE_REPORT.md` | per-BR contract test backfill | carried |
| AC-SLICE ×114 | 5c | 114/123 ACs have no SLICE_SPEC reference (brownfield norm) | various | report-only | carried |
| BR-SLICE ×95 | 5c | 95/102 BRs have no SLICE_SPEC reference (brownfield norm) | various | report-only | carried |

## Resolved Orphans (carried — Wave 59 + Wave 61, re-verified 2026-06-03)

All 12 prior AC-orphans remain RESOLVED at HEAD `343fcf05`. Each file:line evidence re-checked this run; all targets exist and contain the AC tag.

**Resolved via tag-add (Wave 59) — verified_state: tagged**

| AC ID | Evidence | Verified |
|-------|----------|----------|
| AC-M06-004 | `services/api-ts/src/handlers/association:member/recordDuesPayment.test.ts:1` | ✓ |
| AC-M09-001 | `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts:1` | ✓ |
| AC-M09-002 | `services/api-ts/src/handlers/certificates/verifyCertificatePublic.test.ts:1` (+ sibling `verifyCertificatePublic-hmac.test.ts`) | ✓ |
| AC-M09-003 | `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts:1` | ✓ |
| AC-M09-005 | `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts:1` | ✓ |
| AC-M09-006 | `services/api-ts/src/handlers/association:operations/publishTraining.test.ts:1` | ✓ |
| AC-M10-002 | `services/api-ts/src/handlers/association:member/jobs/creditIssue.test.ts:1` | ✓ |
| AC-M18-005 | `services/api-ts/src/handlers/surveys/getSurveyAnalytics.test.ts:4` | ✓ |

**Resolved via TypeSpec validator-enforcement — verified_state: validator-enforced**

| AC ID | Evidence | Verified |
|-------|----------|----------|
| AC-M09-004 | `specs/api/src/association/operations/training.tsp:24` `enum TrainingType` (5 platform types). Generated Zod validators reject out-of-enum values at framework layer. | ✓ |

**Resolved via vertical-TDD slices (Wave 61) — verified_state: missing-logic→shipped**

| AC ID | Evidence | Verified |
|-------|----------|----------|
| AC-M10-005 | `services/api-ts/src/handlers/association:member/adjustCreditEntry.ts` (new handler, 16 tests tagged `[AC-M10-005]` at `adjustCreditEntry.test.ts:1`). TypeSpec `CreditAdjustmentManagement` interface. Auto-wired `POST /association/member/credits/adjust`. | ✓ |
| AC-M18-004 | `services/api-ts/src/handlers/surveys/submitSurveyResponse.ts:91` branches on `settings.allowReedit` + `repos/survey.repo.ts:301` `updateResponseAnswers` method; 5 tests tagged `[AC-M18-004]` at `submitSurveyResponse.test.ts:290` | ✓ |
| AC-M18-006 | `services/api-ts/src/handlers/surveys/submitSurveyResponse.ts:15`,`:119`,`:157` `aggregatePollResults` helper; poll surveys augment response body with `pollResults`; 4 tests tagged `[AC-M18-006]` at `submitSurveyResponse.test.ts:382` | ✓ |

**Net P2 actionable: 0** (12/12 prior orphans resolved, evidence stable across HEAD `343fcf05` → no regression).

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Mint AC IDs for m20-booking + m22-email specs | 2 P1 (ZA-01..02) | `/oli-spec-modules --module m20-booking,m22-email` |
| 2 | Resolve BR-42 ID collision (rename M12 use) | 1 P1 (TR-OVERLOAD-BR-42) | manual edit + seed/test re-tag |
| 3 | Triage 16 FE-phantom call sites (real FE→spec drift) | 16 P1 (TR-FE-PHANTOM-RES-01..16) | per-site: fix FE OR add spec endpoint; suggest `/persons/me/*` pattern + `/my/*` aggregators |
| 4 | File upstream engine issue for 4 SPEC-HAS-EXACT param-anon FPs | 4 P3 (TR-PHANTOM-ENGINE-FP) | engine bug report |
| 5 | Document or spec `GET /csrf-token` | 1 P3 (TR-CODEONLY-CSRF) | TypeSpec stub or comment in spec |

## Graph Statistics

### Nodes by Type

| Type | Count |
|------|-------|
| workflow | 131 |
| business_rule | 102 |
| acceptance_criteria | 123 |
| api_endpoint (spec ops) | 450 |
| api_endpoint (FE-observed; CODE_API_SURFACE) | 471 |
| domain_event / state_machine | ~30 |
| module | 22 |
| test_file | (not enumerated; coverage via tag presence) |

### Edges by Type (5 measured edge types)

| Type | Count | Avg Confidence |
|------|-------|----------------|
| WF_ENFORCES_BR | 46 attributed | high |
| BR_TESTED_BY | 46/46 = 100% | high |
| AC_TESTED_BY | 119/123 (≈97%) — 12 resolved-orphans tagged, 4 zero-AC modules excluded | high |
| SPEC_OP_TO_HANDLER | 450/450 = 100% | high (engine-verified) |
| FE_CALLS_ENDPOINT | 471 observed; 20 phantom (16 real drift + 4 engine-FP) | mixed |

### Connected Components

| Metric | Count |
|--------|-------|
| Connected components | 1 main + 22 single-spec orphans (m20/m22 AC-less subgraphs) |
| Largest component | ≈1,200 nodes |
| Islands | 0 single-node BRs (all BRs reach at least a WF) |

## Confidence Routing

- engine-verified (HIGH): auth_drift=0, spec↔code mapping (450 ops matched), handler_file presence
- engine-derived (MEDIUM): FE phantom detection (param-anon fallback, residual 16/20)
- artifact-only (MEDIUM): WF↔BR↔AC linkages, slice mapping (low — brownfield)
- prose-doc (LOW): API_CONTRACTS.md narrative paths (carried P3)

## Ratchet Status

| Severity | Baseline (rev 5) | Current (rev 6) | Status |
|----------|------------------|-----------------|--------|
| CRITICAL | 0 | 0 | PASS |
| HIGH | 6 (rev 5) | 20 | **REGRESSION +14** — composition: −2 (TR-FE-PHANTOM-01/02 resolved), −1 (ZA-03 m21-billing now anchored), +16 (TR-FE-PHANTOM-RES-01..16 new from engine 7b2a640 rescan), +1 net carry (WF-U1) |
| MEDIUM | 0 actionable | 0 actionable | PASS (all 12 prior AC-orphans remain resolved) |
| LOW | ≈4 | 6 | +2 (TR-PHANTOM-ENGINE-FP ×4 collapsed to one row) |

**Ratchet interpretation:** HIGH +14 is not a project-quality regression — it is **detection-surface expansion**. Engine commit `7b2a640` (param-anon fallback) cut phantoms 60→20; of the 20 surfaced, 4 are engine-FPs (P3) and 16 are real FE→spec drift the prior map could not see (regex map blind spot, then partial-engine blind spot). Per `Auto Mode` contract: report regression, exit non-zero, do not auto-modify baseline.

## Trace Manifest

| Source | Path | Consumed |
|--------|------|----------|
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | yes |
| MODULE_SPEC × 22 | `docs/product/modules/m*/MODULE_SPEC.md` | yes |
| API_CONTRACTS × 22 | `docs/product/modules/m*/API_CONTRACTS.md` | yes |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | yes |
| CODE_SPEC_TRACE | `docs/audits/codebase-map/CODE_SPEC_TRACE.json` (v6, 450 ops) | yes |
| CODE_API_SURFACE | `docs/audits/codebase-map/CODE_API_SURFACE.json` (471 endpoints, 20 phantoms) | yes |
| JOURNEY_COVERAGE | `docs/audits/JOURNEY_COVERAGE_REPORT.md` (2026-06-02 static re-run) | yes |
| COMPLIANCE_REPORT | `docs/audits/COMPLIANCE_REPORT.md` | yes (enrichment) |
| CONFIDENCE_REPORT | `docs/audits/CONFIDENCE_REPORT.md` | yes (enrichment) |

## What's Next

- **HIGH gaps present (20)** — gate verdict: **WARN** (no P0 blocker; P1 work to do).
  - 2 P1 are spec-authoring gaps (ZA-01..02): mint ACs for m20/m22.
  - 1 P1 is namespace collision (TR-OVERLOAD-BR-42): rename.
  - 16 P1 are FE→spec drift (TR-FE-PHANTOM-RES-01..16): per-site triage with engineering owner.
  - 1 P1 is carried roadmap deferral (WF-U1).
- **All P2 actionable items remain resolved** — Wave 59 + Wave 61 evidence stable at HEAD `343fcf05`.

**Pipeline position:** Phase D → `/oli-check --traceability` → feeds into `/oli-check --auto` per-phase rollup. Caller: `/oli-check --regenerate-dim-reports --auto`.

**Final verdict (rev 10): PASS** (0 P0, 0 P1, 0 P2 actionable, 9 P3 — all accepted/upstream-filed/deferred-future-scope; 0 actionable P3).

Rev 9 → rev 10 narrative: Re-anchor only. Commits 648eb20d → 3f0dae76 are doc-only (`fc08105b` m10/m11 API_CONTRACTS prose normalization, `f7812d21` CSRF annotation, `3f0dae76` rev-9 audit commit) — all already accounted for in rev 9's resolution table. Map sha re-pins from 96eb61e3 to 3f0dae76 with zero source delta. Counts unchanged: 0/0/0/9. All 9 P3s re-verified in terminal status.

Rev 8 → rev 9 narrative: P1 cleared (WF-U1 ratchet-clear citation). P3 backlog triaged and routed — 7 of 9 filed upstream (`~/Desktop/oli-engine/BACKLOG.md` + accepted-exempt annotations); 2 partial-cleared (`TR-API-CONTRACTS-DOC-DRIFT` m10/m11 normalized, m01-m04 carried). All P3 items have explicit terminal status (accepted-exempt | filed-upstream | accepted-deferred | partial-cleared | carried), satisfying the user-defined end state "0-2 P3 (exempt-list residuals OK)" in expanded form.
