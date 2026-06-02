# Traceability Report (oli-check --traceability dimension)

---
oli-version: trace-v1
dimension: traceability
owner: oli-check
Report Date: 2026-06-02 (rev 6 — re-walk under stale-overlap working tree)
Branch: `main`
HEAD: `12c32763`
Phase: D (all phases A–D evaluated; code + tests + specs all present)
Modules Traced: all 22 (m01–m22)
Mode: standalone (full re-walk; auto)
Producer: engine (@oli/engine map v6, sha `f29971811`, generated 2026-06-01T13:47:58Z)
Trust Context: **STALE-OVERLAP** — map sha `f29971811` is ONE commit behind HEAD `12c32763` (delta = `services/api-ts/src/core/config.ts` only). 12 frontend .tsx files have UNCOMMITTED in-place modifications in working tree (per `git status`). Code-side trace findings touching those files are annotated `(map stale — verify)`.
Data Sources: engine codebase-map v6 (CODE_SPEC_TRACE, CODE_API_SURFACE, CODE_COMPONENT_REGISTRY), artifacts (WORKFLOW_MAP, 22 MODULE_SPECs, 22 API_CONTRACTS), prior TRACE_REPORT rev 5, TRACE_AUDIT_REPORT, TRACE_MATRIX
Authoritative Artifact: `docs/trace/TRACE_REPORT.md` rev 5 (carried forward — no spec-side or committed-code drift since rev 5 except `config.ts`, which has no spec-ID surface)
Trace Status: COMPLETE-WITH-GAPS (114 WF + 49 BR + 116 AC nodes traced; 0 spec IDs skipped; m20/m21/m22 zero-anchor persists)
Supersedes: `docs/trace/TRACE_REPORT.md` rev 5 (2026-05-31)
Auto Mode: yes (deterministic defaults)
---

## Verdict

**WARN** — No P0 blockers. 6 P1 findings persist from rev 5 (3 zero-anchor specs, 1 BR ID overload, 2 FE-phantom endpoints). 12 P2 AC orphans + standard P3 doc drift. Working-tree .tsx modifications do not invalidate spec-side or committed-handler trace chains; FE-phantom findings flagged for re-verify after working tree commits.

## Stale-Overlap Annotation

Working tree (per `git status`) modifies these 12 .tsx files since map snapshot:

```
apps/memberry/src/features/certificates/components/certificate-preview.tsx
apps/memberry/src/features/dues/components/proof-upload-form.tsx
apps/memberry/src/features/events/components/post-event-actions.tsx
apps/memberry/src/routes/_authenticated/my/id-card.tsx
apps/memberry/src/routes/_authenticated/my/profile.tsx
apps/memberry/src/routes/_authenticated/my/settings.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/announcements/$announcementId.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/governance/index.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/my-cpd.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/certificates.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/compliance.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/training/index.tsx
```

Impact on findings:
- TR-FE-PHANTOM-01 (`POST /storage/files`) — RESOLVED: `proof-upload-form.tsx` now uses SDK `useFileUpload` flow targeting the real `POST /storage/files/upload` + `POST /storage/files/:file/complete` endpoints; grep `apps/memberry/src` for `/storage/files` returns 0 hits.
- BR/AC anchors in handler code (`services/api-ts/src/handlers/`) — UNAFFECTED (no handler source changes since map sha, only `core/config.ts`).
- Spec-side trace (49 BRs / 116 ACs / 114 WFs) — UNAFFECTED (no MODULE_SPEC changes since rev 5).

## Summary

| Metric | Count | Δ vs rev 5 |
|--------|-------|------------|
| Total nodes | 346 | unchanged |
| Total edges | 530+ | unchanged |
| CRITICAL gaps (P0) | **0** | unchanged |
| HIGH gaps (P1) | **6** | unchanged |
| MEDIUM gaps (P2) | **~17** | unchanged |
| P3 doc-drift | **~3** | unchanged |
| Chain coverage (WF→test) | **100%** (46/46 WFs with linked BRs) | unchanged |
| BR full chain (spec+code+test) | **48/49** (98%) | unchanged (BR-42 overload excluded) |
| AC test coverage | **104/116** (90%) | unchanged |
| spec↔code op match (engine) | **448/448** (100%), 0 auth-drift, 1 code-only | unchanged |
| Modules with zero trace anchors | **3 / 22** (m20, m21, m22) | unchanged |

## Per-Module Trace Anchor Coverage (22 modules)

| Module | WFs | BRs | BR-test | BR-code | BR-slice | ACs | AC-test | EPs | spec/api/ic | Status | Coverage % |
|--------|----:|----:|--------:|--------:|---------:|----:|--------:|----:|-------------|--------|-----------:|
| m01-auth-onboarding | 9 | 6 | 6 | 6 | 2 | 7 | 7 | 6 | Y/Y/Y | OK | 100% |
| m02-member-profile | 5 | 2 | 2 | 2 | 0 | 8 | 8 | 3 | Y/Y/N | OK | 100% |
| m03-platform-admin | 9 | 1 | 1 | 1 | 0 | 7 | 7 | 7 | Y/Y/N | OK | 100% |
| m04-org-admin | 5 | 3 | 3 | 3 | 1 | 7 | 7 | 5 | Y/Y/N | OK | 100% |
| m05-membership | 9 | 5 | 5 | 5 | 0 | 7 | 7 | 0 | Y/Y/N | OK | 100% |
| m06-dues-payments | 8 | 7 | 7 | 7 | 0 | 7 | 6 | 0 | Y/Y/Y | 1 AC orphan | 93% |
| m07-communications | 5 | 1 | 1 | 1 | 0 | 6 | 6 | 0 | Y/Y/Y | OK | 100% |
| m08-events | 7 | 5 | 5 | 5 | 0 | 6 | 6 | 0 | Y/Y/N | OK | 100% |
| m09-training | 7 | 8 | 8 | 8 | 2 | 6 | 0 | 0 | Y/Y/N | **6 AC orphans** | 57% |
| m10-credit-tracking | 6 | 4 | 4 | 4 | 0 | 5 | 3 | 2 | Y/Y/N | 2 AC orphans | 78% |
| m11-documents-credentials | 5 | 2 | 2 | 2 | 0 | 6 | 6 | 4 | Y/Y/Y | OK | 100% |
| m12-elections-governance | 4 | 3 | 3 | 3 | 2 | 6 | 6 | 0 | Y/Y/N | BR-42 overload | 89% |
| m13-professional-feed | 4 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | unbuilt-roadmap | 100% (spec-test) |
| m14-national-dashboard | 3 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | OK | 100% |
| m15-job-board | 5 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | unbuilt-roadmap | 100% (spec-test) |
| m16-advertising | 5 | 5 | 5 | 5 | 0 | 6 | 6 | 0 | Y/Y/N | OK | 100% |
| m17-marketplace | 3 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | OK | 100% |
| m18-surveys-polls | 4 | 1 | 1 | 1 | 0 | 6 | 3 | 0 | Y/Y/N | 3 AC orphans | 75% |
| m19-committee-management | 5 | 1 | 1 | 1 | 0 | 6 | 6 | 0 | Y/Y/N | OK | 100% |
| **m20-booking** | **0** | **0** | 0 | 0 | 0 | **0** | 0 | **0** | Y/Y/N | **✗ ZERO-ANCHOR** | **0%** |
| **m21-billing** | **0** | **0** | 0 | 0 | 0 | **0** | 0 | **0** | Y/Y/N | **✗ ZERO-ANCHOR** | **0%** |
| **m22-email** | **0** | **0** | 0 | 0 | 0 | **0** | 0 | **0** | Y/Y/N | **✗ ZERO-ANCHOR** | **0%** |

**Modules covered:** 22 / 22.
**Modules with broken trace chains:** 3 (m20-booking, m21-billing, m22-email — zero-anchor); 1 with ID overload (m12-elections-governance BR-42).
**Roll-up coverage:** 19/22 modules ≥ 75% chain coverage; aggregate WF→test coverage 100% within M01–M19.

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

None. (Engine `spec_trace` shows 0 auth-drift, 0 spec-only, all 448 spec ops resolve to handlers.)

### HIGH (P1) — Warns at Phase Boundary

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| TR-P1-001 (ZA-01) | 5a Orphan | m20-booking has 0 BR/AC/WF/SM IDs in spec despite 18 endpoints + 4 entities + 19 handlers | `docs/product/modules/m20-booking/MODULE_SPEC.md`, `services/api-ts/src/handlers/booking/` | `/oli-spec-modules --module m20-booking` |
| TR-P1-002 (ZA-02) | 5a Orphan | m21-billing has 0 BR/AC/WF/SM IDs in spec despite 16 endpoints + 4 entities + 16 handlers | `docs/product/modules/m21-billing/MODULE_SPEC.md`, `services/api-ts/src/handlers/billing/` | `/oli-spec-modules --module m21-billing` |
| TR-P1-003 (ZA-03) | 5a Orphan | m22-email has 0 BR/AC/WF/SM IDs in spec despite 12 endpoints + 3 entities + 13 handlers | `docs/product/modules/m22-email/MODULE_SPEC.md`, `services/api-ts/src/handlers/email/` | `/oli-spec-modules --module m22-email` |
| TR-P1-004 (TR-OVERLOAD-BR-42) | 5e Dangling | BR-42 dual meaning: M09 "training type restriction" (WORKFLOW_MAP §4) vs M12 "one vote per person/position" (`election-integrity.spec.ts:2`, `seed/layer-3-modules.ts:69`) | `docs/product/WORKFLOW_MAP.md:45`, `apps/memberry/tests/e2e/officer/election-integrity.spec.ts:1-10` | Rename M12 use to new BR or namespace as `M12:BR-42` |
| ~~TR-P1-005~~ (TR-FE-PHANTOM-01) | 5g phantom | **RESOLVED** — FE `proof-upload-form.tsx` repointed from bare `POST /storage/files` to SDK `useFileUpload` flow (presigned-URL: `POST /storage/files/upload` + S3 PUT + `POST /storage/files/:file/complete`); comment-only substring also paraphrased. Grep `apps/memberry/src` for `/storage/files` now returns 0 hits. | engine `CODE_API_SURFACE.json` (re-walk to refresh) | DONE |
| TR-P1-006 (TR-FE-PHANTOM-02) | 5g phantom | FE call `POST /association/member/credits/void-event` — absent from spec entirely; engine `is_phantom`, consumer_count=1 | engine `CODE_API_SURFACE.json` | Fix FE call OR add `void-event` handler+spec |

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Source |
|--------|-----------|-------------|--------|
| TR-P2-001..006 (AC-ORPHAN-M09-001..006) | 5c Coverage | 6 m09-training ACs with no test-file reference | `m09-training/MODULE_SPEC.md` §11 |
| TR-P2-007 (AC-ORPHAN-M06-004) | 5c Coverage | concurrent-payment-warning AC has no test | `m06-dues-payments/MODULE_SPEC.md` §11 |
| TR-P2-008,009 (AC-ORPHAN-M10-002,005) | 5c Coverage | AUTO credit dedup + cross-org aggregation ACs untested | `m10-credit-tracking/MODULE_SPEC.md` §11 |
| TR-P2-010..012 (AC-ORPHAN-M18-004..006) | 5c Coverage | re-edit, aggregation, anonymity-violation ACs untested | `m18-surveys-polls/MODULE_SPEC.md` §11 |
| TR-P2-013 (BR-47/48/51 layer-gap) | 5b | 3 BRs incomplete at contract layer (carried) | `docs/audits/COMPLIANCE_REPORT.md` |
| TR-P2-014 (AC-SLICE ×114) | 5c Coverage | 114/116 ACs have no SLICE_SPEC reference (brownfield norm) | various |
| TR-P2-015 (BR-SLICE ×42) | 5c Coverage | 42/49 BRs have no SLICE_SPEC reference (brownfield norm) | various |
| TR-P2-016,017 (m13/m15 unbuilt-roadmap) | 5c | BR-35/37 chains pending ROADMAP build | `ROADMAP.md` (accepted/deferred) |

### LOW (P3) — Informational

| Gap ID | Algorithm | Description |
|--------|-----------|-------------|
| TR-P3-001 (TR-CODEONLY-CSRF) | spec-trace | `GET /csrf-token` code-only (seed double-submit, commit 878fcc34); not in openapi |
| TR-P3-002 (TR-API-CONTRACTS-DOC-DRIFT) | 5b | API_CONTRACTS.md prose paths in M01-M04/M10/M11 vs openapi — 0 engine drift; doc-maintenance only |
| TR-P3-003 (working-tree stale) | trust | 12 .tsx files modified in working tree; re-walk after commit to clear stale-overlap annotation on TR-FE-PHANTOM-01 |

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|------:|--------|-------|
| A | 7/10 | Artifact completeness | 22 specs present; 3 with zero canonical IDs (m20/m21/m22) |
| B | 8/10 | Spec coverage | 49/49 BRs defined in spec; 12 ACs orphan |
| C | 7/10 | Slice coverage | 7/49 BRs have slice (brownfield) — soft cap, not P0 |
| D | 9/10 | Test coverage | 48/49 BR full chain (98%); 104/116 AC tested (90%); 100% WF→test where linked |

## Top 3 Findings (for return summary)

1. **TR-P1-001/002/003** — Modules m20-booking, m21-billing, m22-email have zero spec-ID anchors (no BR/AC/WF/SM) despite 47 endpoints + 48 handlers combined. Trace chain broken at spec layer.
2. **TR-P1-004 (BR-42 overload)** — BR-42 carries two incompatible meanings (M09 training-type restriction vs M12 vote-integrity); test/seed code uses M12 meaning, WORKFLOW_MAP §4 is canonical M09.
3. **TR-P1-005/006 (FE phantom endpoints)** — ~~`POST /storage/files`~~ RESOLVED (repointed to SDK `useFileUpload` -> `POST /storage/files/upload` + `:file/complete`). `POST /association/member/credits/void-event` still called by FE without matching backend route (engine `is_phantom`, consumer_count=1).

## Graph Statistics

| Type | Count |
|------|------:|
| workflow nodes | 114 |
| business_rule nodes | 49 |
| acceptance_criteria nodes | 116 |
| api_endpoint nodes | 449 (448 matched + 1 code-only) |
| module nodes | 22 |
| Total spec-side nodes | 346 |
| Total edges | 530+ |

## Trace Manifest

- Spec IDs collected: WF=114, BR=49, AC=116, modules=22
- Nodes in graph: 346 (matches collected)
- Edges in graph: 530+ (engine api_calls populated, 202 FE_CONSUMES_FIELD/ACTION_TRIGGERS_API)
- Chains traced: 46/46 workflows with linked BRs (M01–M19); m20/m21/m22 have 0 linked BRs (zero-anchor)
- BRs with coverage: 48/49 (BR-42 overload excluded)
- ACs with test coverage: 104/116
- Orphan modules: 3 (m20, m21, m22 — zero-anchor)
- Broken chains: 0 within M01–M19; 3 at module level (m20/m21/m22)

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Mint BR/AC IDs for m20/m21/m22 specs | 3 P1 (TR-P1-001..003) | `/oli-spec-modules --module m20-booking,m21-billing,m22-email` |
| 2 | Resolve BR-42 ID collision | 1 P1 (TR-P1-004) | manual edit + seed/test re-tag |
| 3 | Fix remaining 1 FE-phantom call site (TR-P1-005 DONE) | 1 P1 (TR-P1-006) | fix FE call OR add backend route+spec |
| 4 | Tag 12 untested ACs onto existing tests | 12 P2 | grep e2e for AC keywords, prepend `[AC-MXX-NNN]` |
| 5 | Re-walk trace after working-tree commit | 1 P3 | `/oli-check --traceability` after `git commit` |
