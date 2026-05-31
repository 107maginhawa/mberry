<!-- oli:confidence-report v1.4 | generated: 2026-05-31 | rev 5 engine-anchored | dimension: confidence | method: engine-map v5 graph signals + static scans + banned-pattern grep + TDD-proof inventory -->

# Confidence Stack Report

**Date:** 2026-05-31 (rev 5 — /oli-check --confidence, Phase D engine re-verify)
**HEAD:** `caf33141` (Phase A — engine map regen + trust banner)
**Codebase-map:** **FRESH-ENOUGH** — `.map-meta.json git_sha = 7ba0b7e2` vs HEAD `caf33141` (overlap; graph signals trusted)
**Engine version:** **v5** (CODE_COMPONENT_REGISTRY.version=5) → loading-state-hygiene cap §4.5 and FE↔BE edge-density cap §5.5 **NOW COMPUTED** (was skipped under engine v1)
**Producer:** `engine` @0.1.0 · `fields_unavailable: []` · `spec_trace_optin: true`
**Team size:** small
**Confidence threshold:** MEDIUM (`.oli/config.json` present — Phase A bootstrap)
**Layers audited:** 1–4 (static analysis)
**Layers deferred:** 5–6 (CI/CD/runtime evidence)
**Prior audits used:** `COMPLIANCE_REPORT.md` rev 2.2; existing `CONFIDENCE_REPORT.md` rev 4 (delta); per-module module-specs (m01–m22); 17× `TDD_PROOF.md`
**Supersedes:** rev 4 (2026-05-31, computed on STALE regex map `28c42566`)

## Trust banner (R1)

Codebase map is **FRESH-ENOUGH** and **engine-produced** (`@oli/engine@0.1.0`, `fields_unavailable: []`). **THESIS IN FORCE** for confidence signals. The rev-4 trust degrade (map stale `28c42566` + engine pre-v4) is **CLEARED**. All graph-anchored confidence signals (loading-state hygiene, FE→BE edge density, component→endpoint binding) are now first-class scored inputs rather than `unverified`-bucket placeholders. **Score invariant honored:** §4.5/§5.5 caps are max-not-add subscore ceilings (per skill spec), not R1 unverified re-weights.

**Honest-delta note:** the rev-4 headline (8/10) was computed with §4.5 and §5.5 **skipped** (engine v1 could not emit `loading_state_hygiene.violation` or resolve `api_calls`). Engine v5 now computes both. The result is NOT that the project regressed — it's that two real, previously-invisible signals now bite. The headline moves 8 → 6 because **§5.5 FE→BE edge density (0.669) caps Layer 2 at 6**. See §4.5/§5.5 detail below.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **9/10** | Strong — 26/26 handler dirs have tests except `training` (0 unit) and `marketplace` (3/9). **§4.5 now computed:** loading-hygiene coverage = 279/315 = **0.886** → L1 capped at 9 (36 violators). | training 0 unit tests (P1); marketplace 33% (P2); 36 loading-hygiene violators (P2 — newly visible) |
| 2. Behavior Traceability | **6/10** ⬇ | Capped — 42/45 BRs COMPLETE; ~97% behaviors have a test owner. **§5.5 now computed:** FE→BE edge density = 99/148 = **0.669** < 0.70 → **L2 capped at 6** (49 data-hook consumers resolved 0 endpoints — engine SDK-resolver coverage gap, see detail). | 49 unresolved FE→BE edges (resolver-attributed); 3 INCOMPLETE BRs (BR-47/48/51) |
| 3. Test Quality Hardening | **8/10** | Good — 263 WEAK assertions (mostly E2E); 64 `page.waitForTimeout` hardcoded waits → flake risk. (Source-derived; unaffected by map.) | 263 weak assertions (P2); 64 hardcoded waits (P1); 31 `test.skip` (mostly env-gated) |
| 4. Release Gate Readiness | **9/10** | Strong — 4 CI workflows; typecheck/test/build wired; OTel G4; forward-only migrations by design. | No rollback files (by design); informal release script |

**Overall Test-Confidence (min L1–L3):** **6/10** ⬇ — headline (down from rev 4's 8; driver = §5.5 L2 cap, now computable on engine v5)
**Release-Readiness (L4):** **9/10** — separate release-infra gauge
**Ship-Readiness (min L1–L4):** **6/10** — combined gate
**Average Score:** **8.0/10**

### Verdict: **WARN**

- No P0 fabrication / no Layer = 0 trigger / no missing test runner.
- L2 cap at 6 is **resolver-attributed**, not a behavior defect — 49 unresolved edges are dominated by SDK-provider infra + public-route pages whose factory-hook pattern the engine resolver missed. Real traceability of scored behaviors remains ~97%.
- P1 clusters (training unit-test absence + 64 hardcoded waits) persist from rev 4.
- Recommended: file engine SDK-resolver gap upstream; re-run after resolver improvement to lift L2 back toward 9.

## §4.5 Loading-State Hygiene Coverage (engine v5 — NOW COMPUTED)

| Metric | Value |
|--------|-------|
| ui-typed components (page/component/layout) | 315 |
| analyzed (`loading_state_hygiene != null`) | 136 |
| `violation == true` | **36** |
| `violation == false` | 100 |
| compliant (`null` OR `violation==false`) | 279 |
| **loading_hygiene_coverage** | **279 / 315 = 0.886** |
| **Ceiling applied** | coverage ∈ [0.85, 0.95) → **L1 capped at 9/10** |

**Top loading-hygiene violators** (data-fetching components missing skeleton and/or error branch):
- `OfficerDashboard` — `apps/memberry/src/features/admin/components/officer-dashboard.tsx`
- `OrgSettingsForm` — `apps/memberry/src/features/admin/components/org-settings-form.tsx`
- `CertificateList` — `apps/memberry/src/features/certificates/components/certificate-list.tsx`
- `CertificatePreview` — `apps/memberry/src/features/certificates/components/certificate-preview.tsx`
- `AnnouncementList` — `apps/memberry/src/features/communications/components/announcement-list.tsx`

The 223 null-hygiene ui components are non-data primitives (presentational, no `api_calls`) where hygiene is correctly N/A — counted compliant per formula. These 36 violators are the real, newly-visible coverage holes (infinite-skeleton risk class — the Memberry 2026-05-30 bug lineage).

## §5.5 FE→BE Edge Density (engine v5 — NOW COMPUTED)

| Metric | Value |
|--------|-------|
| data_hook_consumers (ui components using a query/mutation/SDK-factory hook) | 148 |
| resolved_consumers (`api_calls.length > 0`) | 99 |
| **fe_be_edge_density** | **99 / 148 = 0.669** |
| **Ceiling applied** | density < 0.70 → **L2 capped at 6/10** |

**Top unresolved consumers** (import/use a data hook but `api_calls` came back empty):
- `ApiProvider` — `packages/sdk-ts/src/react/provider.tsx` (SDK infra — false-positive; provider setup, no endpoint)
- `NotificationDrawer` — `apps/memberry/src/components/notification-drawer.tsx`
- `JoinPage` — `apps/memberry/src/routes/join.tsx`
- `MemberDetailPage` — `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx`
- `PublicPaymentPage` — `apps/memberry/src/routes/pay/$token.tsx`

**Attribution:** density 0.669 sits a hair under the 0.70 cap-8 / cap-6 boundary. The unresolved set is dominated by (a) SDK-infra/provider false-positives and (b) public-route pages whose factory-hook pattern the engine resolver still misses (the W1 `useGetX()` fix did not cover every factory shape). Per §5.5 design this is intentionally gate-affecting ("you can't have confidence in what you can't trace"), so the cap is applied — but it reflects an **engine SDK-resolver coverage gap**, not 49 broken behaviors. Candidate upstream engine improvement (file separately at github.com/eladventures/oli/issues).

## Unverified Bucket (R1 — graph-anchored low-confidence)

**rev-4 bucket (~504 nodes) → rev-5: COLLAPSED to ~0.**

| rev-4 signal | rev-4 count | rev-5 status |
|--------------|-------------|--------------|
| Handler→behavior mapping (map-stale `28c42566`) | ~26 handler dirs | **CLEARED** — map FRESH-ENOUGH (engine `7ba0b7e2`) |
| Component→hook→endpoint trace (engine pre-v4, 38% resolved) | 109 components | **CLEARED** at binding layer — `api_calls` populated (100 data-fetch comps, 202 calls); 49 residual unresolved now a **scored §5.5 cap**, not unverified |
| `loading_state_hygiene.violation == null` (engine wrote fields, no verdict) | 369 components | **CLEARED** — engine v5 emits real `violation` verdicts (36 true / 100 false); §4.5 cap computed |
| §4.5 / §5.5 caps "skipped (engine pre-v4)" | n/a | **CLEARED** — both now computed (§4.5 → L1 cap 9; §5.5 → L2 cap 6) |

**`unverified` node count: ~0** (engine v5 + fresh map resolves all rev-4 graph-anchored placeholders). Residual engine limitation: `request_shape`/`response_shape` empty `{}` for all 454 endpoints (engine v0.1.0 field gap) — affects traceability 5g field-level phantom classification (see TRACE_REPORT rev 5), NOT confidence layer scoring directly.

## Cross-Layer Consistency

- L1 (9) − L2 (6) = 3 → **flagged**: L2 trails L1 by 3. This is the §5.5 resolver-attributed cap, not a behavior-inventory hole. Without the §5.5 cap, L2 would be 9 (consistent with L1). Documented so the gap is not misread as a coverage regression.
- L3 (8) — source-derived, unchanged from rev 4.
- L4 (9) ≤ L1 — no leading-infra inconsistency.

## Per-Module Breakdown (22 modules)

Score derivation: backend handler-test ratio + presence of E2E coverage + module-spec existence. **`⊘` = unbuilt by design.** **`✓` = scored ≥ 6.** **`✗` = scored < 6.** (Module rows unchanged from rev 4 — backend handler/test ratios are source-derived and map-independent; the §4.5/§5.5 caps are cross-cutting headline ceilings, not per-module backend deltas.)

| Module | Handlers | Tests | Ratio | L1 | L2 | L3 | L4 | Score | Status |
|--------|----------|-------|-------|----|----|----|----|-------|--------|
| m01-auth-onboarding | 33 | 39 | 1.18 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m02-member-profile | 42 | 59 | 1.40 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m03-platform-admin | 45 | 31 | 0.69 | 7 | 8 | 7 | 9 | **7** | ✓ |
| m04-org-admin | 264 | 122 | 0.46 | 6 | 8 | 7 | 9 | **6** | ✓ |
| m05-membership | 15 | 26 | 1.73 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m06-dues-payments | 22 | 39 | 1.77 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m07-communications | 77 | 76 | 0.99 | 9 | 9 | 8 | 9 | **8** | ✓ |
| m08-events | 15 | 25 | 1.67 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m09-training | 10 | 0 | 0.00 | 3 | 7 | 7 | 9 | **3** | ✗ |
| m10-credit-tracking | 16 | 14 | 0.88 | 8 | 8 | 8 | 9 | **8** | ✓ |
| m11-documents-credentials | 21 | 26 | 1.24 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m12-elections-governance | 9 | 20 | 2.22 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m13-professional-feed | 0 | 0 | n/a | 0 | 0 | 0 | n/a | **0** | ⊘ unbuilt |
| m14-national-dashboard | 69 | 25 | 0.36 | 5 | 7 | 7 | 9 | **5** | ✗ |
| m15-job-board | 7 | 7 | 1.00 | 9 | 7 | 7 | 9 | **7** | ✓ |
| m16-advertising | 7 | 7 | 1.00 | 9 | 7 | 7 | 9 | **7** | ✓ |
| m17-marketplace | 9 | 3 | 0.33 | 4 | 6 | 7 | 9 | **4** | ✗ |
| m18-surveys-polls | 20 | 20 | 1.00 | 9 | 8 | 8 | 9 | **8** | ✓ |
| m19-committee-management | 195 | 97 | 0.50 | 6 | 7 | 7 | 9 | **6** | ✓ |
| m20-booking | 19 | 29 | 1.53 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m21-billing | 16 | 23 | 1.44 | 10 | 9 | 8 | 9 | **9** | ✓ |
| m22-email | 13 | 18 | 1.38 | 10 | 9 | 8 | 9 | **9** | ✓ |

**Verdict-relevant rows:** m09 (✗, score 3 — P1), m17 (✗, score 4 — P2), m14 (✗, score 5 — P2), m13 (⊘ — design deferred). Cross-cutting §4.5/§5.5 caps apply at the headline layer, above this per-module table.

## Banned-Pattern Counts (Step 6 §6.1–§6.4)

(Source-derived — unchanged from rev 4; map-independent.)

| Pattern | Count | Severity | Notes |
|---------|-------|----------|-------|
| `test.skip` / `describe.skip` / `it.skip` / `xit` | **31** | P2/P3 | Mostly env-gated — defensible. 5 unconditional → P2. |
| `.only(` | **0** | — | None detected. |
| `page.waitForTimeout` (hardcoded waits) | **64** | **P1** | Concentrated in `apps/memberry/tests/e2e/auth/*` and `member/*`. Flake risk. |
| WEAK assertions (`toBeTruthy/toBeFalsy/toBeDefined`) | **263** | P2 | ~ all in E2E (page-presence not data shape). |
| `vi.mock` / `jest.mock` usage | **74 files** | P2/P3 | 7 DB-mock files lack rationale; rest appropriate. |
| `expectJourneyBroken` (§6.6 probe-skip) | **0** | — | No anti-coverage items → no L1 penalty. |
| `SUT_NOT_IMPORTED` (§6.5 SUT-binding) | 0 in sample | — | 79 component-test files bind to feature component. No L3 cap. |

## TDD Proof Verification (Step 6c)

(Unchanged from rev 4.)
- **TDD_PROOF.md artifacts found:** 17 (under `docs/execution/slices/*/TDD_PROOF.md`). Rev 3 reported 24 — `proof-artifact-drift` flag persists (7 G1 proofs possibly elsewhere).
- **Slice directories:** 19 — 2 lack TDD_PROOF.md (`wave-5-governance-ux`).
- **Git-history test-first scoring:** rev 3 baseline 84% (58/69) — meets ≥80% bonus.
- **Fabrication detection:** No FABRICATION flags this run.

## Layer 4: Release Gate Readiness Detail

(Unchanged from rev 4.)

| Check | Status |
|-------|--------|
| CI config found | YES (`.github/workflows/`) |
| Workflows | `ci.yml`, `contract.yml`, `deploy.yml`, `monitor.yml` |
| Test / Lint / Type / Build steps | PRESENT |
| Security scan step | PARTIAL (audit step; no Snyk/Dependabot visible) |
| Migration files | YES; Rollback/down files | NO (forward-only by design) |
| CI dry-run | YES (contract.yml Hurl) |
| Version file / Release workflow | YES (`package.json` / `deploy.yml`) |
| Health endpoint | DEEP (`/health`, OTel G4) |

## Top Confidence Findings

| ID | Module | Severity | 1-line |
|----|--------|----------|--------|
| CF-001 | m09-training | **P1** | 10 handlers ship with **zero `.test.ts` files** — E2E-only backend logic. |
| CF-002 | cross-cutting (E2E) | **P1** | 64 `page.waitForTimeout(…)` calls — flake risk. |
| CF-009 | cross-cutting (FE→BE) | **P2** | **§5.5 (engine v5):** FE→BE edge density 0.669 < 0.70 → L2 capped at 6. 49 data-hook consumers resolved 0 endpoints. **Resolver-attributed** (engine SDK-factory coverage gap, not broken behavior). |
| CF-010 | cross-cutting (loading hygiene) | **P2** | **§4.5 (engine v5):** 36 loading-hygiene violators (data-fetch components missing skeleton/error branch) → L1 coverage 0.886, capped at 9. Infinite-skeleton risk class. |
| CF-003 | cross-cutting (E2E) | P2 | 263 WEAK assertions in E2E specs. |
| CF-004 | m17-marketplace | P2 | Handler→test ratio 3/9 (33%). |
| CF-005 | m14-national-dashboard | P2 | Handler→test ratio 25/69 (36%). |
| CF-006 | infra (codebase-map) | ~~P2~~ **RESOLVED** | ~~Map STALE~~ — Phase A regen, now FRESH-ENOUGH engine v5. ~504 unverified bucket collapsed. |
| CF-007 | infra (engine) | ~~P3~~ **RESOLVED** | ~~Engine v1 `violation` null~~ — engine v5 emits real verdicts (36 true / 100 false). §4.5 cap unlocked. |
| CF-008 | infra (TDD proofs) | P3 | TDD_PROOF count discrepancy (17 vs claimed 24) — persists. |
| CF-011 | infra (engine) | P3 | Engine v0.1.0 emits `request_shape`/`response_shape` empty `{}` for all 454 endpoints — field-shape assertions not graph-verifiable (affects traceability 5g, not confidence scoring). Candidate upstream. |

## Prioritized Action Plan

### P0 — Fix Now
None.

### P1 — Fix Before Major New Work
- **CF-001 (m09-training):** Add backend unit tests for the 10 training handlers. Vertical-TDD.
- **CF-002 (E2E flake):** Replace `page.waitForTimeout(N)` with `waitForResponse` / `waitForLoadState('networkidle')` / `expect(locator).toBeVisible()`.

### P2 — Fix When Touching Module
- **CF-009 (§5.5 FE→BE):** File engine SDK-resolver gap upstream; for the genuine app-side misses (NotificationDrawer, public-route pages), confirm hooks resolve. Re-run to lift L2 toward 9.
- **CF-010 (§4.5 loading hygiene):** Add skeleton + error branch to the 36 violators (start: OfficerDashboard, OrgSettingsForm, CertificateList/Preview, AnnouncementList).
- **CF-003 (WEAK assertions):** Convert `toBeTruthy()` → shape/value assertions for top 50.
- **CF-004 / CF-005 (marketplace / national-dashboard):** Add handler tests toward ≥1.0 / 0.6+ ratio.

### P3 — Cleanup
- **CF-008:** Locate/rebuild 7 missing G1 slice proofs.
- **CF-011:** File engine request/response_shape extraction gap upstream.
- 7 DB-mock test files — annotate or convert to integration.

## What's Next
- Address CF-001 + CF-002 → re-run `/oli-check --confidence` → expect L3 → 9.
- Address CF-009 (engine resolver) → L2 cap lifts → headline back toward 8–9.
- Address CF-010 (loading hygiene) → §4.5 coverage ≥ 0.95 → L1 cap clears.
